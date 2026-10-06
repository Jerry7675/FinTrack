/**
 * @jest-environment node
 */

import { sanitizeModelFields } from '../lib/output';

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
