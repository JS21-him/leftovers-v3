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
