import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, View } from 'react-native';

import { AppText, Button, useThemeColors } from '@/components/ui/primitives';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { scale } from '@/lib/layout';

type Props = {
  visible: boolean;
  receiptUri: string | null;
  phase: 'preparing' | 'reading';
  onCancel: () => void;
};

export function ReceiptScanPanel({
  visible,
  receiptUri,
  phase,
  onCancel,
}: Props) {
  const c = useThemeColors();
  const reduceMotion = useReducedMotion();

  if (!visible) return null;

  return (
    <View
      className='absolute inset-0 z-20 justify-center px-4'
      style={{ backgroundColor: c.surfaceOverlay }}
      accessibilityViewIsModal
    >
      <View className='items-center gap-3'>
        {receiptUri ? (
          <Image
            source={{ uri: receiptUri }}
            style={{
              width: scale(72),
              height: scale(72),
              borderRadius: 12,
            }}
            accessibilityIgnoresInvertColors
          />
        ) : null}
        <AppText size='lg' weight='semibold'>
          {phase === 'preparing' ? 'Preparing photo…' : 'Reading receipt…'}
        </AppText>
        <AppText size='sm' muted>
          This can take up to 30 seconds.
        </AppText>
        {reduceMotion ? (
          <Ionicons
            name='hourglass-outline'
            size={scale(28)}
            color={c.accent}
          />
        ) : (
          <ActivityIndicator color={c.accent} size='large' />
        )}
        <View className='mt-4 w-full'>
          <Button
            label='Cancel'
            variant='secondary'
            onPress={onCancel}
            className='min-h-[44px]'
          />
        </View>
      </View>
    </View>
  );
}
