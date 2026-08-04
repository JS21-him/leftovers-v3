/**
 * @jest-environment node
 */
/// <reference types="jest" />

jest.mock('../../../lib/purchases', () => ({
  PREMIUM_ENTITLEMENT_ID: 'premium',
  getPurchasesAvailability: jest.fn(),
}));

jest.mock('react-native-purchases-ui', () => ({
  __esModule: true,
  default: { presentPaywallIfNeeded: jest.fn() },
  PAYWALL_RESULT: { NOT_PRESENTED: 'NOT_PRESENTED', PURCHASED: 'PURCHASED', RESTORED: 'RESTORED', CANCELLED: 'CANCELLED', ERROR: 'ERROR' },
}));

import { presentPaywallIfNeeded } from '../../../features/subscription/presentPaywall';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { getPurchasesAvailability } from '../../../lib/purchases';

const mockPresent = RevenueCatUI.presentPaywallIfNeeded as jest.Mock;
const mockAvailability = getPurchasesAvailability as jest.Mock;

describe('presentPaywallIfNeeded', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns true without presenting when in Expo Go (fail open for dev)', async () => {
    mockAvailability.mockReturnValue('expo-go');

    const result = await presentPaywallIfNeeded();
    expect(result).toBe(true);
    expect(mockPresent).not.toHaveBeenCalled();
  });

  it('returns false without presenting when not configured (fail closed)', async () => {
    mockAvailability.mockReturnValue('not-configured');

    const result = await presentPaywallIfNeeded();
    expect(result).toBe(false);
    expect(mockPresent).not.toHaveBeenCalled();
  });

  it('returns true when user already has access (NOT_PRESENTED)', async () => {
    mockAvailability.mockReturnValue('available');
    mockPresent.mockResolvedValue(PAYWALL_RESULT.NOT_PRESENTED);

    expect(await presentPaywallIfNeeded()).toBe(true);
  });

  it('returns true after a purchase', async () => {
    mockAvailability.mockReturnValue('available');
    mockPresent.mockResolvedValue(PAYWALL_RESULT.PURCHASED);

    expect(await presentPaywallIfNeeded()).toBe(true);
  });

  it('returns true after a restore', async () => {
    mockAvailability.mockReturnValue('available');
    mockPresent.mockResolvedValue(PAYWALL_RESULT.RESTORED);

    expect(await presentPaywallIfNeeded()).toBe(true);
  });

  it('returns false when the user cancels', async () => {
    mockAvailability.mockReturnValue('available');
    mockPresent.mockResolvedValue(PAYWALL_RESULT.CANCELLED);

    expect(await presentPaywallIfNeeded()).toBe(false);
  });
});
