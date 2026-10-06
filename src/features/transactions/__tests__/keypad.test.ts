import { describe, expect, it } from '@jest/globals';

import {
  formatKeypadDisplay,
  formatMaxAmountLabel,
  keypadReducer,
} from '@/features/transactions/keypad-logic';

describe('keypadReducer', () => {
  it('handles leading zero', () => {
    expect(
      keypadReducer('', { type: 'digit', digit: '0' }, 'USD').amountText
    ).toBe('0');
    expect(
      keypadReducer('0', { type: 'digit', digit: '5' }, 'USD').amountText
    ).toBe('5');
  });

  it('starts decimal as 0.', () => {
    expect(keypadReducer('', { type: 'decimal' }, 'USD').amountText).toBe('0.');
  });

  it('caps fraction digits for USD', () => {
    const r = keypadReducer('1.23', { type: 'digit', digit: '4' }, 'USD');
    expect(r.amountText).toBe('1.23');
    expect(r.blocked).toBe(true);
  });

  it('ignores decimal for JPY', () => {
    const r = keypadReducer('12', { type: 'decimal' }, 'JPY');
    expect(r.amountText).toBe('12');
    expect(r.blocked).toBe(true);
  });

  it('blocks extra integer digits at the cap', () => {
    const eleven = '12345678901';
    const r = keypadReducer(eleven, { type: 'digit', digit: '2' }, 'USD');
    expect(r.blocked).toBe(true);
    expect(r.amountText).toBe(eleven);
  });

  it('backspace clears to empty from single zero', () => {
    expect(keypadReducer('0', { type: 'backspace' }, 'USD').amountText).toBe(
      ''
    );
  });

  it('long-press clear action empties input', () => {
    expect(keypadReducer('123.45', { type: 'clear' }, 'USD').amountText).toBe(
      ''
    );
  });
});

describe('formatKeypadDisplay', () => {
  it('formats en-US with grouping', () => {
    expect(formatKeypadDisplay('1234.5', 'USD', 'en-US')).toBe('1,234.5');
  });

  it('formats de-DE with grouping', () => {
    expect(formatKeypadDisplay('1234.5', 'USD', 'de-DE')).toBe('1.234,5');
  });

  it('shows trailing decimal separator', () => {
    expect(formatKeypadDisplay('12.', 'USD', 'en-US')).toBe('12.');
  });

  it('returns empty for blank input', () => {
    expect(formatKeypadDisplay('', 'USD', 'en-US')).toBe('');
  });
});

describe('formatMaxAmountLabel', () => {
  it('formats de-DE without mangling grouping separators', () => {
    const label = formatMaxAmountLabel('USD', 'de-DE');
    expect(label).toMatch(/^\d{1,3}(\.\d{3})*,\d{2}$/);
    expect(label).not.toContain('.,');
  });
});
