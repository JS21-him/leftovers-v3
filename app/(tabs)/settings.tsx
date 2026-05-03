import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/features/auth/useAuth';
import { useAuthStore } from '@/src/store/auth';
import { COLORS } from '@/src/lib/constants';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const user = useAuthStore((s) => s.user);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSignOut() {
    setIsLoading(true);
    try {
      await signOut();
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.bg,
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 24,
      }}
    >
      <Text
        style={{ fontSize: 28, fontWeight: '700', color: COLORS.text, marginBottom: 8 }}
      >
        Settings
      </Text>
      {user?.email ? (
        <Text style={{ fontSize: 14, color: COLORS.muted, marginBottom: 32 }}>
          {user.email}
        </Text>
      ) : null}
      <TouchableOpacity
        onPress={handleSignOut}
        disabled={isLoading}
        style={{
          backgroundColor: COLORS.danger,
          borderRadius: 12,
          padding: 16,
          alignItems: 'center',
          opacity: isLoading ? 0.7 : 1,
        }}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Sign Out</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
