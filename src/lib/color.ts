/**
 * Ensure a color meets minimum contrast ratio against a background by adjusting lightness only.
 * Used at render time for user-selected category colors.
 *
 * Strategy: Lighten when background is dark, darken when background is light.
 * Returns the closest passing lightness value, preserving hue and saturation.
 * Falls back to black/white only if no adjustment passes.
 * Re-checks contrast after rounding to hex to ensure the final color meets the minimum.
 */
export function ensureContrast(
  hex: string,
  bgHex: string,
  minRatio = 3
): string {
  // Parse input colors, expanding 3-digit and handling 8-digit with alpha
  const { rgb: fg, alpha: fgAlpha } = parseHex(hex);
  const { rgb: bg } = parseHex(bgHex);

  if (!fg || !bg) return hex;

  const currentRatio = contrastRatio(fg, bg);
  if (currentRatio >= minRatio) {
    // Return normalized 6-digit hex even if input already passes
    return rgbToHex(fg, fgAlpha);
  }

  const hsl = rgbToHsl(fg);
  const bgLuminance = luminance(bg);

  // Determine direction based on background luminance
  const shouldLighten = bgLuminance <= 0.5;

  let bestL: number | null = null;

  // Binary search for the closest passing lightness
  let low = shouldLighten ? hsl.l : 0;
  let high = shouldLighten ? 1 : hsl.l;

  for (let i = 0; i < 50; i++) {
    const testL = (low + high) / 2;
    const testRgb = hslToRgb({ ...hsl, l: testL });

    // Round to hex and back to get the actual color after rounding
    const hexTest = rgbToHex(testRgb);
    const roundedRgb = hexToRgb(hexTest);

    if (!roundedRgb) break;

    const ratio = contrastRatio(roundedRgb, bg);

    if (ratio >= minRatio) {
      // This lightness passes
      if (bestL === null || Math.abs(testL - hsl.l) < Math.abs(bestL - hsl.l)) {
        bestL = testL;
      }
      // Move closer to original
      if (shouldLighten) {
        high = testL;
      } else {
        low = testL;
      }
    } else {
      // This lightness fails, move away from original
      if (shouldLighten) {
        low = testL;
      } else {
        high = testL;
      }
    }
  }

  // If we found a passing lightness, refine it to ensure the rounded hex passes
  if (bestL !== null) {
    const step = 1 / 255; // One step in RGB space
    let currentL = bestL;
    let attempts = 0;

    // Step lightness until the rounded hex meets the minimum
    while (attempts < 100) {
      const testRgb = hslToRgb({ ...hsl, l: currentL });
      const hexTest = rgbToHex(testRgb);
      const roundedRgb = hexToRgb(hexTest);

      if (!roundedRgb) break;

      const ratio = contrastRatio(roundedRgb, bg);
      if (ratio >= minRatio) {
        return rgbToHex(testRgb, fgAlpha);
      }

      // Step toward passing (lighter for dark bg, darker for light bg)
      currentL = shouldLighten
        ? Math.min(1, currentL + step)
        : Math.max(0, currentL - step);
      attempts++;
    }

    // Fallback: return the best we found
    const adjusted = hslToRgb({ ...hsl, l: bestL });
    return rgbToHex(adjusted, fgAlpha);
  }

  // If no adjustment passes, fall back to black or white
  const whiteRatio = contrastRatio({ r: 1, g: 1, b: 1 }, bg);
  const blackRatio = contrastRatio({ r: 0, g: 0, b: 0 }, bg);

  if (whiteRatio >= minRatio && blackRatio >= minRatio) {
    // Both pass, choose closer to original lightness
    return hsl.l > 0.5
      ? rgbToHex({ r: 1, g: 1, b: 1 }, fgAlpha)
      : rgbToHex({ r: 0, g: 0, b: 0 }, fgAlpha);
  } else if (whiteRatio >= minRatio) {
    return rgbToHex({ r: 1, g: 1, b: 1 }, fgAlpha);
  } else if (blackRatio >= minRatio) {
    return rgbToHex({ r: 0, g: 0, b: 0 }, fgAlpha);
  }

  // Neither passes (shouldn't happen with valid backgrounds), return original
  return hex;
}

interface ParsedColor {
  rgb: { r: number; g: number; b: number } | null;
  alpha?: string;
}

function parseHex(hex: string): ParsedColor {
  const clean = hex.replace(/^#/, '');

  // 3-digit hex: #RGB -> #RRGGBB
  if (clean.length === 3) {
    const r = Number.parseInt(clean[0] + clean[0], 16) / 255;
    const g = Number.parseInt(clean[1] + clean[1], 16) / 255;
    const b = Number.parseInt(clean[2] + clean[2], 16) / 255;
    return { rgb: { r, g, b } };
  }

  // 6-digit hex: #RRGGBB
  if (clean.length === 6) {
    const rgb = hexToRgb(`#${clean}`);
    return { rgb };
  }

  // 8-digit hex: #RRGGBBAA -> preserve alpha
  if (clean.length === 8) {
    const r = Number.parseInt(clean.slice(0, 2), 16) / 255;
    const g = Number.parseInt(clean.slice(2, 4), 16) / 255;
    const b = Number.parseInt(clean.slice(4, 6), 16) / 255;
    const alpha = clean.slice(6, 8);
    return { rgb: { r, g, b }, alpha };
  }

  return { rgb: null };
}

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

function rgbToHex(
  rgb: { r: number; g: number; b: number },
  alpha?: string
): string {
  const r = Math.round(Math.max(0, Math.min(255, rgb.r * 255)));
  const g = Math.round(Math.max(0, Math.min(255, rgb.g * 255)));
  const b = Math.round(Math.max(0, Math.min(255, rgb.b * 255)));
  const hex = `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
  return alpha ? `${hex}${alpha}` : hex;
}

export function luminance(rgb: { r: number; g: number; b: number }): number {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((v) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(
  fg: { r: number; g: number; b: number },
  bg: { r: number; g: number; b: number }
): number {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
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

function hslToRgb(hsl: { h: number; s: number; l: number }): {
  r: number;
  g: number;
  b: number;
} {
  if (hsl.s === 0) {
    return { r: hsl.l, g: hsl.l, b: hsl.l };
  }

  const q = hsl.l < 0.5 ? hsl.l * (1 + hsl.s) : hsl.l + hsl.s - hsl.l * hsl.s;
  const p = 2 * hsl.l - q;

  const hue2rgb = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  return {
    r: hue2rgb(hsl.h + 1 / 3),
    g: hue2rgb(hsl.h),
    b: hue2rgb(hsl.h - 1 / 3),
  };
}

const HEX_COLOR_BODY = /^[0-9A-Fa-f]+$/;

const VALID_HEX_LENGTHS = new Set([3, 6, 8]);

/** True for #RGB, #RRGGBB, #RRGGBBAA (optional `#` prefix). */
export function isHexColor(value: string | undefined | null): value is string {
  if (value == null || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  const clean = trimmed.replace(/^#/, '');
  if (!VALID_HEX_LENGTHS.has(clean.length)) return false;
  return HEX_COLOR_BODY.test(clean);
}

/** Returns a usable hex for category UI, or `fallback` when input is not valid hex. */
export function safeCategoryHex(
  color: string | undefined | null,
  fallback = '#6B7280'
): string {
  if (!isHexColor(color)) return fallback;
  const trimmed = color.trim();
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

function assertValidHexColorBody(clean: string, original: string): void {
  if (!HEX_COLOR_BODY.test(clean)) {
    throw new Error(
      `Invalid hex color "${original}": hex digits must be 0-9 or A-F`
    );
  }
}

/**
 * Add or replace alpha suffix on a hex color.
 * Expands 3-digit hex, strips existing alpha if present, then appends new alpha.
 * @param hex - Color in #RGB, #RRGGBB, or #RRGGBBAA format
 * @param alphaHex - 2-digit hex alpha (e.g. "22", "FF")
 * @returns 8-digit hex color: #RRGGBBAA
 */
export function withAlpha(hex: string, alphaHex: string): string {
  const clean = hex.replace(/^#/, '');

  let base: string;
  if (clean.length === 3) {
    assertValidHexColorBody(clean, hex);
    base = clean
      .split('')
      .map((c) => c + c)
      .join('');
  } else if (clean.length === 6) {
    assertValidHexColorBody(clean, hex);
    base = clean;
  } else if (clean.length === 8) {
    const rgbPart = clean.slice(0, 6);
    const alphaPart = clean.slice(6, 8);
    assertValidHexColorBody(rgbPart, hex);
    assertValidHexColorBody(alphaPart, hex);
    base = rgbPart;
  } else {
    throw new Error(
      `Invalid hex color "${hex}": expected 3, 6, or 8 hex digits after #`
    );
  }

  return `#${base.toUpperCase()}${alphaHex}`;
}
