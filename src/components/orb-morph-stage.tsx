'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { OrbState } from '@/registry/lib/orb-state';
import { OrbPillText, isShimmerState } from '@/registry/lib/orb-pill';
import { OrbPreview } from './orb-preview';

const PILL_ORB = 44;
const PILL_PAD = 8;
const PILL_GAP = 12;
const PILL_TAIL = 20;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

interface OrbMorphStageProps {
  id: string;
  state: OrbState;
  size: number;
  colorFrom: string;
  colorTo: string;
  label: string;
  feedback: boolean;
  message: string;
  orbScale?: number;
}

export const OrbMorphStage = ({
  id,
  state,
  size,
  colorFrom,
  colorTo,
  label,
  feedback,
  message,
  orbScale = 1,
}: OrbMorphStageProps) => {
  const [textWidth, setTextWidth] = useState(0);
  const [lingering, setLingering] = useState(false);
  const showText = feedback || lingering;

  if (feedback && !lingering) setLingering(true);

  useEffect(() => {
    if (feedback || !lingering) return;
    const id = window.setTimeout(() => setLingering(false), 450);
    return () => window.clearTimeout(id);
  }, [feedback, lingering]);
  const onWidth = useCallback((width: number) => setTextWidth(width), []);

  const box = PILL_ORB + PILL_PAD * 2;
  const pillWidth = box + PILL_GAP + textWidth + PILL_TAIL - PILL_PAD;
  const orbOffset = -pillWidth / 2 + PILL_PAD + PILL_ORB / 2;
  const scale = Math.min(1, (PILL_ORB * orbScale) / size);
  const textLeft = -pillWidth / 2 + PILL_PAD + PILL_ORB + PILL_GAP;

  const orbStyle: CSSProperties = {
    transform: feedback ? `translate3d(${orbOffset}px, 0, 0) scale(${scale})` : 'translate3d(0, 0, 0) scale(1)',
    transition: `transform ${feedback ? '0.7s' : '0.75s'} ${EASE} ${feedback ? '0s' : '0.12s'}`,
  };

  const pillStyle: CSSProperties = {
    width: feedback ? pillWidth : box,
    height: box,
    opacity: feedback ? 1 : 0,
    transform: feedback ? 'scale(1)' : `scale(${Math.min(1, size / box) * 0.9})`,
    transition: feedback
      ? `width 0.6s ${EASE} 0.12s, opacity 0.3s ease 0.08s, transform 0.55s ${EASE}`
      : `width 0.45s ${EASE}, opacity 0.35s ease 0.25s, transform 0.6s ${EASE} 0.1s`,
  };

  const textStyle: CSSProperties = {
    left: `calc(50% + ${textLeft}px)`,
    opacity: feedback ? 1 : 0,
    transform: feedback ? 'translate3d(0, -50%, 0)' : 'translate3d(-8px, -50%, 0)',
    transition: feedback
      ? `opacity 0.35s ease 0.32s, transform 0.5s ${EASE} 0.32s`
      : 'opacity 0.18s ease, transform 0.25s ease',
  };

  return (
    <div className="relative grid w-full place-items-center" style={{ height: Math.max(size, box) }}>
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-panel/80 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.6)] backdrop-blur motion-reduce:transition-none"
        style={pillStyle}
      />
      <div className="relative motion-reduce:transition-none" style={orbStyle}>
        <OrbPreview id={id} state={state} size={size} colorFrom={colorFrom} colorTo={colorTo} label={label} />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 flex items-center text-sm font-medium text-foreground motion-reduce:transition-none"
        style={textStyle}
      >
        {showText && <OrbPillText text={message} shimmer={isShimmerState(state)} onWidth={onWidth} />}
      </div>
    </div>
  );
};
