import { Ionicons } from '@expo/vector-icons';
import { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { AppText, useThemeColors } from '@/components/ui/primitives';
import { fontSize, scale, vs } from '@/lib/layout';
import { getCurrency } from '@/lib/money';

import { type KeypadAction, keypadReducer } from './keypad-logic';

export type { KeypadAction, KeypadReducerResult } from './keypad-logic';
export {
  formatKeypadDisplay,
  formatMaxAmountLabel,
  keypadReducer,
  maxIntegerDigitsForCurrency,
} from './keypad-logic';

type KeypadProps = {
  currencyCode: string;
  locale: string;
  amountText: string;
  onAmountTextChange: (text: string) => void;
  onBlockedPress?: () => void;
  visible: boolean;
};

export function AmountDisplay({
  amountText,
  currencyCode,
  locale,
  onPress,
  errorMessage,
  helperMessage,
}: {
  amountText: string;
  currencyCode: string;
  locale: string;
  onPress?: () => void;
  errorMessage?: string;
  helperMessage?: string;
}) {
  const c = useThemeColors();
  const display = formatKeypadDisplay(amountText, currencyCode, locale);
  const placeholder = formatKeypadDisplay('0', currencyCode, locale);
  const label = amountText
    ? `Amount, ${display} ${currencyCode}`
    : `Amount, zero ${currencyCode}`;

  return (
    <View className='gap-1'>
      <Pressable
        onPress={onPress}
        accessibilityRole='text'
        accessibilityLabel={label}
        accessibilityLiveRegion='polite'
      >
        <AppText
          size='display'
          weight='bold'
          numeric
          maxScale={1.2}
          style={{
            color: display ? c.ink : c.inkMuted,
            fontVariant: ['tabular-nums'],
          }}
        >
          {display || placeholder}
        </AppText>
      </Pressable>
      {errorMessage || helperMessage ? (
        <AppText
          size='sm'
          style={{ color: errorMessage ? c.expense : c.inkMuted }}
        >
          {errorMessage ?? helperMessage}
        </AppText>
      ) : null}
    </View>
  );
}

export function Keypad({
  currencyCode,
  locale,
  amountText,
  onAmountTextChange,
  onBlockedPress,
  visible,
}: KeypadProps) {
  const c = useThemeColors();
  const { decimals } = getCurrency(currencyCode);
  const decSep =
    new Intl.NumberFormat(locale)
      .formatToParts(1.1)
      .find((p) => p.type === 'decimal')?.value ?? '.';

  const dispatch = useCallback(
    (action: KeypadAction) => {
      const result = keypadReducer(amountText, action, currencyCode);
      if (result.blocked) {
        onBlockedPress?.();
        return;
      }
      onAmountTextChange(result.amountText);
    },
    [amountText, currencyCode, onAmountTextChange, onBlockedPress]
  );

  const keyHeight = Math.min(56, Math.max(44, vs(48)));

  if (!visible) return null;

  const rows: (string | 'dec' | 'back')[][] = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    [decimals > 0 ? 'dec' : 'spacer', '0', 'back'],
  ];

  return (
    <View className='gap-2' accessibilityLabel='Amount keypad'>
      {rows.map((row) => (
        <View key={row.join('-')} className='flex-row gap-2'>
          {row.map((key) => {
            if (key === 'spacer') {
              return <View key='spacer' className='flex-1' />;
            }
            if (key === 'dec') {
              return (
                <Pressable
                  key='dec'
                  onPress={() => dispatch({ type: 'decimal' })}
                  className='flex-1 items-center justify-center rounded-[14px]'
                  style={{
                    backgroundColor: c.surfaceHigh,
                    minHeight: keyHeight,
                  }}
                  accessibilityRole='button'
                  accessibilityLabel={
                    decSep === ',' ? 'comma' : 'decimal point'
                  }
                >
                  <AppText size='lg' weight='semibold' numeric maxScale={1.2}>
                    {decSep}
                  </AppText>
                </Pressable>
              );
            }
            if (key === 'back') {
              return (
                <Pressable
                  key='back'
                  onPress={() => dispatch({ type: 'backspace' })}
                  onLongPress={() => dispatch({ type: 'clear' })}
                  delayLongPress={500}
                  className='flex-1 items-center justify-center rounded-[14px]'
                  style={{
                    backgroundColor: c.surfaceHigh,
                    minHeight: keyHeight,
                  }}
                  accessibilityRole='button'
                  accessibilityLabel='Delete last digit'
                  accessibilityHint='Long press to clear all'
                >
                  <Ionicons
                    name='backspace-outline'
                    size={scale(22)}
                    color={c.ink}
                  />
                </Pressable>
              );
            }
            return (
              <Pressable
                key={key}
                onPress={() => dispatch({ type: 'digit', digit: key })}
                className='flex-1 items-center justify-center rounded-[14px]'
                style={{
                  backgroundColor: c.surfaceHigh,
                  minHeight: keyHeight,
                }}
                accessibilityRole='button'
                accessibilityLabel={key}
              >
                <AppText
                  size='lg'
                  weight='semibold'
                  numeric
                  maxScale={1.2}
                  style={{ fontSize: fontSize(17) }}
                >
                  {key}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
