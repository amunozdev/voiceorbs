import type { CSSProperties, Ref, RefObject } from 'react';

export type OrbState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error'
  | 'disabled';

export const ORB_STATES = [
  'idle',
  'connecting',
  'listening',
  'thinking',
  'speaking',
] as const satisfies readonly OrbState[];

export interface OrbProps {
  state?: OrbState;
  size?: number;
  speed?: number;
  colorFrom?: string;
  colorTo?: string;
  levelRef?: RefObject<number>;
  label?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

export const ERROR_COLOR_FROM = '#fb7185';
export const ERROR_COLOR_TO = '#f43f5e';

export const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export type OrbMotion = 'ripple' | 'pulse' | 'flow' | 'none';

export const stateMotion = (state: OrbState): OrbMotion => {
  switch (state) {
    case 'listening':
      return 'ripple';
    case 'thinking':
      return 'pulse';
    case 'speaking':
      return 'flow';
    default:
      return 'none';
  }
};

const wave = (x: number): number => 0.5 - 0.5 * Math.cos(x);

export const stateEnergy = (state: OrbState, t: number): number => {
  switch (state) {
    case 'listening':
      return 0.4 + 0.32 * wave(t * 17) + 0.18 * wave(t * 8.2 + 3);
    case 'speaking':
      return 0.3 + 0.24 * wave(t * 12.4) + 0.16 * wave(t * 6 + 1.2);
    case 'thinking':
      return 0.24 + 0.2 * wave(t * 4.8);
    case 'connecting':
      return 0.12 + 0.1 * wave(t * 3.2);
    case 'error':
      return 0.2;
    default:
      return 0;
  }
};

export const approach = (current: number, target: number, rate: number, dt: number): number =>
  current + (target - current) * (1 - Math.exp(-rate * dt));

export type StateWeights = Record<OrbState, number>;

export interface StateMix {
  weights: StateWeights;
  update: (state: OrbState, dt: number, rate?: number) => StateWeights;
}

export const ENTER_RATE = 14;
export const SETTLE_RATE = 5;
export const ERROR_RATE = 10;

export const stateRate = (state: OrbState): number => {
  if (state === 'idle' || state === 'disabled') return SETTLE_RATE;
  if (state === 'error') return ERROR_RATE;
  return ENTER_RATE;
};

export const createStateMix = (initial: OrbState = 'idle'): StateMix => {
  const weights: StateWeights = {
    idle: 0,
    connecting: 0,
    listening: 0,
    thinking: 0,
    speaking: 0,
    error: 0,
    disabled: 0,
  };
  weights[initial] = 1;
  const keys = Object.keys(weights) as OrbState[];
  const update = (state: OrbState, dt: number, rate = stateRate(state)): StateWeights => {
    let total = 0;
    for (const key of keys) {
      const target = key === state ? 1 : 0;
      const next = approach(weights[key], target, rate, dt);
      weights[key] = target === 0 && next < 0.001 ? 0 : next;
      total += weights[key];
    }
    if (total > 0) {
      for (const key of keys) weights[key] /= total;
    }
    return weights;
  };
  return { weights, update };
};

export const blendStates = <T extends { [K in keyof T]: number }>(
  weights: StateWeights,
  table: Record<OrbState, T>,
): T => {
  const out = {} as Record<string, number>;
  for (const key of Object.keys(weights) as OrbState[]) {
    const w = weights[key];
    if (w === 0) continue;
    const row = table[key];
    for (const param of Object.keys(row) as (keyof T & string)[]) out[param] = (out[param] ?? 0) + row[param] * w;
  }
  return out as T;
};

export const blendEnergy = (weights: StateWeights, t: number): number => {
  let energy = 0;
  for (const key of Object.keys(weights) as OrbState[]) {
    if (weights[key] > 0) energy += weights[key] * stateEnergy(key, t);
  }
  return energy;
};

export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export const orbVars = ({
  size,
  speed,
  colorFrom,
  colorTo,
}: Pick<OrbProps, 'size' | 'speed' | 'colorFrom' | 'colorTo'>): CSSProperties => {
  const vars: Record<string, string> = {};
  if (size != null) vars['--orb-size'] = `${size}px`;
  if (speed != null) vars['--orb-speed'] = `${speed}`;
  if (colorFrom) vars['--orb-color-from'] = colorFrom;
  if (colorTo) vars['--orb-color-to'] = colorTo;
  return vars as CSSProperties;
};
