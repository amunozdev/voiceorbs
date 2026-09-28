'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LiquidMetal } from '@paper-design/shaders-react';
import {
  approach,
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

type ShaderUniforms = Record<string, number | number[]>;

interface PaperMount {
  setUniforms: (uniforms: ShaderUniforms) => void;
  setFrame: (frame: number) => void;
}

interface PaperHost {
  paperShaderMount?: PaperMount;
}

const GL_ATTRIBUTES: WebGLContextAttributes = {
  antialias: false,
  powerPreference: 'low-power',
};

const BASE_FRAME = 6000;
const STATIC_PHASE = 0.9;
const STRIPE_ANGLE = 70;
const MAX_PIXEL_RATIO = 2;
const REPETITION_RATE = 2.5;
const TAU = Math.PI * 2;

type MercuryTune = {
  flow: number;
  repetition: number;
  distortion: number;
  contour: number;
  softness: number;
  outer: number;
  inner: number;
  beat: number;
  beatRate: number;
  error: number;
};

const TUNE: Record<OrbState, MercuryTune> = {
  idle: { flow: 0.32, repetition: 2.4, distortion: 0.08, contour: 0.42, softness: 0.26, outer: 0.25, inner: 0.2, beat: 0, beatRate: 0.3, error: 0 },
  connecting: { flow: 0.4, repetition: 2.2, distortion: 0.1, contour: 0.36, softness: 0.3, outer: 0.1, inner: 0.1, beat: 0.6, beatRate: 0.28, error: 0 },
  listening: { flow: 0.75, repetition: 2.6, distortion: 0.1, contour: 0.48, softness: 0.16, outer: 1, inner: 0.2, beat: 0, beatRate: 0.3, error: 0 },
  thinking: { flow: 0.6, repetition: 3, distortion: 0.22, contour: 0.55, softness: 0.22, outer: 0.1, inner: 0.1, beat: 1, beatRate: 0.55, error: 0 },
  speaking: { flow: 1.15, repetition: 2.8, distortion: 0.16, contour: 0.52, softness: 0.14, outer: 0.3, inner: 1, beat: 0, beatRate: 0.3, error: 0 },
  error: { flow: 1.6, repetition: 3.6, distortion: 0.55, contour: 0.9, softness: 0.08, outer: 0.2, inner: 0.2, beat: 0, beatRate: 0.3, error: 1 },
  disabled: { flow: 0, repetition: 2, distortion: 0.04, contour: 0.25, softness: 0.4, outer: 0, inner: 0, beat: 0, beatRate: 0.3, error: 0 },
};

const toShaderColor = ([r, g, b]: Rgb): number[] => [r / 255, g / 255, b / 255, 1];

const liveColors = (colorFrom: string, colorTo: string, errorMix: number) => {
  const from = mixRgb(hexToRgb(colorFrom), hexToRgb(ERROR_COLOR_FROM), errorMix);
  const to = mixRgb(hexToRgb(colorTo), hexToRgb(ERROR_COLOR_TO), errorMix);
  const core = rgbToHex(mixRgb(from, to, 0.5));
  return {
    from: rgbToHex(from),
    to: rgbToHex(to),
    back: shadeHex(core, 0.72),
    tint: tintHex(core, 0.2),
  };
};

export const MercuryOrb = ({
  state = 'idle',
  size = 168,
  speed = 1,
  colorFrom = '#cbd5e1',
  colorTo = '#a5b4fc',
  levelRef,
  label = 'Assistant orb',
  className,
  ref,
}: OrbProps) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sphereRef = useRef<HTMLDivElement>(null);
  const shaderRef = useRef<PaperHost | null>(null);
  const clockRef = useRef({ phase: 0, shader: 0, beat: 0, repetition: TUNE[state].repetition, colors: '' });
  const reduced = useReducedMotion();
  const webgl = useWebGLSupport();
  const showShader = webgl === true;
  const [seed] = useState(() => {
    const tune = TUNE[state];
    const colors = liveColors(colorFrom, colorTo, tune.error);
    return { ...tune, ...colors };
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
    clock.shader += step * (tune.flow + inner * 0.6);
    clock.repetition = frame.reduced
      ? tune.repetition
      : approach(clock.repetition, tune.repetition, REPETITION_RATE, frame.dt);
    const errorMix = clamp01(tune.error);
    const colors = liveColors(colorFrom, colorTo, errorMix);
    const colorKey = `${colors.from}${colors.to}${colors.back}`;
    if (colorKey !== clock.colors) {
      clock.colors = colorKey;
      root.style.setProperty('--orb-live-from', colors.from);
      root.style.setProperty('--orb-live-to', colors.to);
      root.style.setProperty('--orb-live-back', colors.back);
    }
    root.style.setProperty('--orb-level', level.toFixed(4));
    root.style.setProperty('--orb-outer', clamp01(outer).toFixed(4));
    const mount = shaderRef.current?.paperShaderMount;
    if (!mount) return;
    Reflect.set(mount, 'currentFrame', BASE_FRAME + clock.shader * 1000);
    mount.setUniforms({
      u_colorBack: toShaderColor(hexToRgb(colors.back)),
      u_colorTint: toShaderColor(hexToRgb(colors.tint)),
      u_repetition: clock.repetition,
      u_softness: tune.softness,
      u_distortion: clamp01(tune.distortion + inner * 0.4),
      u_contour: clamp01(tune.contour + inner * 0.3 + wave * tune.beat * 0.2),
      u_shiftRed: 0.3 + errorMix * 0.3,
      u_shiftBlue: 0.3 - errorMix * 0.3,
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
  const fallbackLayers = [
    { key: 'brand', from: colorFrom, to: colorTo, visible: state !== 'error' },
    { key: 'error', from: ERROR_COLOR_FROM, to: ERROR_COLOR_TO, visible: state === 'error' },
  ].map(({ key, from: f, to: t, visible }) => ({
    key,
    visible,
    base: `radial-gradient(circle at 50% 38%, ${tintHex(f, 0.5)}, ${mixHex(f, t, 0.5)} 45%, ${shadeHex(t, 0.55)} 100%)`,
    sheen: `conic-gradient(from 210deg at 50% 50%, transparent 0deg, ${tintHex(t, 0.65)} 40deg, transparent 90deg, ${tintHex(f, 0.4)} 180deg, transparent 240deg, ${tintHex(t, 0.5)} 300deg, transparent 360deg)`,
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
        scale: 'calc(1 + var(--orb-outer, 0) * 0.06)',
        transition: 'opacity 0.6s ease-out, filter 0.6s ease-out',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          boxShadow: `0 ${-size * 0.05}px ${size * 0.28}px calc(var(--orb-outer, 0) * ${size * 0.04}px) color-mix(in oklab, ${liveFrom} 50%, transparent), 0 ${size * 0.05}px ${size * 0.28}px calc(var(--orb-outer, 0) * ${size * 0.04}px) color-mix(in oklab, ${liveTo} 50%, transparent)`,
          opacity: 'calc(0.3 + var(--orb-outer, 0) * 0.6 + var(--orb-level, 0) * 0.1)',
        }}
      />
      <div
        ref={sphereRef}
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          overflow: 'hidden',
          backgroundColor: `var(--orb-live-back, ${seed.back})`,
          boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${liveFrom} 40%, transparent), 0 0 0 1px rgba(255,255,255,0.08)`,
        }}
      >
        {showShader ? (
          <LiquidMetal
            ref={bindShader}
            width={size}
            height={size}
            shape="circle"
            scale={1.05}
            colorBack={seed.back}
            colorTint={seed.tint}
            repetition={seed.repetition}
            softness={seed.softness}
            shiftRed={0.3 + seed.error * 0.3}
            shiftBlue={0.3 - seed.error * 0.3}
            distortion={seed.distortion}
            contour={seed.contour}
            angle={STRIPE_ANGLE}
            speed={0}
            frame={BASE_FRAME}
            minPixelRatio={1}
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
                    backgroundImage: layer.sheen,
                    opacity: 'calc(0.2 + var(--orb-level, 0) * 0.7)',
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
              'radial-gradient(circle at 30% 22%, rgba(255,255,255,0.5), transparent 16%), radial-gradient(circle at 32% 28%, rgba(255,255,255,0.22), transparent 46%), radial-gradient(circle at 68% 78%, rgba(8,12,20,0.45), transparent 58%)',
          }}
        />
      </div>
    </div>
  );
};
