import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Pressable, View } from 'react-native';

import { AppText, Button, useThemeColors } from '@/components/ui/primitives';
import { scale } from '@/lib/layout';

import {
  type ScanBannerAction,
  type ScanBannerModel,
  successBannerMessage,
} from './banner-copy';

type Props = {
  model: ScanBannerModel | null;
  successFilled?: number;
  successNotes?: string[];
  onAction: (action: ScanBannerAction) => void;
  onCloseSuccess?: () => void;
};

export function ReceiptScanBanner({
  model,
  successFilled,
  successNotes,
  onAction,
  onCloseSuccess,
}: Props) {
  const c = useThemeColors();
  const announced = useRef(false);

  useEffect(() => {
    if (!model && successFilled == null) return;
    const message =
      successFilled != null
        ? successBannerMessage(successFilled)
        : model?.message;
    if (!message || announced.current) return;
    announced.current = true;
    AccessibilityInfo.announceForAccessibility(message);
  }, [model, successFilled]);

  if (successFilled != null && successFilled > 0) {
    return (
      <View
        className='gap-2 rounded-2xl p-3'
        style={{ backgroundColor: c.accentSoft }}
        accessibilityLiveRegion='polite'
      >
        <View className='flex-row items-start gap-2'>
          <Ionicons
            name='checkmark-circle-outline'
            size={scale(20)}
            color={c.accent}
          />
          <View className='flex-1 gap-1'>
            <AppText size='sm' weight='medium'>
              {successBannerMessage(successFilled)}
            </AppText>
            {successNotes?.map((note) => (
              <AppText key={note} size='sm' muted>
                {note}
              </AppText>
            ))}
          </View>
          <Pressable
            onPress={onCloseSuccess}
            hitSlop={12}
            style={{ minWidth: scale(44), minHeight: scale(44) }}
            accessibilityRole='button'
            accessibilityLabel='Close result banner'
          >
            <Ionicons name='close' size={scale(22)} color={c.inkMuted} />
          </Pressable>
        </View>
      </View>
    );
  }

  if (!model) return null;

  const bg = model.tone === 'negative' ? c.expenseSoft : c.accentSoft;
  const fg = model.tone === 'negative' ? '#FB7185' : c.accent;

  return (
    <View
      className='gap-2 rounded-2xl p-3'
      style={{ backgroundColor: bg }}
      accessibilityLiveRegion='polite'
    >
      <View className='flex-row items-start gap-2'>
        <Ionicons name='alert-circle-outline' size={scale(20)} color={fg} />
        <AppText size='sm' style={{ color: fg, flex: 1 }}>
          {model.message}
        </AppText>
      </View>
      <View className='flex-row flex-wrap gap-2'>
        {model.actions.map((action) => (
          <Button
            key={action.id}
            label={action.label}
            variant='secondary'
            disabled={action.disabled}
            onPress={() => onAction(action.id)}
            className='min-h-[44px]'
          />
        ))}
      </View>
    </View>
  );
}
