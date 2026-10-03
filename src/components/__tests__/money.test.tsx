/**
 * Unit tests for Money component accessibility label generation.
 * Tests the getCurrency() integration for different decimal currencies.
 */

import { getCurrency } from '@/lib/money';

describe('Money accessibility label', () => {
  // Helper to simulate the accessibility label logic from Money component
  function generateAccessibilityLabel(
    minor: number,
    currencyCode: string
  ): string {
    const currencyInfo = getCurrency(currencyCode);
    const isNegative = minor < 0;
    const isZero = minor === 0;
    const absValue = Math.abs(minor);
    const majorUnits = Math.floor(absValue / 10 ** currencyInfo.decimals);
    const minorUnits = absValue % 10 ** currencyInfo.decimals;

    let label = isNegative ? 'minus ' : !isZero ? 'plus ' : '';
    label += `${majorUnits} ${currencyInfo.name}`;

    if (currencyInfo.decimals > 0 && minorUnits > 0) {
      const minorString = minorUnits
        .toString()
        .padStart(currencyInfo.decimals, '0');
      const minorLabel =
        currencyInfo.decimals === 2 ? 'cents' : currencyInfo.code;
      label += ` and ${minorString} ${minorLabel}`;
    }

    return label.trim();
  }

  describe('USD (2 decimals)', () => {
    it('formats positive amount correctly', () => {
      expect(generateAccessibilityLabel(12345, 'USD')).toBe(
        'plus 123 US Dollar and 45 cents'
      );
    });

    it('formats negative amount correctly', () => {
      expect(generateAccessibilityLabel(-12345, 'USD')).toBe(
        'minus 123 US Dollar and 45 cents'
      );
    });

    it('formats zero correctly', () => {
      expect(generateAccessibilityLabel(0, 'USD')).toBe('0 US Dollar');
    });

    it('omits cents when zero', () => {
      expect(generateAccessibilityLabel(10000, 'USD')).toBe(
        'plus 100 US Dollar'
      );
    });

    it('handles 1 dollar correctly', () => {
      expect(generateAccessibilityLabel(100, 'USD')).toBe('plus 1 US Dollar');
    });
  });

  describe('JPY (0 decimals)', () => {
    it('formats positive JPY amount correctly', () => {
      expect(generateAccessibilityLabel(500, 'JPY')).toBe(
        'plus 500 Japanese Yen'
      );
    });

    it('formats negative JPY amount correctly', () => {
      expect(generateAccessibilityLabel(-500, 'JPY')).toBe(
        'minus 500 Japanese Yen'
      );
    });

    it('formats zero JPY correctly', () => {
      expect(generateAccessibilityLabel(0, 'JPY')).toBe('0 Japanese Yen');
    });

    it('handles large JPY amounts', () => {
      expect(generateAccessibilityLabel(1234567, 'JPY')).toBe(
        'plus 1234567 Japanese Yen'
      );
    });
  });

  describe('EUR (2 decimals)', () => {
    it('formats positive EUR amount correctly', () => {
      expect(generateAccessibilityLabel(5099, 'EUR')).toBe(
        'plus 50 Euro and 99 cents'
      );
    });

    it('formats negative EUR amount correctly', () => {
      expect(generateAccessibilityLabel(-5099, 'EUR')).toBe(
        'minus 50 Euro and 99 cents'
      );
    });
  });

  describe('GBP (2 decimals)', () => {
    it('formats positive GBP amount correctly', () => {
      expect(generateAccessibilityLabel(2550, 'GBP')).toBe(
        'plus 25 British Pound and 50 cents'
      );
    });

    it('formats cents with leading zero', () => {
      expect(generateAccessibilityLabel(1005, 'GBP')).toBe(
        'plus 10 British Pound and 05 cents'
      );
    });
  });

  describe('Sign display', () => {
    it('always shows + for positive values', () => {
      const label = generateAccessibilityLabel(100, 'USD');
      expect(label.startsWith('plus ')).toBe(true);
    });

    it('always shows - for negative values', () => {
      const label = generateAccessibilityLabel(-100, 'USD');
      expect(label.startsWith('minus ')).toBe(true);
    });

    it('shows no sign for zero', () => {
      const label = generateAccessibilityLabel(0, 'USD');
      expect(label.startsWith('plus')).toBe(false);
      expect(label.startsWith('minus')).toBe(false);
    });
  });
});
