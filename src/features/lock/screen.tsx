import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { AppText, Button, Screen } from '@/components/ui/primitives';
import { layout } from '@/lib/layout';
import {
  assertUnlocked,
  biometricsAvailable,
  getLockMode,
  getLockoutRemainingMs,
  InvalidPinError,
  LockoutError,
} from '@/lib/lock';
import { useApp } from '@/providers/app-provider';

export function UnlockScreen() {
  const { setUnlocked } = useApp();
  const [error, setError] = useState('');
  const [pin, setPin] = useState('');
  const [mode, setMode] = useState<'biometric' | 'pin' | null>(null);
  const [biometricsReady, setBiometricsReady] = useState(false);
  const [lockoutMs, setLockoutMs] = useState(0);

  const refreshState = useCallback(async () => {
    setMode((await getLockMode()) ?? 'pin');
    setBiometricsReady(await biometricsAvailable());
    setLockoutMs(await getLockoutRemainingMs());
  }, []);

  useEffect(() => {
    refreshState().catch(() => undefined);
  }, [refreshState]);

  useEffect(() => {
    if (lockoutMs <= 0) return;
    const timer = setInterval(() => {
      getLockoutRemainingMs()
        .then(setLockoutMs)
        .catch(() => undefined);
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutMs]);

  const finishUnlock = useCallback(() => {
    setUnlocked(true);
    router.replace('/');
  }, [setUnlocked]);

  const unlockWithBiometrics = useCallback(async () => {
    setError('');
    try {
      await assertUnlocked();
      finishUnlock();
    } catch (e) {
      if (e instanceof LockoutError) {
        setLockoutMs(e.lockedUntilMs - Date.now());
        setError('Too many attempts. Try again later.');
        return;
      }
      setError(e instanceof Error ? e.message : 'Authentication failed');
    }
  }, [finishUnlock]);

  const unlockWithPin = async () => {
    setError('');
    try {
      await assertUnlocked(pin);
      finishUnlock();
    } catch (e) {
      if (e instanceof LockoutError) {
        setLockoutMs(e.lockedUntilMs - Date.now());
        setError('Too many attempts. Try again later.');
        return;
      }
      if (e instanceof InvalidPinError) {
        setError('Incorrect PIN');
        setPin('');
        return;
      }
      setError(e instanceof Error ? e.message : 'Unlock failed');
    }
  };

  useEffect(() => {
    if (mode !== 'biometric' || !biometricsReady) return;
    unlockWithBiometrics().catch(() => undefined);
  }, [mode, biometricsReady, unlockWithBiometrics]);

  const showBiometricButton = mode === 'biometric' && biometricsReady;

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
        {lockoutMs > 0 ? (
          <AppText className='mt-3 text-expense' size='sm'>
            Try again in {Math.ceil(lockoutMs / 1000)}s
          </AppText>
        ) : null}
        {error ? (
          <AppText className='mt-3 text-expense' size='sm'>
            {error}
          </AppText>
        ) : null}

        <View className='mt-6' style={{ gap: 12 }}>
          {showBiometricButton ? (
            <Button
              label='Unlock with biometrics'
              onPress={unlockWithBiometrics}
              disabled={lockoutMs > 0}
            />
          ) : null}
          <TextInput
            value={pin}
            onChangeText={(value) => {
              setPin(value.replace(/\D/g, '').slice(0, 8));
              setError('');
            }}
            keyboardType='number-pad'
            secureTextEntry
            placeholder='PIN'
            maxLength={8}
            className='rounded-2xl px-4 py-3.5 bg-surface-sunken'
          />
          <Button
            label='Unlock with PIN'
            onPress={unlockWithPin}
            disabled={lockoutMs > 0 || pin.length < 4}
          />
        </View>
      </View>
    </Screen>
  );
}
