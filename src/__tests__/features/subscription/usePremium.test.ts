/**
 * @jest-environment node
 */
/// <reference types="jest" />

jest.mock('../../../lib/purchases', () => ({
  PREMIUM_ENTITLEMENT_ID: 'premium',
  isPurchasesAvailable: jest.fn(),
}));

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    getCustomerInfo: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
  },
}));

import { fetchIsPremium } from '../../../features/subscription/usePremium';
import Purchases from 'react-native-purchases';
import { isPurchasesAvailable } from '../../../lib/purchases';

const mockGetCustomerInfo = Purchases.getCustomerInfo as jest.Mock;
const mockIsAvailable = isPurchasesAvailable as jest.Mock;

describe('fetchIsPremium', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns false without calling RevenueCat when purchases are unavailable', async () => {
    mockIsAvailable.mockReturnValue(false);

    const result = await fetchIsPremium();
    expect(result).toBe(false);
    expect(mockGetCustomerInfo).not.toHaveBeenCalled();
  });

  it('returns true when the premium entitlement is active', async () => {
    mockIsAvailable.mockReturnValue(true);
    mockGetCustomerInfo.mockResolvedValue({ entitlements: { active: { premium: {} } } });

    const result = await fetchIsPremium();
    expect(result).toBe(true);
  });

  it('returns false when the premium entitlement is absent', async () => {
    mockIsAvailable.mockReturnValue(true);
    mockGetCustomerInfo.mockResolvedValue({ entitlements: { active: {} } });

    const result = await fetchIsPremium();
    expect(result).toBe(false);
  });

  it('throws when getCustomerInfo fails (caller decides fallback behavior)', async () => {
    mockIsAvailable.mockReturnValue(true);
    mockGetCustomerInfo.mockRejectedValue(new Error('network down'));

    await expect(fetchIsPremium()).rejects.toThrow('network down');
  });
});
