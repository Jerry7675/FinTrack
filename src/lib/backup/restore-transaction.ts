import type { AppDatabase } from '@/lib/db/client';
import {
  accountGroups,
  accounts,
  budgets,
  categories,
  debts,
  goals,
  recurringTemplates,
  settings,
  subscriptions,
  tags,
  transactions,
  transactionTags,
} from '@/lib/db/schema';

import type { ValidatedBackupPayload } from './validate-payload';

export type BackupDbExecutor = {
  delete: AppDatabase['delete'];
  insert: AppDatabase['insert'];
};

export type RestoreBackupHooks = {
  /** Used by integration tests to simulate failure after deletes inside the transaction. */
  afterDeletes?: () => void;
};

export function applyBackupRestore(
  tx: BackupDbExecutor,
  data: ValidatedBackupPayload['data'],
  hooks?: RestoreBackupHooks
): void {
  tx.delete(transactionTags).run();
  tx.delete(transactions).run();
  tx.delete(budgets).run();
  tx.delete(recurringTemplates).run();
  tx.delete(goals).run();
  tx.delete(subscriptions).run();
  tx.delete(debts).run();
  tx.delete(tags).run();
  tx.delete(categories).run();
  tx.delete(accounts).run();
  tx.delete(accountGroups).run();
  tx.delete(settings).run();

  hooks?.afterDeletes?.();

  if (data.accountGroups.length) {
    tx.insert(accountGroups).values(data.accountGroups).run();
  }
  if (data.accounts.length) {
    tx.insert(accounts).values(data.accounts).run();
  }
  if (data.categories.length) {
    tx.insert(categories).values(data.categories).run();
  }
  if (data.tags.length) {
    tx.insert(tags).values(data.tags).run();
  }
  if (data.transactions.length) {
    tx.insert(transactions).values(data.transactions).run();
  }
  if (data.transactionTags.length) {
    tx.insert(transactionTags).values(data.transactionTags).run();
  }
  if (data.budgets.length) {
    tx.insert(budgets).values(data.budgets).run();
  }
  if (data.recurringTemplates.length) {
    tx.insert(recurringTemplates).values(data.recurringTemplates).run();
  }
  if (data.goals.length) {
    tx.insert(goals).values(data.goals).run();
  }
  if (data.subscriptions.length) {
    tx.insert(subscriptions).values(data.subscriptions).run();
  }
  if (data.debts.length) {
    tx.insert(debts).values(data.debts).run();
  }
  if (data.settings.length) {
    tx.insert(settings).values(data.settings).run();
  }
}
