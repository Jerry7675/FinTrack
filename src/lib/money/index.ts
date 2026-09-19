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
