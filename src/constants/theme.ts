/**
 * Legacy theme tokens kept for gradual migration.
 * Prefer palette.ts + NativeWind semantic classes.
 */

import { Platform } from 'react-native';

import { palette } from './palette';

export const Colors = {
  light: {
    text: palette.light.ink,
    background: palette.light.surface,
    backgroundElement: palette.light.surfaceRaised,
    backgroundSelected: palette.light.surfaceSunken,
    textSecondary: palette.light.inkMuted,
  },
  dark: {
    text: palette.dark.ink,
    background: palette.dark.surface,
    backgroundElement: palette.dark.surfaceRaised,
    backgroundSelected: palette.dark.surfaceSunken,
    textSecondary: palette.dark.inkMuted,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
