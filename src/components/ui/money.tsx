import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { AppText, useThemeColors } from './primitives';
import { formatMoney } from '@/lib/money';
import { scale } from '@/lib/layout';

export type MoneyTone = 'auto' | 'neutral' | 'income' | 'expense';

export function Money({
  minor,
  currency,
  tone = 'auto',
  size = 'base',
  showSign = false,
  icon,
}: {
  minor: number;
  currency: string;
  tone?: MoneyTone;
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | 'display';
  showSign?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
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

  const displayValue = showSign && !isNegative && !isZero ? `+${formatted}` : formatted;

  const spokenSign = isNegative ? 'minus' : showSign && !isZero ? 'plus' : '';
  const parts = Math.abs(minor)
    .toString()
    .padStart(3, '0')
    .match(/^(.*)(\d{2})$/);
  const dollars = parts ? Number.parseInt(parts[1], 10) : 0;
  const cents = parts ? parts[2] : '00';
  const accessibilityLabel = `${spokenSign} ${dollars} ${currency === 'USD' ? 'dollars' : currency} ${cents === '00' ? '' : `and ${cents} cents`}`.trim();

  return (
    <View
      className="flex-row items-center gap-1.5"
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="text"
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={size === 'display' ? scale(24) : size === 'xl' ? scale(20) : scale(16)}
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
