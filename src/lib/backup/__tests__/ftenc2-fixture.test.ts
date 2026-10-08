import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { decryptBackupPayload, restoreBackupPayload } from '@/lib/backup';
import type { AppDatabase } from '@/lib/db/client';
import journal from '@/lib/db/migrations/meta/_journal.json';
import * as schema from '@/lib/db/schema';
import { accounts } from '@/lib/db/schema';

const FIXTURE_PASSWORD = 'fixture-pass-12345';
const FIXTURE_DIR = path.join(__dirname, '..', '__fixtures__');
const MIGRATIONS_FOLDER = path.join(__dirname, '..', '..', 'db', 'migrations');

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

describe('FTENC2 backup fixture (pre-hardening)', () => {
  const blob = fs
    .readFileSync(path.join(FIXTURE_DIR, 'ftenc2-backup.ftenc'), 'utf8')
    .trim();

  it('decrypts the committed fixture with the legacy KDF', async () => {
    const payload = await decryptBackupPayload(blob, FIXTURE_PASSWORD);
    expect(payload.schemaVersion).toBe(1);
    expect(payload.data.accountGroups[0]?.id).toBe('grp-fixture');
    expect(payload.data.accounts[0]?.name).toBe('Wallet');
  });

  describe('restore', () => {
    let target: ReturnType<typeof createMigratedDb>;

    beforeEach(() => {
      target = createMigratedDb();
    });

    afterEach(() => {
      target.sqlite.close();
    });

    it('restores decrypted fixture rows into a fresh database', async () => {
      const payload = await decryptBackupPayload(blob, FIXTURE_PASSWORD);
      const jsonRoundTrip = JSON.parse(JSON.stringify(payload)) as unknown;
      restoreBackupPayload(jsonRoundTrip, { database: target.db });

      const rows = await target.drizzleDb
        .select()
        .from(accounts)
        .where(eq(accounts.id, 'acc-fixture'));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.name).toBe('Wallet');
    });
  });
});
