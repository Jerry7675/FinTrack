/** Semantic palette — light stays green/white; dark matches Vercel/Supabase near-black. */

export const palette = {
  light: {
    ink: '#0B1F17',
    inkMuted: '#5C6B64',
    inkInverse: '#FFFFFF',
    surface: '#F4F7F5',
    surfaceRaised: '#FFFFFF',
    surfaceSunken: '#E8EEEA',
    accent: '#1A7A4C',
    accentSoft: '#D8F0E4',
    accentBright: '#3DDB8A',
    income: '#1A7A4C',
    expense: '#C43C2C',
    line: '#D5DED8',
    chart: '#1A7A4C',
    chartFill: 'rgba(26, 122, 76, 0.18)',
  },
  dark: {
    ink: '#FAFAFA',
    inkMuted: '#A1A1AA',
    inkInverse: '#0A0A0A',
    surface: '#0A0A0A',
    surfaceRaised: '#111111',
    surfaceSunken: '#171717',
    accent: '#3DDB8A',
    accentSoft: '#0F2A1C',
    accentBright: '#3DDB8A',
    income: '#3DDB8A',
    expense: '#F87171',
    line: '#27272A',
    chart: '#3DDB8A',
    chartFill: 'rgba(61, 219, 138, 0.18)',
  },
} as const;

export type ColorSchemeName = keyof typeof palette;

export function colors(scheme: ColorSchemeName) {
  return palette[scheme];
}
