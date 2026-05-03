import { useRef } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { COLORS } from '@/src/lib/constants';
import type { ShoppingListItem } from '@/src/types/database';

interface Props {
  item: ShoppingListItem;
  onToggle: (id: string, isBought: boolean) => void;
  onDelete: (id: string) => void;
}

export function ShoppingItemRow({ item, onToggle, onDelete }: Props) {
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

  return (
    <Swipeable ref={swipeRef} renderRightActions={renderRightActions} overshootRight={false}>
      <TouchableOpacity
        onPress={() => onToggle(item.id, !item.is_bought)}
        activeOpacity={0.7}
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 12,
          padding: 16,
          marginBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
          opacity: item.is_bought ? 0.5 : 1,
        }}
      >
        {/* Checkbox */}
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: item.is_bought ? COLORS.success : COLORS.border,
            backgroundColor: item.is_bought ? COLORS.success : 'transparent',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
          }}
        >
          {item.is_bought ? (
            <Text style={{ color: '#fff', fontSize: 14, lineHeight: 18 }}>✓</Text>
          ) : null}
        </View>

        {/* Name + quantity */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: COLORS.text,
              textDecorationLine: item.is_bought ? 'line-through' : 'none',
            }}
          >
            {item.name}
          </Text>
          <Text style={{ fontSize: 13, color: COLORS.muted, marginTop: 2 }}>
            Qty: {item.quantity}
          </Text>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}
