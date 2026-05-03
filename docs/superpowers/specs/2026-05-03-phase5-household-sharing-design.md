# Phase 5: Household Sharing — Design Spec
_Date: 2026-05-03_

## Overview

Add household sharing to Leftovers v3: users can invite others to join their household via an invite code, view who's in the household, and leave at any time. All data (fridge, shopping, recipes) is already scoped by `household_id` via RLS, so sharing automatically works once members share a household.

---

## Decisions

| Question | Decision | Reason |
|---|---|---|
| Existing data when joining | Drop it (user gets clean slate in new household) | New users have no meaningful data before sharing; merge is complex with no real benefit |
| Leave household | Supported — creates fresh personal household | Expected UX; simple single-update implementation |
| Invite sharing | Copy to clipboard + native share sheet | Mobile expectation; minimal extra work |
| Household rename | Not in v1 | Low value, adds settings complexity |
| Roles / admin | None — flat membership | No kick/remove in v1 |
| Join implementation | Client-side only | Single profile update; no atomicity requirement |

---

## Data Model

No new tables. Existing schema is already ready:

- `households`: `id`, `name`, `invite_code` (unique, auto-generated), `created_by`, `created_at`
- `profiles`: `id`, `display_name`, `household_id` (FK → households)
- All data tables already scope to `my_household_id()` via RLS

**One new RLS policy required:**

```sql
-- Allow household members to read each other's profiles (for member list)
create policy "household members can read profiles"
  on profiles for select
  using (household_id = my_household_id());
```

---

## Feature Hooks

### Additions to `src/features/fridge/useHousehold.ts`

**`joinHousehold(inviteCode: string): Promise<void>`**
1. Query `households` where `invite_code = inviteCode`
2. If not found → throw error ("Invite code not found")
3. If resolved household id = current household id → throw error ("Already in this household")
4. Update `profiles.household_id` to the resolved household id
5. Invalidate all query keys: fridge items, shopping items, saved recipes, household

**`leaveHousehold(userId: string): Promise<void>`**
1. Create new household: `name = "My Kitchen"`, `created_by = userId`, generate new `invite_code`
2. Update `profiles.household_id` to new household id
3. Invalidate all query keys

**`fetchHouseholdMembers(householdId: string): Promise<Profile[]>`**
- Query all `profiles` where `household_id = householdId`
- Returns array of `Profile` (id, display_name, household_id, created_at)

**TanStack Query hooks (new):**
- `useJoinHousehold()` — mutation wrapping `joinHousehold`
- `useLeaveHousehold()` — mutation wrapping `leaveHousehold`
- `useHouseholdMembers(householdId)` — query wrapping `fetchHouseholdMembers`

---

## Settings Screen

`app/(tabs)/settings.tsx` expands to three sections:

### Household Section (new, above Sign Out)
- **Household name** — display only (e.g. "Jesse's Kitchen")
- **Invite code row** — shows the code, copy-to-clipboard button, native share sheet button
- **Members list** — display names of all household members; current user's row shows "(you)"
- **"Leave Household" button** — red/destructive; confirmation alert: "Leave household? Your items will stay in the household. You'll get a new personal household." → calls `leaveHousehold`

### Join Household Section (new)
- **"Join a Household" row** — opens `JoinHouseholdModal`

### Auth Section (existing, unchanged)
- Email display + Sign Out button

---

## JoinHouseholdModal

New file: `src/features/household/JoinHouseholdModal.tsx`

- Bottom sheet modal (same pattern as `AddFridgeItemModal`)
- Single `TextInput` for invite code (auto-uppercase, trim whitespace)
- "Join" button → calls `useJoinHousehold` mutation
- Loading state on button while pending
- Inline error message below input on failure (e.g. "Code not found", "Already in this household")
- On success: modal closes, settings screen re-renders with new household data

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Invalid invite code | Mutation error → "Code not found" shown inline in modal |
| Joining own household | Detected client-side → "You're already in this household" |
| Network failure on join | Mutation error → inline message; no partial state (single DB update) |
| Network failure on leave | Mutation error → alert; user stays in current household |

---

## Navigation

No new tab screens. Everything in the settings tab:
- `app/(tabs)/settings.tsx` — expanded
- `src/features/household/JoinHouseholdModal.tsx` — new modal component

---

## Tests

New or extended test coverage in `src/__tests__/useHousehold.test.ts`:

- `joinHousehold`: valid code → profile updated; invalid code → throws; own code → throws
- `leaveHousehold`: new household created; profile FK updated; all query keys invalidated
- `fetchHouseholdMembers`: returns all profiles with matching household_id

All tests follow existing pattern: `@jest-environment node` docblock, mocked Supabase client.

---

## Out of Scope (v1)

- Household rename
- Admin roles / kick member
- Multiple households per user
- Invite expiry / single-use codes
- Push notifications for join events
