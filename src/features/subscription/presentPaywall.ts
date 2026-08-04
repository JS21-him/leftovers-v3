import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { PREMIUM_ENTITLEMENT_ID, getPurchasesAvailability } from '@/src/lib/purchases';

// Resolves true if the user has (or now has, after purchasing/restoring) the
// premium entitlement. In Expo Go, purchases can't run at all, so scanning
// stays open during development. Once RevenueCat keys are missing in a real
// build, we fail closed instead — a silent free-for-everyone bug is worse
// than a blocked feature.
export async function presentPaywallIfNeeded(): Promise<boolean> {
  const availability = getPurchasesAvailability();
  if (availability === 'expo-go') return true;
  if (availability === 'not-configured') return false;

  const result = await RevenueCatUI.presentPaywallIfNeeded({
    requiredEntitlementIdentifier: PREMIUM_ENTITLEMENT_ID,
  });

  return result === PAYWALL_RESULT.NOT_PRESENTED
    || result === PAYWALL_RESULT.PURCHASED
    || result === PAYWALL_RESULT.RESTORED;
}
