import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  ConfirmDialog,
  Field,
  FormScroll,
  IconButton,
  ProgressBar,
  Screen,
  ScreenHeader,
  useThemeColors,
} from '@/components/ui/primitives';
import { db } from '@/lib/db/client';
import {
  createDebt,
  listDebts,
  recordDebtPayment,
  softDeleteDebt,
} from '@/lib/db/queries';
import type { Debt } from '@/lib/db/schema';
import { layout } from '@/lib/layout';
import { formatMoney } from '@/lib/money';
import { useApp } from '@/providers/app-provider';

export function DebtsScreen() {
  const { settings, colorScheme } = useApp();
  const c = useThemeColors();
  const [items, setItems] = useState<Debt[]>([]);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<'i_owe' | 'owed_to_me'>('i_owe');
  const [pending, setPending] = useState<string | null>(null);
  const [payId, setPayId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');

  const load = useCallback(async () => {
    setItems(await listDebts(db));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    const value = Number.parseFloat(amount);
    if (!name.trim() || !Number.isFinite(value)) {
      Alert.alert('Enter name and amount');
      return;
    }
    await createDebt(db, {
      name: name.trim(),
      kind,
      principal: value,
      currencyCode: settings?.defaultCurrency ?? 'USD',
    });
    setName('');
    setAmount('');
    await load();
  };

  const submitPayment = async () => {
    if (!payId) return;
    const value = Number.parseFloat(payAmount);
    if (!Number.isFinite(value) || value <= 0) {
      Alert.alert('Enter a payment amount');
      return;
    }
    const debt = items.find((d) => d.id === payId);
    await recordDebtPayment(
      db,
      payId,
      value,
      debt?.currencyCode ?? settings?.defaultCurrency ?? 'USD'
    );
    setPayId(null);
    setPayAmount('');
    await load();
  };

  const iOwe = items.filter((d) => d.kind === 'i_owe');
  const owedToMe = items.filter((d) => d.kind === 'owed_to_me');

  const renderDebt = (d: Debt) => {
    const paid = Math.max(0, d.principalMinor - d.remainingMinor);
    const pct = d.principalMinor > 0 ? paid / d.principalMinor : 0;
    return (
      <Card key={d.id} className='mb-3'>
        <View className='flex-row items-start justify-between'>
          <View className='flex-1'>
            <AppText weight='semibold'>{d.name}</AppText>
            <AppText size='sm' muted>
              {d.kind === 'i_owe' ? 'You owe' : 'Owed to you'}
            </AppText>
          </View>
          <IconButton
            name='trash-outline'
            color={c.expense}
            onPress={() => setPending(d.id)}
          />
        </View>
        <AppText className='mt-2'>
          Remaining {formatMoney(d.remainingMinor, d.currencyCode)}
        </AppText>
        <AppText size='sm' muted>
          Original {formatMoney(d.principalMinor, d.currencyCode)} · Paid{' '}
          {formatMoney(paid, d.currencyCode)}
        </AppText>
        <View className='mt-2'>
          <ProgressBar
            progress={pct}
            color={d.kind === 'i_owe' ? c.expense : c.income}
          />
        </View>
        {payId === d.id ? (
          <View className='mt-3 gap-2'>
            <Field
              label='Payment amount'
              value={payAmount}
              onChangeText={setPayAmount}
              keyboardType='decimal-pad'
            />
            <View className='flex-row gap-2'>
              <View className='flex-1'>
                <Button
                  label='Cancel'
                  variant='secondary'
                  onPress={() => {
                    setPayId(null);
                    setPayAmount('');
                  }}
                />
              </View>
              <View className='flex-1'>
                <Button label='Record' onPress={submitPayment} />
              </View>
            </View>
          </View>
        ) : (
          <View className='mt-3'>
            <Button
              label='Record payment'
              variant='secondary'
              icon='cash-outline'
              onPress={() => setPayId(d.id)}
            />
          </View>
        )}
      </Card>
    );
  };

  return (
    <Screen>
      <FormScroll contentContainerStyle={{ paddingHorizontal: layout.gutter }}>
        <ScreenHeader title='Debts' />
        <View className='mt-4 flex-row gap-2'>
          {(
            [
              ['i_owe', 'I owe'],
              ['owed_to_me', 'Owed to me'],
            ] as const
          ).map(([k, label]) => (
            <Pressable
              key={k}
              onPress={() => setKind(k)}
              className={`rounded-full px-3 py-1.5 ${
                kind === k
                  ? 'bg-accent'
                  : colorScheme === 'dark'
                    ? 'bg-surface-dark-raised'
                    : 'bg-surface-raised'
              }`}
            >
              <AppText size='sm'>{label}</AppText>
            </Pressable>
          ))}
        </View>
        <View className='mt-4 gap-3'>
          <Field label='Name' value={name} onChangeText={setName} />
          <Field
            label='Amount'
            value={amount}
            onChangeText={setAmount}
            keyboardType='decimal-pad'
          />
          <Button label='Add debt' onPress={add} />
        </View>

        <AppText size='sm' muted weight='semibold' className='mt-6 mb-2'>
          I OWE
        </AppText>
        {iOwe.length === 0 ? (
          <AppText muted size='sm'>
            No debts you owe.
          </AppText>
        ) : (
          iOwe.map(renderDebt)
        )}

        <AppText size='sm' muted weight='semibold' className='mt-6 mb-2'>
          OWED TO ME
        </AppText>
        {owedToMe.length === 0 ? (
          <AppText muted size='sm'>
            No receivables yet.
          </AppText>
        ) : (
          owedToMe.map(renderDebt)
        )}
      </FormScroll>
      <ConfirmDialog
        visible={pending !== null}
        title='Delete debt?'
        message='Remove this debt record.'
        onCancel={() => setPending(null)}
        onConfirm={async () => {
          if (pending) await softDeleteDebt(db, pending);
          setPending(null);
          await load();
        }}
      />
    </Screen>
  );
}
