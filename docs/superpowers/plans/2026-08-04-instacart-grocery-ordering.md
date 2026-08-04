# One-Tap Grocery Ordering (Instacart Connect) — Implementation Plan

**Goal:** Add an "Order via Instacart" button to the Shopping tab that sends unbought shopping list items to Instacart Connect's Create Shopping List Page endpoint and opens the returned shoppable link.

**Architecture:** `create-instacart-list` edge function (auth-gated, same pattern as `suggest-shopping`) builds `line_items` from the household's unbought `shopping_list_items` and POSTs to Instacart Connect. `useInstacartOrder` hook calls the edge function and opens the resulting URL via `Linking.openURL`. Button lives in `shopping.tsx` next to the existing "Clear N done" action.

**Tech Stack:** Supabase Edge Functions (Deno), Instacart Connect API (`POST /idp/v1/products/products_link`), React Native `Linking`, Jest.

**Prerequisite (blocking, external):** `INSTACART_API_KEY` Edge Function secret. Until set, edge function returns `not_configured` and the button stays hidden.

---

## File Map

| Action | Path |
|--------|------|
| Create | `supabase/functions/create-instacart-list/index.ts` |
| Create | `src/features/shopping/useInstacartOrder.ts` |
| Create | `src/__tests__/features/shopping/useInstacartOrder.test.ts` |
| Modify | `app/(tabs)/shopping.tsx` |

## Task 1: Edge function

- [ ] Create `supabase/functions/create-instacart-list/index.ts`: auth check → look up `household_id` from `profiles` → fetch unbought `shopping_list_items` → 400 `empty_list` if none → check `INSTACART_API_KEY` env, 501 `not_configured` if missing → build `line_items` (best-effort quantity/unit parse from free-text `quantity`, default `1`/`each`) → POST to `${INSTACART_BASE_URL ?? 'https://connect.dev.instacart.tools'}/idp/v1/products/products_link` → return `{ url: data.products_link_url }` or 502 `instacart_error`.

## Task 2: Client hook (TDD)

- [ ] Write `src/__tests__/features/shopping/useInstacartOrder.test.ts` first (success opens URL; `not_configured`/`empty_list`/`instacart_error` set `error` and don't open a URL).
- [ ] Implement `src/features/shopping/useInstacartOrder.ts` to pass those tests.

## Task 3: Wire into Shopping tab

- [ ] Add "Order via Instacart" button to `app/(tabs)/shopping.tsx` header row, hidden when `error === 'not_configured'` after first load attempt, disabled while `isLoading`, `Alert` on other errors.

## Task 4: Verify

- [ ] `npx tsc --noEmit`
- [ ] `npm test`
