import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, View } from 'react-native';

import { AppText, Button, useThemeColors } from '@/components/ui/primitives';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { scale } from '@/lib/layout';

type Props = {
  visible: boolean;
  onTurnOn: () => void;
  onNotNow: () => void;
};

export function ReceiptScanConsentSheet({
  visible,
  onTurnOn,
  onNotNow,
}: Props) {
  const c = useThemeColors();
  const reduceMotion = useReducedMotion();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'fade' : 'slide'}
    >
      <Pressable
        className='flex-1 justify-end bg-black/55'
        onPress={onNotNow}
        accessibilityLabel='Dismiss consent'
      >
        <Pressable
          className='rounded-t-[28px] p-5'
          style={{ backgroundColor: c.surfaceOverlay }}
          onPress={(e) => e.stopPropagation()}
        >
          <View className='mb-4 items-center'>
            <Ionicons name='scan-outline' size={scale(32)} color={c.accent} />
          </View>
          <AppText size='lg' weight='bold' className='mb-3'>
            Scan receipts with AI?
          </AppText>
          <AppText size='base' secondary className='mb-3'>
            To read a receipt, FinTrack sends the photo over the internet
            through FinTrack&apos;s server to OpenRouter, a third-party AI
            service. It reads the amount, date, merchant and similar details and
            sends them back to fill in the form.
          </AppText>
          <AppText size='base' secondary className='mb-3'>
            Free AI models may keep what they receive. Only the receipt photo is
            sent. Like any web request, it carries your IP address, which
            FinTrack&apos;s server uses briefly to limit abuse and does not
            keep. Nothing else from your phone is sent: not your accounts,
            balances or other transactions.
          </AppText>
          <AppText size='base' secondary className='mb-5'>
            Scanning only happens when you tap Scan. You check everything before
            saving, and you can turn scanning off anytime in Settings.
          </AppText>
          <View className='gap-2'>
            <Button
              label='Turn on scanning'
              onPress={onTurnOn}
              className='min-h-[48px]'
            />
            <Button
              label='Not now'
              variant='secondary'
              onPress={onNotNow}
              className='min-h-[48px]'
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
