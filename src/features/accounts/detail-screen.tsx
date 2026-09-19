import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import {
  AppText,
  Button,
  ConfirmDialog,
  Field,
  GoBack,
  Screen,
  Select,
} from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { db } from '@/lib/db/client';
import {
  getAccountBalance,
  getAccountById,
  softDeleteAccount,
  updateAccount,
} from '@/lib/db/queries';
import type { Account } from '@/lib/db/schema';
import { layout } from '@/lib/layout';
import { CURRENCIES, formatMoney } from '@/lib/money';
import { useApp } from '@/providers/app-provider';

export function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refresh } = useApp();
  const { showToast } = useToast();
  const [account, setAccount] = useState<Account | null>(null);
  const [balance, setBalance] = useState(0);
  const [name, setName] = useState('');
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  const currencyOptions = useMemo(
    () =>
      CURRENCIES.map((c) => ({
        label: `${c.code} — ${c.name}`,
        value: c.code,
      })),
    []
  );

  const load = useCallback(async () => {
    if (!id) return;
    const row = await getAccountById(db, id);
    setAccount(row);
    setName(row?.name ?? '');
    setCurrencyCode(row?.currencyCode ?? 'USD');
    if (row) setBalance(await getAccountBalance(db, row.id));
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!account) {
    return (
      <Screen>
        <AppText className='p-5'>Account not found</AppText>
      </Screen>
    );
  }

  const onSave = async () => {
    if (!name.trim()) {
      showToast('Enter an account name', 'error');
      return;
    }
    setSaving(true);
    try {
      await updateAccount(db, account.id, {
        name: name.trim(),
        currencyCode,
      });
      await refresh();
      await load();
      showToast('Account updated', 'success');
    } catch (e) {
      showToast(`Save failed: ${String(e)}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: layout.gutter,
          paddingBottom: 40,
        }}
      >
        <GoBack />
        <AppText size='sm' muted>
          Balance
        </AppText>
        <AppText size='display' weight='bold'>
          {formatMoney(balance, account.currencyCode)}
        </AppText>

        <View className='mt-6 gap-3'>
          <Field label='Name' value={name} onChangeText={setName} />
          <Select
            label='Currency'
            value={currencyCode}
            options={currencyOptions}
            onChange={setCurrencyCode}
          />
          <AppText size='xs' muted>
            Changing currency does not convert past transactions.
          </AppText>
          <Button
            label={saving ? 'Saving…' : 'Save changes'}
            onPress={onSave}
            disabled={saving}
          />
          <Button
            label='Remove account'
            variant='danger'
            onPress={() => setConfirmDelete(true)}
          />
        </View>
      </ScrollView>
      <ConfirmDialog
        visible={confirmDelete}
        title={`Remove ${account.name}?`}
        message='This removes the account and hides its activity from the app.'
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await softDeleteAccount(db, account.id);
          setConfirmDelete(false);
          await refresh();
          showToast('Account removed', 'success');
          router.back();
        }}
      />
    </Screen>
  );
}
