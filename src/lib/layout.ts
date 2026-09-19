import { Dimensions, PixelRatio } from 'react-native';

const { width, height } = Dimensions.get('window');

const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

const widthScale = width / BASE_WIDTH;
const heightScale = height / BASE_HEIGHT;

/** Horizontal scale from a 375pt design width. */
export function scale(size: number): number {
  return Math.round(PixelRatio.roundToNearestPixel(size * widthScale));
}

/** Vertical scale from an 812pt design height. */
export function vs(size: number): number {
  return Math.round(PixelRatio.roundToNearestPixel(size * heightScale));
}

/** Moderate scale — less aggressive than full width scale. */
export function ms(size: number, factor = 0.5): number {
  return Math.round(
    PixelRatio.roundToNearestPixel(size + (scale(size) - size) * factor)
  );
}

export function fontSize(size: number): number {
  return ms(size, 0.35);
}

export const layout = {
  screenWidth: width,
  screenHeight: height,
  gutter: scale(20),
  radius: scale(14),
  hitSlop: scale(8),
} as const;
