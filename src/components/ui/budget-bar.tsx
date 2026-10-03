import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { AppText, useThemeColors } from './primitives';
import { formatMoney } from '@/lib/money';
import { scale } from '@/lib/layout';

export function BudgetBar({
  spentMinor,
  limitMinor,
  currency,
}: {
  spentMinor: number;
  limitMinor: number;
  currency: string;
}) {
  const c = useThemeColors();
  const ratio = limitMinor > 0 ? spentMinor / limitMinor : 0;
  const percentage = Math.min(ratio * 100, 100);
  
  const isOver = ratio >= 1;
  const isNear = ratio >= 0.8 && ratio < 1;

  const state = isOver ? 'over' : isNear ? 'near' : 'ok';
  const config = {
    ok: { color: c.income, icon: 'checkmark-circle' as const, text: 'left' },
    near: { color: c.warning, icon: 'alert-circle' as const, text: 'left' },
    over: { color: c.expense, icon: 'warning' as const, text: 'Over by' },
  }[state];

  const remaining = limitMinor - spentMinor;
  const displayAmount = isOver
    ? formatMoney(Math.abs(remaining), currency)
    : formatMoney(remaining, currency);

  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        <Ionicons name={config.icon} size={scale(16)} color={config.color} />
        <AppText size="sm" weight="medium" style={{ color: config.color }}>
          {isOver ? `${config.text} ${displayAmount}` : `${displayAmount} ${config.text}`}
        </AppText>
      </View>
      <View
        className="h-2 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: c.surfaceHigh }}
      >
        <View
          className="h-full rounded-full"
          style={{
            width: `${percentage}%`,
            backgroundColor: config.color,
          }}
        />
      </View>
    </View>
  );
}
