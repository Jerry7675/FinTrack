import { Text, VStack } from '@expo/ui/swift-ui';
import { font } from '@expo/ui/swift-ui/modifiers';
import * as SecureStore from 'expo-secure-store';
import { createWidget } from 'expo-widgets';

import { db } from '@/lib/db/client';
import { getAccountBalance, listAccounts } from '@/lib/db/queries';
import { getSettings } from '@/lib/db/seed';
import { formatMoney } from '@/lib/money';

export type BalanceWidgetProps = {
  label: string;
  balance: string;
  subtitle: string;
};

const SNAPSHOT_KEY = 'fintrack_widget_snapshot';

export const balanceWidget = createWidget<BalanceWidgetProps>(
  'FinTrackBalance',
  (props) => {
    'widget';
    return (
      <VStack spacing={4}>
        <Text>{props.label || 'FinTrack'}</Text>
        <Text modifiers={[font({ size: 22, weight: 'bold' })]}>
          {props.balance || '—'}
        </Text>
        <Text modifiers={[font({ size: 12 })]}>
          {props.subtitle || 'Open the app to refresh'}
        </Text>
      </VStack>
    );
  }
);

export async function updateWidgetSnapshot(): Promise<void> {
  try {
    const settings = await getSettings(db);
    const accounts = await listAccounts(db);
    const account =
      accounts.find((a) => a.id === settings?.activeAccountId) ?? accounts[0];

    let balance = 0;
    let label = 'FinTrack';
    let currency = settings?.defaultCurrency ?? 'USD';

    if (account) {
      balance = await getAccountBalance(db, account.id);
      label = account.name;
      currency = account.currencyCode;
    }

    const props: BalanceWidgetProps = {
      label,
      balance: formatMoney(balance, currency),
      subtitle: 'On-device balance',
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
