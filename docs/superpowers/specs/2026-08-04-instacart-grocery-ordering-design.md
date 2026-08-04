# One-Tap Grocery Ordering (Instacart Connect) — Design Spec

**Date:** 2026-08-04

---

## Overview

Adds an "Order via Instacart" action to the Shopping tab. Tapping it sends the household's unbought shopping list items to the Instacart Connect API, which returns a shoppable link (a pre-filled Instacart Marketplace page). The app opens that link — the user picks their store and finishes checkout on Instacart. This app never touches payment, delivery, or inventory data; Instacart owns all of that.

This is **not** a live-inventory or price-matching integration. Instacart's API matches items by name/UPC against whatever stores are available to the user, entirely on their side.

## Prerequisite (blocking, external)

Requires an Instacart Developer Platform account and API key:
1. Apply at https://www.instacart.com/company/business/developers
2. Once approved, get a **development** API key for `https://connect.dev.instacart.tools` to test against
3. Later, request a **production** key for `https://connect.instacart.com`
4. Set `INSTACART_API_KEY` as a Supabase Edge Function secret (dev key first)

Until `INSTACART_API_KEY` is set, the edge function returns a clear "not configured" error and the button is hidden client-side — no fake success state.

## Architecture

**`supabase/functions/create-instacart-list/index.ts`** — New edge function. Auth-gated (same pattern as `suggest-shopping`: requires Authorization header, looks up caller's household via `profiles.household_id`). Reads unbought `shopping_list_items` for the household. If the list is empty, returns 400. Calls Instacart's `POST /idp/v1/products/products_link`:

```json
{
  "title": "Leftovers Shopping List",
  "link_type": "shopping_list",
  "expires_in": 7,
  "line_items": [
    { "name": "Milk", "quantity": 1, "unit": "each" },
    { "name": "Chicken breast", "quantity": 2, "unit": "each" }
  ]
}
```

`quantity`/`unit` are parsed from the item's free-text `quantity` field on a best-effort basis (default to `1` / `"each"` when it can't be parsed as a number — the field is user-typed free text like "2 lbs" today, not structured). Returns `{ url: string }` from Instacart's `products_link_url`, or a typed error:
- `501` `{ error: 'not_configured' }` if `INSTACART_API_KEY` isn't set
- `400` `{ error: 'empty_list' }` if there's nothing to order
- `502` `{ error: 'instacart_error' }` if Instacart's API call fails

**`src/features/shopping/useInstacartOrder.ts`** — New hook. Exposes:
```typescript
{
  orderViaInstacart: () => Promise<void>; // calls edge fn, opens returned URL via Linking.openURL
  isLoading: boolean;
  error: string | null; // one of: 'not_configured' | 'empty_list' | 'instacart_error' | null
}
```

**`app/(tabs)/shopping.tsx`** — Modified. Adds an "Order via Instacart" button near the header (next to "Clear N done"), disabled while `isLoading`. On `error === 'not_configured'`, the button doesn't render at all (this is a deploy-time state, not a user-facing error). On other errors, shows an `Alert`.

## Error handling

- No `INSTACART_API_KEY`: button hidden, matches existing pattern of hiding not-yet-available features rather than showing broken ones.
- Empty shopping list: button disabled (nothing to send).
- Instacart API failure (rate limit, bad request, etc.): `Alert` with retry, mirrors existing `handleClearBought`/`handleToggle` error pattern.
- `Linking.openURL` failure (no browser available): caught, same `Alert` pattern.

## Testing

### `supabase/functions/create-instacart-list` (manual/integration, mirrors `suggest-shopping` tests)
- No auth header → 401
- No `INSTACART_API_KEY` → 501 `not_configured`
- Empty shopping list → 400 `empty_list`
- Valid request → returns `{ url }`

### `src/__tests__/features/shopping/useInstacartOrder.test.ts`
- Success: calls edge function, calls `Linking.openURL` with returned url
- `not_configured` error: does not attempt to open a URL, sets `error`
- `empty_list` error: sets `error`, no URL opened
- Edge function throws (network): sets `error = 'instacart_error'`

## File Map

| File | Purpose |
|------|---------|
| `supabase/functions/create-instacart-list/index.ts` | New edge function calling Instacart Connect |
| `src/features/shopping/useInstacartOrder.ts` | New hook: trigger order, open resulting URL |
| `app/(tabs)/shopping.tsx` | Adds Order via Instacart button |
