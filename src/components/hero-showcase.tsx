'use client';

import { useEffect, useRef, useState } from 'react';
import type { OrbState } from '@/registry/lib/orb-state';
import { useOrbMessage } from '@/registry/lib/orb-pill';
import { observeActivity } from '@/registry/lib/use-in-view';
import { useReducedMotion } from '@/registry/lib/use-reduced-motion';
import { OrbMorphStage } from './orb-morph-stage';
import { useStateCycle } from './use-demo-cycle';

const STEPS = ['Checking the database', 'Fetching prices', 'Drafting a reply'];

export const HeroShowcase = () => {
  const [state, setState] = useState<OrbState>('idle');
  const [inView, setInView] = useState(true);
  const reducedMotion = useReducedMotion();
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    return observeActivity(el, setInView);
  }, []);

  useStateCycle(inView && !reducedMotion, setState);

  const feedback = state === 'thinking';
  const message = useOrbMessage(feedback ? 'thinking' : 'idle', {
    messages: { thinking: STEPS, idle: STEPS[0] },
    interval: 1800,
  });

  return (
    <div
      ref={hostRef}
      className="relative grid min-h-64 place-items-center rounded-3xl bg-[radial-gradient(circle_at_50%_45%,var(--orb-stage-from),transparent_70%)] sm:min-h-80"
    >
      <OrbMorphStage
        id="siri-sheet"
        state={state}
        size={232}
        colorFrom="#82f4ff"
        colorTo="#8e6cff"
        label="Siri Sheet orb cycling through assistant states"
        feedback={feedback}
        message={message}
      />
    </div>
  );
};
