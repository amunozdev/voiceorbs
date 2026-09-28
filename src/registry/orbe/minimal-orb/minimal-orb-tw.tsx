'use client';

import { useCallback, useRef } from 'react';
import clsx from 'clsx';
import { ERROR_COLOR_FROM, ERROR_COLOR_TO, orbVars, type OrbProps } from '../../lib/orb-state';
import { useOrbLevel } from '../../lib/use-orb-level';

const MINIMAL_TW_CSS = `
@property --mtw-from { syntax: '<color>'; inherits: true; initial-value: #818cf8; }
@property --mtw-to { syntax: '<color>'; inherits: true; initial-value: #a5b4fc; }
@property --mtw-breathe { syntax: '<number>'; inherits: true; initial-value: 1; }
@property --mtw-pulse { syntax: '<number>'; inherits: true; initial-value: 0; }
@property --mtw-mark { syntax: '<number>'; inherits: true; initial-value: 0; }
@property --mtw-swell { syntax: '<number>'; inherits: true; initial-value: 0; }
@property --mtw-flow { syntax: '<number>'; inherits: true; initial-value: 0; }
[data-minimal-orb-tw] {
  --mtw-from: var(--orb-color-from);
  --mtw-to: var(--orb-color-to);
  --mtw-breathe: 1;
  --mtw-pulse: 0;
  --mtw-mark: 0;
  --mtw-swell: 0;
  --mtw-flow: 0;
  --orb-dur: 0.2s;
  --orb-ease: cubic-bezier(0.16, 1, 0.3, 1);
  transition-property:
    opacity, filter, --mtw-from, --mtw-to, --mtw-breathe, --mtw-pulse, --mtw-mark, --mtw-swell,
    --mtw-flow;
  transition-duration: var(--orb-dur);
  transition-timing-function: var(--orb-ease);
}
[data-minimal-orb-tw]:is([data-state='idle'], [data-state='disabled']) {
  --orb-dur: 0.6s;
  --orb-ease: cubic-bezier(0.65, 0, 0.35, 1);
}
[data-minimal-orb-tw][data-state='connecting'] {
  --mtw-breathe: 0;
  --mtw-pulse: 1;
  --mtw-from: color-mix(in oklab, var(--orb-color-from) 70%, #94a3b8);
  --mtw-to: color-mix(in oklab, var(--orb-color-to) 70%, #94a3b8);
}
[data-minimal-orb-tw][data-state='listening'] { --mtw-breathe: 0; --mtw-swell: 1; }
[data-minimal-orb-tw][data-state='speaking'] {
  --mtw-breathe: 0;
  --mtw-flow: 1;
  --mtw-from: color-mix(in oklab, var(--orb-color-from) 86%, white);
  --mtw-to: color-mix(in oklab, var(--orb-color-to) 86%, white);
}
[data-minimal-orb-tw][data-state='error'] {
  --mtw-breathe: 0;
  --mtw-mark: 1;
  --mtw-from: color-mix(in oklab, ${ERROR_COLOR_FROM} 68%, #9ca3af);
  --mtw-to: color-mix(in oklab, ${ERROR_COLOR_TO} 68%, #9ca3af);
}
[data-minimal-orb-tw][data-state='disabled'] {
  --mtw-breathe: 0;
  filter: grayscale(1);
  opacity: 0.45;
}
[data-minimal-orb-tw][data-state='error'] [data-shaker] {
  animation: minimal-orb-tw-shake 0.45s ease-out 1;
}
[data-minimal-orb-tw] [data-disc] {
  border: 1px solid light-dark(
    color-mix(in oklab, var(--mtw-to), black 22%),
    color-mix(in oklab, var(--mtw-from), transparent 55%)
  );
  scale: calc(1 + (0.02 + 0.07 * var(--mtw-swell)) * var(--orb-level, 0));
  animation:
    minimal-orb-tw-breathe calc(4.4s / var(--orb-speed, 1)) ease-in-out infinite,
    minimal-orb-tw-settle calc(2.8s / var(--orb-speed, 1)) ease-in-out infinite;
}
[data-minimal-orb-tw] [data-ring] {
  border: 1.5px solid color-mix(in oklab, var(--mtw-from), transparent 30%);
  opacity: calc(var(--mtw-swell) * (0.18 + 0.62 * var(--orb-level, 0)));
  scale: calc(1.05 + var(--mtw-swell) * 0.16 * var(--orb-level, 0));
}
[data-minimal-orb-tw] [data-flow] {
  background: radial-gradient(32% 32% at 50% 50%, color-mix(in oklab, white 72%, var(--mtw-to)), transparent 72%);
  mix-blend-mode: soft-light;
  opacity: calc(var(--mtw-flow) * (0.2 + 0.8 * var(--orb-level, 0)));
  animation: minimal-orb-tw-flow calc(5.2s / var(--orb-speed, 1)) ease-in-out infinite;
}
[data-minimal-orb-tw] [data-spin] {
  animation: minimal-orb-tw-turn calc(90s / var(--orb-speed, 1)) linear infinite;
}
[data-minimal-orb-tw] [data-spin-turbo] {
  background: linear-gradient(135deg, var(--mtw-from), var(--mtw-to));
  animation: minimal-orb-tw-turn calc(18s / var(--orb-speed, 1)) linear infinite;
  animation-play-state: paused;
}
[data-minimal-orb-tw][data-state='thinking'] [data-spin-turbo] {
  animation-play-state: running;
}
[data-minimal-orb-tw] [data-mark] {
  background: color-mix(in oklab, white 84%, var(--mtw-from));
  opacity: calc(0.9 * var(--mtw-mark));
}
@keyframes minimal-orb-tw-breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(calc(1 + 0.035 * var(--mtw-breathe))); }
}
@keyframes minimal-orb-tw-settle {
  0%, 100% { opacity: 1; }
  50% { opacity: calc(1 - 0.12 * var(--mtw-pulse)); }
}
@keyframes minimal-orb-tw-flow {
  0%, 100% { transform: translate(-14%, -10%); }
  33% { transform: translate(12%, -6%); }
  66% { transform: translate(2%, 14%); }
}
@keyframes minimal-orb-tw-turn {
  to { transform: rotate(360deg); }
}
@keyframes minimal-orb-tw-shake {
  0% { transform: translateX(0); }
  18% { transform: translateX(-2.5%); }
  42% { transform: translateX(3%); }
  66% { transform: translateX(-1.8%); }
  84% { transform: translateX(0.8%); }
  100% { transform: translateX(0); }
}
@media (prefers-reduced-motion: reduce) {
  [data-minimal-orb-tw] [data-disc],
  [data-minimal-orb-tw] [data-spin],
  [data-minimal-orb-tw] [data-spin-turbo],
  [data-minimal-orb-tw] [data-flow],
  [data-minimal-orb-tw][data-state='error'] [data-shaker] {
    animation: none;
  }
}
`;

export const MinimalOrbTw = ({
  state = 'idle',
  size = 168,
  speed = 1,
  colorFrom = '#818cf8',
  colorTo = '#a5b4fc',
  levelRef,
  label = 'Assistant orb',
  className,
  ref,
}: OrbProps) => {
  const internalRef = useRef<HTMLDivElement | null>(null);
  useOrbLevel(internalRef, state, levelRef, undefined, speed);
  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      internalRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  return (
    <div
      ref={setRef}
      role="img"
      aria-label={label}
      data-state={state}
      data-minimal-orb-tw=""
      className={clsx('relative isolate grid place-items-center', className)}
      style={{
        ...orbVars({ size, speed, colorFrom, colorTo }),
        width: size,
        height: size,
      }}
    >
      <style>{MINIMAL_TW_CSS}</style>
      <span data-shaker="" className="absolute grid h-[60%] w-[60%] place-items-center">
        <span data-ring="" className="pointer-events-none absolute inset-0 rounded-full" />
        <span
          data-disc=""
          className="absolute inset-0 overflow-hidden rounded-full will-change-[transform,opacity]"
        >
          <span data-spin="" className="absolute -inset-[28%]">
            <span data-spin-turbo="" className="absolute inset-0" />
          </span>
          <span data-flow="" className="absolute -inset-[25%] will-change-transform" />
        </span>
        <span data-mark="" className="absolute h-[4%] w-[18%] rounded-full" />
      </span>
    </div>
  );
};
