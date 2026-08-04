import { useCallback } from 'react';
import { Alert } from 'react-native';
import { getPurchasesAvailability } from '@/src/lib/purchases';
import { presentPaywallIfNeeded } from './presentPaywall';

export function useRequirePremium() {
  return useCallback(async (action: () => void) => {
    // Surface a misconfigured production build loudly instead of silently
    // presenting nothing. A user who sees the real paywall and cancels
    // needs no alert — declining a purchase isn't an error.
    if (getPurchasesAvailability() === 'not-configured') {
      Alert.alert("Premium isn't available right now", 'Try again later.');
      return;
    }

    const hasAccess = await presentPaywallIfNeeded();
    if (hasAccess) action();
  }, []);
}
