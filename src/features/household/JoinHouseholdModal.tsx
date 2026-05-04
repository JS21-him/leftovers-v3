import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  Modal, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '@/src/lib/constants';

interface Props {
  visible: boolean;
  onClose: () => void;
  onJoin: (code: string) => Promise<void>;
}

export function JoinHouseholdModal({ visible, onClose, onJoin }: Props) {
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function reset() {
    setCode('');
    setError(null);
    setIsLoading(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleJoin() {
    if (!code.trim()) { setError('Enter an invite code'); return; }
    setError(null);
    setIsLoading(true);
    try {
      await onJoin(code.trim());
      reset();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to join. Try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: COLORS.surface }}
      >
        <View
          style={{
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: 24,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: COLORS.text }}>Join a Household</Text>
            <TouchableOpacity onPress={handleClose}>
              <Text style={{ color: COLORS.primary, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.muted, marginBottom: 6 }}>INVITE CODE</Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="e.g. a1b2c3d4"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            style={{
              backgroundColor: COLORS.bg,
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: 12,
              padding: 14,
              fontSize: 18,
              color: COLORS.text,
              marginBottom: 12,
              letterSpacing: 2,
            }}
          />

          {error ? (
            <Text style={{ color: COLORS.danger, fontSize: 14, marginBottom: 12 }}>{error}</Text>
          ) : null}

          <TouchableOpacity
            onPress={handleJoin}
            disabled={isLoading}
            style={{
              backgroundColor: COLORS.primary,
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
              opacity: isLoading ? 0.7 : 1,
              marginTop: 8,
            }}
          >
            {isLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Join Household</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
