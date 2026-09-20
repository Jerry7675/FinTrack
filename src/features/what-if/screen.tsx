import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import {
  AppText,
  Card,
  Field,
  FormScroll,
  Screen,
  ScreenHeader,
  Select,
  useThemeColors,
} from '@/components/ui/primitives';
import { db } from '@/lib/db/client';
import { listGoals, listTransactions } from '@/lib/db/queries';
import type { Goal } from '@/lib/db/schema';
import { whatIfGoalMonths, whatIfReduceSpend } from '@/lib/forecast';
import { layout } from '@/lib/layout';
import { formatMoney, fromMinorUnits, toMinorUnits } from '@/lib/money';
import { useApp } from '@/providers/app-provider';

export function WhatIfScreen() {
  const { settings, accounts } = useApp();
  const c = useThemeColors();
  const [monthlySpend, setMonthlySpend] = useState(0);
  const [reducePct, setReducePct] = useState('20');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalId, setGoalId] = useState('');
  const [contribution, setContribution] = useState('5000');

  const currency = settings?.defaultCurrency ?? 'USD';
  const account = accounts.find((a) => a.id === settings?.activeAccountId);

  const load = useCallback(async () => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const rows = await listTransactions(db, {
      accountId: account?.id,
      type: 'expense',
      from,
      to: now,
      limit: 2000,
    });
    const spent = rows.reduce((s, r) => s + r.transaction.amountMinor, 0);
    setMonthlySpend(spent);
    const g = await listGoals(db);
    setGoals(g);
    setGoalId((prev) => prev || g[0]?.id || '');
  }, [account?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const pct = Number.parseFloat(reducePct) || 0;
  const spendScenario = whatIfReduceSpend(monthlySpend, pct);

  const goal = goals.find((g) => g.id === goalId);
  const contribMajor = Number.parseFloat(contribution) || 0;
  const contribMinor = toMinorUnits(contribMajor, currency);
  const remaining = goal
    ? Math.max(0, goal.targetMinor - goal.currentMinor)
    : 0;
  const months = whatIfGoalMonths(remaining, contribMinor);

  const goalOptions = useMemo(
    () => goals.map((g) => ({ label: g.name, value: g.id })),
    [goals]
  );

  return (
    <Screen>
      <FormScroll contentContainerStyle={{ paddingHorizontal: layout.gutter }}>
        <ScreenHeader title='What-if' />
        <AppText muted className='mt-1'>
          Explore scenarios without changing your real data.
        </AppText>

        <Card className='mt-4'>
          <AppText weight='semibold'>Spending cut</AppText>
          <AppText size='sm' muted className='mt-1'>
            This month so far:{' '}
            {formatMoney(monthlySpend, account?.currencyCode ?? currency)}
          </AppText>
          <View className='mt-3'>
            <Field
              label='Reduce by %'
              value={reducePct}
              onChangeText={setReducePct}
              keyboardType='decimal-pad'
            />
          </View>
          <AppText className='mt-3' style={{ color: c.income }}>
            Potential monthly saving{' '}
            {formatMoney(
              spendScenario.monthlySavingMinor,
              account?.currencyCode ?? currency
            )}
          </AppText>
          <AppText size='sm' muted>
            Annual ≈{' '}
            {formatMoney(
              spendScenario.annualSavingMinor,
              account?.currencyCode ?? currency
            )}
          </AppText>
          <AppText size='sm' muted className='mt-1'>
            New monthly pace ≈{' '}
            {formatMoney(
              spendScenario.newMonthlySpendMinor,
              account?.currencyCode ?? currency
            )}
          </AppText>
        </Card>

        <Card className='mt-4'>
          <AppText weight='semibold'>Goal contribution</AppText>
          {goalOptions.length ? (
            <>
              <View className='mt-3'>
                <Select
                  label='Goal'
                  value={goalId}
                  onChange={setGoalId}
                  options={goalOptions}
                />
              </View>
              <View className='mt-3'>
                <Field
                  label='Monthly contribution'
                  value={contribution}
                  onChangeText={setContribution}
                  keyboardType='decimal-pad'
                />
              </View>
              {goal ? (
                <AppText size='sm' muted className='mt-3'>
                  Remaining {formatMoney(remaining, goal.currencyCode)} of{' '}
                  {formatMoney(goal.targetMinor, goal.currencyCode)}
                </AppText>
              ) : null}
              <AppText className='mt-2' style={{ color: c.accent }}>
                {months == null
                  ? 'Enter a positive contribution'
                  : months === 0
                    ? 'Already complete'
                    : `Estimated completion in about ${months} month${months === 1 ? '' : 's'}`}
              </AppText>
              {goal && contribMajor > 0 ? (
                <AppText size='xs' muted className='mt-1'>
                  At {formatMoney(contribMinor, goal.currencyCode)}/mo from{' '}
                  {fromMinorUnits(remaining, goal.currencyCode)} left
                </AppText>
              ) : null}
            </>
          ) : (
            <AppText muted className='mt-2'>
              Create a goal first to simulate contributions.
            </AppText>
          )}
        </Card>
      </FormScroll>
    </Screen>
  );
}
