import { format } from 'date-fns';
import { useCallback, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  ConfirmDialog,
  Field,
  FormScroll,
  IconButton,
  Screen,
  ScreenHeader,
  Select,
  useThemeColors,
} from '@/components/ui/primitives';
import { useReloadOnFocus } from '@/hooks/use-reload-on-focus';
import { db } from '@/lib/db/client';
import {
  createSubscription,
  listSubscriptions,
  softDeleteSubscription,
} from '@/lib/db/queries';
import type { Subscription } from '@/lib/db/schema';
import {
  subscriptionAnnualMinor,
  subscriptionMonthlyMinor,
} from '@/lib/forecast';
import { layout } from '@/lib/layout';
import { formatMoney } from '@/lib/money';
import { useApp } from '@/providers/app-provider';

const CADENCE_OPTIONS = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' },
];

export function SubscriptionsScreen() {
  const { accounts, settings, bumpData } = useApp();
  const c = useThemeColors();
  const [items, setItems] = useState<Subscription[]>([]);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [cadence, setCadence] = useState<'weekly' | 'monthly' | 'yearly'>(
    'monthly'
  );
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    setItems(await listSubscriptions(db));
  }, []);

  useReloadOnFocus(load);

  const currency = settings?.defaultCurrency ?? 'USD';

  const totals = useMemo(() => {
    const monthly = items.reduce(
      (s, item) => s + subscriptionMonthlyMinor(item),
      0
    );
    const annual = items.reduce(
      (s, item) => s + subscriptionAnnualMinor(item),
      0
    );
    return { monthly, annual };
  }, [items]);

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
      cadence,
    });
    setName('');
    setAmount('');
    bumpData();
    await load();
  };

  return (
    <Screen>
      <FormScroll contentContainerStyle={{ paddingHorizontal: layout.gutter }}>
        <ScreenHeader title='Subscriptions' />
        <AppText muted className='mt-1'>
          Charges post to your balance on create and on each billing date.
        </AppText>

        {items.length > 0 ? (
          <Card className='mt-4'>
            <AppText size='sm' muted>
              Monthly total
            </AppText>
            <AppText size='lg' weight='semibold'>
              {formatMoney(Math.round(totals.monthly), currency)}
            </AppText>
            <AppText size='sm' muted className='mt-2'>
              Annual ≈ {formatMoney(Math.round(totals.annual), currency)}
            </AppText>
          </Card>
        ) : null}

        <View className='mt-4 gap-3'>
          <Field label='Name' value={name} onChangeText={setName} />
          <Field
            label='Amount'
            value={amount}
            onChangeText={setAmount}
            keyboardType='decimal-pad'
          />
          <Select
            label='Billing cadence'
            value={cadence}
            onChange={(v) => setCadence(v as 'weekly' | 'monthly' | 'yearly')}
            options={CADENCE_OPTIONS}
          />
          <Button label='Add subscription' onPress={add} />
        </View>

        <View className='mt-6 gap-3'>
          {items.map((s) => (
            <Card key={s.id}>
              <View className='flex-row items-start justify-between'>
                <View className='flex-1'>
                  <AppText weight='semibold'>{s.name}</AppText>
                  <AppText size='sm' muted>
                    {formatMoney(s.amountMinor, s.currencyCode)} · {s.cadence}
                  </AppText>
                  <AppText size='sm' muted>
                    Next {format(s.nextBillingAt, 'MMM d, yyyy')} · ≈{' '}
                    {formatMoney(
                      Math.round(subscriptionMonthlyMinor(s)),
                      s.currencyCode
                    )}
                    /mo
                  </AppText>
                </View>
                <IconButton
                  name='trash-outline'
                  color={c.expense}
                  onPress={() => setPending(s.id)}
                />
              </View>
            </Card>
          ))}
        </View>
      </FormScroll>
      <ConfirmDialog
        visible={pending !== null}
        title='Delete subscription?'
        message='Remove this subscription. Past posted charges stay in your ledger.'
        onCancel={() => setPending(null)}
        onConfirm={async () => {
          if (pending) await softDeleteSubscription(db, pending);
          setPending(null);
          bumpData();
          await load();
        }}
      />
    </Screen>
  );
}
