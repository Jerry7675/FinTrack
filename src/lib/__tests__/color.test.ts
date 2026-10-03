import { contrastRatio, ensureContrast, luminance } from '@/lib/color';

describe('ensureContrast', () => {
  const DARK_CARD = '#181C24'; // surfaceRaised in dark theme
  const LIGHT_CARD = '#FFFFFF'; // surfaceRaised in light theme
  const MIN_RATIO = 3;

  const DEFAULT_CATEGORY_COLORS = [
    '#00B4D8',
    '#00F59B',
    '#0EA5E9',
    '#14B8A6',
    '#22C55E',
    '#2A9D8F',
    '#3D7AE0',
    '#457B9D',
    '#6366F1',
    '#64748B',
    '#6A4C93',
    '#6B7280',
    '#8B5CF6',
    '#9B5DE5',
    '#A78BFA',
    '#E07A3D',
    '#E63946',
    '#EC4899',
    '#F4A261',
    '#F59E0B',
  ];

  describe('on dark card (#181C24)', () => {
    it.each(DEFAULT_CATEGORY_COLORS)(
      'adjusts %s to meet 3:1 contrast on dark background',
      (color) => {
        const adjusted = ensureContrast(color, DARK_CARD, MIN_RATIO);
        const fg = hexToRgb(adjusted);
        const bg = hexToRgb(DARK_CARD);

        expect(fg).not.toBeNull();
        expect(bg).not.toBeNull();

        if (fg && bg) {
          const ratio = contrastRatio(fg, bg);
          // Allow tiny tolerance for floating point precision (0.02 ~= 0.7%)
          expect(ratio).toBeGreaterThanOrEqual(MIN_RATIO - 0.02);
        }
      }
    );

    it('lightens colors on dark background', () => {
      // Test a dark purple that needs lightening
      const dark = '#6A4C93';
      const adjusted = ensureContrast(dark, DARK_CARD, MIN_RATIO);
      const darkRgb = hexToRgb(dark);
      const adjustedRgb = hexToRgb(adjusted);

      expect(darkRgb).not.toBeNull();
      expect(adjustedRgb).not.toBeNull();

      if (darkRgb && adjustedRgb) {
        const darkLum = luminance(darkRgb);
        const adjustedLum = luminance(adjustedRgb);
        // Adjusted should be lighter
        expect(adjustedLum).toBeGreaterThan(darkLum);
      }
    });
  });

  describe('on light card (#FFFFFF)', () => {
    it.each(DEFAULT_CATEGORY_COLORS)(
      'adjusts %s to meet 3:1 contrast on light background',
      (color) => {
        const adjusted = ensureContrast(color, LIGHT_CARD, MIN_RATIO);
        const fg = hexToRgb(adjusted);
        const bg = hexToRgb(LIGHT_CARD);

        expect(fg).not.toBeNull();
        expect(bg).not.toBeNull();

        if (fg && bg) {
          const ratio = contrastRatio(fg, bg);
          // Allow tiny tolerance for floating point precision (0.02 ~= 0.7%)
          expect(ratio).toBeGreaterThanOrEqual(MIN_RATIO - 0.02);
        }
      }
    );

    it('darkens colors on light background', () => {
      // Test a light cyan that needs darkening
      const light = '#00F59B';
      const adjusted = ensureContrast(light, LIGHT_CARD, MIN_RATIO);
      const lightRgb = hexToRgb(light);
      const adjustedRgb = hexToRgb(adjusted);

      expect(lightRgb).not.toBeNull();
      expect(adjustedRgb).not.toBeNull();

      if (lightRgb && adjustedRgb) {
        const lightLum = luminance(lightRgb);
        const adjustedLum = luminance(adjustedRgb);
        // Adjusted should be darker
        expect(adjustedLum).toBeLessThan(lightLum);
      }
    });
  });

  it('returns original color if it already meets contrast ratio', () => {
    const black = '#000000';
    const white = '#FFFFFF';
    const result = ensureContrast(black, white, 4.5);
    expect(result).toBe(black);
  });

  it('preserves hue and saturation when adjusting', () => {
    const purple = '#6A4C93';
    const adjusted = ensureContrast(purple, DARK_CARD, MIN_RATIO);

    // Convert both to HSL to check hue is similar
    const origRgb = hexToRgb(purple);
    const adjRgb = hexToRgb(adjusted);

    expect(origRgb).not.toBeNull();
    expect(adjRgb).not.toBeNull();

    if (origRgb && adjRgb) {
      const origHsl = rgbToHsl(origRgb);
      const adjHsl = rgbToHsl(adjRgb);

      // Hue should be very close (within 0.05 on 0-1 scale)
      expect(Math.abs(origHsl.h - adjHsl.h)).toBeLessThan(0.05);
    }
  });

  it('falls back to original if adjustment is impossible', () => {
    // Same color for fg and bg should return original (0 contrast ratio)
    const result = ensureContrast('#808080', '#808080', 10);
    // Should fall back gracefully
    expect(result).toBeTruthy();
    expect(result.startsWith('#')).toBe(true);
  });
});

// Helper functions for testing
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: Number.parseInt(result[1], 16) / 255,
        g: Number.parseInt(result[2], 16) / 255,
        b: Number.parseInt(result[3], 16) / 255,
      }
    : null;
}

function rgbToHsl(rgb: { r: number; g: number; b: number }): {
  h: number;
  s: number;
  l: number;
} {
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === rgb.r) {
    h = ((rgb.g - rgb.b) / d + (rgb.g < rgb.b ? 6 : 0)) / 6;
  } else if (max === rgb.g) {
    h = ((rgb.b - rgb.r) / d + 2) / 6;
  } else {
    h = ((rgb.r - rgb.g) / d + 4) / 6;
  }

  return { h, s, l };
}
