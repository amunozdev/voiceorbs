import { hexToRgb } from './orb-state';

export type Rgb = [number, number, number];

const toLinear = (c: number): number => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const toSrgb = (v: number): number => {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.min(255, Math.max(0, c * 255));
};

export const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [
  toSrgb(toLinear(a[0]) + (toLinear(b[0]) - toLinear(a[0])) * t),
  toSrgb(toLinear(a[1]) + (toLinear(b[1]) - toLinear(a[1])) * t),
  toSrgb(toLinear(a[2]) + (toLinear(b[2]) - toLinear(a[2])) * t),
];

const hexChannel = (c: number): string => Math.round(c).toString(16).padStart(2, '0');

export const rgbToHex = ([r, g, b]: Rgb): string => `#${hexChannel(r)}${hexChannel(g)}${hexChannel(b)}`;

export const mixHex = (a: string, b: string, t: number): string =>
  rgbToHex(mixRgb(hexToRgb(a), hexToRgb(b), t));

export const shadeHex = (hex: string, t: number): string => mixHex(hex, '#000000', t);

export const tintHex = (hex: string, t: number): string => mixHex(hex, '#ffffff', t);

export const rgba = ([r, g, b]: Rgb, alpha: number): string =>
  `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${Math.min(1, Math.max(0, alpha)).toFixed(3)})`;
