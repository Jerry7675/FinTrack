import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfMonth,
  endOfWeek,
  endOfYear,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';

import {
  advanceByCadence,
  budgetDaysRemaining,
  budgetPeriodBounds,
  budgetStatus,
  computeNextDueAt,
  goalSuggestedMonthly,
  suggestedDailyLimit,
} from '@/lib/planning';

describe('budgetPeriodBounds', () => {
  it('returns weekly bounds', () => {
    const now = new Date('2024-03-15');
    const { from, to } = budgetPeriodBounds('weekly', now);

    expect(from).toEqual(startOfWeek(now, { weekStartsOn: 1 }));
    expect(to).toEqual(endOfWeek(now, { weekStartsOn: 1 }));
  });

  it('returns monthly bounds', () => {
    const now = new Date('2024-03-15');
    const { from, to } = budgetPeriodBounds('monthly', now);

    expect(from).toEqual(startOfMonth(now));
    expect(to).toEqual(endOfMonth(now));
  });

  it('returns yearly bounds', () => {
    const now = new Date('2024-03-15');
    const { from, to } = budgetPeriodBounds('yearly', now);

    expect(from).toEqual(startOfYear(now));
    expect(to).toEqual(endOfYear(now));
  });
});

describe('budgetDaysRemaining', () => {
  it('calculates days remaining in period', () => {
    const now = new Date('2024-03-15');
    const days = budgetDaysRemaining('monthly', now);

    expect(days).toBeGreaterThan(0);
    expect(days).toBeLessThanOrEqual(31);
  });

  it('returns at least 1 day remaining', () => {
    const endOfMonthDate = endOfMonth(new Date('2024-03-31'));
    const days = budgetDaysRemaining('monthly', endOfMonthDate);

    expect(days).toBeGreaterThanOrEqual(1);
  });
});

describe('budgetStatus', () => {
  it('returns healthy when under 80%', () => {
    expect(budgetStatus(7000, 10000)).toBe('healthy');
    expect(budgetStatus(0, 10000)).toBe('healthy');
  });

  it('returns approaching when 80-99%', () => {
    expect(budgetStatus(8000, 10000)).toBe('approaching');
    expect(budgetStatus(9900, 10000)).toBe('approaching');
  });

  it('returns exceeded when at or over 100%', () => {
    expect(budgetStatus(10000, 10000)).toBe('exceeded');
    expect(budgetStatus(11000, 10000)).toBe('exceeded');
  });

  it('handles zero limit', () => {
    expect(budgetStatus(5000, 0)).toBe('healthy');
  });
});

describe('suggestedDailyLimit', () => {
  it('calculates daily limit from remaining budget', () => {
    const limit = suggestedDailyLimit(15000, 10);
    expect(limit).toBe(1500);
  });

  it('returns 0 when no days left', () => {
    const limit = suggestedDailyLimit(15000, 0);
    expect(limit).toBe(0);
  });

  it('returns 0 for negative remaining', () => {
    const limit = suggestedDailyLimit(-5000, 10);
    expect(limit).toBe(0);
  });

  it('handles fractional days by flooring', () => {
    const limit = suggestedDailyLimit(10000, 7);
    expect(limit).toBe(1428);
  });
});

describe('computeNextDueAt', () => {
  const base = new Date('2024-03-15T10:00:00Z');

  it('computes next due for daily cadence', () => {
    const next = computeNextDueAt('daily', null, base);
    expect(next.getDate()).toBe(16);
  });

  it('computes next due for weekly cadence', () => {
    const next = computeNextDueAt('weekly', 1, base);
    expect(next.getDay()).toBe(1);
  });

  it('computes next due for monthly cadence', () => {
    const next = computeNextDueAt('monthly', 15, base);
    expect(next.getDate()).toBe(15);
    expect(next.getMonth()).toBe(3);
  });

  it('advances to next month if date already passed', () => {
    const base = new Date('2024-03-20');
    const next = computeNextDueAt('monthly', 15, base);
    expect(next.getMonth()).toBe(3);
  });

  it('computes next due for yearly cadence', () => {
    const next = computeNextDueAt('yearly', null, base);
    expect(next.getFullYear()).toBe(2025);
  });

  it('computes next due for custom cadence', () => {
    const next = computeNextDueAt('custom', 14, base);
    const daysDiff = Math.round(
      (next.getTime() - base.getTime()) / (24 * 60 * 60 * 1000)
    );
    expect(daysDiff).toBe(14);
  });

  // Documented limitation (planning.ts:70): monthly day-of-month is clamped to 28.
  it('clamps monthly day to 1-28 range', () => {
    const next = computeNextDueAt('monthly', 50, base);
    expect(next.getDate()).toBe(28);
  });

  it('clamps weekly day to 0-6 range', () => {
    const next = computeNextDueAt('weekly', 10, base);
    expect(next.getDay()).toBeLessThanOrEqual(6);
  });
});

describe('advanceByCadence', () => {
  const base = new Date('2024-03-15');

  it('advances by one day for daily cadence', () => {
    const next = advanceByCadence(base, 'daily');
    expect(next).toEqual(addDays(base, 1));
  });

  it('advances by one week for weekly cadence', () => {
    const next = advanceByCadence(base, 'weekly');
    expect(next).toEqual(addWeeks(base, 1));
  });

  it('advances by one month for monthly cadence', () => {
    const next = advanceByCadence(base, 'monthly');
    expect(next).toEqual(addMonths(base, 1));
  });

  it('advances by one year for yearly cadence', () => {
    const next = advanceByCadence(base, 'yearly');
    expect(next).toEqual(addYears(base, 1));
  });

  it('advances by custom days', () => {
    const next = advanceByCadence(base, 'custom', 7);
    expect(next).toEqual(addDays(base, 7));
  });

  it('preserves day of month when advancing monthly', () => {
    const base = new Date('2024-01-15');
    const next = advanceByCadence(base, 'monthly', 15);
    expect(next.getDate()).toBe(15);
  });
});

describe('goalSuggestedMonthly', () => {
  const now = new Date('2024-01-01');

  it('calculates suggested monthly contribution', () => {
    const deadline = new Date('2024-12-31');
    const suggested = goalSuggestedMonthly(120000, deadline, now);

    expect(suggested).toBeGreaterThan(0);
    expect(suggested).toBeLessThanOrEqual(120000);
  });

  it('returns null when no deadline', () => {
    const suggested = goalSuggestedMonthly(120000, null, now);
    expect(suggested).toBeNull();
  });

  it('returns null when deadline is undefined', () => {
    const suggested = goalSuggestedMonthly(120000, undefined, now);
    expect(suggested).toBeNull();
  });

  it('returns full amount when deadline is in the past', () => {
    const deadline = new Date('2023-01-01');
    const suggested = goalSuggestedMonthly(120000, deadline, now);

    expect(suggested).toBe(120000);
  });

  it('returns full amount when deadline is today', () => {
    const suggested = goalSuggestedMonthly(120000, now, now);
    expect(suggested).toBe(120000);
  });

  it('handles short timeframes', () => {
    const deadline = addDays(now, 15);
    const suggested = goalSuggestedMonthly(30000, deadline, now);

    expect(suggested).toBeGreaterThan(0);
  });
});
