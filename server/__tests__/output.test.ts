/**
 * @jest-environment node
 */

import { capRaw, sanitizeModelFields } from '../lib/output';

describe('capRaw', () => {
  it('returns null when over max length', () => {
    expect(capRaw('abcd', 3)).toBeNull();
    expect(capRaw('abc', 3)).toBe('abc');
  });
});

describe('sanitizeModelFields', () => {
  it('nulls merchant over raw cap before semantic validation', () => {
    const fields = sanitizeModelFields({
      amount: '10.00',
      currency: 'USD',
      date: '2024-01-01',
      merchant: 'a'.repeat(301),
      categoryHint: 'food',
    });
    expect(fields.merchant).toBeNull();
  });

  it('keeps merchant at 120 chars and nulls at 121 after cleaning', () => {
    const base = {
      amount: '1.00',
      currency: 'USD',
      date: '2024-01-01',
      categoryHint: 'food',
    };
    expect(
      sanitizeModelFields({ ...base, merchant: 'm'.repeat(120) }).merchant
    ).toBe('m'.repeat(120));
    expect(
      sanitizeModelFields({ ...base, merchant: 'm'.repeat(121) }).merchant
    ).toBeNull();
  });

  it('nulls amount over raw cap before semantic validation', () => {
    const overCap = '9'.repeat(33);
    expect(
      sanitizeModelFields({
        amount: overCap,
        currency: 'USD',
        date: '2024-01-01',
        merchant: 'X',
        categoryHint: 'food',
      }).amount
    ).toBeNull();
  });

  it('strips bidi control chars from merchant', () => {
    const fields = sanitizeModelFields({
      amount: '1.00',
      currency: 'USD',
      date: '2024-01-01',
      merchant: 'Cafe\u200bName',
      categoryHint: 'food',
    });
    expect(fields.merchant).toBe('CafeName');
  });

  it('nulls amount with sign or exponent', () => {
    expect(
      sanitizeModelFields({
        amount: '-5.00',
        currency: 'USD',
        date: '2024-01-01',
        merchant: 'X',
        categoryHint: 'food',
      }).amount
    ).toBeNull();
    expect(
      sanitizeModelFields({
        amount: '1e13',
        currency: 'USD',
        date: '2024-01-01',
        merchant: 'X',
        categoryHint: 'food',
      }).amount
    ).toBeNull();
  });
});
