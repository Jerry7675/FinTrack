import {
  type ApplyScanContext,
  applyScanToForm,
  fillAmountAfterAccountSwitch,
} from '../apply';

const baseCtx = (): ApplyScanContext => ({
  account: { id: 'a1', name: 'Checking', currencyCode: 'USD' },
  accounts: [
    { id: 'a1', name: 'Checking', currencyCode: 'USD' },
    { id: 'a2', name: 'Euro', currencyCode: 'EUR' },
  ],
  expenseCategories: [
    { id: 'c-food', iconKey: 'food', sortOrder: 1 },
    { id: 'c-other', iconKey: 'other', sortOrder: 99 },
  ],
  today: '2026-10-06',
  userTouched: {
    amount: false,
    title: false,
    date: false,
    category: false,
  },
});

describe('applyScanToForm', () => {
  it('parses amount 23.45 USD', () => {
    const r = applyScanToForm(
      {
        amount: '23.45',
        currency: 'USD',
        date: null,
        merchant: null,
        categoryHint: null,
      },
      baseCtx()
    );
    expect(r.patch.amount).toBe('23.45');
    expect(r.filledCount).toBe(1);
  });

  it('parses EUR amount with comma', () => {
    const ctx = baseCtx();
    ctx.account.currencyCode = 'EUR';
    const r = applyScanToForm(
      {
        amount: '1,50',
        currency: 'EUR',
        date: null,
        merchant: null,
        categoryHint: null,
      },
      ctx
    );
    expect(r.patch.amount).toBe('1.50');
  });

  it('rejects negative and zero amounts', () => {
    expect(
      applyScanToForm(
        {
          amount: '-5.00',
          currency: 'USD',
          date: null,
          merchant: null,
          categoryHint: null,
        },
        baseCtx()
      ).patch.amount
    ).toBeUndefined();
    expect(
      applyScanToForm(
        {
          amount: '0',
          currency: 'USD',
          date: null,
          merchant: null,
          categoryHint: null,
        },
        baseCtx()
      ).patch.amount
    ).toBeUndefined();
  });

  it('rejects too many decimals for USD', () => {
    expect(
      applyScanToForm(
        {
          amount: '12.345',
          currency: 'USD',
          date: null,
          merchant: null,
          categoryHint: null,
        },
        baseCtx()
      ).patch.amount
    ).toBeUndefined();
  });

  it('handles currency mismatch with alternate account', () => {
    const r = applyScanToForm(
      {
        amount: '10.00',
        currency: 'EUR',
        date: null,
        merchant: null,
        categoryHint: null,
      },
      baseCtx()
    );
    expect(r.patch.amount).toBeUndefined();
    expect(r.currencyMismatch?.alternateAccount?.id).toBe('a2');
    expect(r.currencyMismatch?.scannedAmount).toBe('10.00');
  });

  it('rejects future and invalid dates', () => {
    const r1 = applyScanToForm(
      {
        amount: null,
        currency: null,
        date: '2026-10-07',
        merchant: null,
        categoryHint: null,
      },
      baseCtx()
    );
    expect(r1.patch.date).toBeUndefined();
    expect(r1.skippedNotes).toContain('Date not filled: it was after today.');

    const r2 = applyScanToForm(
      {
        amount: null,
        currency: null,
        date: '1999-12-31',
        merchant: null,
        categoryHint: null,
      },
      baseCtx()
    );
    expect(r2.patch.date).toBeUndefined();
  });

  it('rejects invalid calendar date', () => {
    expect(
      applyScanToForm(
        {
          amount: null,
          currency: null,
          date: '2026-02-30',
          merchant: null,
          categoryHint: null,
        },
        baseCtx()
      ).patch.date
    ).toBeUndefined();
  });

  it('cleans merchant and rejects long title', () => {
    const r = applyScanToForm(
      {
        amount: null,
        currency: null,
        date: null,
        merchant: '  Cafe\u200b Demo  ',
        categoryHint: null,
      },
      baseCtx()
    );
    expect(r.patch.title).toBe('Cafe Demo');

    const long = 'x'.repeat(200);
    expect(
      applyScanToForm(
        {
          amount: null,
          currency: null,
          date: null,
          merchant: long,
          categoryHint: null,
        },
        baseCtx()
      ).patch.title
    ).toBeUndefined();
  });

  it('maps food category hint', () => {
    const r = applyScanToForm(
      {
        amount: null,
        currency: null,
        date: null,
        merchant: null,
        categoryHint: 'food',
      },
      baseCtx()
    );
    expect(r.patch.categoryId).toBe('c-food');
  });

  it('does not overwrite user-touched fields', () => {
    const ctx = baseCtx();
    ctx.userTouched.amount = true;
    ctx.userTouched.title = true;
    const r = applyScanToForm(
      {
        amount: '9.99',
        currency: 'USD',
        date: '2026-10-01',
        merchant: 'Shop',
        categoryHint: 'food',
      },
      ctx
    );
    expect(r.patch.amount).toBeUndefined();
    expect(r.patch.title).toBeUndefined();
    expect(
      r.skippedNotes.some((n) => n.includes('Kept what you already'))
    ).toBe(true);
  });
});

describe('fillAmountAfterAccountSwitch', () => {
  it('formats amount for new currency', () => {
    expect(fillAmountAfterAccountSwitch('10.00', 'EUR')).toBe('10.00');
  });
});
