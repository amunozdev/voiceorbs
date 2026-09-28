'use client';

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import {
  approach,
  blendEnergy,
  createStateMix,
  type OrbState,
  type StateWeights,
} from './orb-state';
import { observeActivity } from './use-in-view';
import { prefersReducedMotion, subscribeReducedMotion } from './use-reduced-motion';

export const LEVEL_ATTACK_RATE = 14;
export const LEVEL_RELEASE_RATE = 4;
export const MAX_FRAME_DT = 0.1;

export interface OrbFrame {
  dt: number;
  dPhase: number;
  phase: number;
  time: number;
  weights: StateWeights;
  level: number;
  live: boolean;
  reduced: boolean;
  state: OrbState;
}

export interface OrbAnimatorOptions {
  state: OrbState;
  levelRef?: RefObject<number>;
  speed?: number;
  onFrame?: (frame: OrbFrame) => void;
}

export interface OrbAnimator {
  frameRef: RefObject<OrbFrame>;
}

export const smoothLevel = (current: number, target: number, dt: number): number =>
  approach(current, target, target > current ? LEVEL_ATTACK_RATE : LEVEL_RELEASE_RATE, dt);

const isSettled = (weights: StateWeights, state: OrbState): boolean => weights[state] > 0.999;

export const useOrbAnimator = (
  hostRef: RefObject<HTMLElement | null>,
  { state, levelRef, speed = 1, onFrame }: OrbAnimatorOptions,
): OrbAnimator => {
  const optionsRef = useRef({ state, levelRef, speed, onFrame });
  const wakeRef = useRef<() => void>(() => {});
  const frameRef = useRef<OrbFrame>({
    dt: 0,
    dPhase: 0,
    phase: 0,
    time: 0,
    weights: createStateMix(state).weights,
    level: 0,
    live: false,
    reduced: false,
    state,
  });

  useEffect(() => {
    optionsRef.current = { state, levelRef, speed, onFrame };
    wakeRef.current();
  }, [state, levelRef, speed, onFrame]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const mix = createStateMix(optionsRef.current.state);
    const frame = frameRef.current;
    frame.weights = mix.weights;
    let reduced = prefersReducedMotion();
    let raf = 0;
    let last: number | null = null;
    let active = true;

    const tick = (now: number) => {
      raf = 0;
      const dt = last === null ? 0 : Math.min((now - last) / 1000, MAX_FRAME_DT);
      last = now;
      const opts = optionsRef.current;
      const live = opts.levelRef?.current;
      const hasLive = typeof live === 'number' && live >= 0;
      mix.update(opts.state, dt);
      frame.dPhase = reduced ? 0 : dt * Math.max(0, opts.speed);
      if (!reduced) {
        frame.time += dt;
        frame.phase += frame.dPhase;
      }
      const target = reduced ? 0 : hasLive ? live : blendEnergy(mix.weights, frame.phase);
      frame.level = smoothLevel(frame.level, target, dt);
      frame.dt = dt;
      frame.live = hasLive;
      frame.reduced = reduced;
      frame.state = opts.state;
      opts.onFrame?.(frame);
      const idle = reduced && isSettled(mix.weights, opts.state) && frame.level < 0.001;
      if (active && !idle) raf = requestAnimationFrame(tick);
      else last = null;
    };

    const wake = () => {
      if (active && raf === 0) raf = requestAnimationFrame(tick);
    };

    const halt = () => {
      if (raf !== 0) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      last = null;
    };

    wakeRef.current = wake;

    const unobserve = observeActivity(el, (next) => {
      active = next;
      if (next) wake();
      else halt();
    });

    const unsubscribe = subscribeReducedMotion(() => {
      reduced = prefersReducedMotion();
      wake();
    });

    wake();

    return () => {
      halt();
      unobserve();
      unsubscribe();
      wakeRef.current = () => {};
    };
  }, [hostRef]);

  return { frameRef };
};
