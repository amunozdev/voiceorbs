'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { OrbState } from '@/registry/lib/orb-state';
import { OrbPillText, isShimmerState } from '@/registry/lib/orb-pill';
import { useReducedMotion } from '@/registry/lib/use-reduced-motion';
import { OrbPreview } from './orb-preview';
import { pillScaleFor } from './pill-scale';

const PILL_ORB = 40;
const PILL_PAD = 6;
const PILL_GAP = 10;
const PILL_TAIL = 16;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const ENTER = `0.55s ${EASE}`;
const EXIT = `0.5s ${EASE}`;
const RESIZE = `0.4s ${EASE}`;

type Phase = 'enter' | 'settled' | 'exit';

type VarStyle = CSSProperties & Record<`--${string}`, string | number>;

interface OrbMorphStageProps {
  id: string;
  state: OrbState;
  size: number;
  colorFrom: string;
  colorTo: string;
  label: string;
  feedback: boolean;
  message: string;
}

export const OrbMorphStage = ({ id, state, size, colorFrom, colorTo, label, feedback, message }: OrbMorphStageProps) => {
  const reducedMotion = useReducedMotion();
  const [textWidth, setTextWidth] = useState(0);
  const [lingering, setLingering] = useState(false);
  const [settled, setSettled] = useState(false);
  const [heldMessage, setHeldMessage] = useState(message);

  if (feedback && !lingering) setLingering(true);
  if (!feedback && settled) setSettled(false);
  if (feedback && heldMessage !== message) setHeldMessage(message);

  useEffect(() => {
    if (feedback || !lingering) return;
    const timer = window.setTimeout(() => setLingering(false), 500);
    return () => window.clearTimeout(timer);
  }, [feedback, lingering]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setSettled(true), 600);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const onWidth = useCallback((width: number) => setTextWidth(width), []);

  const phase: Phase = feedback ? (settled ? 'settled' : 'enter') : 'exit';
  const geometry = phase === 'enter' ? ENTER : phase === 'exit' ? EXIT : RESIZE;
  const motion = (value: string) => (reducedMotion ? 'none' : value);

  const box = PILL_ORB + PILL_PAD * 2;
  const pillWidth = PILL_PAD + PILL_ORB + PILL_GAP + textWidth + PILL_TAIL;
  const bubble = Math.round(size * 0.7);
  const orbOffset = -pillWidth / 2 + PILL_PAD + PILL_ORB / 2;
  const scale = Math.min(1, (PILL_ORB * pillScaleFor(id)) / size);
  const clipRadius = feedback ? PILL_ORB / 2 / scale : size * 0.75;

  const shellStyle: CSSProperties = {
    width: feedback ? pillWidth : bubble,
    height: feedback ? box : bubble,
    opacity: feedback ? 1 : 0,
    background: 'color-mix(in oklab, var(--color-foreground) 6%, var(--color-panel))',
    borderColor: 'color-mix(in oklab, var(--color-foreground) 16%, transparent)',
    transition: motion(
      feedback
        ? `width ${geometry}, height ${geometry}, opacity 0.2s ease`
        : `width ${geometry}, height ${geometry}, opacity 0.16s ease 0.03s`,
    ),
  };

  const orbStyle: VarStyle = {
    '--orb-label-opacity': feedback ? 0 : 1,
    '--orb-label-duration': feedback ? '0.12s' : '0.3s',
    '--orb-label-delay': feedback ? '0s' : '0.3s',
    transform: feedback ? `translate3d(${orbOffset}px, 0, 0) scale(${scale})` : 'translate3d(0, 0, 0) scale(1)',
    clipPath: `circle(${clipRadius}px at 50% 50%)`,
    transition: motion(`transform ${geometry}, clip-path ${geometry}`),
  };

  const textStyle: VarStyle = {
    '--pill-char-delay': '220ms',
    '--pill-char-step': '10ms',
    left: PILL_PAD + PILL_ORB + PILL_GAP - 1,
    opacity: feedback ? 1 : 0,
    transform: feedback ? 'translate3d(0, -50%, 0)' : 'translate3d(-6px, -50%, 0)',
    transition: motion(
      feedback
        ? `opacity 0.25s ease 0.2s, transform 0.45s ${EASE} 0.2s`
        : 'opacity 0.1s ease, transform 0.2s ease',
    ),
  };

  return (
    <div className="relative grid w-full place-items-center" style={{ height: Math.max(size, box) }}>
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border shadow-[0_18px_40px_-24px_rgba(0,0,0,0.6)]"
        style={shellStyle}
      >
        <div
          className="pointer-events-none absolute top-1/2 flex items-center text-sm font-[560] text-foreground"
          style={textStyle}
        >
          {(feedback || lingering) && (
            <OrbPillText
              text={feedback ? message : heldMessage}
              shimmer={isShimmerState(state)}
              onWidth={onWidth}
            />
          )}
        </div>
      </div>
      <div className="relative" style={orbStyle}>
        <OrbPreview id={id} state={state} size={size} colorFrom={colorFrom} colorTo={colorTo} label={label} />
      </div>
    </div>
  );
};
