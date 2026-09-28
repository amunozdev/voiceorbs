'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ComponentType, CSSProperties, Ref } from 'react';
import type { OrbProps, OrbState } from './orb-state';
import styles from './orb-pill.module.css';

export type OrbMessages = Partial<Record<OrbState, string | readonly string[]>>;

export type OrbPillSize = 'sm' | 'md' | 'lg';

export const DEFAULT_ORB_MESSAGES: Record<OrbState, string> = {
  idle: 'Ready',
  connecting: 'Connecting',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
  error: 'Something went wrong',
  disabled: 'Unavailable',
};

const ORB_PX: Record<OrbPillSize, number> = { sm: 28, md: 40, lg: 56 };

const SHIMMER_STATES: readonly OrbState[] = ['connecting', 'thinking'];

export interface OrbPillProps extends Omit<OrbProps, 'size' | 'label' | 'ref'> {
  orb: ComponentType<OrbProps>;
  text?: string;
  messages?: OrbMessages;
  interval?: number;
  size?: OrbPillSize;
  shimmer?: 'auto' | 'always' | 'never';
  orbScale?: number;
  ref?: Ref<HTMLDivElement>;
}

const messageList = (state: OrbState, messages?: OrbMessages): readonly string[] => {
  const custom = messages?.[state];
  if (typeof custom === 'string') return [custom];
  if (custom && custom.length > 0) return custom;
  return [DEFAULT_ORB_MESSAGES[state]];
};

const useRotatingMessage = (list: readonly string[], interval: number): string => {
  const key = list.join('\u0000');
  const [tick, setTick] = useState({ key, index: 0 });
  const index = tick.key === key ? tick.index : 0;

  useEffect(() => {
    if (list.length < 2) return;
    const id = window.setInterval(
      () => setTick((prev) => ({ key, index: prev.key === key ? (prev.index + 1) % list.length : 1 })),
      interval,
    );
    return () => window.clearInterval(id);
  }, [key, list.length, interval]);

  return list[index % list.length];
};

interface Line {
  id: number;
  text: string;
}

const Letters = ({ text }: { text: string }) => (
  <>
    {Array.from(text).map((char, i) => (
      <span key={i} className={styles.char} style={{ '--i': i } as CSSProperties}>
        {char === ' ' ? ' ' : char}
      </span>
    ))}
  </>
);

export interface OrbPillTextProps {
  text: string;
  shimmer?: boolean;
  onWidth?: (width: number) => void;
  className?: string;
}

export const OrbPillText = ({ text, shimmer = false, onWidth, className }: OrbPillTextProps) => {
  const [lines, setLines] = useState<{ current: Line; leaving: Line | null }>({
    current: { id: 0, text },
    leaving: null,
  });
  const measureRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const onWidthRef = useRef(onWidth);

  useEffect(() => {
    onWidthRef.current = onWidth;
  }, [onWidth]);

  if (lines.current.text !== text) {
    setLines({ current: { id: lines.current.id + 1, text }, leaving: lines.current });
  }

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const measure = () => {
      const next = Math.ceil(el.getBoundingClientRect().width) + 1;
      setWidth(next);
      onWidthRef.current?.(next);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [lines.current.text]);

  return (
    <span
      className={[styles.copy, className].filter(Boolean).join(' ')}
      style={width === null ? undefined : { width }}
      data-shimmer={shimmer ? '' : undefined}
    >
      {lines.leaving && (
        <span
          key={lines.leaving.id}
          className={`${styles.line} ${styles.leaving}`}
          aria-hidden="true"
          onAnimationEnd={(event) => {
            if (event.target === event.currentTarget) setLines((prev) => ({ ...prev, leaving: null }));
          }}
        >
          {lines.leaving.text}
        </span>
      )}
      <span key={lines.current.id} className={styles.line} aria-hidden="true">
        <span ref={measureRef} className={styles.base}>
          <Letters text={lines.current.text} />
        </span>
        <span className={styles.sheen}>{lines.current.text}</span>
      </span>
    </span>
  );
};

export const useOrbMessage = (
  state: OrbState,
  { text, messages, interval = 2600 }: { text?: string; messages?: OrbMessages; interval?: number } = {},
): string => {
  const rotating = useRotatingMessage(messageList(state, messages), interval);
  return text ?? rotating;
};

export const isShimmerState = (state: OrbState): boolean => SHIMMER_STATES.includes(state);

export const OrbPill = ({
  orb: Orb,
  state = 'idle',
  text,
  messages,
  interval = 2600,
  size = 'md',
  shimmer = 'auto',
  orbScale = 1,
  speed,
  colorFrom,
  colorTo,
  levelRef,
  className,
  ref,
}: OrbPillProps) => {
  const message = useOrbMessage(state, { text, messages, interval });
  const shimmering = shimmer === 'always' || (shimmer === 'auto' && isShimmerState(state));
  const orbPx = ORB_PX[size];

  return (
    <div
      ref={ref}
      className={[styles.pill, className].filter(Boolean).join(' ')}
      data-size={size}
      data-state={state}
    >
      <span className={styles.orb} style={{ width: orbPx, height: orbPx }} aria-hidden="true">
        <Orb
          state={state}
          size={Math.round(orbPx * orbScale)}
          speed={speed}
          colorFrom={colorFrom}
          colorTo={colorTo}
          levelRef={levelRef}
          label=""
        />
      </span>
      <OrbPillText text={message} shimmer={shimmering} />
      <span className={styles.srOnly} role="status" aria-live="polite">
        {message}
      </span>
    </div>
  );
};
