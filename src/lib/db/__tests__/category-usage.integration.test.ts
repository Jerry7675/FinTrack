import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import type { AppDatabase } from '@/lib/db/client';
import journal from '@/lib/db/migrations/meta/_journal.json';
import {
  createTransaction,
  createTransfer,
  getLastEntry,
  getLastEntryForCategory,
  listCategoryUsage,
} from '@/lib/db/queries';
import * as schema from '@/lib/db/schema';
import {
  accountGroups,
  accounts,
  categories,
  transactions,
} from '@/lib/db/schema';

const MIGRATIONS_FOLDER = path.join(__dirname, '..', 'migrations');

const FIXED_NOW = new Date('2024-06-15T12:00:00.000Z');

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
  const drizzleDb = drizzle(sqlite, { schema });
  return { db: drizzleDb as unknown as AppDatabase, drizzleDb };
}

async function seedBase(drizzleDb: ReturnType<typeof drizzle>) {
  const ts = FIXED_NOW.getTime();
  await drizzleDb.insert(accountGroups).values({
    id: 'grp',
    name: 'Personal',
    icon: 'person',
    sortOrder: 0,
    createdAt: new Date(ts),
    updatedAt: new Date(ts),
  });
  await drizzleDb.insert(accounts).values([
    {
      id: 'acc',
      groupId: 'grp',
      name: 'Cash',
      currencyCode: 'USD',
      type: 'cash',
      sortOrder: 0,
      createdAt: new Date(ts),
      updatedAt: new Date(ts),
    },
    {
      id: 'acc-2',
      groupId: 'grp',
      name: 'Bank',
      currencyCode: 'USD',
      type: 'bank',
      sortOrder: 1,
      createdAt: new Date(ts),
      updatedAt: new Date(ts),
    },
  ]);
  await drizzleDb.insert(categories).values([
    {
      id: 'cat-a',
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
      id: 'cat-b',
      name: 'Travel',
      kind: 'expense',
      iconKey: 'ellipse',
      color: '#111',
      isDefault: false,
      sortOrder: 1,
      createdAt: new Date(ts),
      updatedAt: new Date(ts),
    },
  ]);
}

describe('category usage queries', () => {
  it('aggregates usage and returns last entries by created time', async () => {
    const { db, drizzleDb } = createMigratedDb();
    await seedBase(drizzleDb);

    await createTransaction(db, {
      accountId: 'acc',
      categoryId: 'cat-a',
      type: 'expense',
      amountMinor: 100,
      currencyCode: 'USD',
      title: 'Lunch',
      occurredAt: new Date('2024-06-10T10:00:00.000Z'),
    });
    await createTransaction(db, {
      accountId: 'acc',
      categoryId: 'cat-b',
      type: 'expense',
      amountMinor: 200,
      currencyCode: 'USD',
      title: 'Train',
      occurredAt: new Date('2024-06-14T10:00:00.000Z'),
    });
    await createTransaction(db, {
      accountId: 'acc',
      categoryId: 'cat-a',
      type: 'expense',
      amountMinor: 300,
      currencyCode: 'USD',
      title: 'Dinner',
      occurredAt: new Date('2024-06-12T10:00:00.000Z'),
    });

    const usage = await listCategoryUsage(db, 'expense', 90, FIXED_NOW);
    const food = usage.find((u) => u.categoryId === 'cat-a');
    expect(food?.count).toBe(2);

    const last = await getLastEntry(db, 'expense', FIXED_NOW);
    expect(last?.categoryId).toBe('cat-a');
    expect(last?.title).toBe('Dinner');

    const lastFood = await getLastEntryForCategory(db, 'cat-a');
    expect(lastFood?.title).toBe('Dinner');
  });

  it('listCategoryUsage ignores deleted transactions', async () => {
    const { db, drizzleDb } = createMigratedDb();
    await seedBase(drizzleDb);
    const id = await createTransaction(db, {
      accountId: 'acc',
      categoryId: 'cat-a',
      type: 'expense',
      amountMinor: 100,
      currencyCode: 'USD',
      title: 'Live',
      occurredAt: FIXED_NOW,
    });
    await drizzleDb
      .update(transactions)
      .set({ deletedAt: new Date() })
      .where(eq(transactions.id, id));

    const usage = await listCategoryUsage(db, 'expense', 90, FIXED_NOW);
    expect(usage).toHaveLength(0);
  });

  it('listCategoryUsage filters by kind', async () => {
    const { db, drizzleDb } = createMigratedDb();
    await seedBase(drizzleDb);
    await drizzleDb.insert(categories).values({
      id: 'cat-inc',
      name: 'Salary',
      kind: 'income',
      iconKey: 'ellipse',
      color: '#222',
      isDefault: false,
      sortOrder: 0,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    });
    await createTransaction(db, {
      accountId: 'acc',
      categoryId: 'cat-a',
      type: 'expense',
      amountMinor: 100,
      currencyCode: 'USD',
      title: 'Expense',
      occurredAt: FIXED_NOW,
    });
    await createTransaction(db, {
      accountId: 'acc',
      categoryId: 'cat-inc',
      type: 'income',
      amountMinor: 500,
      currencyCode: 'USD',
      title: 'Pay',
      occurredAt: FIXED_NOW,
    });

    const usage = await listCategoryUsage(db, 'expense', 90, FIXED_NOW);
    expect(usage).toHaveLength(1);
    expect(usage[0]?.categoryId).toBe('cat-a');
  });

  it('listCategoryUsage respects the 90-day window', async () => {
    const { db, drizzleDb } = createMigratedDb();
    await seedBase(drizzleDb);
    await createTransaction(db, {
      accountId: 'acc',
      categoryId: 'cat-a',
      type: 'expense',
      amountMinor: 100,
      currencyCode: 'USD',
      title: 'Old',
      occurredAt: new Date('2024-01-01T12:00:00.000Z'),
    });

    const usage = await listCategoryUsage(db, 'expense', 90, FIXED_NOW);
    expect(usage).toHaveLength(0);
  });

  it('getLastEntry skips soft-deleted accounts and categories', async () => {
    const { db, drizzleDb } = createMigratedDb();
    await seedBase(drizzleDb);
    await createTransaction(db, {
      accountId: 'acc',
      categoryId: 'cat-b',
      type: 'expense',
      amountMinor: 50,
      currencyCode: 'USD',
      title: 'Deleted cat',
      occurredAt: FIXED_NOW,
    });
    await drizzleDb
      .update(categories)
      .set({ deletedAt: new Date() })
      .where(eq(categories.id, 'cat-b'));

    await createTransaction(db, {
      accountId: 'acc',
      categoryId: 'cat-a',
      type: 'expense',
      amountMinor: 60,
      currencyCode: 'USD',
      title: 'Valid',
      occurredAt: FIXED_NOW,
    });

    const last = await getLastEntry(db, 'expense', FIXED_NOW);
    expect(last?.title).toBe('Valid');
  });

  it('getLastEntry for transfer uses the from leg and to account', async () => {
    const { db, drizzleDb } = createMigratedDb();
    await seedBase(drizzleDb);
    await createTransfer(db, {
      fromAccountId: 'acc',
      toAccountId: 'acc-2',
      amountMinor: 5000,
      fromCurrency: 'USD',
      toCurrency: 'USD',
      title: 'Move cash',
    });

    const last = await getLastEntry(db, 'transfer', FIXED_NOW);
    expect(last?.accountId).toBe('acc');
    expect(last?.toAccountId).toBe('acc-2');
    expect(last?.amountMinor).toBe(5000);
  });

  it('getLastEntry prefers latest created transfer over older back-dated row', async () => {
    const { db, drizzleDb } = createMigratedDb();
    await seedBase(drizzleDb);
    await createTransfer(db, {
      fromAccountId: 'acc',
      toAccountId: 'acc-2',
      amountMinor: 1000,
      fromCurrency: 'USD',
      toCurrency: 'USD',
      title: 'Newer',
    });
    await createTransaction(db, {
      accountId: 'acc',
      type: 'expense',
      amountMinor: 99,
      currencyCode: 'USD',
      title: 'Backdated but created later',
      occurredAt: new Date('2099-01-01T00:00:00.000Z'),
    });

    const last = await getLastEntry(db, 'expense', FIXED_NOW);
    expect(last?.title).toBe('Backdated but created later');
  });
});
