import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import {
  AppText,
  CategoryGlyph,
  useThemeColors,
} from '@/components/ui/primitives';
import { fontSize, scale, vs } from '@/lib/layout';
import { useApp } from '@/providers/app-provider';

/** Surface card with consistent elevation. */
export function SurfaceCard({
  children,
  className = '',
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  const { colorScheme } = useApp();
  const c = useThemeColors();
  const shadow =
    colorScheme === 'light'
      ? {
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        }
      : {};

  return (
    <View
      className={`${padded ? 'p-4' : ''} ${className}`}
      style={{
        backgroundColor: c.surfaceRaised,
        borderRadius: scale(20),
        borderWidth: 1,
        borderColor: c.line,
        ...shadow,
      }}
    >
      {children}
    </View>
  );
}

/** Balance hero card with flat surface. */
export function BalanceCard({
  label = 'Total balance',
  amount,
  lines,
}: {
  label?: string;
  amount: string;
  lines?: Array<{ label: string; amount: string }>;
}) {
  const c = useThemeColors();
  return (
    <View
      style={{
        borderRadius: scale(24),
        backgroundColor: c.surfaceRaised,
        borderWidth: 1,
        borderColor: c.line,
        paddingHorizontal: scale(20),
        paddingVertical: vs(22),
      }}
    >
      <AppText size='sm' secondary>
        {label}
      </AppText>
      <AppText
        size='display'
        weight='bold'
        numeric
        maxScale={1.3}
        style={{ marginTop: 4 }}
      >
        {amount}
      </AppText>
      {lines && lines.length > 0 ? (
        <View style={{ marginTop: 12, gap: 4 }}>
          {lines.map((line) => (
            <View
              key={line.label}
              className='flex-row items-center justify-between'
            >
              <AppText size='xs' muted>
                {line.label}
              </AppText>
              <AppText size='xs' secondary numeric>
                {line.amount}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function ActionTile({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}) {
  const c = useThemeColors();

  return (
    <Pressable onPress={onPress} className='flex-1'>
      <View
        style={{
          backgroundColor: c.surfaceHigh,
          borderRadius: scale(20),
          paddingVertical: vs(16),
          paddingHorizontal: scale(10),
          alignItems: 'center',
          minHeight: vs(108),
          justifyContent: 'space-between',
        }}
      >
        <View
          style={{
            width: scale(44),
            height: scale(44),
            borderRadius: scale(14),
            backgroundColor: c.surfaceRaised,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={scale(22)} color={c.accent} />
        </View>
        <AppText weight='semibold' size='sm'>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

export function SummaryStrip({
  items,
}: {
  items: { label: string; value: string }[];
}) {
  return (
    <SurfaceCard>
      <View className='flex-row justify-between'>
        {items.map((item) => (
          <View key={item.label}>
            <AppText size='xs' muted>
              {item.label}
            </AppText>
            <AppText weight='semibold' style={{ marginTop: 2 }}>
              {item.value}
            </AppText>
          </View>
        ))}
      </View>
    </SurfaceCard>
  );
}

export function TransactionCard({
  title,
  subtitle,
  amount,
  amountColor,
  iconKey,
  iconColor,
  onPress,
}: {
  title: string;
  subtitle: string;
  amount: string;
  amountColor?: string;
  iconKey: string;
  iconColor: string;
  onPress?: () => void;
}) {
  const c = useThemeColors();
  return (
    <Pressable onPress={onPress}>
      <SurfaceCard className='mb-2'>
        <View className='flex-row items-center gap-3'>
          <CategoryGlyph iconKey={iconKey} color={iconColor} size={44} />
          <View className='flex-1'>
            <AppText weight='semibold'>{title}</AppText>
            <AppText size='sm' muted>
              {subtitle}
            </AppText>
          </View>
          <AppText
            weight='semibold'
            style={{
              color: amountColor ?? c.ink,
              fontSize: fontSize(15),
            }}
          >
            {amount}
          </AppText>
        </View>
      </SurfaceCard>
    </Pressable>
  );
}

export function AccountCard({
  name,
  meta,
  onPress,
  onLongPress,
}: {
  name: string;
  meta: string;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const c = useThemeColors();
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress}>
      <SurfaceCard className='mb-2'>
        <View className='flex-row items-center gap-3'>
          <View
            style={{
              width: scale(44),
              height: scale(44),
              borderRadius: scale(14),
              backgroundColor: c.accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name='wallet-outline' size={scale(20)} color={c.accent} />
          </View>
          <View className='flex-1'>
            <AppText weight='semibold'>{name}</AppText>
            <AppText size='sm' muted>
              {meta}
            </AppText>
          </View>
          <Ionicons
            name='chevron-forward'
            size={scale(18)}
            color={c.inkMuted}
          />
        </View>
      </SurfaceCard>
    </Pressable>
  );
}
