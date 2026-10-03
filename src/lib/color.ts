/**
 * Ensure a color meets minimum contrast ratio against a background by adjusting lightness only.
 * Used at render time for user-selected category colors.
 */
export function ensureContrast(
  hex: string,
  bgHex: string,
  minRatio = 3,
): string {
  const fg = hexToRgb(hex);
  const bg = hexToRgb(bgHex);
  
  if (!fg || !bg) return hex;
  
  const currentRatio = contrastRatio(fg, bg);
  if (currentRatio >= minRatio) return hex;
  
  const hsl = rgbToHsl(fg);
  let low = 0;
  let high = 1;
  let bestL = hsl.l;
  
  for (let i = 0; i < 20; i++) {
    const testL = (low + high) / 2;
    const testRgb = hslToRgb({ ...hsl, l: testL });
    const ratio = contrastRatio(testRgb, bg);
    
    if (Math.abs(ratio - minRatio) < 0.01) {
      bestL = testL;
      break;
    }
    
    if (ratio < minRatio) {
      if (hsl.l < 0.5) {
        high = testL;
      } else {
        low = testL;
      }
    } else {
      if (hsl.l < 0.5) {
        low = testL;
      } else {
        high = testL;
      }
      bestL = testL;
    }
  }
  
  const adjusted = hslToRgb({ ...hsl, l: bestL });
  return rgbToHex(adjusted);
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

function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  const r = Math.round(rgb.r * 255);
  const g = Math.round(rgb.g * 255);
  const b = Math.round(rgb.b * 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function luminance(rgb: { r: number; g: number; b: number }): number {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((v) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(
  fg: { r: number; g: number; b: number },
  bg: { r: number; g: number; b: number },
): number {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function rgbToHsl(rgb: {
  r: number;
  g: number;
  b: number;
}): { h: number; s: number; l: number } {
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

function hslToRgb(hsl: {
  h: number;
  s: number;
  l: number;
}): { r: number; g: number; b: number } {
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
