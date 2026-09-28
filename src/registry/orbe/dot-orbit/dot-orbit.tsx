'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DotOrbit as DotOrbitShader } from '@paper-design/shaders-react';
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
  tintHex(from, 0.35),
  from,
  mixHex(from, to, 0.5),
  to,
  tintHex(to, 0.55),
  '#ffffff',
];

const ERROR_PALETTE = brandPalette(ERROR_COLOR_FROM, ERROR_COLOR_TO);

const GL_ATTRIBUTES: WebGLContextAttributes = {
  antialias: false,
  powerPreference: 'low-power',
};

const BASE_FRAME = 8000;
const STATIC_PHASE = 0.9;
const RING_SCALE = 1.24;
const MAX_PIXEL_RATIO = 2;
const TAU = Math.PI * 2;

type DotTune = {
  flow: number;
  dotSize: number;
  spreading: number;
  outer: number;
  inner: number;
  beat: number;
  beatRate: number;
  error: number;
};

const TUNE: Record<OrbState, DotTune> = {
  idle: { flow: 0.3, dotSize: 0.68, spreading: 0.35, outer: 0.25, inner: 0.2, beat: 0, beatRate: 0.3, error: 0 },
  connecting: { flow: 0.4, dotSize: 0.64, spreading: 0.45, outer: 0.1, inner: 0.1, beat: 0.6, beatRate: 0.28, error: 0 },
  listening: { flow: 0.7, dotSize: 0.62, spreading: 0.45, outer: 1, inner: 0.15, beat: 0, beatRate: 0.3, error: 0 },
  thinking: { flow: 0.65, dotSize: 0.5, spreading: 0.75, outer: 0.1, inner: 0.1, beat: 1, beatRate: 0.5, error: 0 },
  speaking: { flow: 1.1, dotSize: 0.66, spreading: 0.4, outer: 0.25, inner: 1, beat: 0, beatRate: 0.3, error: 0 },
  error: { flow: 1.6, dotSize: 0.85, spreading: 1, outer: 0.2, inner: 0.2, beat: 0, beatRate: 0.3, error: 1 },
  disabled: { flow: 0, dotSize: 0.6, spreading: 0.3, outer: 0, inner: 0, beat: 0, beatRate: 0.3, error: 0 },
};

const toShaderColor = ([r, g, b]: Rgb): number[] => [r / 255, g / 255, b / 255, 1];

const livePalette = (colorFrom: string, colorTo: string, errorMix: number): Rgb[] =>
  brandPalette(colorFrom, colorTo).map((stop, index) =>
    mixRgb(hexToRgb(stop), hexToRgb(ERROR_PALETTE[index]), errorMix),
  );

const coreFor = (f: string, t: string) =>
  `radial-gradient(circle at 50% 40%, ${tintHex(mixHex(f, t, 0.5), 0.45)}, ${mixHex(f, t, 0.55)} 20%, ${shadeHex(f, 0.5)} 52%, ${shadeHex(t, 0.85)} 100%)`;

const coreGlowFor = (f: string, t: string) =>
  `radial-gradient(circle at 50% 40%, ${tintHex(t, 0.8)}, ${tintHex(mixHex(f, t, 0.5), 0.25)} 22%, transparent 46%)`;

export const DotOrbit = ({
  state = 'idle',
  size = 168,
  speed = 1,
  colorFrom = '#60a5fa',
  colorTo = '#c084fc',
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
    clock.shader += step * (tune.flow + outer * 0.6);
    const errorMix = clamp01(tune.error);
    const from = rgbToHex(mixRgb(hexToRgb(colorFrom), hexToRgb(ERROR_COLOR_FROM), errorMix));
    const to = rgbToHex(mixRgb(hexToRgb(colorTo), hexToRgb(ERROR_COLOR_TO), errorMix));
    const colorKey = `${from}${to}`;
    if (colorKey !== clock.colors) {
      clock.colors = colorKey;
      root.style.setProperty('--orb-live-from', from);
      root.style.setProperty('--orb-live-to', to);
      root.style.setProperty('--orb-live-core', coreFor(from, to));
      root.style.setProperty('--orb-live-core-glow', coreGlowFor(from, to));
    }
    root.style.setProperty('--orb-level', level.toFixed(4));
    root.style.setProperty('--orb-outer', clamp01(outer).toFixed(4));
    root.style.setProperty('--orb-inner', clamp01(inner).toFixed(4));
    const mount = shaderRef.current?.paperShaderMount;
    if (!mount) return;
    Reflect.set(mount, 'currentFrame', BASE_FRAME + clock.shader * 1000);
    mount.setUniforms({
      u_colors: livePalette(colorFrom, colorTo, errorMix).map(toShaderColor),
      u_size: clamp01(tune.dotSize + inner * 0.3),
      u_spreading: clamp01(tune.spreading + outer * 0.5 + wave * tune.beat * 0.2),
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

  const liveFrom = `var(--orb-live-from, ${colorFrom})`;
  const liveTo = `var(--orb-live-to, ${colorTo})`;
  const glow = `radial-gradient(circle at 50% 48%, color-mix(in oklab, ${liveFrom} 34%, transparent), color-mix(in oklab, ${liveTo} 18%, transparent) 32%, transparent 58%)`;
  const edgeMask =
    'radial-gradient(ellipse 50% 50% at 50% 50%, black 56%, rgba(0,0,0,0.6) 76%, transparent 96%)';
  const occlusionMask =
    'radial-gradient(ellipse 27% 23% at 50% 41%, transparent 52%, rgba(0,0,0,0.8) 86%, black 100%)';
  const fallbackLayers = [
    { key: 'brand', from: colorFrom, to: colorTo, visible: state !== 'error' },
    { key: 'error', from: ERROR_COLOR_FROM, to: ERROR_COLOR_TO, visible: state === 'error' },
  ].map(({ key, from: f, to: t, visible }) => ({
    key,
    visible,
    base: coreFor(f, t),
    dots: `radial-gradient(circle, #ffffff 24%, transparent 30%), radial-gradient(circle, ${tintHex(t, 0.35)} 26%, transparent 32%), radial-gradient(circle, ${shadeHex(f, 0.35)} 30%, transparent 36%)`,
    glow: `radial-gradient(circle at 50% 40%, ${tintHex(t, 0.6)}, transparent 55%)`,
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
        scale: 'calc(1 + var(--orb-outer, 0) * 0.04 + var(--orb-inner, 0) * 0.02)',
        transition: 'opacity 0.6s ease-out, filter 0.6s ease-out',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: '-24%',
          backgroundImage: glow,
          opacity: 'calc(0.35 + var(--orb-outer, 0) * 0.6 + var(--orb-level, 0) * 0.05)',
          scale: 'calc(1 + var(--orb-outer, 0) * 0.1)',
        }}
      />
      <div
        ref={sphereRef}
        style={{
          position: 'absolute',
          inset: '18%',
          borderRadius: '50%',
          overflow: 'hidden',
          backgroundImage: `var(--orb-live-core, ${coreFor(colorFrom, colorTo)})`,
          scale: 'calc(1 + var(--orb-inner, 0) * 0.05)',
        }}
      >
        {showShader ? (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              backgroundImage: `var(--orb-live-core-glow, ${coreGlowFor(colorFrom, colorTo)})`,
              opacity: 'calc(0.3 + var(--orb-inner, 0) * 0.7)',
            }}
          />
        ) : (
          fallbackLayers.map((layer) => (
            <div
              key={layer.key}
              aria-hidden
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
                  opacity: 'calc(0.25 + var(--orb-inner, 0) * 0.75)',
                }}
              />
            </div>
          ))
        )}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            pointerEvents: 'none',
            backgroundImage:
              'radial-gradient(circle at 32% 24%, rgba(255,255,255,0.35), transparent 14%), radial-gradient(circle at 32% 28%, rgba(255,255,255,0.12), transparent 46%), radial-gradient(circle at 50% 116%, rgba(8,10,20,0.5), transparent 55%)',
          }}
        />
      </div>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: '-12%',
          pointerEvents: 'none',
          maskImage: occlusionMask,
          WebkitMaskImage: occlusionMask,
        }}
      >
        {showShader ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transform: 'rotate(-18deg) scaleY(0.86)',
              scale: 'calc(1 + var(--orb-outer, 0) * 0.1)',
              maskImage: edgeMask,
              WebkitMaskImage: edgeMask,
            }}
          >
            <DotOrbitShader
              ref={bindShader}
              width={size * RING_SCALE}
              height={size * RING_SCALE}
              colors={seed.colors}
              colorBack="#00000000"
              size={seed.dotSize}
              sizeRange={0.4}
              spreading={seed.spreading}
              stepsPerColor={1}
              scale={0.62}
              speed={0}
              frame={BASE_FRAME}
              minPixelRatio={1}
              maxPixelCount={Math.round(size * RING_SCALE * size * RING_SCALE * MAX_PIXEL_RATIO * MAX_PIXEL_RATIO)}
              webGlContextAttributes={GL_ATTRIBUTES}
            />
          </div>
        ) : (
          fallbackLayers.map((layer) => (
            <div
              key={layer.key}
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: layer.dots,
                backgroundSize: `${size * 0.2}px ${size * 0.2}px, ${size * 0.15}px ${size * 0.15}px, ${size * 0.12}px ${size * 0.12}px`,
                backgroundPosition: `0 0, ${size * 0.07}px ${size * 0.08}px, ${size * 0.03}px ${size * 0.12}px`,
                transform: 'rotate(-18deg) scaleY(0.86)',
                scale: 'calc(1 + var(--orb-outer, 0) * 0.1)',
                maskImage: edgeMask,
                WebkitMaskImage: edgeMask,
                opacity: layer.visible ? 'calc(0.6 + var(--orb-outer, 0) * 0.4)' : 0,
                transition: 'opacity 0.35s ease',
              }}
            />
          ))
        )}
      </div>
    </div>
  );
};
