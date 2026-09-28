'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  blendStates,
  clamp01,
  ERROR_COLOR_FROM,
  ERROR_COLOR_TO,
  hexToRgb,
  orbVars,
  type OrbProps,
  type OrbState,
} from '../../lib/orb-state';
import { mixRgb, rgba, type Rgb } from '../../lib/orb-color';
import { useOrbAnimator, type OrbFrame } from '../../lib/use-orb-animator';

const PARTICLE_COUNT = 720;
const TWO_PI = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const TIME_OFFSET = 1.7;
const TONE_BUCKETS = 6;
const ALPHA_BUCKETS = 10;
const BUCKETS = TONE_BUCKETS * ALPHA_BUCKETS;
const ANGLE_X = 0.32;

const ERROR_FROM_RGB = hexToRgb(ERROR_COLOR_FROM);
const ERROR_TO_RGB = hexToRgb(ERROR_COLOR_TO);

type StateParams = {
  tempo: number;
  spin: number;
  breathe: number;
  drift: number;
  ripple: number;
  swell: number;
  flow: number;
  swirl: number;
  pulse: number;
  pulseRate: number;
  ring: number;
  jitter: number;
  shake: number;
  alpha: number;
  rest: number;
};

const STATES: Record<OrbState, StateParams> = {
  idle: { tempo: 1, spin: 0.14, breathe: 0.05, drift: 1, ripple: 0, swell: 0.04, flow: 0, swirl: 0, pulse: 0, pulseRate: 1, ring: 0, jitter: 0, shake: 0, alpha: 0.72, rest: 0 },
  connecting: { tempo: 1, spin: 0.3, breathe: 0.02, drift: 0.2, ripple: 0, swell: 0, flow: 0, swirl: 0, pulse: 0.06, pulseRate: 0.5, ring: 1, jitter: 0, shake: 0, alpha: 0.8, rest: 0.12 },
  listening: { tempo: 1, spin: 0.55, breathe: 0.012, drift: 0, ripple: 1, swell: 0.12, flow: 0, swirl: 0, pulse: 0, pulseRate: 1, ring: 0, jitter: 0, shake: 0, alpha: 0.92, rest: 0.55 },
  thinking: { tempo: 1, spin: 0.32, breathe: 0.01, drift: 0, ripple: 0, swell: 0, flow: 0, swirl: 0, pulse: 1, pulseRate: 1, ring: 0, jitter: 0, shake: 0, alpha: 0.78, rest: 0.3 },
  speaking: { tempo: 1, spin: 0.24, breathe: 0.01, drift: 0, ripple: 0, swell: 0.06, flow: 1, swirl: 1, pulse: 0, pulseRate: 1, ring: 0, jitter: 0.6, shake: 0, alpha: 0.94, rest: 0.55 },
  error: { tempo: 1, spin: 0.08, breathe: 0, drift: 0, ripple: 0, swell: 0, flow: 0, swirl: 0, pulse: 0, pulseRate: 1, ring: 0, jitter: 0.7, shake: 1, alpha: 0.85, rest: 0.2 },
  disabled: { tempo: 0.04, spin: 0, breathe: 0, drift: 0, ripple: 0, swell: 0, flow: 0, swirl: 0, pulse: 0, pulseRate: 1, ring: 0, jitter: 0, shake: 0, alpha: 0.45, rest: 0 },
};

interface Sphere {
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  ringFrac: Float32Array;
  seed: Float32Array;
  toneBucket: Uint8Array;
  tone: Float32Array;
}

const buildSphere = (count: number): Sphere => {
  const sphere: Sphere = {
    x: new Float32Array(count),
    y: new Float32Array(count),
    z: new Float32Array(count),
    ringFrac: new Float32Array(count),
    seed: new Float32Array(count),
    toneBucket: new Uint8Array(count),
    tone: new Float32Array(count),
  };
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / (count - 1)) * 2;
    const radiusAtY = Math.sqrt(1 - y * y);
    const theta = GOLDEN_ANGLE * i;
    const tone = (i * 0.5436890126) % 1;
    sphere.x[i] = Math.cos(theta) * radiusAtY;
    sphere.y[i] = y;
    sphere.z[i] = Math.sin(theta) * radiusAtY;
    sphere.ringFrac[i] = (i * 0.61803398875) % 1;
    sphere.seed[i] = ((i * 0.7548776662) % 1) * TWO_PI;
    sphere.tone[i] = tone;
    sphere.toneBucket[i] = Math.min(TONE_BUCKETS - 1, Math.floor(tone * TONE_BUCKETS));
  }
  return sphere;
};

const SPHERE = buildSphere(PARTICLE_COUNT);

export const ParticlesOrb = ({
  state = 'idle',
  size = 168,
  speed = 1,
  colorFrom = '#f0abfc',
  colorTo = '#818cf8',
  levelRef,
  label = 'Assistant orb',
  className,
  ref: forwardedRef,
}: OrbProps) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorRef = useRef({ from: colorFrom, to: colorTo });
  const drawRef = useRef<((frame: OrbFrame) => void) | null>(null);

  const setHostRef = useCallback(
    (node: HTMLDivElement | null) => {
      hostRef.current = node;
      if (typeof forwardedRef === 'function') {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    },
    [forwardedRef],
  );

  const onFrame = useCallback((frame: OrbFrame) => drawRef.current?.(frame), []);
  const { frameRef } = useOrbAnimator(hostRef, { state, levelRef, speed, onFrame });

  useEffect(() => {
    colorRef.current = { from: colorFrom, to: colorTo };
    drawRef.current?.({ ...frameRef.current, dt: 0 });
  }, [colorFrom, colorTo, frameRef]);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const center = size / 2;
    const smallness = Math.min(1, size / 140);
    const dotScale = 0.55 + 0.45 * smallness;
    const alphaScale = smallness * smallness;
    const baseRadius = center * 0.62;
    const n = PARTICLE_COUNT;
    const px = new Float32Array(n);
    const py = new Float32Array(n);
    const pr = new Float32Array(n);
    const bucketOf = new Uint8Array(n);
    const order = new Uint16Array(n);
    const counts = new Uint16Array(BUCKETS);
    const starts = new Uint16Array(BUCKETS);
    const toneStyles: string[] = new Array<string>(TONE_BUCKETS).fill('#fff');

    let paletteKey = '';
    let baseFrom: Rgb = [255, 255, 255];
    let baseTo: Rgb = [255, 255, 255];
    let lastPhase = frameRef.current.phase;
    let lastLevelText = '';
    let clock = 0;
    let pulseClock = 0;
    let angleY = 0;
    let ringPhase = 0;

    const ensurePalette = (errorW: number) => {
      const { from, to } = colorRef.current;
      const errKey = Math.round(errorW * 64);
      const key = `${from}|${to}|${errKey}`;
      if (key === paletteKey) return;
      paletteKey = key;
      baseFrom = hexToRgb(from);
      baseTo = hexToRgb(to);
      const e = errKey / 64;
      const f = mixRgb(baseFrom, ERROR_FROM_RGB, e);
      const t = mixRgb(baseTo, ERROR_TO_RGB, e);
      for (let b = 0; b < TONE_BUCKETS; b += 1) {
        toneStyles[b] = rgba(mixRgb(f, t, (b + 0.5) / TONE_BUCKETS), 1);
      }
    };

    const draw = (frame: OrbFrame) => {
      const w = frame.weights;
      const p = blendStates(w, STATES);
      const dPhase = Math.max(0, frame.phase - lastPhase);
      lastPhase = frame.phase;
      const level = frame.reduced ? p.rest : frame.level;
      const levelText = frame.level.toFixed(3);
      if (levelText !== lastLevelText) {
        lastLevelText = levelText;
        host.style.setProperty('--orb-level', levelText);
      }

      clock += dPhase * p.tempo;
      pulseClock += dPhase * p.tempo * p.pulseRate;
      angleY += dPhase * p.spin * (1 + p.ripple * level * 1.8);
      ringPhase = (ringPhase + dPhase * 0.7) % TWO_PI;
      const t = clock + TIME_OFFSET;
      const pt = pulseClock + TIME_OFFSET;

      const beat = Math.sin(pt * 2.6) * 0.5 + 0.5;
      const beatSharp = beat * beat * beat;
      const breathe = p.breathe * Math.sin(t * 1.1);
      const conv = p.pulse * (0.06 + 0.12 * beatSharp);
      const radius = baseRadius * (1 + breathe + level * p.swell - conv);

      const shakeAmp = p.shake * radius * 0.05;
      const shakeX = shakeAmp * (Math.sin(t * 26) + 0.5 * Math.sin(t * 15.7));
      const shakeY = shakeAmp * (Math.cos(t * 22.5) + 0.5 * Math.sin(t * 13.1));

      const driftAmp = p.drift * radius * 0.055;
      const jitterAmp = p.jitter * radius * (0.012 + level * 0.07);
      const rippleAmp = p.ripple * (0.04 + level * 0.22);
      const pulseAmp = p.pulse * 0.16 * (0.4 + 0.6 * beat);
      const flowAmp = p.flow * (0.18 + level * 0.4);
      const swirlAmp = p.swirl * (0.35 + level * 0.9);
      const ringW = clamp01(p.ring);
      const ringBreath = 1 + p.pulse * 0.4 * Math.sin(pt * 2.6);

      const cosX = Math.cos(ANGLE_X);
      const sinX = Math.sin(ANGLE_X);
      counts.fill(0);

      for (let i = 0; i < n; i += 1) {
        const sx = SPHERE.x[i];
        const sy = SPHERE.y[i];
        const sz = SPHERE.z[i];
        const seed = SPHERE.seed[i];
        const ringFrac = SPHERE.ringFrac[i];

        const twist = swirlAmp > 0.002 ? angleY + swirlAmp * Math.sin(sy * 2.4 + t * 1.6) : angleY;
        const cy = Math.cos(twist);
        const sny = Math.sin(twist);
        const x1 = sx * cy - sz * sny;
        const z1 = sx * sny + sz * cy;
        const y1 = sy * cosX - z1 * sinX;
        const z2 = sy * sinX + z1 * cosX;

        const depth = (z2 + 1) / 2;
        const perspective = 0.65 + depth * 0.45;

        let pointRadius = radius;
        if (rippleAmp > 0.002) {
          pointRadius *= 1 + rippleAmp * (0.5 + 0.5 * Math.sin(sy * 4.5 - t * 6.5));
        }
        if (pulseAmp > 0.002) {
          pointRadius *= 1 - pulseAmp * (0.5 + 0.5 * Math.sin(ringFrac * TWO_PI + pt * 3.1));
        }
        if (flowAmp > 0.002) {
          const stream = 0.5 + 0.5 * Math.sin(seed * 3 - t * 3.4);
          pointRadius *= 1 - flowAmp * stream * stream;
        }

        let ox = shakeX;
        let oy = shakeY;
        if (driftAmp > 0.01) {
          ox += driftAmp * (Math.sin(t * 0.55 + seed * 3.7) + 0.5 * Math.sin(t * 1.3 + seed * 1.3));
          oy += driftAmp * (Math.cos(t * 0.62 + seed * 2.9) + 0.5 * Math.sin(t * 1.05 + seed * 5.1));
        }
        if (jitterAmp > 0.01) {
          ox += jitterAmp * Math.sin(t * 14 + seed * 9.3);
          oy += jitterAmp * Math.cos(t * 17 + seed * 6.1);
        }

        let screenX = center + x1 * pointRadius * perspective + ox;
        let screenY = center + y1 * pointRadius * perspective + oy;
        let alpha = 0.12 + depth * depth * 0.78;
        let dot = 0.6 + depth * 1.5;

        if (ringW > 0.004) {
          const tone = SPHERE.tone[i];
          const ringAngle = (i / n) * TWO_PI + ringPhase + 0.05 * Math.sin(t * 1.3 + seed);
          const ringR =
            center * (0.58 + 0.13 * ringFrac) * (1 + 0.05 * Math.sin(t + seed * 1.7)) * ringBreath;
          const circleX = center + Math.cos(ringAngle) * ringR;
          const circleY = center + Math.sin(ringAngle) * ringR;
          screenX += (circleX - screenX) * ringW;
          screenY += (circleY - screenY) * ringW;
          alpha += (0.35 + tone * 0.5 - alpha) * ringW;
          dot += (0.75 + tone * 0.9 - dot) * ringW;
        }

        px[i] = screenX;
        py[i] = screenY;
        pr[i] = dot * dotScale;
        alpha *= alphaScale;
        const ab = Math.min(ALPHA_BUCKETS - 1, Math.floor(alpha * ALPHA_BUCKETS));
        const b = SPHERE.toneBucket[i] * ALPHA_BUCKETS + ab;
        bucketOf[i] = b;
        counts[b] += 1;
      }

      let acc = 0;
      for (let b = 0; b < BUCKETS; b += 1) {
        starts[b] = acc;
        acc += counts[b];
      }
      for (let i = 0; i < n; i += 1) {
        const b = bucketOf[i];
        order[starts[b]] = i;
        starts[b] += 1;
      }

      ensurePalette(w.error);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      ctx.globalCompositeOperation = 'lighter';

      let cursor = 0;
      for (let b = 0; b < BUCKETS; b += 1) {
        const count = counts[b];
        if (count === 0) continue;
        const ab = b % ALPHA_BUCKETS;
        ctx.globalAlpha = clamp01(((ab + 0.5) / ALPHA_BUCKETS) * p.alpha);
        ctx.fillStyle = toneStyles[(b - ab) / ALPHA_BUCKETS];
        ctx.beginPath();
        for (let k = cursor; k < cursor + count; k += 1) {
          const i = order[k];
          ctx.moveTo(px[i] + pr[i], py[i]);
          ctx.arc(px[i], py[i], pr[i], 0, TWO_PI);
        }
        ctx.fill();
        cursor += count;
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    };

    drawRef.current = draw;
    draw({ ...frameRef.current, dt: 0 });

    return () => {
      drawRef.current = null;
    };
  }, [size, frameRef]);

  return (
    <div
      ref={setHostRef}
      role="img"
      aria-label={label}
      data-state={state}
      className={className}
      style={{
        ...orbVars({ size, speed, colorFrom, colorTo }),
        width: size,
        height: size,
        display: 'grid',
        placeItems: 'center',
        opacity: state === 'disabled' ? 0.5 : 1,
        filter: state === 'disabled' ? 'grayscale(0.85)' : 'grayscale(0)',
        transition: 'opacity 0.4s ease, filter 0.4s ease',
      }}
    >
      <canvas ref={canvasRef} style={{ width: size, height: size }} />
    </div>
  );
};
