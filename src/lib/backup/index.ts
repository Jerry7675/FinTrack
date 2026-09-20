import { isNull } from 'drizzle-orm';
import {
  CryptoDigestAlgorithm,
  digestStringAsync,
  getRandomBytesAsync,
} from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { db } from '@/lib/db/client';
import { createTransaction } from '@/lib/db/queries';
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
import { fromMinorUnits } from '@/lib/money';

export const BACKUP_SCHEMA_VERSION = 1;
export const ENC_PREFIX = 'FTENC1';

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

async function deriveKeyBytes(password: string, saltHex: string) {
  let material = `${password}:${saltHex}`;
  for (let i = 0; i < 2000; i++) {
    material = await digestStringAsync(CryptoDigestAlgorithm.SHA256, material);
  }
  return material;
}

function xorHexPayload(utf8: string, keyHex: string): string {
  const chars = [...utf8];
  const out: string[] = [];
  for (let i = 0; i < chars.length; i++) {
    const code = chars[i].charCodeAt(0);
    const keyByte = Number.parseInt(
      keyHex.slice((i * 2) % 64, ((i * 2) % 64) + 2),
      16
    );
    out.push(String.fromCharCode(code ^ (keyByte || 0)));
  }
  // base64 via btoa-compatible encoding
  const bytes = out.map((c) => c.charCodeAt(0));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return globalThis.btoa(binary);
}

function decodeXorPayload(b64: string, keyHex: string): string {
  const binary = globalThis.atob(b64);
  const chars: string[] = [];
  for (let i = 0; i < binary.length; i++) {
    const code = binary.charCodeAt(i);
    const keyByte = Number.parseInt(
      keyHex.slice((i * 2) % 64, ((i * 2) % 64) + 2),
      16
    );
    chars.push(String.fromCharCode(code ^ (keyByte || 0)));
  }
  return chars.join('');
}

export async function encryptBackupPayload(
  payload: BackupPayload,
  password: string
): Promise<string> {
  const salt = await getRandomBytesAsync(16);
  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const keyHex = await deriveKeyBytes(password, saltHex);
  const cipher = xorHexPayload(JSON.stringify(payload), keyHex);
  return `${ENC_PREFIX}.${saltHex}.${cipher}`;
}

export async function decryptBackupPayload(
  raw: string,
  password: string
): Promise<BackupPayload> {
  const parts = raw.trim().split('.');
  if (parts.length !== 3 || parts[0] !== ENC_PREFIX) {
    throw new Error('Not an encrypted FinTrack backup');
  }
  const [, saltHex, cipher] = parts;
  const keyHex = await deriveKeyBytes(password, saltHex);
  const json = decodeXorPayload(cipher, keyHex);
  const payload = JSON.parse(json) as BackupPayload;
  if (payload.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error(`Unsupported backup version: ${payload.schemaVersion}`);
  }
  return payload;
}

export async function exportEncryptedBackup(password: string): Promise<string> {
  if (password.length < 4)
    throw new Error('Password must be at least 4 characters');
  const payload = await buildBackupPayload();
  const enc = await encryptBackupPayload(payload, password);
  const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!base) throw new Error('No writable directory available');
  const path = `${base}fintrack-backup-${Date.now()}.ftenc`;
  await FileSystem.writeAsStringAsync(path, enc);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: 'application/octet-stream',
      dialogTitle: 'Export encrypted FinTrack backup',
    });
  }
  return path;
}

export async function pickAndReadBackupFile(): Promise<string> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', 'application/octet-stream', '*/*'],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]?.uri) {
    throw new Error('Cancelled');
  }
  return FileSystem.readAsStringAsync(result.assets[0].uri);
}

export async function importBackupFromText(
  text: string,
  password?: string
): Promise<void> {
  let payload: BackupPayload;
  if (text.trim().startsWith(ENC_PREFIX)) {
    if (!password) throw new Error('Password required for encrypted backup');
    payload = await decryptBackupPayload(text, password);
  } else {
    payload = JSON.parse(text) as BackupPayload;
  }
  await restoreBackupPayload(payload);
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

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export type CsvImportPreview = {
  rows: {
    type: 'expense' | 'income';
    amount: number;
    title: string;
    note?: string;
    occurredAt: Date;
    currencyCode: string;
  }[];
  skipped: number;
};

export function parseTransactionsCsv(
  csv: string,
  defaultCurrency: string
): CsvImportPreview {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return { rows: [], skipped: 0 };

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const idx = (names: string[]) =>
    header.findIndex((h) => names.some((n) => h === n || h.includes(n)));

  const typeIdx = idx(['type']);
  const amountIdx = idx(['amount_minor', 'amount']);
  const titleIdx = idx(['title', 'description', 'name']);
  const noteIdx = idx(['note']);
  const dateIdx = idx(['occurred_at', 'date']);
  const currencyIdx = idx(['currency', 'currency_code']);
  const isMinor = header[amountIdx]?.includes('minor');

  const rows: CsvImportPreview['rows'] = [];
  let skipped = 0;

  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const rawAmount = Number.parseFloat(cols[amountIdx] ?? '');
    if (!Number.isFinite(rawAmount)) {
      skipped += 1;
      continue;
    }
    const typeRaw = (cols[typeIdx] ?? 'expense').toLowerCase();
    const type: 'expense' | 'income' =
      typeRaw === 'income' ? 'income' : 'expense';
    const currencyCode = (cols[currencyIdx] || defaultCurrency).toUpperCase();
    const amount = isMinor
      ? fromMinorUnits(Math.abs(Math.round(rawAmount)), currencyCode)
      : Math.abs(rawAmount);
    const title = cols[titleIdx]?.trim() || 'Imported';
    const note = cols[noteIdx]?.trim() || undefined;
    const dateRaw = cols[dateIdx];
    const occurredAt = dateRaw ? new Date(dateRaw) : new Date();
    if (Number.isNaN(occurredAt.getTime())) {
      skipped += 1;
      continue;
    }
    rows.push({ type, amount, title, note, occurredAt, currencyCode });
  }

  return { rows, skipped };
}

export async function pickAndImportTransactionsCsv(input: {
  accountId: string;
  defaultCurrency: string;
}): Promise<{ imported: number; skipped: number }> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]?.uri) {
    throw new Error('Cancelled');
  }
  const text = await FileSystem.readAsStringAsync(result.assets[0].uri);
  const preview = parseTransactionsCsv(text, input.defaultCurrency);
  for (const row of preview.rows) {
    await createTransaction(db, {
      accountId: input.accountId,
      type: row.type,
      amount: row.amount,
      currencyCode: row.currencyCode || input.defaultCurrency,
      title: row.title,
      note: row.note,
      occurredAt: row.occurredAt,
    });
  }
  return { imported: preview.rows.length, skipped: preview.skipped };
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
