import { describe, expect, it } from 'vitest';
import { mixHex, rgba } from '@/registry/lib/orb-color';
import { blendStates, createStateMix, ENTER_RATE, SETTLE_RATE, stateRate } from '@/registry/lib/orb-state';

describe('mixHex', () => {
  it('returns the endpoints at t=0 and t=1', () => {
    expect(mixHex('#ff0000', '#0000ff', 0)).toBe('#ff0000');
    expect(mixHex('#ff0000', '#0000ff', 1)).toBe('#0000ff');
  });

  it('mixes in linear light so the midpoint is brighter than sRGB averaging', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#bcbcbc');
  });
});

describe('rgba', () => {
  it('clamps alpha', () => {
    expect(rgba([10, 20, 30], 2)).toBe('rgba(10,20,30,1.000)');
  });
});

describe('stateRate', () => {
  it('enters active states faster than it settles back to idle', () => {
    expect(stateRate('listening')).toBe(ENTER_RATE);
    expect(stateRate('idle')).toBe(SETTLE_RATE);
    expect(ENTER_RATE).toBeGreaterThan(SETTLE_RATE);
  });

  it('reaches most of an active state within about 0.2 s', () => {
    const mix = createStateMix('idle');
    for (let i = 0; i < 12; i++) mix.update('speaking', 1 / 60);
    expect(mix.weights.speaking).toBeGreaterThan(0.9);
  });
});

describe('blendStates', () => {
  it('blends per-state parameter tables by weight', () => {
    const row = (v: number) => ({ v });
    const table = {
      idle: row(0),
      connecting: row(0),
      listening: row(10),
      thinking: row(0),
      speaking: row(0),
      error: row(0),
      disabled: row(0),
    };
    const weights = { ...createStateMix('idle').weights, idle: 0.5, listening: 0.5 };
    expect(blendStates(weights, table).v).toBe(5);
  });
});
