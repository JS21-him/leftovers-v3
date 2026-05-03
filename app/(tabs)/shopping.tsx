import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '@/src/lib/constants';

export default function ShoppingScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.bg,
        paddingTop: insets.top,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text style={{ fontSize: 18, color: COLORS.text }}>Shopping — coming in Phase 4</Text>
    </View>
  );
}
