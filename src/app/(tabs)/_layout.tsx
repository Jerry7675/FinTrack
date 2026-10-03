import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { colors } from '@/constants/palette';
import { scale } from '@/lib/layout';
import { useApp } from '@/providers/app-provider';

export default function TabsLayout() {
  const { colorScheme } = useApp();
  const c = colors(colorScheme === 'dark' ? 'dark' : 'light');
  const active = c.accent;
  const inactive = c.inkMuted;
  const bg = c.surface;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: active,
        tabBarInactiveTintColor: inactive,
        tabBarStyle: {
          backgroundColor: bg,
          borderTopColor: c.line,
          height: scale(64),
          paddingBottom: scale(8),
          paddingTop: scale(6),
        },
        tabBarLabelStyle: {
          fontSize: scale(11),
          fontWeight: '600',
        },
        sceneStyle: { backgroundColor: bg },
      }}
    >
      <Tabs.Screen
        name='index'
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name='home-outline' color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name='accounts'
        options={{
          title: 'Accounts',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name='wallet-outline' color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name='insights'
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name='stats-chart-outline' color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name='settings'
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name='menu-outline' color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
