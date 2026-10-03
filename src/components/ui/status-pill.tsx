import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { AppText, useThemeColors } from './primitives';
import { scale } from '@/lib/layout';

export type StatusTone = 'ok' | 'near' | 'over' | 'info' | 'neutral';

export function StatusPill({
  tone,
  icon,
  text,
}: {
  tone: StatusTone;
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  const c = useThemeColors();

  const config = {
    ok: { bg: c.incomeSoft, fg: c.income },
    near: { bg: c.warningSoft, fg: c.warning },
    over: { bg: c.expenseSoft, fg: c.expense },
    info: { bg: c.accentSoft, fg: c.accent },
    neutral: { bg: c.surfaceHigh, fg: c.inkSecondary },
  }[tone];

  return (
    <View
      className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
      style={{ backgroundColor: config.bg }}
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      accessibilityLabel={text}
    >
      <Ionicons name={icon} size={scale(14)} color={config.fg} />
      <AppText size="xs" weight="medium" style={{ color: config.fg }}>
        {text}
      </AppText>
    </View>
  );
}
