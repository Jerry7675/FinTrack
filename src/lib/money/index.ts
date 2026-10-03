export type Currency = {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
};

export const CURRENCIES: Currency[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2 },
  { code: 'GBP', name: 'British Pound', symbol: '£', decimals: 2 },
  { code: 'NPR', name: 'Nepalese Rupee', symbol: 'Rs', decimals: 2 },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimals: 2 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimals: 0 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimals: 2 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', decimals: 2 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', decimals: 2 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', decimals: 2 },
];

export function getCurrency(code: string): Currency {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

/**
 * Parse user-entered amount string to integer minor units.
 *
 * Rules:
 * - Rejects input with non-zero digits beyond currency's decimal places (e.g., "1.005" for USD)
 * - Allows trailing zeros (e.g., "1.50000" for USD)
 * - Handles both comma and period as decimal separators with disambiguation:
 *   - Single separator + 1-2 digits (or 1..decimals): decimal separator
 *   - Single separator + exactly 3 digits + non-zero integer: thousands (for 2-decimal currencies)
 *   - Multiple identical separators in groups of 3: thousands separators
 *   - Ambiguous case: "1,234" is interpreted as 1234 for USD (thousands), not 1.234
 * - Only allows leading/trailing currency symbols and whitespace
 * - Rejects stray characters (e.g., "1a2", "1.2.3")
 * - Uses BigInt internally to avoid precision loss above Number.MAX_SAFE_INTEGER
 *
 * @param input - User input string (e.g., "1.50", "1,50", "1.234,56", "1,234.56")
 * @param currencyCode - Currency code (e.g., "USD", "JPY")
 * @returns Integer minor units or null if invalid
 *
 * @example
 * parseAmountToMinor("1.50", "USD") // 150
 * parseAmountToMinor("1,50", "EUR") // 150
 * parseAmountToMinor("1,234", "USD") // 123400 (thousands separator, ambiguous)
 * parseAmountToMinor("1.005", "USD") // null (too many decimals with non-zero)
 * parseAmountToMinor("1.00000", "USD") // 100 (trailing zeros OK)
 * parseAmountToMinor("1a2", "USD") // null (stray character)
 * parseAmountToMinor("$100", "USD") // 10000 (currency symbol OK)
 */
export function parseAmountToMinor(
  input: string,
  currencyCode: string
): number | null {
  if (!input) return null;

  const { decimals } = getCurrency(currencyCode);

  let cleaned = input.trim();
  if (!cleaned) return null;

  const currencySymbolsAndCodes = [
    '$',
    '€',
    '£',
    '¥',
    'Rs',
    'A$',
    'C$',
    'CHF',
    'USD',
    'EUR',
    'GBP',
    'JPY',
    'INR',
    'NPR',
    'AUD',
    'CAD',
    'CNY',
  ];

  for (const symbol of currencySymbolsAndCodes) {
    if (cleaned.startsWith(symbol)) {
      cleaned = cleaned.slice(symbol.length).trim();
    }
    if (cleaned.endsWith(symbol)) {
      cleaned = cleaned.slice(0, -symbol.length).trim();
    }
  }

  if (!cleaned) return null;

  const hasPlus = cleaned.startsWith('+');
  const hasMinus = cleaned.startsWith('-');
  const isNegative = hasMinus;

  if (hasPlus || hasMinus) {
    cleaned = cleaned.slice(1).trim();
  }

  const multipleSignsPattern = /[+-].*[+-]/;
  if (multipleSignsPattern.test(cleaned)) return null;

  const hasComma = cleaned.includes(',');
  const hasPeriod = cleaned.includes('.');

  let integerPart = '';
  let fractionalPart = '';

  function isValidThousandsSeparators(str: string, sep: string): boolean {
    if (!str.includes(sep)) return true;
    const parts = str.split(sep);
    if (parts.length < 2) return true;

    const isIndianStyle = currencyCode === 'INR' || currencyCode === 'NPR';
    if (isIndianStyle) {
      if (parts[0].length > 3) return false;
      for (let i = 1; i < parts.length - 1; i++) {
        if (parts[i].length !== 2) return false;
      }
      if (parts[parts.length - 1].length !== 3) return false;
      return true;
    }

    if (parts[0].length > 3) return false;
    for (let i = 1; i < parts.length; i++) {
      if (parts[i].length !== 3) return false;
    }
    return true;
  }

  if (hasComma && hasPeriod) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastPeriod = cleaned.lastIndexOf('.');

    if (lastComma > lastPeriod) {
      const beforeDecimal = cleaned.substring(0, lastComma);
      const afterDecimal = cleaned.substring(lastComma + 1);

      if (!/^\d+$/.test(afterDecimal)) return null;
      if (!isValidThousandsSeparators(beforeDecimal, '.')) return null;

      const integerCleaned = beforeDecimal.replace(/\./g, '');
      if (!/^\d+$/.test(integerCleaned)) return null;

      integerPart = integerCleaned;
      fractionalPart = afterDecimal;
    } else {
      const beforeDecimal = cleaned.substring(0, lastPeriod);
      const afterDecimal = cleaned.substring(lastPeriod + 1);

      if (!/^\d+$/.test(afterDecimal)) return null;
      if (!isValidThousandsSeparators(beforeDecimal, ',')) return null;

      const integerCleaned = beforeDecimal.replace(/,/g, '');
      if (!/^\d+$/.test(integerCleaned)) return null;

      integerPart = integerCleaned;
      fractionalPart = afterDecimal;
    }
  } else if (hasComma) {
    const parts = cleaned.split(',');

    if (parts.length === 2) {
      const digitsAfter = parts[1].length;
      const digitsBefore = parts[0].length;

      if (digitsAfter === 0) return null;
      if (!/^\d*$/.test(parts[0]) || !/^\d+$/.test(parts[1])) return null;

      if (decimals === 0) {
        if (digitsAfter === 3) {
          integerPart = parts.join('');
          fractionalPart = '';
        } else {
          return null;
        }
      } else {
        if (digitsAfter === 3) {
          const hasNonZeroInteger = parts[0] !== '' && parts[0] !== '0';
          if (hasNonZeroInteger && digitsBefore >= 1 && digitsBefore <= 3) {
            integerPart = parts.join('');
            fractionalPart = '';
          } else {
            integerPart = parts[0] || '0';
            fractionalPart = parts[1];
          }
        } else if (digitsAfter > decimals) {
          return null;
        } else {
          integerPart = parts[0] || '0';
          fractionalPart = parts[1];
        }
      }
    } else if (parts.length > 2) {
      if (!isValidThousandsSeparators(cleaned, ',')) return null;
      const joined = parts.join('');
      if (!/^\d+$/.test(joined)) return null;
      integerPart = joined;
      fractionalPart = '';
    } else {
      return null;
    }
  } else if (hasPeriod) {
    const parts = cleaned.split('.');

    if (parts.length === 2) {
      const digitsAfter = parts[1].length;
      const digitsBefore = parts[0].length;

      if (!/^\d*$/.test(parts[0])) return null;

      if (parts[1] === '') {
        if (parts[0] === '') return null;
        integerPart = parts[0];
        fractionalPart = '';
      } else if (!/^\d+$/.test(parts[1])) {
        return null;
      } else {
        if (decimals === 0) {
          if (digitsAfter === 3 && digitsBefore >= 1 && digitsBefore <= 3) {
            integerPart = parts.join('');
            fractionalPart = '';
          } else if (!/^0+$/.test(parts[1])) {
            return null;
          } else {
            integerPart = parts[0] || '0';
            fractionalPart = '';
          }
        } else {
          integerPart = parts[0] || '0';
          fractionalPart = parts[1];
        }
      }
    } else if (parts.length > 2) {
      if (!isValidThousandsSeparators(cleaned, '.')) return null;
      const joined = parts.join('');
      if (!/^\d+$/.test(joined)) return null;
      integerPart = joined;
      fractionalPart = '';
    } else {
      return null;
    }
  } else {
    if (!/^\d+$/.test(cleaned)) return null;
    integerPart = cleaned;
    fractionalPart = '';
  }

  if (fractionalPart.length > decimals) {
    const extraDigits = fractionalPart.substring(decimals);
    if (!/^0+$/.test(extraDigits)) {
      return null;
    }
    fractionalPart = fractionalPart.substring(0, decimals);
  }

  fractionalPart = fractionalPart.padEnd(decimals, '0');

  if (integerPart === '' || integerPart === '0') {
    integerPart = '0';
  } else {
    integerPart = integerPart.replace(/^0+/, '') || '0';
  }

  const minorString = integerPart + fractionalPart;

  let minorValue: number;
  try {
    const bigIntValue = BigInt(minorString);

    if (bigIntValue > BigInt(Number.MAX_SAFE_INTEGER)) {
      return null;
    }

    minorValue = Number(bigIntValue);
  } catch {
    return null;
  }

  if (!Number.isFinite(minorValue) || !Number.isSafeInteger(minorValue)) {
    return null;
  }

  if (minorValue === 0) {
    return 0;
  }

  return isNegative ? -minorValue : minorValue;
}

/**
 * Format minor units back to a user-friendly decimal string.
 *
 * @param minor - Amount in minor units
 * @param currencyCode - Currency code
 * @returns Decimal string representation
 *
 * @example
 * formatMinorToDecimal(150, "USD") // "1.50"
 * formatMinorToDecimal(1000, "JPY") // "1000"
 */
export function formatMinorToDecimal(
  minor: number,
  currencyCode: string
): string {
  const { decimals } = getCurrency(currencyCode);

  if (decimals === 0) return minor.toString();

  const isNegative = minor < 0;
  const abs = Math.abs(minor);
  const divisor = 10 ** decimals;

  const integerPart = Math.floor(abs / divisor);
  const fractionalPart = abs % divisor;

  const fractionalString = fractionalPart.toString().padStart(decimals, '0');

  return `${isNegative ? '-' : ''}${integerPart}.${fractionalString}`;
}

export function toMinorUnits(amount: number, currencyCode: string): number {
  const { decimals } = getCurrency(currencyCode);
  return Math.round(amount * 10 ** decimals);
}

export function fromMinorUnits(minor: number, currencyCode: string): number {
  const { decimals } = getCurrency(currencyCode);
  return minor / 10 ** decimals;
}

export function formatMoney(
  minor: number,
  currencyCode: string,
  options?: { sign?: boolean; compact?: boolean }
): string {
  const currency = getCurrency(currencyCode);
  const value = fromMinorUnits(minor, currencyCode);
  const abs = Math.abs(value);
  const formatted = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency.code,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: currency.decimals,
    minimumFractionDigits: currency.decimals,
  }).format(abs);

  if (options?.sign) {
    if (minor > 0) return `+${formatted}`;
    if (minor < 0) return `-${formatted}`;
  }

  if (minor < 0) return `-${formatted}`;
  return formatted;
}

export function signedMinorForType(
  amountMinor: number,
  type: 'expense' | 'income' | 'transfer'
): number {
  if (type === 'expense') return -Math.abs(amountMinor);
  if (type === 'income') return Math.abs(amountMinor);
  return amountMinor;
}

/**
 * Generate spoken accessibility label for a money amount.
 * Format: "minus 5.20 USD" or "plus 12.00 NPR"
 */
export function moneyA11yLabel(minor: number, currencyCode: string): string {
  const currency = getCurrency(currencyCode);
  const isNegative = minor < 0;
  const isZero = minor === 0;
  const absValue = Math.abs(minor);

  // Format the amount with proper decimals
  const value = absValue / 10 ** currency.decimals;
  const formattedValue = value.toFixed(currency.decimals);

  // Build label: "minus 5.20 USD" or "plus 12.00 NPR" or "0.00 USD"
  const sign = isNegative ? 'minus ' : !isZero ? 'plus ' : '';
  return `${sign}${formattedValue} ${currencyCode.toUpperCase()}`;
}
