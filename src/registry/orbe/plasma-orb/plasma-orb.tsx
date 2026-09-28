'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MeshGradient } from '@paper-design/shaders-react';
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
  shadeHex(from, 0.35),
  from,
  mixHex(from, to, 0.5),
  to,
  tintHex(to, 0.35),
];

const ERROR_PALETTE = brandPalette(ERROR_COLOR_FROM, ERROR_COLOR_TO);

const GL_ATTRIBUTES: WebGLContextAttributes = {
  antialias: true,
  powerPreference: 'low-power',
};

const BASE_FRAME = 8000;
const STATIC_PHASE = 0.9;
const MAX_PIXEL_RATIO = 2;
const TAU = Math.PI * 2;

type PlasmaTune = {
  flow: number;
  distortion: number;
  swirl: number;
  grain: number;
  outer: number;
  inner: number;
  beat: number;
  beatRate: number;
  error: number;
};

const TUNE: Record<OrbState, PlasmaTune> = {
  idle: { flow: 0.3, distortion: 0.42, swirl: 0.26, grain: 0.06, outer: 0.2, inner: 0.2, beat: 0, beatRate: 0.3, error: 0 },
  connecting: { flow: 0.4, distortion: 0.4, swirl: 0.4, grain: 0.08, outer: 0.1, inner: 0.1, beat: 0.6, beatRate: 0.28, error: 0 },
  listening: { flow: 0.6, distortion: 0.44, swirl: 0.22, grain: 0.12, outer: 1, inner: 0.15, beat: 0, beatRate: 0.3, error: 0 },
  thinking: { flow: 0.7, distortion: 0.35, swirl: 0.78, grain: 0.1, outer: 0.1, inner: 0.1, beat: 1, beatRate: 0.5, error: 0 },
  speaking: { flow: 1.2, distortion: 0.55, swirl: 0.34, grain: 0.18, outer: 0.3, inner: 1, beat: 0, beatRate: 0.3, error: 0 },
  error: { flow: 1.7, distortion: 0.85, swirl: 0.55, grain: 0.2, outer: 0.2, inner: 0.2, beat: 0, beatRate: 0.3, error: 1 },
  disabled: { flow: 0, distortion: 0.4, swirl: 0.2, grain: 0.04, outer: 0, inner: 0, beat: 0, beatRate: 0.3, error: 0 },
};

const toShaderColor = ([r, g, b]: Rgb): number[] => [r / 255, g / 255, b / 255, 1];

const livePalette = (colorFrom: string, colorTo: string, errorMix: number): Rgb[] =>
  brandPalette(colorFrom, colorTo).map((stop, index) =>
    mixRgb(hexToRgb(stop), hexToRgb(ERROR_PALETTE[index]), errorMix),
  );

export const PlasmaOrb = ({
  state = 'idle',
  size = 160,
  speed = 1,
  colorFrom = '#7c3aed',
  colorTo = '#06b6d4',
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
    clock.shader += step * (tune.flow + inner * 0.9);
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
      u_colors: palette.map(toShaderColor),
      u_distortion: clamp01(tune.distortion + inner * 0.4),
      u_swirl: clamp01(tune.swirl + inner * 0.15 + wave * tune.beat * 0.15),
      u_grainMixer: tune.grain,
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

  const liveFrom = `var(--orb-live-from, ${colorFrom})`;
  const liveTo = `var(--orb-live-to, ${colorTo})`;
  const fallbackLayers = [
    { key: 'brand', from: colorFrom, to: colorTo, visible: state !== 'error' },
    { key: 'error', from: ERROR_COLOR_FROM, to: ERROR_COLOR_TO, visible: state === 'error' },
  ].map(({ key, from: f, to: t, visible }) => ({
    key,
    visible,
    base: `radial-gradient(circle at 50% 40%, ${tintHex(f, 0.12)}, ${mixHex(f, t, 0.55)} 55%, ${shadeHex(t, 0.35)} 100%)`,
    glow: `radial-gradient(circle at 32% 26%, ${tintHex(t, 0.45)}, transparent 55%), radial-gradient(circle at 66% 72%, ${tintHex(f, 0.2)}, transparent 62%)`,
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
        borderRadius: '50%',
        opacity: state === 'disabled' ? 0.5 : 1,
        filter: state === 'disabled' ? 'grayscale(0.85)' : 'grayscale(0)',
        scale: 'calc(1 + var(--orb-outer, 0) * 0.07)',
        transition: 'opacity 0.6s ease-out, filter 0.6s ease-out',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          boxShadow: `0 ${-size * 0.06}px ${size * 0.3}px calc(var(--orb-outer, 0) * ${size * 0.05}px) color-mix(in oklab, ${liveFrom} 55%, transparent), 0 ${size * 0.06}px ${size * 0.3}px calc(var(--orb-outer, 0) * ${size * 0.05}px) color-mix(in oklab, ${liveTo} 55%, transparent)`,
          opacity: 'calc(0.35 + var(--orb-outer, 0) * 0.6 + var(--orb-level, 0) * 0.05)',
        }}
      />
      <div
        ref={sphereRef}
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          overflow: 'hidden',
          boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${liveFrom} 45%, transparent), 0 0 0 1px rgba(255,255,255,0.08)`,
        }}
      >
        {showShader ? (
          <MeshGradient
            ref={bindShader}
            width={size}
            height={size}
            colors={seed.colors}
            distortion={seed.distortion}
            swirl={seed.swirl}
            scale={1.15}
            speed={0}
            frame={BASE_FRAME}
            grainMixer={seed.grain}
            grainOverlay={0.05}
            minPixelRatio={MAX_PIXEL_RATIO}
            maxPixelCount={size * size * MAX_PIXEL_RATIO * MAX_PIXEL_RATIO}
            webGlContextAttributes={GL_ATTRIBUTES}
          />
        ) : (
          <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: '50%' }}>
            {fallbackLayers.map((layer) => (
              <div
                key={layer.key}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  backgroundImage: layer.base,
                  opacity: layer.visible ? 1 : 0,
                  transition: 'opacity 0.35s ease',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    backgroundImage: layer.glow,
                    opacity: 'calc(0.25 + var(--orb-level, 0) * 0.75)',
                  }}
                />
              </div>
            ))}
          </div>
        )}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            pointerEvents: 'none',
            backgroundImage:
              'radial-gradient(circle at 31% 22%, rgba(255,255,255,0.55), transparent 14%), radial-gradient(circle at 30% 26%, rgba(255,255,255,0.28), transparent 48%), radial-gradient(circle at 68% 76%, rgba(10,14,24,0.42), transparent 60%)',
          }}
        />
      </div>
    </div>
  );
};
