import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  endOfYear,
  nextDay,
  setDate,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';

export type BudgetPeriod = 'weekly' | 'monthly' | 'yearly';
export type RecurringCadence =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'custom';

export type SubscriptionCadence = 'weekly' | 'monthly' | 'yearly';

export function budgetPeriodBounds(period: BudgetPeriod, now = new Date()) {
  if (period === 'weekly') {
    return {
      from: startOfWeek(now, { weekStartsOn: 1 }),
      to: endOfWeek(now, { weekStartsOn: 1 }),
    };
  }
  if (period === 'yearly') {
    return { from: startOfYear(now), to: endOfYear(now) };
  }
  return { from: startOfMonth(now), to: endOfMonth(now) };
}

export function budgetDaysRemaining(period: BudgetPeriod, now = new Date()) {
  const { to } = budgetPeriodBounds(period, now);
  return Math.max(0, differenceInCalendarDays(to, now) + 1);
}

export type BudgetStatus = 'healthy' | 'approaching' | 'exceeded';

export function budgetStatus(
  spentMinor: number,
  limitMinor: number
): BudgetStatus {
  if (limitMinor <= 0) return 'healthy';
  const ratio = spentMinor / limitMinor;
  if (ratio >= 1) return 'exceeded';
  if (ratio >= 0.8) return 'approaching';
  return 'healthy';
}

export function suggestedDailyLimit(
  remainingMinor: number,
  daysLeft: number
): number {
  if (daysLeft <= 0) return 0;
  return Math.max(0, Math.floor(remainingMinor / daysLeft));
}

/**
 * Compute next due date from cadence + optional intervalDays rule.
 * - weekly: intervalDays is weekday 0–6 (Sun–Sat)
 * - monthly: intervalDays is day-of-month 1–28
 * - custom: intervalDays is every N days
 */
export function computeNextDueAt(
  cadence: RecurringCadence,
  intervalDays: number | null | undefined,
  from = new Date()
): Date {
  const base = startOfDay(from);

  if (cadence === 'daily') {
    return addDays(base, 1);
  }

  if (cadence === 'weekly') {
    const raw = intervalDays ?? base.getDay();
    const weekday = Math.min(6, Math.max(0, Math.trunc(raw))) as
      | 0
      | 1
      | 2
      | 3
      | 4
      | 5
      | 6;
    return nextDay(base, weekday);
  }

  if (cadence === 'monthly') {
    const day = Math.min(Math.max(intervalDays ?? base.getDate(), 1), 28);
    let candidate = setDate(base, day);
    if (candidate.getTime() <= base.getTime()) {
      candidate = setDate(addMonths(base, 1), day);
    }
    return candidate;
  }

  if (cadence === 'yearly') {
    return addYears(base, 1);
  }

  const n = Math.max(1, intervalDays ?? 1);
  return addDays(base, n);
}

/**
 * Advance an occurrence date by one cadence step (calendar-aware).
 * Used by forecasts so projections match create/edit due-date math.
 */
export function advanceByCadence(
  from: Date,
  cadence: RecurringCadence | SubscriptionCadence,
  intervalDays?: number | null
): Date {
  const base = startOfDay(from);
  if (cadence === 'daily') return addDays(base, 1);
  if (cadence === 'weekly') return addWeeks(base, 1);
  if (cadence === 'monthly') {
    const day = Math.min(Math.max(intervalDays ?? base.getDate(), 1), 28);
    return setDate(addMonths(base, 1), day);
  }
  if (cadence === 'yearly') return addYears(base, 1);
  return addDays(base, Math.max(1, intervalDays ?? 1));
}

export function goalSuggestedMonthly(
  remainingMinor: number,
  deadlineAt: Date | null | undefined,
  now = new Date()
): number | null {
  if (!deadlineAt) return null;
  const days = differenceInCalendarDays(deadlineAt, now);
  if (days <= 0) return remainingMinor;
  const months = Math.max(1, days / 30.44);
  return Math.ceil(remainingMinor / months);
}
