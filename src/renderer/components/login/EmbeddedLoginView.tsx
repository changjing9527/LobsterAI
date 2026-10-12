import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { i18nService } from '../../services/i18n';
import ClientAccountPage from '../common/ClientAccountPage';

/** Supplies the client header and bounds for the isolated login WebContentsView owned by main. */
const EmbeddedLoginView: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const cancel = useCallback(() => { void window.electron.auth.cancelLogin(); }, []);

  useEffect(() => {
    const unsubscribe = window.electron.auth.onLoginViewChanged(setVisible);
    return () => {
      unsubscribe();
      void window.electron.auth.cancelLogin();
    };
  }, []);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!visible || !content) return;
    const updateBounds = (): void => {
      const { x, y, width, height } = content.getBoundingClientRect();
      void window.electron.auth.setLoginViewBounds({ x, y, width, height });
    };
    updateBounds();
    const observer = new ResizeObserver(updateBounds);
    observer.observe(content);
    return () => observer.disconnect();
  }, [visible]);

  if (!visible) return null;

  return (
    <ClientAccountPage title={i18nService.t('authLoginPageTitle')} closeLabel={i18nService.t('authExitLogin')} onBack={cancel}>
      <div ref={contentRef} className="flex min-h-0 flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-sm text-[#737b88]" role="status">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#e5e8ee] border-t-[#f04c3a]" aria-hidden="true" />
          <p>{i18nService.t('loading')}</p>
        </div>
      </div>
    </ClientAccountPage>
  );
};

export default EmbeddedLoginView;
