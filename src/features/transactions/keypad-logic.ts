import { getCurrency, MAX_MINOR, parseAmountToMinor } from '@/lib/money';

export type KeypadAction =
  | { type: 'digit'; digit: string }
  | { type: 'decimal' }
  | { type: 'backspace' }
  | { type: 'clear' };

export type KeypadReducerResult = {
  amountText: string;
  blocked?: boolean;
};

function localeDecimalSeparator(locale: string): string {
  const parts = new Intl.NumberFormat(locale).formatToParts(1.1);
  return parts.find((p) => p.type === 'decimal')?.value ?? '.';
}

export function maxIntegerDigitsForCurrency(currencyCode: string): number {
  const { decimals } = getCurrency(currencyCode);
  const maxMinor = BigInt(MAX_MINOR) - BigInt(1);
  const divisor = BigInt(10) ** BigInt(decimals);
  const maxMajor = maxMinor / divisor;
  return maxMajor.toString().length;
}

function integerPartLength(amountText: string): number {
  const [intPart = ''] = amountText.split('.');
  const trimmed = intPart.replace(/^0+/, '');
  if (trimmed.length > 0) return trimmed.length;
  return intPart.length > 0 ? 1 : 0;
}

function wouldExceedMax(amountText: string, currencyCode: string): boolean {
  if (!amountText) return false;
  const parsed = parseAmountToMinor(amountText, currencyCode);
  if (parsed === null) {
    return (
      integerPartLength(amountText) > maxIntegerDigitsForCurrency(currencyCode)
    );
  }
  return parsed >= MAX_MINOR;
}

export function keypadReducer(
  amountText: string,
  action: KeypadAction,
  currencyCode: string
): KeypadReducerResult {
  const { decimals } = getCurrency(currencyCode);

  if (action.type === 'clear') {
    return { amountText: '' };
  }

  if (action.type === 'backspace') {
    if (!amountText) return { amountText: '' };
    const next = amountText.slice(0, -1);
    if (next === '0') return { amountText: '' };
    return { amountText: next };
  }

  if (action.type === 'decimal') {
    if (decimals === 0) return { amountText, blocked: true };
    if (amountText.includes('.')) return { amountText, blocked: true };
    const next = amountText === '' ? '0.' : `${amountText}.`;
    return { amountText: next };
  }

  const digit = action.digit;
  if (!/^[0-9]$/.test(digit)) {
    return { amountText, blocked: true };
  }

  let next: string;
  if (amountText === '') {
    next = digit === '0' ? '0' : digit;
  } else if (amountText === '0' && digit !== '0') {
    next = digit;
  } else if (amountText === '0' && digit === '0') {
    next = '0';
  } else {
    next = `${amountText}${digit}`;
  }

  if (next.includes('.')) {
    const [, frac = ''] = next.split('.');
    if (frac.length > decimals) {
      return { amountText, blocked: true };
    }
  }

  if (integerPartLength(next) > maxIntegerDigitsForCurrency(currencyCode)) {
    return { amountText, blocked: true };
  }

  if (wouldExceedMax(next, currencyCode)) {
    return { amountText, blocked: true };
  }

  return { amountText: next };
}

export function formatKeypadDisplay(
  amountText: string,
  currencyCode: string,
  locale: string
): string {
  if (!amountText) return '';

  const decSep = localeDecimalSeparator(locale);
  const { decimals } = getCurrency(currencyCode);
  const hasDot = amountText.includes('.');
  const [intRaw, fracRaw = ''] = amountText.split('.');
  const intNum = intRaw === '' ? 0 : Number(intRaw);
  const grouped = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(intNum);

  if (!hasDot) return grouped;
  if (decimals === 0) return grouped;
  if (fracRaw.length === 0) return `${grouped}${decSep}`;
  return `${grouped}${decSep}${fracRaw}`;
}

export function formatMaxAmountLabel(
  currencyCode: string,
  locale: string
): string {
  const maxMinor = MAX_MINOR - 1;
  const { decimals } = getCurrency(currencyCode);
  const major = decimals === 0 ? maxMinor : maxMinor / 10 ** decimals;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: true,
  }).format(major);
}
