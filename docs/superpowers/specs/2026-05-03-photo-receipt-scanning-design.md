# Photo & Receipt Scanning — Design Spec
_Date: 2026-05-03_

## Overview

Reduce friction for adding items to the fridge by letting users photograph a grocery receipt or a pile of groceries. Claude Vision processes the image via Supabase Edge Functions and instantly adds all detected items to the fridge — no review screen, no manual entry. Swipe-to-delete handles corrections.

---

## Decisions

| Question | Decision | Reason |
|---|---|---|
| Scan types | Receipt photo AND item photo | Both reduce friction at different points in the grocery flow |
| Review step | None — instant add | Maximum friction reduction; swipe-to-delete handles mistakes |
| AI backend | Supabase Edge Functions + Claude Vision | Same pattern as Phase 4 (suggest-recipes); API key secured server-side |
| Camera library | expo-image-picker | Already in Expo SDK; handles camera + library in one call |
| Image optimization | Resize to 1024px max, 60% JPEG quality | Keeps Edge Function payloads small and fast |
| Expiry dates | Category-based smart defaults | Competitors fail here; smart defaults differentiate immediately |

---

## Entry Point: Speed Dial FAB

The fridge screen's `+` FAB is replaced with a **SpeedDialFAB** component. Tap to expand into three options:

- 📷 **Scan Receipt**
- 🥦 **Photo of Items**
- ✏️ **Add Manually**

Tapping outside collapses it. On expand, a semi-transparent overlay dims the fridge list to focus attention on the options.

---

## Image Flow

1. User taps scan option → `expo-image-picker` opens with "Take Photo" / "Choose from Library"
2. After selection: resize to max 1024px, compress to 60% JPEG quality, encode to base64
3. Call appropriate Edge Function with base64 payload
4. Fridge screen shows loading overlay ("Adding items…") while function runs
5. On success: items added to fridge, overlay dismisses, list refreshes
6. On failure: error toast ("No items found — try a clearer photo" or "Scan failed, try again"), nothing added

---

## Edge Functions

### `supabase/functions/scan-receipt/index.ts`

```
Model: claude-haiku-4-5-20251001
Input: { image: string (base64), householdId: string, userId: string }
Prompt: "This is a grocery receipt. Extract every food/grocery item. Return ONLY a JSON array:
[{name, quantity, category}]. category must be one of: dairy, produce, meat, pantry, frozen,
beverages, other. Use quantity from the receipt (e.g. '2', '1 lb'). If unclear, default
quantity to '1'."
Output: FridgeItem[] (after inserting to DB)
```

### `supabase/functions/scan-items/index.ts`

```
Model: claude-haiku-4-5-20251001
Input: { image: string (base64), householdId: string, userId: string }
Prompt: "This is a photo of food items or groceries. Identify every visible food item.
Return ONLY a JSON array: [{name, quantity, category}]. category must be one of: dairy,
produce, meat, pantry, frozen, beverages, other. Default quantity to '1'."
Output: FridgeItem[] (after inserting to DB)
```

Both functions:
- Use `Deno.serve` (not old `serve` from deno.land/std)
- Read Anthropic response as `.text()` first, then `JSON.parse`
- Verify JWT from Supabase auth header
- Apply category-based expiry defaults inline (duplicate of `expiryDefaults.ts` logic, in Deno)
- Insert all parsed items to `fridge_items` table
- Return inserted items array

---

## Smart Expiry Defaults

Applied automatically when items are added via scan, keyed by category:

| Category | Default days from today |
|---|---|
| produce | +5 |
| dairy | +7 |
| meat | +3 |
| frozen | +90 |
| beverages | +14 |
| pantry | +180 |
| other | +7 |

Implemented as a pure function in `src/lib/expiryDefaults.ts`:
```ts
getExpiryDate(category: string): string  // returns YYYY-MM-DD
```

---

## New Files

| File | Purpose |
|---|---|
| `supabase/functions/scan-receipt/index.ts` | Edge Function — receipt vision |
| `supabase/functions/scan-items/index.ts` | Edge Function — item photo vision |
| `src/lib/expiryDefaults.ts` | Category → default expiry date |
| `src/features/fridge/useScanFridge.ts` | `scanReceipt` + `scanItems` async fns + TanStack mutations |
| `src/features/fridge/SpeedDialFAB.tsx` | Expandable FAB with 3 options |

## Modified Files

| File | Change |
|---|---|
| `app/(tabs)/fridge.tsx` | Replace `+` FAB with `SpeedDialFAB` |

---

## Tests

### `src/__tests__/features/fridge/useScanFridge.test.ts`
- `scanReceipt`: valid response → returns item array; empty array response → returns []; network error → throws
- `scanItems`: same cases

### `src/__tests__/lib/expiryDefaults.test.ts`
- Each category returns a date that is the correct number of days in the future
- Unknown category falls back to +7 days

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Blurry/unreadable image | Claude returns `[]` → toast "No items found — try a clearer photo" |
| Network failure | Mutation error → toast "Scan failed, try again" |
| Partial JSON parse failure | Skip malformed entries, add valid ones |
| `ANTHROPIC_API_KEY` not set | Edge Function 500 → same error toast |
| Empty receipt / no food items | `[]` → same "No items found" toast |

---

## Out of Scope

- Barcode scanning (separate future feature)
- Expiry date extraction from receipts (dates on receipts are purchase dates, not expiry)
- Item deduplication (if milk already in fridge, still adds another — user deletes if needed)
- Quantity merging with existing items
