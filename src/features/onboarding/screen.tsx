import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import {
  AppText,
  Button,
  Chip,
  Field,
  GoBack,
  Screen,
} from '@/components/ui/primitives';
import { characters } from '@/constants/characters';
import { db } from '@/lib/db/client';
import { createAccount, createGroup, updateSettings } from '@/lib/db/queries';
import { layout, scale } from '@/lib/layout';
import { CURRENCIES } from '@/lib/money';
import { useApp } from '@/providers/app-provider';

export function OnboardingScreen() {
  const { completeOnboarding, refresh } = useApp();
  const [step, setStep] = useState(0);
  const [currency, setCurrency] = useState('USD');
  const [groupName, setGroupName] = useState('Personal');
  const [accountName, setAccountName] = useState('Cash');
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    setBusy(true);
    try {
      await updateSettings(db, { defaultCurrency: currency });
      const groupId = await createGroup(db, {
        name: groupName.trim() || 'Personal',
      });
      const accountId = await createAccount(db, {
        groupId,
        name: accountName.trim() || 'Cash',
        currencyCode: currency,
        type: 'cash',
      });
      await updateSettings(db, {
        activeGroupId: groupId,
        activeAccountId: accountId,
        defaultCurrency: currency,
      });
      await completeOnboarding();
      await refresh();
      router.replace('/');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: layout.gutter,
          paddingBottom: 48,
          flexGrow: 1,
          justifyContent: 'center',
        }}
      >
        <Image
          source={characters.onboarding}
          style={{
            width: scale(96),
            height: scale(96),
            borderRadius: scale(48),
            marginBottom: scale(16),
          }}
          contentFit='cover'
        />
        <AppText size='display' weight='bold'>
          FinTrack
        </AppText>
        <AppText muted className='mt-2'>
          Local-first money tracking for people and organizations.
        </AppText>

        {step === 0 ? (
          <View className='mt-10 gap-4'>
            <AppText size='lg' weight='semibold'>
              Which currency do you use?
            </AppText>
            <View className='flex-row flex-wrap gap-2'>
              {CURRENCIES.map((c) => (
                <Chip
                  key={c.code}
                  label={c.code}
                  active={currency === c.code}
                  onPress={() => setCurrency(c.code)}
                />
              ))}
            </View>
            <Button label='Continue' onPress={() => setStep(1)} />
          </View>
        ) : (
          <View className='mt-10 gap-4'>
            <GoBack label='Back' onPress={() => setStep(0)} />
            <AppText size='lg' weight='semibold'>
              Create your first space
            </AppText>
            <Field
              label='Group'
              value={groupName}
              onChangeText={setGroupName}
              placeholder='Personal'
            />
            <Field
              label='Account'
              value={accountName}
              onChangeText={setAccountName}
              placeholder='Cash'
            />
            <Button label='Start tracking' onPress={finish} loading={busy} />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
