'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { ORB_STATES, type OrbState } from '@/registry/lib/orb-state';
import { observeActivity } from '@/registry/lib/use-in-view';
import { useReducedMotion } from '@/registry/lib/use-reduced-motion';
import { useOrbMessage } from '@/registry/lib/orb-pill';
import { OrbMorphStage } from './orb-morph-stage';
import { pillScaleFor } from './pill-scale';
import { ArrowRightIcon } from './orb-icons';
import { techInfo } from './tech-info';
import { useStateCycle } from './use-demo-cycle';
import type { GalleryOrb } from './gallery-orb';

const STATE_TEXT: Record<OrbState, string> = {
  idle: 'Idle',
  connecting: 'Connecting',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
  error: 'Error',
  disabled: 'Muted',
};

const PREVIEW_SIZE_CAP = 152;

const FEEDBACK_STEPS = [
  'Fetching prices',
  'Running the numbers',
  'Checking the database',
  'Researching sources',
  'Drafting a reply',
];

const stepsFor = (id: string): string[] => {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const start = hash % FEEDBACK_STEPS.length;
  return [FEEDBACK_STEPS[start], FEEDBACK_STEPS[(start + 2) % FEEDBACK_STEPS.length]];
};

export const OrbPreviewCard = ({ orb }: { orb: GalleryOrb }) => {
  const [state, setState] = useState<OrbState>('idle');
  const [inView, setInView] = useState(true);
  const reducedMotion = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const info = techInfo(orb.tech);
  const [steps] = useState(() => stepsFor(orb.id));
  const message = useOrbMessage('thinking', { messages: { thinking: steps }, interval: 1700 });

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    return observeActivity(el, setInView);
  }, []);

  useStateCycle(inView && !reducedMotion, setState, { randomStart: true });

  return (
    <article
      id={orb.id}
      className="group relative flex scroll-mt-20 flex-col gap-4 rounded-2xl border border-border bg-panel/60 p-5 transition-colors focus-within:border-accent hover:border-accent"
    >
      <ul aria-label="Traits" className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <li className="rounded-full border border-border px-2.5 py-1 font-medium text-foreground">
          {info.label}
        </li>
        {orb.dependencies.length === 0 && (
          <li className="rounded-full border border-border px-2.5 py-1 text-muted">Zero deps</li>
        )}
        {orb.hasTailwind && (
          <li className="rounded-full border border-border px-2.5 py-1 text-muted">Tailwind</li>
        )}
      </ul>

      <div
        ref={stageRef}
        className="relative grid min-h-56 place-items-center overflow-hidden rounded-xl border border-border bg-[radial-gradient(circle_at_50%_30%,var(--orb-stage-from),var(--orb-stage-to))]"
      >
        <OrbMorphStage
          id={orb.id}
          state={state}
          size={Math.min(orb.defaultSize, PREVIEW_SIZE_CAP)}
          colorFrom={orb.defaultColorFrom}
          colorTo={orb.defaultColorTo}
          label={`${orb.name} preview`}
          feedback={state === 'thinking'}
          message={message}
          orbScale={pillScaleFor(orb.id)}
        />
        <div
          aria-hidden="true"
          className="absolute bottom-2.5 left-2.5 flex items-center gap-2 rounded-full border border-border bg-panel/80 px-2.5 py-1 text-[11px] text-muted backdrop-blur"
        >
          <span className="flex items-center gap-1">
            {ORB_STATES.map((s) => (
              <span
                key={s}
                className={clsx(
                  'size-1.5 rounded-full transition-colors',
                  s === state ? 'bg-accent' : 'bg-border',
                )}
              />
            ))}
          </span>
          {STATE_TEXT[state]}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-semibold text-foreground">{orb.name}</h2>
        <p className="text-sm text-muted">{orb.tagline}</p>
        {info.cost && <p className="text-xs text-muted">{info.cost}</p>}
      </div>

      <Link
        href={`/orbs/${orb.id}`}
        className="mt-auto inline-flex min-h-10 w-fit items-center gap-1.5 rounded-md border border-border bg-panel px-3.5 text-sm font-medium text-foreground transition-colors after:absolute after:inset-0 after:rounded-2xl after:content-[''] group-hover:border-accent group-hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        Customize & get code
        <span className="sr-only">: {orb.name}</span>
        <ArrowRightIcon />
      </Link>
    </article>
  );
};
