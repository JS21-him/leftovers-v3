# Dietary Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add household-level dietary preferences (7 toggles in Settings) that the AI uses to personalize recipe suggestions.

**Architecture:** A new `dietary_restrictions text[]` column on the `households` table stores the preferences. Settings screen reads from the existing `useHouseholdQuery` result and writes via a new `useUpdateDietaryRestrictions` mutation. The `suggest-recipes` edge function fetches the restrictions and appends them to the Claude prompt when non-empty.

**Tech Stack:** Supabase Postgres, Supabase Edge Functions (Deno), TanStack Query v5, React Native Switch, TypeScript strict.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/004_dietary_preferences.sql` | Create | Add `dietary_restrictions text[]` column to `households` |
| `src/types/database.ts` | Modify | Add `dietary_restrictions: string[]` to `Household` interface |
| `src/features/household/useHouseholdSharing.ts` | Modify | Add `updateDietaryRestrictions` async fn + `useUpdateDietaryRestrictions` hook |
| `src/__tests__/features/household/useHouseholdSharing.test.ts` | Modify | Add 3 test cases for `updateDietaryRestrictions` |
| `app/(tabs)/settings.tsx` | Modify | Add DIETARY PREFERENCES section with 7 Switch toggles |
| `supabase/functions/suggest-recipes/index.ts` | Modify | Fetch restrictions + append to Claude prompt |

---

## Task 1: Migration + TypeScript type

**Files:**
- Create: `supabase/migrations/004_dietary_preferences.sql`
- Modify: `src/types/database.ts`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/004_dietary_preferences.sql`:

```sql
-- supabase/migrations/004_dietary_preferences.sql
alter table households
  add column dietary_restrictions text[] not null default '{}';
```

- [ ] **Step 2: Update the Household TypeScript interface**

In `src/types/database.ts`, find the `Household` interface and add the new field:

```typescript
export interface Household {
  id: string;
  name: string;
  invite_code: string;
  created_by: string | null;
  created_at: string;
  dietary_restrictions: string[];
}
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\Jesse Schiff\leftovers-v3" && git add supabase/migrations/004_dietary_preferences.sql src/types/database.ts && git commit -m "feat: add dietary_restrictions column to households"
```

---

## Task 2: `updateDietaryRestrictions` data layer (TDD)

**Files:**
- Modify: `src/__tests__/features/household/useHouseholdSharing.test.ts`
- Modify: `src/features/household/useHouseholdSharing.ts`

- [ ] **Step 1: Write the failing tests**

Open `src/__tests__/features/household/useHouseholdSharing.test.ts`. Add this `describe` block at the end of the file (after the `fetchHouseholdByUserId` block):

```typescript
describe('updateDietaryRestrictions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates and returns household with new restrictions', async () => {
    const updatedHousehold = {
      id: 'hh-1',
      name: 'My Kitchen',
      invite_code: 'abc123',
      created_by: 'u-1',
      created_at: '',
      dietary_restrictions: ['vegetarian', 'gluten-free'],
    };
    const chain = {
      update: jest.fn(),
      eq: jest.fn(),
      select: jest.fn(),
      single: jest.fn(),
    };
    chain.update.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.select.mockReturnValue(chain);
    chain.single.mockResolvedValue({ data: updatedHousehold, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await updateDietaryRestrictions('hh-1', ['vegetarian', 'gluten-free']);
    expect(result.dietary_restrictions).toEqual(['vegetarian', 'gluten-free']);
    expect(chain.update).toHaveBeenCalledWith({ dietary_restrictions: ['vegetarian', 'gluten-free'] });
    expect(chain.eq).toHaveBeenCalledWith('id', 'hh-1');
  });

  it('updates with empty array to clear all restrictions', async () => {
    const updatedHousehold = {
      id: 'hh-1',
      name: 'My Kitchen',
      invite_code: 'abc123',
      created_by: 'u-1',
      created_at: '',
      dietary_restrictions: [],
    };
    const chain = {
      update: jest.fn(),
      eq: jest.fn(),
      select: jest.fn(),
      single: jest.fn(),
    };
    chain.update.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.select.mockReturnValue(chain);
    chain.single.mockResolvedValue({ data: updatedHousehold, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await updateDietaryRestrictions('hh-1', []);
    expect(result.dietary_restrictions).toEqual([]);
  });

  it('throws on DB error', async () => {
    const chain = {
      update: jest.fn(),
      eq: jest.fn(),
      select: jest.fn(),
      single: jest.fn(),
    };
    chain.update.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.select.mockReturnValue(chain);
    chain.single.mockResolvedValue({ data: null, error: { message: 'Update failed' } });
    mockFrom.mockReturnValue(chain);

    await expect(updateDietaryRestrictions('hh-1', ['vegan'])).rejects.toThrow('Update failed');
  });
});
```

Also add `updateDietaryRestrictions` to the import at the top of the test file:

```typescript
import {
  joinHousehold,
  leaveHousehold,
  fetchHouseholdMembers,
  fetchHouseholdByUserId,
  updateDietaryRestrictions,
} from '../../../features/household/useHouseholdSharing';
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "C:\Users\Jesse Schiff\leftovers-v3" && npx jest "src/__tests__/features/household/useHouseholdSharing.test.ts" --no-coverage 2>&1 | tail -15
```

Expected: FAIL — `updateDietaryRestrictions is not a function` (or export not found)

- [ ] **Step 3: Implement `updateDietaryRestrictions` and `useUpdateDietaryRestrictions`**

Open `src/features/household/useHouseholdSharing.ts`. Add these two exports at the end of the file:

```typescript
export async function updateDietaryRestrictions(
  householdId: string,
  restrictions: string[]
): Promise<Household> {
  const { data, error } = await supabase
    .from('households')
    .update({ dietary_restrictions: restrictions })
    .eq('id', householdId)
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to update dietary preferences');
  return data;
}

export function useUpdateDietaryRestrictions(
  householdId: string | null,
  userId: string | null
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (restrictions: string[]) => {
      if (!householdId) throw new Error('No household');
      return updateDietaryRestrictions(householdId, restrictions);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['household', userId] });
    },
    onError: (err) => logger.error('updateDietaryRestrictions failed', err),
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "C:\Users\Jesse Schiff\leftovers-v3" && npx jest "src/__tests__/features/household/useHouseholdSharing.test.ts" --no-coverage 2>&1 | tail -15
```

Expected: PASS — all tests passing (previous 8 + new 3 = 11 total)

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\Jesse Schiff\leftovers-v3" && git add src/features/household/useHouseholdSharing.ts "src/__tests__/features/household/useHouseholdSharing.test.ts" && git commit -m "feat: add updateDietaryRestrictions with hook and tests"
```

---

## Task 3: Settings screen dietary UI

**Files:**
- Modify: `app/(tabs)/settings.tsx`

- [ ] **Step 1: Read the current settings.tsx**

Read `app/(tabs)/settings.tsx` to confirm current imports and structure before editing.

- [ ] **Step 2: Replace the full content of `app/(tabs)/settings.tsx`**

```typescript
import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  Alert, Share, ScrollView, Switch,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/features/auth/useAuth';
import { useAuthStore } from '@/src/store/auth';
import {
  useHouseholdQuery,
  useHouseholdMembers,
  useJoinHousehold,
  useLeaveHousehold,
  useUpdateDietaryRestrictions,
} from '@/src/features/household/useHouseholdSharing';
import { JoinHouseholdModal } from '@/src/features/household/JoinHouseholdModal';
import { COLORS } from '@/src/lib/constants';

const DIETARY_OPTIONS = [
  { slug: 'vegetarian', label: 'Vegetarian' },
  { slug: 'vegan', label: 'Vegan' },
  { slug: 'gluten-free', label: 'Gluten-Free' },
  { slug: 'dairy-free', label: 'Dairy-Free' },
  { slug: 'nut-free', label: 'Nut-Free' },
  { slug: 'kosher', label: 'Kosher' },
  { slug: 'halal', label: 'Halal' },
] as const;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const user = useAuthStore((s) => s.user);
  const householdId = useAuthStore((s) => s.householdId);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [localRestrictions, setLocalRestrictions] = useState<string[]>([]);

  const { data: household } = useHouseholdQuery(user?.id ?? null);
  const { data: members = [] } = useHouseholdMembers(householdId);
  const joinMutation = useJoinHousehold(user?.id ?? null);
  const leaveMutation = useLeaveHousehold(user?.id ?? null);
  const updateDietaryMutation = useUpdateDietaryRestrictions(householdId, user?.id ?? null);

  // Sync local restrictions when household loads or changes (e.g. after join/leave)
  useEffect(() => {
    if (household) {
      setLocalRestrictions(household.dietary_restrictions ?? []);
    }
  }, [household?.id]);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  }

  async function handleCopy() {
    if (!household?.invite_code) return;
    await Clipboard.setStringAsync(household.invite_code);
    setCopiedFeedback(true);
    setTimeout(() => setCopiedFeedback(false), 2000);
  }

  async function handleShare() {
    if (!household?.invite_code) return;
    await Share.share({
      message: `Join my household on Leftovers! Enter this code: ${household.invite_code}`,
    });
  }

  function handleLeave() {
    Alert.alert(
      'Leave Household',
      "Your items will stay in the household. You'll get a new personal household.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => leaveMutation.mutate() },
      ]
    );
  }

  async function handleJoin(code: string) {
    await joinMutation.mutateAsync(code);
  }

  async function handleDietaryToggle(slug: string, value: boolean) {
    const prev = localRestrictions;
    const next = value
      ? [...localRestrictions, slug]
      : localRestrictions.filter((r) => r !== slug);
    setLocalRestrictions(next);
    try {
      await updateDietaryMutation.mutateAsync(next);
    } catch {
      setLocalRestrictions(prev);
      Alert.alert('Failed to save', 'Could not update dietary preferences. Try again.');
    }
  }

  const sectionLabel = {
    fontSize: 13,
    fontWeight: '600' as const,
    color: COLORS.muted,
    marginBottom: 12,
    marginTop: 28,
  };

  const row = {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    borderWidth: 1,
    borderColor: COLORS.border,
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 40,
        paddingHorizontal: 24,
      }}
    >
      <Text style={{ fontSize: 28, fontWeight: '700', color: COLORS.text, marginBottom: 4 }}>
        Settings
      </Text>
      {user?.email ? (
        <Text style={{ fontSize: 14, color: COLORS.muted, marginBottom: 4 }}>
          {user.email}
        </Text>
      ) : null}

      {/* ── Household Section ─────────────────────── */}
      <Text style={sectionLabel}>HOUSEHOLD</Text>

      {household ? (
        <>
          <View style={row}>
            <Text style={{ fontSize: 15, color: COLORS.muted }}>Household</Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.text }}>
              {household.name}
            </Text>
          </View>

          <View style={[row, { flexDirection: 'column', alignItems: 'flex-start' }]}>
            <Text style={{ fontSize: 15, color: COLORS.muted, marginBottom: 12 }}>Invite Code</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: COLORS.text, letterSpacing: 3, flex: 1 }}>
                {household.invite_code}
              </Text>
              <TouchableOpacity
                onPress={handleCopy}
                style={{
                  backgroundColor: copiedFeedback ? COLORS.success : COLORS.primary,
                  borderRadius: 8,
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  marginRight: 8,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                  {copiedFeedback ? 'Copied!' : 'Copy'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleShare}
                style={{
                  backgroundColor: COLORS.border,
                  borderRadius: 8,
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                }}
              >
                <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: '600' }}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>

          {members.length > 0 ? (
            <View style={[row, { flexDirection: 'column', alignItems: 'flex-start' }]}>
              <Text style={{ fontSize: 15, color: COLORS.muted, marginBottom: 8 }}>Members</Text>
              {members.map((member) => (
                <View key={member.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontSize: 15, color: COLORS.text }}>
                    {member.display_name ?? 'Unknown'}
                  </Text>
                  {member.id === user?.id ? (
                    <Text style={{ fontSize: 12, color: COLORS.muted, marginLeft: 6 }}>(you)</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          <TouchableOpacity
            onPress={handleLeave}
            disabled={leaveMutation.isPending}
            style={{
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: COLORS.danger,
              opacity: leaveMutation.isPending ? 0.6 : 1,
              marginTop: 4,
              marginBottom: 8,
            }}
          >
            {leaveMutation.isPending ? (
              <ActivityIndicator color={COLORS.danger} />
            ) : (
              <Text style={{ color: COLORS.danger, fontSize: 16, fontWeight: '600' }}>
                Leave Household
              </Text>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <ActivityIndicator color={COLORS.primary} style={{ alignSelf: 'flex-start', marginBottom: 8 }} />
      )}

      <TouchableOpacity
        onPress={() => setShowJoinModal(true)}
        style={row}
      >
        <Text style={{ fontSize: 15, color: COLORS.text }}>Join a Household</Text>
        <Text style={{ fontSize: 18, color: COLORS.primary }}>›</Text>
      </TouchableOpacity>

      {/* ── Dietary Preferences Section ───────────── */}
      <Text style={sectionLabel}>DIETARY PREFERENCES</Text>

      <Text style={{ fontSize: 13, color: COLORS.muted, marginBottom: 12 }}>
        Used by AI for recipe suggestions and shopping recommendations.
      </Text>

      <View style={{
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: 'hidden',
        marginBottom: 8,
      }}>
        {DIETARY_OPTIONS.map((option, index) => (
          <View
            key={option.slug}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              borderBottomWidth: index < DIETARY_OPTIONS.length - 1 ? 1 : 0,
              borderBottomColor: COLORS.border,
            }}
          >
            <Text style={{ fontSize: 15, color: COLORS.text }}>{option.label}</Text>
            <Switch
              value={localRestrictions.includes(option.slug)}
              onValueChange={(value) => handleDietaryToggle(option.slug, value)}
              disabled={updateDietaryMutation.isPending || !household}
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
              thumbColor="#fff"
            />
          </View>
        ))}
      </View>

      <Text style={{ fontSize: 12, color: COLORS.muted, textAlign: 'center', marginBottom: 4 }}>
        Changes save automatically.
      </Text>

      {/* ── Auth Section ──────────────────────────── */}
      <Text style={sectionLabel}>ACCOUNT</Text>

      <TouchableOpacity
        onPress={handleSignOut}
        disabled={isSigningOut}
        style={{
          backgroundColor: COLORS.danger,
          borderRadius: 12,
          padding: 16,
          alignItems: 'center',
          opacity: isSigningOut ? 0.7 : 1,
        }}
      >
        {isSigningOut ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Sign Out</Text>
        )}
      </TouchableOpacity>

      <JoinHouseholdModal
        visible={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onJoin={handleJoin}
      />
    </ScrollView>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\Jesse Schiff\leftovers-v3" && git add "app/(tabs)/settings.tsx" && git commit -m "feat: add dietary preferences toggles to settings screen"
```

---

## Task 4: Update suggest-recipes edge function

**Files:**
- Modify: `supabase/functions/suggest-recipes/index.ts`

- [ ] **Step 1: Read the current edge function**

Read `supabase/functions/suggest-recipes/index.ts` to find the exact lines to modify.

- [ ] **Step 2: Add the dietary restrictions fetch and prompt update**

After the block that fetches `profile.household_id` and checks items (around line 60), add a query to fetch dietary restrictions. Then update the prompt building section.

Find this section (around lines 76-88):

```typescript
    const itemList = items
      .map((i: { name: string; quantity: string }) => `${i.name} (${i.quantity})`)
      .join(', ');

    const prompt = `I have these items in my fridge: ${itemList}.

Suggest exactly 3 simple recipes I can make using some or all of these ingredients. Return ONLY a valid JSON array with no markdown, no explanation. Each object must have:
- "title": string (recipe name)
- "ingredients": array of strings (what's needed)
- "instructions": string (numbered steps separated by \\n)

Example format: [{"title":"...","ingredients":["..."],"instructions":"1. ...\\n2. ..."}]`;
```

Replace with:

```typescript
    const itemList = items
      .map((i: { name: string; quantity: string }) => `${i.name} (${i.quantity})`)
      .join(', ');

    const { data: householdData } = await supabase
      .from('households')
      .select('dietary_restrictions')
      .eq('id', profile.household_id)
      .single();

    const restrictions: string[] = householdData?.dietary_restrictions ?? [];
    const dietaryLine = restrictions.length > 0
      ? `\n\nDietary restrictions for this household: ${restrictions.join(', ')}. Respect these in all suggestions.`
      : '';

    const prompt = `I have these items in my fridge: ${itemList}.${dietaryLine}

Suggest exactly 3 simple recipes I can make using some or all of these ingredients. Return ONLY a valid JSON array with no markdown, no explanation. Each object must have:
- "title": string (recipe name)
- "ingredients": array of strings (what's needed)
- "instructions": string (numbered steps separated by \\n)

Example format: [{"title":"...","ingredients":["..."],"instructions":"1. ...\\n2. ..."}]`;
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\Jesse Schiff\leftovers-v3" && git add supabase/functions/suggest-recipes/index.ts && git commit -m "feat: inject dietary restrictions into recipe suggestion prompt"
```

- [ ] **Step 4: Deploy the updated edge function**

```bash
cd "C:\Users\Jesse Schiff\leftovers-v3" && npx supabase functions deploy suggest-recipes --project-ref rpzypbdhjsspwzwzidaw 2>&1 | tail -5
```

Expected: `Deployed Functions on project rpzypbdhjsspwzwzidaw: suggest-recipes`

---

## Task 5: Run full test suite and push

- [ ] **Step 1: Run all tests**

```bash
cd "C:\Users\Jesse Schiff\leftovers-v3" && npx jest --no-coverage 2>&1 | tail -8
```

Expected: All tests pass (69 existing + 3 new = 72 total)

- [ ] **Step 2: Push to GitHub**

```bash
cd "C:\Users\Jesse Schiff\leftovers-v3" && git push
```

---

## Self-Review

**Spec coverage:**
- ✅ `dietary_restrictions text[]` column added via migration (Task 1)
- ✅ `Household` type updated (Task 1)
- ✅ `updateDietaryRestrictions` + `useUpdateDietaryRestrictions` with 3 test cases (Task 2)
- ✅ Settings screen DIETARY PREFERENCES section with 7 Switch toggles (Task 3)
- ✅ Subtitle "Used by AI for recipe suggestions..." present (Task 3)
- ✅ Auto-save on toggle, disabled while pending (Task 3)
- ✅ Optimistic update + revert on error + Alert (Task 3)
- ✅ Sync local state when household changes via `useEffect([household?.id])` (Task 3)
- ✅ `suggest-recipes` edge function fetches restrictions and appends to prompt (Task 4)
- ✅ Empty restrictions array → no change to prompt (Task 4)

**Type consistency:**
- `updateDietaryRestrictions(householdId: string, restrictions: string[]): Promise<Household>` — used consistently in hook and tests
- `useUpdateDietaryRestrictions(householdId: string | null, userId: string | null)` — matches call in settings.tsx: `useUpdateDietaryRestrictions(householdId, user?.id ?? null)`
- `localRestrictions: string[]` — matches `DIETARY_OPTIONS[n].slug` values (all strings)
- `household.dietary_restrictions ?? []` — consistent guard used in both settings screen and edge function
