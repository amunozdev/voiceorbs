'use client';

import { useCallback, useEffect, useRef } from 'react';
import { orbVars, type OrbProps, type OrbState } from '../../lib/orb-state';
import { useOrbLevel } from '../../lib/use-orb-level';
import { useReducedMotion } from '../../lib/use-reduced-motion';
import styles from './glass-orb.module.css';

const REDUCED_LEVELS: Record<OrbState, number> = {
  idle: 0,
  connecting: 0.22,
  listening: 0.7,
  thinking: 0.4,
  speaking: 0.55,
  error: 0.2,
  disabled: 0,
};

export const GlassOrb = ({
  state = 'idle',
  size = 160,
  speed = 1,
  colorFrom,
  colorTo,
  levelRef,
  label = 'Assistant orb',
  className,
  ref,
}: OrbProps) => {
  const innerRef = useRef<HTMLDivElement>(null);

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      innerRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  useOrbLevel(innerRef, state, levelRef, undefined, speed);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!reduced) return;
    innerRef.current?.style.setProperty('--orb-level', REDUCED_LEVELS[state].toFixed(3));
  }, [reduced, state]);

  return (
    <div
      ref={setRef}
      role="img"
      aria-label={label}
      data-state={state}
      className={[styles.orb, className].filter(Boolean).join(' ')}
      style={orbVars({ size, speed, colorFrom, colorTo })}
    >
      <span className={styles.halo} />
      <span className={styles.aura} />
      <span className={styles.sphere} />
      <span className={styles.sheen} />
      <span className={styles.rim} />
      <span className={styles.spec} />
      <span className={styles.orbit} />
      <span className={styles.counter} />
      <span className={styles.grain} />
    </div>
  );
};
