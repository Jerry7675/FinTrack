import '@/global.css';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { Platform, StatusBar as RNStatusBar, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LoadingScreen } from '@/components/ui/primitives';
import { ToastProvider } from '@/components/ui/toast';
import { colors } from '@/constants/palette';
import { updateWidgetSnapshot } from '@/features/widgets/update';
import { startUpdateChecks } from '@/lib/updates';
import { AppProvider, useApp } from '@/providers/app-provider';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function ThemedShell({ children }: { children: React.ReactNode }) {
  const { colorScheme } = useApp();
  const surface = colors(colorScheme === 'dark' ? 'dark' : 'light').surface;
  // expo: "dark" = dark icons (light bg); "light" = light icons (dark bg)
  const iconStyle = colorScheme === 'dark' ? 'light' : 'dark';

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(surface).catch(() => undefined);
    StatusBar.setStyle(iconStyle, true);

    if (Platform.OS === 'android') {
      RNStatusBar.setBarStyle(
        colorScheme === 'dark' ? 'light-content' : 'dark-content',
        true
      );
      // Draw app behind status bar; Screen paints matching surface under it.
      RNStatusBar.setTranslucent(true);
      RNStatusBar.setBackgroundColor('transparent', true);
    }
  }, [colorScheme, surface, iconStyle]);

  return (
    <View style={{ flex: 1, backgroundColor: surface }}>
      <StatusBar style={iconStyle} animated />
      {children}
    </View>
  );
}

function RootNavigator() {
  const { ready, settings, colorScheme, unlocked } = useApp();
  const segments = useSegments();
  const router = useRouter();
  const surface = colors(colorScheme === 'dark' ? 'dark' : 'light').surface;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => undefined);
      updateWidgetSnapshot().catch(() => undefined);
    }
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    return startUpdateChecks();
  }, [ready]);

  useEffect(() => {
    if (!ready || !settings) return;
    const root = segments[0];
    const inOnboarding = root === 'onboarding';
    const inUnlock = root === 'unlock';

    if (!settings.onboardingDone) {
      if (!inOnboarding) router.replace('/onboarding');
      return;
    }

    if (settings.lockEnabled && !unlocked) {
      if (!inUnlock) router.replace('/unlock');
      return;
    }

    if (inOnboarding || inUnlock) {
      router.replace('/');
    }
  }, [ready, settings, segments, router, unlocked]);

  if (!ready) {
    return <LoadingScreen />;
  }

  return (
    <ToastProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: surface },
        }}
      >
        <Stack.Screen name='(tabs)' />
        <Stack.Screen name='onboarding/index' />
        <Stack.Screen name='unlock' />
        <Stack.Screen
          name='account/[id]'
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name='transaction/[id]'
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name='categories'
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen name='planning/budgets' />
        <Stack.Screen name='planning/recurring' />
        <Stack.Screen name='planning/goals' />
        <Stack.Screen name='planning/subscriptions' />
        <Stack.Screen name='planning/debts' />
        <Stack.Screen name='planning/net-worth' />
        <Stack.Screen name='planning/recycle' />
        <Stack.Screen name='planning/forecast' />
        <Stack.Screen name='planning/what-if' />
        <Stack.Screen name='planning/calendar' />
        <Stack.Screen name='planning/customize-home' />
      </Stack>
    </ToastProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <AppProvider>
            <ThemedShell>
              <RootNavigator />
            </ThemedShell>
          </AppProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
