import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  type PressableProps,
  ScrollView,
  type ScrollViewProps,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { colors } from '@/constants/palette';
import { resolveCategoryIcon } from '@/lib/categories/icons';
import { fontSize, scale, vs } from '@/lib/layout';
import { useApp } from '@/providers/app-provider';

export function useThemeColors() {
  const { colorScheme } = useApp();
  return colors(colorScheme === 'dark' ? 'dark' : 'light');
}

export function Screen({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const c = useThemeColors();
  return (
    <View
      className={`flex-1 ${className}`}
      style={{ flex: 1, backgroundColor: c.surface }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {children}
      </SafeAreaView>
    </View>
  );
}

/** Keyboard-aware scroll container for forms so lower fields stay visible. */
export function FormScroll({
  children,
  contentContainerStyle,
  style,
  ...rest
}: ScrollViewProps) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
    >
      <ScrollView
        keyboardShouldPersistTaps='handled'
        keyboardDismissMode='on-drag'
        contentContainerStyle={[
          { paddingBottom: vs(80) },
          contentContainerStyle,
        ]}
        style={style}
        {...rest}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function AppText({
  children,
  className = '',
  muted,
  size = 'base',
  weight = 'normal',
  style,
}: {
  children: React.ReactNode;
  className?: string;
  muted?: boolean;
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | 'display';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  style?: object;
}) {
  const c = useThemeColors();
  const sizes = {
    xs: fontSize(12),
    sm: fontSize(13),
    base: fontSize(15),
    lg: fontSize(17),
    xl: fontSize(22),
    display: fontSize(34),
  };
  const weights = {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  };

  return (
    <Text
      className={className}
      style={{
        fontSize: sizes[size],
        fontWeight: weights[weight],
        color: muted ? c.inkMuted : c.ink,
        letterSpacing: size === 'display' ? -0.8 : 0,
        ...style,
      }}
    >
      {children}
    </Text>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  className = '',
  icon,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { colorScheme } = useApp();
  const c = useThemeColors();
  const styles = {
    primary: 'bg-accent',
    secondary:
      colorScheme === 'dark' ? 'bg-surface-dark-raised' : 'bg-surface-raised',
    danger: 'bg-expense',
    ghost: 'bg-transparent',
  }[variant];
  const textColor =
    variant === 'primary'
      ? colorScheme === 'dark'
        ? '#0A0A0A'
        : '#FFFFFF'
      : variant === 'danger'
        ? '#FFFFFF'
        : c.ink;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`flex-row items-center justify-center gap-2 rounded-2xl px-5 py-3.5 ${styles} ${
        disabled ? 'opacity-40' : ''
      } ${className}`}
      style={{ minHeight: vs(48) }}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon ? (
            <Ionicons name={icon} size={scale(18)} color={textColor} />
          ) : null}
          <Text
            style={{
              color: textColor,
              fontSize: fontSize(15),
              fontWeight: '600',
            }}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/** Shared back control — chevron + optional label. */
export function GoBack({
  label = 'Back',
  onPress,
  fallbackHref = '/',
}: {
  label?: string;
  onPress?: () => void;
  fallbackHref?: string;
}) {
  const c = useThemeColors();
  const handle = () => {
    if (onPress) {
      onPress();
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(fallbackHref as '/');
  };

  return (
    <Pressable
      onPress={handle}
      hitSlop={10}
      className='-ml-1 flex-row items-center gap-0.5 self-start rounded-full py-1 pr-2'
      accessibilityRole='button'
      accessibilityLabel={label || 'Back'}
    >
      <Ionicons name='chevron-back' size={scale(22)} color={c.ink} />
      {label ? (
        <Text
          style={{
            color: c.ink,
            fontSize: fontSize(15),
            fontWeight: '500',
          }}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function ScreenHeader({
  title,
  right,
  onBack,
}: {
  title: string;
  right?: React.ReactNode;
  onBack?: () => void;
}) {
  return (
    <View className='mb-2 flex-row items-center justify-between gap-3 pt-2'>
      <View className='min-w-0 flex-1 flex-row items-center gap-1'>
        <GoBack onPress={onBack} label='' />
        <AppText size='lg' weight='semibold' className='shrink'>
          {title}
        </AppText>
      </View>
      {right}
    </View>
  );
}

export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label?: string; error?: string }) {
  const { colorScheme } = useApp();
  const c = useThemeColors();
  const bg =
    colorScheme === 'dark' ? 'bg-surface-dark-sunken' : 'bg-surface-sunken';
  return (
    <View className='gap-1.5'>
      {label ? (
        <AppText size='sm' muted weight='medium'>
          {label}
        </AppText>
      ) : null}
      <TextInput
        placeholderTextColor={c.inkMuted}
        className={`rounded-2xl px-4 py-3.5 ${bg}`}
        style={{ color: c.ink, fontSize: fontSize(15), minHeight: vs(48) }}
        {...props}
      />
      {error ? (
        <AppText size='xs' style={{ color: c.expense }}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

export type SelectOption = { label: string; value: string };

export function Select({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select…',
  error,
}: {
  label?: string;
  value?: string | null;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
}) {
  const { colorScheme } = useApp();
  const c = useThemeColors();
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value]
  );
  const bg =
    colorScheme === 'dark' ? 'bg-surface-dark-sunken' : 'bg-surface-sunken';
  const sheetBg = colorScheme === 'dark' ? c.surfaceRaised : c.surfaceRaised;

  return (
    <View className='gap-1.5'>
      {label ? (
        <AppText size='sm' muted weight='medium'>
          {label}
        </AppText>
      ) : null}
      <Pressable
        onPress={() => setOpen(true)}
        className={`flex-row items-center justify-between rounded-2xl px-4 py-3.5 ${bg}`}
        style={{ minHeight: vs(48) }}
      >
        <Text
          style={{
            color: selected ? c.ink : c.inkMuted,
            fontSize: fontSize(15),
          }}
        >
          {selected?.label ?? placeholder}
        </Text>
        <Ionicons name='chevron-down' size={scale(18)} color={c.inkMuted} />
      </Pressable>
      {error ? (
        <AppText size='xs' style={{ color: c.expense }}>
          {error}
        </AppText>
      ) : null}

      <Modal visible={open} transparent animationType='fade'>
        <Pressable
          className='flex-1 justify-end bg-black/50'
          onPress={() => setOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className='max-h-[70%] rounded-t-3xl px-4 pb-8 pt-3'
            style={{ backgroundColor: sheetBg }}
          >
            <View className='mb-3 items-center'>
              <View
                className='h-1 w-10 rounded-full'
                style={{ backgroundColor: c.line }}
              />
            </View>
            {label ? (
              <AppText size='lg' weight='semibold' className='mb-2 px-1'>
                {label}
              </AppText>
            ) : null}
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => {
                const active = item.value === value;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                    className='flex-row items-center justify-between rounded-2xl px-3 py-3.5'
                    style={{
                      backgroundColor: active ? c.accentSoft : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        color: c.ink,
                        fontSize: fontSize(15),
                        fontWeight: active ? '600' : '400',
                      }}
                    >
                      {item.label}
                    </Text>
                    {active ? (
                      <Ionicons
                        name='checkmark'
                        size={scale(18)}
                        color={c.accent}
                      />
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  right,
  onPress,
  leading,
  destructive,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  leading?: React.ReactNode;
  destructive?: boolean;
}) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className='flex-row items-center gap-3 py-3.5'
      style={{ borderBottomWidth: 1, borderBottomColor: c.line }}
    >
      {leading}
      <View className='flex-1'>
        <Text
          style={{
            color: destructive ? c.expense : c.ink,
            fontSize: fontSize(15),
            fontWeight: '500',
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <AppText size='sm' muted>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

export function CategoryGlyph({
  iconKey,
  color,
  size = 36,
}: {
  iconKey: string;
  color: string;
  size?: number;
}) {
  const dim = scale(size);
  return (
    <View
      className='items-center justify-center rounded-full'
      style={{
        width: dim,
        height: dim,
        backgroundColor: `${color}22`,
      }}
    >
      <Ionicons
        name={resolveCategoryIcon(iconKey)}
        size={scale(size * 0.45)}
        color={color}
      />
    </View>
  );
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const c = useThemeColors();
  return (
    <Modal visible={visible} transparent animationType='fade'>
      <View className='flex-1 items-center justify-center bg-black/55 px-8'>
        <View
          className='w-full rounded-3xl p-5'
          style={{
            backgroundColor: c.surfaceRaised,
            gap: vs(12),
            borderWidth: 1,
            borderColor: c.line,
          }}
        >
          <Text
            style={{
              color: c.ink,
              fontSize: fontSize(17),
              fontWeight: '600',
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              color: c.inkMuted,
              fontSize: fontSize(15),
              lineHeight: fontSize(22),
            }}
          >
            {message}
          </Text>
          <View className='mt-2 flex-row gap-3'>
            <View className='flex-1'>
              <Button label='Cancel' variant='secondary' onPress={onCancel} />
            </View>
            <View className='flex-1'>
              <Button
                label={confirmLabel}
                variant='danger'
                onPress={onConfirm}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function PasswordDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  minLength = 8,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  minLength?: number;
  onConfirm: (password: string) => void;
  onCancel: () => void;
}) {
  const c = useThemeColors();
  const { colorScheme } = useApp();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const bg =
    colorScheme === 'dark' ? 'bg-surface-dark-sunken' : 'bg-surface-sunken';

  useEffect(() => {
    if (visible) {
      setPassword('');
      setError(undefined);
    }
  }, [visible]);

  const submit = () => {
    if (password.length < minLength) {
      setError(`Password must be at least ${minLength} characters`);
      return;
    }
    onConfirm(password);
  };

  return (
    <Modal visible={visible} transparent animationType='fade'>
      <View className='flex-1 items-center justify-center bg-black/55 px-8'>
        <View
          className='w-full rounded-3xl p-5'
          style={{
            backgroundColor: c.surfaceRaised,
            gap: vs(12),
            borderWidth: 1,
            borderColor: c.line,
          }}
        >
          <Text
            style={{
              color: c.ink,
              fontSize: fontSize(17),
              fontWeight: '600',
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              color: c.inkMuted,
              fontSize: fontSize(15),
              lineHeight: fontSize(22),
            }}
          >
            {message}
          </Text>
          <TextInput
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setError(undefined);
            }}
            secureTextEntry
            autoCapitalize='none'
            autoCorrect={false}
            placeholder='Password'
            placeholderTextColor={c.inkMuted}
            className={`rounded-2xl px-4 py-3.5 ${bg}`}
            style={{ color: c.ink, fontSize: fontSize(15), minHeight: vs(48) }}
            onSubmitEditing={submit}
          />
          {error ? (
            <Text style={{ color: c.expense, fontSize: fontSize(13) }}>
              {error}
            </Text>
          ) : null}
          <View className='mt-2 flex-row gap-3'>
            <View className='flex-1'>
              <Button label='Cancel' variant='secondary' onPress={onCancel} />
            </View>
            <View className='flex-1'>
              <Button label={confirmLabel} onPress={submit} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function EmptyState({
  title,
  subtitle,
  character,
}: {
  title: string;
  subtitle?: string;
  character?: number | string;
}) {
  return (
    <View className='items-center justify-center px-8 py-16'>
      {character != null ? (
        <Image
          source={character}
          style={{ width: scale(96), height: scale(96), marginBottom: vs(12) }}
          contentFit='contain'
        />
      ) : null}
      <AppText size='lg' weight='semibold'>
        {title}
      </AppText>
      {subtitle ? (
        <AppText muted className='mt-2 text-center'>
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}

export function IconButton(
  props: PressableProps & {
    name: keyof typeof Ionicons.glyphMap;
    color?: string;
  }
) {
  const c = useThemeColors();
  const { name, color, ...rest } = props;
  return (
    <Pressable
      hitSlop={8}
      className='h-10 w-10 items-center justify-center rounded-full'
      {...rest}
    >
      <Ionicons name={name} size={scale(22)} color={color ?? c.ink} />
    </Pressable>
  );
}

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <View className='mb-2 mt-6 flex-row items-center justify-between'>
      <AppText size='sm' muted weight='semibold'>
        {title.toUpperCase()}
      </AppText>
      {action}
    </View>
  );
}

export function CharacterAvatar({
  source,
  size = 44,
}: {
  source: number;
  size?: number;
}) {
  const dim = scale(size);
  return (
    <Image
      source={source}
      style={{
        width: dim,
        height: dim,
        borderRadius: dim / 2,
      }}
      contentFit='cover'
    />
  );
}

export function LoadingScreen() {
  return (
    <View
      className='flex-1 items-center justify-center'
      style={{ backgroundColor: '#0A0A0A' }}
    >
      <Image
        source={require('../../../assets/images/splash-icon.png')}
        style={{ width: scale(120), height: scale(120) }}
        contentFit='contain'
      />
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const { colorScheme } = useApp();
  const c = useThemeColors();
  const activeFg = colorScheme === 'dark' ? '#0A0A0A' : '#FFFFFF';
  return (
    <Pressable
      onPress={onPress}
      className='rounded-full px-3.5 py-2'
      style={{
        backgroundColor: active ? c.accent : c.surfaceSunken,
        borderWidth: active ? 0 : 1,
        borderColor: c.line,
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          color: active ? activeFg : c.ink,
          fontSize: fontSize(13),
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { colorScheme } = useApp();
  const c = useThemeColors();
  return (
    <View
      className={`rounded-3xl p-4 ${className}`}
      style={{
        backgroundColor:
          colorScheme === 'dark' ? c.surfaceRaised : c.surfaceRaised,
        borderRadius: scale(24),
        borderWidth: colorScheme === 'dark' ? 1 : 0,
        borderColor: c.line,
      }}
    >
      {children}
    </View>
  );
}

export function ProgressBar({
  progress,
  color,
  height = 8,
}: {
  progress: number;
  color?: string;
  height?: number;
}) {
  const c = useThemeColors();
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <View
      style={{
        height: vs(height),
        borderRadius: vs(height),
        backgroundColor: c.surfaceSunken,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${pct * 100}%`,
          height: '100%',
          borderRadius: vs(height),
          backgroundColor: color ?? c.accent,
        }}
      />
    </View>
  );
}

/** Compact circular completion ring for goals on home / lists. */
export function GoalRing({
  progress,
  size = 44,
  label,
  color,
}: {
  progress: number;
  size?: number;
  label?: string;
  color?: string;
}) {
  const c = useThemeColors();
  const dim = scale(size);
  const stroke = Math.max(3, dim * 0.1);
  const radius = (dim - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, progress));
  const offset = circumference * (1 - pct);
  const strokeColor = color ?? c.accent;

  return (
    <View
      style={{
        width: dim,
        height: dim,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg width={dim} height={dim}>
        <Circle
          cx={dim / 2}
          cy={dim / 2}
          r={radius}
          stroke={c.surfaceSunken}
          strokeWidth={stroke}
          fill='none'
        />
        <Circle
          cx={dim / 2}
          cy={dim / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={stroke}
          fill='none'
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap='round'
          transform={`rotate(-90 ${dim / 2} ${dim / 2})`}
        />
      </Svg>
      {label ? (
        <View style={{ position: 'absolute' }}>
          <AppText size='xs' weight='semibold'>
            {label}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
