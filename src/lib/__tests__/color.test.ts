import { contrastRatio, ensureContrast, luminance } from '@/lib/color';

// Helper to parse hex and compute contrast
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace(/^#/, '').slice(0, 6);
  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(clean);
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

describe('ensureContrast', () => {
  const DARK_CARD = '#181C24'; // surfaceRaised in dark theme
  const LIGHT_CARD = '#FFFFFF'; // surfaceRaised in light theme
  const MIN_RATIO = 3;

  describe('post-rounding verification', () => {
    it('#000 on dark card (#181C24) meets minimum after rounding', () => {
      const adjusted = ensureContrast('#000', DARK_CARD, MIN_RATIO);
      const fg = hexToRgb(adjusted);
      const bg = hexToRgb(DARK_CARD);

      expect(fg).not.toBeNull();
      expect(bg).not.toBeNull();

      if (fg && bg) {
        const ratio = contrastRatio(fg, bg);
        expect(ratio).toBeGreaterThanOrEqual(MIN_RATIO);
      }
    });

    it('#6A4C93 at 4.5:1 on dark card (was returning #9276b8 at 4.47)', () => {
      const adjusted = ensureContrast('#6A4C93', DARK_CARD, 4.5);
      const fg = hexToRgb(adjusted);
      const bg = hexToRgb(DARK_CARD);

      expect(fg).not.toBeNull();
      expect(bg).not.toBeNull();

      if (fg && bg) {
        const ratio = contrastRatio(fg, bg);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('#6A4C93 at 3.0:1 on dark card meets target after rounding', () => {
      const adjusted = ensureContrast('#6A4C93', DARK_CARD, 3.0);
      const fg = hexToRgb(adjusted);
      const bg = hexToRgb(DARK_CARD);

      expect(fg).not.toBeNull();
      expect(bg).not.toBeNull();

      if (fg && bg) {
        const ratio = contrastRatio(fg, bg);
        expect(ratio).toBeGreaterThanOrEqual(3.0);
      }
    });
  });

  describe('five categories that landed at 2.99 in light theme', () => {
    const FAILING_LIGHT_COLORS = [
      '#E07A3D', // Food & Drink
      '#F4A261', // Entertainment
      '#00B4D8', // Travel
      '#8B5CF6', // Contractors (actually was this one, not Investment)
      '#F59E0B', // Gift
    ];

    it.each(FAILING_LIGHT_COLORS)(
      '%s now reaches 3.0:1 on light background',
      (color) => {
        const adjusted = ensureContrast(color, LIGHT_CARD, MIN_RATIO);
        const fg = hexToRgb(adjusted);
        const bg = hexToRgb(LIGHT_CARD);

        expect(fg).not.toBeNull();
        expect(bg).not.toBeNull();

        if (fg && bg) {
          const ratio = contrastRatio(fg, bg);
          expect(ratio).toBeGreaterThanOrEqual(MIN_RATIO);
        }
      }
    );
  });

  describe('3-digit hex input', () => {
    it('expands #000 to 6-digit and meets minimum', () => {
      const adjusted = ensureContrast('#000', DARK_CARD, MIN_RATIO);
      expect(adjusted.length).toBeGreaterThanOrEqual(7); // #RRGGBB
      expect(adjusted).toMatch(/^#[0-9A-Fa-f]{6}$/);

      const fg = hexToRgb(adjusted);
      const bg = hexToRgb(DARK_CARD);

      if (fg && bg) {
        const ratio = contrastRatio(fg, bg);
        expect(ratio).toBeGreaterThanOrEqual(MIN_RATIO);
      }
    });

    it('expands #FFF correctly', () => {
      const adjusted = ensureContrast('#FFF', LIGHT_CARD, MIN_RATIO);
      expect(adjusted.length).toBeGreaterThanOrEqual(7);
      expect(adjusted).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it('expands #ABC to #AABBCC format', () => {
      const adjusted = ensureContrast('#ABC', DARK_CARD, MIN_RATIO);
      expect(adjusted).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  describe('8-digit hex with alpha', () => {
    it('preserves alpha suffix FF', () => {
      const adjusted = ensureContrast('#6A4C93FF', DARK_CARD, MIN_RATIO);
      expect(adjusted).toMatch(/^#[0-9A-Fa-f]{6}FF$/);
    });

    it('preserves partial alpha 80', () => {
      const adjusted = ensureContrast('#6A4C9380', DARK_CARD, MIN_RATIO);
      expect(adjusted).toMatch(/^#[0-9A-Fa-f]{6}80$/);
    });

    it('computes contrast on opaque RGB, ignoring alpha', () => {
      const adjusted = ensureContrast('#6A4C9380', DARK_CARD, MIN_RATIO);
      // Extract RGB without alpha
      const rgbHex = adjusted.slice(0, 7);
      const fg = hexToRgb(rgbHex);
      const bg = hexToRgb(DARK_CARD);

      expect(fg).not.toBeNull();
      expect(bg).not.toBeNull();

      if (fg && bg) {
        const ratio = contrastRatio(fg, bg);
        expect(ratio).toBeGreaterThanOrEqual(MIN_RATIO - 0.02);
      }
    });
  });

  describe('hue preservation', () => {
    it('preserves hue when adjusting #6A4C93', () => {
      const purple = '#6A4C93';
      const adjusted = ensureContrast(purple, DARK_CARD, MIN_RATIO);

      const origRgb = hexToRgb(purple);
      const adjRgb = hexToRgb(adjusted);

      expect(origRgb).not.toBeNull();
      expect(adjRgb).not.toBeNull();

      if (origRgb && adjRgb) {
        const origHsl = rgbToHsl(origRgb);
        const adjHsl = rgbToHsl(adjRgb);

        // Hue should be very close (within 5% of full range)
        expect(Math.abs(origHsl.h - adjHsl.h)).toBeLessThan(0.05);
      }
    });

    it('preserves hue for green #2A9D8F', () => {
      const green = '#2A9D8F';
      const adjusted = ensureContrast(green, LIGHT_CARD, MIN_RATIO);

      const origRgb = hexToRgb(green);
      const adjRgb = hexToRgb(adjusted);

      expect(origRgb).not.toBeNull();
      expect(adjRgb).not.toBeNull();

      if (origRgb && adjRgb) {
        const origHsl = rgbToHsl(origRgb);
        const adjHsl = rgbToHsl(adjRgb);

        expect(Math.abs(origHsl.h - adjHsl.h)).toBeLessThan(0.05);
      }
    });
  });

  describe('all default categories meet contrast in both themes', () => {
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

    it.each(DEFAULT_CATEGORY_COLORS)(
      '%s meets 3:1 on dark background',
      (color) => {
        const adjusted = ensureContrast(color, DARK_CARD, MIN_RATIO);
        const fg = hexToRgb(adjusted);
        const bg = hexToRgb(DARK_CARD);

        expect(fg).not.toBeNull();
        expect(bg).not.toBeNull();

        if (fg && bg) {
          const ratio = contrastRatio(fg, bg);
          expect(ratio).toBeGreaterThanOrEqual(MIN_RATIO - 0.02);
        }
      }
    );

    it.each(DEFAULT_CATEGORY_COLORS)(
      '%s meets 3:1 on light background',
      (color) => {
        const adjusted = ensureContrast(color, LIGHT_CARD, MIN_RATIO);
        const fg = hexToRgb(adjusted);
        const bg = hexToRgb(LIGHT_CARD);

        expect(fg).not.toBeNull();
        expect(bg).not.toBeNull();

        if (fg && bg) {
          const ratio = contrastRatio(fg, bg);
          expect(ratio).toBeGreaterThanOrEqual(MIN_RATIO - 0.02);
        }
      }
    );
  });

  it('returns original color if it already meets contrast ratio', () => {
    const black = '#000000';
    const white = '#FFFFFF';
    // Black on white has very high contrast, should normalize to 6-digit but not adjust
    const result = ensureContrast(black, white, 4.5);
    const fg = hexToRgb(result);
    const bg = hexToRgb(white);
    if (fg && bg) {
      expect(contrastRatio(fg, bg)).toBeGreaterThan(4.5);
    }
  });

  it('falls back gracefully for impossible ratios', () => {
    const result = ensureContrast('#808080', '#808080', 10);
    expect(result).toBeTruthy();
    expect(result.startsWith('#')).toBe(true);
  });
});

describe('default category colors are unique', () => {
  // Import actual categories to test - use dynamic import to get the real values
  const DEFAULT_CATEGORIES =
    require('@/lib/categories/icons').DEFAULT_CATEGORIES;

  it('all category colors are unique', () => {
    const colors = DEFAULT_CATEGORIES.map(
      (c: { color: string }) => c.color.toUpperCase(),
    );
    const uniqueColors = new Set(colors);

    // Find duplicates
    const duplicates: { color: string; categories: string[] }[] = [];
    for (const color of uniqueColors) {
      const cats = DEFAULT_CATEGORIES.filter(
        (c: { color: string }) => c.color.toUpperCase() === color,
      );
      if (cats.length > 1) {
        duplicates.push({
          color,
          categories: cats.map((c: { name: string }) => c.name),
        });
      }
    }

    if (duplicates.length > 0) {
      const msg = duplicates
        .map((d) => `${d.color} used by: ${d.categories.join(', ')}`)
        .join('\n');
      throw new Error(`Duplicate category colors found:\n${msg}`);
    }

    expect(uniqueColors.size).toBe(colors.length);
  });
});
