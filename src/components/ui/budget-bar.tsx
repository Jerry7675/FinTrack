import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { calculateBudgetState } from '@/lib/budget';
import { scale } from '@/lib/layout';
import { formatMoney } from '@/lib/money';
import { AppText, useThemeColors } from './primitives';

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
  const { state, percentage, remaining, label } = calculateBudgetState(
    spentMinor,
    limitMinor
  );

  const config = {
    none: { color: c.inkMuted, icon: 'information-circle' as const },
    under: { color: c.income, icon: 'checkmark-circle' as const },
    close: { color: c.warning, icon: 'alert-circle' as const },
    at: { color: c.warning, icon: 'alert-circle' as const },
    over: { color: c.expense, icon: 'warning' as const },
  }[state];

  // Format display text based on state
  let displayText: string;
  if (state === 'none' || state === 'at') {
    displayText = label;
  } else if (state === 'close') {
    displayText = `${formatMoney(remaining, currency)} left · ${label}`;
  } else if (state === 'over') {
    displayText = `${label} ${formatMoney(Math.abs(remaining), currency)}`;
  } else {
    displayText = `${formatMoney(remaining, currency)} ${label}`;
  }

  return (
    <View className='gap-2'>
      <View className='flex-row items-center gap-2'>
        <Ionicons name={config.icon} size={scale(16)} color={config.color} />
        <AppText size='sm' weight='medium' style={{ color: config.color }}>
          {displayText}
        </AppText>
      </View>
      <View
        className='h-2 w-full overflow-hidden rounded-full'
        style={{ backgroundColor: c.surfaceHigh }}
      >
        <View
          className='h-full rounded-full'
          style={{
            width: `${percentage}%`,
            backgroundColor: state === 'none' ? c.inkMuted : config.color,
          }}
        />
      </View>
    </View>
  );
}
