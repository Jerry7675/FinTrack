import { addMonths } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import {
  Button,
  ConfirmDialog,
  Field,
  FormScroll,
  ListRow,
  Screen,
  ScreenHeader,
} from '@/components/ui/primitives';
import { db } from '@/lib/db/client';
import {
  createSubscription,
  listSubscriptions,
  softDeleteSubscription,
} from '@/lib/db/queries';
import type { Subscription } from '@/lib/db/schema';
import { layout } from '@/lib/layout';
import { formatMoney } from '@/lib/money';
import { useApp } from '@/providers/app-provider';

export function SubscriptionsScreen() {
  const { accounts, settings } = useApp();
  const [items, setItems] = useState<Subscription[]>([]);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    setItems(await listSubscriptions(db));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    const account =
      accounts.find((a) => a.id === settings?.activeAccountId) ?? accounts[0];
    const value = Number.parseFloat(amount);
    if (!account || !name.trim() || !Number.isFinite(value)) {
      Alert.alert('Need account, name, and amount');
      return;
    }
    await createSubscription(db, {
      accountId: account.id,
      name: name.trim(),
      amount: value,
      currencyCode: account.currencyCode,
      cadence: 'monthly',
      nextBillingAt: addMonths(new Date(), 1),
    });
    setName('');
    setAmount('');
    await load();
  };

  return (
    <Screen>
      <FormScroll
        contentContainerStyle={{
          paddingHorizontal: layout.gutter,
        }}
      >
        <ScreenHeader title='Subscriptions' />
        <View className='mt-4 gap-3'>
          <Field label='Name' value={name} onChangeText={setName} />
          <Field
            label='Amount'
            value={amount}
            onChangeText={setAmount}
            keyboardType='decimal-pad'
          />
          <Button label='Add subscription' onPress={add} />
        </View>
        {items.map((s) => (
          <ListRow
            key={s.id}
            title={s.name}
            subtitle={`${formatMoney(s.amountMinor, s.currencyCode)} · ${s.cadence}`}
            onPress={() => setPending(s.id)}
          />
        ))}
      </FormScroll>
      <ConfirmDialog
        visible={pending !== null}
        title='Delete subscription?'
        message='Remove this subscription tracker.'
        onCancel={() => setPending(null)}
        onConfirm={async () => {
          if (pending) await softDeleteSubscription(db, pending);
          setPending(null);
          await load();
        }}
      />
    </Screen>
  );
}
