import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import {
  Button,
  ConfirmDialog,
  Field,
  ListRow,
  Screen,
  ScreenHeader,
} from '@/components/ui/primitives';
import { db } from '@/lib/db/client';
import {
  createBudget,
  listBudgets,
  listCategories,
  softDeleteBudget,
} from '@/lib/db/queries';
import type { Budget, Category } from '@/lib/db/schema';
import { layout } from '@/lib/layout';
import { formatMoney } from '@/lib/money';
import { useApp } from '@/providers/app-provider';

export function BudgetsScreen() {
  const { settings, refresh } = useApp();
  const [items, setItems] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    setItems(await listBudgets(db));
    const cats = await listCategories(db, 'expense');
    setCategories(cats);
    setCategoryId((prev) => prev || cats[0]?.id || '');
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    const value = Number.parseFloat(amount);
    if (!name.trim() || !Number.isFinite(value) || !categoryId) {
      Alert.alert('Fill name, amount, and category');
      return;
    }
    await createBudget(db, {
      name: name.trim(),
      categoryId,
      amount: value,
      currencyCode: settings?.defaultCurrency ?? 'USD',
      period: 'monthly',
    });
    setName('');
    setAmount('');
    await load();
    await refresh();
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: layout.gutter,
          paddingBottom: 40,
        }}
      >
        <ScreenHeader title='Budgets' />
        <View className='mt-4 gap-3'>
          <Field label='Name' value={name} onChangeText={setName} />
          <Field
            label='Monthly amount'
            value={amount}
            onChangeText={setAmount}
            keyboardType='decimal-pad'
          />
          <Field
            label='Category id (tap list below)'
            value={
              categories.find((c) => c.id === categoryId)?.name ?? categoryId
            }
            editable={false}
          />
          {categories.map((c) => (
            <ListRow
              key={c.id}
              title={c.name}
              onPress={() => setCategoryId(c.id)}
            />
          ))}
          <Button label='Add budget' onPress={add} />
        </View>
        <View className='mt-6'>
          {items.map((b) => (
            <ListRow
              key={b.id}
              title={b.name}
              subtitle={`${formatMoney(b.amountMinor, b.currencyCode)} · ${b.period}`}
              onPress={() => setPending(b.id)}
            />
          ))}
        </View>
      </ScrollView>
      <ConfirmDialog
        visible={pending !== null}
        title='Delete budget?'
        message='Remove this budget limit.'
        onCancel={() => setPending(null)}
        onConfirm={async () => {
          if (pending) await softDeleteBudget(db, pending);
          setPending(null);
          await load();
        }}
      />
    </Screen>
  );
}
