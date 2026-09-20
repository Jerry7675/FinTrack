import { startOfMonth, startOfWeek, startOfYear } from 'date-fns';
import { and, desc, eq, gte, isNull, like, lte, or, sql } from 'drizzle-orm';

import { createId } from '@/lib/id';
import { toMinorUnits } from '@/lib/money';
import { transactionInputSchema } from '@/lib/validation';

import type { AppDatabase } from './client';
import {
  accountGroups,
  accounts,
  budgets,
  categories,
  debts,
  goals,
  recurringTemplates,
  settings,
  subscriptions,
  tags,
  transactionAttachments,
  transactions,
  transactionTags,
} from './schema';

export async function listGroups(database: AppDatabase) {
  return database
    .select()
    .from(accountGroups)
    .where(isNull(accountGroups.deletedAt))
    .orderBy(accountGroups.sortOrder, accountGroups.name);
}

export async function listAccounts(
  database: AppDatabase,
  groupId?: string | null
) {
  const conditions = [isNull(accounts.deletedAt)];
  if (groupId) conditions.push(eq(accounts.groupId, groupId));
  return database
    .select()
    .from(accounts)
    .where(and(...conditions))
    .orderBy(accounts.sortOrder, accounts.name);
}

export async function createGroup(
  database: AppDatabase,
  input: { name: string; icon?: string }
) {
  const id = createId();
  await database.insert(accountGroups).values({
    id,
    name: input.name.trim(),
    icon: input.icon ?? 'business',
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id;
}

export async function createAccount(
  database: AppDatabase,
  input: {
    groupId: string;
    name: string;
    currencyCode: string;
    type?: 'cash' | 'bank' | 'wallet' | 'credit' | 'other';
  }
) {
  const id = createId();
  await database.insert(accounts).values({
    id,
    groupId: input.groupId,
    name: input.name.trim(),
    currencyCode: input.currencyCode,
    type: input.type ?? 'cash',
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id;
}

export async function softDeleteGroup(database: AppDatabase, id: string) {
  const now = new Date();
  await database
    .update(accountGroups)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(accountGroups.id, id));
  const ledgers = await database
    .select()
    .from(accounts)
    .where(and(eq(accounts.groupId, id), isNull(accounts.deletedAt)));
  for (const ledger of ledgers) {
    await softDeleteAccount(database, ledger.id);
  }
}

export async function softDeleteAccount(database: AppDatabase, id: string) {
  const now = new Date();
  await database
    .update(accounts)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(accounts.id, id));
}

export async function updateAccount(
  database: AppDatabase,
  id: string,
  patch: Partial<{
    name: string;
    currencyCode: string;
    type: 'cash' | 'bank' | 'wallet' | 'credit' | 'other';
    groupId: string;
  }>
) {
  await database
    .update(accounts)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(accounts.id, id));
}

export async function updateGroup(
  database: AppDatabase,
  id: string,
  patch: Partial<{ name: string; icon: string }>
) {
  await database
    .update(accountGroups)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(accountGroups.id, id));
}

export async function getAccountBalance(
  database: AppDatabase,
  accountId: string
): Promise<number> {
  const rows = await database
    .select({
      balance: sql<number>`coalesce(sum(
        case
          when ${transactions.type} = 'income' then ${transactions.amountMinor}
          when ${transactions.type} = 'expense' then -${transactions.amountMinor}
          else ${transactions.amountMinor}
        end
      ), 0)`,
    })
    .from(transactions)
    .where(
      and(eq(transactions.accountId, accountId), isNull(transactions.deletedAt))
    );
  return Number(rows[0]?.balance ?? 0);
}

export async function listCategories(
  database: AppDatabase,
  kind?: 'expense' | 'income'
) {
  const conditions = [isNull(categories.deletedAt)];
  if (kind) conditions.push(eq(categories.kind, kind));
  return database
    .select()
    .from(categories)
    .where(and(...conditions))
    .orderBy(categories.sortOrder, categories.name);
}

export type TransactionFilters = {
  accountId?: string | null;
  groupId?: string | null;
  query?: string;
  type?: 'expense' | 'income' | 'transfer' | null;
  categoryId?: string | null;
  tagId?: string | null;
  from?: Date | null;
  to?: Date | null;
  limit?: number;
};

export async function listTransactions(
  database: AppDatabase,
  filters: TransactionFilters = {}
) {
  const conditions = [isNull(transactions.deletedAt)];

  if (filters.accountId) {
    conditions.push(eq(transactions.accountId, filters.accountId));
  }
  if (filters.groupId) {
    const groupAccounts = await listAccounts(database, filters.groupId);
    const ids = groupAccounts.map((a) => a.id);
    if (ids.length === 0) return [];
    conditions.push(
      sql`${transactions.accountId} in (${sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `
      )})`
    );
  }
  if (filters.type) conditions.push(eq(transactions.type, filters.type));
  if (filters.categoryId) {
    conditions.push(eq(transactions.categoryId, filters.categoryId));
  }
  if (filters.from) conditions.push(gte(transactions.occurredAt, filters.from));
  if (filters.to) conditions.push(lte(transactions.occurredAt, filters.to));
  if (filters.query?.trim()) {
    const q = `%${filters.query.trim()}%`;
    const titleOrNote = or(
      like(transactions.title, q),
      like(transactions.note, q)
    );
    if (titleOrNote) conditions.push(titleOrNote);
  }

  let rows = await database
    .select({
      transaction: transactions,
      category: categories,
      account: accounts,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(and(...conditions))
    .orderBy(desc(transactions.occurredAt))
    .limit(filters.limit ?? 200);

  if (filters.tagId) {
    const tagged = await database
      .select()
      .from(transactionTags)
      .where(eq(transactionTags.tagId, filters.tagId));
    const set = new Set(tagged.map((t) => t.transactionId));
    rows = rows.filter((r) => set.has(r.transaction.id));
  }

  if (filters.query?.trim()) {
    const q = filters.query.trim().toLowerCase();
    const allTags = await database.select().from(tags);
    const tagMatches = new Set(
      allTags.filter((t) => t.name.toLowerCase().includes(q)).map((t) => t.id)
    );
    if (tagMatches.size > 0) {
      const links = await database.select().from(transactionTags);
      const txIds = new Set(
        links.filter((l) => tagMatches.has(l.tagId)).map((l) => l.transactionId)
      );
      if (txIds.size > 0) {
        const extra = await database
          .select({
            transaction: transactions,
            category: categories,
            account: accounts,
          })
          .from(transactions)
          .leftJoin(categories, eq(transactions.categoryId, categories.id))
          .innerJoin(accounts, eq(transactions.accountId, accounts.id))
          .where(
            and(
              isNull(transactions.deletedAt),
              sql`${transactions.id} in (${sql.join(
                [...txIds].map((id) => sql`${id}`),
                sql`, `
              )})`
            )
          );
        const seen = new Set(rows.map((r) => r.transaction.id));
        for (const row of extra) {
          if (!seen.has(row.transaction.id)) rows.push(row);
        }
        rows.sort(
          (a, b) =>
            b.transaction.occurredAt.getTime() -
            a.transaction.occurredAt.getTime()
        );
      }
    }
  }

  return rows;
}

export async function createTransaction(
  database: AppDatabase,
  input: {
    accountId: string;
    categoryId?: string | null;
    type: 'expense' | 'income';
    amount: number;
    currencyCode: string;
    title: string;
    note?: string;
    occurredAt?: Date;
    tagNames?: string[];
  }
) {
  const parsed = transactionInputSchema.parse({
    accountId: input.accountId,
    categoryId: input.categoryId ?? null,
    type: input.type,
    amount: input.amount,
    currencyCode: input.currencyCode,
    title: input.title,
    note: input.note,
    tagNames: input.tagNames,
  });
  const id = createId();
  const amountMinor = Math.abs(
    toMinorUnits(parsed.amount, parsed.currencyCode)
  );
  await database.insert(transactions).values({
    id,
    accountId: parsed.accountId,
    categoryId: parsed.categoryId ?? null,
    type: parsed.type,
    amountMinor,
    currencyCode: parsed.currencyCode,
    title: parsed.title.trim(),
    note: parsed.note?.trim() || null,
    occurredAt: input.occurredAt ?? new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  if (parsed.tagNames?.length) {
    await attachTags(database, id, parsed.tagNames);
  }
  return id;
}

export async function listAttachments(
  database: AppDatabase,
  transactionId: string
) {
  return database
    .select()
    .from(transactionAttachments)
    .where(
      and(
        eq(transactionAttachments.transactionId, transactionId),
        isNull(transactionAttachments.deletedAt)
      )
    )
    .orderBy(transactionAttachments.sortOrder);
}

export async function addAttachments(
  database: AppDatabase,
  transactionId: string,
  paths: { localPath: string; mimeType?: string | null }[]
) {
  if (!paths.length) return;
  const existing = await listAttachments(database, transactionId);
  await database.insert(transactionAttachments).values(
    paths.map((p, i) => ({
      id: createId(),
      transactionId,
      localPath: p.localPath,
      mimeType: p.mimeType ?? null,
      sortOrder: existing.length + i,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))
  );
}

export async function softDeleteAttachment(
  database: AppDatabase,
  attachmentId: string
) {
  await database
    .update(transactionAttachments)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(transactionAttachments.id, attachmentId));
}

export async function createTransfer(
  database: AppDatabase,
  input: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    fromCurrency: string;
    toCurrency: string;
    title?: string;
    note?: string;
    occurredAt?: Date;
  }
) {
  const transferId = createId();
  const fromId = createId();
  const toId = createId();
  const occurredAt = input.occurredAt ?? new Date();
  const title = input.title?.trim() || 'Transfer';
  const fromMinor = Math.abs(toMinorUnits(input.amount, input.fromCurrency));
  const toMinor = Math.abs(toMinorUnits(input.amount, input.toCurrency));

  await database.insert(transactions).values([
    {
      id: fromId,
      accountId: input.fromAccountId,
      categoryId: null,
      type: 'transfer',
      amountMinor: -fromMinor,
      currencyCode: input.fromCurrency,
      title,
      note: input.note?.trim() || null,
      occurredAt,
      transferId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: toId,
      accountId: input.toAccountId,
      categoryId: null,
      type: 'transfer',
      amountMinor: toMinor,
      currencyCode: input.toCurrency,
      title,
      note: input.note?.trim() || null,
      occurredAt,
      transferId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
  return transferId;
}

export async function updateTransaction(
  database: AppDatabase,
  id: string,
  patch: Partial<{
    title: string;
    note: string | null;
    categoryId: string | null;
    amountMinor: number;
    occurredAt: Date;
    type: 'expense' | 'income';
  }>
) {
  await database
    .update(transactions)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(transactions.id, id));
}

export async function softDeleteTransaction(database: AppDatabase, id: string) {
  const now = new Date();
  const [row] = await database
    .select()
    .from(transactions)
    .where(eq(transactions.id, id));
  if (!row) return;
  await database
    .update(transactions)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(transactions.id, id));
  if (row.transferId) {
    await database
      .update(transactions)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(transactions.transferId, row.transferId));
  }
}

async function attachTags(
  database: AppDatabase,
  transactionId: string,
  tagNames: string[]
) {
  for (const raw of tagNames) {
    const name = raw.trim().toLowerCase();
    if (!name) continue;
    const existing = await database
      .select()
      .from(tags)
      .where(eq(tags.name, name))
      .limit(1);
    let tagId = existing[0]?.id;
    if (!tagId) {
      tagId = createId();
      await database.insert(tags).values({
        id: tagId,
        name,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    await database
      .insert(transactionTags)
      .values({ transactionId, tagId })
      .onConflictDoNothing();
  }
}

export async function listTags(database: AppDatabase) {
  return database
    .select()
    .from(tags)
    .where(isNull(tags.deletedAt))
    .orderBy(tags.name);
}

export async function updateSettings(
  database: AppDatabase,
  patch: Partial<{
    theme: 'system' | 'light' | 'dark';
    lockEnabled: boolean;
    onboardingDone: boolean;
    activeGroupId: string | null;
    activeAccountId: string | null;
    defaultCurrency: string;
    profileImagePath: string | null;
    remindersEnabled: boolean;
  }>
) {
  await database
    .update(settings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(settings.id, 'default'));
}

export async function listBudgets(database: AppDatabase) {
  return database
    .select()
    .from(budgets)
    .where(isNull(budgets.deletedAt))
    .orderBy(desc(budgets.updatedAt));
}

export async function createBudget(
  database: AppDatabase,
  input: {
    name: string;
    categoryId: string;
    accountId?: string | null;
    amount: number;
    currencyCode: string;
    period: 'weekly' | 'monthly' | 'yearly';
  }
) {
  const id = createId();
  await database.insert(budgets).values({
    id,
    name: input.name.trim(),
    categoryId: input.categoryId,
    accountId: input.accountId ?? null,
    amountMinor: toMinorUnits(input.amount, input.currencyCode),
    currencyCode: input.currencyCode,
    period: input.period,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id;
}

export async function softDeleteBudget(database: AppDatabase, id: string) {
  await database
    .update(budgets)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(budgets.id, id));
}

/** Sum expense amount for a budget's category (and optional account) in the current period. */
export async function getBudgetSpend(
  database: AppDatabase,
  budget: {
    categoryId: string;
    accountId: string | null;
    period: 'weekly' | 'monthly' | 'yearly';
  }
): Promise<number> {
  const now = new Date();
  let from: Date;
  if (budget.period === 'weekly') {
    from = startOfWeek(now, { weekStartsOn: 1 });
  } else if (budget.period === 'yearly') {
    from = startOfYear(now);
  } else {
    from = startOfMonth(now);
  }

  const conditions = [
    isNull(transactions.deletedAt),
    eq(transactions.type, 'expense'),
    eq(transactions.categoryId, budget.categoryId),
    gte(transactions.occurredAt, from),
    lte(transactions.occurredAt, now),
  ];
  if (budget.accountId) {
    conditions.push(eq(transactions.accountId, budget.accountId));
  }

  const rows = await database
    .select({ amountMinor: transactions.amountMinor })
    .from(transactions)
    .where(and(...conditions));

  return rows.reduce((sum, r) => sum + r.amountMinor, 0);
}

export async function listRecurring(database: AppDatabase) {
  return database
    .select()
    .from(recurringTemplates)
    .where(isNull(recurringTemplates.deletedAt))
    .orderBy(recurringTemplates.nextDueAt);
}

export async function createRecurring(
  database: AppDatabase,
  input: {
    accountId: string;
    categoryId?: string | null;
    type: 'expense' | 'income';
    title: string;
    amount: number;
    currencyCode: string;
    cadence: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
    intervalDays?: number | null;
    nextDueAt: Date;
    note?: string;
  }
) {
  const id = createId();
  await database.insert(recurringTemplates).values({
    id,
    accountId: input.accountId,
    categoryId: input.categoryId ?? null,
    type: input.type,
    title: input.title.trim(),
    amountMinor: toMinorUnits(input.amount, input.currencyCode),
    currencyCode: input.currencyCode,
    cadence: input.cadence,
    intervalDays: input.intervalDays ?? null,
    nextDueAt: input.nextDueAt,
    note: input.note?.trim() || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id;
}

export async function softDeleteRecurring(database: AppDatabase, id: string) {
  await database
    .update(recurringTemplates)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(recurringTemplates.id, id));
}

export async function listGoals(database: AppDatabase) {
  return database
    .select()
    .from(goals)
    .where(isNull(goals.deletedAt))
    .orderBy(desc(goals.updatedAt));
}

export async function createGoal(
  database: AppDatabase,
  input: {
    name: string;
    target: number;
    current?: number;
    currencyCode: string;
    accountId?: string | null;
    deadlineAt?: Date | null;
  }
) {
  const id = createId();
  await database.insert(goals).values({
    id,
    name: input.name.trim(),
    targetMinor: toMinorUnits(input.target, input.currencyCode),
    currentMinor: toMinorUnits(input.current ?? 0, input.currencyCode),
    currencyCode: input.currencyCode,
    accountId: input.accountId ?? null,
    deadlineAt: input.deadlineAt ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id;
}

export async function softDeleteGoal(database: AppDatabase, id: string) {
  await database
    .update(goals)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(goals.id, id));
}

export async function addGoalContribution(
  database: AppDatabase,
  id: string,
  amount: number,
  currencyCode: string
) {
  const [row] = await database
    .select()
    .from(goals)
    .where(and(eq(goals.id, id), isNull(goals.deletedAt)))
    .limit(1);
  if (!row) return;
  const delta = toMinorUnits(amount, currencyCode);
  await database
    .update(goals)
    .set({
      currentMinor: Math.max(0, row.currentMinor + delta),
      updatedAt: new Date(),
    })
    .where(eq(goals.id, id));
}

export async function updateGoal(
  database: AppDatabase,
  id: string,
  patch: {
    name?: string;
    target?: number;
    current?: number;
    currencyCode?: string;
    deadlineAt?: Date | null;
  }
) {
  const [row] = await database
    .select()
    .from(goals)
    .where(and(eq(goals.id, id), isNull(goals.deletedAt)))
    .limit(1);
  if (!row) return;
  const currency = patch.currencyCode ?? row.currencyCode;
  await database
    .update(goals)
    .set({
      name: patch.name?.trim() ?? row.name,
      targetMinor:
        patch.target != null
          ? toMinorUnits(patch.target, currency)
          : row.targetMinor,
      currentMinor:
        patch.current != null
          ? toMinorUnits(patch.current, currency)
          : row.currentMinor,
      deadlineAt:
        patch.deadlineAt !== undefined ? patch.deadlineAt : row.deadlineAt,
      updatedAt: new Date(),
    })
    .where(eq(goals.id, id));
}

export async function listSubscriptions(database: AppDatabase) {
  return database
    .select()
    .from(subscriptions)
    .where(isNull(subscriptions.deletedAt))
    .orderBy(subscriptions.nextBillingAt);
}

export async function createSubscription(
  database: AppDatabase,
  input: {
    accountId: string;
    categoryId?: string | null;
    name: string;
    amount: number;
    currencyCode: string;
    cadence: 'weekly' | 'monthly' | 'yearly';
    nextBillingAt: Date;
    note?: string;
  }
) {
  const id = createId();
  await database.insert(subscriptions).values({
    id,
    accountId: input.accountId,
    categoryId: input.categoryId ?? null,
    name: input.name.trim(),
    amountMinor: toMinorUnits(input.amount, input.currencyCode),
    currencyCode: input.currencyCode,
    cadence: input.cadence,
    nextBillingAt: input.nextBillingAt,
    note: input.note?.trim() || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id;
}

export async function softDeleteSubscription(
  database: AppDatabase,
  id: string
) {
  await database
    .update(subscriptions)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(subscriptions.id, id));
}

export async function listDebts(database: AppDatabase) {
  return database
    .select()
    .from(debts)
    .where(isNull(debts.deletedAt))
    .orderBy(desc(debts.updatedAt));
}

export async function createDebt(
  database: AppDatabase,
  input: {
    name: string;
    kind: 'owed_to_me' | 'i_owe';
    principal: number;
    remaining?: number;
    currencyCode: string;
    accountId?: string | null;
    counterparty?: string;
    dueAt?: Date | null;
    note?: string;
  }
) {
  const id = createId();
  const principalMinor = toMinorUnits(input.principal, input.currencyCode);
  await database.insert(debts).values({
    id,
    name: input.name.trim(),
    kind: input.kind,
    principalMinor,
    remainingMinor: toMinorUnits(
      input.remaining ?? input.principal,
      input.currencyCode
    ),
    currencyCode: input.currencyCode,
    accountId: input.accountId ?? null,
    counterparty: input.counterparty?.trim() || null,
    dueAt: input.dueAt ?? null,
    note: input.note?.trim() || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id;
}

export async function softDeleteDebt(database: AppDatabase, id: string) {
  await database
    .update(debts)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(debts.id, id));
}

export async function getTransactionById(database: AppDatabase, id: string) {
  const rows = await database
    .select({
      transaction: transactions,
      category: categories,
      account: accounts,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(and(eq(transactions.id, id), isNull(transactions.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getAccountById(database: AppDatabase, id: string) {
  const rows = await database
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, id), isNull(accounts.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createCategory(
  database: AppDatabase,
  input: {
    name: string;
    kind: 'expense' | 'income';
    iconKey: string;
    color: string;
  }
) {
  const id = createId();
  await database.insert(categories).values({
    id,
    name: input.name.trim(),
    kind: input.kind,
    iconKey: input.iconKey,
    color: input.color,
    isDefault: false,
    sortOrder: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id;
}

export async function updateCategory(
  database: AppDatabase,
  id: string,
  patch: Partial<{
    name: string;
    kind: 'expense' | 'income';
    iconKey: string;
    color: string;
  }>
) {
  const next: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) next.name = patch.name.trim();
  if (patch.kind !== undefined) next.kind = patch.kind;
  if (patch.iconKey !== undefined) next.iconKey = patch.iconKey;
  if (patch.color !== undefined) next.color = patch.color;
  await database.update(categories).set(next).where(eq(categories.id, id));
}

export async function softDeleteCategory(database: AppDatabase, id: string) {
  await database
    .update(categories)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(categories.id, id));
}
