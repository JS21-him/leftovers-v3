# RevenueCat Monetization — Implementation Plan

**Goal:** Gate AI photo/receipt scanning behind a `premium` RevenueCat entitlement using `react-native-purchases` + `react-native-purchases-ui`'s dashboard-configured paywall (`presentPaywallIfNeeded`). Everything else stays free.

**Prerequisite (blocking, external):** RevenueCat account, App Store Connect + Play Console subscription products, RevenueCat Offering/Entitlement/Paywall configured, API keys as `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`, and an EAS development build (native module, doesn't run in Expo Go). See spec doc for exact steps.

---

## File Map

| Action | Path |
|--------|------|
| Create | `src/lib/purchases.ts` |
| Create | `src/__tests__/lib/purchases.test.ts` |
| Create | `src/features/subscription/usePremium.ts` |
| Create | `src/__tests__/features/subscription/usePremium.test.ts` |
| Create | `src/features/subscription/presentPaywall.ts` |
| Create | `src/features/subscription/useRequirePremium.ts` |
| Create | `src/__tests__/features/subscription/useRequirePremium.test.ts` |
| Modify | `app/_layout.tsx` |
| Modify | `app/(tabs)/fridge.tsx` |
| Modify | `app/(tabs)/settings.tsx` |
| Modify | `package.json` (add `react-native-purchases`, `react-native-purchases-ui`) |

## Task 1: Install SDK + `src/lib/purchases.ts` (TDD)

- [ ] `npx expo install react-native-purchases react-native-purchases-ui`
- [ ] Write `src/__tests__/lib/purchases.test.ts`: `getPurchasesAvailability()` returns `'expo-go'` when `Constants.appOwnership === 'expo'` (checked first, regardless of key); `'not-configured'` when not Expo Go and no key for `Platform.OS`; `'available'` when not Expo Go and a key exists.
- [ ] Implement `src/lib/purchases.ts`: `PREMIUM_ENTITLEMENT_ID`, `getPurchasesAvailability()`, `isPurchasesAvailable()` (`=== 'available'`), `configurePurchases(userId?)` (no-ops unless available; guards against double-configure).

## Task 2: `usePremium` hook (TDD)

- [ ] Write `src/__tests__/features/subscription/usePremium.test.ts` per spec's test list.
- [ ] Implement `src/features/subscription/usePremium.ts`.

## Task 3: Paywall presentation + gate (TDD)

- [ ] Write `src/__tests__/features/subscription/useRequirePremium.test.ts`.
- [ ] Implement `src/features/subscription/presentPaywall.ts` (`presentPaywallIfNeeded`) and `useRequirePremium.ts`, per the fail-open-in-Expo-Go / fail-closed-if-not-configured split from the spec.

## Task 4: Wire in

- [ ] `app/_layout.tsx`: call `configurePurchases(session.user.id)` when session becomes available.
- [ ] `app/(tabs)/fridge.tsx`: wrap `handleScanSource` body in `requirePremium(...)`.
- [ ] `app/(tabs)/settings.tsx`: add SUBSCRIPTION section (status, Upgrade, Restore Purchases).

## Task 5: Verify

- [ ] `npx tsc --noEmit`
- [ ] `npm test`
