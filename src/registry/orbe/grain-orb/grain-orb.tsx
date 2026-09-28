'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GrainGradient } from '@paper-design/shaders-react';
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

const brandPalette = (from: string, to: string): string[] => [
  shadeHex(mixHex(from, to, 0.75), 0.48),
  from,
  tintHex(mixHex(from, to, 0.35), 0.75),
  mixHex(from, to, 0.55),
  shadeHex(to, 0.38),
  to,
  tintHex(to, 0.35),
];

const ERROR_PALETTE = brandPalette(ERROR_COLOR_FROM, ERROR_COLOR_TO);

const GL_ATTRIBUTES: WebGLContextAttributes = {
  antialias: true,
  alpha: true,
  powerPreference: 'low-power',
};

const BASE_FRAME = 6000;
const STATIC_PHASE = 0.9;
const BASE_SCALE = 0.92;
const MAX_PIXEL_RATIO = 2;
const TAU = Math.PI * 2;
const SPHERE_MASK = 'radial-gradient(circle, #000 58%, transparent 71%)';

type GrainTune = {
  flow: number;
  softness: number;
  intensity: number;
  noise: number;
  swell: number;
  outer: number;
  inner: number;
  beat: number;
  beatRate: number;
  error: number;
};

const TUNE: Record<OrbState, GrainTune> = {
  idle: { flow: 0.45, softness: 0.14, intensity: 0.85, noise: 0.55, swell: 0, outer: 0.3, inner: 0.2, beat: 0, beatRate: 0.3, error: 0 },
  connecting: { flow: 0.5, softness: 0.35, intensity: 0.55, noise: 0.48, swell: 0, outer: 0.1, inner: 0.1, beat: 0.6, beatRate: 0.28, error: 0 },
  listening: { flow: 0.8, softness: 0.12, intensity: 0.7, noise: 0.55, swell: 0, outer: 1, inner: 0.15, beat: 0, beatRate: 0.3, error: 0 },
  thinking: { flow: 0.65, softness: 0.28, intensity: 0.78, noise: 0.55, swell: 0, outer: 0.1, inner: 0.1, beat: 1, beatRate: 0.5, error: 0 },
  speaking: { flow: 1.4, softness: 0.08, intensity: 0.7, noise: 0.6, swell: 0, outer: 0.25, inner: 1, beat: 0, beatRate: 0.3, error: 0 },
  error: { flow: 2, softness: 0.02, intensity: 1, noise: 0.85, swell: 0.35, outer: 0.2, inner: 0.2, beat: 0, beatRate: 0.3, error: 1 },
  disabled: { flow: 0, softness: 0.6, intensity: 0.3, noise: 0.25, swell: 0, outer: 0, inner: 0, beat: 0, beatRate: 0.3, error: 0 },
};

const toShaderColor = ([r, g, b]: Rgb): number[] => [r / 255, g / 255, b / 255, 1];

const livePalette = (colorFrom: string, colorTo: string, errorMix: number): Rgb[] =>
  brandPalette(colorFrom, colorTo).map((stop, index) =>
    mixRgb(hexToRgb(stop), hexToRgb(ERROR_PALETTE[index]), errorMix),
  );

export const GrainOrb = ({
  state = 'idle',
  size = 168,
  speed = 1,
  colorFrom = '#fb923c',
  colorTo = '#e879f9',
  levelRef,
  label = 'Assistant orb',
  className,
  ref,
}: OrbProps) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sphereRef = useRef<HTMLDivElement>(null);
  const shaderRef = useRef<PaperHost | null>(null);
  const clockRef = useRef({ phase: 0, shader: 0, beat: 0, colors: '' });
  const reduced = useReducedMotion();
  const webgl = useWebGLSupport();
  const showShader = webgl === true;
  const [seed] = useState(() => {
    const tune = TUNE[state];
    return { ...tune, colors: livePalette(colorFrom, colorTo, tune.error).map(rgbToHex) };
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
    const swell = clamp01(tune.swell + outer);
    clock.shader += step * (tune.flow + inner * 1.1);
    const errorMix = clamp01(tune.error);
    const shadow = shadeHex(
      rgbToHex(
        mixRgb(
          mixRgb(hexToRgb(colorFrom), hexToRgb(ERROR_COLOR_FROM), errorMix),
          mixRgb(hexToRgb(colorTo), hexToRgb(ERROR_COLOR_TO), errorMix),
          0.5,
        ),
      ),
      0.55,
    );
    if (shadow !== clock.colors) {
      clock.colors = shadow;
      root.style.setProperty('--orb-live-shadow', shadow);
    }
    root.style.setProperty('--orb-level', level.toFixed(4));
    root.style.setProperty('--orb-swell', swell.toFixed(4));
    const mount = shaderRef.current?.paperShaderMount;
    if (!mount) return;
    mount.setUniforms({
      u_colors: livePalette(colorFrom, colorTo, errorMix).map(toShaderColor),
      u_softness: Math.max(0.02, tune.softness - inner * 0.06),
      u_intensity: clamp01(tune.intensity + inner * 0.3),
      u_noise: clamp01(tune.noise + inner * 0.35),
      u_scale: BASE_SCALE + swell * 0.06,
    });
    mount.setFrame(BASE_FRAME + clock.shader * 1000);
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

  const fallbackLayers = [
    { key: 'brand', from: colorFrom, to: colorTo, visible: state !== 'error' },
    { key: 'error', from: ERROR_COLOR_FROM, to: ERROR_COLOR_TO, visible: state === 'error' },
  ].map(({ key, from: f, to: t, visible }) => ({
    key,
    visible,
    base: `conic-gradient(from 210deg at 42% 38%, ${shadeHex(f, 0.5)}, ${f} 18%, ${tintHex(mixHex(f, t, 0.4), 0.6)} 34%, ${mixHex(f, t, 0.6)} 48%, ${t} 62%, ${shadeHex(t, 0.55)} 78%, ${shadeHex(f, 0.5)})`,
    glow: `radial-gradient(circle at 62% 72%, ${tintHex(f, 0.3)}, transparent 45%), radial-gradient(circle at 50% 50%, transparent 52%, ${shadeHex(mixHex(f, t, 0.5), 0.65)} 100%)`,
  }));
  const shadowColor = `var(--orb-live-shadow, ${shadeHex(mixHex(colorFrom, colorTo, 0.5), 0.55)})`;

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
        scale: 'calc(1 + var(--orb-swell, 0) * 0.06)',
        transition: 'opacity 0.6s ease-out, filter 0.6s ease-out',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '18%',
          right: '18%',
          bottom: -size * 0.09,
          height: size * 0.11,
          borderRadius: '50%',
          background: `radial-gradient(ellipse closest-side, color-mix(in oklab, ${shadowColor} 65%, transparent), transparent 78%)`,
          filter: `blur(${(size * 0.015).toFixed(1)}px)`,
          opacity: 'calc(0.42 - var(--orb-swell, 0) * 0.22)',
          scale: 'calc(1 - var(--orb-swell, 0) * 0.12)',
        }}
      />
      <div
        ref={sphereRef}
        style={{
          position: 'absolute',
          inset: 0,
        }}
      >
        {showShader ? (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              maskImage: SPHERE_MASK,
              WebkitMaskImage: SPHERE_MASK,
            }}
          >
            <GrainGradient
              ref={bindShader}
              width={size}
              height={size}
              colors={seed.colors}
              colorBack="#00000000"
              shape="sphere"
              softness={seed.softness}
              intensity={seed.intensity}
              noise={seed.noise}
              scale={BASE_SCALE + seed.swell * 0.06}
              speed={0}
              frame={BASE_FRAME}
              minPixelRatio={MAX_PIXEL_RATIO}
              maxPixelCount={size * size * MAX_PIXEL_RATIO * MAX_PIXEL_RATIO}
              webGlContextAttributes={GL_ATTRIBUTES}
            />
          </div>
        ) : (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              maskImage: 'radial-gradient(circle closest-side, #000 82%, transparent 99%)',
              WebkitMaskImage: 'radial-gradient(circle closest-side, #000 82%, transparent 99%)',
            }}
          >
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
