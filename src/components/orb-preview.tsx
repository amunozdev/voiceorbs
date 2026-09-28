'use client';

import { useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import dynamic from 'next/dynamic';
import { PulseOrb } from '@/registry/orbe/pulse-orb/pulse-orb';
import { GlassOrb } from '@/registry/orbe/glass-orb/glass-orb';
import { GooeyOrb } from '@/registry/orbe/gooey-orb/gooey-orb';
import { GalaxyOrb } from '@/registry/orbe/galaxy-orb/galaxy-orb';
import { ParticlesOrb } from '@/registry/orbe/particles-orb/particles-orb';
import { EqualizerOrb } from '@/registry/orbe/equalizer-orb/equalizer-orb';
import { AuroraOrb } from '@/registry/orbe/aurora-orb/aurora-orb';
import { HaloOrb } from '@/registry/orbe/halo-orb/halo-orb';
import { WaveformRing } from '@/registry/orbe/waveform-ring/waveform-ring';
import { EdgeGlow } from '@/registry/orbe/edge-glow/edge-glow';
import { IridescentFlow } from '@/registry/orbe/iridescent-flow/iridescent-flow';
import { MinimalOrb } from '@/registry/orbe/minimal-orb/minimal-orb';
import type { OrbProps } from '@/registry/lib/orb-state';

const MAP: Record<string, ComponentType<OrbProps>> = {
  'pulse-orb': PulseOrb,
  'glass-orb': GlassOrb,
  'gooey-orb': GooeyOrb,
  'galaxy-orb': GalaxyOrb,
  'particles-orb': ParticlesOrb,
  'equalizer-orb': EqualizerOrb,
  'aurora-orb': AuroraOrb,
  'halo-orb': HaloOrb,
  'waveform-ring': WaveformRing,
  'edge-glow': EdgeGlow,
  'iridescent-flow': IridescentFlow,
  'minimal-orb': MinimalOrb,
};

const DeferredLoading = () => (
  <div
    aria-hidden="true"
    className="absolute inset-[10%] rounded-full bg-border/60 motion-safe:animate-pulse"
  />
);

const DEFERRED_MAP: Record<string, ComponentType<OrbProps>> = {
  'plasma-orb': dynamic(() => import('@/registry/orbe/plasma-orb/plasma-orb').then((m) => m.PlasmaOrb), {
    ssr: false,
    loading: DeferredLoading,
  }),
  'nebula-orb': dynamic(() => import('@/registry/orbe/nebula-orb/nebula-orb').then((m) => m.NebulaOrb), {
    ssr: false,
    loading: DeferredLoading,
  }),
  'radiance-orb': dynamic(() => import('@/registry/orbe/radiance-orb/radiance-orb').then((m) => m.RadianceOrb), {
    ssr: false,
    loading: DeferredLoading,
  }),
  'dither-orb': dynamic(() => import('@/registry/orbe/dither-orb/dither-orb').then((m) => m.DitherOrb), {
    ssr: false,
    loading: DeferredLoading,
  }),
  'dot-orbit': dynamic(() => import('@/registry/orbe/dot-orbit/dot-orbit').then((m) => m.DotOrbit), {
    ssr: false,
    loading: DeferredLoading,
  }),
  'grain-orb': dynamic(() => import('@/registry/orbe/grain-orb/grain-orb').then((m) => m.GrainOrb), {
    ssr: false,
    loading: DeferredLoading,
  }),
  'mercury-orb': dynamic(() => import('@/registry/orbe/mercury-orb/mercury-orb').then((m) => m.MercuryOrb), {
    ssr: false,
    loading: DeferredLoading,
  }),
  'siri-sheet': dynamic(() => import('@/registry/orbe/siri-sheet/siri-sheet').then((m) => m.SiriSheet), {
    ssr: false,
    loading: DeferredLoading,
  }),
  'duotone-flow': dynamic(() => import('@/registry/orbe/duotone-flow/duotone-flow').then((m) => m.DuotoneFlow), {
    ssr: false,
    loading: DeferredLoading,
  }),
  'aura-field': dynamic(() => import('@/registry/orbe/aura-field/aura-field').then((m) => m.AuraField), {
    ssr: false,
    loading: DeferredLoading,
  }),
  'siri-wave-line': dynamic(() => import('@/registry/orbe/siri-wave-line/siri-wave-line').then((m) => m.SiriWaveLine), {
    ssr: false,
    loading: DeferredLoading,
  }),
};

const DeferredOrb = ({ orb: Orb, ...props }: OrbProps & { orb: ComponentType<OrbProps> }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    if (near) return;
    const el = hostRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true);
      },
      { rootMargin: '400px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [near]);

  const { size = 168, colorFrom = '#8b5cf6', colorTo = '#22d3ee', label = 'Assistant orb' } = props;

  return (
    <div ref={hostRef} style={{ width: size, height: size, position: 'relative' }}>
      {near ? (
        <Orb {...props} />
      ) : (
        <div role="img" aria-label={label} aria-busy="true" className="absolute inset-[10%] opacity-50">
          <div
            className="size-full rounded-full motion-safe:animate-pulse"
            style={{
              background: `radial-gradient(circle at 36% 30%, ${colorTo} 0%, ${colorFrom} 62%, transparent 100%)`,
            }}
          />
        </div>
      )}
    </div>
  );
};

interface OrbPreviewProps extends OrbProps {
  id: string;
}

export const OrbPreview = ({ id, ...props }: OrbPreviewProps) => {
  const Deferred = DEFERRED_MAP[id];
  if (Deferred) return <DeferredOrb orb={Deferred} {...props} />;
  const Orb = MAP[id];
  return Orb ? <Orb {...props} /> : null;
};

export const orbComponent = (id: string): ComponentType<OrbProps> | undefined => DEFERRED_MAP[id] ?? MAP[id];
