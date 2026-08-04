import { useState, useEffect, useCallback } from 'react';
import Purchases, { CustomerInfo } from 'react-native-purchases';
import { PREMIUM_ENTITLEMENT_ID, isPurchasesAvailable } from '@/src/lib/purchases';
import { logger } from '@/src/lib/logger';

export function hasPremiumEntitlement(customerInfo: CustomerInfo): boolean {
  return typeof customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== 'undefined';
}

export async function fetchIsPremium(): Promise<boolean> {
  if (!isPurchasesAvailable()) return false;
  const info = await Purchases.getCustomerInfo();
  return hasPremiumEntitlement(info);
}

export interface PremiumState {
  isPremium: boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function usePremium(): PremiumState {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const premium = await fetchIsPremium();
      setIsPremium(premium);
    } catch (err) {
      // RevenueCat SDK caches customer info on-device; on a transient failure
      // keep the last known value rather than claiming the user lost premium.
      logger.error('fetchIsPremium failed', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    if (!isPurchasesAvailable()) return;
    const listener = (info: CustomerInfo) => setIsPremium(hasPremiumEntitlement(info));
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => { Purchases.removeCustomerInfoUpdateListener(listener); };
  }, [refresh]);

  return { isPremium, isLoading, refresh };
}
