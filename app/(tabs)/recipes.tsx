import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '@/src/lib/constants';

export default function RecipesScreen() {
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
      <Text style={{ fontSize: 18, color: COLORS.text }}>Recipes — coming in Phase 6</Text>
    </View>
  );
}
