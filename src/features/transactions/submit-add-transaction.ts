import { format } from 'date-fns';
import { ZodError } from 'zod';
import type { parseAmountToMinor } from '@/lib/money';
import { TRANSACTION_LIMITS } from '@/lib/validation';

export type AddTransactionMode = 'expense' | 'income' | 'transfer';

export type AddTransactionFormValues = {
  mode: AddTransactionMode;
  amount: string;
  date: string;
  title: string;
  note?: string;
  tags?: string;
  accountId: string;
  toAccountId?: string;
  categoryId?: string | null;
};

export type AddTransactionField =
  | 'amount'
  | 'date'
  | 'title'
  | 'accountId'
  | 'toAccountId'
  | 'note'
  | 'tags';

export const TRANSACTION_DATE_MIN = '2000-01-01';

export const ADD_TRANSACTION_FIELD_ORDER: AddTransactionField[] = [
  'amount',
  'date',
  'accountId',
  'toAccountId',
  'title',
  'note',
  'tags',
];

export type SubmitAddTransactionError =
  | { type: 'field'; field: AddTransactionField; message: string }
  | { type: 'database'; message: string };

export type AccountSummary = {
  id: string;
  currencyCode: string;
  name: string;
};

export type CategorySummary = {
  id: string;
  name: string;
};

export type SubmitAddTransactionDeps = {
  accounts: AccountSummary[];
  categories: CategorySummary[];
  currency: string;
  now?: Date;
  parseAmountToMinor: typeof parseAmountToMinor;
  createTransaction: (input: {
    accountId: string;
    categoryId?: string | null;
    type: 'expense' | 'income';
    amountMinor: number;
    currencyCode: string;
    title: string;
    note?: string;
    occurredAt?: Date;
    tagNames?: string[];
  }) => Promise<string>;
  createTransfer: (input: {
    fromAccountId: string;
    toAccountId: string;
    amountMinor: number;
    fromCurrency: string;
    toCurrency: string;
    title: string;
    note?: string;
    occurredAt?: Date;
  }) => Promise<void>;
};

export type SubmitAddTransactionResult =
  | { ok: true; transactionId?: string }
  | { ok: false; error: SubmitAddTransactionError };

export function defaultTransactionDateString(now: Date = new Date()): string {
  return format(now, 'yyyy-MM-dd');
}

export function parseIsoLocalDate(dateStr: string): Date | null {
  const trimmed = dateStr.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

/** Selected calendar day plus the current local time (exactly `now` when date is today). */
export function occurredAtFromSelectedDate(
  selectedLocalDate: Date,
  now: Date
): Date {
  const selectedDay = defaultTransactionDateString(selectedLocalDate);
  const today = defaultTransactionDateString(now);
  if (selectedDay === today) {
    return new Date(now.getTime());
  }
  return new Date(
    selectedLocalDate.getFullYear(),
    selectedLocalDate.getMonth(),
    selectedLocalDate.getDate(),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds()
  );
}

export function validateTransactionDate(
  dateStr: string,
  now: Date
): SubmitAddTransactionError | { occurredAt: Date } {
  const parsed = parseIsoLocalDate(dateStr);
  if (!parsed) {
    return {
      type: 'field',
      field: 'date',
      message: 'Enter a valid date (YYYY-MM-DD)',
    };
  }
  const entered = defaultTransactionDateString(parsed);
  if (entered < TRANSACTION_DATE_MIN) {
    return {
      type: 'field',
      field: 'date',
      message: 'Date must be on or after 2000-01-01',
    };
  }
  const today = defaultTransactionDateString(now);
  if (entered > today) {
    return {
      type: 'field',
      field: 'date',
      message: 'Date cannot be in the future',
    };
  }
  return { occurredAt: occurredAtFromSelectedDate(parsed, now) };
}

export function resolveDefaultAccountId(
  accounts: AccountSummary[],
  activeAccountId?: string | null
): string {
  if (
    activeAccountId &&
    accounts.some((account) => account.id === activeAccountId)
  ) {
    return activeAccountId;
  }
  return accounts[0]?.id ?? '';
}

/** Quick Add account default: scoped account, then last-used for the mode, then first. */
export function resolveQuickAddAccountId(
  accounts: AccountSummary[],
  activeAccountId?: string | null,
  lastUsedAccountId?: string | null
): string {
  if (
    activeAccountId &&
    accounts.some((account) => account.id === activeAccountId)
  ) {
    return activeAccountId;
  }
  if (
    lastUsedAccountId &&
    accounts.some((account) => account.id === lastUsedAccountId)
  ) {
    return lastUsedAccountId;
  }
  return accounts[0]?.id ?? '';
}

export function formatQuickAddDateLabel(dateStr: string, now: Date): string {
  const parsed = parseIsoLocalDate(dateStr);
  if (!parsed) return dateStr;
  const todayStr = defaultTransactionDateString(now);
  const entered = defaultTransactionDateString(parsed);
  if (entered === todayStr) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (entered === defaultTransactionDateString(yesterday)) return 'Yesterday';
  return format(parsed, 'MMM d');
}

export function getAddTransactionSaveAvailability(
  accountsReady: boolean,
  accountCount: number
):
  | { disabled: true; reason: 'loading' }
  | { disabled: true; reason: 'no_accounts'; message: string }
  | { disabled: false } {
  if (!accountsReady) {
    return { disabled: true, reason: 'loading' };
  }
  if (accountCount === 0) {
    return {
      disabled: true,
      reason: 'no_accounts',
      message: 'Add an account first',
    };
  }
  return { disabled: false };
}

function parseTagNames(tags: string | undefined): string[] {
  return (tags ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

export function resolveTransactionTitle(
  values: AddTransactionFormValues,
  categories: CategorySummary[]
): string {
  const trimmed = values.title.trim();
  if (trimmed) return trimmed;
  if (values.mode === 'transfer') return 'Transfer';
  const category = categories.find((c) => c.id === values.categoryId);
  const fromCategory = category?.name ?? '';
  if (!fromCategory) return '';
  const chars = Array.from(fromCategory);
  if (chars.length <= TRANSACTION_LIMITS.titleMax) {
    return fromCategory;
  }
  return chars.slice(0, TRANSACTION_LIMITS.titleMax).join('');
}

export function validateAddTransactionInput(
  values: AddTransactionFormValues,
  accounts: AccountSummary[],
  _currency: string,
  parseAmount: typeof parseAmountToMinor,
  now: Date = new Date()
): SubmitAddTransactionError | null {
  if (!values.accountId.trim()) {
    return {
      type: 'field',
      field: 'accountId',
      message: 'Select an account',
    };
  }
  const account = accounts.find((a) => a.id === values.accountId);
  if (!account) {
    return {
      type: 'field',
      field: 'accountId',
      message: 'Select an account',
    };
  }

  const accountCurrency = account.currencyCode;
  const amountMinor = parseAmount(values.amount, accountCurrency);
  if (amountMinor === null || amountMinor <= 0) {
    return {
      type: 'field',
      field: 'amount',
      message: 'Enter a valid amount',
    };
  }

  const dateResult = validateTransactionDate(values.date, now);
  if ('type' in dateResult) {
    return dateResult;
  }

  if (values.title.length > TRANSACTION_LIMITS.titleMax) {
    return {
      type: 'field',
      field: 'title',
      message: `Title must be ${TRANSACTION_LIMITS.titleMax} characters or fewer`,
    };
  }

  if ((values.note?.length ?? 0) > TRANSACTION_LIMITS.noteMax) {
    return {
      type: 'field',
      field: 'note',
      message: `Note must be ${TRANSACTION_LIMITS.noteMax} characters or fewer`,
    };
  }

  const tagNames = parseTagNames(values.tags);
  if (tagNames.some((tag) => tag.length > TRANSACTION_LIMITS.tagMax)) {
    return {
      type: 'field',
      field: 'tags',
      message: `Each tag must be ${TRANSACTION_LIMITS.tagMax} characters or fewer`,
    };
  }

  if (values.mode === 'transfer') {
    const to = accounts.find((a) => a.id === values.toAccountId);
    if (!to || to.id === account.id) {
      return {
        type: 'field',
        field: 'toAccountId',
        message: 'Pick a different destination account',
      };
    }
  }

  return null;
}

export function firstAddTransactionFieldWithError(
  errors: Partial<Record<AddTransactionField, { message?: string }>>
): AddTransactionField | null {
  for (const field of ADD_TRANSACTION_FIELD_ORDER) {
    if (errors[field]?.message) return field;
  }
  return null;
}

function errorFromThrown(e: unknown): SubmitAddTransactionError {
  if (e instanceof ZodError) {
    const issue = e.issues[0];
    const pathKey = issue?.path[0];
    const message = issue?.message ?? 'Invalid transaction';
    if (pathKey === 'title') {
      return { type: 'field', field: 'title', message };
    }
    if (pathKey === 'note') {
      return { type: 'field', field: 'note', message };
    }
    if (pathKey === 'tagNames' || pathKey === 'tags') {
      return { type: 'field', field: 'tags', message };
    }
    if (pathKey === 'amountMinor' || pathKey === 'amount') {
      return {
        type: 'field',
        field: 'amount',
        message: 'Enter a valid amount',
      };
    }
    return { type: 'database', message };
  }
  const message = e instanceof Error ? e.message : String(e);
  return { type: 'database', message };
}

export async function submitAddTransaction(
  values: AddTransactionFormValues,
  deps: SubmitAddTransactionDeps
): Promise<SubmitAddTransactionResult> {
  const account = deps.accounts.find((a) => a.id === values.accountId);
  const currency = account?.currencyCode ?? deps.currency;
  const now = deps.now ?? new Date();

  const validation = validateAddTransactionInput(
    values,
    deps.accounts,
    currency,
    deps.parseAmountToMinor,
    now
  );
  if (validation) {
    return { ok: false, error: validation };
  }

  const dateResult = validateTransactionDate(values.date, now);
  if ('type' in dateResult) {
    return { ok: false, error: dateResult };
  }
  const { occurredAt } = dateResult;

  const amountMinor = deps.parseAmountToMinor(values.amount, currency);
  if (amountMinor === null || amountMinor <= 0) {
    return {
      ok: false,
      error: {
        type: 'field',
        field: 'amount',
        message: 'Enter a valid amount',
      },
    };
  }

  const title = resolveTransactionTitle(values, deps.categories);
  if (values.mode !== 'transfer' && !title) {
    return {
      ok: false,
      error: {
        type: 'field',
        field: 'title',
        message: 'Select a category or add a title',
      },
    };
  }

  try {
    if (values.mode === 'transfer') {
      const from = deps.accounts.find((a) => a.id === values.accountId);
      const to = deps.accounts.find((a) => a.id === values.toAccountId);
      if (!from || !to) {
        return {
          ok: false,
          error: {
            type: 'field',
            field: 'toAccountId',
            message: 'Pick a different destination account',
          },
        };
      }
      await deps.createTransfer({
        fromAccountId: from.id,
        toAccountId: to.id,
        amountMinor,
        fromCurrency: from.currencyCode,
        toCurrency: to.currencyCode,
        title: values.title.trim() || 'Transfer',
        note: values.note,
        occurredAt,
      });
      return { ok: true };
    }

    const txId = await deps.createTransaction({
      accountId: values.accountId,
      categoryId: values.categoryId,
      type: values.mode,
      amountMinor,
      currencyCode: account?.currencyCode ?? currency,
      title,
      note: values.note,
      occurredAt,
      tagNames: parseTagNames(values.tags),
    });
    return { ok: true, transactionId: txId };
  } catch (e) {
    return { ok: false, error: errorFromThrown(e) };
  }
}
