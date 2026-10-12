import { EmbeddedPricingState } from '@shared/payment/embeddedPricing';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import ClientAccountPage from '../../../components/common/ClientAccountPage';
import { authService } from '../../../services/auth';
import { i18nService } from '../../../services/i18n';

/** The native pricing view and its close control fill the same client window as login. */
const PurchaseCenter: React.FC = () => {
  const [state, setState] = useState<EmbeddedPricingState>(EmbeddedPricingState.Closed);
  const currentState = useRef<EmbeddedPricingState>(EmbeddedPricingState.Closed);
  const contentRef = useRef<HTMLDivElement>(null);
  const loginPending = useRef(false);
  const close = useCallback(() => { void window.electron.payment.closePricing(); }, []);
  const retry = useCallback(() => { void window.electron.payment.openPricing(); }, []);

  useEffect(() => {
    const unsubscribe = window.electron.payment.onPricingStateChanged(next => {
      const wasOpen = currentState.current !== EmbeddedPricingState.Closed;
      currentState.current = next;
      setState(next);
      if (next === EmbeddedPricingState.Closed && wasOpen) {
        void authService.refreshQuota({ refreshProfileSummary: true });
      }
      if (next === EmbeddedPricingState.LoginRequired && !loginPending.current) {
        loginPending.current = true;
        void authService.login().finally(() => {
          loginPending.current = false;
          if (currentState.current === EmbeddedPricingState.LoginRequired) retry();
        });
      }
    });
    return () => { unsubscribe(); close(); };
  }, [close, retry]);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (state === EmbeddedPricingState.Closed || !content) return;
    const update = (): void => {
      const { x, y, width, height } = content.getBoundingClientRect();
      void window.electron.payment.setPricingBounds({ x, y, width, height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(content);
    return () => observer.disconnect();
  }, [state]);

  if (state === EmbeddedPricingState.Closed) return null;
  const failed = state === EmbeddedPricingState.Error;
  return (
    <ClientAccountPage title={i18nService.t('purchaseCenterTitle')} closeLabel={i18nService.t('purchaseClosePricing')} onBack={close}>
      <div ref={contentRef} className="flex min-h-0 flex-1 items-center justify-center">
        {state !== EmbeddedPricingState.Ready && (
          <div className="flex flex-col items-center gap-4 text-sm text-[#737b88]" role="status">
            {!failed && <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#e5e8ee] border-t-[#f04c3a]" aria-hidden="true" />}
            <p>{i18nService.t(failed ? 'purchaseLoadFailed' : 'purchaseLoading')}</p>
            {failed && <button type="button" onClick={retry} className="rounded-full bg-[#202124] px-6 py-2.5 text-white">{i18nService.t('purchaseRetry')}</button>}
          </div>
        )}
      </div>
    </ClientAccountPage>
  );
};

export default PurchaseCenter;
