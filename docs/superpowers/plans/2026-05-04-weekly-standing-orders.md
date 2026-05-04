# Weekly Standing Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a WEEKLY section to the Shopping tab where households manage recurring grocery items that auto-reset every 7 days.

**Architecture:** The existing `staples` table gets a `last_checked_at timestamptz` column. A `useStaples.ts` file provides async fns + 4 hooks + an `isCheckedThisWeek` helper. Two new components (`StapleRow`, `AddStapleModal`) follow the exact patterns of `ShoppingItemRow` and `AddShoppingItemModal`. `shopping.tsx` gains the WEEKLY section above the existing THIS WEEK list via `FlatList`'s `ListHeaderComponent`.

**Tech Stack:** Supabase Postgres, TanStack Query v5, React Native Swipeable (react-native-gesture-handler), TypeScript strict, Jest.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/005_staples_weekly.sql` | Create | Add `last_checked_at` column to staples |
| `src/types/database.ts` | Modify | Add `last_checked_at: string \| null` to `Staple` |
| `src/features/shopping/useStaples.ts` | Create | Async fns + 4 hooks + `isCheckedThisWeek` helper |
| `src/features/shopping/StapleRow.tsx` | Create | Weekly item row: checkbox + name + swipe-to-delete |
| `src/features/shopping/AddStapleModal.tsx` | Create | Modal for adding a new weekly item |
| `app/(tabs)/shopping.tsx` | Modify | WEEKLY section via ListHeaderComponent above THIS WEEK |
| `src/__tests__/features/shopping/useStaples.test.ts` | Create | Unit tests for async fns + isCheckedThisWeek |

---

## Task 1: Migration + TypeScript type

**Files:**
- Create: `supabase/migrations/005_staples_weekly.sql`
- Modify: `src/types/database.ts`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/005_staples_weekly.sql` with this exact content:

```sql
alter table staples
  add column last_checked_at timestamptz null;
```

- [ ] **Step 2: Update the Staple TypeScript interface**

In `src/types/database.ts`, find the `Staple` interface (currently lines 29–36) and replace it with:

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

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\Jesse Schiff\leftovers-v3" && git add supabase/migrations/005_staples_weekly.sql src/types/database.ts && git commit -m "feat: add last_checked_at to staples for weekly reset"
```

---

## Task 2: `useStaples.ts` data layer (TDD)

**Files:**
- Create: `src/__tests__/features/shopping/useStaples.test.ts`
- Create: `src/features/shopping/useStaples.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/features/shopping/useStaples.test.ts`:

```typescript
/**
 * @jest-environment node
 */
/// <reference types="jest" />

jest.mock('../../../lib/supabase/client', () => ({
  supabase: { from: jest.fn() },
}));
jest.mock('../../../lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  isCheckedThisWeek,
  fetchStaples,
  addStaple,
  toggleStaple,
  deleteStaple,
} from '../../../features/shopping/useStaples';
import { supabase } from '../../../lib/supabase/client';

const mockFrom = supabase.from as jest.Mock;

describe('isCheckedThisWeek', () => {
  it('returns false for null', () => {
    expect(isCheckedThisWeek(null)).toBe(false);
  });

  it('returns true for timestamp within last 7 days', () => {
    const recent = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    expect(isCheckedThisWeek(recent)).toBe(true);
  });

  it('returns false for timestamp older than 7 days', () => {
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    expect(isCheckedThisWeek(old)).toBe(false);
  });

  it('returns false for timestamp exactly 7 days ago', () => {
    const boundary = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(isCheckedThisWeek(boundary)).toBe(false);
  });
});

describe('fetchStaples', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns staples ordered by name', async () => {
    const staples = [
      { id: 's-1', household_id: 'hh-1', name: 'Bread', default_quantity: '1', reorder_when_low: true, created_at: '', last_checked_at: null },
      { id: 's-2', household_id: 'hh-1', name: 'Milk', default_quantity: '2', reorder_when_low: true, created_at: '', last_checked_at: null },
    ];
    const chain = { select: jest.fn(), eq: jest.fn(), order: jest.fn() };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.order.mockResolvedValue({ data: staples, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await fetchStaples('hh-1');
    expect(result).toHaveLength(2);
    expect(chain.order).toHaveBeenCalledWith('name', { ascending: true });
  });

  it('throws on DB error', async () => {
    const chain = { select: jest.fn(), eq: jest.fn(), order: jest.fn() };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.order.mockResolvedValue({ data: null, error: { message: 'DB error' } });
    mockFrom.mockReturnValue(chain);

    await expect(fetchStaples('hh-1')).rejects.toThrow('DB error');
  });
});

describe('addStaple', () => {
  beforeEach(() => jest.clearAllMocks());

  it('inserts row with correct fields and returns it', async () => {
    const newStaple = { id: 's-1', household_id: 'hh-1', name: 'Eggs', default_quantity: '12', reorder_when_low: true, created_at: '', last_checked_at: null };
    const chain = { insert: jest.fn(), select: jest.fn(), single: jest.fn() };
    chain.insert.mockReturnValue(chain);
    chain.select.mockReturnValue(chain);
    chain.single.mockResolvedValue({ data: newStaple, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await addStaple({ householdId: 'hh-1', name: 'Eggs', quantity: '12' });
    expect(result.name).toBe('Eggs');
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Eggs', default_quantity: '12', household_id: 'hh-1' })
    );
  });

  it('throws on DB error', async () => {
    const chain = { insert: jest.fn(), select: jest.fn(), single: jest.fn() };
    chain.insert.mockReturnValue(chain);
    chain.select.mockReturnValue(chain);
    chain.single.mockResolvedValue({ data: null, error: { message: 'Insert failed' } });
    mockFrom.mockReturnValue(chain);

    await expect(addStaple({ householdId: 'hh-1', name: 'Eggs', quantity: '12' })).rejects.toThrow('Insert failed');
  });
});

describe('toggleStaple', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sets last_checked_at = null when currentlyChecked is true', async () => {
    const chain = { update: jest.fn(), eq: jest.fn() };
    chain.update.mockReturnValue(chain);
    chain.eq.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue(chain);

    await toggleStaple({ id: 's-1', currentlyChecked: true });
    expect(chain.update).toHaveBeenCalledWith({ last_checked_at: null });
    expect(chain.eq).toHaveBeenCalledWith('id', 's-1');
  });

  it('sets last_checked_at to an ISO string when currentlyChecked is false', async () => {
    const chain = { update: jest.fn(), eq: jest.fn() };
    chain.update.mockReturnValue(chain);
    chain.eq.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue(chain);

    await toggleStaple({ id: 's-1', currentlyChecked: false });
    const updateArg = chain.update.mock.calls[0][0];
    expect(typeof updateArg.last_checked_at).toBe('string');
    expect(updateArg.last_checked_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('throws on DB error', async () => {
    const chain = { update: jest.fn(), eq: jest.fn() };
    chain.update.mockReturnValue(chain);
    chain.eq.mockResolvedValue({ error: { message: 'Update failed' } });
    mockFrom.mockReturnValue(chain);

    await expect(toggleStaple({ id: 's-1', currentlyChecked: false })).rejects.toThrow('Update failed');
  });
});

describe('deleteStaple', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes by id', async () => {
    const chain = { delete: jest.fn(), eq: jest.fn() };
    chain.delete.mockReturnValue(chain);
    chain.eq.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue(chain);

    await deleteStaple('s-1');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('id', 's-1');
  });

  it('throws on DB error', async () => {
    const chain = { delete: jest.fn(), eq: jest.fn() };
    chain.delete.mockReturnValue(chain);
    chain.eq.mockResolvedValue({ error: { message: 'Delete failed' } });
    mockFrom.mockReturnValue(chain);

    await expect(deleteStaple('s-1')).rejects.toThrow('Delete failed');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "C:\Users\Jesse Schiff\leftovers-v3" && npx jest "src/__tests__/features/shopping/useStaples.test.ts" --no-coverage 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '../../../features/shopping/useStaples'`

- [ ] **Step 3: Create `src/features/shopping/useStaples.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase/client';
import { logger } from '@/src/lib/logger';
import type { Staple } from '@/src/types/database';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function isCheckedThisWeek(lastCheckedAt: string | null): boolean {
  if (!lastCheckedAt) return false;
  return Date.now() - new Date(lastCheckedAt).getTime() < SEVEN_DAYS_MS;
}

interface AddStapleParams {
  householdId: string;
  name: string;
  quantity: string;
}

export async function fetchStaples(householdId: string): Promise<Staple[]> {
  const { data, error } = await supabase
    .from('staples')
    .select('*')
    .eq('household_id', householdId)
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addStaple(params: AddStapleParams): Promise<Staple> {
  const { data, error } = await supabase
    .from('staples')
    .insert({
      household_id: params.householdId,
      name: params.name.trim(),
      default_quantity: params.quantity.trim(),
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to add staple');
  return data;
}

export async function toggleStaple(params: { id: string; currentlyChecked: boolean }): Promise<void> {
  const { error } = await supabase
    .from('staples')
    .update({ last_checked_at: params.currentlyChecked ? null : new Date().toISOString() })
    .eq('id', params.id);
  if (error) throw new Error(error.message);
}

export async function deleteStaple(id: string): Promise<void> {
  const { error } = await supabase
    .from('staples')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export function useStaples(householdId: string | null) {
  return useQuery({
    queryKey: ['staples', householdId],
    queryFn: () => fetchStaples(householdId!),
    enabled: !!householdId,
  });
}

export function useAddStaple(householdId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { name: string; quantity: string }) => {
      if (!householdId) throw new Error('No household');
      return addStaple({ householdId, name: params.name, quantity: params.quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staples', householdId] });
    },
    onError: (err) => logger.error('addStaple failed', err),
  });
}

export function useToggleStaple(householdId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: toggleStaple,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staples', householdId] });
    },
    onError: (err) => logger.error('toggleStaple failed', err),
  });
}

export function useDeleteStaple(householdId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteStaple,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staples', householdId] });
    },
    onError: (err) => logger.error('deleteStaple failed', err),
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "C:\Users\Jesse Schiff\leftovers-v3" && npx jest "src/__tests__/features/shopping/useStaples.test.ts" --no-coverage 2>&1 | tail -10
```

Expected: PASS — 11 tests passing

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\Jesse Schiff\leftovers-v3" && git add src/features/shopping/useStaples.ts "src/__tests__/features/shopping/useStaples.test.ts" && git commit -m "feat: add useStaples data layer with isCheckedThisWeek helper"
```

---

## Task 3: `StapleRow.tsx` component

**Files:**
- Create: `src/features/shopping/StapleRow.tsx`

- [ ] **Step 1: Create `src/features/shopping/StapleRow.tsx`**

This component follows the exact same pattern as `src/features/shopping/ShoppingItemRow.tsx` — same `Swipeable` wrapper, same checkbox style, same delete action. The only differences are: it takes a `Staple` instead of `ShoppingListItem`, uses `isCheckedThisWeek` for checked state, and shows `default_quantity` instead of `quantity`.

```typescript
import { useRef } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { COLORS } from '@/src/lib/constants';
import { isCheckedThisWeek } from '@/src/features/shopping/useStaples';
import type { Staple } from '@/src/types/database';

interface Props {
  staple: Staple;
  onToggle: () => void;
  onDelete: () => void;
}

export function StapleRow({ staple, onToggle, onDelete }: Props) {
  const swipeRef = useRef<Swipeable>(null);
  const checked = isCheckedThisWeek(staple.last_checked_at);

  function renderRightActions() {
    return (
      <TouchableOpacity
        onPress={() => {
          swipeRef.current?.close();
          onDelete();
        }}
        style={{
          backgroundColor: COLORS.danger,
          justifyContent: 'center',
          alignItems: 'center',
          width: 80,
          borderRadius: 12,
          marginBottom: 8,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Delete</Text>
      </TouchableOpacity>
    );
  }

  return (
    <Swipeable ref={swipeRef} renderRightActions={renderRightActions} overshootRight={false}>
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.7}
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 12,
          padding: 16,
          marginBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
          opacity: checked ? 0.5 : 1,
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: checked ? COLORS.success : COLORS.border,
            backgroundColor: checked ? COLORS.success : 'transparent',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
          }}
        >
          {checked ? (
            <Text style={{ color: '#fff', fontSize: 14, lineHeight: 18 }}>✓</Text>
          ) : null}
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: COLORS.text,
              textDecorationLine: checked ? 'line-through' : 'none',
            }}
          >
            {staple.name}
          </Text>
          <Text style={{ fontSize: 13, color: COLORS.muted, marginTop: 2 }}>
            Qty: {staple.default_quantity ?? '1'}
          </Text>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd "C:\Users\Jesse Schiff\leftovers-v3" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\Jesse Schiff\leftovers-v3" && git add src/features/shopping/StapleRow.tsx && git commit -m "feat: add StapleRow component for weekly items"
```

---

## Task 4: `AddStapleModal.tsx` component

**Files:**
- Create: `src/features/shopping/AddStapleModal.tsx`

- [ ] **Step 1: Create `src/features/shopping/AddStapleModal.tsx`**

This is identical in structure to `AddShoppingItemModal.tsx`. Only differences: title is "Add Weekly Item" and the `onAdd` prop is `(name: string, quantity: string) => Promise<void>` (same signature).

```typescript
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  Modal, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '@/src/lib/constants';

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdd: (name: string, quantity: string) => Promise<void>;
}

export function AddStapleModal({ visible, onClose, onAdd }: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function reset() {
    setName('');
    setQuantity('1');
    setError(null);
    setIsLoading(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleAdd() {
    if (!name.trim()) { setError('Item name is required'); return; }
    if (!quantity.trim()) { setError('Quantity is required'); return; }

    setError(null);
    setIsLoading(true);
    try {
      await onAdd(name.trim(), quantity.trim());
      reset();
      onClose();
    } catch {
      setError('Failed to add item. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  const inputStyle = {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 12,
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: COLORS.surface }}
      >
        <ScrollView
          contentContainerStyle={{
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: 24,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: COLORS.text }}>Add Weekly Item</Text>
            <TouchableOpacity onPress={handleClose}>
              <Text style={{ color: COLORS.primary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.muted, marginBottom: 6 }}>ITEM NAME *</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Eggs"
            placeholderTextColor="#9ca3af"
            autoFocus
            style={inputStyle}
          />

          <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.muted, marginBottom: 6 }}>QUANTITY *</Text>
          <TextInput
            value={quantity}
            onChangeText={setQuantity}
            placeholder="e.g. 1, 12, a carton"
            placeholderTextColor="#9ca3af"
            style={inputStyle}
          />

          {error ? (
            <Text style={{ color: COLORS.danger, fontSize: 14, marginBottom: 12 }}>{error}</Text>
          ) : null}

          <TouchableOpacity
            onPress={handleAdd}
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
              : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Add Item</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd "C:\Users\Jesse Schiff\leftovers-v3" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\Jesse Schiff\leftovers-v3" && git add src/features/shopping/AddStapleModal.tsx && git commit -m "feat: add AddStapleModal for weekly item entry"
```

---

## Task 5: Update `shopping.tsx` with WEEKLY section

**Files:**
- Modify: `app/(tabs)/shopping.tsx`

The WEEKLY section is inserted as `ListHeaderComponent` on the existing `FlatList`. This keeps pull-to-refresh working for shopping items. The header contains: section label, subtitle, `StapleRow` list, and "+ Add weekly item" link. A divider and "THIS WEEK" label separate the two sections.

- [ ] **Step 1: Replace `app/(tabs)/shopping.tsx` with the full updated version**

```typescript
import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/src/store/auth';
import { useHousehold } from '@/src/features/fridge/useHousehold';
import {
  useShoppingItems,
  useAddShoppingItem,
  useToggleShoppingItem,
  useDeleteShoppingItem,
  useClearBoughtItems,
} from '@/src/features/shopping/useShoppingItems';
import {
  useStaples,
  useAddStaple,
  useToggleStaple,
  useDeleteStaple,
  isCheckedThisWeek,
} from '@/src/features/shopping/useStaples';
import { ShoppingItemRow } from '@/src/features/shopping/ShoppingItemRow';
import { StapleRow } from '@/src/features/shopping/StapleRow';
import { AddShoppingItemModal } from '@/src/features/shopping/AddShoppingItemModal';
import { AddStapleModal } from '@/src/features/shopping/AddStapleModal';
import { COLORS } from '@/src/lib/constants';
import { logger } from '@/src/lib/logger';
import type { ShoppingListItem, Staple } from '@/src/types/database';

export default function ShoppingScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const householdId = useAuthStore((s) => s.householdId);
  const setHouseholdId = useAuthStore((s) => s.setHouseholdId);
  const [householdError, setHouseholdError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddStapleModal, setShowAddStapleModal] = useState(false);

  useEffect(() => {
    if (!user) return;
    useHousehold(user.id).then(({ householdId: hid, error }) => {
      if (error) { setHouseholdError(error); return; }
      setHouseholdId(hid);
    });
  }, [user]);

  const { data: items, isLoading, isError, error, refetch, isRefetching } = useShoppingItems(householdId);
  const addMutation = useAddShoppingItem(householdId);
  const toggleMutation = useToggleShoppingItem(householdId);
  const deleteMutation = useDeleteShoppingItem(householdId);
  const clearMutation = useClearBoughtItems(householdId);

  const { data: staples } = useStaples(householdId);
  const addStapleMutation = useAddStaple(householdId);
  const toggleStapleMutation = useToggleStaple(householdId);
  const deleteStapleMutation = useDeleteStaple(householdId);

  const boughtCount = items?.filter((i) => i.is_bought).length ?? 0;

  async function handleAdd(name: string, quantity: string) {
    if (!householdId || !user) return;
    await addMutation.mutateAsync({ householdId, addedBy: user.id, name, quantity });
  }

  function handleToggle(id: string, isBought: boolean) {
    toggleMutation.mutate({ id, isBought }, {
      onError: (err) => logger.error('toggle failed', err),
    });
  }

  function handleDelete(id: string) {
    deleteMutation.mutate(id, {
      onError: (err) => logger.error('delete failed', err),
    });
  }

  function handleClearBought() {
    Alert.alert(
      'Clear bought items',
      `Remove ${boughtCount} checked item${boughtCount === 1 ? '' : 's'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => clearMutation.mutate(undefined, {
            onError: (err) => logger.error('clearBought failed', err),
          }),
        },
      ]
    );
  }

  async function handleAddStaple(name: string, quantity: string) {
    if (!householdId) return;
    await addStapleMutation.mutateAsync({ name, quantity });
  }

  function handleToggleStaple(staple: Staple) {
    toggleStapleMutation.mutate(
      { id: staple.id, currentlyChecked: isCheckedThisWeek(staple.last_checked_at) },
      { onError: () => Alert.alert('Failed to update', 'Try again.') }
    );
  }

  function handleDeleteStaple(id: string) {
    deleteStapleMutation.mutate(id, {
      onError: () => Alert.alert('Failed to delete', 'Try again.'),
    });
  }

  function retryHousehold() {
    if (!user) return;
    setHouseholdError(null);
    useHousehold(user.id).then(({ householdId: hid, error }) => {
      if (error) setHouseholdError(error);
      else setHouseholdId(hid);
    });
  }

  const isInitializing = !householdId && !householdError;

  const sectionLabel = {
    fontSize: 11,
    fontWeight: '700' as const,
    color: COLORS.muted,
    letterSpacing: 1,
    marginBottom: 4,
    marginTop: 16,
  };

  function renderWeeklyHeader() {
    return (
      <View>
        {/* WEEKLY section */}
        <Text style={sectionLabel}>WEEKLY</Text>
        <Text style={{ fontSize: 12, color: COLORS.muted, marginBottom: 12 }}>
          Repeats every week.
        </Text>

        {staples && staples.length > 0 ? (
          staples.map((staple) => (
            <StapleRow
              key={staple.id}
              staple={staple}
              onToggle={() => handleToggleStaple(staple)}
              onDelete={() => handleDeleteStaple(staple.id)}
            />
          ))
        ) : null}

        <TouchableOpacity
          onPress={() => setShowAddStapleModal(true)}
          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4 }}
        >
          <Text style={{ fontSize: 20, color: COLORS.primary, marginRight: 8, lineHeight: 24 }}>+</Text>
          <Text style={{ fontSize: 14, color: COLORS.primary, fontWeight: '600' }}>Add weekly item</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: 16 }} />

        {/* THIS WEEK header */}
        <Text style={sectionLabel}>THIS WEEK</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg, paddingTop: insets.top }}>
      {/* Header */}
      <View style={{
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: COLORS.text }}>Shopping</Text>
        {boughtCount > 0 ? (
          <TouchableOpacity onPress={handleClearBought} disabled={clearMutation.isPending}>
            <Text style={{ color: COLORS.primary, fontSize: 15, fontWeight: '600' }}>
              Clear {boughtCount} done
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {(isInitializing || isLoading) && !isRefetching ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : householdError ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ color: COLORS.danger, textAlign: 'center', marginBottom: 16 }}>{householdError}</Text>
          <TouchableOpacity onPress={retryHousehold}>
            <Text style={{ color: COLORS.primary, fontWeight: '600' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : isError ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ color: COLORS.danger, textAlign: 'center', marginBottom: 16 }}>
            {error?.message ?? 'Failed to load shopping list'}
          </Text>
          <TouchableOpacity onPress={() => refetch()}>
            <Text style={{ color: COLORS.primary, fontWeight: '600' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList<ShoppingListItem>
          data={items ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 100,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={COLORS.primary}
            />
          }
          ListHeaderComponent={renderWeeklyHeader}
          ListEmptyComponent={
            <View style={{ paddingTop: 40, alignItems: 'center' }}>
              <Text style={{ fontSize: 40, marginBottom: 16 }}>🛒</Text>
              <Text style={{ fontSize: 18, fontWeight: '600', color: COLORS.text, marginBottom: 8 }}>
                Your shopping list is empty
              </Text>
              <Text style={{ fontSize: 14, color: COLORS.muted, textAlign: 'center' }}>
                Tap + to add your first item
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ShoppingItemRow
              item={item}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          )}
        />
      )}

      {/* FAB */}
      {householdId && !householdError ? (
        <TouchableOpacity
          onPress={() => setShowAddModal(true)}
          style={{
            position: 'absolute',
            bottom: insets.bottom + 24,
            right: 24,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: COLORS.primary,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 5,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 28, lineHeight: 32 }}>+</Text>
        </TouchableOpacity>
      ) : null}

      <AddShoppingItemModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAdd}
      />

      <AddStapleModal
        visible={showAddStapleModal}
        onClose={() => setShowAddStapleModal(false)}
        onAdd={handleAddStaple}
      />
    </View>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd "C:\Users\Jesse Schiff\leftovers-v3" && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\Jesse Schiff\leftovers-v3" && git add "app/(tabs)/shopping.tsx" && git commit -m "feat: add WEEKLY section to shopping tab"
```

---

## Task 6: Full test suite + push

- [ ] **Step 1: Run all tests**

```bash
cd "C:\Users\Jesse Schiff\leftovers-v3" && npx jest --no-coverage 2>&1 | tail -8
```

Expected: All tests pass (72 existing + 11 new = 83 total)

- [ ] **Step 2: Push to GitHub**

```bash
cd "C:\Users\Jesse Schiff\leftovers-v3" && git push
```

---

## Self-Review

**Spec coverage:**
- ✅ `last_checked_at timestamptz null` added via migration (Task 1)
- ✅ `Staple` type updated (Task 1)
- ✅ `isCheckedThisWeek` helper with 7-day window (Task 2)
- ✅ `fetchStaples`, `addStaple`, `toggleStaple`, `deleteStaple` async fns (Task 2)
- ✅ 4 hooks: `useStaples`, `useAddStaple`, `useToggleStaple`, `useDeleteStaple` (Task 2)
- ✅ `StapleRow` with Swipeable delete, checkbox, 50% opacity + strikethrough when checked (Task 3)
- ✅ `AddStapleModal` titled "Add Weekly Item", same shape as `AddShoppingItemModal` (Task 4)
- ✅ WEEKLY section above THIS WEEK in `shopping.tsx` via `ListHeaderComponent` (Task 5)
- ✅ `handleToggleStaple` calls toggle with `currentlyChecked` derived from `isCheckedThisWeek` (Task 5)
- ✅ Error alerts on add/toggle/delete failure (Task 5)
- ✅ Existing THIS WEEK list and Clear bought unchanged (Task 5)

**Type consistency:**
- `addStaple({ householdId, name, quantity })` — matches `AddStapleParams` interface and call in `useAddStaple`
- `toggleStaple({ id, currentlyChecked })` — matches call in `handleToggleStaple`
- `isCheckedThisWeek(staple.last_checked_at)` — `last_checked_at: string | null` matches `Staple` interface
- `useAddStaple(householdId)` — no `userId` param (staples table has no `added_by` column)
