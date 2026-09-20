import { HStack, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type BalanceWidgetProps = {
  brand: string;
  label: string;
  balance: string;
  income: string;
  expenses: string;
  saved: string;
  budgetLine1: string;
  budgetLine2: string;
};

const FinTrackBalanceWidget = (
  props: BalanceWidgetProps,
  environment: WidgetEnvironment
) => {
  'widget';

  const brand = props.brand || 'FinTrack';
  const label = props.label || 'Balance';
  const balance = props.balance || '—';
  const income = props.income || '—';
  const expenses = props.expenses || '—';
  const saved = props.saved || '—';
  const budget1 = props.budgetLine1 || '';
  const budget2 = props.budgetLine2 || '';
  const family = environment.widgetFamily;
  const ink = '#0B1F17';
  const muted = '#5C6B64';
  const accent = '#1A7A4C';

  if (family === 'systemLarge') {
    return (
      <VStack spacing={6}>
        <Text
          modifiers={[
            font({ size: 12, weight: 'semibold' }),
            foregroundStyle(accent),
          ]}
        >
          {brand}
        </Text>
        <Text
          modifiers={[font({ size: 26, weight: 'bold' }), foregroundStyle(ink)]}
        >
          {balance}
        </Text>
        <Text modifiers={[font({ size: 11 }), foregroundStyle(muted)]}>
          {label}
        </Text>
        <HStack spacing={12}>
          <VStack spacing={2}>
            <Text modifiers={[font({ size: 10 }), foregroundStyle(muted)]}>
              Income
            </Text>
            <Text
              modifiers={[
                font({ size: 13, weight: 'semibold' }),
                foregroundStyle(ink),
              ]}
            >
              {income}
            </Text>
          </VStack>
          <VStack spacing={2}>
            <Text modifiers={[font({ size: 10 }), foregroundStyle(muted)]}>
              Expenses
            </Text>
            <Text
              modifiers={[
                font({ size: 13, weight: 'semibold' }),
                foregroundStyle(ink),
              ]}
            >
              {expenses}
            </Text>
          </VStack>
          <VStack spacing={2}>
            <Text modifiers={[font({ size: 10 }), foregroundStyle(muted)]}>
              Saved
            </Text>
            <Text
              modifiers={[
                font({ size: 13, weight: 'semibold' }),
                foregroundStyle(ink),
              ]}
            >
              {saved}
            </Text>
          </VStack>
        </HStack>
        <Text modifiers={[font({ size: 11 }), foregroundStyle(muted)]}>
          {budget1 || ' '}
        </Text>
        <Text modifiers={[font({ size: 11 }), foregroundStyle(muted)]}>
          {budget2 || ' '}
        </Text>
      </VStack>
    );
  }

  if (family === 'systemMedium') {
    return (
      <VStack spacing={6}>
        <HStack spacing={8}>
          <VStack spacing={2}>
            <Text modifiers={[font({ size: 11 }), foregroundStyle(muted)]}>
              Balance
            </Text>
            <Text
              modifiers={[
                font({ size: 20, weight: 'bold' }),
                foregroundStyle(ink),
              ]}
            >
              {balance}
            </Text>
          </VStack>
        </HStack>
        <HStack spacing={16}>
          <VStack spacing={2}>
            <Text modifiers={[font({ size: 10 }), foregroundStyle(muted)]}>
              Income
            </Text>
            <Text
              modifiers={[
                font({ size: 13, weight: 'semibold' }),
                foregroundStyle(ink),
              ]}
            >
              {income}
            </Text>
          </VStack>
          <VStack spacing={2}>
            <Text modifiers={[font({ size: 10 }), foregroundStyle(muted)]}>
              Expenses
            </Text>
            <Text
              modifiers={[
                font({ size: 13, weight: 'semibold' }),
                foregroundStyle(ink),
              ]}
            >
              {expenses}
            </Text>
          </VStack>
        </HStack>
      </VStack>
    );
  }

  return (
    <VStack spacing={4}>
      <Text
        modifiers={[
          font({ size: 12, weight: 'semibold' }),
          foregroundStyle(accent),
        ]}
      >
        {brand}
      </Text>
      <Text
        modifiers={[font({ size: 22, weight: 'bold' }), foregroundStyle(ink)]}
      >
        {balance}
      </Text>
      <Text modifiers={[font({ size: 11 }), foregroundStyle(muted)]}>
        {label}
      </Text>
    </VStack>
  );
};

export const balanceWidget = createWidget<BalanceWidgetProps>(
  'FinTrackBalance',
  FinTrackBalanceWidget
);

export default balanceWidget;
