import type { WebContentsView } from 'electron';

import { ClientAccountLayout, EmbeddedPortalPage } from '../../../shared/payment/embeddedPricing';

/** Applied by the client as well as the Portal so older deployed pages cannot show website chrome. */
export function embeddedPortalStyles(page: EmbeddedPortalPage): string {
  const shell = `
    html, body, #app { min-height: 100%; background: ${ClientAccountLayout.Background} !important; }
    .site-header-shell, .site-footer { display: none !important; }
    :root { --site-header-space: 0px !important; --penny-strip-space: 0px !important; }
  `;
  if (page === EmbeddedPortalPage.Pricing) return `${shell}
    .pricing-page { background: ${ClientAccountLayout.Background} !important; }
    .pricing-main { padding-top: 12px !important; }
  `;
  return `${shell}
    .login-page { min-height: 100dvh !important; background: ${ClientAccountLayout.Background} !important; }
    .login-page::before, .login-left, .electron-success-home-btn { display: none !important; }
    .login-body { grid-template-columns: minmax(0, 1fr) !important; width: calc(100% - 48px) !important;
      max-width: 440px !important; margin: 0 auto !important; padding: 24px 0 48px !important;
      box-sizing: border-box !important; gap: 0 !important; align-items: center !important; }
    .login-right { width: 100% !important; }
    .login-container { width: 100% !important; box-sizing: border-box !important;
      padding: 32px !important; border-radius: 24px !important; border: 1px solid #e5e8ee !important;
      background: #ffffff !important; box-shadow: 0 12px 48px rgba(32, 33, 36, .045) !important; }
    .login-card-title { font-size: 26px !important; font-weight: 500 !important; letter-spacing: -.6px !important; }
    @media (max-width: 480px) { .login-container { padding: 24px !important; } }
  `;
}

/** Keep remote content hidden until the client-only presentation has been applied. */
export async function revealEmbeddedPortal(
  view: WebContentsView,
  portalOrigin: string,
  page: EmbeddedPortalPage,
): Promise<void> {
  if (view.webContents.isDestroyed()) return;
  if (new URL(view.webContents.getURL()).origin === portalOrigin) {
    await view.webContents.insertCSS(embeddedPortalStyles(page));
  }
  if (!view.webContents.isDestroyed()) view.setVisible(true);
}
