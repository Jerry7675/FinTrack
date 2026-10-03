/**
 * Unit tests for moneyA11yLabel function.
 */
import { moneyA11yLabel } from '@/lib/money';

describe('moneyA11yLabel', () => {
  describe('USD (2 decimals)', () => {
    it('formats positive amount', () => {
      expect(moneyA11yLabel(12345, 'USD')).toBe('plus 123.45 USD');
    });

    it('formats negative amount', () => {
      expect(moneyA11yLabel(-12345, 'USD')).toBe('minus 123.45 USD');
    });

    it('formats zero', () => {
      expect(moneyA11yLabel(0, 'USD')).toBe('0.00 USD');
    });

    it('handles whole dollars', () => {
      expect(moneyA11yLabel(10000, 'USD')).toBe('plus 100.00 USD');
    });
  });

  describe('JPY (0 decimals)', () => {
    it('formats positive JPY amount', () => {
      expect(moneyA11yLabel(500, 'JPY')).toBe('plus 500 JPY');
    });

    it('formats negative JPY amount', () => {
      expect(moneyA11yLabel(-500, 'JPY')).toBe('minus 500 JPY');
    });

    it('formats zero JPY', () => {
      expect(moneyA11yLabel(0, 'JPY')).toBe('0 JPY');
    });
  });

  describe('NPR (2 decimals)', () => {
    it('formats NPR amount', () => {
      expect(moneyA11yLabel(1200, 'NPR')).toBe('plus 12.00 NPR');
    });

    it('formats negative NPR', () => {
      expect(moneyA11yLabel(-520, 'NPR')).toBe('minus 5.20 NPR');
    });
  });

  describe('edge cases', () => {
    it('handles very small amounts', () => {
      expect(moneyA11yLabel(1, 'USD')).toBe('plus 0.01 USD');
    });

    it('handles large amounts', () => {
      expect(moneyA11yLabel(1234567890, 'USD')).toBe('plus 12345678.90 USD');
    });

    it('formats with correct decimal places for different currencies', () => {
      // 2-decimal currency
      expect(moneyA11yLabel(100, 'EUR')).toBe('plus 1.00 EUR');
      // 0-decimal currency
      expect(moneyA11yLabel(100, 'JPY')).toBe('plus 100 JPY');
    });
  });

  describe('unknown currency codes', () => {
    it('uses passed code and fallback decimals for unknown code', () => {
      expect(moneyA11yLabel(5200, 'KWD')).toBe('plus 52.00 KWD');
    });

    it('prints the passed code upper-cased', () => {
      expect(moneyA11yLabel(10050, 'xyz')).toBe('plus 100.50 XYZ');
    });
  });

  describe('known currency code is preserved', () => {
    it('uses the passed code exactly (upper-cased)', () => {
      expect(moneyA11yLabel(5200, 'usd')).toBe('plus 52.00 USD');
      expect(moneyA11yLabel(1000, 'npr')).toBe('plus 10.00 NPR');
    });
  });
});
