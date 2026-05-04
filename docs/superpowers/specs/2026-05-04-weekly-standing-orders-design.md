# Weekly Standing Orders — Design Spec
_Date: 2026-05-04_

## Overview

Add a WEEKLY section to the Shopping tab where households define a fixed list of recurring items (eggs, milk, bread, etc.). Items are added once and persist. Each item tracks when it was last checked off via a `last_checked_at` timestamp — it counts as "checked this week" for 7 days, then automatically resets. No cron job or server-side scheduler is needed.

---

## Decisions

| Question | Decision | Reason |
|---|---|---|
| UI placement | WEEKLY section above THIS WEEK in shopping tab | Same tab, same layout language — integrated not standalone |
| Reset mechanism | Passive 7-day window on `last_checked_at` — no cron | Simpler, works offline, no server job needed |
| Data storage | Extend existing `staples` table | Already scoped to household, already has RLS; avoids duplicate schema |
| Check behavior | Tap to check sets `last_checked_at = now()`; tap again sets `null` | Allows manual uncheck if user added wrong item |
| Checked appearance | 50% opacity + strikethrough | Matches existing `is_bought` style in THIS WEEK list |
| Add item | `AddStapleModal` — name + quantity inputs | Same shape as `AddShoppingItemModal` |
| Delete item | Swipe-to-delete removes permanently | Permanent removal — not a weekly action |
| Existing list | THIS WEEK and Clear bought unchanged | No side effects on existing behavior |
| Other tabs | No changes | Fridge, recipes, settings unaffected |

---

## Data Layer

### Migration: `supabase/migrations/005_staples_weekly.sql`

```sql
alter table staples
  add column last_checked_at timestamptz null;
```

No new RLS needed — `staples` already has household-scoped policies.

### TypeScript: `src/types/database.ts`

Update `Staple` interface:

```typescript
export interface Staple {
  id: string;
  household_id: string;
  name: string;
  default_quantity: string | null;
  reorder_when_low: boolean;
  created_at: string;
  last_checked_at: string | null;
}
```

---

## Data Flow

### `src/features/shopping/useStaples.ts`

New file. Exports:

```typescript
export function isCheckedThisWeek(lastCheckedAt: string | null): boolean {
  if (!lastCheckedAt) return false;
  return Date.now() - new Date(lastCheckedAt).getTime() < 7 * 24 * 60 * 60 * 1000;
}

export function useStaples(householdId: string | null)
// useQuery: ['staples', householdId] → fetches all staples for household, ordered by name

export function useAddStaple(householdId: string | null, userId: string | null)
// useMutation: inserts { household_id, added_by: userId, name, default_quantity }
// onSuccess: invalidates ['staples', householdId]

export function useToggleStaple(householdId: string | null)
// useMutation: receives { id, currentlyChecked }
//   if currentlyChecked → update last_checked_at = null
//   if !currentlyChecked → update last_checked_at = new Date().toISOString()
// onSuccess: invalidates ['staples', householdId]

export function useDeleteStaple(householdId: string | null)
// useMutation: deletes by id
// onSuccess: invalidates ['staples', householdId]
```

---

## UI Components

### `src/features/shopping/StapleRow.tsx`

Props: `{ staple: Staple; onToggle: () => void; onDelete: () => void }`

- Renders checkbox circle + name + `default_quantity`
- Checkbox value: `isCheckedThisWeek(staple.last_checked_at)`
- Checked state: 50% opacity, name has strikethrough
- Tapping row calls `onToggle`
- Swipe left reveals a red Delete button (same `Swipeable` pattern as `ShoppingItemRow`); tapping it calls `onDelete`

### `src/features/shopping/AddStapleModal.tsx`

Props: `{ visible: boolean; onClose: () => void; onAdd: (name: string, quantity: string) => void }`

- Same layout as `AddShoppingItemModal`
- Title: "Add Weekly Item"
- Two inputs: item name (required), quantity (default "1")
- Add button disabled while name is empty

### `app/(tabs)/shopping.tsx`

Insert WEEKLY section above existing THIS WEEK list:

```
WEEKLY                          ← section header
  "Repeats every week."         ← subtitle
  <StapleRow /> × n             ← one per staple
  + Add weekly item             ← opens AddStapleModal

──────────────────────          ← divider

THIS WEEK                       ← existing section header
  <ShoppingItemRow /> × n       ← unchanged
  + Add item                    ← unchanged
  [Clear bought items]          ← unchanged
```

New state in `shopping.tsx`:
- `showAddStapleModal: boolean`
- Reads `staples` from `useStaples(householdId)`
- Calls `useToggleStaple`, `useDeleteStaple`, `useAddStaple`

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Add staple fails | `Alert.alert('Failed to add item — try again')` |
| Toggle fails | `Alert.alert('Failed to update — try again')` |
| Delete fails | `Alert.alert('Failed to delete — try again')` |
| No household loaded | WEEKLY section shows loading spinner (same as THIS WEEK) |

---

## Tests

### `src/__tests__/features/shopping/useStaples.test.ts`

**`isCheckedThisWeek`:**
- Returns `false` for `null`
- Returns `true` for timestamp within last 7 days
- Returns `false` for timestamp older than 7 days
- Returns `false` for timestamp exactly 7 days ago (boundary)

**`useStaples` (fetch):**
- Returns sorted list of staples for household

**`useAddStaple`:**
- Inserts row with correct `name`, `default_quantity`, `household_id`

**`useToggleStaple`:**
- Sets `last_checked_at = null` when `currentlyChecked = true`
- Sets `last_checked_at` to ISO string when `currentlyChecked = false`

**`useDeleteStaple`:**
- Deletes row by id

---

## New / Modified Files

| File | Change |
|---|---|
| `supabase/migrations/005_staples_weekly.sql` | Add `last_checked_at timestamptz null` to staples |
| `src/types/database.ts` | Add `last_checked_at: string \| null` to `Staple` |
| `src/features/shopping/useStaples.ts` | New — 4 hooks + `isCheckedThisWeek` helper |
| `src/features/shopping/StapleRow.tsx` | New — weekly item row component |
| `src/features/shopping/AddStapleModal.tsx` | New — add weekly item modal |
| `app/(tabs)/shopping.tsx` | Add WEEKLY section above existing list |
| `src/__tests__/features/shopping/useStaples.test.ts` | New — unit tests for all hooks + helper |

---

## Out of Scope

- Pushing weekly items into the main shopping list
- Per-user standing orders (household-level only)
- Custom reset interval (7 days is fixed)
- Ordering/sorting weekly items manually
- Integration with `reorder_when_low` (existing field, not used here)
- AI-suggested weekly items
