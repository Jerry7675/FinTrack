import { z } from 'zod';

import { isHexColor } from '@/lib/color';

import { BACKUP_SCHEMA_VERSION } from './constants';

const coercedNonemptyString = z
  .union([z.string(), z.number().finite()])
  .transform((value) => String(value).trim())
  .pipe(z.string().min(1));

const boolField = z
  .union([z.boolean(), z.literal(0), z.literal(1)])
  .transform((value) => Boolean(value));

const dateMs = z
  .union([z.date(), z.string().min(1), z.number().finite()])
  .refine((value) => {
    const d = value instanceof Date ? value : new Date(value);
    return !Number.isNaN(d.getTime());
  }, 'Invalid date')
  .transform((value) =>
    value instanceof Date ? value : new Date(value as string | number)
  );

const nullableDateMs = z.union([dateMs, z.null()]);

const timestampsSchema = {
  createdAt: dateMs,
  updatedAt: dateMs,
  deletedAt: nullableDateMs.optional(),
};

const accountGroupSchema = z.object({
  id: z.string().min(1),
  name: coercedNonemptyString,
  icon: coercedNonemptyString,
  sortOrder: z.number().int(),
  ...timestampsSchema,
});

const accountSchema = z.object({
  id: z.string().min(1),
  groupId: z.string().min(1),
  name: coercedNonemptyString,
  currencyCode: coercedNonemptyString,
  type: z.enum(['cash', 'bank', 'wallet', 'credit', 'other']),
  sortOrder: z.number().int(),
  ...timestampsSchema,
});

const categorySchema = z.object({
  id: z.string().min(1),
  name: coercedNonemptyString,
  kind: z.enum(['expense', 'income']),
  iconKey: coercedNonemptyString,
  color: z.string().refine(isHexColor, 'Invalid category color'),
  isDefault: boolField,
  sortOrder: z.number().int(),
  ...timestampsSchema,
});

const tagSchema = z.object({
  id: z.string().min(1),
  name: coercedNonemptyString,
  ...timestampsSchema,
});

const transactionSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  categoryId: z.string().min(1).nullable().optional(),
  type: z.enum(['expense', 'income', 'transfer']),
  amountMinor: z.coerce.number().int().nonnegative(),
  currencyCode: coercedNonemptyString,
  title: coercedNonemptyString,
  note: z.string().nullable().optional(),
  occurredAt: dateMs,
  transferId: z.string().nullable().optional(),
  sourceType: z.enum(['recurring', 'subscription']).nullable().optional(),
  sourceId: z.string().nullable().optional(),
  ...timestampsSchema,
});

const transactionTagSchema = z.object({
  transactionId: z.string().min(1),
  tagId: z.string().min(1),
});

const budgetSchema = z.object({
  id: z.string().min(1),
  categoryId: z.string().min(1),
  accountId: z.string().min(1).nullable().optional(),
  name: z.string().min(1),
  amountMinor: z.coerce.number().int().nonnegative(),
  currencyCode: z.string().min(1),
  period: z.enum(['weekly', 'monthly', 'yearly']),
  ...timestampsSchema,
});

const recurringTemplateSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  categoryId: z.string().min(1).nullable().optional(),
  type: z.enum(['expense', 'income']),
  title: z.string().min(1),
  amountMinor: z.coerce.number().int().nonnegative(),
  currencyCode: z.string().min(1),
  cadence: z.enum(['daily', 'weekly', 'monthly', 'yearly', 'custom']),
  intervalDays: z.number().int().nullable().optional(),
  nextDueAt: dateMs,
  note: z.string().nullable().optional(),
  ...timestampsSchema,
});

const goalSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1).nullable().optional(),
  name: z.string().min(1),
  targetMinor: z.coerce.number().int().nonnegative(),
  currentMinor: z.coerce.number().int().nonnegative(),
  currencyCode: z.string().min(1),
  deadlineAt: nullableDateMs.optional(),
  ...timestampsSchema,
});

const subscriptionSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  categoryId: z.string().min(1).nullable().optional(),
  name: z.string().min(1),
  amountMinor: z.coerce.number().int().nonnegative(),
  currencyCode: z.string().min(1),
  cadence: z.enum(['weekly', 'monthly', 'yearly']),
  nextBillingAt: dateMs,
  note: z.string().nullable().optional(),
  ...timestampsSchema,
});

const debtSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1).nullable().optional(),
  name: z.string().min(1),
  kind: z.enum(['owed_to_me', 'i_owe']),
  principalMinor: z.coerce.number().int().nonnegative(),
  remainingMinor: z.coerce.number().int().nonnegative(),
  currencyCode: z.string().min(1),
  counterparty: z.string().nullable().optional(),
  dueAt: nullableDateMs.optional(),
  note: z.string().nullable().optional(),
  interestRate: z.number().nullable().optional(),
  ...timestampsSchema,
});

const settingsSchema = z.object({
  id: z.string().min(1),
  theme: z.enum(['system', 'light', 'dark']),
  lockEnabled: boolField,
  onboardingDone: boolField,
  activeGroupId: z.string().nullable().optional(),
  activeAccountId: z.string().nullable().optional(),
  defaultCurrency: z.string().min(1),
  profileImagePath: z.string().nullable().optional(),
  remindersEnabled: boolField,
  dashboardLayout: z.string().nullable().optional(),
  updatedAt: dateMs,
});

const backupDataSchema = z
  .object({
    accountGroups: z.array(accountGroupSchema).default([]),
    accounts: z.array(accountSchema).default([]),
    categories: z.array(categorySchema).default([]),
    tags: z.array(tagSchema).default([]),
    transactions: z.array(transactionSchema).default([]),
    transactionTags: z.array(transactionTagSchema).default([]),
    budgets: z.array(budgetSchema).default([]),
    recurringTemplates: z.array(recurringTemplateSchema).default([]),
    goals: z.array(goalSchema).default([]),
    subscriptions: z.array(subscriptionSchema).default([]),
    debts: z.array(debtSchema).default([]),
    settings: z.array(settingsSchema).default([]),
  })
  .passthrough();

export const backupPayloadSchema = z.object({
  schemaVersion: z.literal(BACKUP_SCHEMA_VERSION),
  exportedAt: z.string().min(1),
  data: backupDataSchema,
});

export type ValidatedBackupPayload = z.infer<typeof backupPayloadSchema>;

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupValidationError';
  }
}

function assertUniqueIds(label: string, rows: { id: string }[]): void {
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) {
      throw new BackupValidationError(`Duplicate ${label} id: ${row.id}`);
    }
    seen.add(row.id);
  }
}

function assertInSet(
  value: string,
  allowed: Set<string>,
  message: string
): void {
  if (!allowed.has(value)) {
    throw new BackupValidationError(message);
  }
}

function assertOptionalInSet(
  value: string | null | undefined,
  allowed: Set<string>,
  message: string
): void {
  if (value == null) {
    return;
  }
  assertInSet(value, allowed, message);
}

function assertReferentialIntegrity(
  data: ValidatedBackupPayload['data']
): void {
  assertUniqueIds('accountGroup', data.accountGroups);
  assertUniqueIds('account', data.accounts);
  assertUniqueIds('category', data.categories);
  assertUniqueIds('tag', data.tags);
  assertUniqueIds('transaction', data.transactions);
  assertUniqueIds('budget', data.budgets);
  assertUniqueIds('recurringTemplate', data.recurringTemplates);
  assertUniqueIds('goal', data.goals);
  assertUniqueIds('subscription', data.subscriptions);
  assertUniqueIds('debt', data.debts);

  const groupIds = new Set(data.accountGroups.map((g) => g.id));
  const accountIds = new Set(data.accounts.map((a) => a.id));
  const categoryIds = new Set(data.categories.map((c) => c.id));
  const tagIds = new Set(data.tags.map((t) => t.id));
  const transactionIds = new Set(data.transactions.map((t) => t.id));

  for (const account of data.accounts) {
    assertInSet(
      account.groupId,
      groupIds,
      `Account ${account.id} references unknown group ${account.groupId}`
    );
  }

  for (const txn of data.transactions) {
    assertInSet(
      txn.accountId,
      accountIds,
      `Transaction ${txn.id} references unknown account ${txn.accountId}`
    );
    assertOptionalInSet(
      txn.categoryId ?? null,
      categoryIds,
      `Transaction ${txn.id} references unknown category ${txn.categoryId}`
    );
  }

  for (const link of data.transactionTags) {
    assertInSet(
      link.transactionId,
      transactionIds,
      `transaction_tags references unknown transaction ${link.transactionId}`
    );
    assertInSet(
      link.tagId,
      tagIds,
      `transaction_tags references unknown tag ${link.tagId}`
    );
  }

  for (const budget of data.budgets) {
    assertInSet(
      budget.categoryId,
      categoryIds,
      `Budget ${budget.id} references unknown category ${budget.categoryId}`
    );
    assertOptionalInSet(
      budget.accountId ?? null,
      accountIds,
      `Budget ${budget.id} references unknown account ${budget.accountId}`
    );
  }

  for (const row of data.recurringTemplates) {
    assertInSet(
      row.accountId,
      accountIds,
      `Recurring template ${row.id} references unknown account ${row.accountId}`
    );
    assertOptionalInSet(
      row.categoryId ?? null,
      categoryIds,
      `Recurring template ${row.id} references unknown category ${row.categoryId}`
    );
  }

  for (const goal of data.goals) {
    assertOptionalInSet(
      goal.accountId ?? null,
      accountIds,
      `Goal ${goal.id} references unknown account ${goal.accountId}`
    );
  }

  for (const sub of data.subscriptions) {
    assertInSet(
      sub.accountId,
      accountIds,
      `Subscription ${sub.id} references unknown account ${sub.accountId}`
    );
    assertOptionalInSet(
      sub.categoryId ?? null,
      categoryIds,
      `Subscription ${sub.id} references unknown category ${sub.categoryId}`
    );
  }

  for (const debt of data.debts) {
    assertOptionalInSet(
      debt.accountId ?? null,
      accountIds,
      `Debt ${debt.id} references unknown account ${debt.accountId}`
    );
  }
}

export function validateBackupPayload(input: unknown): ValidatedBackupPayload {
  const parsed = backupPayloadSchema.safeParse(input);
  if (!parsed.success) {
    const detail = parsed.error.issues[0]?.message ?? 'Invalid backup payload';
    throw new BackupValidationError(detail);
  }
  assertReferentialIntegrity(parsed.data.data);
  return parsed.data;
}
