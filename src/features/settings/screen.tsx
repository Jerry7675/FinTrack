import { type Href, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, TextInput, View } from 'react-native';

import { ProfileAvatar } from '@/components/media/images';
import {
  AppText,
  Button,
  Chip,
  ListRow,
  PasswordDialog,
  Screen,
  SectionHeader,
  Select,
} from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { characters } from '@/constants/characters';
import { ReceiptScanSettingsRow } from '@/features/receipt-scan/settings-row';
import { updateWidgetSnapshot } from '@/features/widgets/update';
import {
  exportBackupJson,
  exportEncryptedBackup,
  exportTransactionsCsv,
  importBackupFromText,
  MIN_BACKUP_PASSWORD_LENGTH,
  pickAndImportTransactionsCsv,
  pickAndReadBackupFile,
} from '@/lib/backup';
import { db } from '@/lib/db/client';
import {
  getBudgetSpend,
  listBudgets,
  listDebts,
  listGoals,
  listRecurring,
  listSubscriptions,
  updateSettings,
} from '@/lib/db/queries';
import { layout } from '@/lib/layout';
import {
  biometricsAvailable,
  disableAppLock,
  enableBiometricLock,
  enablePinLock,
  isValidPinFormat,
} from '@/lib/lock';
import { deleteLocalImage, persistImage, pickImage } from '@/lib/media';
import { CURRENCIES } from '@/lib/money';
import {
  cancelAllReminders,
  ensureNotificationPermissions,
  notificationsAvailable,
  syncPlanningReminders,
} from '@/lib/notifications';
import { budgetStatus } from '@/lib/planning';
import { useApp } from '@/providers/app-provider';

export function SettingsScreen() {
  const { settings, accounts, setTheme, setLockEnabled, refresh } = useApp();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [passwordPrompt, setPasswordPrompt] = useState<{
    mode: 'export' | 'import';
    pendingText?: string;
  } | null>(null);
  const [pinSetup, setPinSetup] = useState('');

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
      const [recurring, subs, debts, budgets, goals] = await Promise.all([
        listRecurring(db),
        listSubscriptions(db),
        listDebts(db),
        listBudgets(db),
        listGoals(db),
      ]);
      if (cancelled) return;

      const budgetReminders: {
        key: string;
        title: string;
        body: string;
        dueAt: Date;
      }[] = [];
      for (const b of budgets) {
        const spent = await getBudgetSpend(db, b);
        const status = budgetStatus(spent, b.amountMinor);
        if (status === 'approaching' || status === 'exceeded') {
          budgetReminders.push({
            key: `budget-${b.id}`,
            title:
              status === 'exceeded' ? 'Budget exceeded' : 'Budget check-in',
            body: b.name,
            dueAt: new Date(Date.now() + 60 * 60 * 1000),
          });
        }
      }

      const goalReminders = goals
        .filter((g) => g.deadlineAt && g.deadlineAt.getTime() > Date.now())
        .map((g) => ({
          key: `goal-${g.id}`,
          title: 'Goal deadline',
          body: g.name,
          dueAt: g.deadlineAt as Date,
        }));

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
        ...budgetReminders,
        ...goalReminders,
      ]);
    })();
    return () => {
      cancelled = true;
    };
  }, [settings?.remindersEnabled]);

  const toggleLock = async () => {
    if (settings?.lockEnabled) {
      await disableAppLock();
      await setLockEnabled(false);
      setPinSetup('');
      return;
    }
    if (await biometricsAvailable()) {
      try {
        await enableBiometricLock();
        await setLockEnabled(true);
      } catch {
        showToast('Could not enable app lock', 'error');
      }
      return;
    }
    Alert.alert(
      'Set a PIN',
      'Biometrics are not available. Choose a 4–8 digit PIN to lock FinTrack.',
      [{ text: 'OK' }]
    );
  };

  const confirmPinLock = async () => {
    if (!isValidPinFormat(pinSetup)) {
      showToast('PIN must be 4–8 digits', 'error');
      return;
    }
    try {
      await enablePinLock(pinSetup);
      await setLockEnabled(true);
      setPinSetup('');
      showToast('App lock enabled', 'success');
    } catch {
      showToast('Could not enable app lock', 'error');
    }
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

  const onImportCsv = async () => {
    const account =
      accounts.find((a) => a.id === settings?.activeAccountId) ?? accounts[0];
    if (!account) {
      showToast('Create an account first', 'error');
      return;
    }
    setBusy(true);
    try {
      const result = await pickAndImportTransactionsCsv({
        accountId: account.id,
        defaultCurrency: account.currencyCode,
      });
      await refresh();
      showToast(
        `Imported ${result.imported} · skipped ${result.skipped}`,
        'success'
      );
    } catch (e) {
      if (String(e).includes('Cancelled')) return;
      showToast(`Import failed: ${String(e)}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const onExportEncrypted = () => {
    setPasswordPrompt({ mode: 'export' });
  };

  const onImportBackup = async () => {
    setBusy(true);
    try {
      const text = await pickAndReadBackupFile();
      if (
        text.trim().startsWith('FTENC2') ||
        text.trim().startsWith('FTENC1')
      ) {
        setPasswordPrompt({ mode: 'import', pendingText: text });
        return;
      }
      Alert.alert(
        'Restore backup?',
        'This replaces all FinTrack data on this device. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: async () => {
              try {
                await importBackupFromText(text);
                await refresh();
                showToast('Backup restored', 'success');
              } catch (e) {
                showToast(`Restore failed: ${String(e)}`, 'error');
              }
            },
          },
        ]
      );
    } catch (e) {
      if (String(e).includes('Cancelled')) return;
      showToast(`Import failed: ${String(e)}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const onPasswordConfirm = async (password: string) => {
    const prompt = passwordPrompt;
    setPasswordPrompt(null);
    if (!prompt) return;
    setBusy(true);
    try {
      if (prompt.mode === 'export') {
        await exportEncryptedBackup(password);
        showToast('Encrypted backup exported', 'success');
        return;
      }
      Alert.alert(
        'Restore backup?',
        'This replaces all FinTrack data on this device. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: async () => {
              try {
                await importBackupFromText(prompt.pendingText ?? '', password);
                await refresh();
                showToast('Backup restored', 'success');
              } catch (e) {
                showToast(`Restore failed: ${String(e)}`, 'error');
              }
            },
          },
        ]
      );
    } catch (e) {
      showToast(
        prompt.mode === 'export'
          ? `Export failed: ${String(e)}`
          : `Restore failed: ${String(e)}`,
        'error'
      );
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
              ? 'Enabled — biometrics or PIN'
              : 'Require unlock on open'
          }
          onPress={toggleLock}
          right={
            <AppText muted>{settings?.lockEnabled ? 'On' : 'Off'}</AppText>
          }
        />
        {!settings?.lockEnabled ? (
          <View className='mt-3' style={{ gap: 8 }}>
            <AppText size='sm' muted>
              No biometrics? Set a PIN here, then turn on App lock.
            </AppText>
            <TextInput
              value={pinSetup}
              onChangeText={(v) =>
                setPinSetup(v.replace(/\D/g, '').slice(0, 8))
              }
              keyboardType='number-pad'
              secureTextEntry
              placeholder='4–8 digit PIN'
              className='rounded-2xl px-4 py-3.5 bg-surface-sunken'
            />
            <Button
              label='Save PIN for app lock'
              variant='secondary'
              onPress={confirmPinLock}
              disabled={!isValidPinFormat(pinSetup)}
            />
          </View>
        ) : null}

        <SectionHeader title='Reminders' />
        <ListRow
          title='Local notifications'
          subtitle='Due recurring, subscriptions, debts, budgets, and goals'
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
          title='Net worth'
          subtitle='Assets, receivables, and liabilities'
          onPress={() => router.push('/planning/net-worth' as Href)}
        />
        <ListRow
          title='Cash-flow forecast'
          subtitle='Next 30–90 days projection'
          onPress={() => router.push('/planning/forecast' as Href)}
        />
        <ListRow
          title='Calendar'
          subtitle='Activity and upcoming dues'
          onPress={() => router.push('/planning/calendar' as Href)}
        />
        <ListRow
          title='What-if'
          subtitle='Explore savings scenarios'
          onPress={() => router.push('/planning/what-if' as Href)}
        />
        <ListRow
          title='Customize home'
          subtitle='Show, hide, and reorder dashboard cards'
          onPress={() => router.push('/planning/customize-home' as Href)}
        />
        <ListRow
          title='Categories'
          subtitle='Icons and kinds — includes IT defaults'
          onPress={() => router.push('/categories')}
        />

        <SectionHeader title='Data & privacy' />
        <ReceiptScanSettingsRow />
        <ListRow
          title='Export backup (JSON)'
          subtitle='Portable dump for cloud / Drive later'
          onPress={onExportJson}
        />
        <ListRow
          title='Export encrypted backup'
          subtitle='Password-protected FinTrack file'
          onPress={onExportEncrypted}
        />
        <ListRow
          title='Import / restore backup'
          subtitle='Preview confirm — replaces local data'
          onPress={onImportBackup}
        />
        <ListRow
          title='Export CSV'
          subtitle='Transactions spreadsheet'
          onPress={onExportCsv}
        />
        <ListRow
          title='Import CSV'
          subtitle='Map into the active account'
          onPress={onImportCsv}
        />
        <ListRow
          title='Recently deleted'
          subtitle='Restore soft-deleted items'
          onPress={() => router.push('/planning/recycle' as Href)}
        />
        <AppText size='sm' muted className='mt-3'>
          Your financial data stays on this device. Receipt photos stay
          on-device. No bank credentials required.
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
      <PasswordDialog
        visible={passwordPrompt != null}
        title='Encrypted backup'
        message={
          passwordPrompt?.mode === 'export'
            ? `Choose a password (min ${MIN_BACKUP_PASSWORD_LENGTH} characters). You will need it to restore.`
            : 'Enter the password used when this backup was exported.'
        }
        confirmLabel={passwordPrompt?.mode === 'export' ? 'Export' : 'Continue'}
        minLength={MIN_BACKUP_PASSWORD_LENGTH}
        onConfirm={(password) => {
          void onPasswordConfirm(password);
        }}
        onCancel={() => setPasswordPrompt(null)}
      />
    </Screen>
  );
}
