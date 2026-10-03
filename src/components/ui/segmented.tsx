import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { scale } from '@/lib/layout';
import { AppText, useThemeColors } from './primitives';

export type SegmentedOption = {
  value: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

export function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const c = useThemeColors();

  return (
    <View className='flex-row gap-2' accessibilityRole='tablist'>
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            className='flex-1 flex-row items-center justify-center gap-2 rounded-xl px-4 py-3'
            style={{
              backgroundColor: isSelected ? c.accentSoft : c.surfaceHigh,
              minHeight: Math.max(44, scale(48)),
            }}
            accessibilityRole='tab'
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={option.label}
          >
            {option.icon ? (
              <Ionicons
                name={option.icon}
                size={scale(18)}
                color={isSelected ? c.accent : c.inkMuted}
              />
            ) : null}
            <AppText
              size='sm'
              weight='semibold'
              style={{ color: isSelected ? c.accent : c.inkMuted }}
            >
              {option.label}
            </AppText>
            {isSelected ? (
              <Ionicons name='checkmark' size={scale(16)} color={c.accent} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
