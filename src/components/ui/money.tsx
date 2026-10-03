import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { scale } from '@/lib/layout';
import { formatMoney, getCurrency } from '@/lib/money';
import { AppText, useThemeColors } from './primitives';

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

  // Sign and arrow always reflect the value
  const displayValue =
    isNegative ? formatted : !isZero ? `+${formatted}` : formatted;

  // Build accessible label using actual currency properties
  const currencyInfo = getCurrency(currency);
  const absValue = Math.abs(minor);
  const majorUnits = Math.floor(absValue / 10 ** currencyInfo.decimals);
  const minorUnits = absValue % 10 ** currencyInfo.decimals;

  let accessibilityLabel = isNegative ? 'minus ' : !isZero ? 'plus ' : '';
  accessibilityLabel += `${majorUnits} ${currencyInfo.name}`;
  
  if (currencyInfo.decimals > 0 && minorUnits > 0) {
    // For currencies with decimals, add fractional part
    const minorString = minorUnits.toString().padStart(currencyInfo.decimals, '0');
    const minorLabel = currencyInfo.decimals === 2 ? 'cents' : currencyInfo.code;
    accessibilityLabel += ` and ${minorString} ${minorLabel}`;
  }

  return (
    <View
      className='flex-row items-center gap-1.5'
      accessibilityLabel={accessibilityLabel.trim()}
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
