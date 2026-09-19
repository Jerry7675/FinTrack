import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, View } from 'react-native';

import {
  AppText,
  CategoryGlyph,
  useThemeColors,
} from '@/components/ui/primitives';
import { fontSize, scale, vs } from '@/lib/layout';
import { useApp } from '@/providers/app-provider';

/** GrowFi-style surface card — large radius, soft elevation. */
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
  return (
    <View
      className={`${padded ? 'p-4' : ''} ${className}`}
      style={{
        backgroundColor:
          colorScheme === 'dark' ? c.surfaceRaised : c.surfaceRaised,
        borderRadius: scale(24),
        borderWidth: colorScheme === 'dark' ? 1 : 0,
        borderColor: c.line,
        shadowColor: '#000',
        shadowOpacity: colorScheme === 'dark' ? 0.35 : 0.08,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 3,
      }}
    >
      {children}
    </View>
  );
}

/** Dark balance hero card (GrowFi total-balance pattern) with green accent FAB. */
export function BalanceCard({
  label = 'Total balance',
  amount,
  onAdd,
}: {
  label?: string;
  amount: string;
  onAdd?: () => void;
}) {
  return (
    <View
      style={{
        borderRadius: scale(28),
        overflow: 'hidden',
        backgroundColor: '#0A0A0A',
        paddingHorizontal: scale(20),
        paddingVertical: vs(22),
      }}
    >
      <LinearGradient
        colors={['#0A0A0A', '#111111', '#0F2A1C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
        }}
      />
      <View className='flex-row items-center justify-between'>
        <View className='flex-1 pr-3'>
          <AppText size='sm' style={{ color: '#A1A1AA' }}>
            {label}
          </AppText>
          <AppText
            size='display'
            weight='bold'
            style={{ color: '#FAFAFA', marginTop: 4 }}
          >
            {amount}
          </AppText>
        </View>
        {onAdd ? (
          <Pressable
            onPress={onAdd}
            accessibilityLabel='Add transaction'
            style={{
              width: scale(52),
              height: scale(52),
              borderRadius: scale(26),
              backgroundColor: '#3DDB8A',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#3DDB8A',
              shadowOpacity: 0.45,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
            }}
          >
            <Ionicons name='add' size={scale(28)} color='#0A0A0A' />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function ActionTile({
  label,
  icon,
  onPress,
  tone = 'green',
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  tone?: 'green' | 'mint' | 'slate';
}) {
  const { colorScheme } = useApp();
  const gradients = {
    green: ['#D8F0E4', '#F4F7F5'] as const,
    mint: ['#CFFAFE', '#F0FDFA'] as const,
    slate: ['#E4E4E7', '#FAFAFA'] as const,
  };
  const darkGradients = {
    green: ['#0F2A1C', '#171717'] as const,
    mint: ['#0C1F1C', '#171717'] as const,
    slate: ['#1C1C1F', '#171717'] as const,
  };
  const colors = colorScheme === 'dark' ? darkGradients[tone] : gradients[tone];
  const iconColor = colorScheme === 'dark' ? '#3DDB8A' : '#1A7A4C';

  return (
    <Pressable onPress={onPress} className='flex-1'>
      <LinearGradient
        colors={[...colors]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{
          borderRadius: scale(22),
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
            backgroundColor: colorScheme === 'dark' ? '#0A0A0A88' : '#FFFFFFAA',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={scale(22)} color={iconColor} />
        </View>
        <AppText weight='semibold' size='sm'>
          {label}
        </AppText>
      </LinearGradient>
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
