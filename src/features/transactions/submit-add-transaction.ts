import { ZodError } from 'zod';
import type { parseAmountToMinor } from '@/lib/money';
import { TRANSACTION_LIMITS } from '@/lib/validation';

export type AddTransactionMode = 'expense' | 'income' | 'transfer';

export type AddTransactionFormValues = {
  mode: AddTransactionMode;
  amount: string;
  title: string;
  note?: string;
  tags?: string;
  accountId: string;
  toAccountId?: string;
  categoryId?: string | null;
};

export type AddTransactionField =
  | 'amount'
  | 'title'
  | 'accountId'
  | 'toAccountId'
  | 'note'
  | 'tags';

export const ADD_TRANSACTION_FIELD_ORDER: AddTransactionField[] = [
  'amount',
  'title',
  'accountId',
  'toAccountId',
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

export type SubmitAddTransactionDeps = {
  accounts: AccountSummary[];
  currency: string;
  parseAmountToMinor: typeof parseAmountToMinor;
  createTransaction: (input: {
    accountId: string;
    categoryId?: string | null;
    type: 'expense' | 'income';
    amountMinor: number;
    currencyCode: string;
    title: string;
    note?: string;
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
  }) => Promise<void>;
};

export type SubmitAddTransactionResult =
  | { ok: true; transactionId?: string }
  | { ok: false; error: SubmitAddTransactionError };

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

export function validateAddTransactionInput(
  values: AddTransactionFormValues,
  accounts: AccountSummary[],
  currency: string,
  parseAmount: typeof parseAmountToMinor
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

  const amountMinor = parseAmount(values.amount, currency);
  if (amountMinor === null || amountMinor <= 0) {
    return {
      type: 'field',
      field: 'amount',
      message: 'Enter a valid amount',
    };
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

  if (values.mode !== 'transfer' && !values.title.trim()) {
    return {
      type: 'field',
      field: 'title',
      message: 'Add a title',
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

  const validation = validateAddTransactionInput(
    values,
    deps.accounts,
    currency,
    deps.parseAmountToMinor
  );
  if (validation) {
    return { ok: false, error: validation };
  }

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
      });
      return { ok: true };
    }

    const txId = await deps.createTransaction({
      accountId: values.accountId,
      categoryId: values.categoryId,
      type: values.mode,
      amountMinor,
      currencyCode: account?.currencyCode ?? currency,
      title: values.title.trim(),
      note: values.note,
      tagNames: parseTagNames(values.tags),
    });
    return { ok: true, transactionId: txId };
  } catch (e) {
    return { ok: false, error: errorFromThrown(e) };
  }
}
