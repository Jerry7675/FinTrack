import { relations, sql } from 'drizzle-orm';
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
};

export const accountGroups = sqliteTable('account_groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  icon: text('icon').notNull().default('business'),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps,
});

export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    groupId: text('group_id')
      .notNull()
      .references(() => accountGroups.id),
    name: text('name').notNull(),
    currencyCode: text('currency_code').notNull().default('USD'),
    type: text('type', {
      enum: ['cash', 'bank', 'wallet', 'credit', 'other'],
    })
      .notNull()
      .default('cash'),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('accounts_group_idx').on(t.groupId)]
);

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind', { enum: ['expense', 'income'] }).notNull(),
  iconKey: text('icon_key').notNull().default('ellipse'),
  color: text('color').notNull().default('#1A7A4C'),
  isDefault: integer('is_default', { mode: 'boolean' })
    .notNull()
    .default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps,
});

export const tags = sqliteTable(
  'tags',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex('tags_name_uidx').on(t.name)]
);

export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    categoryId: text('category_id').references(() => categories.id),
    type: text('type', {
      enum: ['expense', 'income', 'transfer'],
    }).notNull(),
    amountMinor: integer('amount_minor').notNull(),
    currencyCode: text('currency_code').notNull(),
    title: text('title').notNull(),
    note: text('note'),
    occurredAt: integer('occurred_at', { mode: 'timestamp_ms' }).notNull(),
    transferId: text('transfer_id'),
    ...timestamps,
  },
  (t) => [
    index('tx_account_occurred_idx').on(t.accountId, t.occurredAt),
    index('tx_title_idx').on(t.title),
    index('tx_transfer_idx').on(t.transferId),
  ]
);

/** Local receipt/bill images — path is on-device; may be missing after reinstall. */
export const transactionAttachments = sqliteTable(
  'transaction_attachments',
  {
    id: text('id').primaryKey(),
    transactionId: text('transaction_id')
      .notNull()
      .references(() => transactions.id),
    localPath: text('local_path').notNull(),
    mimeType: text('mime_type'),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('tx_attach_tx_idx').on(t.transactionId)]
);

export const transactionTags = sqliteTable(
  'transaction_tags',
  {
    transactionId: text('transaction_id')
      .notNull()
      .references(() => transactions.id),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id),
  },
  (t) => [
    uniqueIndex('tx_tag_uidx').on(t.transactionId, t.tagId),
    index('tx_tag_tag_idx').on(t.tagId),
  ]
);

export const budgets = sqliteTable('budgets', {
  id: text('id').primaryKey(),
  categoryId: text('category_id')
    .notNull()
    .references(() => categories.id),
  accountId: text('account_id').references(() => accounts.id),
  name: text('name').notNull(),
  amountMinor: integer('amount_minor').notNull(),
  currencyCode: text('currency_code').notNull(),
  period: text('period', { enum: ['weekly', 'monthly', 'yearly'] })
    .notNull()
    .default('monthly'),
  ...timestamps,
});

export const recurringTemplates = sqliteTable('recurring_templates', {
  id: text('id').primaryKey(),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id),
  categoryId: text('category_id').references(() => categories.id),
  type: text('type', { enum: ['expense', 'income'] }).notNull(),
  title: text('title').notNull(),
  amountMinor: integer('amount_minor').notNull(),
  currencyCode: text('currency_code').notNull(),
  cadence: text('cadence', {
    enum: ['daily', 'weekly', 'monthly', 'yearly'],
  })
    .notNull()
    .default('monthly'),
  nextDueAt: integer('next_due_at', { mode: 'timestamp_ms' }).notNull(),
  note: text('note'),
  ...timestamps,
});

export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(),
  accountId: text('account_id').references(() => accounts.id),
  name: text('name').notNull(),
  targetMinor: integer('target_minor').notNull(),
  currentMinor: integer('current_minor').notNull().default(0),
  currencyCode: text('currency_code').notNull(),
  deadlineAt: integer('deadline_at', { mode: 'timestamp_ms' }),
  ...timestamps,
});

export const subscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey(),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id),
  categoryId: text('category_id').references(() => categories.id),
  name: text('name').notNull(),
  amountMinor: integer('amount_minor').notNull(),
  currencyCode: text('currency_code').notNull(),
  cadence: text('cadence', {
    enum: ['weekly', 'monthly', 'yearly'],
  })
    .notNull()
    .default('monthly'),
  nextBillingAt: integer('next_billing_at', { mode: 'timestamp_ms' }).notNull(),
  note: text('note'),
  ...timestamps,
});

export const debts = sqliteTable('debts', {
  id: text('id').primaryKey(),
  accountId: text('account_id').references(() => accounts.id),
  name: text('name').notNull(),
  kind: text('kind', { enum: ['owed_to_me', 'i_owe'] }).notNull(),
  principalMinor: integer('principal_minor').notNull(),
  remainingMinor: integer('remaining_minor').notNull(),
  currencyCode: text('currency_code').notNull(),
  counterparty: text('counterparty'),
  dueAt: integer('due_at', { mode: 'timestamp_ms' }),
  note: text('note'),
  interestRate: real('interest_rate'),
  ...timestamps,
});

export const settings = sqliteTable('settings', {
  id: text('id').primaryKey().default('default'),
  theme: text('theme', { enum: ['system', 'light', 'dark'] })
    .notNull()
    .default('system'),
  lockEnabled: integer('lock_enabled', { mode: 'boolean' })
    .notNull()
    .default(false),
  onboardingDone: integer('onboarding_done', { mode: 'boolean' })
    .notNull()
    .default(false),
  activeGroupId: text('active_group_id'),
  activeAccountId: text('active_account_id'),
  defaultCurrency: text('default_currency').notNull().default('USD'),
  profileImagePath: text('profile_image_path'),
  remindersEnabled: integer('reminders_enabled', { mode: 'boolean' })
    .notNull()
    .default(true),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const accountGroupsRelations = relations(accountGroups, ({ many }) => ({
  accounts: many(accounts),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  group: one(accountGroups, {
    fields: [accounts.groupId],
    references: [accountGroups.id],
  }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(
  transactions,
  ({ one, many }) => ({
    account: one(accounts, {
      fields: [transactions.accountId],
      references: [accounts.id],
    }),
    category: one(categories, {
      fields: [transactions.categoryId],
      references: [categories.id],
    }),
    tags: many(transactionTags),
    attachments: many(transactionAttachments),
  })
);

export const transactionAttachmentsRelations = relations(
  transactionAttachments,
  ({ one }) => ({
    transaction: one(transactions, {
      fields: [transactionAttachments.transactionId],
      references: [transactions.id],
    }),
  })
);

export const transactionTagsRelations = relations(
  transactionTags,
  ({ one }) => ({
    transaction: one(transactions, {
      fields: [transactionTags.transactionId],
      references: [transactions.id],
    }),
    tag: one(tags, {
      fields: [transactionTags.tagId],
      references: [tags.id],
    }),
  })
);

export type AccountGroup = typeof accountGroups.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type TransactionAttachment = typeof transactionAttachments.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type RecurringTemplate = typeof recurringTemplates.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Debt = typeof debts.$inferSelect;
export type Settings = typeof settings.$inferSelect;
