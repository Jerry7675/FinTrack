import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { ProfileAvatar } from '@/components/media/images';
import {
  AppText,
  Button,
  Chip,
  ListRow,
  Screen,
  SectionHeader,
  Select,
} from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { characters } from '@/constants/characters';
import { updateWidgetSnapshot } from '@/features/widgets/update';
import { exportBackupJson, exportTransactionsCsv } from '@/lib/backup';
import { db } from '@/lib/db/client';
import {
  listDebts,
  listRecurring,
  listSubscriptions,
  updateSettings,
} from '@/lib/db/queries';
import { layout } from '@/lib/layout';
import { deleteLocalImage, persistImage, pickImage } from '@/lib/media';
import { CURRENCIES } from '@/lib/money';
import {
  cancelAllReminders,
  ensureNotificationPermissions,
  notificationsAvailable,
  syncPlanningReminders,
} from '@/lib/notifications';
import { useApp } from '@/providers/app-provider';

const PIN_KEY = 'fintrack_pin';

export function SettingsScreen() {
  const { settings, setTheme, setLockEnabled, refresh } = useApp();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  const currencyOptions = useMemo(
    () =>
      CURRENCIES.map((c) => ({
        label: `${c.code} — ${c.name}`,
        value: c.code,
      })),
    []
  );

  useEffect(() => {
    if (!settings?.remindersEnabled) return;
    let cancelled = false;
    (async () => {
      const [recurring, subs, debts] = await Promise.all([
        listRecurring(db),
        listSubscriptions(db),
        listDebts(db),
      ]);
      if (cancelled) return;
      await syncPlanningReminders([
        ...recurring.map((r) => ({
          key: `recurring-${r.id}`,
          title: 'Recurring due',
          body: r.title,
          dueAt: r.nextDueAt,
        })),
        ...subs.map((s) => ({
          key: `sub-${s.id}`,
          title: 'Subscription renews',
          body: s.name,
          dueAt: s.nextBillingAt,
        })),
        ...debts
          .filter((d) => d.dueAt)
          .map((d) => ({
            key: `debt-${d.id}`,
            title: 'Debt due',
            body: d.name,
            dueAt: d.dueAt as Date,
          })),
      ]);
    })();
    return () => {
      cancelled = true;
    };
  }, [settings?.remindersEnabled]);

  const toggleLock = async () => {
    if (settings?.lockEnabled) {
      await setLockEnabled(false);
      await SecureStore.deleteItemAsync(PIN_KEY);
      return;
    }
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (hasHardware && enrolled) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Enable FinTrack lock',
      });
      if (!result.success) return;
      await SecureStore.setItemAsync(PIN_KEY, 'biometric');
      await setLockEnabled(true);
      return;
    }
    Alert.alert(
      'Biometrics unavailable',
      'Lock will use a simple app gate. You can still enable it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Enable',
          onPress: async () => {
            await SecureStore.setItemAsync(PIN_KEY, 'soft');
            await setLockEnabled(true);
          },
        },
      ]
    );
  };

  const onChangeProfilePhoto = async () => {
    try {
      const assets = await pickImage();
      const asset = assets[0];
      if (!asset) return;
      if (settings?.profileImagePath) {
        await deleteLocalImage(settings.profileImagePath);
      }
      const path = await persistImage(asset.uri, 'profile');
      await updateSettings(db, { profileImagePath: path });
      await refresh();
    } catch (_e) {
      showToast('Could not update photo', 'error');
    }
  };

  const toggleReminders = async () => {
    if (!notificationsAvailable()) {
      showToast(
        'Local reminders need a development build (not Expo Go)',
        'error'
      );
      return;
    }
    const next = !settings?.remindersEnabled;
    if (next) {
      const ok = await ensureNotificationPermissions();
      if (!ok) {
        showToast('Enable notifications in system settings', 'error');
        return;
      }
    } else {
      await cancelAllReminders();
    }
    await updateSettings(db, { remindersEnabled: next });
    await refresh();
    showToast(next ? 'Reminders on' : 'Reminders off', 'success');
  };

  const onExportJson = async () => {
    setBusy(true);
    try {
      await exportBackupJson();
      await updateWidgetSnapshot();
      showToast('Backup exported', 'success');
    } catch (e) {
      showToast(`Export failed: ${String(e)}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const onExportCsv = async () => {
    setBusy(true);
    try {
      await exportTransactionsCsv();
      showToast('CSV exported', 'success');
    } catch (e) {
      showToast(`Export failed: ${String(e)}`, 'error');
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
        }}
      >
        <View className='mt-2 flex-row items-center gap-3'>
          <ProfileAvatar
            path={settings?.profileImagePath}
            size={64}
            onPress={onChangeProfilePhoto}
            fallback={characters.settings}
          />
          <View className='flex-1'>
            <AppText size='xl' weight='bold'>
              Settings
            </AppText>
            <AppText size='sm' muted>
              Tap photo to upload a profile image
            </AppText>
          </View>
        </View>

        <SectionHeader title='Appearance' />
        <View className='flex-row gap-2'>
          {(['system', 'light', 'dark'] as const).map((t) => (
            <Chip
              key={t}
              label={t[0].toUpperCase() + t.slice(1)}
              active={settings?.theme === t}
              onPress={() => setTheme(t)}
            />
          ))}
        </View>

        <SectionHeader title='Currency' />
        <Select
          label='Default currency'
          value={settings?.defaultCurrency ?? 'USD'}
          options={currencyOptions}
          onChange={async (code) => {
            await updateSettings(db, { defaultCurrency: code });
            await refresh();
            showToast(`Default currency set to ${code}`, 'success');
          }}
        />
        <AppText size='xs' muted className='mt-1'>
          Used for new accounts and planning. Change an account's currency from
          Accounts → Edit currency.
        </AppText>

        <SectionHeader title='Security' />
        <ListRow
          title='App lock'
          subtitle={
            settings?.lockEnabled
              ? 'Enabled — unlock with biometrics'
              : 'Require unlock on open'
          }
          onPress={toggleLock}
          right={
            <AppText muted>{settings?.lockEnabled ? 'On' : 'Off'}</AppText>
          }
        />

        <SectionHeader title='Reminders' />
        <ListRow
          title='Local notifications'
          subtitle='Due recurring, subscriptions, and debts'
          onPress={toggleReminders}
          right={
            <AppText muted>{settings?.remindersEnabled ? 'On' : 'Off'}</AppText>
          }
        />

        <SectionHeader title='Planning' />
        <ListRow
          title='Budgets'
          subtitle='Category spending limits'
          onPress={() => router.push('/planning/budgets')}
        />
        <ListRow
          title='Recurring'
          subtitle='Manual templates — no auto-pay'
          onPress={() => router.push('/planning/recurring')}
        />
        <ListRow
          title='Goals'
          subtitle='Savings targets'
          onPress={() => router.push('/planning/goals')}
        />
        <ListRow
          title='Subscriptions'
          subtitle='Track renewals'
          onPress={() => router.push('/planning/subscriptions')}
        />
        <ListRow
          title='Debts'
          subtitle='Money owed / lent'
          onPress={() => router.push('/planning/debts')}
        />
        <ListRow
          title='Categories'
          subtitle='Icons and kinds — includes IT defaults'
          onPress={() => router.push('/categories')}
        />

        <SectionHeader title='Data' />
        <ListRow
          title='Export backup (JSON)'
          subtitle='Portable dump for cloud / Drive later'
          onPress={onExportJson}
        />
        <ListRow
          title='Export CSV'
          subtitle='Transactions spreadsheet'
          onPress={onExportCsv}
        />
        <AppText size='sm' muted className='mt-3'>
          Receipt photos stay on-device. Paths are stored in the database; if a
          file is missing, FinTrack shows a placeholder.
        </AppText>

        <View className='mt-6'>
          <Button
            label={busy ? 'Working…' : 'Refresh data'}
            variant='secondary'
            onPress={() => refresh()}
            disabled={busy}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
