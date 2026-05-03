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
import { ShoppingItemRow } from '@/src/features/shopping/ShoppingItemRow';
import { AddShoppingItemModal } from '@/src/features/shopping/AddShoppingItemModal';
import { COLORS } from '@/src/lib/constants';
import { logger } from '@/src/lib/logger';
import type { ShoppingListItem } from '@/src/types/database';

export default function ShoppingScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const householdId = useAuthStore((s) => s.householdId);
  const setHouseholdId = useAuthStore((s) => s.setHouseholdId);
  const [householdError, setHouseholdError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

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

  function retryHousehold() {
    if (!user) return;
    setHouseholdError(null);
    useHousehold(user.id).then(({ householdId: hid, error }) => {
      if (error) setHouseholdError(error);
      else setHouseholdId(hid);
    });
  }

  const isInitializing = !householdId && !householdError;

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
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 }}>
              <Text style={{ fontSize: 40, marginBottom: 16 }}>🛒</Text>
              <Text style={{ fontSize: 18, fontWeight: '600', color: COLORS.text, marginBottom: 8 }}>
                Your list is empty
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
    </View>
  );
}
