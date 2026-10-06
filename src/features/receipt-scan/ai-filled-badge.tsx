import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { AppText, useThemeColors } from '@/components/ui/primitives';
import { scale } from '@/lib/layout';

export function AiFilledBadge() {
  const c = useThemeColors();
  return (
    <View
      className='flex-row items-center gap-1 rounded-full px-2 py-0.5'
      style={{ backgroundColor: c.accentSoft }}
      importantForAccessibility='no'
      accessibilityElementsHidden
    >
      <Ionicons name='scan-outline' size={scale(14)} color={c.accent} />
      <AppText
        size='xs'
        weight='semibold'
        style={{ color: c.accent, fontSize: 12 }}
        maxScale={1.3}
        numeric
      >
        AI-filled
      </AppText>
    </View>
  );
}
