import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

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
import { createDebt, listDebts, softDeleteDebt } from '@/lib/db/queries';
import type { Debt } from '@/lib/db/schema';
import { layout } from '@/lib/layout';
import { formatMoney } from '@/lib/money';
import { useApp } from '@/providers/app-provider';

export function DebtsScreen() {
  const { settings, colorScheme } = useApp();
  const [items, setItems] = useState<Debt[]>([]);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<'i_owe' | 'owed_to_me'>('i_owe');
  const [pending, setPending] = useState<string | null>(null);

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

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: layout.gutter,
          paddingBottom: 40,
        }}
      >
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
        {items.map((d) => (
          <ListRow
            key={d.id}
            title={d.name}
            subtitle={`${d.kind === 'i_owe' ? 'I owe' : 'Owed to me'} · ${formatMoney(d.remainingMinor, d.currencyCode)}`}
            onPress={() => setPending(d.id)}
          />
        ))}
      </ScrollView>
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
