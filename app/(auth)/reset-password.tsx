import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/features/auth/useAuth';
import { COLORS } from '@/src/lib/constants';

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleReset() {
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const err = await resetPassword(email.trim());
      if (err) setError(err);
      else setSent(true);
    } finally {
      setIsLoading(false);
    }
  }

  if (sent) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.bg,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        <Text
          style={{
            fontSize: 28,
            fontWeight: '700',
            color: COLORS.text,
            marginBottom: 16,
            textAlign: 'center',
          }}
        >
          Email sent
        </Text>
        <Text
          style={{ fontSize: 16, color: COLORS.muted, textAlign: 'center', marginBottom: 32 }}
        >
          Check your inbox for a password reset link.
        </Text>
        <Link href="/(auth)/login">
          <Text style={{ color: COLORS.primary, fontWeight: '600', fontSize: 16 }}>
            Back to Sign In
          </Text>
        </Link>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: COLORS.bg }}
    >
      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 48,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 24,
        }}
      >
        <Text style={{ fontSize: 32, fontWeight: '700', color: COLORS.text, marginBottom: 8 }}>
          Reset password
        </Text>
        <Text style={{ fontSize: 16, color: COLORS.muted, marginBottom: 32 }}>
          We&apos;ll send you a reset link
        </Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          style={{
            backgroundColor: COLORS.surface,
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: 12,
            padding: 16,
            fontSize: 16,
            color: COLORS.text,
            marginBottom: 12,
          }}
        />

        {error ? (
          <Text style={{ color: COLORS.danger, marginBottom: 16, fontSize: 14 }}>{error}</Text>
        ) : null}

        <TouchableOpacity
          onPress={handleReset}
          disabled={isLoading}
          style={{
            backgroundColor: COLORS.primary,
            borderRadius: 12,
            padding: 16,
            alignItems: 'center',
            opacity: isLoading ? 0.7 : 1,
            marginBottom: 24,
          }}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Send Reset Link</Text>
          )}
        </TouchableOpacity>

        <Link href="/(auth)/login" style={{ alignSelf: 'center' }}>
          <Text style={{ color: COLORS.primary }}>Back to Sign In</Text>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}
