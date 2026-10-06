import { z } from 'zod';

import {
  type AddTransactionFormValues,
  getAddTransactionSaveAvailability,
  resolveDefaultAccountId,
  submitAddTransaction,
  validateAddTransactionInput,
} from '@/features/transactions/submit-add-transaction';
import { parseAmountToMinor } from '@/lib/money';

const accounts = [
  { id: 'acc-1', currencyCode: 'USD', name: 'Cash' },
  { id: 'acc-2', currencyCode: 'USD', name: 'Bank' },
];

const baseValues: AddTransactionFormValues = {
  mode: 'expense',
  amount: '12.50',
  title: 'Coffee',
  note: '',
  tags: '',
  accountId: 'acc-1',
  toAccountId: '',
  categoryId: 'cat-1',
};

const deps = {
  accounts,
  currency: 'USD',
  parseAmountToMinor: (amount: string) => parseAmountToMinor(amount, 'USD'),
  createTransaction: jest.fn(),
  createTransfer: jest.fn(),
};

describe('resolveDefaultAccountId', () => {
  it('falls back to the first account when activeAccountId is missing', () => {
    expect(resolveDefaultAccountId(accounts, 'deleted-id')).toBe('acc-1');
  });

  it('uses activeAccountId when it exists in the account list', () => {
    expect(resolveDefaultAccountId(accounts, 'acc-2')).toBe('acc-2');
  });
});

describe('getAddTransactionSaveAvailability', () => {
  it('disables save with "Add an account first" when there are no accounts', () => {
    const state = getAddTransactionSaveAvailability(true, 0);
    expect(state).toEqual({
      disabled: true,
      reason: 'no_accounts',
      message: 'Add an account first',
    });
  });

  it('disables save while accounts are still loading', () => {
    expect(getAddTransactionSaveAvailability(false, 1)).toEqual({
      disabled: true,
      reason: 'loading',
    });
  });
});

describe('validateAddTransactionInput', () => {
  it('requires a non-blank title for expenses', () => {
    expect(
      validateAddTransactionInput(
        { ...baseValues, title: '   ' },
        accounts,
        'USD',
        deps.parseAmountToMinor
      )
    ).toEqual({
      type: 'field',
      field: 'title',
      message: 'Add a title',
    });
  });

  it('rejects zero and empty amounts', () => {
    expect(
      validateAddTransactionInput(
        { ...baseValues, amount: '0' },
        accounts,
        'USD',
        deps.parseAmountToMinor
      )
    ).toEqual({
      type: 'field',
      field: 'amount',
      message: 'Enter a valid amount',
    });

    expect(
      validateAddTransactionInput(
        { ...baseValues, amount: '' },
        accounts,
        'USD',
        deps.parseAmountToMinor
      )
    ).toEqual({
      type: 'field',
      field: 'amount',
      message: 'Enter a valid amount',
    });
  });

  it('rejects transfer without a distinct destination account', () => {
    expect(
      validateAddTransactionInput(
        {
          ...baseValues,
          mode: 'transfer',
          toAccountId: '',
        },
        accounts,
        'USD',
        deps.parseAmountToMinor
      )
    ).toEqual({
      type: 'field',
      field: 'toAccountId',
      message: 'Pick a different destination account',
    });

    expect(
      validateAddTransactionInput(
        {
          ...baseValues,
          mode: 'transfer',
          toAccountId: 'acc-1',
        },
        accounts,
        'USD',
        deps.parseAmountToMinor
      )
    ).toEqual({
      type: 'field',
      field: 'toAccountId',
      message: 'Pick a different destination account',
    });
  });

  it('rejects titles over the max length', () => {
    expect(
      validateAddTransactionInput(
        { ...baseValues, title: 'x'.repeat(121) },
        accounts,
        'USD',
        deps.parseAmountToMinor
      )
    ).toEqual({
      type: 'field',
      field: 'title',
      message: 'Title must be 120 characters or fewer',
    });
  });
});

describe('submitAddTransaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a field error when accountId is empty', async () => {
    const createTransaction = jest.fn();
    const result = await submitAddTransaction(
      { ...baseValues, accountId: '' },
      {
        ...deps,
        createTransaction,
      }
    );

    expect(result).toEqual({
      ok: false,
      error: {
        type: 'field',
        field: 'accountId',
        message: 'Select an account',
      },
    });
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it('calls createTransaction once with parsed minor units for a valid expense', async () => {
    const createTransaction = jest.fn().mockResolvedValue('tx-1');

    const result = await submitAddTransaction(baseValues, {
      ...deps,
      createTransaction,
    });

    expect(result).toEqual({ ok: true, transactionId: 'tx-1' });
    expect(createTransaction).toHaveBeenCalledTimes(1);
    expect(createTransaction).toHaveBeenCalledWith({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: 'expense',
      amountMinor: 1250,
      currencyCode: 'USD',
      title: 'Coffee',
      note: '',
      tagNames: [],
    });
  });

  it('returns the real database error message when createTransaction rejects', async () => {
    const createTransaction = jest
      .fn()
      .mockRejectedValue(new Error('constraint failed'));

    await expect(
      submitAddTransaction(baseValues, {
        ...deps,
        createTransaction,
      })
    ).resolves.toEqual({
      ok: false,
      error: { type: 'database', message: 'constraint failed' },
    });
  });

  it('maps Zod validation errors to readable field messages', async () => {
    const titleSchema = z.object({ title: z.string().max(120) });
    const zodResult = titleSchema.safeParse({ title: 'x'.repeat(121) });
    if (zodResult.success) {
      throw new Error('expected zod failure');
    }
    const createTransaction = jest.fn().mockRejectedValue(zodResult.error);

    const result = await submitAddTransaction(baseValues, {
      ...deps,
      createTransaction,
    });

    expect(result.ok).toBe(false);
    if (!result.ok && result.error.type === 'field') {
      expect(result.error.field).toBe('title');
      expect(result.error.message.length).toBeGreaterThan(0);
      expect(result.error.message).not.toContain('[');
    } else {
      throw new Error('expected field error');
    }
  });
});
