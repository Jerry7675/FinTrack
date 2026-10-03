import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import Database from 'better-sqlite3';
import { startOfMonth } from 'date-fns';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { AppDatabase } from '@/lib/db/client';
import journal from '@/lib/db/migrations/meta/_journal.json';
import { getBudgetSpend } from '@/lib/db/queries';
import * as schema from '@/lib/db/schema';
import {
  accountGroups,
  accounts,
  categories,
  transactions,
} from '@/lib/db/schema';

const MIGRATIONS_FOLDER = path.join(__dirname, '..', 'migrations');

const FIXED_NOW = new Date('2024-06-15T12:00:00.000Z');

type SeedIds = {
  groupId: string;
  catFood: string;
  catOther: string;
  accActive: string;
  accOther: string;
  accDeleted: string;
};

function applyRepoMigrations(sqlite: Database.Database) {
  for (const entry of journal.entries) {
    const filePath = path.join(MIGRATIONS_FOLDER, `${entry.tag}.sql`);
    const raw = fs.readFileSync(filePath, 'utf8');
    const sql = raw.replaceAll('--> statement-breakpoint', '').trim();
    sqlite.exec(sql);
  }
}

function createMigratedDb() {
  const sqlite = new Database(':memory:');
  applyRepoMigrations(sqlite);
  const db = drizzle(sqlite, { schema });
  return { sqlite, db: db as unknown as AppDatabase, drizzleDb: db };
}

async function seedBase(db: ReturnType<typeof drizzle>) {
  const ids: SeedIds = {
    groupId: 'grp-1',
    catFood: 'cat-food',
    catOther: 'cat-other',
    accActive: 'acc-active',
    accOther: 'acc-other',
    accDeleted: 'acc-deleted',
  };
  const ts = FIXED_NOW.getTime();

  await db.insert(accountGroups).values({
    id: ids.groupId,
    name: 'Test',
    icon: 'business',
    sortOrder: 0,
    createdAt: new Date(ts),
    updatedAt: new Date(ts),
  });

  await db.insert(accounts).values([
    {
      id: ids.accActive,
      groupId: ids.groupId,
      name: 'Active USD',
      currencyCode: 'USD',
      type: 'cash',
      sortOrder: 0,
      createdAt: new Date(ts),
      updatedAt: new Date(ts),
    },
    {
      id: ids.accOther,
      groupId: ids.groupId,
      name: 'Other USD',
      currencyCode: 'USD',
      type: 'cash',
      sortOrder: 1,
      createdAt: new Date(ts),
      updatedAt: new Date(ts),
    },
    {
      id: ids.accDeleted,
      groupId: ids.groupId,
      name: 'Deleted USD',
      currencyCode: 'USD',
      type: 'cash',
      sortOrder: 2,
      createdAt: new Date(ts),
      updatedAt: new Date(ts),
      deletedAt: new Date(ts),
    },
  ]);

  await db.insert(categories).values([
    {
      id: ids.catFood,
      name: 'Food',
      kind: 'expense',
      iconKey: 'ellipse',
      color: '#000',
      isDefault: false,
      sortOrder: 0,
      createdAt: new Date(ts),
      updatedAt: new Date(ts),
    },
    {
      id: ids.catOther,
      name: 'Other',
      kind: 'expense',
      iconKey: 'ellipse',
      color: '#000',
      isDefault: false,
      sortOrder: 1,
      createdAt: new Date(ts),
      updatedAt: new Date(ts),
    },
  ]);

  return ids;
}

async function insertTxn(
  db: ReturnType<typeof drizzle>,
  row: {
    id: string;
    accountId: string;
    categoryId: string | null;
    type: 'expense' | 'income' | 'transfer';
    amountMinor: number;
    currencyCode: string;
    occurredAt: Date;
  }
) {
  const ts = FIXED_NOW.getTime();
  await db.insert(transactions).values({
    id: row.id,
    accountId: row.accountId,
    categoryId: row.categoryId,
    type: row.type,
    amountMinor: row.amountMinor,
    currencyCode: row.currencyCode,
    title: row.id,
    note: null,
    occurredAt: row.occurredAt,
    transferId: null,
    sourceType: null,
    sourceId: null,
    createdAt: new Date(ts),
    updatedAt: new Date(ts),
  });
}

const baseBudget = {
  categoryId: 'cat-food',
  accountId: null as string | null,
  currencyCode: 'USD',
  period: 'monthly' as const,
};

describe('getBudgetSpend integration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sums same-currency expenses and ignores other currency, transfers, and deleted accounts', async () => {
    const { db, drizzleDb } = createMigratedDb();
    const ids = await seedBase(drizzleDb);
    const midMonth = new Date('2024-06-10T10:00:00.000Z');

    await insertTxn(drizzleDb, {
      id: 'tx-usd-1',
      accountId: ids.accActive,
      categoryId: ids.catFood,
      type: 'expense',
      amountMinor: 1000,
      currencyCode: 'USD',
      occurredAt: midMonth,
    });
    await insertTxn(drizzleDb, {
      id: 'tx-usd-2',
      accountId: ids.accActive,
      categoryId: ids.catFood,
      type: 'expense',
      amountMinor: 500,
      currencyCode: 'USD',
      occurredAt: midMonth,
    });
    await insertTxn(drizzleDb, {
      id: 'tx-eur',
      accountId: ids.accActive,
      categoryId: ids.catFood,
      type: 'expense',
      amountMinor: 9000,
      currencyCode: 'EUR',
      occurredAt: midMonth,
    });
    await insertTxn(drizzleDb, {
      id: 'tx-transfer',
      accountId: ids.accActive,
      categoryId: null,
      type: 'transfer',
      amountMinor: -3000,
      currencyCode: 'USD',
      occurredAt: midMonth,
    });
    await insertTxn(drizzleDb, {
      id: 'tx-deleted-acct',
      accountId: ids.accDeleted,
      categoryId: ids.catFood,
      type: 'expense',
      amountMinor: 4000,
      currencyCode: 'USD',
      occurredAt: midMonth,
    });

    const total = await getBudgetSpend(db, {
      ...baseBudget,
      categoryId: ids.catFood,
    });

    expect(total).toBe(1500);
  });

  it('does not net income in the budgeted category against spend', async () => {
    const { db, drizzleDb } = createMigratedDb();
    const ids = await seedBase(drizzleDb);
    const midMonth = new Date('2024-06-10T10:00:00.000Z');

    await insertTxn(drizzleDb, {
      id: 'tx-exp',
      accountId: ids.accActive,
      categoryId: ids.catFood,
      type: 'expense',
      amountMinor: 2000,
      currencyCode: 'USD',
      occurredAt: midMonth,
    });
    await insertTxn(drizzleDb, {
      id: 'tx-income',
      accountId: ids.accActive,
      categoryId: ids.catFood,
      type: 'income',
      amountMinor: 5000,
      currencyCode: 'USD',
      occurredAt: midMonth,
    });

    const total = await getBudgetSpend(db, {
      ...baseBudget,
      categoryId: ids.catFood,
    });

    expect(total).toBe(2000);
  });

  it('filters by category and accountId when budget is account-scoped', async () => {
    const { db, drizzleDb } = createMigratedDb();
    const ids = await seedBase(drizzleDb);
    const midMonth = new Date('2024-06-10T10:00:00.000Z');

    await insertTxn(drizzleDb, {
      id: 'tx-active-cat',
      accountId: ids.accActive,
      categoryId: ids.catFood,
      type: 'expense',
      amountMinor: 800,
      currencyCode: 'USD',
      occurredAt: midMonth,
    });
    await insertTxn(drizzleDb, {
      id: 'tx-other-cat',
      accountId: ids.accActive,
      categoryId: ids.catOther,
      type: 'expense',
      amountMinor: 600,
      currencyCode: 'USD',
      occurredAt: midMonth,
    });
    await insertTxn(drizzleDb, {
      id: 'tx-other-acct',
      accountId: ids.accOther,
      categoryId: ids.catFood,
      type: 'expense',
      amountMinor: 700,
      currencyCode: 'USD',
      occurredAt: midMonth,
    });

    const categoryWide = await getBudgetSpend(db, {
      ...baseBudget,
      categoryId: ids.catFood,
      accountId: null,
    });
    expect(categoryWide).toBe(1500);

    const accountScoped = await getBudgetSpend(db, {
      ...baseBudget,
      categoryId: ids.catFood,
      accountId: ids.accActive,
    });
    expect(accountScoped).toBe(800);
  });

  it('returns 0 when budget currency does not match transaction currency (account currency irrelevant)', async () => {
    const { db, drizzleDb } = createMigratedDb();
    const ids = await seedBase(drizzleDb);
    const midMonth = new Date('2024-06-10T10:00:00.000Z');

    await drizzleDb
      .update(accounts)
      .set({ currencyCode: 'EUR' })
      .where(eq(accounts.id, ids.accActive));

    await insertTxn(drizzleDb, {
      id: 'tx-eur-on-eur-acct',
      accountId: ids.accActive,
      categoryId: ids.catFood,
      type: 'expense',
      amountMinor: 1200,
      currencyCode: 'EUR',
      occurredAt: midMonth,
    });

    const usdBudgetOnEurAccount = await getBudgetSpend(db, {
      ...baseBudget,
      categoryId: ids.catFood,
      currencyCode: 'USD',
      accountId: ids.accActive,
    });

    expect(usdBudgetOnEurAccount).toBe(0);
  });

  it('includes period boundaries: gte start, lte end; excludes 1ms outside each end', async () => {
    const { db, drizzleDb } = createMigratedDb();
    const ids = await seedBase(drizzleDb);
    const periodStart = startOfMonth(FIXED_NOW);
    const periodEnd = FIXED_NOW;

    await insertTxn(drizzleDb, {
      id: 'tx-at-start',
      accountId: ids.accActive,
      categoryId: ids.catFood,
      type: 'expense',
      amountMinor: 100,
      currencyCode: 'USD',
      occurredAt: periodStart,
    });
    await insertTxn(drizzleDb, {
      id: 'tx-at-end',
      accountId: ids.accActive,
      categoryId: ids.catFood,
      type: 'expense',
      amountMinor: 200,
      currencyCode: 'USD',
      occurredAt: periodEnd,
    });
    await insertTxn(drizzleDb, {
      id: 'tx-before-start',
      accountId: ids.accActive,
      categoryId: ids.catFood,
      type: 'expense',
      amountMinor: 50,
      currencyCode: 'USD',
      occurredAt: new Date(periodStart.getTime() - 1),
    });
    await insertTxn(drizzleDb, {
      id: 'tx-after-end',
      accountId: ids.accActive,
      categoryId: ids.catFood,
      type: 'expense',
      amountMinor: 75,
      currencyCode: 'USD',
      occurredAt: new Date(periodEnd.getTime() + 1),
    });

    const total = await getBudgetSpend(db, {
      ...baseBudget,
      categoryId: ids.catFood,
    });

    expect(total).toBe(300);
  });

  it('matches materialize budget pulse inputs (currencyCode passed through)', async () => {
    const { db, drizzleDb } = createMigratedDb();
    const ids = await seedBase(drizzleDb);
    const midMonth = new Date('2024-06-10T10:00:00.000Z');

    await insertTxn(drizzleDb, {
      id: 'tx-pulse',
      accountId: ids.accActive,
      categoryId: ids.catFood,
      type: 'expense',
      amountMinor: 3300,
      currencyCode: 'USD',
      occurredAt: midMonth,
    });

    const spent = await getBudgetSpend(db, {
      categoryId: ids.catFood,
      accountId: null,
      period: 'monthly',
      currencyCode: 'USD',
    });

    expect(spent).toBe(3300);
  });
});
