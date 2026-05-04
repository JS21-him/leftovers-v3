# AI Expiry Prediction & Shopping Suggestions — Design Spec

**Date:** 2026-05-04

---

## Overview

Two separate AI features that make the app feel like it knows your kitchen:

1. **AI Expiry Prediction** — when adding a fridge item, the expiry date field auto-fills with an AI-predicted date so the user never has to type it manually.
2. **AI Shopping Suggestions** — the Shopping tab shows an inline banner of AI-generated suggestions (based on fridge contents, expiring items, and shopping habits) that the user can add to THIS WEEK with one tap.

Both features are built independently and can be shipped separately. Feature 1 (expiry) is implemented first.

---

## Feature 1: AI Expiry Prediction

### What it does

When the user types an item name in the "Add to Fridge" modal and pauses (500ms debounce), the expiry date field auto-fills:

- **Common items** (milk, chicken, eggs, etc.): instant fill from a client-side lookup table. No network call, no delay.
- **Unknown items**: silent fallback to a Claude edge function. Shows a spinner for ~1–2 seconds, then fills with the predicted date and a one-line explanation.

The filled field shows:
- Orange border (matching `COLORS.primary` / `COLORS.border` for the AI-filled state uses `#f97316` border at 1.5px)
- "✦ AI" badge in orange
- A one-line explanation below the field (e.g. "Raw chicken keeps 2–3 days in the fridge.")
- A pencil icon (✎) to indicate the field is editable

The user can tap the field to edit the date at any time. If they clear the name field, the expiry field clears too. If they type a date manually before AI fills, leave it alone.

### Architecture

**`src/lib/expiryLookup.ts`** — New file. Client-side lookup table of ~200 common food items keyed by normalized item name (lowercase, trimmed). Returns `{ days: number; explanation: string } | null`. Normalized matching handles plurals and common variants (e.g. "eggs" → "egg", "chicken breast" → "chicken").

**`supabase/functions/predict-expiry/index.ts`** — New edge function. Receives `{ name: string }` in the request body. Calls Claude (`claude-haiku-4-5-20251001`) to estimate shelf life. Returns `{ expiryDate: string; explanation: string }` where `expiryDate` is ISO date (YYYY-MM-DD). Auth-gated (requires Authorization header). No database reads needed.

**`src/features/fridge/useExpiryPrediction.ts`** — New hook. Accepts the item name string. Handles the hybrid lookup: instant result if in table, else debounces 500ms and calls the edge function. Returns:
```typescript
{
  expiryDate: string | null;     // YYYY-MM-DD
  explanation: string | null;    // one-line description
  isLoading: boolean;            // true only during AI fallback network call
  source: 'lookup' | 'ai' | null; // null = no prediction yet
}
```
Resets all state when name becomes empty.

**`src/features/fridge/AddFridgeItemModal.tsx`** — Modified. Uses `useExpiryPrediction(name)`. Replaces the plain `TextInput` for expiry date with a smart expiry field component:
- If AI filled (`source !== null`): shows the date with orange border, "✦ AI" badge, pencil icon, and explanation text below. Tapping the field allows manual override (switches to a regular text input).
- If `isLoading`: shows a spinner and "Looking up expiry..." text in place of the field.
- If user has manually typed a date: shows the field normally (no AI badge).
- Validation: still enforces YYYY-MM-DD format before submitting.

### Data flow

```
User types name
  → 500ms debounce fires
  → lookupExpiry(normalizedName)
    → hit: set expiryDate + explanation, source = 'lookup', done
    → miss: set isLoading = true
      → call predict-expiry edge function with { name }
        → success: set expiryDate + explanation, source = 'ai', isLoading = false
        → failure: set isLoading = false, source = null (field stays empty — silent fail)
```

### Error handling

- Edge function unavailable or Claude API error: silently fail. Field stays empty. User can type manually. No error shown — the expiry field has always been optional.
- Network timeout: same — silent fail after reasonable timeout (10s).
- Invalid AI response (can't parse date): silent fail.
- User edits the AI-filled date: update state to manual mode (clear badge, keep date).

---

## Feature 2: AI Shopping Suggestions

### What it does

An inline banner sits at the top of the Shopping tab, above the WEEKLY section. It shows "✦ N items to consider" with individual suggestions below. Each suggestion has a name, a one-line reason, and a "+ Add" button that sends it to THIS WEEK (the regular shopping list). There's also an "Add all" button and a "↻ Refresh" link.

**Generation policy:** Generated once when the Shopping tab mounts for the first time in an app session. Not regenerated on tab re-focus, pull-to-refresh, or remounts — only when the user taps "↻ Refresh". This keeps API costs predictable and prevents the banner from jumping around.

The edge function receives context about:
- Items currently in the fridge (name + expiry_date)
- Items already on THIS WEEK's shopping list (to avoid duplicates)
- The household's weekly staples (to avoid recommending things already tracked)

Claude returns 3–5 suggestions, each with a `name` and `reason`.

### Architecture

**`supabase/functions/suggest-shopping/index.ts`** — New edge function. Auth-gated. Reads fridge items (with expiry dates), current shopping list items (`is_bought = false`), and staples from the database. Calls Claude (`claude-haiku-4-5-20251001`) and returns `{ suggestions: { name: string; reason: string }[] }`. Returns 3–5 items. Excludes items already in the shopping list.

**`src/features/shopping/useShoppingSuggestions.ts`** — New hook. Manages session-scoped suggestion state with a `useRef` flag (`hasGeneratedRef`) to prevent re-generation on remount. Exposes:
```typescript
{
  suggestions: { name: string; reason: string }[] | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void; // clears hasGeneratedRef and re-generates
}
```
Calls the edge function directly (not TanStack Query — this is session state that should not be cached to disk or refetched automatically).

**`src/features/shopping/ShoppingSuggestionsCard.tsx`** — New component. Renders the banner. Accepts:
```typescript
{
  suggestions: { name: string; reason: string }[] | null;
  isLoading: boolean;
  error: string | null;
  onAdd: (name: string) => void;
  onAddAll: (names: string[]) => void;
  onRefresh: () => void;
}
```
States:
- **Loading:** spinner + "Finding suggestions…" text inside the banner
- **Error:** "Couldn't load suggestions" with a retry link
- **Loaded:** list of suggestion rows, each with name, reason, and "+ Add" / "✓ Added" button
- **Empty (0 items returned):** hide the card entirely

The "added" state is local to the card — once tapped, the "+ Add" button turns to "✓ Added" (green). "Add all" is only shown when at least one item is not yet added.

**`app/(tabs)/shopping.tsx`** — Modified. Imports `useShoppingSuggestions` and `ShoppingSuggestionsCard`. Passes `householdId` into the hook. Adds `ShoppingSuggestionsCard` as the first element inside `renderWeeklyHeader` (above the WEEKLY section label).

### Data flow

```
Shopping tab mounts
  → useShoppingSuggestions(householdId)
    → hasGeneratedRef.current === false
      → set isLoading = true
      → call suggest-shopping edge function
        → success: set suggestions, isLoading = false, hasGeneratedRef = true
        → failure: set error, isLoading = false, hasGeneratedRef = true (don't retry automatically)
    → hasGeneratedRef.current === true: skip (use existing state)

User taps ↻ Refresh
  → refresh() called
    → hasGeneratedRef.current = false
    → re-runs generation (clears old suggestions, shows spinner again)

User taps + Add on a suggestion
  → onAdd(name) → addMutation.mutate({ name, quantity: '1' }) in shopping.tsx
  → card marks item as added locally

User taps Add all
  → onAddAll(unadded names) → calls handleAdd for each
  → all items marked as added locally
```

### Error handling

- Edge function unavailable: show "Couldn't load suggestions" with a "Retry" link in the banner. Does not affect the rest of the Shopping tab.
- Empty fridge: edge function returns empty suggestions array → card is hidden.
- Adding a suggestion fails: same error handling as regular shopping list add (Alert).

---

## File Map

### New files
| File | Purpose |
|------|---------|
| `src/lib/expiryLookup.ts` | Client-side item-name → shelf life table + `lookupExpiry(name)` |
| `src/features/fridge/useExpiryPrediction.ts` | Hybrid expiry prediction hook |
| `supabase/functions/predict-expiry/index.ts` | Claude edge function for unknown items |
| `src/features/shopping/useShoppingSuggestions.ts` | Session-scoped shopping suggestions hook |
| `src/features/shopping/ShoppingSuggestionsCard.tsx` | Suggestions banner component |
| `supabase/functions/suggest-shopping/index.ts` | Claude edge function for shopping suggestions |

### Modified files
| File | Change |
|------|--------|
| `src/features/fridge/AddFridgeItemModal.tsx` | Replace expiry TextInput with smart AI-filled expiry field |
| `app/(tabs)/shopping.tsx` | Add `useShoppingSuggestions` hook + `ShoppingSuggestionsCard` in header |

### Unchanged files
| File | Note |
|------|------|
| `src/lib/expiryDefaults.ts` | Kept as-is (category-based fallback — not used by new feature but tests still pass) |
| `src/types/database.ts` | No schema changes needed |
| All other feature files | No changes |

---

## Testing

### `src/__tests__/lib/expiryLookup.test.ts`
- Common items return correct days (milk: 7, chicken breast: 3, eggs: 21, etc.)
- Normalization: "Chicken Breast" matches "chicken breast"
- Unknown item returns null
- At least 10 specific items tested

### `src/__tests__/features/fridge/useExpiryPrediction.test.ts`
- Known item: returns lookup result immediately, `isLoading` never true, `source = 'lookup'`
- Unknown item: `isLoading = true` during fetch, `source = 'ai'` after success
- Unknown item, fetch fails: `isLoading = false`, all fields null (silent fail)
- Empty name: all fields null, no fetch triggered
- Name changes from known to unknown: clears state, triggers AI call
- Name clears: resets all state

### `src/__tests__/features/shopping/useShoppingSuggestions.test.ts`
- First mount: generates suggestions (calls edge function)
- Second mount (remount): does not re-call edge function (uses cached state via ref)
- `refresh()`: re-calls edge function regardless of prior generation
- Error response: sets `error`, clears suggestions
- `householdId` undefined: does not call edge function

### `supabase/functions/predict-expiry` (manual/integration)
- Valid item name → returns valid YYYY-MM-DD date + explanation
- No auth header → 401
- Missing body → 400

### `supabase/functions/suggest-shopping` (manual/integration)
- Valid request → returns 3–5 suggestions, each with name + reason
- No auth header → 401
- Items already in shopping list are excluded from suggestions

---

## Expiry Lookup Table — Minimum Coverage

The table in `expiryLookup.ts` must include at minimum these items (normalized lowercase):

**Dairy:** milk, whole milk, skim milk, butter, cheese, cheddar, mozzarella, parmesan, cream cheese, sour cream, yogurt, greek yogurt, heavy cream, whipping cream, eggs  
**Meat:** chicken, chicken breast, chicken thighs, ground beef, beef, pork, bacon, sausage, salmon, fish, tuna steak, shrimp  
**Produce:** lettuce, spinach, kale, broccoli, carrots, celery, cucumber, tomato, tomatoes, bell pepper, onion, garlic, avocado, lemon, lime, strawberries, blueberries, raspberries, grapes, apple, apples, banana, bananas, mango, mushrooms, zucchini, asparagus  
**Cooked/prepared:** cooked chicken, leftover rice, cooked pasta, soup, stew, leftover pizza  
**Deli:** deli meat, ham, turkey slices, salami  
**Bread/bakery:** bread, sliced bread, bagels, tortillas  
**Other fridge items:** orange juice, milk alternative, almond milk, oat milk, tofu, hummus, salsa, pasta sauce, opened wine

Each entry stores `{ days: number; explanation: string }`.

---

## UI Details

### Expiry field (AI-filled state)
```
┌─────────────────────────────────────────┐  ← orange border (#f97316, 1.5px)
│  May 9, 2026                   [✦ AI] ✎ │
└─────────────────────────────────────────┘
  Raw chicken keeps 2–3 days in the fridge.   ← COLORS.muted, 12px
```

### Expiry field (loading state)
```
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  ← dashed border
│  ⟳  Looking up expiry...               │
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

### Suggestions banner (loaded)
```
┌───────────────────────────────────────────┐  ← bg: #fff0e6, border: #f97316
│  ✦ 3 items to consider      ↻ Refresh    │
│  Based on your fridge & habits   Add all  │
├───────────────────────────────────────────┤
│  Milk                          [+ Add]    │
│  Expires tomorrow                         │
├───────────────────────────────────────────┤
│  Chicken breast                [+ Add]    │
│  Needed for Pasta Bake recipe             │
├───────────────────────────────────────────┤
│  Eggs                          [✓ Added]  │
│  Weekly staple — not bought yet           │
└───────────────────────────────────────────┘
```
