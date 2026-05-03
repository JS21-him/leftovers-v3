import { useRef } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { COLORS, EXPIRY_DAYS } from '@/src/lib/constants';
import type { FridgeItem } from '@/src/types/database';

interface Props {
  item: FridgeItem;
  onDelete: (id: string) => void;
}

function getExpiryColor(expiryDate: string | null): string {
  if (!expiryDate) return COLORS.muted;
  const days = Math.ceil(
    (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (days <= EXPIRY_DAYS.CRITICAL) return COLORS.danger;
  if (days <= EXPIRY_DAYS.WARNING) return '#f97316';
  return COLORS.success;
}

function formatExpiry(expiryDate: string | null): string {
  if (!expiryDate) return 'No expiry';
  const days = Math.ceil(
    (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (days < 0) return 'Expired';
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  return `Expires in ${days} days`;
}

export function FridgeItemCard({ item, onDelete }: Props) {
  const swipeRef = useRef<Swipeable>(null);

  function renderRightActions() {
    return (
      <TouchableOpacity
        onPress={() => {
          swipeRef.current?.close();
          onDelete(item.id);
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

  const expiryColor = getExpiryColor(item.expiry_date);

  return (
    <Swipeable ref={swipeRef} renderRightActions={renderRightActions} overshootRight={false}>
      <View
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 12,
          borderLeftWidth: 4,
          borderLeftColor: expiryColor,
          padding: 16,
          marginBottom: 8,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.text }}>
            {item.name}
          </Text>
          <Text style={{ fontSize: 13, color: COLORS.muted, marginTop: 2 }}>
            Qty: {item.quantity}
          </Text>
        </View>
        <Text style={{ fontSize: 12, color: expiryColor, fontWeight: '500' }}>
          {formatExpiry(item.expiry_date)}
        </Text>
      </View>
    </Swipeable>
  );
}
