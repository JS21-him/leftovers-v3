import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '@/src/lib/constants';

export default function FridgeScreen() {
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
      <Text style={{ fontSize: 18, color: COLORS.text }}>Fridge — coming in Phase 2</Text>
    </View>
  );
}
