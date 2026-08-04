# RevenueCat Monetization — Design Spec

**Date:** 2026-08-04

---

## Overview

Gates AI photo/receipt scanning (the two most expensive-to-run features — Claude Vision calls) behind a single "Premium" entitlement, using RevenueCat to manage subscriptions across iOS/Android. Everything else (manual fridge/shopping management, staples, recipe suggestions, AI shopping suggestions, AI expiry prediction, Instacart ordering) stays free — this mirrors the split already validated in Leftovers v2 (scan features were premium there too), scoped down to just scanning since that's the clearest, most defensible "this costs us real money per use" boundary. Additional gates (e.g. recipe suggestion counts) can be layered on later once pricing is set.

## Prerequisite (blocking, external — user must do this first)

1. Create a RevenueCat account at https://app.revenuecat.com, create a new project
2. In App Store Connect: create an auto-renewable subscription product (e.g. `premium_monthly`)
3. In Google Play Console: create a matching subscription product
4. In RevenueCat dashboard: add both products, group them into an **Offering** named `default`, and create an **Entitlement** named `premium` attached to both products
5. In RevenueCat dashboard, build a Paywall (Paywalls tab) for the `premium` entitlement — this is what `RevenueCatUI.presentPaywallIfNeeded` renders, no in-app UI code needed for the paywall screen itself
6. Get the iOS and Android public API keys from RevenueCat dashboard → Project Settings → API Keys
7. Set `EXPO_PUBLIC_REVENUECAT_IOS_KEY` and `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` in the app's env
8. **Requires an EAS development build** — RevenueCat's native module does not run in Expo Go. `npx eas build:configure` then `eas build --profile development` (needs an Expo account / EAS project linked, also not yet set up in this repo)

Until the API keys are set, the app treats every user as free tier (scan features unavailable) rather than crashing or faking premium access.

## Architecture

**`src/lib/purchases.ts`** — Init wrapper.
- `isPurchasesAvailable()`: `false` when running in Expo Go (`Constants.appOwnership === 'expo'`) or when no API key is set for the current platform — both are legitimate "can't do real purchases here" states, not errors.
- `configurePurchases(userId?)`: calls `Purchases.configure({ apiKey, appUserID: userId })` once, using the RevenueCat App User ID = Supabase user id so entitlements are tied to the account (not the device) and sync if they reinstall or switch devices.
- `PREMIUM_ENTITLEMENT_ID = 'premium'` constant, matches the RevenueCat dashboard entitlement identifier from setup step 4.

**`app/_layout.tsx`** — Modified. Calls `configurePurchases(session.user.id)` once a session exists (mirrors where `supabase` auth state is already wired).

**`src/features/subscription/usePremium.ts`** — New hook. Fetches `Purchases.getCustomerInfo()` on mount, subscribes to `Purchases.addCustomerInfoUpdateListener` for live updates (e.g. after a purchase completes elsewhere), exposes `{ isPremium, isLoading, refresh }`. Returns `isPremium: false` immediately (no network call) when `!isPurchasesAvailable()`.

**`src/features/subscription/presentPaywall.ts`** — New. `presentPaywallIfNeeded(): Promise<boolean>` wraps `RevenueCatUI.presentPaywallIfNeeded({ requiredEntitlementIdentifier: PREMIUM_ENTITLEMENT_ID })` — RevenueCat checks entitlement itself and only shows the dashboard-configured paywall UI if the user lacks it. Returns `true` if the user has (or now has, after purchasing/restoring) access; `false` if they backed out. Returns `false` immediately if `!isPurchasesAvailable()` (Expo Go / not configured) rather than throwing.

**`src/features/subscription/useRequirePremium.ts`** — New hook. Returns a `requirePremium(action: () => void)` function: calls `presentPaywallIfNeeded()`, runs `action()` only if it resolves `true`. Used to gate scan entry points without needing a wrapper component around every button.

**`app/(tabs)/fridge.tsx`** — Modified. `handleScanSource` (currently opens an Alert with Take Photo / Choose from Library) is wrapped: `requirePremium(() => { /* existing alert logic */ })`.

**`app/(tabs)/settings.tsx`** — Modified. New "SUBSCRIPTION" section: shows "Premium" or "Free" status via `usePremium()`, an "Upgrade to Premium" row (calls `presentPaywallIfNeeded()` then `refresh()`) when free, and a "Restore Purchases" row that calls `Purchases.restorePurchases()` then `refresh()`.

## Error handling

`isPurchasesAvailable()` distinguishes *why* purchases aren't available, because the two cases need opposite behavior:

- **Expo Go** (`Constants.appOwnership === 'expo'`): expected during development — scanning proceeds without a paywall so dev builds stay testable. This case disappears once the app ships (users are never in Expo Go).
- **No API key configured for the platform**: this is the pre-launch state before RevenueCat is wired up, but in a *production* build it would mean monetization is silently broken. `requirePremium` fails closed here — shows an `Alert` ("Premium isn't available right now — try again later") rather than letting scanning through for free — so a misconfiguration is loud, not a silent revenue leak.

- RevenueCat network failure during `getCustomerInfo`: `usePremium` falls back to cached `isPremium` value (RevenueCat SDK itself caches customer info on-device) rather than surfacing an error — this is the same graceful-degradation pattern as the rest of the app (no silent *false* claims, just no change).
- Restore purchases with nothing to restore: RevenueCat resolves normally with no active entitlements; UI just doesn't change and stays on "Free".
- RevenueCat network failure during `getCustomerInfo`: `usePremium` falls back to cached `isPremium` value (RevenueCat SDK itself caches customer info on-device) rather than surfacing an error — this is the same graceful-degradation pattern as the rest of the app (no silent *false* claims, just no change).
- Restore purchases with nothing to restore: RevenueCat resolves normally with no active entitlements; UI just doesn't change and stays on "Free".

## Testing

### `src/__tests__/lib/purchases.test.ts`
- `isPurchasesAvailable()` returns `false` in Expo Go regardless of API key
- `isPurchasesAvailable()` returns `false` outside Expo Go with no API key for the platform
- `isPurchasesAvailable()` returns `true` outside Expo Go with an API key present

### `src/__tests__/features/subscription/usePremium.test.ts`
- Not available (Expo Go/no key): `isPremium = false`, `isLoading = false`, no `getCustomerInfo` call
- Available, entitlement active: `isPremium = true`
- Available, entitlement absent: `isPremium = false`
- `getCustomerInfo` throws: `isPremium` stays at its last known value, no crash

### `src/__tests__/features/subscription/useRequirePremium.test.ts`
- `presentPaywallIfNeeded` resolves `true`: action runs
- Resolves `false`: action does not run

## File Map

| File | Purpose |
|------|---------|
| `src/lib/purchases.ts` | Init + availability check |
| `src/features/subscription/usePremium.ts` | Entitlement state hook |
| `src/features/subscription/presentPaywall.ts` | Imperative paywall presentation |
| `src/features/subscription/useRequirePremium.ts` | Gate an action behind the paywall |
| `app/_layout.tsx` | Call `configurePurchases` on session |
| `app/(tabs)/fridge.tsx` | Gate scan entry points |
| `app/(tabs)/settings.tsx` | Subscription status section |
