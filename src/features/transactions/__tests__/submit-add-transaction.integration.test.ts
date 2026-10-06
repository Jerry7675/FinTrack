import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { submitAddTransaction } from '@/features/transactions/submit-add-transaction';
import type { AppDatabase } from '@/lib/db/client';
import journal from '@/lib/db/migrations/meta/_journal.json';
import { createTransaction } from '@/lib/db/queries';
import * as schema from '@/lib/db/schema';
import {
  accountGroups,
  accounts,
  categories,
  transactions,
} from '@/lib/db/schema';
import { parseAmountToMinor } from '@/lib/money';

const MIGRATIONS_FOLDER = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'lib',
  'db',
  'migrations'
);

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
  return { sqlite, db: drizzleDb as unknown as AppDatabase, drizzleDb };
}

async function seedAccountAndCategories(db: ReturnType<typeof drizzle>) {
  const ts = FIXED_NOW.getTime();
  await db.insert(accountGroups).values({
    id: 'grp-1',
    name: 'Personal',
    icon: 'person',
    sortOrder: 0,
    createdAt: new Date(ts),
    updatedAt: new Date(ts),
  });
  await db.insert(accounts).values({
    id: 'acc-usd',
    groupId: 'grp-1',
    name: 'Cash',
    currencyCode: 'USD',
    type: 'cash',
    sortOrder: 0,
    createdAt: new Date(ts),
    updatedAt: new Date(ts),
  });
  await db.insert(categories).values([
    {
      id: 'cat-exp',
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
      id: 'cat-inc',
      name: 'Salary',
      kind: 'income',
      iconKey: 'ellipse',
      color: '#000',
      isDefault: false,
      sortOrder: 1,
      createdAt: new Date(ts),
      updatedAt: new Date(ts),
    },
  ]);
}

describe('submitAddTransaction integration', () => {
  it('persists expense and income rows via real createTransaction', async () => {
    const { db, drizzleDb } = createMigratedDb();
    await seedAccountAndCategories(drizzleDb);

    const accountSummary = [
      { id: 'acc-usd', currencyCode: 'USD', name: 'Cash' },
    ];

    const expense = await submitAddTransaction(
      {
        mode: 'expense',
        amount: '15.50',
        title: 'Coffee',
        note: 'morning',
        tags: '',
        accountId: 'acc-usd',
        categoryId: 'cat-exp',
      },
      {
        accounts: accountSummary,
        currency: 'USD',
        parseAmountToMinor,
        createTransaction: (input) => createTransaction(db, input),
        createTransfer: async () => {
          throw new Error('not used');
        },
      }
    );
    expect(expense).toEqual({ ok: true, transactionId: expect.any(String) });

    const income = await submitAddTransaction(
      {
        mode: 'income',
        amount: '1,000',
        title: 'Paycheck',
        note: '',
        tags: 'work',
        accountId: 'acc-usd',
        categoryId: 'cat-inc',
      },
      {
        accounts: accountSummary,
        currency: 'USD',
        parseAmountToMinor,
        createTransaction: (input) => createTransaction(db, input),
        createTransfer: async () => {
          throw new Error('not used');
        },
      }
    );
    expect(income).toEqual({ ok: true, transactionId: expect.any(String) });

    const rows = await drizzleDb
      .select()
      .from(transactions)
      .where(eq(transactions.accountId, 'acc-usd'));

    expect(rows).toHaveLength(2);

    const expenseRow = rows.find((r) => r.type === 'expense');
    const incomeRow = rows.find((r) => r.type === 'income');

    expect(expenseRow).toMatchObject({
      type: 'expense',
      amountMinor: 1550,
      currencyCode: 'USD',
      title: 'Coffee',
      note: 'morning',
      categoryId: 'cat-exp',
      sourceType: null,
      sourceId: null,
    });
    expect(incomeRow).toMatchObject({
      type: 'income',
      amountMinor: 100000,
      currencyCode: 'USD',
      title: 'Paycheck',
      categoryId: 'cat-inc',
      sourceType: null,
      sourceId: null,
    });
    expect(expenseRow?.occurredAt).toBeInstanceOf(Date);
    expect(incomeRow?.occurredAt).toBeInstanceOf(Date);
  });
});
