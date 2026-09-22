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
  ProgressBar,
  Screen,
  ScreenHeader,
  Select,
  useThemeColors,
} from '@/components/ui/primitives';
import { useReloadOnFocus } from '@/hooks/use-reload-on-focus';
import { db } from '@/lib/db/client';
import {
  createBudget,
  getBudgetSpend,
  listBudgets,
  listCategories,
  softDeleteBudget,
} from '@/lib/db/queries';
import type { Budget, Category } from '@/lib/db/schema';
import { layout } from '@/lib/layout';
import { formatMoney } from '@/lib/money';
import {
  type BudgetPeriod,
  budgetDaysRemaining,
  budgetStatus,
  suggestedDailyLimit,
} from '@/lib/planning';
import { useApp } from '@/providers/app-provider';

type BudgetRow = Budget & { spentMinor: number };

const PERIOD_OPTIONS = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' },
];

export function BudgetsScreen() {
  const { settings, refresh, bumpData } = useApp();
  const c = useThemeColors();
  const [items, setItems] = useState<BudgetRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [period, setPeriod] = useState<BudgetPeriod>('monthly');
  const [pending, setPending] = useState<string | null>(null);

  const categoryOptions = useMemo(
    () => categories.map((cat) => ({ label: cat.name, value: cat.id })),
    [categories]
  );

  const load = useCallback(async () => {
    const [budgetRows, cats] = await Promise.all([
      listBudgets(db),
      listCategories(db, 'expense'),
    ]);
    setCategories(cats);
    setCategoryId((prev) => prev || cats[0]?.id || '');
    const withSpend = await Promise.all(
      budgetRows.map(async (b) => ({
        ...b,
        spentMinor: await getBudgetSpend(db, b),
      }))
    );
    setItems(withSpend);
  }, []);

  useReloadOnFocus(load);

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
      period,
    });
    setName('');
    setAmount('');
    bumpData();
    await load();
    await refresh();
  };

  const statusColor = (status: ReturnType<typeof budgetStatus>) => {
    if (status === 'exceeded') return c.expense;
    if (status === 'approaching') return '#D97706';
    return c.income;
  };

  const statusLabel = (status: ReturnType<typeof budgetStatus>) => {
    if (status === 'exceeded') return 'Exceeded';
    if (status === 'approaching') return 'Approaching limit';
    return 'Healthy';
  };

  return (
    <Screen>
      <FormScroll
        contentContainerStyle={{
          paddingHorizontal: layout.gutter,
        }}
      >
        <ScreenHeader title='Budgets' />
        <AppText muted className='mt-1'>
          Track spending against category limits for the current period.
        </AppText>
        <View className='mt-4 gap-3'>
          <Field label='Name' value={name} onChangeText={setName} />
          <Field
            label='Limit amount'
            value={amount}
            onChangeText={setAmount}
            keyboardType='decimal-pad'
          />
          <Select
            label='Period'
            value={period}
            onChange={(v) => setPeriod(v as BudgetPeriod)}
            options={PERIOD_OPTIONS}
          />
          <Select
            label='Category'
            value={categoryId}
            onChange={setCategoryId}
            options={categoryOptions}
            placeholder='Select category'
          />
          <Button label='Add budget' onPress={add} />
        </View>

        <View className='mt-6 gap-3'>
          {items.length === 0 ? (
            <AppText muted>
              No budgets yet. Create one to see progress and suggested daily
              limits.
            </AppText>
          ) : null}
          {items.map((b) => {
            const ratio = b.amountMinor > 0 ? b.spentMinor / b.amountMinor : 0;
            const status = budgetStatus(b.spentMinor, b.amountMinor);
            const remaining = Math.max(0, b.amountMinor - b.spentMinor);
            const daysLeft = budgetDaysRemaining(b.period);
            const daily = suggestedDailyLimit(remaining, daysLeft);
            const color = statusColor(status);
            return (
              <Card key={b.id}>
                <View className='flex-row items-start justify-between gap-2'>
                  <View className='flex-1'>
                    <AppText weight='semibold'>{b.name}</AppText>
                    <AppText size='sm' muted>
                      {b.period} · {statusLabel(status)}
                    </AppText>
                  </View>
                  <IconButton
                    name='trash-outline'
                    color={c.expense}
                    onPress={() => setPending(b.id)}
                  />
                </View>
                <AppText className='mt-2' weight='medium'>
                  {formatMoney(b.spentMinor, b.currencyCode)} /{' '}
                  {formatMoney(b.amountMinor, b.currencyCode)}
                </AppText>
                <View className='mt-2'>
                  <ProgressBar progress={ratio} color={color} />
                </View>
                <AppText size='sm' muted className='mt-2'>
                  {formatMoney(remaining, b.currencyCode)} remaining ·{' '}
                  {daysLeft} day{daysLeft === 1 ? '' : 's'} left
                </AppText>
                {status !== 'exceeded' && daysLeft > 0 ? (
                  <AppText size='sm' className='mt-1' style={{ color }}>
                    Suggested daily · {formatMoney(daily, b.currencyCode)}/day
                  </AppText>
                ) : null}
                <AppText size='xs' muted className='mt-1'>
                  {Math.round(ratio * 100)}% used
                </AppText>
              </Card>
            );
          })}
        </View>
      </FormScroll>
      <ConfirmDialog
        visible={pending !== null}
        title='Delete budget?'
        message='Remove this budget limit.'
        onCancel={() => setPending(null)}
        onConfirm={async () => {
          if (pending) await softDeleteBudget(db, pending);
          setPending(null);
          bumpData();
          await load();
        }}
      />
    </Screen>
  );
}
