import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import type { AppDatabase } from '@/lib/db/client';
import journal from '@/lib/db/migrations/meta/_journal.json';
import {
  createTransaction,
  getLastEntry,
  getLastEntryForCategory,
  listCategoryUsage,
} from '@/lib/db/queries';
import * as schema from '@/lib/db/schema';
import { accountGroups, accounts, categories } from '@/lib/db/schema';

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

describe('category usage queries', () => {
  it('aggregates usage and returns last entries', async () => {
    const { db, drizzleDb } = createMigratedDb();
    const ts = FIXED_NOW.getTime();
    await drizzleDb.insert(accountGroups).values({
      id: 'grp',
      name: 'Personal',
      icon: 'person',
      sortOrder: 0,
      createdAt: new Date(ts),
      updatedAt: new Date(ts),
    });
    await drizzleDb.insert(accounts).values({
      id: 'acc',
      groupId: 'grp',
      name: 'Cash',
      currencyCode: 'USD',
      type: 'cash',
      sortOrder: 0,
      createdAt: new Date(ts),
      updatedAt: new Date(ts),
    });
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
    expect(last?.categoryId).toBe('cat-b');
    expect(last?.title).toBe('Train');

    const lastFood = await getLastEntryForCategory(db, 'cat-a');
    expect(lastFood?.title).toBe('Dinner');
  });
});
