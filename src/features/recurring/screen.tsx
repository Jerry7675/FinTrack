import { addMonths } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import {
  AppText,
  Button,
  ConfirmDialog,
  Field,
  ListRow,
  Screen,
  ScreenHeader,
} from '@/components/ui/primitives';
import { db } from '@/lib/db/client';
import {
  createRecurring,
  listRecurring,
  softDeleteRecurring,
} from '@/lib/db/queries';
import type { RecurringTemplate } from '@/lib/db/schema';
import { layout } from '@/lib/layout';
import { formatMoney } from '@/lib/money';
import { useApp } from '@/providers/app-provider';

export function RecurringScreen() {
  const { accounts, settings } = useApp();
  const [items, setItems] = useState<RecurringTemplate[]>([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    setItems(await listRecurring(db));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    const account =
      accounts.find((a) => a.id === settings?.activeAccountId) ?? accounts[0];
    const value = Number.parseFloat(amount);
    if (!account || !title.trim() || !Number.isFinite(value)) {
      Alert.alert('Need account, title, and amount');
      return;
    }
    await createRecurring(db, {
      accountId: account.id,
      type: 'expense',
      title: title.trim(),
      amount: value,
      currencyCode: account.currencyCode,
      cadence: 'monthly',
      nextDueAt: addMonths(new Date(), 1),
    });
    setTitle('');
    setAmount('');
    await load();
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: layout.gutter,
          paddingBottom: 40,
        }}
      >
        <ScreenHeader title='Recurring' />
        <AppText muted className='mt-1'>
          Templates only — FinTrack never auto-pays.
        </AppText>
        <View className='mt-4 gap-3'>
          <Field label='Title' value={title} onChangeText={setTitle} />
          <Field
            label='Amount'
            value={amount}
            onChangeText={setAmount}
            keyboardType='decimal-pad'
          />
          <Button label='Add template' onPress={add} />
        </View>
        {items.map((item) => (
          <ListRow
            key={item.id}
            title={item.title}
            subtitle={`${formatMoney(item.amountMinor, item.currencyCode)} · ${item.cadence}`}
            onPress={() => setPending(item.id)}
          />
        ))}
      </ScrollView>
      <ConfirmDialog
        visible={pending !== null}
        title='Delete template?'
        message='Remove this recurring template.'
        onCancel={() => setPending(null)}
        onConfirm={async () => {
          if (pending) await softDeleteRecurring(db, pending);
          setPending(null);
          await load();
        }}
      />
    </Screen>
  );
}
