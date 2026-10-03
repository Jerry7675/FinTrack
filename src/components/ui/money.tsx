import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { scale } from '@/lib/layout';
import { formatMoney, moneyA11yLabel } from '@/lib/money';
import { AppText, useThemeColors } from './primitives';

export type MoneyTone = 'auto' | 'neutral' | 'income' | 'expense';

export function Money({
  minor,
  currency,
  tone = 'auto',
  size = 'base',
  hideArrow = false,
}: {
  minor: number;
  currency: string;
  tone?: MoneyTone;
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | 'display';
  hideArrow?: boolean;
}) {
  const c = useThemeColors();
  const formatted = formatMoney(minor, currency);
  const isNegative = minor < 0;
  const isZero = minor === 0;

  const resolvedTone =
    tone === 'auto'
      ? isZero
        ? 'neutral'
        : isNegative
          ? 'expense'
          : 'income'
      : tone;

  const color =
    resolvedTone === 'income'
      ? c.income
      : resolvedTone === 'expense'
        ? c.expense
        : c.ink;

  // Sign and arrow always reflect the value
  const displayValue = isNegative
    ? formatted
    : !isZero
      ? `+${formatted}`
      : formatted;

  // Auto-pick arrow icon based on sign
  const icon = hideArrow
    ? undefined
    : isNegative
      ? ('arrow-down' as const)
      : !isZero
        ? ('arrow-up' as const)
        : undefined;

  const accessibilityLabel = moneyA11yLabel(minor, currency);

  return (
    <View
      className='flex-row items-center gap-1.5'
      accessibilityLabel={accessibilityLabel}
      accessibilityRole='text'
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={
            size === 'display'
              ? scale(24)
              : size === 'xl'
                ? scale(20)
                : scale(16)
          }
          color={color}
          accessibilityElementsHidden
        />
      ) : null}
      <AppText
        size={size}
        weight={size === 'display' || size === 'xl' ? 'bold' : 'semibold'}
        style={{ color, fontVariant: ['tabular-nums'] }}
      >
        {displayValue}
      </AppText>
    </View>
  );
}
