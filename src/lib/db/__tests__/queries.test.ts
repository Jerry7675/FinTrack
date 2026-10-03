import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { AppDatabase } from '@/lib/db/client';
import { createTransaction } from '@/lib/db/queries';

describe('createTransaction', () => {
  let mockDatabase: AppDatabase;
  let insertedValues: unknown[];

  beforeEach(() => {
    insertedValues = [];
    mockDatabase = {
      insert: jest.fn(() => ({
        values: jest.fn((vals) => {
          insertedValues.push(vals);
          return Promise.resolve();
        }),
      })),
    } as unknown as AppDatabase;
  });

  it('accepts positive amountMinor', async () => {
    await createTransaction(mockDatabase, {
      accountId: 'acc1',
      categoryId: 'cat1',
      type: 'expense',
      amountMinor: 1500,
      currencyCode: 'USD',
      title: 'Coffee',
    });

    expect(insertedValues).toHaveLength(1);
    const inserted = insertedValues[0] as Record<string, unknown>;
    expect(inserted.amountMinor).toBe(1500);
    expect(inserted.title).toBe('Coffee');
  });

  it('rejects zero amountMinor', async () => {
    await expect(
      createTransaction(mockDatabase, {
        accountId: 'acc1',
        type: 'expense',
        amountMinor: 0,
        currencyCode: 'USD',
        title: 'Free item',
      })
    ).rejects.toThrow();
  });

  it('rejects negative amountMinor in validation', async () => {
    await expect(
      createTransaction(mockDatabase, {
        accountId: 'acc1',
        type: 'expense',
        amountMinor: -1500,
        currencyCode: 'USD',
        title: 'Transaction',
      })
    ).rejects.toThrow();
  });

  it('falls back to legacy float amount when amountMinor not provided', async () => {
    await createTransaction(mockDatabase, {
      accountId: 'acc1',
      type: 'expense',
      amount: 15.5,
      currencyCode: 'USD',
      title: 'Legacy',
    });

    expect(insertedValues).toHaveLength(1);
    const inserted = insertedValues[0] as Record<string, unknown>;
    expect(inserted.amountMinor).toBe(1550);
  });

  it('prefers amountMinor over amount when both provided', async () => {
    await createTransaction(mockDatabase, {
      accountId: 'acc1',
      type: 'expense',
      amountMinor: 1500,
      amount: 20.0,
      currencyCode: 'USD',
      title: 'Prefer minor',
    });

    expect(insertedValues).toHaveLength(1);
    const inserted = insertedValues[0] as Record<string, unknown>;
    expect(inserted.amountMinor).toBe(1500);
  });

  it('requires positive amountMinor in validation', async () => {
    await expect(
      createTransaction(mockDatabase, {
        accountId: 'acc1',
        type: 'expense',
        amountMinor: -1,
        currencyCode: 'USD',
        title: 'Should fail',
      })
    ).rejects.toThrow();
  });
});
