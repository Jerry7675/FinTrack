import { format, parseISO } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { ActivityCalendar } from '@/components/charts/calendar';
import {
  AppText,
  FormScroll,
  Screen,
  ScreenHeader,
  useThemeColors,
} from '@/components/ui/primitives';
import { db } from '@/lib/db/client';
import {
  listDebts,
  listRecurring,
  listSubscriptions,
  listTransactions,
} from '@/lib/db/queries';
import { buildCashFlowForecast, groupEventsByDay } from '@/lib/forecast';
import { layout } from '@/lib/layout';
import { formatMoney } from '@/lib/money';
import { useApp } from '@/providers/app-provider';

export function CalendarScreen() {
  const { settings, accounts } = useApp();
  const c = useThemeColors();
  const [selected, setSelected] = useState(() =>
    format(new Date(), 'yyyy-MM-dd')
  );
  const [txns, setTxns] = useState<
    Awaited<ReturnType<typeof listTransactions>>
  >([]);
  const [dues, setDues] = useState<
    ReturnType<typeof buildCashFlowForecast>['events']
  >([]);

  const account = accounts.find((a) => a.id === settings?.activeAccountId);
  const currency = account?.currencyCode ?? settings?.defaultCurrency ?? 'USD';

  const load = useCallback(async () => {
    const [rows, recurring, subs, debts] = await Promise.all([
      listTransactions(db, {
        accountId: account?.id,
        groupId: !account ? settings?.activeGroupId : undefined,
        limit: 2000,
      }),
      listRecurring(db),
      listSubscriptions(db),
      listDebts(db),
    ]);
    setTxns(rows);
    const forecast = buildCashFlowForecast({
      startingBalanceMinor: 0,
      days: 62,
      recurring,
      subscriptions: subs,
      debts,
    });
    setDues(forecast.events);
  }, [account, settings?.activeGroupId]);

  useEffect(() => {
    void load();
  }, [load]);

  const markedAmounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of txns) {
      if (row.transaction.type !== 'expense') continue;
      const key = format(row.transaction.occurredAt, 'yyyy-MM-dd');
      map.set(key, (map.get(key) ?? 0) + row.transaction.amountMinor);
    }
    for (const e of dues) {
      const key = format(e.date, 'yyyy-MM-dd');
      map.set(key, (map.get(key) ?? 0) + e.amountMinor);
    }
    return map;
  }, [txns, dues]);

  const dayTxns = useMemo(
    () =>
      txns.filter(
        (t) => format(t.transaction.occurredAt, 'yyyy-MM-dd') === selected
      ),
    [txns, selected]
  );

  const dayDues = useMemo(() => {
    const byDay = groupEventsByDay(dues);
    return byDay.get(selected) ?? [];
  }, [dues, selected]);

  const dayIncome = dayTxns
    .filter((t) => t.transaction.type === 'income')
    .reduce((s, t) => s + t.transaction.amountMinor, 0);
  const dayExpense = dayTxns
    .filter((t) => t.transaction.type === 'expense')
    .reduce((s, t) => s + t.transaction.amountMinor, 0);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of dayTxns) {
      if (row.transaction.type !== 'expense') continue;
      const name = row.category?.name ?? 'Other';
      map.set(name, (map.get(name) ?? 0) + row.transaction.amountMinor);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [dayTxns]);

  return (
    <Screen>
      <FormScroll contentContainerStyle={{ paddingHorizontal: layout.gutter }}>
        <ScreenHeader title='Calendar' />
        <AppText muted className='mt-1'>
          Days with spending or upcoming dues are highlighted.
        </AppText>

        <View className='mt-4'>
          <ActivityCalendar
            markedAmounts={markedAmounts}
            selected={selected}
            onSelect={setSelected}
            title='Financial calendar'
          />
        </View>

        <AppText weight='semibold' className='mt-4'>
          {format(parseISO(selected), 'MMMM d, yyyy')}
        </AppText>
        <AppText size='sm' muted className='mt-1'>
          Income {formatMoney(dayIncome, currency)} · Expenses{' '}
          {formatMoney(dayExpense, currency)}
        </AppText>

        {byCategory.map(([name, total]) => (
          <View
            key={name}
            className='flex-row justify-between py-2'
            style={{ borderBottomWidth: 1, borderBottomColor: c.line }}
          >
            <AppText>{name}</AppText>
            <AppText>{formatMoney(total, currency)}</AppText>
          </View>
        ))}

        {dayDues.length > 0 ? (
          <>
            <AppText size='sm' muted weight='semibold' className='mt-4 mb-1'>
              DUE / UPCOMING
            </AppText>
            {dayDues.map((e) => (
              <View
                key={`${e.source}-${e.label}-${e.amountMinor}-${e.date.toISOString()}`}
                className='flex-row justify-between py-2'
              >
                <AppText>
                  {e.label} · {e.source}
                </AppText>
                <AppText
                  style={{ color: e.kind === 'income' ? c.income : c.expense }}
                >
                  {formatMoney(e.amountMinor, currency)}
                </AppText>
              </View>
            ))}
          </>
        ) : null}

        {dayTxns.length === 0 && dayDues.length === 0 ? (
          <AppText muted className='mt-3'>
            No activity on this day.
          </AppText>
        ) : null}
      </FormScroll>
    </Screen>
  );
}
