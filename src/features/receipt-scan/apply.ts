import { TRANSACTION_DATE_MIN } from '@/features/transactions/submit-add-transaction';
import { CATEGORY_ICONS } from '@/lib/categories/icons';
import {
  CURRENCIES,
  formatMinorToDecimal,
  MAX_MINOR,
  parseAmountToMinor,
} from '@/lib/money';
import { TRANSACTION_LIMITS } from '@/lib/validation';

import { cleanMerchantInput } from './sanitize';
import type { AiFilledField, ScanFieldsPayload } from './types';

const EXPENSE_ICON_KEYS = new Set(
  CATEGORY_ICONS.filter((i) =>
    [
      'food',
      'transport',
      'shopping',
      'home',
      'health',
      'entertainment',
      'bills',
      'education',
      'travel',
      'saas',
      'cloud',
      'hardware',
      'internet',
      'office',
      'contractor',
      'marketing',
      'training',
      'domains',
      'other',
    ].includes(i.key)
  ).map((i) => i.key)
);

const RAW_CAPS = {
  amount: 32,
  currency: 8,
  date: 10,
  merchant: 300,
  categoryHint: 32,
} as const;

export type ScanUserTouched = {
  amount: boolean;
  title: boolean;
  date: boolean;
  category: boolean;
};

export type ExpenseCategoryRow = {
  id: string;
  iconKey: string;
  sortOrder: number;
};

export type ApplyScanAccount = {
  id: string;
  name: string;
  currencyCode: string;
};

export type ApplyScanContext = {
  account: ApplyScanAccount;
  accounts: ApplyScanAccount[];
  expenseCategories: ExpenseCategoryRow[];
  today: string;
  userTouched: ScanUserTouched;
};

export type FieldSkipReason =
  | 'not_positive'
  | 'over_max'
  | 'bad_format'
  | 'future_date'
  | 'too_old'
  | 'currency_mismatch'
  | 'no_matching_category'
  | 'missing'
  | 'invalid';

export type ApplyScanResult = {
  patch: Partial<{
    amount: string;
    date: string;
    title: string;
    categoryId: string;
  }>;
  aiFilled: AiFilledField[];
  filledCount: number;
  skippedNotes: string[];
  currencyMismatch?: {
    receiptCurrency: string;
    accountCurrency: string;
    accountName: string;
    alternateAccount?: ApplyScanAccount;
    scannedAmount: string | null;
  };
};

function knownCurrency(code: string): string | null {
  const upper = code.trim().toUpperCase();
  return CURRENCIES.some((c) => c.code === upper) ? upper : null;
}

function capRaw(
  key: keyof typeof RAW_CAPS,
  value: string | null | undefined
): string | null {
  if (value == null) return null;
  const trimmed = String(value);
  if (trimmed.length > RAW_CAPS[key]) return null;
  return trimmed;
}

function parseIsoDateLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== mo - 1 ||
    dt.getDate() !== d
  ) {
    return null;
  }
  return dt;
}

function skipNoteForField(
  field: 'amount' | 'date' | 'title' | 'category',
  reason: FieldSkipReason,
  userTouched: boolean
): string | null {
  if (userTouched) {
    const label =
      field === 'amount'
        ? 'Amount'
        : field === 'date'
          ? 'Date'
          : field === 'title'
            ? 'Title'
            : 'Category';
    return `Kept what you already entered for ${label}.`;
  }
  if (field === 'date' && reason === 'future_date') {
    return 'Date not filled: it was after today.';
  }
  if (field === 'amount' && reason !== 'currency_mismatch') {
    return "Amount not filled: it wasn't a valid amount.";
  }
  return null;
}

export function applyScanToForm(
  fields: ScanFieldsPayload,
  ctx: ApplyScanContext
): ApplyScanResult {
  const patch: ApplyScanResult['patch'] = {};
  const aiFilled: AiFilledField[] = [];
  const skippedNotes: string[] = [];
  let filledCount = 0;

  const rawAmount = capRaw('amount', fields.amount);
  const rawCurrency = capRaw('currency', fields.currency);
  const rawDate = capRaw('date', fields.date);
  const rawMerchant = capRaw('merchant', fields.merchant);
  const rawHint = capRaw('categoryHint', fields.categoryHint);

  let receiptCurrency =
    knownCurrency(rawCurrency ?? '') ?? ctx.account.currencyCode;
  let currencyMismatch = false;
  if (rawCurrency) {
    const known = knownCurrency(rawCurrency);
    if (!known) {
      receiptCurrency = ctx.account.currencyCode;
    } else if (known !== ctx.account.currencyCode) {
      currencyMismatch = true;
      receiptCurrency = known;
    } else {
      receiptCurrency = known;
    }
  }

  let currencyMismatchInfo: ApplyScanResult['currencyMismatch'];

  if (!ctx.userTouched.amount && rawAmount) {
    if (currencyMismatch) {
      const alternate = ctx.accounts.find(
        (a) => a.currencyCode === receiptCurrency
      );
      currencyMismatchInfo = {
        receiptCurrency,
        accountCurrency: ctx.account.currencyCode,
        accountName: ctx.account.name,
        alternateAccount: alternate,
        scannedAmount: rawAmount,
      };
    } else {
      const minor = parseAmountToMinor(rawAmount, ctx.account.currencyCode);
      if (minor === null || minor <= 0 || minor >= MAX_MINOR) {
        const note = skipNoteForField(
          'amount',
          minor !== null && minor <= 0 ? 'not_positive' : 'bad_format',
          ctx.userTouched.amount
        );
        if (note) skippedNotes.push(note);
      } else {
        patch.amount = formatMinorToDecimal(minor, ctx.account.currencyCode);
        aiFilled.push('amount');
        filledCount += 1;
      }
    }
  } else if (ctx.userTouched.amount) {
    const note = skipNoteForField('amount', 'missing', true);
    if (note) skippedNotes.push(note);
  }

  if (!ctx.userTouched.date && rawDate) {
    const parsed = parseIsoDateLocal(rawDate);
    const today = parseIsoDateLocal(ctx.today);
    if (!parsed || !today) {
      const note = skipNoteForField('date', 'bad_format', ctx.userTouched.date);
      if (note) skippedNotes.push(note);
    } else if (rawDate < TRANSACTION_DATE_MIN) {
      const note = skipNoteForField('date', 'too_old', ctx.userTouched.date);
      if (note) skippedNotes.push(note);
    } else if (rawDate > ctx.today) {
      skippedNotes.push('Date not filled: it was after today.');
    } else {
      patch.date = rawDate;
      aiFilled.push('date');
      filledCount += 1;
    }
  } else if (ctx.userTouched.date) {
    const note = skipNoteForField('date', 'missing', true);
    if (note) skippedNotes.push(note);
  }

  if (!ctx.userTouched.title && rawMerchant) {
    const cleaned = cleanMerchantInput(rawMerchant);
    if (cleaned.length < 1 || cleaned.length > TRANSACTION_LIMITS.titleMax) {
      const note = skipNoteForField(
        'title',
        'bad_format',
        ctx.userTouched.title
      );
      if (note) skippedNotes.push(note);
    } else {
      patch.title = cleaned;
      aiFilled.push('title');
      filledCount += 1;
    }
  } else if (ctx.userTouched.title) {
    const note = skipNoteForField('title', 'missing', true);
    if (note) skippedNotes.push(note);
  }

  if (!ctx.userTouched.category && rawHint) {
    const hint = rawHint.trim().toLowerCase();
    if (!EXPENSE_ICON_KEYS.has(hint) || hint === 'other') {
      // no change
    } else {
      const sorted = [...ctx.expenseCategories].sort(
        (a, b) => a.sortOrder - b.sortOrder
      );
      const match = sorted.find((c) => c.iconKey === hint);
      if (match) {
        patch.categoryId = match.id;
        aiFilled.push('categoryId');
        filledCount += 1;
      }
    }
  } else if (ctx.userTouched.category) {
    const note = skipNoteForField('category', 'missing', true);
    if (note) skippedNotes.push(note);
  }

  return {
    patch,
    aiFilled,
    filledCount,
    skippedNotes: [...new Set(skippedNotes)],
    currencyMismatch: currencyMismatchInfo,
  };
}

/** Fill amount after user switches to a matching-currency account. */
export function fillAmountAfterAccountSwitch(
  scannedAmount: string | null,
  currencyCode: string
): string | null {
  if (!scannedAmount) return null;
  const minor = parseAmountToMinor(scannedAmount, currencyCode);
  if (minor === null || minor <= 0 || minor >= MAX_MINOR) return null;
  return formatMinorToDecimal(minor, currencyCode);
}

export function validateRawScanFields(
  fields: ScanFieldsPayload
): ScanFieldsPayload {
  return {
    amount: capRaw('amount', fields.amount),
    currency: capRaw('currency', fields.currency),
    date: capRaw('date', fields.date),
    merchant: capRaw('merchant', fields.merchant),
    categoryHint: capRaw('categoryHint', fields.categoryHint),
  };
}
