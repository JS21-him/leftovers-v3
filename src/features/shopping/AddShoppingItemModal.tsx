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

export function AddShoppingItemModal({ visible, onClose, onAdd }: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function reset() {
    setName('');
    setQuantity('1');
    setError(null);
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
            <Text style={{ fontSize: 22, fontWeight: '700', color: COLORS.text }}>Add to List</Text>
            <TouchableOpacity onPress={handleClose}>
              <Text style={{ color: COLORS.primary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.muted, marginBottom: 6 }}>ITEM NAME *</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Orange juice"
            placeholderTextColor="#9ca3af"
            autoFocus
            style={inputStyle}
          />

          <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.muted, marginBottom: 6 }}>QUANTITY *</Text>
          <TextInput
            value={quantity}
            onChangeText={setQuantity}
            placeholder="e.g. 1, 2 bottles, a bag"
            placeholderTextColor="#9ca3af"
            style={inputStyle}
          />

          {error ? (
            <Text style={{ color: COLORS.danger, fontSize: 14, marginBottom: 12 }}>{error}</Text>
          ) : null}

          <TouchableOpacity
            onPress={handleAdd}
            disabled={isLoading || !name.trim()}
            style={{
              backgroundColor: COLORS.primary,
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
              opacity: isLoading || !name.trim() ? 0.5 : 1,
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
