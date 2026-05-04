# Dietary Profile — Design Spec
_Date: 2026-05-04_

## Overview

Add household-level dietary preferences to Leftovers v3. Users toggle restrictions (vegetarian, vegan, gluten-free, dairy-free, nut-free, kosher, halal) in the Settings screen. The AI uses these preferences to personalize recipe suggestions and future shopping recommendations — preferences inform the AI but do not hard-filter or hide any foods.

---

## Decisions

| Question | Decision | Reason |
|---|---|---|
| Per-user or per-household | Household-level | One fridge, shared preferences; matches existing household-scoped data model |
| Storage | `dietary_restrictions text[]` on `households` table | No new table needed; covered by existing household RLS |
| Data format | Array of string slugs (`["vegetarian","gluten-free"]`) | Simple, extensible, easy to pass to AI as a list |
| UI location | New DIETARY PREFERENCES section in Settings screen | Already the home for household config; no new tab needed |
| Save behavior | Auto-save on toggle | No Save button = less friction, immediate feedback |
| AI effect | Appended to `suggest-recipes` prompt when non-empty | Soft preference, not a hard filter |
| Scope | Recipe suggestions only (for now) | Shopping recommendation AI integration comes in a later feature |

---

## Restriction Options

| Slug | Display Label |
|---|---|
| `vegetarian` | Vegetarian |
| `vegan` | Vegan |
| `gluten-free` | Gluten-Free |
| `dairy-free` | Dairy-Free |
| `nut-free` | Nut-Free |
| `kosher` | Kosher |
| `halal` | Halal |

---

## Settings UI

A new **DIETARY PREFERENCES** section is inserted between HOUSEHOLD and ACCOUNT in `app/(tabs)/settings.tsx`. It contains:

- A subtitle: `"Used by AI for recipe suggestions and shopping recommendations."`
- 7 toggle rows inside a grouped card (matching the existing `row` style)
- Each row: restriction label on left, RN `Switch` component on right
- Footer note: `"Changes save automatically."`
- Toggles are disabled while the mutation is pending (prevents double-tap race)

When the household has no dietary restrictions set, all toggles are off. Toggling one on immediately fires the mutation. Toggling it off immediately fires again. The optimistic update is reflected in the UI before the server responds; on error, the toggle reverts and an `Alert.alert` shows "Failed to save preference."

---

## Data Layer

### Migration: `supabase/migrations/004_dietary_preferences.sql`

```sql
alter table households
  add column dietary_restrictions text[] not null default '{}';
```

No new RLS needed — `households` is already protected by existing policies.

### TypeScript: `src/types/database.ts`

Add to `Household` interface:
```typescript
dietary_restrictions: string[];
```

---

## Data Flow

### `src/features/household/useHouseholdSharing.ts`

Two new exports:

```typescript
export async function updateDietaryRestrictions(
  householdId: string,
  restrictions: string[]
): Promise<Household>

export function useUpdateDietaryRestrictions(
  householdId: string | null,
  userId: string | null
)
```

`updateDietaryRestrictions` runs:
```typescript
supabase.from('households').update({ dietary_restrictions: restrictions }).eq('id', householdId).select().single()
```

`useUpdateDietaryRestrictions` mutation:
- `mutationFn`: calls `updateDietaryRestrictions`
- `onSuccess`: `queryClient.invalidateQueries({ queryKey: ['household', userId] })`
- `onError`: no-op (caller handles UI revert via Alert)

### `app/(tabs)/settings.tsx`

- Reads `household.dietary_restrictions ?? []` from existing `useHouseholdQuery` result
- Local `pendingRestrictions` state mirrors the server value; updated optimistically on toggle
- Each toggle calls `updateMutation.mutateAsync(newArray)` — on error reverts local state and shows `Alert.alert`
- Toggles `disabled` while `updateMutation.isPending`

---

## AI Integration

### `supabase/functions/suggest-recipes/index.ts`

After fetching `profile.household_id`, fetch dietary restrictions from the household:

```typescript
const { data: household } = await supabase
  .from('households')
  .select('dietary_restrictions')
  .eq('id', profile.household_id)
  .single();

const restrictions: string[] = household?.dietary_restrictions ?? [];
```

Append to the prompt only if non-empty:

```typescript
const dietaryLine = restrictions.length > 0
  ? `\n\nDietary restrictions for this household: ${restrictions.join(', ')}. Respect these in all suggestions.`
  : '';

const prompt = `I have these items in my fridge: ${itemList}.${dietaryLine}\n\nSuggest exactly 3 simple recipes...`;
```

---

## New / Modified Files

| File | Change |
|---|---|
| `supabase/migrations/004_dietary_preferences.sql` | Add `dietary_restrictions text[]` to households |
| `src/types/database.ts` | Add `dietary_restrictions: string[]` to `Household` |
| `src/features/household/useHouseholdSharing.ts` | Add `updateDietaryRestrictions` + `useUpdateDietaryRestrictions` |
| `app/(tabs)/settings.tsx` | Add DIETARY PREFERENCES section with 7 toggles |
| `supabase/functions/suggest-recipes/index.ts` | Fetch restrictions + append to prompt |

---

## Tests

### `src/__tests__/features/household/useHouseholdSharing.test.ts`

New cases for `updateDietaryRestrictions`:
- Valid update → returns updated household with new restrictions array
- Empty array update → returns household with `dietary_restrictions: []`
- DB error → throws

### Settings toggle logic (unit tested via `useUpdateDietaryRestrictions` mock):
- Toggling a restriction ON: mutation called with restriction added to array
- Toggling a restriction OFF: mutation called with restriction removed from array

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Toggle mutation fails (network/DB) | Revert local state; `Alert.alert('Failed to save — try again')` |
| Household not loaded yet | Toggles render as disabled (no `household` data) |
| `dietary_restrictions` missing from old rows | Defaults to `[]` via `?? []` guard on client |

---

## Out of Scope

- Per-user dietary restrictions (household-level only for now)
- Free-form dietary notes
- Dietary filtering in shopping list or fridge screen
- Impact on `scan-receipt` / `scan-items` edge functions (those add items; no AI curation needed)
- Cuisine preference / food aversion learning over time
