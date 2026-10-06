import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable } from 'react-native';

import { AppText, useThemeColors } from '@/components/ui/primitives';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { scale, vs } from '@/lib/layout';

type Props = {
  visible: boolean;
  onTakePhoto: () => void;
  onChooseLibrary: () => void;
  onCancel: () => void;
};

function SourceRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      className='flex-row items-center gap-3 px-4'
      style={{ minHeight: Math.max(44, vs(52)) }}
      accessibilityRole='button'
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={scale(22)} color={c.ink} />
      <AppText size='base' weight='medium'>
        {label}
      </AppText>
    </Pressable>
  );
}

export function ReceiptScanSourceSheet({
  visible,
  onTakePhoto,
  onChooseLibrary,
  onCancel,
}: Props) {
  const c = useThemeColors();
  const reduceMotion = useReducedMotion();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'fade' : 'slide'}
    >
      <Pressable className='flex-1 justify-end bg-black/55' onPress={onCancel}>
        <Pressable
          className='rounded-t-[28px] py-2'
          style={{ backgroundColor: c.surfaceOverlay }}
          onPress={(e) => e.stopPropagation()}
        >
          <AppText size='lg' weight='semibold' className='px-4 py-3'>
            Scan a receipt
          </AppText>
          <SourceRow
            icon='camera-outline'
            label='Take photo'
            onPress={onTakePhoto}
          />
          <SourceRow
            icon='images-outline'
            label='Choose from library'
            onPress={onChooseLibrary}
          />
          <Pressable
            onPress={onCancel}
            className='items-center justify-center px-4 py-3'
            style={{ minHeight: Math.max(44, vs(52)) }}
            accessibilityRole='button'
            accessibilityLabel='Cancel'
          >
            <AppText size='base' weight='medium' muted>
              Cancel
            </AppText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
