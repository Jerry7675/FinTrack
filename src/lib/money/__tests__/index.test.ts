import {
  formatMinorToDecimal,
  parseAmountToMinor,
  getCurrency,
  toMinorUnits,
  fromMinorUnits,
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
    });

    it('parses integer amounts', () => {
      expect(parseAmountToMinor('100', 'USD')).toBe(10000);
      expect(parseAmountToMinor('5', 'USD')).toBe(500);
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
    });
  });

  describe('edge cases - problem case 1.005', () => {
    it('handles 1.005 correctly by truncating to currency decimals', () => {
      expect(parseAmountToMinor('1.005', 'USD')).toBe(100);
      expect(parseAmountToMinor('1.009', 'USD')).toBe(100);
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

  describe('negative values', () => {
    it('parses negative amounts', () => {
      expect(parseAmountToMinor('-10.50', 'USD')).toBe(-1050);
      expect(parseAmountToMinor('-1,234.56', 'USD')).toBe(-123456);
      expect(parseAmountToMinor('-5,50', 'EUR')).toBe(-550);
    });
  });

  describe('very large values', () => {
    it('handles large amounts without precision loss', () => {
      expect(parseAmountToMinor('999999999.99', 'USD')).toBe(99999999999);
      expect(parseAmountToMinor('1000000000', 'USD')).toBe(100000000000);
    });
  });

  describe('zero-decimal currencies (JPY)', () => {
    it('parses JPY amounts with no decimals', () => {
      expect(parseAmountToMinor('1000', 'JPY')).toBe(1000);
      expect(parseAmountToMinor('500', 'JPY')).toBe(500);
      expect(parseAmountToMinor('1,234', 'JPY')).toBe(1234);
    });

    it('ignores decimal part for JPY', () => {
      expect(parseAmountToMinor('1000.50', 'JPY')).toBe(1000);
      expect(parseAmountToMinor('500,75', 'JPY')).toBe(500);
    });
  });

  describe('invalid input', () => {
    it('returns null for invalid formats', () => {
      expect(parseAmountToMinor('abc', 'USD')).toBeNull();
      expect(parseAmountToMinor('1.2.3', 'USD')).toBeNull();
      expect(parseAmountToMinor('-', 'USD')).toBeNull();
      expect(parseAmountToMinor('$100', 'USD')).toBe(10000);
    });
  });

  describe('currency symbols and extra characters', () => {
    it('strips currency symbols and extra characters', () => {
      expect(parseAmountToMinor('$100.50', 'USD')).toBe(10050);
      expect(parseAmountToMinor('€50,99', 'EUR')).toBe(5099);
      expect(parseAmountToMinor('¥1000', 'JPY')).toBe(1000);
    });
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

describe('toMinorUnits (legacy)', () => {
  it('converts float to minor units', () => {
    expect(toMinorUnits(1.5, 'USD')).toBe(150);
    expect(toMinorUnits(10.99, 'USD')).toBe(1099);
    expect(toMinorUnits(1000, 'JPY')).toBe(1000);
  });

  it('rounds to nearest integer', () => {
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

describe('round-trip conversion', () => {
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
});
