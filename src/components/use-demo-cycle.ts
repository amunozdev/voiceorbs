'use client';

import { useEffect, useState } from 'react';
import type { OrbState } from '@/registry/lib/orb-state';

interface DemoStep {
  state: OrbState;
  duration: number;
}

const DEMO_STEPS: DemoStep[] = [
  { state: 'connecting', duration: 900 },
  { state: 'listening', duration: 2500 },
  { state: 'thinking', duration: 1400 },
  { state: 'speaking', duration: 3000 },
  { state: 'idle', duration: 1600 },
];

const jitter = (ms: number): number => Math.round(ms * (0.85 + Math.random() * 0.3));

export const useStateCycle = (
  active: boolean,
  onState: (next: OrbState) => void,
  { randomStart = false }: { randomStart?: boolean } = {},
): void => {
  useEffect(() => {
    if (!active) return;
    let timer = 0;
    let index = randomStart ? Math.floor(Math.random() * DEMO_STEPS.length) : 0;
    const advance = () => {
      const step = DEMO_STEPS[index % DEMO_STEPS.length];
      index += 1;
      onState(step.state);
      timer = window.setTimeout(advance, jitter(step.duration));
    };
    timer = window.setTimeout(advance, randomStart ? jitter(400) : 0);
    return () => window.clearTimeout(timer);
  }, [active, onState, randomStart]);
};

export interface DemoCycle {
  running: boolean;
  toggle: () => void;
  stop: () => void;
}

export const useDemoCycle = (onState: (next: OrbState) => void): DemoCycle => {
  const [running, setRunning] = useState(false);

  useStateCycle(running, onState);

  const toggle = () => setRunning((prev) => !prev);
  const stop = () => setRunning(false);

  return { running, toggle, stop };
};
