/** Semantic palette — dark (default) and light derived from the same token names. */

export const palette = {
  light: {
    ink: '#0F131C',
    inkSecondary: '#3B4650',
    inkMuted: '#5B6670',
    inkInverse: '#FFFFFF',
    surface: '#F5F7FA',
    surfaceRaised: '#FFFFFF',
    surfaceSunken: '#E9EDF2',
    surfaceOverlay: '#FFFFFF',
    surfaceHigh: '#E3E8EE',
    accent: '#0369A1',
    accentSoft: '#E6F0F6',
    income: '#047857',
    incomeSoft: '#D9F4E8',
    expense: '#BE123C',
    expenseSoft: '#F8E1E7',
    warning: '#92400E',
    warningSoft: '#F4EBD9',
    line: '#D9DFE6',
    lineStrong: '#7A8590',
    chart: '#0369A1',
    chartFill: 'rgba(3, 105, 161, 0.12)',
  },
  dark: {
    ink: '#DFE2EE',
    inkSecondary: '#BDC8D1',
    inkMuted: '#8F9AA3',
    inkInverse: '#04141F',
    surface: '#0F131C',
    surfaceRaised: '#181C24',
    surfaceSunken: '#0A0E16',
    surfaceOverlay: '#1F242D',
    surfaceHigh: '#262A33',
    accent: '#38BDF8',
    accentSoft: '#1D3646',
    income: '#00F59B',
    incomeSoft: '#153A35',
    expense: '#FB7185',
    expenseSoft: '#3C2A34',
    warning: '#F59E0B',
    warningSoft: '#3B3120',
    line: '#2B3038',
    lineStrong: '#66727C',
    chart: '#38BDF8',
    chartFill: 'rgba(56, 189, 248, 0.15)',
  },
} as const;

export type ColorSchemeName = keyof typeof palette;

export function colors(scheme: ColorSchemeName) {
  return palette[scheme];
}
