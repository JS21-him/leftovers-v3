import Constants from 'expo-constants';
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

export const PREMIUM_ENTITLEMENT_ID = 'premium';

export type PurchasesAvailability = 'available' | 'expo-go' | 'not-configured';

function apiKeyForPlatform(): string | undefined {
  return Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
    : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
}

export function getPurchasesAvailability(): PurchasesAvailability {
  if (Constants.appOwnership === 'expo') return 'expo-go';
  if (!apiKeyForPlatform()) return 'not-configured';
  return 'available';
}

export function isPurchasesAvailable(): boolean {
  return getPurchasesAvailability() === 'available';
}

let configured = false;

export function configurePurchases(userId?: string): void {
  if (configured || !isPurchasesAvailable()) return;
  const apiKey = apiKeyForPlatform();
  if (!apiKey) return;
  Purchases.configure({ apiKey, appUserID: userId });
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.INFO);
  configured = true;
}
