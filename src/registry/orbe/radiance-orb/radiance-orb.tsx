'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { StaticRadialGradient } from '@paper-design/shaders-react';
import {
  blendEnergy,
  blendStates,
  clamp01,
  ERROR_COLOR_FROM,
  ERROR_COLOR_TO,
  hexToRgb,
  orbVars,
  type OrbProps,
  type OrbState,
} from '../../lib/orb-state';
import { mixHex, mixRgb, rgbToHex, shadeHex, tintHex, type Rgb } from '../../lib/orb-color';
import { useOrbAnimator, type OrbFrame } from '../../lib/use-orb-animator';
import { useReducedMotion } from '../../lib/use-reduced-motion';
import { useWebGLSupport } from '../../lib/use-webgl-support';

type ShaderUniforms = Record<string, number | number[] | number[][]>;

interface PaperMount {
  setUniforms: (uniforms: ShaderUniforms) => void;
  setFrame: (frame: number) => void;
}

interface PaperHost {
  paperShaderMount?: PaperMount;
}

const withAlpha = (hex: string, alpha: number) =>
  `${hex}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')}`;

const brandPalette = (from: string, to: string): string[] => [
  shadeHex(to, 0.28),
  shadeHex(to, 0.08),
  to,
  mixHex(to, from, 0.55),
  from,
  tintHex(from, 0.55),
  tintHex(from, 0.94),
];

const BLOOM_ALPHA = [0, 0.45, 0.92, 1, 1, 1, 1];
const TRANSPARENT = '#00000000';
const BLOOM_SCALE = 1.5;
const BLOOM_MASK =
  'radial-gradient(circle closest-side, #000 50%, rgba(0,0,0,0.72) 68%, rgba(0,0,0,0.26) 85%, transparent 100%)';

const ERROR_PALETTE = brandPalette(ERROR_COLOR_FROM, ERROR_COLOR_TO);

const GL_ATTRIBUTES: WebGLContextAttributes = {
  antialias: false,
  powerPreference: 'low-power',
};

const STATIC_PHASE = 0.9;
const STATIC_ANGLE = 215;
const MAX_PIXEL_RATIO = 2;
const TAU = Math.PI * 2;

type RadianceTune = {
  spin: number;
  flow: number;
  radius: number;
  focalDistance: number;
  falloff: number;
  distortion: number;
  ripple: number;
  grain: number;
  outer: number;
  inner: number;
  beat: number;
  beatRate: number;
  error: number;
};

const TUNE: Record<OrbState, RadianceTune> = {
  idle: { spin: 6, flow: 0.25, radius: 1, focalDistance: 0.2, falloff: 0.16, distortion: 0.04, ripple: 0.05, grain: 0.03, outer: 0.2, inner: 0.2, beat: 0, beatRate: 0.3, error: 0 },
  connecting: { spin: 16, flow: 0.3, radius: 0.98, focalDistance: 0.16, falloff: -0.04, distortion: 0.05, ripple: 0.08, grain: 0.05, outer: 0.1, inner: 0.1, beat: 0.7, beatRate: 0.28, error: 0 },
  listening: { spin: 10, flow: 0.45, radius: 1, focalDistance: 0.24, falloff: 0.1, distortion: 0.06, ripple: 0.08, grain: 0.08, outer: 1, inner: 0.2, beat: 0, beatRate: 0.3, error: 0 },
  thinking: { spin: 48, flow: 0.5, radius: 1, focalDistance: 0.46, falloff: 0.22, distortion: 0.14, ripple: 0.14, grain: 0.06, outer: 0.1, inner: 0.1, beat: 1, beatRate: 0.5, error: 0 },
  speaking: { spin: 18, flow: 0.9, radius: 1.02, focalDistance: 0.28, falloff: 0.16, distortion: 0.1, ripple: 0.2, grain: 0.1, outer: 0.3, inner: 1, beat: 0, beatRate: 0.3, error: 0 },
  error: { spin: 80, flow: 1.2, radius: 1.06, focalDistance: 0.5, falloff: 0.5, distortion: 0.34, ripple: 0.25, grain: 0.14, outer: 0.2, inner: 0.2, beat: 0, beatRate: 0.3, error: 1 },
  disabled: { spin: 0, flow: 0, radius: 0.96, focalDistance: 0.1, falloff: -0.3, distortion: 0, ripple: 0, grain: 0.02, outer: 0, inner: 0, beat: 0, beatRate: 0.3, error: 0 },
};

const toShaderColor = ([r, g, b]: Rgb, alpha: number): number[] => [r / 255, g / 255, b / 255, alpha];

const livePalette = (colorFrom: string, colorTo: string, errorMix: number): Rgb[] =>
  brandPalette(colorFrom, colorTo).map((stop, index) =>
    mixRgb(hexToRgb(stop), hexToRgb(ERROR_PALETTE[index]), errorMix),
  );

export const RadianceOrb = ({
  state = 'idle',
  size = 168,
  speed = 1,
  colorFrom = '#fb7185',
  colorTo = '#7c3aed',
  levelRef,
  label = 'Assistant orb',
  className,
  ref,
}: OrbProps) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sphereRef = useRef<HTMLDivElement>(null);
  const shaderRef = useRef<PaperHost | null>(null);
  const clockRef = useRef({ phase: 0, angle: STATIC_ANGLE, flow: 0, beat: 0, colors: '' });
  const reduced = useReducedMotion();
  const webgl = useWebGLSupport();
  const showShader = webgl === true;
  const [seed] = useState(() => {
    const tune = TUNE[state];
    return {
      ...tune,
      colors: livePalette(colorFrom, colorTo, tune.error).map((stop, index) =>
        withAlpha(rgbToHex(stop), BLOOM_ALPHA[index]),
      ),
    };
  });

  const setRootRef = (node: HTMLDivElement | null) => {
    rootRef.current = node;
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  };

  const bindShader = useCallback((node: PaperHost | null) => {
    shaderRef.current = node;
  }, []);

  const onFrame = (frame: OrbFrame) => {
    const root = rootRef.current;
    if (!root) return;
    const clock = clockRef.current;
    const step = Math.max(0, frame.phase - clock.phase);
    clock.phase = frame.phase;
    const tune = blendStates(frame.weights, TUNE);
    const level = frame.reduced ? blendEnergy(frame.weights, STATIC_PHASE) : frame.level;
    clock.beat += step * tune.beatRate;
    const wave = frame.reduced ? 0.5 : 0.5 - 0.5 * Math.cos(clock.beat * TAU);
    const inner = level * tune.inner + wave * tune.beat * 0.4;
    const outer = level * tune.outer + wave * tune.beat * 0.3;
    clock.angle = (clock.angle + step * (tune.spin + inner * 24)) % 360;
    clock.flow += step * (tune.flow + inner * 0.8);
    const errorMix = clamp01(tune.error);
    const palette = livePalette(colorFrom, colorTo, errorMix);
    const from = rgbToHex(mixRgb(hexToRgb(colorFrom), hexToRgb(ERROR_COLOR_FROM), errorMix));
    const to = rgbToHex(mixRgb(hexToRgb(colorTo), hexToRgb(ERROR_COLOR_TO), errorMix));
    const colorKey = `${from}${to}`;
    if (colorKey !== clock.colors) {
      clock.colors = colorKey;
      root.style.setProperty('--orb-live-from', from);
      root.style.setProperty('--orb-live-to', to);
    }
    root.style.setProperty('--orb-level', level.toFixed(4));
    root.style.setProperty('--orb-outer', clamp01(outer).toFixed(4));
    const mount = shaderRef.current?.paperShaderMount;
    if (!mount) return;
    mount.setUniforms({
      u_colors: palette.map((stop, index) => toShaderColor(stop, BLOOM_ALPHA[index])),
      u_radius: tune.radius + outer * 0.08,
      u_focalDistance: tune.focalDistance + inner * 0.3,
      u_focalAngle: clock.angle,
      u_falloff: tune.falloff + inner * 0.5 + wave * tune.beat * 0.12,
      u_distortion: clamp01(tune.distortion + inner * 0.18),
      u_distortionShift: 0.2 + tune.ripple * Math.sin(clock.flow * TAU),
      u_grainMixer: tune.grain,
    });
  };

  useOrbAnimator(rootRef, { state, levelRef, speed, onFrame });

  useEffect(() => {
    if (state !== 'error' || reduced) return;
    const el = sphereRef.current;
    if (!el) return;
    const shake = el.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-1.5px)' },
        { transform: 'translateX(3px)' },
        { transform: 'translateX(-2px)' },
        { transform: 'translateX(1px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 340, easing: 'ease-out' },
    );
    return () => shake.cancel();
  }, [state, reduced]);

  const bloom = Math.round(size * BLOOM_SCALE);
  const pad = (bloom - size) / 2;
  const liveFrom = `var(--orb-live-from, ${colorFrom})`;
  const liveTo = `var(--orb-live-to, ${colorTo})`;
  const fallbackLayers = [
    { key: 'brand', from: colorFrom, to: colorTo, visible: state !== 'error' },
    { key: 'error', from: ERROR_COLOR_FROM, to: ERROR_COLOR_TO, visible: state === 'error' },
  ].map(({ key, from: f, to: t, visible }) => ({
    key,
    visible,
    base: `radial-gradient(circle at 50% 46%, ${tintHex(f, 0.94)}, ${tintHex(f, 0.55)} 12%, ${f} 26%, ${mixHex(t, f, 0.55)} 42%, ${t} 58%, ${withAlpha(t, 0.4)} 76%, ${withAlpha(shadeHex(t, 0.28), 0)} 100%)`,
    glow: `radial-gradient(circle at 50% 46%, ${tintHex(f, 0.9)}, ${withAlpha(tintHex(f, 0.4), 0.65)} 20%, transparent 52%)`,
  }));

  return (
    <div
      ref={setRootRef}
      role="img"
      aria-label={label}
      data-state={state}
      className={className}
      style={{
        ...orbVars({ size, speed, colorFrom, colorTo }),
        width: size,
        height: size,
        position: 'relative',
        opacity: state === 'disabled' ? 0.5 : 1,
        filter: state === 'disabled' ? 'grayscale(0.85)' : 'grayscale(0)',
        scale: 'calc(1 + var(--orb-outer, 0) * 0.06)',
        transition: 'opacity 0.6s ease-out, filter 0.6s ease-out',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: -pad,
          backgroundImage: `radial-gradient(circle, color-mix(in oklab, ${liveFrom} 50%, transparent), color-mix(in oklab, ${liveTo} 26%, transparent) 42%, transparent 72%)`,
          filter: `blur(${Math.round(size * 0.08)}px)`,
          opacity: 'calc(0.25 + var(--orb-outer, 0) * 0.6 + var(--orb-level, 0) * 0.1)',
          scale: 'calc(1 + var(--orb-outer, 0) * 0.1)',
        }}
      />
      <div
        ref={sphereRef}
        style={{
          position: 'absolute',
          inset: -pad,
          maskImage: BLOOM_MASK,
          WebkitMaskImage: BLOOM_MASK,
        }}
      >
        {showShader ? (
          <StaticRadialGradient
            ref={bindShader}
            width={bloom}
            height={bloom}
            colorBack={TRANSPARENT}
            colors={seed.colors}
            radius={seed.radius}
            focalDistance={seed.focalDistance}
            focalAngle={STATIC_ANGLE}
            falloff={seed.falloff}
            mixing={0.95}
            distortion={seed.distortion}
            distortionShift={0.2}
            distortionFreq={9}
            grainMixer={seed.grain}
            grainOverlay={0.04}
            speed={0}
            frame={0}
            fit="cover"
            scale={1}
            minPixelRatio={1}
            maxPixelCount={bloom * bloom * MAX_PIXEL_RATIO * MAX_PIXEL_RATIO}
            webGlContextAttributes={GL_ATTRIBUTES}
          />
        ) : (
          <div aria-hidden style={{ position: 'absolute', inset: 0 }}>
            {fallbackLayers.map((layer) => (
              <div
                key={layer.key}
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: layer.base,
                  opacity: layer.visible ? 1 : 0,
                  transition: 'opacity 0.35s ease',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: layer.glow,
                    opacity: 'calc(0.25 + var(--orb-level, 0) * 0.75)',
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
