import {
  endOfMonth,
  endOfWeek,
  endOfYear,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';
import * as SecureStore from 'expo-secure-store';

import {
  type BalanceWidgetProps,
  balanceWidget,
} from '@/features/widgets/FinTrackBalance';
import { db } from '@/lib/db/client';
import {
  getAccountBalance,
  getBudgetSpend,
  listAccounts,
  listBudgets,
  listTransactions,
} from '@/lib/db/queries';
import { getSettings } from '@/lib/db/seed';
import { formatMoney } from '@/lib/money';

const SNAPSHOT_KEY = 'fintrack_widget_snapshot';

function periodBounds(period: 'weekly' | 'monthly' | 'yearly'): {
  from: Date;
  to: Date;
} {
  const now = new Date();
  if (period === 'weekly') {
    return {
      from: startOfWeek(now, { weekStartsOn: 1 }),
      to: endOfWeek(now, { weekStartsOn: 1 }),
    };
  }
  if (period === 'yearly') {
    return { from: startOfYear(now), to: endOfYear(now) };
  }
  return { from: startOfMonth(now), to: endOfMonth(now) };
}

export async function updateWidgetSnapshot(): Promise<void> {
  try {
    const settings = await getSettings(db);
    const accounts = await listAccounts(db);
    const account =
      accounts.find((a) => a.id === settings?.activeAccountId) ?? accounts[0];

    let balance = 0;
    let label = 'Balance';
    let currency = settings?.defaultCurrency ?? 'USD';

    if (account) {
      balance = await getAccountBalance(db, account.id);
      label = account.name;
      currency = account.currencyCode;
    }

    const month = periodBounds('monthly');
    const monthTxns = await listTransactions(db, {
      accountId: account?.id,
      from: month.from,
      to: month.to,
      limit: 500,
    });

    let incomeMinor = 0;
    let expenseMinor = 0;
    for (const row of monthTxns) {
      if (row.transaction.type === 'income') {
        incomeMinor += row.transaction.amountMinor;
      } else if (row.transaction.type === 'expense') {
        expenseMinor += row.transaction.amountMinor;
      }
    }
    const savedMinor = incomeMinor - expenseMinor;

    const budgets = await listBudgets(db);
    const budgetLines: string[] = [];
    for (const b of budgets.slice(0, 2)) {
      const spent = await getBudgetSpend(db, b);
      budgetLines.push(
        `${b.name}  ${formatMoney(spent, b.currencyCode)} / ${formatMoney(b.amountMinor, b.currencyCode)}`
      );
    }

    const props: BalanceWidgetProps = {
      brand: 'FinTrack',
      label,
      balance: formatMoney(balance, currency),
      income: formatMoney(incomeMinor, currency),
      expenses: formatMoney(expenseMinor, currency),
      saved: formatMoney(savedMinor, currency),
      budgetLine1: budgetLines[0] ?? '',
      budgetLine2: budgetLines[1] ?? '',
    };

    await SecureStore.setItemAsync(SNAPSHOT_KEY, JSON.stringify(props));

    try {
      balanceWidget.updateSnapshot(props);
    } catch {
      // Requires a development/production build with expo-widgets.
    }
  } catch {
    // Non-fatal outside native widget environments.
  }
}

export type { BalanceWidgetProps };
