'use client';

import { orbVars, type OrbProps } from '@/registry/lib/orb-state';

export const SiriWaveLine = ({ size = 168, speed, colorFrom, colorTo, label = 'Assistant orb', className, ref }: OrbProps) => (
  <div
    ref={ref}
    role="img"
    aria-label={label}
    className={className}
    style={{
      ...orbVars({ size, speed, colorFrom, colorTo }),
      width: size,
      height: size,
      borderRadius: '50%',
      background: 'radial-gradient(circle, var(--orb-color-to), var(--orb-color-from))',
    }}
  />
);
