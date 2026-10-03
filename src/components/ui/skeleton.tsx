import { View, type ViewStyle, type DimensionValue } from 'react-native';
import { useThemeColors } from './primitives';

export function Skeleton({
  width,
  height,
  className = '',
  style,
}: {
  width?: DimensionValue;
  height: number;
  className?: string;
  style?: ViewStyle;
}) {
  const c = useThemeColors();

  return (
    <View
      className={`rounded-lg ${className}`}
      style={[
        {
          width,
          height,
          backgroundColor: c.surfaceHigh,
        },
        style,
      ]}
    />
  );
}
