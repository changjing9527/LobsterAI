import type { EmbeddedPricingOptions } from '@shared/payment/embeddedPricing';

import type { PortalPricingKeyfrom } from '../../services/endpoints';
import { InAppPurchaseStep, reportInAppPurchase } from './purchaseAnalytics';

export interface PurchaseEntryOptions extends EmbeddedPricingOptions {
  keyfrom?: PortalPricingKeyfrom;
}

/** All recharge and subscription entries open the complete pricing page inside the client. */
export async function openPurchase(
  options: PurchaseEntryOptions = {},
): Promise<{ success: boolean; error?: string }> {
  reportInAppPurchase(InAppPurchaseStep.Open, {
    checkout: 'in_app',
    keyfrom: options.keyfrom,
    traceId: options.traceId,
    tab: options.tab,
    offerTokenAttached: Boolean(options.offerToken),
  });
  try {
    return await window.electron.payment.openPricing(options);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to open pricing' };
  }
}
