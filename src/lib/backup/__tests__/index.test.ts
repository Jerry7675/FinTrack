import * as ExpoCrypto from 'expo-crypto';

import {
  BACKUP_SCHEMA_VERSION,
  type BackupPayload,
  decryptBackupPayload,
  ENC_PREFIX,
  ENC_PREFIX_V3,
  encryptBackupPayload,
  KDF_ROUNDS_V3,
  MIN_BACKUP_PASSWORD_LENGTH,
  parseTransactionsCsv,
} from '@/lib/backup';

describe('parseTransactionsCsv', () => {
  it('parses basic CSV with amount_minor column', () => {
    const csv = `id,type,amount_minor,title,occurred_at,currency
tx1,expense,1500,Coffee,2024-03-15T10:00:00Z,USD
tx2,income,50000,Salary,2024-03-01T00:00:00Z,USD`;

    const result = parseTransactionsCsv(csv, 'USD');

    expect(result.rows).toHaveLength(2);
    expect(result.skipped).toBe(0);
    expect(result.rows[0].type).toBe('expense');
    expect(result.rows[0].amountMinor).toBe(1500);
    expect(result.rows[0].title).toBe('Coffee');
  });

  it('parses CSV with amount column (not minor)', () => {
    const csv = `type,amount,title,date,currency
expense,15.50,Coffee,2024-03-15,USD
income,500.00,Salary,2024-03-01,USD`;

    const result = parseTransactionsCsv(csv, 'USD');

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].amountMinor).toBe(1550);
    expect(result.rows[1].amountMinor).toBe(50000);
  });

  it('handles comma decimal separators in amount', () => {
    const csv = `type,amount,title,date
expense,"15,50",Coffee,2024-03-15
income,"500,00",Salary,2024-03-01`;

    const result = parseTransactionsCsv(csv, 'EUR');

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].amountMinor).toBe(1550);
    expect(result.rows[1].amountMinor).toBe(50000);
  });

  it('skips rows with invalid amounts', () => {
    const csv = `type,amount,title,date
expense,invalid,Coffee,2024-03-15
income,500,Salary,2024-03-01`;

    const result = parseTransactionsCsv(csv, 'USD');

    expect(result.rows).toHaveLength(1);
    expect(result.skipped).toBe(1);
    expect(result.rows[0].title).toBe('Salary');
  });

  it('skips rows with invalid dates', () => {
    const csv = `type,amount,title,date
expense,15.50,Coffee,invalid-date
income,500,Salary,2024-03-01`;

    const result = parseTransactionsCsv(csv, 'USD');

    expect(result.rows).toHaveLength(1);
    expect(result.skipped).toBe(1);
  });

  it('defaults to expense when type is missing', () => {
    const csv = `amount,title,date
15.50,Coffee,2024-03-15`;

    const result = parseTransactionsCsv(csv, 'USD');

    expect(result.rows[0].type).toBe('expense');
  });

  it('uses default currency when not specified', () => {
    const csv = `type,amount,title,date
expense,15.50,Coffee,2024-03-15`;

    const result = parseTransactionsCsv(csv, 'EUR');

    expect(result.rows[0].currencyCode).toBe('EUR');
  });

  it('handles quoted CSV values with commas', () => {
    const csv = `type,amount,title,note,date
expense,15.50,"Coffee, Tea",Test note,2024-03-15`;

    const result = parseTransactionsCsv(csv, 'USD');

    expect(result.rows[0].title).toBe('Coffee, Tea');
  });

  it('handles quoted CSV values with escaped quotes', () => {
    const csv = `type,amount,title,note,date
expense,15.50,"Coffee ""Special""",Test,2024-03-15`;

    const result = parseTransactionsCsv(csv, 'USD');

    expect(result.rows[0].title).toBe('Coffee "Special"');
  });

  // Pins current parser behaviour: amounts are parsed via parseAmountToMinor, which
  // rejects invalid negatives but still accepts signed values that become |minor|.
  // Intended product behaviour is to reject negatives or preserve sign — not yet enforced.
  it('takes absolute value of amounts', () => {
    const csv = `type,amount,title,date
expense,-15.50,Coffee,2024-03-15
income,-500,Refund,2024-03-15`;

    const result = parseTransactionsCsv(csv, 'USD');

    expect(result.rows[0].amountMinor).toBe(1550);
    expect(result.rows[1].amountMinor).toBe(50000);
  });

  it('defaults title to "Imported" when missing', () => {
    const csv = `type,amount,date
expense,15.50,2024-03-15`;

    const result = parseTransactionsCsv(csv, 'USD');

    expect(result.rows[0].title).toBe('Imported');
  });

  it('skips amount_minor over MAX_MINOR in CSV', () => {
    const csv = `type,amount_minor,title,date
expense,10000000000000,Huge,2024-03-15
expense,1500,Small,2024-03-15`;

    const result = parseTransactionsCsv(csv, 'USD');

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].title).toBe('Small');
    expect(result.skipped).toBe(1);
  });

  it('skips malformed negative amounts like --5', () => {
    const csv = `type,amount,title,date
expense,--5,Bad,2024-03-15
expense,-5,Good,2024-03-15
expense,5,Also Good,2024-03-15`;

    const result = parseTransactionsCsv(csv, 'USD');

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].title).toBe('Good');
    expect(result.rows[1].title).toBe('Also Good');
    expect(result.skipped).toBe(1);
  });

  it('uses current date when date is missing', () => {
    const csv = `type,amount,title
expense,15.50,Coffee`;

    const result = parseTransactionsCsv(csv, 'USD');

    expect(result.rows[0].occurredAt).toBeInstanceOf(Date);
  });

  it('returns empty result for empty CSV', () => {
    const result = parseTransactionsCsv('', 'USD');

    expect(result.rows).toHaveLength(0);
    expect(result.skipped).toBe(0);
  });

  it('returns empty result for CSV with only headers', () => {
    const csv = 'type,amount,title,date';

    const result = parseTransactionsCsv(csv, 'USD');

    expect(result.rows).toHaveLength(0);
    expect(result.skipped).toBe(0);
  });

  it('handles various column name variations', () => {
    const csv = `transaction_type,description,amount,transaction_date
expense,Coffee,15.50,2024-03-15`;

    const result = parseTransactionsCsv(csv, 'USD');

    expect(result.rows).toHaveLength(1);
  });
});

describe('encryptBackupPayload', () => {
  const samplePayload: BackupPayload = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      accountGroups: [],
      accounts: [],
      categories: [],
      tags: [],
      transactions: [],
      transactionTags: [],
      budgets: [],
      recurringTemplates: [],
      goals: [],
      subscriptions: [],
      debts: [],
      settings: [],
    },
  };

  it('encrypts payload with valid password', async () => {
    const password = 'test-password-123';
    const encrypted = await encryptBackupPayload(samplePayload, password);

    expect(encrypted.startsWith(`${ENC_PREFIX_V3}.`)).toBe(true);
    expect(encrypted.split('.')).toHaveLength(3);
  });

  it('produces different ciphertext for same payload (due to salt)', async () => {
    const password = 'test-password-123';
    const encrypted1 = await encryptBackupPayload(samplePayload, password);
    const encrypted2 = await encryptBackupPayload(samplePayload, password);

    expect(encrypted1).not.toBe(encrypted2);
  });

  it('runs repeated SHA-256 digest rounds when deriving keys', async () => {
    const digest = ExpoCrypto.digestStringAsync as jest.Mock;
    digest.mockClear();
    await encryptBackupPayload(samplePayload, 'test-password-123');
    expect(digest).toHaveBeenCalledTimes(KDF_ROUNDS_V3);
  });

  it('encrypts and decrypts correctly', async () => {
    const password = 'test-password-123';
    const encrypted = await encryptBackupPayload(samplePayload, password);
    const decrypted = await decryptBackupPayload(encrypted, password);

    expect(decrypted.schemaVersion).toBe(samplePayload.schemaVersion);
    expect(decrypted.data.accounts).toEqual(samplePayload.data.accounts);
  });
});

describe('decryptBackupPayload', () => {
  const samplePayload: BackupPayload = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      accountGroups: [],
      accounts: [],
      categories: [],
      tags: [],
      transactions: [],
      transactionTags: [],
      budgets: [],
      recurringTemplates: [],
      goals: [],
      subscriptions: [],
      debts: [],
      settings: [],
    },
  };

  it('throws error for invalid format with expected message', async () => {
    await expect(
      decryptBackupPayload('invalid-data', 'password')
    ).rejects.toThrow('Not an encrypted FinTrack backup');
  });

  it('rejects legacy FTENC1 backups with expected message', async () => {
    await expect(
      decryptBackupPayload('FTENC1.deadbeef.ciphertext', 'password')
    ).rejects.toThrow(
      'This backup uses an outdated encryption format. Re-export from a newer FinTrack build.'
    );
  });

  it('rejects backups that do not have exactly three dot-separated parts', async () => {
    await expect(
      decryptBackupPayload('FTENC2.onlysalt', 'password')
    ).rejects.toThrow('Not an encrypted FinTrack backup');
  });

  it('uses salt from the file when deriving the key (wrong salt breaks decrypt)', async () => {
    const password = 'test-password-123';
    const encrypted = await encryptBackupPayload(samplePayload, password);
    const parts = encrypted.split('.');
    expect(parts).toHaveLength(3);
    const tamperedSalt = parts[1].replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'));
    const tampered = `${parts[0]}.${tamperedSalt}.${parts[2]}`;
    await expect(decryptBackupPayload(tampered, password)).rejects.toThrow(
      /Wrong password or corrupted backup/
    );
  });

  it('throws error for wrong password', async () => {
    const encrypted = await encryptBackupPayload(
      samplePayload,
      'correct-password'
    );

    await expect(
      decryptBackupPayload(encrypted, 'wrong-password')
    ).rejects.toThrow(/Wrong password or corrupted backup/);
  });

  it('throws error for unsupported schema version', async () => {
    const futurePayload = {
      schemaVersion: 999,
      exportedAt: new Date().toISOString(),
      data: {
        accountGroups: [],
        accounts: [],
        categories: [],
        tags: [],
        transactions: [],
        transactionTags: [],
        budgets: [],
        recurringTemplates: [],
        goals: [],
        subscriptions: [],
        debts: [],
        settings: [],
      },
    };

    const password = 'test-password';
    const encrypted = await encryptBackupPayload(
      futurePayload as unknown as BackupPayload,
      password
    );

    await expect(decryptBackupPayload(encrypted, password)).rejects.toThrow(
      /version/i
    );
  });
});

describe('backup constants', () => {
  it('has correct schema version', () => {
    expect(BACKUP_SCHEMA_VERSION).toBe(1);
  });

  it('has correct encryption prefix', () => {
    expect(ENC_PREFIX).toBe('FTENC3');
  });

  it('has correct minimum password length', () => {
    expect(MIN_BACKUP_PASSWORD_LENGTH).toBe(8);
  });
});
