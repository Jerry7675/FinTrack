import { isNull } from 'drizzle-orm';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { type AppDatabase, db } from '@/lib/db/client';
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
import { MAX_MINOR, parseAmountToMinor } from '@/lib/money';

import {
  BACKUP_SCHEMA_VERSION,
  ENC_PREFIX_V3,
  isEncryptedBackupBlob,
  KDF_ROUNDS_V3,
  LEGACY_ENC_PREFIX,
  MIN_BACKUP_PASSWORD_LENGTH,
} from './constants';
import { openBackupCiphertext, sealBackupPlaintext } from './crypto';
import {
  applyBackupRestore,
  type RestoreBackupHooks,
} from './restore-transaction';
import {
  type ValidatedBackupPayload,
  validateBackupPayload,
} from './validate-payload';

export {
  BACKUP_SCHEMA_VERSION,
  ENC_PREFIX,
  ENC_PREFIX_V2,
  ENC_PREFIX_V3,
  KDF_ROUNDS_V2,
  KDF_ROUNDS_V3,
  MIN_BACKUP_PASSWORD_LENGTH,
} from './constants';
export {
  BackupValidationError,
  validateBackupPayload,
} from './validate-payload';

export type BackupPayload = ValidatedBackupPayload;

export type RestoreBackupOptions = {
  database?: AppDatabase;
  hooks?: RestoreBackupHooks;
};

export async function buildBackupPayload(
  database: AppDatabase = db
): Promise<BackupPayload> {
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
    database.select().from(accountGroups),
    database.select().from(accounts),
    database.select().from(categories),
    database.select().from(tags),
    database.select().from(transactions),
    database.select().from(transactionTags),
    database.select().from(budgets),
    database.select().from(recurringTemplates),
    database.select().from(goals),
    database.select().from(subscriptions),
    database.select().from(debts),
    database.select().from(settings),
  ]);

  const payload = {
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

  return validateBackupPayload(payload);
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

function utf8ToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

export async function encryptBackupPayload(
  payload: BackupPayload,
  password: string
): Promise<string> {
  const plaintext = utf8ToBytes(JSON.stringify(payload));
  return sealBackupPlaintext(plaintext, password, ENC_PREFIX_V3, KDF_ROUNDS_V3);
}

export async function decryptBackupPayload(
  raw: string,
  password: string
): Promise<BackupPayload> {
  const trimmed = raw.trim();
  if (trimmed.startsWith(`${LEGACY_ENC_PREFIX}.`)) {
    throw new Error(
      'This backup uses an outdated encryption format. Re-export from a newer FinTrack build.'
    );
  }
  let plaintext: Uint8Array;
  try {
    plaintext = await openBackupCiphertext(trimmed, password);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'Not an encrypted FinTrack backup'
    ) {
      throw error;
    }
    throw new Error('Wrong password or corrupted backup');
  }
  const json = bytesToUtf8(plaintext);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch {
    throw new Error('Wrong password or corrupted backup');
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    (parsed as { schemaVersion?: number }).schemaVersion !==
      BACKUP_SCHEMA_VERSION
  ) {
    const version = (parsed as { schemaVersion?: number })?.schemaVersion;
    if (typeof version === 'number') {
      throw new Error(`Unsupported backup version: ${version}`);
    }
    throw new Error('Wrong password or corrupted backup');
  }
  return validateBackupPayload(parsed);
}

export async function exportEncryptedBackup(password: string): Promise<string> {
  if (password.length < MIN_BACKUP_PASSWORD_LENGTH) {
    throw new Error(
      `Password must be at least ${MIN_BACKUP_PASSWORD_LENGTH} characters`
    );
  }
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
  const trimmed = text.trim();
  let payload: BackupPayload;
  if (isEncryptedBackupBlob(trimmed)) {
    if (!password) throw new Error('Password required for encrypted backup');
    payload = await decryptBackupPayload(text, password);
  } else {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      throw new Error('Invalid backup file');
    }
    payload = validateBackupPayload(parsed);
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
    amountMinor: number;
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

  if (amountIdx < 0) {
    throw new Error(
      'CSV is missing a required amount column (amount or amount_minor)'
    );
  }

  const isMinor = header[amountIdx]?.includes('minor');

  const rows: CsvImportPreview['rows'] = [];
  let skipped = 0;

  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const typeRaw = (cols[typeIdx] ?? 'expense').toLowerCase();
    const type: 'expense' | 'income' =
      typeRaw === 'income' ? 'income' : 'expense';
    const currencyCode = (cols[currencyIdx] || defaultCurrency).toUpperCase();

    let amountMinor: number;
    if (isMinor) {
      const rawAmount = cols[amountIdx] ?? '';
      if (!/^-?\d+$/.test(rawAmount.trim())) {
        skipped += 1;
        continue;
      }
      const parsedMinor = Number.parseInt(rawAmount, 10);
      if (
        !Number.isFinite(parsedMinor) ||
        !Number.isSafeInteger(parsedMinor) ||
        Math.abs(parsedMinor) >= MAX_MINOR
      ) {
        skipped += 1;
        continue;
      }
      amountMinor = Math.abs(parsedMinor);
    } else {
      const amountStr = cols[amountIdx] ?? '';
      const trimmed = amountStr.trim();

      if (trimmed.startsWith('--') || /^-[^0-9]/.test(trimmed)) {
        skipped += 1;
        continue;
      }

      const isNegative = trimmed.startsWith('-');
      const cleanedAmount = isNegative ? trimmed.slice(1) : trimmed;
      const parsedMinor = parseAmountToMinor(cleanedAmount, currencyCode);
      if (parsedMinor === null) {
        skipped += 1;
        continue;
      }
      amountMinor = Math.abs(parsedMinor);
    }

    const title = cols[titleIdx]?.trim() || 'Imported';
    const note = cols[noteIdx]?.trim() || undefined;
    const dateRaw = cols[dateIdx];
    const occurredAt = dateRaw ? new Date(dateRaw) : new Date();
    if (Number.isNaN(occurredAt.getTime())) {
      skipped += 1;
      continue;
    }
    rows.push({ type, amountMinor, title, note, occurredAt, currencyCode });
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
      amountMinor: row.amountMinor,
      currencyCode: row.currencyCode || input.defaultCurrency,
      title: row.title,
      note: row.note,
      occurredAt: row.occurredAt,
    });
  }
  return { imported: preview.rows.length, skipped: preview.skipped };
}

export function restoreBackupPayload(
  input: unknown,
  options?: RestoreBackupOptions
): void {
  const payload = validateBackupPayload(input);

  const database = options?.database ?? db;

  database.transaction((tx) => {
    applyBackupRestore(tx, payload.data, options?.hooks);
  });
}
