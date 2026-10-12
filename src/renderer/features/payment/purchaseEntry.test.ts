import { afterEach, expect, test, vi } from 'vitest';

import { openPurchase } from './purchaseEntry';

vi.mock('../../services/logReporter', () => ({ reportYdAnalyzer: vi.fn(async () => true) }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('opens the complete pricing page in the client and preserves offer attribution', async () => {
  const openPricing = vi.fn(async () => ({ success: true }));
  const openExternal = vi.fn();
  const getAvailability = vi.fn(async () => ({ enabled: false }));
  vi.stubGlobal('window', { electron: { payment: { openPricing, getAvailability }, shell: { openExternal } } });
  const options = { tab: 'boost' as const, keyfrom: 'html_share' as const, traceId: 'trace-1', offerToken: 'offer-1' };

  await expect(openPurchase(options)).resolves.toEqual({ success: true });

  expect(openPricing).toHaveBeenCalledWith(options);
  expect(getAvailability).not.toHaveBeenCalled();
  expect(openExternal).not.toHaveBeenCalled();
});

test('reports a failed in-client open without sending the user to a browser', async () => {
  const openExternal = vi.fn();
  vi.stubGlobal('window', { electron: {
    payment: { openPricing: vi.fn(async () => { throw new Error('unavailable'); }) },
    shell: { openExternal },
  } });

  await expect(openPurchase()).resolves.toEqual({ success: false, error: 'unavailable' });
  expect(openExternal).not.toHaveBeenCalled();
});
