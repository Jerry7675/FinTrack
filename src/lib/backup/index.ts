import { isNull } from 'drizzle-orm';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { db } from '@/lib/db/client';
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
  transactions,
  transactionTags,
} from '@/lib/db/schema';

export const BACKUP_SCHEMA_VERSION = 1;

export type BackupPayload = {
  schemaVersion: number;
  exportedAt: string;
  data: {
    accountGroups: (typeof accountGroups.$inferSelect)[];
    accounts: (typeof accounts.$inferSelect)[];
    categories: (typeof categories.$inferSelect)[];
    tags: (typeof tags.$inferSelect)[];
    transactions: (typeof transactions.$inferSelect)[];
    transactionTags: (typeof transactionTags.$inferSelect)[];
    budgets: (typeof budgets.$inferSelect)[];
    recurringTemplates: (typeof recurringTemplates.$inferSelect)[];
    goals: (typeof goals.$inferSelect)[];
    subscriptions: (typeof subscriptions.$inferSelect)[];
    debts: (typeof debts.$inferSelect)[];
    settings: (typeof settings.$inferSelect)[];
  };
};

export async function buildBackupPayload(): Promise<BackupPayload> {
  const [
    groups,
    ledgers,
    cats,
    tagRows,
    txns,
    txnTags,
    budgetRows,
    recurringRows,
    goalRows,
    subRows,
    debtRows,
    settingRows,
  ] = await Promise.all([
    db.select().from(accountGroups),
    db.select().from(accounts),
    db.select().from(categories),
    db.select().from(tags),
    db.select().from(transactions),
    db.select().from(transactionTags),
    db.select().from(budgets),
    db.select().from(recurringTemplates),
    db.select().from(goals),
    db.select().from(subscriptions),
    db.select().from(debts),
    db.select().from(settings),
  ]);

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      accountGroups: groups,
      accounts: ledgers,
      categories: cats,
      tags: tagRows,
      transactions: txns,
      transactionTags: txnTags,
      budgets: budgetRows,
      recurringTemplates: recurringRows,
      goals: goalRows,
      subscriptions: subRows,
      debts: debtRows,
      settings: settingRows,
    },
  };
}

export async function exportBackupJson(): Promise<string> {
  const payload = await buildBackupPayload();
  const json = JSON.stringify(payload, null, 2);
  const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!base) throw new Error('No writable directory available');
  const path = `${base}fintrack-backup-${Date.now()}.json`;
  await FileSystem.writeAsStringAsync(path, json);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: 'application/json',
      dialogTitle: 'Export FinTrack backup',
    });
  }
  return path;
}

export async function exportTransactionsCsv(): Promise<string> {
  const rows = await db
    .select()
    .from(transactions)
    .where(isNull(transactions.deletedAt));
  const header =
    'id,account_id,type,amount_minor,currency,title,note,occurred_at';
  const lines = rows.map((r) =>
    [
      r.id,
      r.accountId,
      r.type,
      r.amountMinor,
      r.currencyCode,
      csvEscape(r.title),
      csvEscape(r.note ?? ''),
      r.occurredAt.toISOString(),
    ].join(',')
  );
  const csv = [header, ...lines].join('\n');
  const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!base) throw new Error('No writable directory available');
  const path = `${base}fintrack-transactions-${Date.now()}.csv`;
  await FileSystem.writeAsStringAsync(path, csv);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: 'text/csv',
      dialogTitle: 'Export transactions CSV',
    });
  }
  return path;
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export async function restoreBackupPayload(
  payload: BackupPayload
): Promise<void> {
  if (payload.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error(`Unsupported backup version: ${payload.schemaVersion}`);
  }
  await db.delete(transactionTags);
  await db.delete(transactions);
  await db.delete(budgets);
  await db.delete(recurringTemplates);
  await db.delete(goals);
  await db.delete(subscriptions);
  await db.delete(debts);
  await db.delete(tags);
  await db.delete(categories);
  await db.delete(accounts);
  await db.delete(accountGroups);
  await db.delete(settings);

  const d = payload.data;
  if (d.accountGroups.length) {
    await db.insert(accountGroups).values(d.accountGroups);
  }
  if (d.accounts.length) await db.insert(accounts).values(d.accounts);
  if (d.categories.length) await db.insert(categories).values(d.categories);
  if (d.tags.length) await db.insert(tags).values(d.tags);
  if (d.transactions.length) {
    await db.insert(transactions).values(d.transactions);
  }
  if (d.transactionTags.length) {
    await db.insert(transactionTags).values(d.transactionTags);
  }
  if (d.budgets.length) await db.insert(budgets).values(d.budgets);
  if (d.recurringTemplates.length) {
    await db.insert(recurringTemplates).values(d.recurringTemplates);
  }
  if (d.goals.length) await db.insert(goals).values(d.goals);
  if (d.subscriptions.length) {
    await db.insert(subscriptions).values(d.subscriptions);
  }
  if (d.debts.length) await db.insert(debts).values(d.debts);
  if (d.settings.length) await db.insert(settings).values(d.settings);
}
