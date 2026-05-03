import { Text } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>{emoji}</Text>;
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#fed7aa',
          paddingBottom: insets.bottom,
          height: 56 + insets.bottom,
        },
        tabBarActiveTintColor: '#f97316',
        tabBarInactiveTintColor: '#9ca3af',
      }}
    >
      <Tabs.Screen
        name="fridge"
        options={{
          title: 'Fridge',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🧊" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="shopping"
        options={{
          title: 'Shopping',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🛒" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="recipes"
        options={{
          title: 'Recipes',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🍳" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
