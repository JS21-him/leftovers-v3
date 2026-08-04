/**
 * @jest-environment node
 */
/// <reference types="jest" />

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { appOwnership: null },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: { configure: jest.fn(), setLogLevel: jest.fn() },
  LOG_LEVEL: { INFO: 'INFO' },
}));

import Constants from 'expo-constants';
import { getPurchasesAvailability, isPurchasesAvailable } from '../../lib/purchases';

describe('getPurchasesAvailability', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
    delete process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
    (Constants as unknown as { appOwnership: string | null }).appOwnership = null;
  });

  it('returns expo-go when running in Expo Go, regardless of key', () => {
    (Constants as unknown as { appOwnership: string | null }).appOwnership = 'expo';
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'test-key';

    expect(getPurchasesAvailability()).toBe('expo-go');
  });

  it('returns not-configured outside Expo Go with no key for the platform', () => {
    (Constants as unknown as { appOwnership: string | null }).appOwnership = 'standalone';

    expect(getPurchasesAvailability()).toBe('not-configured');
  });

  it('returns available outside Expo Go with a key for the platform', () => {
    (Constants as unknown as { appOwnership: string | null }).appOwnership = 'standalone';
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'test-key';

    expect(getPurchasesAvailability()).toBe('available');
  });
});

describe('isPurchasesAvailable', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
    (Constants as unknown as { appOwnership: string | null }).appOwnership = null;
  });

  it('is false when not available', () => {
    (Constants as unknown as { appOwnership: string | null }).appOwnership = 'expo';
    expect(isPurchasesAvailable()).toBe(false);
  });

  it('is true when available', () => {
    (Constants as unknown as { appOwnership: string | null }).appOwnership = 'standalone';
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'test-key';
    expect(isPurchasesAvailable()).toBe(true);
  });
});
