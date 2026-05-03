import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/src/store/auth';
import { useHousehold } from '@/src/features/fridge/useHousehold';
import { useFridgeItems, useAddFridgeItem, useDeleteFridgeItem } from '@/src/features/fridge/useFridgeItems';
import { FridgeItemCard } from '@/src/features/fridge/FridgeItemCard';
import { AddFridgeItemModal } from '@/src/features/fridge/AddFridgeItemModal';
import { COLORS } from '@/src/lib/constants';
import { logger } from '@/src/lib/logger';
import type { FridgeItem } from '@/src/types/database';

export default function FridgeScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [householdError, setHouseholdError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (!user) return;
    useHousehold(user.id).then(({ householdId: hid, error }) => {
      if (error) { setHouseholdError(error); return; }
      setHouseholdId(hid);
    });
  }, [user]);

  const { data: items, isLoading, isError, error, refetch, isRefetching } = useFridgeItems(householdId);
  const addMutation = useAddFridgeItem(householdId);
  const deleteMutation = useDeleteFridgeItem(householdId);

  async function handleAdd(name: string, quantity: string, expiryDate: string | null) {
    if (!householdId || !user) return;
    await addMutation.mutateAsync({
      householdId,
      addedBy: user.id,
      name,
      quantity,
      expiryDate,
    });
  }

  function handleDelete(id: string) {
    deleteMutation.mutate(id, {
      onError: (err) => logger.error('delete failed', err),
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

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: COLORS.text }}>Fridge</Text>
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
            {error?.message ?? 'Failed to load fridge items'}
          </Text>
          <TouchableOpacity onPress={() => refetch()}>
            <Text style={{ color: COLORS.primary, fontWeight: '600' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList<FridgeItem>
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
              <Text style={{ fontSize: 40, marginBottom: 16 }}>🧊</Text>
              <Text style={{ fontSize: 18, fontWeight: '600', color: COLORS.text, marginBottom: 8 }}>
                Your fridge is empty
              </Text>
              <Text style={{ fontSize: 14, color: COLORS.muted, textAlign: 'center' }}>
                Tap + to add your first item
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <FridgeItemCard item={item} onDelete={handleDelete} />
          )}
        />
      )}

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

      <AddFridgeItemModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAdd}
      />
    </View>
  );
}
