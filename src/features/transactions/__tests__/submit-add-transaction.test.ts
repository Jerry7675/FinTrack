import { z } from 'zod';

import {
  type AddTransactionFormValues,
  defaultTransactionDateString,
  getAddTransactionSaveAvailability,
  occurredAtFromSelectedDate,
  resolveDefaultAccountId,
  resolveTransactionTitle,
  submitAddTransaction,
  validateAddTransactionInput,
  validateTransactionDate,
} from '@/features/transactions/submit-add-transaction';
import { parseAmountToMinor } from '@/lib/money';

function localNoon(year: number, monthIndex: number, day: number): Date {
  return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

const FIXED_NOW = localNoon(2024, 5, 15);

const accounts = [
  { id: 'acc-1', currencyCode: 'USD', name: 'Cash' },
  { id: 'acc-2', currencyCode: 'USD', name: 'Bank' },
];

const categories = [{ id: 'cat-1', name: 'Food' }];

const baseValues: AddTransactionFormValues = {
  mode: 'expense',
  amount: '12.50',
  date: defaultTransactionDateString(FIXED_NOW),
  title: 'Coffee',
  note: '',
  tags: '',
  accountId: 'acc-1',
  toAccountId: '',
  categoryId: 'cat-1',
};

const deps = {
  accounts,
  categories,
  currency: 'USD',
  now: FIXED_NOW,
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

describe('resolveTransactionTitle', () => {
  it('uses the category name when title is blank', () => {
    expect(
      resolveTransactionTitle({ ...baseValues, title: '   ' }, categories)
    ).toBe('Food');
  });

  it('keeps a typed title', () => {
    expect(resolveTransactionTitle(baseValues, categories)).toBe('Coffee');
  });

  it('truncates a long category name to the title max', () => {
    const longName = 'x'.repeat(130);
    expect(
      resolveTransactionTitle(
        { ...baseValues, title: '', categoryId: 'cat-long' },
        [{ id: 'cat-long', name: longName }]
      )
    ).toHaveLength(120);
  });
});

describe('validateTransactionDate', () => {
  it('rejects future dates relative to now', () => {
    const tomorrow = defaultTransactionDateString(
      new Date(
        FIXED_NOW.getFullYear(),
        FIXED_NOW.getMonth(),
        FIXED_NOW.getDate() + 1
      )
    );
    expect(validateTransactionDate(tomorrow, FIXED_NOW)).toEqual({
      type: 'field',
      field: 'date',
      message: 'Date cannot be in the future',
    });
  });

  it('rejects dates before 2000-01-01', () => {
    expect(validateTransactionDate('1999-12-31', FIXED_NOW)).toEqual({
      type: 'field',
      field: 'date',
      message: 'Date must be on or after 2000-01-01',
    });
  });

  it('accepts today and past dates', () => {
    const today = validateTransactionDate(
      defaultTransactionDateString(FIXED_NOW),
      FIXED_NOW
    );
    expect('occurredAt' in today).toBe(true);

    const past = validateTransactionDate('2024-01-01', FIXED_NOW);
    expect('occurredAt' in past).toBe(true);
  });

  it('rejects invalid date strings', () => {
    expect(validateTransactionDate('not-a-date', FIXED_NOW)).toEqual({
      type: 'field',
      field: 'date',
      message: 'Enter a valid date (YYYY-MM-DD)',
    });
  });
});

describe('occurredAtFromSelectedDate', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses exactly now when the selected date is today', () => {
    const now = localNoon(2024, 5, 15);
    now.setHours(15, 30, 45, 123);
    jest.setSystemTime(now);

    const result = validateTransactionDate('2024-06-15', now);
    expect('occurredAt' in result).toBe(true);
    if ('occurredAt' in result) {
      expect(result.occurredAt.getTime()).toBe(now.getTime());
    }
  });

  it('keeps the selected day with the current time of day for past dates', () => {
    const now = localNoon(2024, 5, 15);
    now.setHours(9, 15, 30, 500);
    jest.setSystemTime(now);

    const occurredAt = occurredAtFromSelectedDate(localNoon(2024, 5, 10), now);
    expect(occurredAt.getFullYear()).toBe(2024);
    expect(occurredAt.getMonth()).toBe(5);
    expect(occurredAt.getDate()).toBe(10);
    expect(occurredAt.getHours()).toBe(9);
    expect(occurredAt.getMinutes()).toBe(15);
    expect(occurredAt.getSeconds()).toBe(30);
    expect(occurredAt.getMilliseconds()).toBe(500);
  });
});

describe('validateAddTransactionInput', () => {
  it('allows a blank title for expenses (title resolved at save)', () => {
    expect(
      validateAddTransactionInput(
        { ...baseValues, title: '   ' },
        accounts,
        'USD',
        deps.parseAmountToMinor,
        FIXED_NOW
      )
    ).toBeNull();
  });

  it('rejects zero and empty amounts', () => {
    expect(
      validateAddTransactionInput(
        { ...baseValues, amount: '0' },
        accounts,
        'USD',
        deps.parseAmountToMinor,
        FIXED_NOW
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
        deps.parseAmountToMinor,
        FIXED_NOW
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
        deps.parseAmountToMinor,
        FIXED_NOW
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
        deps.parseAmountToMinor,
        FIXED_NOW
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
        deps.parseAmountToMinor,
        FIXED_NOW
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
      occurredAt: FIXED_NOW,
      tagNames: [],
    });
  });

  it('defaults blank title to the selected category name at save time', async () => {
    const createTransaction = jest.fn().mockResolvedValue('tx-2');

    await submitAddTransaction(
      { ...baseValues, title: '' },
      { ...deps, createTransaction }
    );

    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Food' })
    );
  });

  it('returns a title field error when category and title are both missing', async () => {
    const createTransaction = jest.fn();
    const result = await submitAddTransaction(
      {
        ...baseValues,
        title: '',
        categoryId: null,
      },
      {
        ...deps,
        categories: [],
        createTransaction,
      }
    );

    expect(result).toEqual({
      ok: false,
      error: {
        type: 'field',
        field: 'title',
        message: 'Select a category or add a title',
      },
    });
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it('truncates category-derived title to 120 characters at save time', async () => {
    const longName = 'y'.repeat(130);
    const createTransaction = jest.fn().mockResolvedValue('tx-3');

    await submitAddTransaction(
      { ...baseValues, title: '', categoryId: 'cat-long' },
      {
        ...deps,
        categories: [{ id: 'cat-long', name: longName }],
        createTransaction,
      }
    );

    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'y'.repeat(120) })
    );
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
