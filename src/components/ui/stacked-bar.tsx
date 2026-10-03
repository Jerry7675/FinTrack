import { View } from 'react-native';
import { AppText, useThemeColors } from './primitives';
import { formatMoney } from '@/lib/money';

export function StackedBar({
  ownedMinor,
  owedMinor,
  currency,
}: {
  ownedMinor: number;
  owedMinor: number;
  currency: string;
}) {
  const c = useThemeColors();
  const total = ownedMinor + owedMinor;
  const ownedPercent = total > 0 ? (ownedMinor / total) * 100 : 0;
  const owedPercent = total > 0 ? (owedMinor / total) * 100 : 0;

  if (total === 0) {
    return null;
  }

  return (
    <View className="gap-3">
      <View className="flex-row gap-1 overflow-hidden rounded-full" style={{ height: 32 }}>
        {ownedMinor > 0 ? (
          <View
            style={{
              flex: ownedPercent,
              backgroundColor: c.income,
            }}
          />
        ) : null}
        {owedMinor > 0 ? (
          <View
            style={{
              flex: owedPercent,
              backgroundColor: c.expense,
            }}
          />
        ) : null}
      </View>
      <View className="flex-row justify-between gap-4">
        <View className="flex-1 gap-1">
          <AppText size="xs" muted>
            What you own
          </AppText>
          <AppText size="sm" weight="semibold" style={{ color: c.income }}>
            {formatMoney(ownedMinor, currency)}
          </AppText>
        </View>
        <View className="flex-1 items-end gap-1">
          <AppText size="xs" muted>
            What you owe
          </AppText>
          <AppText size="sm" weight="semibold" style={{ color: c.expense }}>
            {formatMoney(owedMinor, currency)}
          </AppText>
        </View>
      </View>
    </View>
  );
}
