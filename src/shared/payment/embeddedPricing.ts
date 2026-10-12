import type { AuthLoginViewBounds } from '../auth/constants';

export const EmbeddedPortalPage = {
  Login: 'login',
  Pricing: 'pricing',
} as const;
export type EmbeddedPortalPage = typeof EmbeddedPortalPage[keyof typeof EmbeddedPortalPage];

export const ClientAccountLayout = {
  HeaderHeight: 64,
  Background: '#f7f8fa',
} as const;

export const EmbeddedPricingIpc = {
  Open: 'payment:openPricing',
  Close: 'payment:closePricing',
  SetBounds: 'payment:setPricingBounds',
  StateChanged: 'payment:pricingStateChanged',
} as const;

export const EmbeddedPricingState = {
  Closed: 'closed',
  Loading: 'loading',
  Ready: 'ready',
  Error: 'error',
  LoginRequired: 'login_required',
} as const;
export type EmbeddedPricingState = typeof EmbeddedPricingState[keyof typeof EmbeddedPricingState];

export interface EmbeddedPricingOptions {
  keyfrom?: string;
  traceId?: string;
  offerToken?: string;
  tab?: 'subscription' | 'boost' | 'team';
  banner?: string;
  trialCampaign?: string;
  trialCheckout?: string;
  amount?: string;
}

export interface EmbeddedPricingBridge {
  openPricing(options?: EmbeddedPricingOptions): Promise<{ success: boolean; error?: string }>;
  closePricing(): Promise<void>;
  setPricingBounds(bounds: AuthLoginViewBounds): Promise<void>;
  onPricingStateChanged(callback: (state: EmbeddedPricingState) => void): () => void;
}
