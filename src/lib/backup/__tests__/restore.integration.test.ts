import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import {
  BackupValidationError,
  buildBackupPayload,
  restoreBackupPayload,
  validateBackupPayload,
} from '@/lib/backup';
import type { AppDatabase } from '@/lib/db/client';
import journal from '@/lib/db/migrations/meta/_journal.json';
import * as schema from '@/lib/db/schema';
import {
  accountGroups,
  accounts,
  categories,
  transactions,
} from '@/lib/db/schema';

const MIGRATIONS_FOLDER = path.join(__dirname, '..', '..', 'db', 'migrations');

const FIXED_NOW = new Date('2024-06-15T12:00:00.000Z');
const MARKER_TXN_ID = 'marker-txn-keep';

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

async function seedMarkerData(db: ReturnType<typeof drizzle>) {
  const ts = FIXED_NOW.getTime();
  await db.insert(accountGroups).values({
    id: 'grp-1',
    name: 'Personal',
    icon: 'business',
    sortOrder: 0,
    createdAt: new Date(ts),
    updatedAt: new Date(ts),
  });
  await db.insert(accounts).values({
    id: 'acc-1',
    groupId: 'grp-1',
    name: 'Cash',
    currencyCode: 'USD',
    type: 'cash',
    sortOrder: 0,
    createdAt: new Date(ts),
    updatedAt: new Date(ts),
  });
  await db.insert(categories).values({
    id: 'cat-1',
    name: 'Food',
    kind: 'expense',
    iconKey: 'ellipse',
    color: '#1A7A4C',
    isDefault: false,
    sortOrder: 0,
    createdAt: new Date(ts),
    updatedAt: new Date(ts),
  });
  await db.insert(transactions).values({
    id: MARKER_TXN_ID,
    accountId: 'acc-1',
    categoryId: 'cat-1',
    type: 'expense',
    amountMinor: 500,
    currencyCode: 'USD',
    title: 'Marker coffee',
    occurredAt: new Date(ts),
    createdAt: new Date(ts),
    updatedAt: new Date(ts),
  });
}

function serializeForCompare(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

describe('restoreBackupPayload integration', () => {
  let source: ReturnType<typeof createMigratedDb>;
  let target: ReturnType<typeof createMigratedDb>;

  beforeEach(async () => {
    source = createMigratedDb();
    target = createMigratedDb();
    await seedMarkerData(source.drizzleDb);
  });

  afterEach(() => {
    source.sqlite.close();
    target.sqlite.close();
  });

  it('round-trips export payload into a fresh database', async () => {
    const payload = await buildBackupPayload(source.db);
    const jsonRoundTrip = JSON.parse(JSON.stringify(payload)) as unknown;

    restoreBackupPayload(jsonRoundTrip, { database: target.db });

    const sourceTxns = await source.drizzleDb.select().from(transactions);
    const targetTxns = await target.drizzleDb.select().from(transactions);

    expect(serializeForCompare(targetTxns)).toEqual(
      serializeForCompare(sourceTxns)
    );
  });

  it('coerces numeric JSON fields and restores with partial nulls', async () => {
    const payload = await buildBackupPayload(source.db);
    const loose = JSON.parse(JSON.stringify(payload)) as Record<
      string,
      unknown
    >;
    const data = loose.data as Record<string, unknown>;
    const txns = data.transactions as Record<string, unknown>[];
    txns[0] = {
      ...txns[0],
      amountMinor: 1500,
      title: 99,
    };
    (data.categories as Record<string, unknown>[])[0] = {
      ...(data.categories as Record<string, unknown>[])[0],
      color: 'not-a-color',
    };

    expect(() => restoreBackupPayload(loose, { database: target.db })).toThrow(
      BackupValidationError
    );

    const marker = await source.drizzleDb
      .select()
      .from(transactions)
      .where(eq(transactions.id, MARKER_TXN_ID));
    expect(marker).toHaveLength(1);

    const fixed = JSON.parse(JSON.stringify(payload)) as Record<
      string,
      unknown
    >;
    const fixedData = fixed.data as Record<string, unknown>;
    const fixedTxns = fixedData.transactions as Record<string, unknown>[];
    fixedTxns[0] = { ...fixedTxns[0], amountMinor: 1500, title: 99 };

    restoreBackupPayload(fixed, { database: target.db });
    const restored = await target.drizzleDb
      .select()
      .from(transactions)
      .where(eq(transactions.id, MARKER_TXN_ID));
    expect(restored[0]?.amountMinor).toBe(1500);
    expect(restored[0]?.title).toBe('99');
  });

  it('rejects invalid category colours before touching the database', async () => {
    const payload = await buildBackupPayload(source.db);
    const broken = JSON.parse(JSON.stringify(payload)) as Record<
      string,
      unknown
    >;
    const data = broken.data as Record<string, unknown>;
    const cats = data.categories as Record<string, unknown>[];
    cats[0] = { ...cats[0], color: 'not-a-color' };

    expect(() => restoreBackupPayload(broken, { database: source.db })).toThrow(
      BackupValidationError
    );

    const marker = await source.drizzleDb
      .select()
      .from(transactions)
      .where(eq(transactions.id, MARKER_TXN_ID));
    expect(marker).toHaveLength(1);
  });

  it('rejects invalid dates before touching the database', async () => {
    const payload = await buildBackupPayload(source.db);
    const broken = JSON.parse(JSON.stringify(payload)) as Record<
      string,
      unknown
    >;
    const data = broken.data as Record<string, unknown>;
    const groups = data.accountGroups as Record<string, unknown>[];
    groups[0] = { ...groups[0], createdAt: 'not-a-date' };

    expect(() => restoreBackupPayload(broken, { database: source.db })).toThrow(
      BackupValidationError
    );

    const marker = await source.drizzleDb
      .select()
      .from(transactions)
      .where(eq(transactions.id, MARKER_TXN_ID));
    expect(marker).toHaveLength(1);
  });

  it('rolls back when restore fails after deletes inside the transaction', async () => {
    const payload = await buildBackupPayload(source.db);

    expect(() =>
      restoreBackupPayload(payload, {
        database: source.db,
        hooks: {
          afterDeletes: () => {
            throw new Error('simulated restore failure');
          },
        },
      })
    ).toThrow('simulated restore failure');

    const marker = await source.drizzleDb
      .select()
      .from(transactions)
      .where(eq(transactions.id, MARKER_TXN_ID));
    expect(marker).toHaveLength(1);
  });
});

describe('validateBackupPayload', () => {
  it('rejects unknown account references before restore', () => {
    const payload = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      data: {
        accountGroups: [],
        accounts: [],
        categories: [],
        tags: [],
        transactions: [
          {
            id: 'tx-bad',
            accountId: 'missing-account',
            type: 'expense',
            amountMinor: 100,
            currencyCode: 'USD',
            title: 'X',
            occurredAt: FIXED_NOW.toISOString(),
            createdAt: FIXED_NOW.toISOString(),
            updatedAt: FIXED_NOW.toISOString(),
          },
        ],
        transactionTags: [],
        budgets: [],
        recurringTemplates: [],
        goals: [],
        subscriptions: [],
        debts: [],
        settings: [],
      },
    };

    expect(() => validateBackupPayload(payload)).toThrow(BackupValidationError);
  });
});
