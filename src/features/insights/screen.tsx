import {
  endOfMonth,
  endOfYear,
  format,
  startOfMonth,
  startOfYear,
  subDays,
} from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { ActivityCalendar } from '@/components/charts/calendar';
import {
  buildDailySeries,
  CategoryDonut,
  type ChartRange,
  RangeFilters,
  SpendAreaChart,
  SpendBarChart,
} from '@/components/charts/widgets';
import { ProfileAvatar } from '@/components/media/images';
import {
  AppText,
  Card,
  EmptyState,
  Screen,
  SectionHeader,
  useThemeColors,
} from '@/components/ui/primitives';
import { characters } from '@/constants/characters';
import { db } from '@/lib/db/client';
import { listRecurring, listTransactions } from '@/lib/db/queries';
import { layout } from '@/lib/layout';
import { formatMoney, fromMinorUnits } from '@/lib/money';
import { useApp } from '@/providers/app-provider';

type Range = ChartRange | 'month' | 'year';

export function InsightsScreen() {
  const { settings, accounts } = useApp();
  const c = useThemeColors();
  const [range, setRange] = useState<Range>('30d');
  const [selectedDay, setSelectedDay] = useState<string | undefined>();
  const [txns, setTxns] = useState<
    Awaited<ReturnType<typeof listTransactions>>
  >([]);
  const [prevTxns, setPrevTxns] = useState<
    Awaited<ReturnType<typeof listTransactions>>
  >([]);
  const [recurringTitles, setRecurringTitles] = useState<Set<string>>(
    new Set()
  );

  const account = accounts.find((a) => a.id === settings?.activeAccountId);
  const currency = account?.currencyCode ?? settings?.defaultCurrency ?? 'USD';

  const bounds = useMemo(() => {
    const now = new Date();
    if (range === '7d') return { from: subDays(now, 6), to: now, days: 7 };
    if (range === '14d') return { from: subDays(now, 13), to: now, days: 14 };
    if (range === '30d') return { from: subDays(now, 29), to: now, days: 30 };
    if (range === '90d') return { from: subDays(now, 89), to: now, days: 90 };
    if (range === '1y') return { from: subDays(now, 364), to: now, days: 365 };
    if (range === 'month')
      return {
        from: startOfMonth(now),
        to: endOfMonth(now),
        days: now.getDate(),
      };
    return {
      from: startOfYear(now),
      to: endOfYear(now),
      days: Math.min(
        365,
        Math.ceil((now.getTime() - startOfYear(now).getTime()) / 86400000) + 1
      ),
    };
  }, [range]);

  const load = useCallback(async () => {
    const spanMs = bounds.to.getTime() - bounds.from.getTime();
    const prevTo = new Date(bounds.from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - spanMs);
    const [rows, prevRows, recurring] = await Promise.all([
      listTransactions(db, {
        accountId: account?.id,
        groupId: !account ? settings?.activeGroupId : undefined,
        from: bounds.from,
        to: bounds.to,
        limit: 2000,
      }),
      listTransactions(db, {
        accountId: account?.id,
        groupId: !account ? settings?.activeGroupId : undefined,
        from: prevFrom,
        to: prevTo,
        limit: 2000,
      }),
      listRecurring(db),
    ]);
    setTxns(rows);
    setPrevTxns(prevRows);
    setRecurringTitles(
      new Set(recurring.map((r) => r.title.trim().toLowerCase()))
    );
  }, [account, settings?.activeGroupId, bounds]);

  useEffect(() => {
    load();
  }, [load]);

  const expenses = txns.filter((t) => t.transaction.type === 'expense');
  const income = txns.filter((t) => t.transaction.type === 'income');
  const expenseTotal = expenses.reduce(
    (s, t) => s + t.transaction.amountMinor,
    0
  );
  const incomeTotal = income.reduce((s, t) => s + t.transaction.amountMinor, 0);
  const savingsRate =
    incomeTotal > 0
      ? Math.round(((incomeTotal - expenseTotal) / incomeTotal) * 100)
      : null;

  const prevExpenseTotal = prevTxns
    .filter((t) => t.transaction.type === 'expense')
    .reduce((s, t) => s + t.transaction.amountMinor, 0);

  const flexibleVsRecurring = useMemo(() => {
    let recurringSpend = 0;
    let flexibleSpend = 0;
    for (const row of expenses) {
      const title = row.transaction.title.trim().toLowerCase();
      if (recurringTitles.has(title)) {
        recurringSpend += row.transaction.amountMinor;
      } else {
        flexibleSpend += row.transaction.amountMinor;
      }
    }
    return { recurringSpend, flexibleSpend };
  }, [expenses, recurringTitles]);

  const byCategory = useMemo(() => {
    const map = new Map<
      string,
      { name: string; color: string; total: number }
    >();
    for (const row of expenses) {
      const key = row.category?.id ?? 'other';
      const prev = map.get(key) ?? {
        name: row.category?.name ?? 'Other',
        color: row.category?.color ?? '#6B7280',
        total: 0,
      };
      prev.total += row.transaction.amountMinor;
      map.set(key, prev);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [expenses]);

  const categoryDelta = useMemo(() => {
    const prevMap = new Map<string, number>();
    for (const row of prevTxns) {
      if (row.transaction.type !== 'expense') continue;
      const name = row.category?.name ?? 'Other';
      prevMap.set(name, (prevMap.get(name) ?? 0) + row.transaction.amountMinor);
    }
    return byCategory.slice(0, 5).map((cat) => {
      const prev = prevMap.get(cat.name) ?? 0;
      const delta =
        prev === 0
          ? cat.total > 0
            ? 100
            : 0
          : Math.round(((cat.total - prev) / prev) * 100);
      return { name: cat.name, total: cat.total, delta };
    });
  }, [byCategory, prevTxns]);

  const pieData = byCategory.slice(0, 6).map((cat) => ({
    value: fromMinorUnits(cat.total, currency),
    color: cat.color,
    label: cat.name,
  }));

  const series = useMemo(
    () =>
      buildDailySeries(
        expenses.map((t) => ({
          occurredAt: t.transaction.occurredAt,
          amountMinor: t.transaction.amountMinor,
        })),
        Math.min(bounds.days, 90)
      ),
    [expenses, bounds.days]
  );

  const calendarMarks = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of expenses) {
      const key = format(row.transaction.occurredAt, 'yyyy-MM-dd');
      map.set(key, (map.get(key) ?? 0) + row.transaction.amountMinor);
    }
    return map;
  }, [expenses]);

  const chartFilterValue: ChartRange =
    range === 'month' || range === 'year' ? '30d' : range;

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
            size={48}
            fallback={characters.insights}
          />
          <View>
            <AppText size='xl' weight='bold'>
              Insights
            </AppText>
            <AppText size='sm' muted>
              Trends, categories, calendar
            </AppText>
          </View>
        </View>

        <View className='mt-4'>
          <RangeFilters
            value={chartFilterValue}
            onChange={(v) => setRange(v)}
          />
        </View>

        <Card className='mt-4'>
          <View className='flex-row gap-8'>
            <View>
              <AppText size='sm' muted>
                Spent
              </AppText>
              <AppText size='xl' weight='bold'>
                {formatMoney(expenseTotal, currency)}
              </AppText>
            </View>
            <View>
              <AppText size='sm' muted>
                Earned
              </AppText>
              <AppText size='xl' weight='bold'>
                {formatMoney(incomeTotal, currency)}
              </AppText>
            </View>
          </View>
          {savingsRate != null ? (
            <AppText size='sm' muted className='mt-2'>
              Savings rate {savingsRate}% · vs prior period spent{' '}
              {formatMoney(prevExpenseTotal, currency)} (
              {prevExpenseTotal === 0
                ? 'n/a'
                : `${expenseTotal >= prevExpenseTotal ? '+' : ''}${Math.round(((expenseTotal - prevExpenseTotal) / prevExpenseTotal) * 100)}%`}
              )
            </AppText>
          ) : null}
        </Card>

        <SectionHeader title='Recurring vs flexible' />
        <Card>
          <AppText size='sm'>
            Recurring-like{' '}
            {formatMoney(flexibleVsRecurring.recurringSpend, currency)}
          </AppText>
          <AppText size='sm' className='mt-1'>
            Flexible {formatMoney(flexibleVsRecurring.flexibleSpend, currency)}
          </AppText>
          <AppText size='xs' muted className='mt-2'>
            Matched by title against recurring templates.
          </AppText>
        </Card>

        <SectionHeader title='vs prior period' />
        {categoryDelta.length === 0 ? (
          <AppText muted>No category comparison yet</AppText>
        ) : (
          categoryDelta.map((row) => (
            <View
              key={row.name}
              className='flex-row items-center justify-between py-2'
              style={{ borderBottomWidth: 1, borderBottomColor: c.line }}
            >
              <View>
                <AppText weight='medium'>{row.name}</AppText>
                <AppText size='sm' muted>
                  {formatMoney(row.total, currency)}
                </AppText>
              </View>
              <AppText
                style={{
                  color: row.delta > 0 ? c.expense : c.income,
                }}
              >
                {row.delta > 0 ? '+' : ''}
                {row.delta}%
              </AppText>
            </View>
          ))
        )}

        <SectionHeader title='Trend' />
        {expenses.length === 0 ? (
          <EmptyState
            title='No spend in this range'
            character={characters.empty}
          />
        ) : (
          <SpendAreaChart points={series} title='Spend over time' />
        )}

        <SectionHeader title='Day by day' />
        {expenses.length === 0 ? null : <SpendBarChart points={series} />}

        <SectionHeader title='Calendar' />
        <ActivityCalendar
          markedAmounts={calendarMarks}
          selected={selectedDay}
          onSelect={setSelectedDay}
          title='Activity calendar'
        />

        <SectionHeader title='By category' />
        {pieData.length === 0 ? (
          <EmptyState title='No categories yet' />
        ) : (
          <Card className='items-center py-4'>
            <CategoryDonut slices={pieData} />
            <View className='mt-4 w-full gap-2'>
              {byCategory.slice(0, 8).map((cat) => (
                <View
                  key={cat.name}
                  className='flex-row items-center justify-between'
                >
                  <View className='flex-row items-center gap-2'>
                    <View
                      className='h-2.5 w-2.5 rounded-full'
                      style={{ backgroundColor: cat.color }}
                    />
                    <AppText>{cat.name}</AppText>
                  </View>
                  <AppText weight='medium'>
                    {formatMoney(cat.total, currency)}
                  </AppText>
                </View>
              ))}
            </View>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}
