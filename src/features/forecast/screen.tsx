import { format } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import {
  AppText,
  Card,
  Chip,
  FormScroll,
  Screen,
  ScreenHeader,
  useThemeColors,
} from '@/components/ui/primitives';
import { db } from '@/lib/db/client';
import {
  getAccountBalance,
  listDebts,
  listRecurring,
  listSubscriptions,
} from '@/lib/db/queries';
import { buildCashFlowForecast } from '@/lib/forecast';
import { layout } from '@/lib/layout';
import { formatMoney } from '@/lib/money';
import { useApp } from '@/providers/app-provider';

export function ForecastScreen() {
  const { accounts, settings } = useApp();
  const c = useThemeColors();
  const [days, setDays] = useState<30 | 60 | 90>(30);
  const [balance, setBalance] = useState(0);
  const [recurring, setRecurring] = useState<
    Awaited<ReturnType<typeof listRecurring>>
  >([]);
  const [subs, setSubs] = useState<
    Awaited<ReturnType<typeof listSubscriptions>>
  >([]);
  const [debts, setDebts] = useState<Awaited<ReturnType<typeof listDebts>>>([]);

  const account =
    accounts.find((a) => a.id === settings?.activeAccountId) ?? accounts[0];
  const currency = account?.currencyCode ?? settings?.defaultCurrency ?? 'USD';

  const load = useCallback(async () => {
    if (account) {
      setBalance(await getAccountBalance(db, account.id));
    }
    const [r, s, d] = await Promise.all([
      listRecurring(db),
      listSubscriptions(db),
      listDebts(db),
    ]);
    setRecurring(r);
    setSubs(s);
    setDebts(d);
  }, [account]);

  useEffect(() => {
    void load();
  }, [load]);

  const forecast = useMemo(
    () =>
      buildCashFlowForecast({
        startingBalanceMinor: balance,
        days,
        recurring,
        subscriptions: subs,
        debts,
      }),
    [balance, days, recurring, subs, debts]
  );

  return (
    <Screen>
      <FormScroll contentContainerStyle={{ paddingHorizontal: layout.gutter }}>
        <ScreenHeader title='Cash-flow forecast' />
        <AppText muted className='mt-1'>
          Projection based on recurring templates, subscriptions, and debt due
          dates. Estimates only — FinTrack never auto-pays.
        </AppText>

        <View className='mt-4 flex-row gap-2'>
          {([30, 60, 90] as const).map((d) => (
            <Chip
              key={d}
              label={`${d}d`}
              active={days === d}
              onPress={() => setDays(d)}
            />
          ))}
        </View>

        <Card className='mt-4'>
          <AppText size='sm' muted>
            Current balance
          </AppText>
          <AppText size='lg' weight='semibold'>
            {formatMoney(forecast.startingBalanceMinor, currency)}
          </AppText>
          <View className='mt-3 gap-1'>
            <AppText size='sm'>
              Expected income{' '}
              <AppText style={{ color: c.income }}>
                +{formatMoney(forecast.expectedIncomeMinor, currency)}
              </AppText>
            </AppText>
            <AppText size='sm'>
              Expected expenses{' '}
              <AppText style={{ color: c.expense }}>
                −{formatMoney(forecast.expectedExpenseMinor, currency)}
              </AppText>
            </AppText>
            <AppText weight='semibold' className='mt-2'>
              Projected balance{' '}
              {formatMoney(forecast.projectedBalanceMinor, currency)}
            </AppText>
          </View>
        </Card>

        <AppText size='sm' muted weight='semibold' className='mt-6 mb-2'>
          UPCOMING ({forecast.events.length})
        </AppText>
        {forecast.events.length === 0 ? (
          <AppText muted>
            No scheduled items in the next {days} days. Add recurring templates
            or subscriptions.
          </AppText>
        ) : (
          forecast.events.slice(0, 40).map((e) => (
            <View
              key={`${e.source}-${e.label}-${e.date.toISOString()}-${e.amountMinor}`}
              className='flex-row items-center justify-between py-3'
              style={{ borderBottomWidth: 1, borderBottomColor: c.line }}
            >
              <View className='flex-1'>
                <AppText weight='medium'>{e.label}</AppText>
                <AppText size='sm' muted>
                  {format(e.date, 'MMM d')} · {e.source}
                </AppText>
              </View>
              <AppText
                weight='semibold'
                style={{ color: e.kind === 'income' ? c.income : c.expense }}
              >
                {e.kind === 'income' ? '+' : '−'}
                {formatMoney(e.amountMinor, currency)}
              </AppText>
            </View>
          ))
        )}
      </FormScroll>
    </Screen>
  );
}
