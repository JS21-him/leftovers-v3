import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  Modal, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '@/src/lib/constants';
import { useExpiryPrediction } from './useExpiryPrediction';

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdd: (name: string, quantity: string, expiryDate: string | null) => Promise<void>;
}

export function AddFridgeItemModal({ visible, onClose, onAdd }: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [manualExpiry, setManualExpiry] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const prediction = useExpiryPrediction(name);

  useEffect(() => {
    if (!name.trim()) setManualExpiry(null);
  }, [name]);

  const effectiveExpiry = manualExpiry ?? prediction.expiryDate ?? '';
  const isAiFilled = manualExpiry === null && prediction.source !== null;
  const isPredicting = manualExpiry === null && prediction.isLoading;

  function reset() {
    setName('');
    setQuantity('1');
    setManualExpiry(null);
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleAdd() {
    if (!name.trim()) { setError('Item name is required'); return; }
    if (!quantity.trim()) { setError('Quantity is required'); return; }

    const dateToSubmit = effectiveExpiry.trim() || null;
    if (dateToSubmit && !/^\d{4}-\d{2}-\d{2}$/.test(dateToSubmit)) {
      setError('Date must be in YYYY-MM-DD format');
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      await onAdd(name.trim(), quantity.trim(), dateToSubmit);
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
            <Text style={{ fontSize: 22, fontWeight: '700', color: COLORS.text }}>Add to Fridge</Text>
            <TouchableOpacity onPress={handleClose}>
              <Text style={{ color: COLORS.primary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.muted, marginBottom: 6 }}>ITEM NAME *</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Whole milk"
            placeholderTextColor="#9ca3af"
            autoFocus
            style={inputStyle}
          />

          <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.muted, marginBottom: 6 }}>QUANTITY *</Text>
          <TextInput
            value={quantity}
            onChangeText={setQuantity}
            placeholder="e.g. 1, 2 litres, half"
            placeholderTextColor="#9ca3af"
            style={inputStyle}
          />

          <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.muted, marginBottom: 6 }}>EXPIRY DATE</Text>

          {isPredicting ? (
            <View style={{
              backgroundColor: COLORS.bg,
              borderWidth: 1,
              borderColor: COLORS.border,
              borderStyle: 'dashed',
              borderRadius: 12,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              marginBottom: 12,
            }}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={{ fontSize: 14, color: COLORS.muted }}>Looking up expiry…</Text>
            </View>
          ) : isAiFilled ? (
            <>
              <TouchableOpacity
                onPress={() => setManualExpiry(prediction.expiryDate ?? '')}
                style={{
                  backgroundColor: COLORS.bg,
                  borderWidth: 1.5,
                  borderColor: COLORS.primary,
                  borderRadius: 12,
                  padding: 14,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                }}
              >
                <Text style={{ fontSize: 16, color: COLORS.text }}>{prediction.expiryDate}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{
                    backgroundColor: '#fff0e6',
                    borderRadius: 6,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}>
                    <Text style={{ fontSize: 11, color: COLORS.primary, fontWeight: '600' }}>✦ AI</Text>
                  </View>
                  <Text style={{ fontSize: 14, color: COLORS.muted }}>✎</Text>
                </View>
              </TouchableOpacity>
              {prediction.explanation ? (
                <Text style={{ fontSize: 12, color: COLORS.muted, marginBottom: 12 }}>
                  {prediction.explanation}
                </Text>
              ) : null}
            </>
          ) : (
            <TextInput
              value={manualExpiry ?? ''}
              onChangeText={setManualExpiry}
              placeholder="YYYY-MM-DD (optional)"
              placeholderTextColor="#9ca3af"
              keyboardType="numbers-and-punctuation"
              style={inputStyle}
            />
          )}

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
