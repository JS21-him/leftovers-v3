import { useState, useEffect, useCallback } from 'react';
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
import { useShoppingSuggestions } from '@/src/features/shopping/useShoppingSuggestions';
import { ShoppingSuggestionsCard } from '@/src/features/shopping/ShoppingSuggestionsCard';

export default function ShoppingScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const householdId = useAuthStore((s) => s.householdId);
  const setHouseholdId = useAuthStore((s) => s.setHouseholdId);
  const [householdError, setHouseholdError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddStapleModal, setShowAddStapleModal] = useState(false);

  useEffect(() => {
    if (!user || householdId) return;
    useHousehold(user.id).then(({ householdId: hid, error }) => {
      if (error) { setHouseholdError(error); return; }
      setHouseholdId(hid);
    });
  }, [user, householdId]);

  const { data: items, isLoading, isError, error, refetch, isRefetching } = useShoppingItems(householdId);
  const addMutation = useAddShoppingItem(householdId);
  const toggleMutation = useToggleShoppingItem(householdId);
  const deleteMutation = useDeleteShoppingItem(householdId);
  const clearMutation = useClearBoughtItems(householdId);

  const { data: staples } = useStaples(householdId);
  const addStapleMutation = useAddStaple(householdId);
  const toggleStapleMutation = useToggleStaple(householdId);
  const deleteStapleMutation = useDeleteStaple(householdId);

  const {
    suggestions,
    isLoading: suggestionsLoading,
    error: suggestionsError,
    refresh: refreshSuggestions,
  } = useShoppingSuggestions(householdId);

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

  const handleAddSuggestion = useCallback(async (name: string) => {
    if (!householdId || !user) return;
    try {
      await addMutation.mutateAsync({ householdId, addedBy: user.id, name, quantity: '1' });
    } catch {
      Alert.alert('Failed to add item', 'Something went wrong. Try again.');
    }
  }, [householdId, user, addMutation]);

  const handleAddAllSuggestions = useCallback(async (names: string[]) => {
    if (!householdId || !user) return;
    for (const name of names) {
      try {
        await addMutation.mutateAsync({ householdId, addedBy: user.id, name, quantity: '1' });
      } catch {
        // card tracks optimistic added state — skip individual failures silently
      }
    }
  }, [householdId, user, addMutation]);

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

  const renderWeeklyHeader = useCallback(() => (
      <View>
        <ShoppingSuggestionsCard
          suggestions={suggestions}
          isLoading={suggestionsLoading}
          error={suggestionsError}
          onAdd={handleAddSuggestion}
          onAddAll={handleAddAllSuggestions}
          onRefresh={refreshSuggestions}
        />
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
  ), [staples, suggestions, suggestionsLoading, suggestionsError, refreshSuggestions, handleAddSuggestion, handleAddAllSuggestions]);

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
