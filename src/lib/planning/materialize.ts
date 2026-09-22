import { startOfDay } from 'date-fns';

import type { AppDatabase } from '@/lib/db/client';
import {
  createTransaction,
  getBudgetSpend,
  hasSourceTransactionOnDay,
  listBudgets,
  listRecurring,
  listSubscriptions,
  setRecurringNextDue,
  setSubscriptionNextBilling,
} from '@/lib/db/queries';
import type { RecurringTemplate, Subscription } from '@/lib/db/schema';
import { fromMinorUnits } from '@/lib/money';
import { advanceByCadence, budgetStatus } from '@/lib/planning';

const MAX_STEPS_PER_ITEM = 36;

export type PostedPlanningItem = {
  title: string;
  amountMinor: number;
  type: 'expense' | 'income';
  currencyCode: string;
  categoryId: string | null;
  sourceType: 'recurring' | 'subscription';
  sourceId: string;
};

export type BudgetPulseAlert = {
  name: string;
  ratio: number;
  status: 'approaching' | 'exceeded';
};

export type MaterializeResult = {
  posted: PostedPlanningItem[];
  budgetAlerts: BudgetPulseAlert[];
};

async function postRecurringOccurrence(
  database: AppDatabase,
  template: RecurringTemplate,
  occurredAt: Date
): Promise<PostedPlanningItem | null> {
  const day = startOfDay(occurredAt);
  if (
    await hasSourceTransactionOnDay(database, 'recurring', template.id, day)
  ) {
    await setRecurringNextDue(
      database,
      template.id,
      advanceByCadence(day, template.cadence, template.intervalDays)
    );
    return null;
  }

  await createTransaction(database, {
    accountId: template.accountId,
    categoryId: template.categoryId,
    type: template.type,
    amount: fromMinorUnits(template.amountMinor, template.currencyCode),
    currencyCode: template.currencyCode,
    title: template.title,
    note: template.note ?? undefined,
    occurredAt: day,
    sourceType: 'recurring',
    sourceId: template.id,
  });

  await setRecurringNextDue(
    database,
    template.id,
    advanceByCadence(day, template.cadence, template.intervalDays)
  );

  return {
    title: template.title,
    amountMinor: template.amountMinor,
    type: template.type,
    currencyCode: template.currencyCode,
    categoryId: template.categoryId,
    sourceType: 'recurring',
    sourceId: template.id,
  };
}

async function postSubscriptionOccurrence(
  database: AppDatabase,
  sub: Subscription,
  occurredAt: Date
): Promise<PostedPlanningItem | null> {
  const day = startOfDay(occurredAt);
  if (await hasSourceTransactionOnDay(database, 'subscription', sub.id, day)) {
    await setSubscriptionNextBilling(
      database,
      sub.id,
      advanceByCadence(day, sub.cadence)
    );
    return null;
  }

  await createTransaction(database, {
    accountId: sub.accountId,
    categoryId: sub.categoryId,
    type: 'expense',
    amount: fromMinorUnits(sub.amountMinor, sub.currencyCode),
    currencyCode: sub.currencyCode,
    title: sub.name,
    note: sub.note ?? undefined,
    occurredAt: day,
    sourceType: 'subscription',
    sourceId: sub.id,
  });

  await setSubscriptionNextBilling(
    database,
    sub.id,
    advanceByCadence(day, sub.cadence)
  );

  return {
    title: sub.name,
    amountMinor: sub.amountMinor,
    type: 'expense',
    currencyCode: sub.currencyCode,
    categoryId: sub.categoryId,
    sourceType: 'subscription',
    sourceId: sub.id,
  };
}

async function collectBudgetAlerts(
  database: AppDatabase,
  posted: PostedPlanningItem[]
): Promise<BudgetPulseAlert[]> {
  const expensePosts = posted.filter(
    (p) => p.type === 'expense' && p.categoryId
  );
  if (!expensePosts.length) return [];

  const budgets = await listBudgets(database);
  const alerts: BudgetPulseAlert[] = [];
  const seen = new Set<string>();

  for (const post of expensePosts) {
    const matches = budgets.filter((b) => b.categoryId === post.categoryId);
    for (const budget of matches) {
      if (seen.has(budget.id)) continue;
      const spent = await getBudgetSpend(database, {
        categoryId: budget.categoryId,
        accountId: budget.accountId,
        period: budget.period,
      });
      const status = budgetStatus(spent, budget.amountMinor);
      if (status === 'healthy') continue;
      seen.add(budget.id);
      alerts.push({
        name: budget.name,
        ratio: budget.amountMinor > 0 ? spent / budget.amountMinor : 1,
        status,
      });
    }
  }

  return alerts;
}

/**
 * Posts all recurring templates and subscriptions whose due date is on or
 * before `now`, advancing each due date. Caps steps per item to avoid runaway.
 */
export async function materializeDuePlanning(
  database: AppDatabase,
  now = new Date()
): Promise<MaterializeResult> {
  const today = startOfDay(now);
  const posted: PostedPlanningItem[] = [];

  const templates = await listRecurring(database);
  for (const template of templates) {
    let steps = 0;
    let due = startOfDay(template.nextDueAt);
    while (due.getTime() <= today.getTime() && steps < MAX_STEPS_PER_ITEM) {
      const item = await postRecurringOccurrence(database, template, due);
      if (item) posted.push(item);
      steps += 1;
      due = advanceByCadence(due, template.cadence, template.intervalDays);
    }
  }

  const subs = await listSubscriptions(database);
  for (const sub of subs) {
    let steps = 0;
    let due = startOfDay(sub.nextBillingAt);
    while (due.getTime() <= today.getTime() && steps < MAX_STEPS_PER_ITEM) {
      const item = await postSubscriptionOccurrence(database, sub, due);
      if (item) posted.push(item);
      steps += 1;
      due = advanceByCadence(due, sub.cadence);
    }
  }

  const budgetAlerts = await collectBudgetAlerts(database, posted);
  return { posted, budgetAlerts };
}

/** Ensure a newly created recurring/subscription posts today's charge. */
export async function materializeNewPlanningItem(
  database: AppDatabase,
  kind: 'recurring' | 'subscription',
  id: string,
  now = new Date()
): Promise<MaterializeResult> {
  const today = startOfDay(now);
  const posted: PostedPlanningItem[] = [];

  if (kind === 'recurring') {
    const [template] = (await listRecurring(database)).filter(
      (t) => t.id === id
    );
    if (template) {
      const item = await postRecurringOccurrence(database, template, today);
      if (item) posted.push(item);
    }
  } else {
    const [sub] = (await listSubscriptions(database)).filter(
      (s) => s.id === id
    );
    if (sub) {
      const item = await postSubscriptionOccurrence(database, sub, today);
      if (item) posted.push(item);
    }
  }

  const budgetAlerts = await collectBudgetAlerts(database, posted);
  return { posted, budgetAlerts };
}

/** Upcoming planning items for the home rail (due within N days). */
export async function listUpcomingPlanning(
  database: AppDatabase,
  withinDays = 7,
  now = new Date()
) {
  const today = startOfDay(now);
  const horizon = today.getTime() + withinDays * 24 * 60 * 60 * 1000;
  const templates = await listRecurring(database);
  const subs = await listSubscriptions(database);

  const items: {
    id: string;
    kind: 'recurring' | 'subscription';
    title: string;
    amountMinor: number;
    currencyCode: string;
    type: 'expense' | 'income';
    dueAt: Date;
  }[] = [];

  for (const t of templates) {
    if (t.nextDueAt.getTime() <= horizon) {
      items.push({
        id: t.id,
        kind: 'recurring',
        title: t.title,
        amountMinor: t.amountMinor,
        currencyCode: t.currencyCode,
        type: t.type,
        dueAt: t.nextDueAt,
      });
    }
  }
  for (const s of subs) {
    if (s.nextBillingAt.getTime() <= horizon) {
      items.push({
        id: s.id,
        kind: 'subscription',
        title: s.name,
        amountMinor: s.amountMinor,
        currencyCode: s.currencyCode,
        type: 'expense',
        dueAt: s.nextBillingAt,
      });
    }
  }

  items.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  return items;
}
