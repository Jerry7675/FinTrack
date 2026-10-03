import { addDays, startOfDay } from 'date-fns';

import type { Debt, RecurringTemplate, Subscription } from '@/lib/db/schema';
import {
  buildCashFlowForecast,
  groupEventsByDay,
  subscriptionAnnualMinor,
  subscriptionMonthlyMinor,
  whatIfGoalMonths,
  whatIfReduceSpend,
} from '@/lib/forecast';

describe('subscriptionMonthlyMinor', () => {
  it('calculates monthly equivalent for weekly subscriptions', () => {
    const sub: Subscription = {
      id: '1',
      accountId: 'acc1',
      categoryId: null,
      name: 'Test',
      amountMinor: 1000,
      currencyCode: 'USD',
      cadence: 'weekly',
      nextBillingAt: new Date(),
      note: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    expect(subscriptionMonthlyMinor(sub)).toBe(4333);
  });

  it('returns same amount for monthly subscriptions', () => {
    const sub: Subscription = {
      id: '1',
      accountId: 'acc1',
      categoryId: null,
      name: 'Test',
      amountMinor: 1000,
      currencyCode: 'USD',
      cadence: 'monthly',
      nextBillingAt: new Date(),
      note: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    expect(subscriptionMonthlyMinor(sub)).toBe(1000);
  });

  it('calculates monthly equivalent for yearly subscriptions', () => {
    const sub: Subscription = {
      id: '1',
      accountId: 'acc1',
      categoryId: null,
      name: 'Test',
      amountMinor: 12000,
      currencyCode: 'USD',
      cadence: 'yearly',
      nextBillingAt: new Date(),
      note: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    expect(subscriptionMonthlyMinor(sub)).toBe(1000);
  });
});

describe('subscriptionAnnualMinor', () => {
  it('calculates annual cost from monthly', () => {
    const sub: Subscription = {
      id: '1',
      accountId: 'acc1',
      categoryId: null,
      name: 'Test',
      amountMinor: 1000,
      currencyCode: 'USD',
      cadence: 'monthly',
      nextBillingAt: new Date(),
      note: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    expect(subscriptionAnnualMinor(sub)).toBe(12000);
  });
});

describe('buildCashFlowForecast', () => {
  const now = startOfDay(new Date());

  it('projects empty forecast with no items', () => {
    const forecast = buildCashFlowForecast({
      startingBalanceMinor: 10000,
      recurring: [],
      subscriptions: [],
      debts: [],
      from: now,
    });

    expect(forecast.startingBalanceMinor).toBe(10000);
    expect(forecast.expectedIncomeMinor).toBe(0);
    expect(forecast.expectedExpenseMinor).toBe(0);
    expect(forecast.projectedBalanceMinor).toBe(10000);
    expect(forecast.events).toHaveLength(0);
  });

  it('includes recurring income events', () => {
    const recurring: RecurringTemplate = {
      id: '1',
      accountId: 'acc1',
      categoryId: null,
      type: 'income',
      title: 'Salary',
      amountMinor: 500000,
      currencyCode: 'USD',
      cadence: 'monthly',
      intervalDays: null,
      nextDueAt: addDays(now, 5),
      note: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    const forecast = buildCashFlowForecast({
      startingBalanceMinor: 10000,
      recurring: [recurring],
      subscriptions: [],
      debts: [],
      from: now,
      days: 30,
    });

    expect(forecast.expectedIncomeMinor).toBe(500000);
    expect(forecast.expectedExpenseMinor).toBe(0);
    expect(forecast.projectedBalanceMinor).toBe(510000);
    expect(forecast.events.length).toBeGreaterThan(0);
    expect(forecast.events[0].kind).toBe('income');
  });

  it('includes subscription expense events', () => {
    const subscription: Subscription = {
      id: '1',
      accountId: 'acc1',
      categoryId: null,
      name: 'Netflix',
      amountMinor: 1500,
      currencyCode: 'USD',
      cadence: 'monthly',
      nextBillingAt: addDays(now, 10),
      note: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    const forecast = buildCashFlowForecast({
      startingBalanceMinor: 10000,
      recurring: [],
      subscriptions: [subscription],
      debts: [],
      from: now,
      days: 30,
    });

    expect(forecast.expectedIncomeMinor).toBe(0);
    expect(forecast.expectedExpenseMinor).toBe(1500);
    expect(forecast.projectedBalanceMinor).toBe(8500);
    expect(forecast.events[0].kind).toBe('expense');
  });

  it('includes debt due events', () => {
    const debt: Debt = {
      id: '1',
      accountId: 'acc1',
      name: 'Loan',
      kind: 'i_owe',
      principalMinor: 100000,
      remainingMinor: 50000,
      currencyCode: 'USD',
      counterparty: null,
      dueAt: addDays(now, 15),
      note: null,
      interestRate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    const forecast = buildCashFlowForecast({
      startingBalanceMinor: 10000,
      recurring: [],
      subscriptions: [],
      debts: [debt],
      from: now,
      days: 30,
    });

    expect(forecast.expectedExpenseMinor).toBe(50000);
    expect(forecast.projectedBalanceMinor).toBe(-40000);
    expect(forecast.events[0].source).toBe('debt');
  });

  it('handles mixed events and calculates correct totals', () => {
    const recurring: RecurringTemplate = {
      id: '1',
      accountId: 'acc1',
      categoryId: null,
      type: 'income',
      title: 'Salary',
      amountMinor: 300000,
      currencyCode: 'USD',
      cadence: 'monthly',
      intervalDays: null,
      nextDueAt: addDays(now, 5),
      note: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    const subscription: Subscription = {
      id: '2',
      accountId: 'acc1',
      categoryId: null,
      name: 'Netflix',
      amountMinor: 1500,
      currencyCode: 'USD',
      cadence: 'monthly',
      nextBillingAt: addDays(now, 10),
      note: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    const forecast = buildCashFlowForecast({
      startingBalanceMinor: 10000,
      recurring: [recurring],
      subscriptions: [subscription],
      debts: [],
      from: now,
      days: 30,
    });

    expect(forecast.expectedIncomeMinor).toBe(300000);
    expect(forecast.expectedExpenseMinor).toBe(1500);
    expect(forecast.projectedBalanceMinor).toBe(308500);
  });
});

describe('groupEventsByDay', () => {
  it('groups events by date', () => {
    const events = [
      {
        date: new Date('2024-01-15'),
        label: 'Event 1',
        amountMinor: 1000,
        kind: 'expense' as const,
        source: 'subscription' as const,
      },
      {
        date: new Date('2024-01-15'),
        label: 'Event 2',
        amountMinor: 2000,
        kind: 'income' as const,
        source: 'recurring' as const,
      },
      {
        date: new Date('2024-01-16'),
        label: 'Event 3',
        amountMinor: 3000,
        kind: 'expense' as const,
        source: 'debt' as const,
      },
    ];

    const grouped = groupEventsByDay(events);

    expect(grouped.size).toBe(2);
    expect(grouped.get('2024-01-15')).toHaveLength(2);
    expect(grouped.get('2024-01-16')).toHaveLength(1);
  });
});

describe('whatIfReduceSpend', () => {
  it('calculates spending reduction correctly', () => {
    const result = whatIfReduceSpend(100000, 20);

    expect(result.monthlySavingMinor).toBe(20000);
    expect(result.annualSavingMinor).toBe(240000);
    expect(result.newMonthlySpendMinor).toBe(80000);
  });

  it('handles 0% reduction', () => {
    const result = whatIfReduceSpend(100000, 0);

    expect(result.monthlySavingMinor).toBe(0);
    expect(result.annualSavingMinor).toBe(0);
    expect(result.newMonthlySpendMinor).toBe(100000);
  });

  it('handles 100% reduction', () => {
    const result = whatIfReduceSpend(100000, 100);

    expect(result.monthlySavingMinor).toBe(100000);
    expect(result.annualSavingMinor).toBe(1200000);
    expect(result.newMonthlySpendMinor).toBe(0);
  });

  it('clamps percentage to 0-100 range', () => {
    const resultNegative = whatIfReduceSpend(100000, -10);
    expect(resultNegative.monthlySavingMinor).toBe(0);

    const resultOver100 = whatIfReduceSpend(100000, 150);
    expect(resultOver100.monthlySavingMinor).toBe(100000);
  });
});

describe('whatIfGoalMonths', () => {
  it('calculates months to goal completion', () => {
    const months = whatIfGoalMonths(100000, 10000);
    expect(months).toBe(10);
  });

  it('rounds up partial months', () => {
    const months = whatIfGoalMonths(100000, 15000);
    expect(months).toBe(7);
  });

  it('returns null for zero contribution', () => {
    const months = whatIfGoalMonths(100000, 0);
    expect(months).toBeNull();
  });

  it('returns null for negative contribution', () => {
    const months = whatIfGoalMonths(100000, -1000);
    expect(months).toBeNull();
  });

  it('handles exact division', () => {
    const months = whatIfGoalMonths(120000, 10000);
    expect(months).toBe(12);
  });
});
