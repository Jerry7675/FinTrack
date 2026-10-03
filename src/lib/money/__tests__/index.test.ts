import {
  formatMinorToDecimal,
  fromMinorUnits,
  getCurrency,
  parseAmountToMinor,
  toMinorUnits,
} from '../index';

describe('parseAmountToMinor', () => {
  describe('standard decimal input (period separator)', () => {
    it('parses simple decimal amounts', () => {
      expect(parseAmountToMinor('1.50', 'USD')).toBe(150);
      expect(parseAmountToMinor('10.99', 'USD')).toBe(1099);
      expect(parseAmountToMinor('0.01', 'USD')).toBe(1);
    });

    it('parses amounts with thousand separators', () => {
      expect(parseAmountToMinor('1,234.56', 'USD')).toBe(123456);
      expect(parseAmountToMinor('10,000.00', 'USD')).toBe(1000000);
      expect(parseAmountToMinor('1,234,567.89', 'USD')).toBe(123456789);
    });

    it('parses integer amounts', () => {
      expect(parseAmountToMinor('100', 'USD')).toBe(10000);
      expect(parseAmountToMinor('5', 'USD')).toBe(500);
    });

    it('handles leading/trailing periods', () => {
      expect(parseAmountToMinor('.5', 'USD')).toBe(50);
      expect(parseAmountToMinor('5.', 'USD')).toBe(500);
    });
  });

  describe('comma decimal separator (European format)', () => {
    it('parses comma as decimal separator', () => {
      expect(parseAmountToMinor('1,50', 'EUR')).toBe(150);
      expect(parseAmountToMinor('10,99', 'EUR')).toBe(1099);
    });

    it('parses amounts with period thousand separators', () => {
      expect(parseAmountToMinor('1.234,56', 'EUR')).toBe(123456);
      expect(parseAmountToMinor('10.000,00', 'EUR')).toBe(1000000);
      expect(parseAmountToMinor('1.234.567,89', 'EUR')).toBe(123456789);
    });

    it('handles ambiguous single comma (1,234 as thousands for USD)', () => {
      expect(parseAmountToMinor('1,234', 'USD')).toBe(123400);
    });

    it('handles single comma with 1-2 digits as decimal', () => {
      expect(parseAmountToMinor('1,5', 'EUR')).toBe(150);
      expect(parseAmountToMinor('0,5', 'USD')).toBe(50);
    });
  });

  describe('precision and truncation rules', () => {
    it('rejects amounts with non-zero digits beyond currency decimals', () => {
      expect(parseAmountToMinor('1.005', 'USD')).toBeNull();
      expect(parseAmountToMinor('1.009', 'USD')).toBeNull();
      expect(parseAmountToMinor('1.1234', 'USD')).toBeNull();
    });

    it('accepts trailing zeros beyond currency decimals', () => {
      expect(parseAmountToMinor('1.50000', 'USD')).toBe(150);
      expect(parseAmountToMinor('10.000', 'USD')).toBe(1000);
      expect(parseAmountToMinor('1000.00', 'JPY')).toBe(1000);
    });

    it('rejects JPY amounts with non-zero decimals', () => {
      expect(parseAmountToMinor('1000.50', 'JPY')).toBeNull();
      expect(parseAmountToMinor('500.01', 'JPY')).toBeNull();
    });

    it('accepts JPY amounts with zero decimals', () => {
      expect(parseAmountToMinor('1000.00', 'JPY')).toBe(1000);
      expect(parseAmountToMinor('1000.000', 'JPY')).toBe(1000);
    });
  });

  describe('currency symbols and whitespace', () => {
    it('strips leading currency symbols', () => {
      expect(parseAmountToMinor('$100', 'USD')).toBe(10000);
      expect(parseAmountToMinor('€50.99', 'EUR')).toBe(5099);
      expect(parseAmountToMinor('£25.50', 'GBP')).toBe(2550);
      expect(parseAmountToMinor('¥1000', 'JPY')).toBe(1000);
    });

    it('strips trailing currency symbols', () => {
      expect(parseAmountToMinor('100$', 'USD')).toBe(10000);
      expect(parseAmountToMinor('50.99€', 'EUR')).toBe(5099);
    });

    it('strips currency codes', () => {
      expect(parseAmountToMinor('USD 100', 'USD')).toBe(10000);
      expect(parseAmountToMinor('100 USD', 'USD')).toBe(10000);
      expect(parseAmountToMinor('EUR 50.99', 'EUR')).toBe(5099);
    });

    it('handles leading/trailing spaces', () => {
      expect(parseAmountToMinor('  100.50  ', 'USD')).toBe(10050);
      expect(parseAmountToMinor('  $100.50  ', 'USD')).toBe(10050);
    });
  });

  describe('invalid input - stray characters', () => {
    it('rejects amounts with letters', () => {
      expect(parseAmountToMinor('1a2', 'USD')).toBeNull();
      expect(parseAmountToMinor('12a', 'USD')).toBeNull();
      expect(parseAmountToMinor('a12', 'USD')).toBeNull();
    });

    it('rejects multiple decimal points', () => {
      expect(parseAmountToMinor('1.2.3', 'USD')).toBeNull();
      expect(parseAmountToMinor('1..5', 'USD')).toBeNull();
    });
  });

  describe('sign handling', () => {
    it('parses negative amounts', () => {
      expect(parseAmountToMinor('-10.50', 'USD')).toBe(-1050);
      expect(parseAmountToMinor('-1,234.56', 'USD')).toBe(-123456);
      expect(parseAmountToMinor('-5,50', 'EUR')).toBe(-550);
    });

    it('handles negative zero', () => {
      expect(parseAmountToMinor('-0', 'USD')).toBe(0);
      expect(parseAmountToMinor('-0.00', 'USD')).toBe(0);
    });

    it('handles positive sign', () => {
      expect(parseAmountToMinor('+5', 'USD')).toBe(500);
      expect(parseAmountToMinor('+10.50', 'USD')).toBe(1050);
    });

    it('rejects multiple signs', () => {
      expect(parseAmountToMinor('--5', 'USD')).toBeNull();
      expect(parseAmountToMinor('+-5', 'USD')).toBeNull();
      expect(parseAmountToMinor('5-', 'USD')).toBeNull();
    });
  });

  describe('zero and empty values', () => {
    it('handles zero', () => {
      expect(parseAmountToMinor('0', 'USD')).toBe(0);
      expect(parseAmountToMinor('0.00', 'USD')).toBe(0);
      expect(parseAmountToMinor('0,00', 'EUR')).toBe(0);
    });

    it('returns null for empty or whitespace', () => {
      expect(parseAmountToMinor('', 'USD')).toBeNull();
      expect(parseAmountToMinor('   ', 'USD')).toBeNull();
    });
  });

  describe('very large values and precision limits', () => {
    it('handles large amounts within safe integer range', () => {
      expect(parseAmountToMinor('999999999.99', 'USD')).toBe(99999999999);
      expect(parseAmountToMinor('1000000000', 'USD')).toBe(100000000000);
    });

    it('rejects amounts exceeding MAX_SAFE_INTEGER', () => {
      const maxSafe = Number.MAX_SAFE_INTEGER;
      const tooLarge = (maxSafe + 1).toString();
      expect(parseAmountToMinor(tooLarge, 'JPY')).toBeNull();
    });

    it('handles very long digit strings', () => {
      expect(parseAmountToMinor('9999999999999', 'JPY')).toBe(9999999999999);
      expect(parseAmountToMinor('10000000000001', 'JPY')).toBeNull();
    });
  });

  describe('zero-decimal currencies (JPY)', () => {
    it('parses JPY amounts with no decimals', () => {
      expect(parseAmountToMinor('1000', 'JPY')).toBe(1000);
      expect(parseAmountToMinor('500', 'JPY')).toBe(500);
      expect(parseAmountToMinor('1,234', 'JPY')).toBe(1234);
    });
  });

  describe('edge cases from Indian formatting', () => {
    it('handles irregular comma grouping (12,34,567)', () => {
      expect(parseAmountToMinor('12,34,567', 'INR')).toBe(123456700);
      expect(parseAmountToMinor('12,34,567.89', 'INR')).toBe(123456789);
    });
  });
});

describe('parseAmountToMinor - malformed thousands separators', () => {
  it('rejects separators with invalid grouping', () => {
    expect(parseAmountToMinor('1,2,3', 'USD')).toBeNull();
    expect(parseAmountToMinor('1,234,56', 'EUR')).toBeNull();
  });

  it('rejects ambiguous decimal-like input for zero-decimal currencies', () => {
    expect(parseAmountToMinor('1,5', 'JPY')).toBeNull();
    expect(parseAmountToMinor('1,50', 'JPY')).toBeNull();
    expect(parseAmountToMinor('1.5', 'JPY')).toBeNull();
  });

  it('correctly parses thousands separator for zero-decimal currencies', () => {
    expect(parseAmountToMinor('1,000', 'JPY')).toBe(1000);
    expect(parseAmountToMinor('1.000', 'JPY')).toBe(1000);
  });

  it('rejects overly small input that looks like typo', () => {
    expect(parseAmountToMinor('0,005', 'USD')).toBeNull();
    expect(parseAmountToMinor('0.005', 'USD')).toBeNull();
  });

  it('rejects lone period/comma', () => {
    expect(parseAmountToMinor('.', 'USD')).toBeNull();
    expect(parseAmountToMinor(',', 'USD')).toBeNull();
  });

  it('normalizes regular spaces between digit groups', () => {
    expect(parseAmountToMinor('1 234,56', 'EUR')).toBe(123456);
    expect(parseAmountToMinor('1 234.56', 'USD')).toBe(123456);
    expect(parseAmountToMinor('1 234 567.89', 'USD')).toBe(123456789);
  });

  it('normalizes NBSP (U+00A0) between digit groups', () => {
    expect(parseAmountToMinor('1\u00A0234,56', 'EUR')).toBe(123456);
    expect(parseAmountToMinor('1\u00A0234.56', 'USD')).toBe(123456);
  });

  it('normalizes narrow NBSP (U+202F) between digit groups', () => {
    expect(parseAmountToMinor('1\u202F234,56', 'EUR')).toBe(123456);
    expect(parseAmountToMinor('1\u202F234.56', 'USD')).toBe(123456);
  });

  it('rejects invalid space groupings', () => {
    expect(parseAmountToMinor('12 34', 'USD')).toBeNull();
    expect(parseAmountToMinor('1 23', 'USD')).toBeNull();
    expect(parseAmountToMinor('1 2345', 'USD')).toBeNull();
    expect(parseAmountToMinor('1  234', 'USD')).toBeNull();
    expect(parseAmountToMinor('1 234 56', 'USD')).toBeNull();
  });

  it('rejects mixing space with comma or period', () => {
    expect(parseAmountToMinor('1 234,56.78', 'USD')).toBeNull();
    expect(parseAmountToMinor('1 234.56,78', 'EUR')).toBeNull();
    expect(parseAmountToMinor('1,234 567', 'USD')).toBeNull();
  });

  it('enforces MAX_MINOR limit', () => {
    expect(parseAmountToMinor('100000000000.00', 'USD')).toBeNull();
    expect(parseAmountToMinor('99999999999.99', 'USD')).toBe(9999999999999);
  });

  it('rejects symbol-sign combinations like $-5 and €-5', () => {
    expect(parseAmountToMinor('$-5', 'USD')).toBeNull();
    expect(parseAmountToMinor('€-5', 'EUR')).toBeNull();
    expect(parseAmountToMinor('£-10.50', 'GBP')).toBeNull();
  });

  it('accepts sign before symbol', () => {
    expect(parseAmountToMinor('-$5', 'USD')).toBe(-500);
    expect(parseAmountToMinor('- $5', 'USD')).toBe(-500);
    expect(parseAmountToMinor('-€10.50', 'EUR')).toBe(-1050);
    expect(parseAmountToMinor('-5 USD', 'USD')).toBe(-500);
    expect(parseAmountToMinor('-USD 5', 'USD')).toBe(-500);
    expect(parseAmountToMinor('+$5', 'USD')).toBe(500);
    expect(parseAmountToMinor('+ $5', 'USD')).toBe(500);
    expect(parseAmountToMinor('+5 USD', 'USD')).toBe(500);
  });
});

describe('formatMinorToDecimal', () => {
  it('formats USD amounts correctly', () => {
    expect(formatMinorToDecimal(150, 'USD')).toBe('1.50');
    expect(formatMinorToDecimal(1099, 'USD')).toBe('10.99');
    expect(formatMinorToDecimal(1, 'USD')).toBe('0.01');
  });

  it('formats JPY amounts correctly (no decimals)', () => {
    expect(formatMinorToDecimal(1000, 'JPY')).toBe('1000');
    expect(formatMinorToDecimal(500, 'JPY')).toBe('500');
  });

  it('formats negative amounts', () => {
    expect(formatMinorToDecimal(-1050, 'USD')).toBe('-10.50');
    expect(formatMinorToDecimal(-100, 'JPY')).toBe('-100');
  });

  it('formats zero', () => {
    expect(formatMinorToDecimal(0, 'USD')).toBe('0.00');
    expect(formatMinorToDecimal(0, 'JPY')).toBe('0');
  });

  it('pads fractional part correctly', () => {
    expect(formatMinorToDecimal(5, 'USD')).toBe('0.05');
    expect(formatMinorToDecimal(100, 'USD')).toBe('1.00');
  });
});

describe('getCurrency', () => {
  it('returns correct currency for known codes', () => {
    expect(getCurrency('USD')).toEqual({
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
      decimals: 2,
    });
    expect(getCurrency('JPY')).toEqual({
      code: 'JPY',
      name: 'Japanese Yen',
      symbol: '¥',
      decimals: 0,
    });
  });

  it('returns USD as fallback for unknown codes', () => {
    const result = getCurrency('UNKNOWN');
    expect(result.code).toBe('USD');
  });
});

describe('toMinorUnits (legacy float-based)', () => {
  it('converts float to minor units', () => {
    expect(toMinorUnits(1.5, 'USD')).toBe(150);
    expect(toMinorUnits(10.99, 'USD')).toBe(1099);
    expect(toMinorUnits(1000, 'JPY')).toBe(1000);
  });

  it('demonstrates float precision issue with 1.005', () => {
    expect(toMinorUnits(1.005, 'USD')).toBe(100);
  });
});

describe('fromMinorUnits', () => {
  it('converts minor units to float', () => {
    expect(fromMinorUnits(150, 'USD')).toBe(1.5);
    expect(fromMinorUnits(1099, 'USD')).toBe(10.99);
    expect(fromMinorUnits(1000, 'JPY')).toBe(1000);
  });
});

describe('round-trip conversion with new parser', () => {
  it('parseAmountToMinor -> formatMinorToDecimal preserves value', () => {
    const input = '123.45';
    const minor = parseAmountToMinor(input, 'USD');
    expect(minor).not.toBeNull();
    const output = formatMinorToDecimal(minor as number, 'USD');
    expect(output).toBe('123.45');
  });

  it('handles European format round-trip', () => {
    const input = '123,45';
    const minor = parseAmountToMinor(input, 'EUR');
    expect(minor).not.toBeNull();
    const output = formatMinorToDecimal(minor as number, 'EUR');
    expect(output).toBe('123.45');
  });

  it('handles JPY round-trip', () => {
    const input = '1000';
    const minor = parseAmountToMinor(input, 'JPY');
    expect(minor).not.toBeNull();
    const output = formatMinorToDecimal(minor as number, 'JPY');
    expect(output).toBe('1000');
  });

  it('handles very large amounts', () => {
    const input = '999999999.99';
    const minor = parseAmountToMinor(input, 'USD');
    expect(minor).not.toBeNull();
    expect(toMinorUnits(fromMinorUnits(minor as number, 'USD'), 'USD')).toBe(
      minor
    );
  });
});
