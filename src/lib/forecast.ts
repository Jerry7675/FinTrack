import { addDays, format, startOfDay } from 'date-fns';

import type { Debt, RecurringTemplate, Subscription } from '@/lib/db/schema';

export type ForecastEvent = {
  date: Date;
  label: string;
  amountMinor: number;
  kind: 'income' | 'expense';
  source: 'recurring' | 'subscription' | 'debt';
};

export type CashFlowForecast = {
  days: number;
  startingBalanceMinor: number;
  expectedIncomeMinor: number;
  expectedExpenseMinor: number;
  projectedBalanceMinor: number;
  events: ForecastEvent[];
};

function monthlyEquivalent(
  amountMinor: number,
  cadence: 'weekly' | 'monthly' | 'yearly' | 'daily' | 'custom',
  intervalDays?: number | null
): number {
  if (cadence === 'weekly') return (amountMinor * 52) / 12;
  if (cadence === 'yearly') return amountMinor / 12;
  if (cadence === 'daily') return amountMinor * 30.44;
  if (cadence === 'custom') {
    const n = Math.max(1, intervalDays ?? 1);
    return (amountMinor * 30.44) / n;
  }
  return amountMinor;
}

export function subscriptionMonthlyMinor(s: Subscription): number {
  return Math.round(monthlyEquivalent(s.amountMinor, s.cadence));
}

export function subscriptionAnnualMinor(s: Subscription): number {
  return Math.round(subscriptionMonthlyMinor(s) * 12);
}

/** Project cash flow from recurring templates, subscriptions, and debt dues. */
export function buildCashFlowForecast(input: {
  startingBalanceMinor: number;
  days?: number;
  recurring: RecurringTemplate[];
  subscriptions: Subscription[];
  debts: Debt[];
  from?: Date;
}): CashFlowForecast {
  const days = input.days ?? 30;
  const from = startOfDay(input.from ?? new Date());
  const until = addDays(from, days);
  const events: ForecastEvent[] = [];

  for (const r of input.recurring) {
    let cursor = startOfDay(r.nextDueAt);
    let guard = 0;
    while (cursor.getTime() < until.getTime() && guard < 60) {
      if (cursor.getTime() >= from.getTime()) {
        events.push({
          date: cursor,
          label: r.title,
          amountMinor: r.amountMinor,
          kind: r.type === 'income' ? 'income' : 'expense',
          source: 'recurring',
        });
      }
      if (r.cadence === 'daily') cursor = addDays(cursor, 1);
      else if (r.cadence === 'weekly') cursor = addDays(cursor, 7);
      else if (r.cadence === 'monthly') cursor = addDays(cursor, 30);
      else if (r.cadence === 'yearly') cursor = addDays(cursor, 365);
      else cursor = addDays(cursor, Math.max(1, r.intervalDays ?? 1));
      guard += 1;
    }
  }

  for (const s of input.subscriptions) {
    let cursor = startOfDay(s.nextBillingAt);
    let guard = 0;
    while (cursor.getTime() < until.getTime() && guard < 24) {
      if (cursor.getTime() >= from.getTime()) {
        events.push({
          date: cursor,
          label: s.name,
          amountMinor: s.amountMinor,
          kind: 'expense',
          source: 'subscription',
        });
      }
      if (s.cadence === 'weekly') cursor = addDays(cursor, 7);
      else if (s.cadence === 'yearly') cursor = addDays(cursor, 365);
      else cursor = addDays(cursor, 30);
      guard += 1;
    }
  }

  for (const d of input.debts) {
    if (!d.dueAt) continue;
    const due = startOfDay(d.dueAt);
    if (due.getTime() >= from.getTime() && due.getTime() < until.getTime()) {
      events.push({
        date: due,
        label: d.name,
        amountMinor: d.remainingMinor,
        kind: d.kind === 'i_owe' ? 'expense' : 'income',
        source: 'debt',
      });
    }
  }

  events.sort((a, b) => a.date.getTime() - b.date.getTime());

  let expectedIncomeMinor = 0;
  let expectedExpenseMinor = 0;
  for (const e of events) {
    if (e.kind === 'income') expectedIncomeMinor += e.amountMinor;
    else expectedExpenseMinor += e.amountMinor;
  }

  return {
    days,
    startingBalanceMinor: input.startingBalanceMinor,
    expectedIncomeMinor,
    expectedExpenseMinor,
    projectedBalanceMinor:
      input.startingBalanceMinor + expectedIncomeMinor - expectedExpenseMinor,
    events,
  };
}

export function groupEventsByDay(events: ForecastEvent[]) {
  const map = new Map<string, ForecastEvent[]>();
  for (const e of events) {
    const key = format(e.date, 'yyyy-MM-dd');
    const list = map.get(key) ?? [];
    list.push(e);
    map.set(key, list);
  }
  return map;
}

/** What-if: reduce a monthly spend by percent. */
export function whatIfReduceSpend(
  monthlySpendMinor: number,
  reducePct: number
) {
  const pct = Math.max(0, Math.min(100, reducePct)) / 100;
  const monthlySaving = Math.round(monthlySpendMinor * pct);
  return {
    monthlySavingMinor: monthlySaving,
    annualSavingMinor: monthlySaving * 12,
    newMonthlySpendMinor: monthlySpendMinor - monthlySaving,
  };
}

/** What-if: goal completion months at a contribution rate. */
export function whatIfGoalMonths(
  remainingMinor: number,
  monthlyContributionMinor: number
): number | null {
  if (monthlyContributionMinor <= 0) return null;
  return Math.ceil(remainingMinor / monthlyContributionMinor);
}
