import crypto from 'crypto';
import type { BrowserWindow, Session, WebContentsView, WebContentsViewConstructorOptions } from 'electron';

import { AuthLoginFailureReason, type AuthLoginViewBounds } from '../../../shared/auth/constants';
import { ClientAccountLayout, EmbeddedPortalPage } from '../../../shared/payment/embeddedPricing';
import { revealEmbeddedPortal } from './embeddedPortalPresentation';
import {
  decideNavigation,
  isExternalLinkAllowed,
  matchCompletion,
  type NavigationPolicy,
} from './loginUrlPolicy';

export const EMBEDDED_LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

/** Chromium's net::ERR_ABORTED, reported when a navigation is cancelled or superseded. */
const ERR_ABORTED = -3;

export class EmbeddedLoginError extends Error {
  constructor(readonly reason: AuthLoginFailureReason) {
    super(`Embedded login ended: ${reason}`);
    this.name = 'EmbeddedLoginError';
  }
}

export interface EmbeddedLoginCompletion {
  code: string | null;
  state: string | null;
}

export interface EmbeddedLoginWindowHandle {
  result: Promise<EmbeddedLoginCompletion>;
  focus(): void;
  close(): void;
  setBounds(bounds: AuthLoginViewBounds): void;
}

export interface EmbeddedLoginWindowOptions {
  loginUrl: string;
  policy: NavigationPolicy;
  timeoutMs: number;
  isDev: boolean;
  parent: BrowserWindow | null;
  createView: (options: WebContentsViewConstructorOptions) => WebContentsView;
  onViewChanged: (visible: boolean) => void;
  sessionFromPartition: (partition: string) => Session;
  openExternal: (url: string) => void;
}

interface NavigationEvent {
  url: string;
  isMainFrame: boolean;
  preventDefault(): void;
}

const originForLog = (url: string): string => {
  try {
    return new URL(url).origin;
  } catch {
    return 'invalid-url';
  }
};

/**
 * Hosts the official Portal login page in a throwaway session. The page gets no preload, no Node
 * access and no permissions; the only way it can hand back a result is by navigating to the
 * completion URL, which is intercepted here and never reaches the network.
 */
export function openEmbeddedLoginWindow(options: EmbeddedLoginWindowOptions): EmbeddedLoginWindowHandle {
  const parent = options.parent;
  if (!parent || parent.isDestroyed()) throw new EmbeddedLoginError(AuthLoginFailureReason.LoadFailed);
  const parentContents = parent.webContents;
  const partition = `lobsterai-login-${crypto.randomUUID()}`;
  const loginSession = options.sessionFromPartition(partition);
  const { origin, completionPath } = options.policy.target;
  loginSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  loginSession.setPermissionCheckHandler(() => false);
  loginSession.on('will-download', event => event.preventDefault());
  loginSession.webRequest.onBeforeRequest(
    { urls: [`${origin}${completionPath}*`] },
    (_details, callback) => callback({ cancel: true }),
  );

  const view = options.createView({
    webPreferences: {
      partition,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      devTools: options.isDev,
      spellcheck: false,
      navigateOnDragDrop: false,
    },
  });
  const contents = view.webContents;
  // The only client chrome is the close control; the remote page fills the remaining content area.
  let headerHeight = Math.round(ClientAccountLayout.HeaderHeight * parentContents.getZoomFactor());
  const resize = (): void => {
    if (parent.isDestroyed() || contents.isDestroyed()) return;
    const { width, height } = parent.getContentBounds();
    view.setBounds({ x: 0, y: Math.min(headerHeight, height), width, height: Math.max(0, height - headerHeight) });
  };
  view.setBackgroundColor(ClientAccountLayout.Background);
  view.setVisible(false);
  resize();
  parent.contentView.addChildView(view);

  let settled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let resolveResult!: (completion: EmbeddedLoginCompletion) => void;
  let rejectResult!: (error: EmbeddedLoginError) => void;
  const result = new Promise<EmbeddedLoginCompletion>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });

  const settle = (outcome: EmbeddedLoginCompletion | EmbeddedLoginError): void => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    parent.removeListener('resize', resize);
    parent.removeListener('closed', cancel);
    parentContents.removeListener('did-start-navigation', onParentNavigation);
    if (!parent.isDestroyed()) {
      parent.contentView.removeChildView(view);
      options.onViewChanged(false);
      parentContents.focus();
    }
    if (!contents.isDestroyed()) contents.close();
    void loginSession.clearStorageData().catch((): void => undefined);
    void loginSession.clearCache().catch((): void => undefined);
    if (outcome instanceof EmbeddedLoginError) rejectResult(outcome);
    else resolveResult(outcome);
  };

  const cancel = (): void => settle(new EmbeddedLoginError(AuthLoginFailureReason.Cancelled));
  const onParentNavigation = (_event: unknown, _url: string, _inPlace: boolean, isMainFrame: boolean): void => {
    if (isMainFrame) cancel();
  };
  parent.on('resize', resize);
  parent.on('closed', cancel);
  parentContents.on('did-start-navigation', onParentNavigation);
  contents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape') {
      event.preventDefault();
      cancel();
    }
  });
  contents.on('destroyed', cancel);
  contents.on('dom-ready', () => {
    void revealEmbeddedPortal(view, origin, EmbeddedPortalPage.Login).catch(error => {
      console.error('[EmbeddedLogin] failed to apply the client layout', error);
      settle(new EmbeddedLoginError(AuthLoginFailureReason.LoadFailed));
    });
  });

  const handleNavigation = (event: NavigationEvent): void => {
    const decision = decideNavigation(event.url, event.isMainFrame, options.policy);
    if (decision === 'allow') {
      if (event.isMainFrame) view.setVisible(false);
      return;
    }
    event.preventDefault();
    if (decision === 'complete') {
      const match = matchCompletion(event.url, options.policy.target);
      if (match.kind === 'completion') settle({ code: match.code, state: match.state });
      return;
    }
    console.warn(
      `[EmbeddedLogin] blocked a ${event.isMainFrame ? 'top-level' : 'frame'} navigation to ${originForLog(event.url)}`,
    );
  };

  contents.setWindowOpenHandler(({ url }) => {
    if (isExternalLinkAllowed(url)) options.openExternal(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', details => handleNavigation(details));
  contents.on('will-redirect', details => handleNavigation(details));
  contents.on('will-frame-navigate', details => {
    // will-navigate already covers the main frame.
    if (!details.isMainFrame) handleNavigation(details);
  });
  contents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
    if (!isMainFrame || settled || decideNavigation(url, true, options.policy) === 'allow') return;
    const completion = matchCompletion(url, options.policy.target);
    if (completion.kind === 'completion') {
      settle({ code: completion.code, state: completion.state });
      return;
    }
    view.setVisible(false);
    void contents.loadURL(options.loginUrl).catch((): void => undefined);
  });
  contents.on('did-fail-load', (_event, errorCode, _description, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === ERR_ABORTED || settled) return;
    if (matchCompletion(validatedURL, options.policy.target).kind === 'completion') return;
    console.warn(`[EmbeddedLogin] login page failed to load (code=${errorCode})`);
    settle(new EmbeddedLoginError(AuthLoginFailureReason.LoadFailed));
  });
  timer = setTimeout(
    () => settle(new EmbeddedLoginError(AuthLoginFailureReason.Timeout)),
    options.timeoutMs,
  );
  options.onViewChanged(true);
  void contents.loadURL(options.loginUrl).catch(error => {
    // did-fail-load reports real failures; a superseded initial navigation also rejects here.
    console.debug('[EmbeddedLogin] initial navigation did not finish:', error instanceof Error ? error.message : error);
  });

  return {
    result,
    close: cancel,
    setBounds: bounds => {
      if (settled || !Object.values(bounds).every(Number.isFinite)) return;
      headerHeight = Math.max(36, Math.round(bounds.y * parentContents.getZoomFactor()));
      resize();
    },
    focus: () => {
      if (settled || parent.isDestroyed()) return;
      if (parent.isMinimized()) parent.restore();
      parent.focus();
      contents.focus();
    },
  };
}
