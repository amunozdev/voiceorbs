'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Dithering } from '@paper-design/shaders-react';
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

type ShaderUniforms = Record<string, number | number[]>;

interface PaperMount {
  setUniforms: (uniforms: ShaderUniforms) => void;
  setFrame: (frame: number) => void;
}

interface PaperHost {
  paperShaderMount?: PaperMount;
}

const GL_ATTRIBUTES: WebGLContextAttributes = {
  antialias: true,
  alpha: true,
  premultipliedAlpha: true,
  powerPreference: 'low-power',
};

const CANVAS_OVERDRAW = 1.18;
const TRANSPARENT = '#00000000';
const DOT_PX = 2.8;
const BASE_FRAME = 6000;
const STATIC_PHASE = 0.9;
const MAX_PIXEL_RATIO = 2;
const TAU = Math.PI * 2;

type DitherTune = {
  flow: number;
  shift: number;
  pulse: number;
  outer: number;
  inner: number;
  beat: number;
  beatRate: number;
  error: number;
};

const TUNE: Record<OrbState, DitherTune> = {
  idle: { flow: 0.25, shift: 0.3, pulse: 0.9, outer: 0.25, inner: 0.2, beat: 0, beatRate: 0.3, error: 0 },
  connecting: { flow: 0.35, shift: 0.36, pulse: 0.89, outer: 0.1, inner: 0.1, beat: 0.6, beatRate: 0.28, error: 0 },
  listening: { flow: 0.55, shift: 0.3, pulse: 0.9, outer: 1, inner: 0.15, beat: 0, beatRate: 0.3, error: 0 },
  thinking: { flow: 0.6, shift: 0.55, pulse: 0.9, outer: 0.1, inner: 0.1, beat: 1, beatRate: 0.5, error: 0 },
  speaking: { flow: 1.1, shift: 0.42, pulse: 0.92, outer: 0.25, inner: 1, beat: 0, beatRate: 0.3, error: 0 },
  error: { flow: 1.6, shift: 0.5, pulse: 0.95, outer: 0.2, inner: 0.2, beat: 0, beatRate: 0.3, error: 1 },
  disabled: { flow: 0, shift: 0.3, pulse: 0.88, outer: 0, inner: 0, beat: 0, beatRate: 0.3, error: 0 },
};

const toShaderColor = ([r, g, b]: Rgb): number[] => [r / 255, g / 255, b / 255, 1];

const liveColors = (colorFrom: string, colorTo: string, errorMix: number, shift: number) => {
  const from = mixRgb(hexToRgb(colorFrom), hexToRgb(ERROR_COLOR_FROM), errorMix);
  const to = mixRgb(hexToRgb(colorTo), hexToRgb(ERROR_COLOR_TO), errorMix);
  return { front: shadeHex(rgbToHex(mixRgb(from, to, clamp01(shift))), 0.08) };
};

export const DitherOrb = ({
  state = 'idle',
  size = 168,
  speed = 1,
  colorFrom = '#a3e635',
  colorTo = '#22d3ee',
  levelRef,
  label = 'Assistant orb',
  className,
  ref,
}: OrbProps) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sphereRef = useRef<HTMLDivElement>(null);
  const shaderRef = useRef<PaperHost | null>(null);
  const clockRef = useRef({ phase: 0, shader: 0, beat: 0 });
  const reduced = useReducedMotion();
  const webgl = useWebGLSupport();
  const showShader = webgl === true;
  const [seed] = useState(() => {
    const tune = TUNE[state];
    return { ...tune, ...liveColors(colorFrom, colorTo, tune.error, tune.shift) };
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
    const pulse = Math.min(1.1, tune.pulse + outer * 0.16);
    root.style.setProperty('--orb-level', level.toFixed(4));
    root.style.setProperty('--orb-outer', clamp01(outer).toFixed(4));
    const mount = shaderRef.current?.paperShaderMount;
    if (!mount) return;
    const { front } = liveColors(colorFrom, colorTo, clamp01(tune.error), tune.shift + inner * 0.45);
    mount.setUniforms({
      u_colorFront: toShaderColor(hexToRgb(front)),
      u_scale: pulse / CANVAS_OVERDRAW,
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

  const canvasSize = Math.round(size * CANVAS_OVERDRAW);
  const canvasOffset = Math.round((size - canvasSize) / 2);
  const fallbackLayers = [
    { key: 'brand', from: colorFrom, to: colorTo, visible: state !== 'error' },
    { key: 'error', from: ERROR_COLOR_FROM, to: ERROR_COLOR_TO, visible: state === 'error' },
  ].map(({ key, from: f, to: t, visible }) => ({
    key,
    visible,
    body: `radial-gradient(circle, ${shadeHex(mixHex(f, t, 0.5), 0.3)} 1.5px, transparent 2.1px)`,
    glint: `radial-gradient(circle, ${tintHex(t, 0.2)} 1px, transparent 1.6px)`,
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
        scale: showShader ? undefined : 'calc(1 + var(--orb-outer, 0) * 0.08)',
        transition: 'opacity 0.6s ease-out, filter 0.6s ease-out',
      }}
    >
      <div
        ref={sphereRef}
        style={{
          position: 'absolute',
          inset: 0,
        }}
      >
        {showShader ? (
          <div
            style={{
              position: 'absolute',
              top: canvasOffset,
              left: canvasOffset,
              width: canvasSize,
              height: canvasSize,
            }}
          >
            <Dithering
              ref={bindShader}
              width={canvasSize}
              height={canvasSize}
              colorBack={TRANSPARENT}
              colorFront={seed.front}
              shape="sphere"
              type="4x4"
              size={DOT_PX}
              scale={seed.pulse / CANVAS_OVERDRAW}
              speed={0}
              frame={BASE_FRAME}
              fit="cover"
              minPixelRatio={MAX_PIXEL_RATIO}
              maxPixelCount={canvasSize * canvasSize * MAX_PIXEL_RATIO * MAX_PIXEL_RATIO}
              webGlContextAttributes={GL_ATTRIBUTES}
            />
          </div>
        ) : (
          <div aria-hidden style={{ position: 'absolute', inset: 0 }}>
            {fallbackLayers.map((layer) => (
              <div
                key={layer.key}
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: layer.visible ? 1 : 0,
                  transition: 'opacity 0.35s ease',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: layer.body,
                    backgroundSize: '5px 5px',
                    maskImage:
                      'radial-gradient(circle at 50% 50%, black 42%, rgba(0,0,0,0.55) 58%, rgba(0,0,0,0.18) 68%, transparent 76%)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: layer.glint,
                    backgroundSize: '6px 6px',
                    maskImage:
                      'radial-gradient(circle at 36% 30%, black 12%, rgba(0,0,0,0.4) 32%, transparent 55%)',
                    opacity: 'calc(0.35 + var(--orb-level, 0) * 0.65)',
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
