import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { AppDatabase } from '@/lib/db/client';
import {
  addGoalContribution,
  createGoal,
  createTransaction,
  createTransfer,
  recordDebtPayment,
} from '@/lib/db/queries';
import { MAX_MINOR } from '@/lib/money';
import { transactionInputSchema } from '@/lib/validation';

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

  it('validates against real zod schema', async () => {
    const validInput = {
      accountId: 'acc1',
      type: 'expense' as const,
      amountMinor: 1500,
      currencyCode: 'USD',
      title: 'Test',
    };

    const invalidInputs = [
      { ...validInput, amountMinor: 0 },
      { ...validInput, amountMinor: -100 },
      { ...validInput, amountMinor: MAX_MINOR },
      { ...validInput, amountMinor: MAX_MINOR + 1 },
      { ...validInput, amountMinor: 1.5 },
    ];

    expect(() => transactionInputSchema.parse(validInput)).not.toThrow();
    expect(() =>
      transactionInputSchema.parse({
        ...validInput,
        amountMinor: MAX_MINOR - 1,
      })
    ).not.toThrow();

    for (const input of invalidInputs) {
      expect(() => transactionInputSchema.parse(input)).toThrow();
    }
  });
});

describe('createGoal', () => {
  it('rejects negative starting amounts', async () => {
    const mockDb = {
      insert: jest.fn().mockReturnValue({
        values: jest.fn(),
      }),
    } as unknown as AppDatabase;

    await expect(
      createGoal(mockDb, {
        name: 'My Goal',
        targetMinor: 10000,
        currentMinor: -500,
        currencyCode: 'USD',
      })
    ).rejects.toThrow('Starting amount cannot be negative');
  });
});

describe('createTransfer', () => {
  it('uses amountMinor for same-currency transfers', async () => {
    let insertedArray: any = null;
    const mockDb = {
      insert: jest.fn(() => ({
        values: jest.fn((vals) => {
          insertedArray = vals;
          return Promise.resolve();
        }),
      })),
    } as unknown as AppDatabase;

    await createTransfer(mockDb, {
      fromAccountId: 'acc1',
      toAccountId: 'acc2',
      amountMinor: 1500,
      fromCurrency: 'USD',
      toCurrency: 'USD',
      title: 'Test Transfer',
    });

    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    expect(Array.isArray(insertedArray)).toBe(true);
    expect(insertedArray).toHaveLength(2);
    const amounts = insertedArray.map((txn: any) => txn.amountMinor);
    expect(amounts).toEqual([-1500, 1500]);
  });
});

describe('addGoalContribution', () => {
  it('applies amountMinor correctly', async () => {
    const updatedValues: any[] = [];
    const mockDb = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn(() =>
              Promise.resolve([
                { id: 'goal1', currentMinor: 5000, currencyCode: 'USD' },
              ])
            ),
          })),
        })),
      })),
      update: jest.fn(() => ({
        set: jest.fn((vals) => {
          updatedValues.push(vals);
          return {
            where: jest.fn(() => Promise.resolve()),
          };
        }),
      })),
    } as unknown as AppDatabase;

    await addGoalContribution(mockDb, 'goal1', { amountMinor: 1500 });

    expect(updatedValues).toHaveLength(1);
    expect(updatedValues[0].currentMinor).toBe(6500);
  });

  it('applies amount via toMinorUnits when amountMinor not provided', async () => {
    const updatedValues: any[] = [];
    const mockDb = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn(() =>
              Promise.resolve([
                { id: 'goal1', currentMinor: 5000, currencyCode: 'USD' },
              ])
            ),
          })),
        })),
      })),
      update: jest.fn(() => ({
        set: jest.fn((vals) => {
          updatedValues.push(vals);
          return {
            where: jest.fn(() => Promise.resolve()),
          };
        }),
      })),
    } as unknown as AppDatabase;

    await addGoalContribution(mockDb, 'goal1', {
      amount: 15,
      currencyCode: 'USD',
    });

    expect(updatedValues).toHaveLength(1);
    expect(updatedValues[0].currentMinor).toBe(6500);
  });
});

describe('recordDebtPayment', () => {
  it('applies amountMinor correctly', async () => {
    const updatedValues: any[] = [];
    const mockDb = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn(() =>
              Promise.resolve([
                { id: 'debt1', remainingMinor: 10000, currencyCode: 'USD' },
              ])
            ),
          })),
        })),
      })),
      update: jest.fn(() => ({
        set: jest.fn((vals) => {
          updatedValues.push(vals);
          return {
            where: jest.fn(() => Promise.resolve()),
          };
        }),
      })),
    } as unknown as AppDatabase;

    await recordDebtPayment(mockDb, 'debt1', { amountMinor: 3000 });

    expect(updatedValues).toHaveLength(1);
    expect(updatedValues[0].remainingMinor).toBe(7000);
  });

  it('applies amount via toMinorUnits when amountMinor not provided', async () => {
    const updatedValues: any[] = [];
    const mockDb = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn(() =>
              Promise.resolve([
                { id: 'debt1', remainingMinor: 10000, currencyCode: 'USD' },
              ])
            ),
          })),
        })),
      })),
      update: jest.fn(() => ({
        set: jest.fn((vals) => {
          updatedValues.push(vals);
          return {
            where: jest.fn(() => Promise.resolve()),
          };
        }),
      })),
    } as unknown as AppDatabase;

    await recordDebtPayment(mockDb, 'debt1', {
      amount: 30,
      currencyCode: 'USD',
    });

    expect(updatedValues).toHaveLength(1);
    expect(updatedValues[0].remainingMinor).toBe(7000);
  });
});
