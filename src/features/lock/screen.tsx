import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText, Button, Screen } from '@/components/ui/primitives';
import { layout } from '@/lib/layout';
import { useApp } from '@/providers/app-provider';

export function UnlockScreen() {
  const { setUnlocked } = useApp();
  const [error, setError] = useState('');

  const unlock = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (hasHardware && enrolled) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock FinTrack',
      });
      if (result.success) {
        setUnlocked(true);
        router.replace('/');
        return;
      }
      setError('Authentication failed');
      return;
    }
    setUnlocked(true);
    router.replace('/');
  };

  return (
    <Screen>
      <View
        className='flex-1 justify-center'
        style={{ paddingHorizontal: layout.gutter }}
      >
        <AppText size='display' weight='bold'>
          FinTrack
        </AppText>
        <AppText muted className='mt-2'>
          Unlock to continue
        </AppText>
        {error ? (
          <AppText className='mt-3 text-expense' size='sm'>
            {error}
          </AppText>
        ) : null}
        <View className='mt-8'>
          <Button label='Unlock' onPress={unlock} />
        </View>
      </View>
    </Screen>
  );
}
