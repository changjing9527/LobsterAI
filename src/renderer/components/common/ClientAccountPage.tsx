import { XMarkIcon } from '@heroicons/react/24/outline';
import { ClientAccountLayout } from '@shared/payment/embeddedPricing';
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { i18nService } from '../../services/i18n';
import {
  createModalEscapeLayerId,
  isTopModalEscapeLayer,
  registerModalEscapeLayer,
  unregisterModalEscapeLayer,
} from './modalEscape';

interface ClientAccountPageProps {
  title: string;
  onBack: () => void;
  closeLabel?: string;
  children: React.ReactNode;
}

/** An opaque, window-sized account flow. Closing it returns to the existing client session. */
const ClientAccountPage: React.FC<ClientAccountPageProps> = ({ title, onBack, closeLabel, children }) => {
  const layerRef = useRef<number | null>(null);
  if (layerRef.current === null) layerRef.current = createModalEscapeLayerId();
  const layerId = layerRef.current;
  useEffect(() => {
    registerModalEscapeLayer(layerId);
    return () => unregisterModalEscapeLayer(layerId);
  }, [layerId]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.defaultPrevented || !isTopModalEscapeLayer(layerId)) return;
      event.preventDefault();
      onBack();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onBack, layerId]);

  return createPortal(
    <section
      data-app-modal
      className="fixed inset-0 z-[10060] flex flex-col text-[#202124]"
      style={{ background: ClientAccountLayout.Background }}
      aria-label={title}
    >
      <header className="draggable flex shrink-0 items-center justify-end px-5" style={{ height: ClientAccountLayout.HeaderHeight }}>
        <button
          type="button"
          onClick={onBack}
          aria-label={closeLabel ?? i18nService.t('close')}
          title={closeLabel ?? i18nService.t('close')}
          className="non-draggable inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e5e8ee] bg-white text-[#737b88] transition-colors hover:border-[#c9ced8] hover:text-[#202124] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f04c3a]"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </header>
      {children}
    </section>,
    document.body,
  );
};

export default ClientAccountPage;
