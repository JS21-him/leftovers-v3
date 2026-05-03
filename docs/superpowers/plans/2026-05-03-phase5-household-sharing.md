# Phase 5: Household Sharing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users invite others to their household via an 8-character code, see the member list in Settings, and leave to get a fresh personal household.

**Architecture:** `householdId` moves from per-screen local state into the Zustand auth store so join/leave updates propagate to all mounted tabs instantly. A new `useHouseholdSharing.ts` file handles the join/leave async logic and TanStack Query hooks. A new Supabase RLS policy and `get_household_id_by_code` RPC allow looking up a household by invite code without exposing all households. The Settings screen grows a Household section (name, invite code with copy/share, member list, leave button) and a Join row that opens a modal.

**Tech Stack:** Expo SDK 54, React Native, TypeScript strict, Zustand, TanStack Query v5, Supabase JS v2, expo-clipboard, React Native Share

---

## File Map

| File | Status | Purpose |
|---|---|---|
| `supabase/migrations/003_household_sharing_rls.sql` | **Create** | New RLS policy + RPC function |
| `src/store/auth.ts` | **Modify** | Add `householdId` + `setHouseholdId` |
| `src/__tests__/store/auth.test.ts` | **Modify** | Tests for new store fields |
| `app/(tabs)/fridge.tsx` | **Modify** | Read `householdId` from store |
| `app/(tabs)/shopping.tsx` | **Modify** | Read `householdId` from store |
| `app/(tabs)/recipes.tsx` | **Modify** | Read `householdId` from store |
| `src/__tests__/features/household/useHouseholdSharing.test.ts` | **Create** | Tests for sharing functions |
| `src/features/household/useHouseholdSharing.ts` | **Create** | Async fns + TanStack hooks |
| `src/features/household/JoinHouseholdModal.tsx` | **Create** | Join flow modal component |
| `app/(tabs)/settings.tsx` | **Modify** | Household section + join row |

---

## Task 1: DB Migration — RLS Policy + RPC

**Files:**
- Create: `supabase/migrations/003_household_sharing_rls.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/003_household_sharing_rls.sql

-- Allow household members to read each other's profiles (needed for member list)
create policy "profiles: household members read"
  on profiles for select
  using (household_id = my_household_id());

-- Secure RPC: look up household id by invite code without exposing all households
create or replace function get_household_id_by_code(code text)
returns uuid
language sql security definer stable
as $$
  select id from households where invite_code = lower(trim(code)) limit 1;
$$;
```

- [ ] **Step 2: Deploy to Supabase**

Open the Supabase dashboard → SQL Editor → paste the migration content → Run.

Verify: in the Table Editor, open `profiles` → Policies — you should see `"profiles: household members read"` listed alongside `"profiles: own row"`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/003_household_sharing_rls.sql
git commit -m "feat: add household member RLS policy and invite code lookup RPC"
```

---

## Task 2: Zustand Auth Store — Add householdId (TDD)

**Files:**
- Modify: `src/store/auth.ts`
- Modify: `src/__tests__/store/auth.test.ts`

- [ ] **Step 1: Write failing tests**

In `src/__tests__/store/auth.test.ts`, update `beforeEach` and add two new tests at the bottom of the describe block:

```typescript
// Update beforeEach:
beforeEach(() => {
  useAuthStore.getState().setSession(null);
  useAuthStore.getState().setHouseholdId(null);
  useAuthStore.getState().setLoading(true);
});

// Add at the bottom of describe('useAuthStore'):
it('setHouseholdId updates householdId', () => {
  useAuthStore.getState().setHouseholdId('hh-123');
  expect(useAuthStore.getState().householdId).toBe('hh-123');
});

it('setSession(null) clears householdId', () => {
  useAuthStore.getState().setHouseholdId('hh-123');
  useAuthStore.getState().setSession(null);
  expect(useAuthStore.getState().householdId).toBeNull();
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest --testPathPattern auth.test --no-coverage
```

Expected: FAIL — `setHouseholdId is not a function`

- [ ] **Step 3: Implement — update auth store**

Replace the full contents of `src/store/auth.ts`:

```typescript
import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  user: User | null;
  householdId: string | null;
  isLoading: boolean;
  setSession: (session: Session | null) => void;
  setHouseholdId: (id: string | null) => void;
  setLoading: (isLoading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  householdId: null,
  isLoading: true,
  setSession: (session) => set({ session, user: session?.user ?? null, householdId: null }),
  setHouseholdId: (householdId) => set({ householdId }),
  setLoading: (isLoading) => set({ isLoading }),
}));
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest --testPathPattern auth.test --no-coverage
```

Expected: PASS (all 6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/store/auth.ts src/__tests__/store/auth.test.ts
git commit -m "feat: add householdId to auth store"
```

---

## Task 3: Wire householdId Through Zustand in Screen Tabs

**Files:**
- Modify: `app/(tabs)/fridge.tsx`
- Modify: `app/(tabs)/shopping.tsx`
- Modify: `app/(tabs)/recipes.tsx`

The three screens each have `const [householdId, setHouseholdId] = useState<string | null>(null)` and a `useEffect` that calls `useHousehold`. Replace local state with the Zustand store — the `useEffect` stays but now writes to the store, so join/leave in Settings propagates to all mounted tabs.

- [ ] **Step 1: Update fridge.tsx**

In `app/(tabs)/fridge.tsx`, make these changes:

Remove this line:
```typescript
const [householdId, setHouseholdId] = useState<string | null>(null);
```

Add these two lines directly after `const user = useAuthStore((s) => s.user);`:
```typescript
const householdId = useAuthStore((s) => s.householdId);
const setHouseholdId = useAuthStore((s) => s.setHouseholdId);
```

Remove `useState` from the React import (keep `useEffect`):
```typescript
import { useEffect } from 'react';
```

- [ ] **Step 2: Update shopping.tsx**

In `app/(tabs)/shopping.tsx`, make the same changes:

Remove this line:
```typescript
const [householdId, setHouseholdId] = useState<string | null>(null);
```

Add these two lines directly after `const user = useAuthStore((s) => s.user);`:
```typescript
const householdId = useAuthStore((s) => s.householdId);
const setHouseholdId = useAuthStore((s) => s.setHouseholdId);
```

Remove `useState` from the React import (keep `useEffect`).

- [ ] **Step 3: Update recipes.tsx**

In `app/(tabs)/recipes.tsx`, make the same changes:

Remove this line:
```typescript
const [householdId, setHouseholdId] = useState<string | null>(null);
```

Add these two lines directly after `const user = useAuthStore((s) => s.user);`:
```typescript
const householdId = useAuthStore((s) => s.householdId);
const setHouseholdId = useAuthStore((s) => s.setHouseholdId);
```

Remove `useState` from the React import (keep `useEffect`).

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add app/(tabs)/fridge.tsx app/(tabs)/shopping.tsx app/(tabs)/recipes.tsx
git commit -m "feat: read householdId from Zustand store in tab screens"
```

---

## Task 4: Write Failing Tests for useHouseholdSharing

**Files:**
- Create: `src/__tests__/features/household/useHouseholdSharing.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
/**
 * @jest-environment node
 */
/// <reference types="jest" />

jest.mock('../../../lib/supabase/client', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));
jest.mock('../../../lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  joinHousehold,
  leaveHousehold,
  fetchHouseholdMembers,
  fetchHouseholdByUserId,
} from '../../../features/household/useHouseholdSharing';
import { supabase } from '../../../lib/supabase/client';

const mockFrom = supabase.from as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;

describe('joinHousehold', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates profile when valid invite code is provided', async () => {
    mockRpc.mockResolvedValue({ data: 'hh-target', error: null });

    const profileChain = { select: jest.fn(), eq: jest.fn(), single: jest.fn() };
    profileChain.select.mockReturnValue(profileChain);
    profileChain.eq.mockReturnValue(profileChain);
    profileChain.single.mockResolvedValue({ data: { household_id: 'hh-old' }, error: null });

    const updateChain = { update: jest.fn(), eq: jest.fn() };
    updateChain.update.mockReturnValue(updateChain);
    updateChain.eq.mockResolvedValue({ error: null });

    mockFrom
      .mockReturnValueOnce(profileChain)
      .mockReturnValueOnce(updateChain);

    const result = await joinHousehold({ inviteCode: 'abc12345', userId: 'user-1' });
    expect(result).toBe('hh-target');
    expect(mockRpc).toHaveBeenCalledWith('get_household_id_by_code', { code: 'abc12345' });
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('throws when invite code is not found', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await expect(joinHousehold({ inviteCode: 'bad-code', userId: 'user-1' }))
      .rejects.toThrow('Invite code not found');
  });

  it('throws when user is already in that household', async () => {
    mockRpc.mockResolvedValue({ data: 'hh-123', error: null });

    const profileChain = { select: jest.fn(), eq: jest.fn(), single: jest.fn() };
    profileChain.select.mockReturnValue(profileChain);
    profileChain.eq.mockReturnValue(profileChain);
    profileChain.single.mockResolvedValue({ data: { household_id: 'hh-123' }, error: null });

    mockFrom.mockReturnValue(profileChain);

    await expect(joinHousehold({ inviteCode: 'abc12345', userId: 'user-1' }))
      .rejects.toThrow('Already in this household');
  });
});

describe('leaveHousehold', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates new household and updates profile, returns new household id', async () => {
    const insertChain = { insert: jest.fn(), select: jest.fn(), single: jest.fn() };
    insertChain.insert.mockReturnValue(insertChain);
    insertChain.select.mockReturnValue(insertChain);
    insertChain.single.mockResolvedValue({ data: { id: 'hh-new' }, error: null });

    const updateChain = { update: jest.fn(), eq: jest.fn() };
    updateChain.update.mockReturnValue(updateChain);
    updateChain.eq.mockResolvedValue({ error: null });

    mockFrom
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(updateChain);

    const result = await leaveHousehold('user-1');
    expect(result).toBe('hh-new');
    expect(insertChain.insert).toHaveBeenCalledWith({ name: 'My Kitchen', created_by: 'user-1' });
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('throws when household insert fails', async () => {
    const insertChain = { insert: jest.fn(), select: jest.fn(), single: jest.fn() };
    insertChain.insert.mockReturnValue(insertChain);
    insertChain.select.mockReturnValue(insertChain);
    insertChain.single.mockResolvedValue({ data: null, error: { message: 'Insert failed' } });

    mockFrom.mockReturnValue(insertChain);

    await expect(leaveHousehold('user-1')).rejects.toThrow('Insert failed');
  });
});

describe('fetchHouseholdMembers', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns all profiles in the household', async () => {
    const members = [
      { id: 'u-1', display_name: 'Alice', household_id: 'hh-1', created_at: '' },
      { id: 'u-2', display_name: 'Bob', household_id: 'hh-1', created_at: '' },
    ];
    const chain = { select: jest.fn(), eq: jest.fn() };
    chain.select.mockReturnValue(chain);
    chain.eq.mockResolvedValue({ data: members, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await fetchHouseholdMembers('hh-1');
    expect(result).toHaveLength(2);
    expect(result[0].display_name).toBe('Alice');
    expect(chain.eq).toHaveBeenCalledWith('household_id', 'hh-1');
  });

  it('throws on error', async () => {
    const chain = { select: jest.fn(), eq: jest.fn() };
    chain.select.mockReturnValue(chain);
    chain.eq.mockResolvedValue({ data: null, error: { message: 'DB error' } });
    mockFrom.mockReturnValue(chain);

    await expect(fetchHouseholdMembers('hh-1')).rejects.toThrow('DB error');
  });
});

describe('fetchHouseholdByUserId', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns household data for the user', async () => {
    const profileChain = { select: jest.fn(), eq: jest.fn(), single: jest.fn() };
    profileChain.select.mockReturnValue(profileChain);
    profileChain.eq.mockReturnValue(profileChain);
    profileChain.single.mockResolvedValue({ data: { household_id: 'hh-1' }, error: null });

    const householdChain = { select: jest.fn(), eq: jest.fn(), single: jest.fn() };
    householdChain.select.mockReturnValue(householdChain);
    householdChain.eq.mockReturnValue(householdChain);
    householdChain.single.mockResolvedValue({
      data: { id: 'hh-1', name: "Alice's Kitchen", invite_code: 'abc12345', created_by: 'u-1', created_at: '' },
      error: null,
    });

    mockFrom
      .mockReturnValueOnce(profileChain)
      .mockReturnValueOnce(householdChain);

    const result = await fetchHouseholdByUserId('user-1');
    expect(result.id).toBe('hh-1');
    expect(result.invite_code).toBe('abc12345');
  });

  it('throws when profile has no household', async () => {
    const profileChain = { select: jest.fn(), eq: jest.fn(), single: jest.fn() };
    profileChain.select.mockReturnValue(profileChain);
    profileChain.eq.mockReturnValue(profileChain);
    profileChain.single.mockResolvedValue({ data: { household_id: null }, error: null });
    mockFrom.mockReturnValue(profileChain);

    await expect(fetchHouseholdByUserId('user-1')).rejects.toThrow('No household found');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest --testPathPattern useHouseholdSharing --no-coverage
```

Expected: FAIL — `Cannot find module '../../../features/household/useHouseholdSharing'`

---

## Task 5: Implement useHouseholdSharing

**Files:**
- Create: `src/features/household/useHouseholdSharing.ts`

- [ ] **Step 1: Create the file**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase/client';
import { useAuthStore } from '@/src/store/auth';
import { logger } from '@/src/lib/logger';
import type { Household, Profile } from '@/src/types/database';

export async function fetchHouseholdByUserId(userId: string): Promise<Household> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('household_id')
    .eq('id', userId)
    .single();
  if (profileError) throw new Error(profileError.message);
  if (!profile?.household_id) throw new Error('No household found');

  const { data: household, error: hhError } = await supabase
    .from('households')
    .select('*')
    .eq('id', profile.household_id)
    .single();
  if (hhError || !household) throw new Error(hhError?.message ?? 'Household not found');
  return household;
}

export async function fetchHouseholdMembers(householdId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('household_id', householdId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function joinHousehold(params: { inviteCode: string; userId: string }): Promise<string> {
  const { data: targetId, error: rpcError } = await supabase.rpc('get_household_id_by_code', {
    code: params.inviteCode.trim(),
  });
  if (rpcError || !targetId) throw new Error('Invite code not found');

  const { data: profile } = await supabase
    .from('profiles')
    .select('household_id')
    .eq('id', params.userId)
    .single();
  if (profile?.household_id === targetId) throw new Error('Already in this household');

  const { error } = await supabase
    .from('profiles')
    .update({ household_id: targetId })
    .eq('id', params.userId);
  if (error) throw new Error(error.message);
  return targetId as string;
}

export async function leaveHousehold(userId: string): Promise<string> {
  const { data: household, error: hhError } = await supabase
    .from('households')
    .insert({ name: 'My Kitchen', created_by: userId })
    .select('id')
    .single();
  if (hhError || !household) throw new Error(hhError?.message ?? 'Failed to create household');

  const { error } = await supabase
    .from('profiles')
    .update({ household_id: household.id })
    .eq('id', userId);
  if (error) throw new Error(error.message);
  return household.id as string;
}

export function useHouseholdQuery(userId: string | null) {
  return useQuery({
    queryKey: ['household', userId],
    queryFn: () => fetchHouseholdByUserId(userId!),
    enabled: !!userId,
  });
}

export function useHouseholdMembers(householdId: string | null) {
  return useQuery({
    queryKey: ['household_members', householdId],
    queryFn: () => fetchHouseholdMembers(householdId!),
    enabled: !!householdId,
  });
}

export function useJoinHousehold(userId: string | null) {
  const queryClient = useQueryClient();
  const setHouseholdId = useAuthStore((s) => s.setHouseholdId);
  return useMutation({
    mutationFn: (inviteCode: string) => joinHousehold({ inviteCode, userId: userId! }),
    onSuccess: (newHouseholdId) => {
      setHouseholdId(newHouseholdId);
      queryClient.clear();
    },
    onError: (err) => logger.error('joinHousehold failed', err),
  });
}

export function useLeaveHousehold(userId: string | null) {
  const queryClient = useQueryClient();
  const setHouseholdId = useAuthStore((s) => s.setHouseholdId);
  return useMutation({
    mutationFn: () => leaveHousehold(userId!),
    onSuccess: (newHouseholdId) => {
      setHouseholdId(newHouseholdId);
      queryClient.clear();
    },
    onError: (err) => logger.error('leaveHousehold failed', err),
  });
}
```

- [ ] **Step 2: Run tests to confirm they pass**

```bash
npx jest --testPathPattern useHouseholdSharing --no-coverage
```

Expected: PASS (all 8 tests)

- [ ] **Step 3: Commit**

```bash
git add src/features/household/useHouseholdSharing.ts src/__tests__/features/household/useHouseholdSharing.test.ts
git commit -m "feat: add household sharing functions and hooks"
```

---

## Task 6: JoinHouseholdModal Component

**Files:**
- Create: `src/features/household/JoinHouseholdModal.tsx`

- [ ] **Step 1: Create the modal**

```typescript
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  Modal, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '@/src/lib/constants';

interface Props {
  visible: boolean;
  onClose: () => void;
  onJoin: (code: string) => Promise<void>;
}

export function JoinHouseholdModal({ visible, onClose, onJoin }: Props) {
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function reset() {
    setCode('');
    setError(null);
    setIsLoading(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleJoin() {
    if (!code.trim()) { setError('Enter an invite code'); return; }
    setError(null);
    setIsLoading(true);
    try {
      await onJoin(code.trim());
      reset();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to join. Try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: COLORS.surface }}
      >
        <View
          style={{
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: 24,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: COLORS.text }}>Join a Household</Text>
            <TouchableOpacity onPress={handleClose}>
              <Text style={{ color: COLORS.primary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.muted, marginBottom: 6 }}>INVITE CODE</Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="e.g. a1b2c3d4"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            style={{
              backgroundColor: COLORS.bg,
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: 12,
              padding: 14,
              fontSize: 18,
              color: COLORS.text,
              marginBottom: 12,
              letterSpacing: 2,
            }}
          />

          {error ? (
            <Text style={{ color: COLORS.danger, fontSize: 14, marginBottom: 12 }}>{error}</Text>
          ) : null}

          <TouchableOpacity
            onPress={handleJoin}
            disabled={isLoading}
            style={{
              backgroundColor: COLORS.primary,
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
              opacity: isLoading ? 0.7 : 1,
              marginTop: 8,
            }}
          >
            {isLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Join Household</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/features/household/JoinHouseholdModal.tsx
git commit -m "feat: add JoinHouseholdModal component"
```

---

## Task 7: Install expo-clipboard

- [ ] **Step 1: Install**

```bash
npx expo install expo-clipboard
```

- [ ] **Step 2: Verify it installed**

```bash
grep "expo-clipboard" package.json
```

Expected: a line like `"expo-clipboard": "~7.0.0"` (version may vary)

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install expo-clipboard"
```

---

## Task 8: Expand Settings Screen

**Files:**
- Modify: `app/(tabs)/settings.tsx`

- [ ] **Step 1: Replace the full contents of settings.tsx**

```typescript
import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  Alert, Share, ScrollView,
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
} from '@/src/features/household/useHouseholdSharing';
import { JoinHouseholdModal } from '@/src/features/household/JoinHouseholdModal';
import { COLORS } from '@/src/lib/constants';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const user = useAuthStore((s) => s.user);
  const householdId = useAuthStore((s) => s.householdId);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  const { data: household } = useHouseholdQuery(user?.id ?? null);
  const { data: members = [] } = useHouseholdMembers(householdId);
  const joinMutation = useJoinHousehold(user?.id ?? null);
  const leaveMutation = useLeaveHousehold(user?.id ?? null);

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
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => leaveMutation.mutate(),
        },
      ]
    );
  }

  async function handleJoin(code: string) {
    await joinMutation.mutateAsync(code);
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
          {/* Household name */}
          <View style={row}>
            <Text style={{ fontSize: 15, color: COLORS.muted }}>Household</Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.text }}>
              {household.name}
            </Text>
          </View>

          {/* Invite code */}
          <View style={[row, { flexDirection: 'column', alignItems: 'flex-start', gap: 12 }]}>
            <Text style={{ fontSize: 15, color: COLORS.muted }}>Invite Code</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%' }}>
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

          {/* Members */}
          {members.length > 0 ? (
            <View style={[row, { flexDirection: 'column', alignItems: 'flex-start', gap: 8 }]}>
              <Text style={{ fontSize: 15, color: COLORS.muted }}>Members</Text>
              {members.map((member) => (
                <View key={member.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 15, color: COLORS.text }}>
                    {member.display_name ?? 'Unknown'}
                  </Text>
                  {member.id === user?.id ? (
                    <Text style={{ fontSize: 12, color: COLORS.muted }}>(you)</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          {/* Leave */}
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

      {/* Join section */}
      <TouchableOpacity
        onPress={() => setShowJoinModal(true)}
        style={[row, { marginTop: 8 }]}
      >
        <Text style={{ fontSize: 15, color: COLORS.text }}>Join a Household</Text>
        <Text style={{ fontSize: 18, color: COLORS.primary }}>›</Text>
      </TouchableOpacity>

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

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/(tabs)/settings.tsx
git commit -m "feat: expand settings screen with household section"
```

---

## Task 9: Full Test Suite + Push

- [ ] **Step 1: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass (should be 50+ tests across 9 suites)

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 4: Start the app and smoke-test**

```bash
npm start
```

Verify on device:
1. Settings tab shows household name, invite code with Copy/Share buttons, member list
2. Tap "Copy" — invite code copies to clipboard (button briefly shows "Copied!")
3. Tap "Share" — native share sheet opens with the code message
4. Tap "Join a Household" — modal opens with code input
5. Enter a bogus code — modal shows "Invite code not found"
6. Tap "Leave Household" — confirmation alert appears; confirm → household section reloads
7. After leaving, fridge/shopping/recipes tabs reflect the new (empty) household
