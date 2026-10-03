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
 * Handles locale-aware input (both comma and period as decimal separator),
 * thousand separators, zero, negatives, and per-currency decimal places.
 *
 * @param input - User input string (e.g., "1.50", "1,50", "1.234,56", "1,234.56")
 * @param currencyCode - Currency code (e.g., "USD", "JPY")
 * @returns Integer minor units or null if invalid
 *
 * @example
 * parseAmountToMinor("1.50", "USD") // 150
 * parseAmountToMinor("1,50", "EUR") // 150
 * parseAmountToMinor("1.234,56", "EUR") // 123456
 * parseAmountToMinor("1,234.56", "USD") // 123456
 * parseAmountToMinor("1000", "JPY") // 1000
 */
export function parseAmountToMinor(
  input: string,
  currencyCode: string
): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const { decimals } = getCurrency(currencyCode);

  let normalized = trimmed;
  const hasComma = normalized.includes(',');
  const hasPeriod = normalized.includes('.');

  if (hasComma && hasPeriod) {
    const lastComma = normalized.lastIndexOf(',');
    const lastPeriod = normalized.lastIndexOf('.');

    if (lastComma > lastPeriod) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
  } else if (hasComma) {
    const commaCount = (normalized.match(/,/g) || []).length;
    const digitsAfterLastComma = normalized.split(',').pop()?.length || 0;

    if (commaCount === 1 && digitsAfterLastComma === 2) {
      normalized = normalized.replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
  }

  normalized = normalized.replace(/[^\d.-]/g, '');

  if (!normalized || normalized === '-') return null;

  const parts = normalized.split('.');
  if (parts.length > 2) return null;

  const integerPart = parts[0];
  let fractionalPart = parts[1] || '';

  if (integerPart && !/^-?\d+$/.test(integerPart)) return null;

  if (fractionalPart && !/^\d+$/.test(fractionalPart)) return null;

  const isNegative = integerPart?.startsWith('-');
  const integerDigits = integerPart?.replace('-', '') || '0';

  if (decimals === 0) {
    fractionalPart = '';
  } else if (fractionalPart.length > decimals) {
    fractionalPart = fractionalPart.slice(0, decimals);
  } else {
    fractionalPart = fractionalPart.padEnd(decimals, '0');
  }

  const minorString = integerDigits + fractionalPart;
  const minorValue = Number.parseInt(minorString, 10);

  if (!Number.isFinite(minorValue)) return null;

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
