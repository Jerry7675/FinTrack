import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { scale } from '@/lib/layout';
import { useApp } from '@/providers/app-provider';

export default function TabsLayout() {
  const { colorScheme } = useApp();
  const active = colorScheme === 'dark' ? '#3DDB8A' : '#1A7A4C';
  const inactive = colorScheme === 'dark' ? '#A1A1AA' : '#5C6B64';
  const bg = colorScheme === 'dark' ? '#0A0A0A' : '#F4F7F5';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: active,
        tabBarInactiveTintColor: inactive,
        tabBarStyle: {
          backgroundColor: bg,
          borderTopColor: colorScheme === 'dark' ? '#27272A' : '#D5DED8',
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
