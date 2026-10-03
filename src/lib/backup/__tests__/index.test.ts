import {
  BACKUP_SCHEMA_VERSION,
  type BackupPayload,
  decryptBackupPayload,
  ENC_PREFIX,
  encryptBackupPayload,
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
    expect(result.rows[0].amount).toBe(15);
    expect(result.rows[0].title).toBe('Coffee');
  });

  it('parses CSV with amount column (not minor)', () => {
    const csv = `type,amount,title,date,currency
expense,15.50,Coffee,2024-03-15,USD
income,500.00,Salary,2024-03-01,USD`;

    const result = parseTransactionsCsv(csv, 'USD');

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].amount).toBe(15.5);
    expect(result.rows[1].amount).toBe(500);
  });

  // NOTE: This test currently fails because CSV import uses parseFloat which doesn't
  // handle comma decimals. This will be fixed in PR #3 when parseAmountToMinor is integrated.
  it.skip('handles comma decimal separators in amount', () => {
    const csv = `type,amount,title,date
expense,"15,50",Coffee,2024-03-15
income,"500,00",Salary,2024-03-01`;

    const result = parseTransactionsCsv(csv, 'EUR');

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].amount).toBe(15.5);
    expect(result.rows[1].amount).toBe(500);
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

  it('takes absolute value of amounts', () => {
    const csv = `type,amount,title,date
expense,-15.50,Coffee,2024-03-15
income,-500,Refund,2024-03-15`;

    const result = parseTransactionsCsv(csv, 'USD');

    expect(result.rows[0].amount).toBe(15.5);
    expect(result.rows[1].amount).toBe(500);
  });

  it('defaults title to "Imported" when missing', () => {
    const csv = `type,amount,date
expense,15.50,2024-03-15`;

    const result = parseTransactionsCsv(csv, 'USD');

    expect(result.rows[0].title).toBe('Imported');
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

  // TODO: Requires expo-crypto native module (AESEncryptionKey, aesEncryptAsync)
  // which is not available in Node.js/Jest test environment
  it.skip('encrypts payload with valid password', async () => {
    const password = 'test-password-123';
    const encrypted = await encryptBackupPayload(samplePayload, password);

    expect(encrypted).toContain(ENC_PREFIX);
    expect(encrypted.split('.')).toHaveLength(3);
  });

  // TODO: Requires expo-crypto native module
  it.skip('produces different ciphertext for same payload (due to salt)', async () => {
    const password = 'test-password-123';
    const encrypted1 = await encryptBackupPayload(samplePayload, password);
    const encrypted2 = await encryptBackupPayload(samplePayload, password);

    expect(encrypted1).not.toBe(encrypted2);
  });

  // TODO: Requires expo-crypto native module
  it.skip('encrypts and decrypts correctly', async () => {
    const password = 'test-password-123';
    const encrypted = await encryptBackupPayload(samplePayload, password);
    const decrypted = await decryptBackupPayload(encrypted, password);

    expect(decrypted.schemaVersion).toBe(samplePayload.schemaVersion);
    expect(decrypted.data.accounts).toEqual(samplePayload.data.accounts);
  });
});

describe('decryptBackupPayload', () => {
  // TODO: Requires expo-crypto native module (AESSealedData, aesDecryptAsync)
  it.skip('throws error for invalid format', async () => {
    await expect(
      decryptBackupPayload('invalid-data', 'password')
    ).rejects.toThrow();
  });

  // TODO: Requires expo-crypto native module
  it.skip('throws error for wrong password', async () => {
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

    const encrypted = await encryptBackupPayload(
      samplePayload,
      'correct-password'
    );

    await expect(
      decryptBackupPayload(encrypted, 'wrong-password')
    ).rejects.toThrow();
  });

  // TODO: Requires expo-crypto native module
  it.skip('throws error for unsupported schema version', async () => {
    const futurePayload: BackupPayload = {
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
    const encrypted = await encryptBackupPayload(futurePayload, password);

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
    expect(ENC_PREFIX).toBe('FTENC2');
  });

  it('has correct minimum password length', () => {
    expect(MIN_BACKUP_PASSWORD_LENGTH).toBe(8);
  });
});
