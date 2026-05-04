import { useState } from 'react';
import {
  View, Text, TouchableOpacity, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '@/src/lib/constants';

interface SpeedDialFABProps {
  onScanReceipt: () => void;
  onPhotoItems: () => void;
  onAddManually: () => void;
}

export function SpeedDialFAB({ onScanReceipt, onPhotoItems, onAddManually }: SpeedDialFABProps) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  function handleOption(fn: () => void) {
    setOpen(false);
    fn();
  }

  return (
    <>
      {open ? (
        <Pressable
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
          }}
          onPress={() => setOpen(false)}
        />
      ) : null}

      <View
        style={{
          position: 'absolute',
          bottom: insets.bottom + 24,
          right: 24,
          alignItems: 'flex-end',
        }}
      >
        {open ? (
          <>
            <DialOption label="Scan Receipt" emoji="🧾" onPress={() => handleOption(onScanReceipt)} />
            <DialOption label="Photo of Items" emoji="📷" onPress={() => handleOption(onPhotoItems)} />
            <DialOption label="Add Manually" emoji="✏️" onPress={() => handleOption(onAddManually)} />
          </>
        ) : null}

        <TouchableOpacity
          onPress={() => setOpen((v) => !v)}
          style={{
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
          <Text style={{ color: '#fff', fontSize: open ? 22 : 28, lineHeight: open ? 26 : 32 }}>
            {open ? '✕' : '+'}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

function DialOption({
  label, emoji, onPress,
}: {
  label: string;
  emoji: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 3,
      }}
    >
      <Text style={{ fontSize: 18, marginRight: 8 }}>{emoji}</Text>
      <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.text }}>{label}</Text>
    </TouchableOpacity>
  );
}
