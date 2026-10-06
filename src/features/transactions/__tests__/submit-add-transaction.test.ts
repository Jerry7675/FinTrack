import {
  type AddTransactionFormValues,
  getAddTransactionSaveAvailability,
  submitAddTransaction,
} from '@/features/transactions/submit-add-transaction';

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

describe('submitAddTransaction', () => {
  it('returns a field error when accountId is empty', async () => {
    const createTransaction = jest.fn();
    const result = await submitAddTransaction(
      { ...baseValues, accountId: '' },
      {
        accounts,
        currency: 'USD',
        parseAmountToMinor: () => 1250,
        createTransaction,
        createTransfer: jest.fn(),
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
    const parseAmountToMinor = jest.fn().mockReturnValue(1250);

    const result = await submitAddTransaction(baseValues, {
      accounts,
      currency: 'USD',
      parseAmountToMinor,
      createTransaction,
      createTransfer: jest.fn(),
    });

    expect(result).toEqual({ ok: true, transactionId: 'tx-1' });
    expect(parseAmountToMinor).toHaveBeenCalledWith('12.50', 'USD');
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
        accounts,
        currency: 'USD',
        parseAmountToMinor: () => 1250,
        createTransaction,
        createTransfer: jest.fn(),
      })
    ).resolves.toEqual({
      ok: false,
      error: { type: 'database', message: 'constraint failed' },
    });
  });
});
