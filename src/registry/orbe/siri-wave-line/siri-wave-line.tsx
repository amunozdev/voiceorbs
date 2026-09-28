'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  ERROR_COLOR_FROM,
  ERROR_COLOR_TO,
  approach,
  blendStates,
  clamp01,
  hexToRgb,
  orbVars,
  type OrbProps,
  type OrbState,
} from '@/registry/lib/orb-state';
import { mixRgb, rgba, type Rgb } from '@/registry/lib/orb-color';
import { useOrbAnimator, type OrbFrame } from '@/registry/lib/use-orb-animator';
import { useReducedMotion } from '@/registry/lib/use-reduced-motion';

const CURVES = 4;
const SAMPLES = 120;
const X_RANGE = 2;

interface WaveParams extends Record<string, number> {
  amp: number;
  ampLevel: number;
  freq: number;
  freqLevel: number;
  flow: number;
  spread: number;
  width: number;
  wobble: number;
  jitter: number;
  line: number;
  dim: number;
  fill: number;
  f0: number;
  f1: number;
  f2: number;
  f3: number;
}

const PARAMS: Record<OrbState, WaveParams> = {
  idle: { amp: 0.035, ampLevel: 0, freq: 1.6, freqLevel: 0, flow: 0.7, spread: 0.35, width: 1.5, wobble: 0.35, jitter: 0, line: 0.6, dim: 1, fill: 0.22, f0: 1, f1: 0.7, f2: 0.5, f3: 0.35 },
  connecting: { amp: 0.26, ampLevel: 0.05, freq: 2.6, freqLevel: 0, flow: 1.4, spread: 0, width: 0.5, wobble: 0.1, jitter: 0, line: 0.45, dim: 0.92, fill: 0.28, f0: 1, f1: 0.3, f2: 0.18, f3: 0.1 },
  listening: { amp: 0.06, ampLevel: 0.5, freq: 2.6, freqLevel: 1.6, flow: 2.4, spread: 0.55, width: 1, wobble: 0.3, jitter: 0, line: 0.35, dim: 1, fill: 0.26, f0: 1, f1: 0.8, f2: 0.65, f3: 0.5 },
  thinking: { amp: 0.22, ampLevel: 0.05, freq: 3.4, freqLevel: 0, flow: 2, spread: 0, width: 0.5, wobble: 0.15, jitter: 0, line: 0.4, dim: 1, fill: 0.28, f0: 1, f1: 0.85, f2: 0.7, f3: 0.55 },
  speaking: { amp: 0.06, ampLevel: 0.6, freq: 2.8, freqLevel: 3.2, flow: 3.4, spread: 1, width: 1.05, wobble: 0.3, jitter: 0, line: 0.25, dim: 1, fill: 0.3, f0: 1, f1: 0.9, f2: 0.8, f3: 0.7 },
  error: { amp: 0.13, ampLevel: 0, freq: 7.5, freqLevel: 0, flow: 4, spread: 0.2, width: 0.55, wobble: 0, jitter: 0.8, line: 0.45, dim: 1, fill: 0.3, f0: 1, f1: 0.8, f2: 0.6, f3: 0.45 },
  disabled: { amp: 0.006, ampLevel: 0, freq: 1.2, freqLevel: 0, flow: 0.2, spread: 0.2, width: 1.8, wobble: 0, jitter: 0, line: 0.35, dim: 0.45, fill: 0.15, f0: 1, f1: 0.3, f2: 0.2, f3: 0.1 },
};

const BASE_CENTER = [-0.35, 0.4, 0.05, -0.7];
const FREQ_MUL = [1, 1.3, 0.75, 1.55];
const FLOW_MUL = [1, 1.2, 0.85, 1.4];
const WOBBLE_RATE = [1.3, 1.7, 2.1, 1.1];
const SEED = [0.3, 2.1, 4.2, 5.4];
const BLACK: Rgb = [0, 0, 0];
const WHITE: Rgb = [255, 255, 255];

const readDark = (): boolean => {
  const cl = document.documentElement.classList;
  if (cl.contains('dark')) return true;
  if (cl.contains('light')) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

const desaturate = (c: Rgb, t: number): Rgb => {
  const g = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  return mixRgb(c, [g, g, g], t);
};

export const SiriWaveLine = ({
  state = 'idle',
  size = 168,
  speed = 1,
  colorFrom = '#22d3ee',
  colorTo = '#e879f9',
  levelRef,
  label = 'Siri Wave Line orb',
  className,
  ref: externalRef,
}: OrbProps) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorRef = useRef({ from: colorFrom, to: colorTo });
  const rendererRef = useRef<((frame: OrbFrame, dt: number) => void) | null>(null);
  const reduced = useReducedMotion();

  const onFrame = useCallback((frame: OrbFrame) => rendererRef.current?.(frame, frame.dt), []);
  const { frameRef } = useOrbAnimator(hostRef, { state, levelRef, speed, onFrame });

  const setHostRef = useCallback(
    (node: HTMLDivElement | null) => {
      hostRef.current = node;
      if (typeof externalRef === 'function') externalRef(node);
      else if (externalRef) externalRef.current = node;
    },
    [externalRef],
  );

  useEffect(() => {
    colorRef.current = { from: colorFrom, to: colorTo };
    rendererRef.current?.(frameRef.current, 0);
  }, [colorFrom, colorTo, frameRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cy = size / 2;
    const pad = size * 0.04;
    const halfH = size * 0.5;
    const unit = size / 168;
    const xs = new Float32Array(SAMPLES);
    const xn = new Float32Array(SAMPLES);
    const edge = new Float32Array(SAMPLES);
    const ys = new Float32Array(SAMPLES);
    for (let j = 0; j < SAMPLES; j += 1) {
      const u = j / (SAMPLES - 1);
      xs[j] = pad + u * (size - pad * 2);
      xn[j] = (u * 2 - 1) * X_RANGE;
      const e = 1 - (u * 2 - 1) ** 2;
      edge[j] = e * e;
    }

    const ampS = new Float32Array(CURVES);
    const centerS = new Float32Array(CURVES);
    const phs = new Float32Array(CURVES);
    for (let i = 0; i < CURVES; i += 1) {
      centerS[i] = BASE_CENTER[i] * 0.35;
      phs[i] = SEED[i];
    }
    const factors = new Float32Array(CURVES);
    const fillStr: string[] = ['', '', '', ''];
    const glowGrad: (CanvasGradient | null)[] = [null, null, null, null];
    const lineGrad: (CanvasGradient | null)[] = [null, null, null, null];
    let baseGrad: CanvasGradient | null = null;
    let freqS = PARAMS.idle.freq;
    let prevPhase = frameRef.current.phase;
    let dark = readDark();
    let lightMix = dark ? 0 : 1;
    let colorKey = '';
    let first = true;

    const errFrom = hexToRgb(ERROR_COLOR_FROM);
    const errTo = hexToRgb(ERROR_COLOR_TO);

    const edgeGradient = (c: Rgb) => {
      const g = ctx.createLinearGradient(pad, 0, size - pad, 0);
      g.addColorStop(0, rgba(c, 0));
      g.addColorStop(0.18, rgba(c, 0.55));
      g.addColorStop(0.5, rgba(c, 1));
      g.addColorStop(0.82, rgba(c, 0.55));
      g.addColorStop(1, rgba(c, 0));
      return g;
    };

    const ensureColors = (errW: number, disW: number) => {
      const { from, to } = colorRef.current;
      const key = `${from}|${to}|${Math.round(errW * 100)}|${Math.round(disW * 100)}|${Math.round(lightMix * 100)}`;
      if (key === colorKey) return;
      colorKey = key;
      const a = mixRgb(hexToRgb(from), errFrom, errW);
      const b = mixRgb(hexToRgb(to), errTo, errW);
      const palette: Rgb[] = [a, b, mixRgb(a, b, 0.5), mixRgb(mixRgb(a, b, 0.25), WHITE, 0.2)];
      for (let i = 0; i < CURVES; i += 1) {
        const base = mixRgb(desaturate(palette[i], disW * 0.8), BLACK, lightMix * 0.2);
        fillStr[i] = rgba(base, 1);
        glowGrad[i] = edgeGradient(base);
        lineGrad[i] = edgeGradient(mixRgb(base, mixRgb(WHITE, BLACK, lightMix), 0.3 - lightMix * 0.12));
      }
      const mid = mixRgb(desaturate(mixRgb(a, b, 0.5), disW * 0.8), BLACK, lightMix * 0.25);
      baseGrad = edgeGradient(mid);
    };

    const render = (frame: OrbFrame, dt: number) => {
      const w = frame.weights;
      const p = blendStates(w, PARAMS);
      const snap = frame.reduced || first;
      first = false;
      const dPhase = frame.phase - prevPhase;
      prevPhase = frame.phase;
      const level = clamp01(frame.level);

      lightMix = frame.reduced ? (dark ? 0 : 1) : approach(lightMix, dark ? 0 : 1, 6, dt);
      ensureColors(clamp01(w.error), clamp01(w.disabled));

      const targetFreq = p.freq + p.freqLevel * level;
      freqS = snap ? targetFreq : approach(freqS, targetFreq, 6, dt);
      factors[0] = p.f0;
      factors[1] = p.f1;
      factors[2] = p.f2;
      factors[3] = p.f3;
      const baseAmp = p.amp + p.ampLevel * level;
      const thinkT = frame.phase * 1.3;
      const sweep = Math.sin(frame.phase * 0.8) * 1.3;

      for (let i = 0; i < CURVES; i += 1) {
        const target = baseAmp * factors[i];
        const rate = target > ampS[i] ? 12 : 5;
        ampS[i] = snap ? target : approach(ampS[i], target, rate, dt);
        const center =
          p.spread * BASE_CENTER[i] +
          w.thinking * Math.sin(thinkT + i * 1.35) * 1.2 +
          w.connecting * sweep;
        centerS[i] = snap ? center : approach(centerS[i], center, 10, dt);
        phs[i] += dPhase * p.flow * FLOW_MUL[i];
      }

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, size, size);

      const dim = p.dim;
      if (baseGrad) {
        ctx.globalAlpha = clamp01(p.line * dim * (1 + lightMix * 0.3));
        ctx.fillStyle = baseGrad;
        ctx.fillRect(pad, cy - 0.5 * unit, size - pad * 2, unit);
      }

      for (let pass = 0; pass < 2; pass += 1) {
        const passW = pass === 0 ? 1 - lightMix : lightMix;
        if (passW < 0.004) continue;
        ctx.globalCompositeOperation = pass === 0 ? 'lighter' : 'source-over';
        const fillBoost = pass === 0 ? 1 : 1.25;
        for (let k = CURVES - 1; k >= 0; k -= 1) {
          const wob = 1 - p.wobble * (0.5 + 0.5 * Math.sin(frame.phase * WOBBLE_RATE[k] + SEED[k]));
          const jit =
            1 +
            p.jitter *
              (0.6 * Math.sin(frame.phase * 31 + k * 1.7) + 0.4 * Math.sin(frame.phase * 47 + k * 2.9));
          const amp = ampS[k] * wob * jit * halfH;
          if (amp < 0.05) continue;
          const width = Math.max(0.2, p.width);
          const c = centerS[k];
          const fk = freqS * FREQ_MUL[k];
          const ph = phs[k];
          for (let j = 0; j < SAMPLES; j += 1) {
            const u = (xn[j] - c) / width;
            const u4 = u * u * u * u;
            const env = 2 / (2 + u4);
            ys[j] = amp * env * env * edge[j] * Math.sin(fk * xn[j] - ph);
          }
          ctx.beginPath();
          ctx.moveTo(xs[0], cy - ys[0]);
          for (let j = 1; j < SAMPLES; j += 1) ctx.lineTo(xs[j], cy - ys[j]);
          for (let j = SAMPLES - 1; j >= 0; j -= 1) ctx.lineTo(xs[j], cy + ys[j]);
          ctx.closePath();

          ctx.globalAlpha = clamp01(p.fill * dim * passW * fillBoost);
          ctx.fillStyle = fillStr[k];
          ctx.fill();

          ctx.globalAlpha = clamp01(0.14 * dim * passW);
          ctx.strokeStyle = glowGrad[k] ?? fillStr[k];
          ctx.lineWidth = 4.5 * unit;
          ctx.stroke();

          ctx.globalAlpha = clamp01(0.85 * dim * passW);
          ctx.strokeStyle = lineGrad[k] ?? fillStr[k];
          ctx.lineWidth = 1.1 * unit;
          ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    };

    const redraw = () => render(frameRef.current, 0);
    const syncTheme = () => {
      dark = readDark();
      redraw();
    };
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    const scheme = window.matchMedia('(prefers-color-scheme: dark)');
    scheme.addEventListener('change', syncTheme);

    rendererRef.current = render;
    redraw();

    return () => {
      rendererRef.current = null;
      observer.disconnect();
      scheme.removeEventListener('change', syncTheme);
    };
  }, [size, frameRef]);

  useEffect(() => {
    if (state !== 'error' || reduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const shake = canvas.animate(
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
      }}
    >
      <canvas ref={canvasRef} aria-hidden style={{ width: size, height: size }} />
    </div>
  );
};
