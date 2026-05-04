import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/src/store/auth';
import { useHousehold } from '@/src/features/fridge/useHousehold';
import { useFridgeItems, useAddFridgeItem, useDeleteFridgeItem } from '@/src/features/fridge/useFridgeItems';
import { useScanReceipt, useScanItems } from '@/src/features/fridge/useScanFridge';
import { FridgeItemCard } from '@/src/features/fridge/FridgeItemCard';
import { AddFridgeItemModal } from '@/src/features/fridge/AddFridgeItemModal';
import { SpeedDialFAB } from '@/src/features/fridge/SpeedDialFAB';
import { COLORS } from '@/src/lib/constants';
import { logger } from '@/src/lib/logger';
import type { FridgeItem } from '@/src/types/database';

export default function FridgeScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const householdId = useAuthStore((s) => s.householdId);
  const setHouseholdId = useAuthStore((s) => s.setHouseholdId);
  const [householdError, setHouseholdError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [scanning, setScanning] = useState(false);

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
  const scanReceiptMutation = useScanReceipt(householdId);
  const scanItemsMutation = useScanItems(householdId);

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

  async function doScan(type: 'receipt' | 'items', source: 'camera' | 'library') {
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.6,
          base64: true,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.6,
          base64: true,
        });

    if (result.canceled || !result.assets?.[0]?.base64) return;

    const base64 = result.assets[0].base64;
    setScanning(true);
    try {
      const added = type === 'receipt'
        ? await scanReceiptMutation.mutateAsync(base64)
        : await scanItemsMutation.mutateAsync(base64);

      if (added.length === 0) {
        Alert.alert('No items found', 'Try a clearer photo.');
      }
    } catch {
      Alert.alert('Scan failed', 'Something went wrong. Try again.');
    } finally {
      setScanning(false);
    }
  }

  function handleScanSource(type: 'receipt' | 'items') {
    Alert.alert(
      type === 'receipt' ? 'Scan Receipt' : 'Photo of Items',
      'Choose a source',
      [
        { text: 'Take Photo', onPress: () => doScan(type, 'camera') },
        { text: 'Choose from Library', onPress: () => doScan(type, 'library') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
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
                Tap + to add items — scan a receipt, take a photo, or add manually
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <FridgeItemCard item={item} onDelete={handleDelete} />
          )}
        />
      )}

      {scanning ? (
        <View
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              backgroundColor: COLORS.surface,
              borderRadius: 16,
              padding: 24,
              alignItems: 'center',
            }}
          >
            <ActivityIndicator color={COLORS.primary} size="large" />
            <Text style={{ color: COLORS.text, marginTop: 12, fontSize: 15, fontWeight: '600' }}>
              Adding items…
            </Text>
          </View>
        </View>
      ) : null}

      {householdId && !householdError && !scanning ? (
        <SpeedDialFAB
          onScanReceipt={() => handleScanSource('receipt')}
          onPhotoItems={() => handleScanSource('items')}
          onAddManually={() => setShowAddModal(true)}
        />
      ) : null}

      <AddFridgeItemModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAdd}
      />
    </View>
  );
}
