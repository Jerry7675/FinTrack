import { format } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';

import {
  AppText,
  Button,
  Chip,
  ConfirmDialog,
  Field,
  FormScroll,
  IconButton,
  ListRow,
  Screen,
  ScreenHeader,
  Select,
  useThemeColors,
} from '@/components/ui/primitives';
import { db } from '@/lib/db/client';
import {
  createRecurring,
  listCategories,
  listRecurring,
  softDeleteRecurring,
} from '@/lib/db/queries';
import type { Category, RecurringTemplate } from '@/lib/db/schema';
import { layout } from '@/lib/layout';
import { formatMoney } from '@/lib/money';
import { computeNextDueAt, type RecurringCadence } from '@/lib/planning';
import { useApp } from '@/providers/app-provider';

const CADENCE_OPTIONS = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' },
  { label: 'Custom days', value: 'custom' },
];

const WEEKDAYS = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
];

export function RecurringScreen() {
  const { accounts, settings } = useApp();
  const c = useThemeColors();
  const [items, setItems] = useState<RecurringTemplate[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [cadence, setCadence] = useState<RecurringCadence>('monthly');
  const [weekday, setWeekday] = useState(1);
  const [monthDay, setMonthDay] = useState('1');
  const [customDays, setCustomDays] = useState('7');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const accountOptions = useMemo(
    () =>
      accounts.map((a) => ({
        label: `${a.name} · ${a.currencyCode}`,
        value: a.id,
      })),
    [accounts]
  );

  const categoryOptions = useMemo(
    () => [
      { label: 'None', value: '' },
      ...categories.map((cat) => ({ label: cat.name, value: cat.id })),
    ],
    [categories]
  );

  const load = useCallback(async () => {
    setItems(await listRecurring(db));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const defaultAccount = settings?.activeAccountId || accounts[0]?.id || '';
    setAccountId((prev) => prev || defaultAccount);
  }, [accounts, settings?.activeAccountId]);

  useEffect(() => {
    listCategories(db, type).then((rows) => {
      setCategories(rows);
      setCategoryId(null);
    });
  }, [type]);

  const resolveIntervalDays = (): number | null => {
    if (cadence === 'weekly') return weekday;
    if (cadence === 'monthly') {
      const day = Number.parseInt(monthDay, 10);
      return Number.isFinite(day) ? Math.min(28, Math.max(1, day)) : 1;
    }
    if (cadence === 'custom') {
      const n = Number.parseInt(customDays, 10);
      return Number.isFinite(n) && n > 0 ? n : 1;
    }
    return null;
  };

  const add = async () => {
    const account =
      accounts.find((a) => a.id === accountId) ??
      accounts.find((a) => a.id === settings?.activeAccountId) ??
      accounts[0];
    const value = Number.parseFloat(amount);
    if (!account || !title.trim() || !Number.isFinite(value)) {
      Alert.alert('Need account, title, and amount');
      return;
    }
    const intervalDays = resolveIntervalDays();
    const nextDueAt = computeNextDueAt(cadence, intervalDays);
    await createRecurring(db, {
      accountId: account.id,
      categoryId: categoryId || null,
      type,
      title: title.trim(),
      amount: value,
      currencyCode: account.currencyCode,
      cadence,
      intervalDays,
      nextDueAt,
    });
    setTitle('');
    setAmount('');
    await load();
  };

  const cadenceSubtitle = (item: RecurringTemplate) => {
    const parts = [
      formatMoney(item.amountMinor, item.currencyCode),
      item.type,
      item.cadence,
    ];
    if (item.cadence === 'weekly' && item.intervalDays != null) {
      parts.push(
        WEEKDAYS.find((d) => d.value === item.intervalDays)?.label ?? ''
      );
    } else if (item.cadence === 'monthly' && item.intervalDays != null) {
      parts.push(`day ${item.intervalDays}`);
    } else if (item.cadence === 'custom' && item.intervalDays != null) {
      parts.push(`every ${item.intervalDays}d`);
    }
    parts.push(`next ${format(item.nextDueAt, 'MMM d')}`);
    return parts.filter(Boolean).join(' · ');
  };

  return (
    <Screen>
      <FormScroll
        contentContainerStyle={{
          paddingHorizontal: layout.gutter,
        }}
      >
        <ScreenHeader title='Recurring' />
        <AppText muted className='mt-1'>
          Templates only — FinTrack never auto-pays. Confirm when due.
        </AppText>
        <View className='mt-4 gap-3'>
          <Field label='Title' value={title} onChangeText={setTitle} />
          <Field
            label='Amount'
            value={amount}
            onChangeText={setAmount}
            keyboardType='decimal-pad'
          />
          <View className='flex-row gap-2'>
            <View className='flex-1'>
              <Chip
                label='Expense'
                active={type === 'expense'}
                onPress={() => setType('expense')}
              />
            </View>
            <View className='flex-1'>
              <Chip
                label='Income'
                active={type === 'income'}
                onPress={() => setType('income')}
              />
            </View>
          </View>
          <Select
            label='Account'
            value={accountId}
            onChange={setAccountId}
            options={accountOptions}
          />
          <Select
            label='Category (optional)'
            value={categoryId ?? ''}
            onChange={(v) => setCategoryId(v || null)}
            options={categoryOptions}
          />
          <Select
            label='Frequency'
            value={cadence}
            onChange={(v) => setCadence(v as RecurringCadence)}
            options={CADENCE_OPTIONS}
          />
          {cadence === 'weekly' ? (
            <View>
              <AppText size='sm' muted weight='medium' className='mb-2'>
                Day of week
              </AppText>
              <View className='flex-row flex-wrap gap-2'>
                {WEEKDAYS.map((d) => (
                  <Chip
                    key={d.value}
                    label={d.label}
                    active={weekday === d.value}
                    onPress={() => setWeekday(d.value)}
                  />
                ))}
              </View>
            </View>
          ) : null}
          {cadence === 'monthly' ? (
            <Field
              label='Day of month (1–28)'
              value={monthDay}
              onChangeText={setMonthDay}
              keyboardType='number-pad'
            />
          ) : null}
          {cadence === 'custom' ? (
            <Field
              label='Every N days'
              value={customDays}
              onChangeText={setCustomDays}
              keyboardType='number-pad'
            />
          ) : null}
          <Button label='Add template' onPress={add} />
        </View>

        <View className='mt-6'>
          {items.length === 0 ? (
            <AppText muted>
              No recurring templates yet. Add rent, salary, or bills here.
            </AppText>
          ) : null}
          {items.map((item) => (
            <ListRow
              key={item.id}
              title={item.title}
              subtitle={cadenceSubtitle(item)}
              right={
                <IconButton
                  name='trash-outline'
                  color={c.expense}
                  onPress={() => setPending(item.id)}
                />
              }
            />
          ))}
        </View>
      </FormScroll>
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
