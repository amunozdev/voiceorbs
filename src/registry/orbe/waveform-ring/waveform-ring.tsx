'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  approach,
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
import { useWaveform } from '../../lib/use-waveform';

const TWO_PI = Math.PI * 2;
const SEGMENTS = 160;
const COLOR_BUCKETS = 16;
const ALPHA_BUCKETS = 6;
const BUCKETS = COLOR_BUCKETS * ALPHA_BUCKETS;
const TIME_OFFSET = 4.2;
const LIVE_FADE_RATE = 12;

const ERR_FROM = hexToRgb(ERROR_COLOR_FROM);
const ERR_TO = hexToRgb(ERROR_COLOR_TO);
const ERR_MID = mixRgb(ERR_FROM, ERR_TO, 0.5);

type StateParams = {
  tempo: number;
  amp: number;
  levelAmp: number;
  bias: number;
  breathe: number;
  contract: number;
  echo: number;
  echoRate: number;
  dash: number;
  liveGain: number;
  core: number;
  coreGain: number;
  glowGain: number;
  lineGain: number;
  rest: number;
};

const STATES: Record<OrbState, StateParams> = {
  idle: { tempo: 1, amp: 0.03, levelAmp: 0, bias: 0, breathe: 0.02, contract: 0, echo: 0, echoRate: 1, dash: 0, liveGain: 0.5, core: 0.5, coreGain: 0.2, glowGain: 0.3, lineGain: 0.4, rest: 0 },
  connecting: { tempo: 1, amp: 0.04, levelAmp: 0, bias: 0, breathe: 0.01, contract: 0.5, echo: 0.55, echoRate: 0.5, dash: 1, liveGain: 0.2, core: 0.45, coreGain: 0.2, glowGain: 0.3, lineGain: 0.3, rest: 0.12 },
  listening: { tempo: 1, amp: 0.1, levelAmp: 0.14, bias: 0.85, breathe: 0, contract: 0, echo: 0, echoRate: 1, dash: 0, liveGain: 1, core: 0.35, coreGain: 0.15, glowGain: 1.4, lineGain: 1.2, rest: 0.6 },
  thinking: { tempo: 1, amp: 0.05, levelAmp: 0, bias: 0, breathe: 0, contract: 1, echo: 1, echoRate: 1, dash: 0, liveGain: 0.25, core: 0.5, coreGain: 0.3, glowGain: 0.4, lineGain: 0.4, rest: 0.3 },
  speaking: { tempo: 1, amp: 0.1, levelAmp: 0.12, bias: -0.55, breathe: 0, contract: 0, echo: 0, echoRate: 1, dash: 0, liveGain: 0.6, core: 0.55, coreGain: 0.9, glowGain: 0.5, lineGain: 0.8, rest: 0.6 },
  error: { tempo: 1, amp: 0.11, levelAmp: 0, bias: 0, breathe: 0, contract: 0, echo: 0, echoRate: 1, dash: 0, liveGain: 0.1, core: 0.5, coreGain: 0.2, glowGain: 0.3, lineGain: 0.3, rest: 0.2 },
  disabled: { tempo: 0.04, amp: 0.008, levelAmp: 0, bias: 0, breathe: 0, contract: 0, echo: 0, echoRate: 1, dash: 0, liveGain: 0, core: 0.28, coreGain: 0, glowGain: 0, lineGain: 0, rest: 0 },
};

const SEG_COLOR = new Uint8Array(SEGMENTS);
for (let i = 0; i < SEGMENTS; i += 1) {
  const u = (i + 0.5) / SEGMENTS;
  const g = u < 0.5 ? u * 2 : (1 - u) * 2;
  SEG_COLOR[i] = Math.min(COLOR_BUCKETS - 1, Math.floor(g * COLOR_BUCKETS));
}

const jag = (u: number, t: number) =>
  Math.sign(Math.sin(TWO_PI * 19 * u + t * 1.9)) *
  (0.5 + 0.5 * Math.abs(Math.sin(TWO_PI * 7 * u - t * 2.4)));

const sampleWave = (u: number, data: Uint8Array): number => {
  const m = u < 0.5 ? u * 2 : (1 - u) * 2;
  const pos = m * (data.length - 1);
  const i0 = Math.floor(pos);
  const i1 = Math.min(i0 + 1, data.length - 1);
  const f = pos - i0;
  const v = data[i0] + (data[i1] - data[i0]) * f;
  return Math.max(-1, Math.min(1, ((v - 128) / 128) * 1.6));
};

export const WaveformRing = ({
  state = 'idle',
  size = 168,
  speed = 1,
  colorFrom = '#2dd4bf',
  colorTo = '#38bdf8',
  levelRef,
  label = 'Waveform Ring orb',
  className,
  ref: externalRef,
}: OrbProps) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorRef = useRef({ from: colorFrom, to: colorTo });
  const drawRef = useRef<((frame: OrbFrame) => void) | null>(null);
  const liveRef = useRef(false);
  const [live, setLive] = useState(false);

  const { samplesRef } = useWaveform(live);

  const setHostRef = useCallback(
    (node: HTMLDivElement | null) => {
      hostRef.current = node;
      if (typeof externalRef === 'function') externalRef(node);
      else if (externalRef) externalRef.current = node;
    },
    [externalRef],
  );

  const onFrame = useCallback((frame: OrbFrame) => {
    if (frame.live !== liveRef.current) {
      liveRef.current = frame.live;
      setLive(frame.live);
    }
    drawRef.current?.(frame);
  }, []);

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

    const cx = size / 2;
    const R = size * 0.355;

    const makeCore = (col: Rgb) => {
      const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, R);
      g.addColorStop(0, rgba(col, 0.3));
      g.addColorStop(0.68, rgba(col, 0.1));
      g.addColorStop(1, rgba(col, 0));
      return g;
    };
    const errCoreG = makeCore(ERR_MID);

    let paletteKey = '';
    let colorKey = '';
    let from: Rgb = [255, 255, 255];
    let to: Rgb = [255, 255, 255];
    let mid: Rgb = [255, 255, 255];
    let coreG: CanvasGradient | null = null;
    let echoStyle = '#fff';
    const colorStyles: string[] = new Array<string>(COLOR_BUCKETS).fill('#fff');

    const ensurePalette = (errorW: number) => {
      const key = `${colorRef.current.from}|${colorRef.current.to}`;
      if (key !== paletteKey) {
        paletteKey = key;
        from = hexToRgb(colorRef.current.from);
        to = hexToRgb(colorRef.current.to);
        mid = mixRgb(from, to, 0.5);
        coreG = makeCore(mid);
      }
      const errStep = Math.round(errorW * 64);
      const nextColorKey = `${key}|${errStep}`;
      if (nextColorKey === colorKey) return;
      colorKey = nextColorKey;
      const e = errStep / 64;
      for (let b = 0; b < COLOR_BUCKETS; b += 1) {
        const g = (b + 0.5) / COLOR_BUCKETS;
        const base = mixRgb(from, to, g);
        colorStyles[b] = rgba(e > 0 ? mixRgb(base, mixRgb(ERR_FROM, ERR_TO, g), e) : base, 1);
      }
      echoStyle = rgba(mixRgb(mid, ERR_MID, e), 1);
    };

    const xs = new Float32Array(SEGMENTS + 1);
    const ys = new Float32Array(SEGMENTS + 1);
    const wave = new Float32Array(SEGMENTS + 1);
    const bucketOf = new Uint8Array(SEGMENTS);
    const counts = new Uint16Array(BUCKETS);
    const starts = new Uint16Array(BUCKETS);
    const order = new Uint16Array(SEGMENTS);

    let lastPhase = frameRef.current.phase;
    let lastLevelText = '';
    let clock = 0;
    let echoClock = 0;
    let rot = 0;
    let liveFade = 0;

    const draw = (frame: OrbFrame) => {
      const w = frame.weights;
      const p = blendStates(w, STATES);
      const dPhase = Math.max(0, frame.phase - lastPhase);
      lastPhase = frame.phase;
      const levelText = frame.level.toFixed(3);
      if (levelText !== lastLevelText) {
        lastLevelText = levelText;
        host.style.setProperty('--orb-level', levelText);
      }
      const level = clamp01(frame.reduced ? p.rest : frame.level);

      clock += dPhase * p.tempo;
      echoClock += dPhase * p.tempo * p.echoRate * 0.45;
      rot += dPhase * 2.8 * p.tempo;
      const t = clock + TIME_OFFSET;

      const data = samplesRef.current;
      const hasWave = frame.live && data.length > 0;
      if (hasWave) {
        for (let i = 0; i <= SEGMENTS; i += 1) wave[i] = sampleWave(i / SEGMENTS, data);
      }
      const fadeTarget = hasWave ? 1 : 0;
      liveFade = frame.reduced ? fadeTarget : approach(liveFade, fadeTarget, LIVE_FADE_RATE, frame.dt);
      if (liveFade < 0.001) liveFade = 0;
      const liveMix = clamp01(liveFade * p.liveGain);

      const amp = p.amp + level * p.levelAmp;
      const breathe = 1 + p.breathe * Math.sin(t * 1.1) + level * 0.02;
      const contract = 1 - p.contract * (0.05 + 0.05 * Math.sin((echoClock + TIME_OFFSET) * 5.8));
      const baseR = R * breathe * contract;
      const bias = p.bias;
      const absBias = Math.abs(bias);
      const dashW = clamp01(p.dash);

      for (let i = 0; i <= SEGMENTS; i += 1) {
        const u = i / SEGMENTS;
        const theta = u * TWO_PI - Math.PI / 2;
        let proc = 0;
        if (w.idle > 0) proc += w.idle * Math.sin(TWO_PI * 2 * u + t * 0.9);
        if (w.connecting > 0) proc += w.connecting * Math.sin(TWO_PI * 3 * u - t * 1.2);
        if (w.listening > 0) {
          proc +=
            w.listening *
            (0.62 * Math.sin(TWO_PI * 6 * u + t * 7.2) + 0.38 * Math.sin(TWO_PI * 11 * u - t * 9.6));
        }
        if (w.thinking > 0) proc += w.thinking * Math.sin(TWO_PI * 3 * u + t * 2.1);
        if (w.speaking > 0) {
          proc +=
            w.speaking *
            (0.5 * Math.sin(TWO_PI * 4 * u + t * 5.3) +
              0.32 * Math.sin(TWO_PI * 9 * u + t * 8.9) +
              0.26 * Math.sin(TWO_PI * 15 * u - t * 6.4));
        }
        if (w.error > 0) proc += w.error * jag(u, t);
        const mixed = liveMix > 0 ? proc + (wave[i] - proc) * liveMix : proc;
        const shape = mixed * (1 - absBias) + Math.abs(mixed) * bias;
        const r = baseR + shape * amp * R;
        xs[i] = cx + Math.cos(theta) * r;
        ys[i] = cx + Math.sin(theta) * r;
      }

      counts.fill(0);
      for (let i = 0; i < SEGMENTS; i += 1) {
        const theta = ((i + 0.5) / SEGMENTS) * TWO_PI - Math.PI / 2;
        const dash = dashW > 0.004 ? 0.5 + 0.5 * Math.tanh(Math.sin(theta * 7 - rot) * 5) : 1;
        const alpha = 1 - dashW * (1 - dash);
        const ab = Math.round(alpha * (ALPHA_BUCKETS - 1));
        const b = SEG_COLOR[i] * ALPHA_BUCKETS + ab;
        bucketOf[i] = b;
        counts[b] += 1;
      }
      let acc = 0;
      for (let b = 0; b < BUCKETS; b += 1) {
        starts[b] = acc;
        acc += counts[b];
      }
      for (let i = 0; i < SEGMENTS; i += 1) {
        const b = bucketOf[i];
        order[starts[b]] = i;
        starts[b] += 1;
      }

      ensurePalette(w.error);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, size, size);

      const alphaMul = 1 - 0.45 * w.disabled;
      const coreA = clamp01(p.core + level * p.coreGain) * alphaMul;
      if (coreG && w.error < 0.996) {
        ctx.globalAlpha = coreA * (1 - w.error);
        ctx.fillStyle = coreG;
        ctx.fillRect(0, 0, size, size);
      }
      if (w.error > 0.004) {
        ctx.globalAlpha = coreA * w.error;
        ctx.fillStyle = errCoreG;
        ctx.fillRect(0, 0, size, size);
      }

      if (p.echo > 0.004) {
        ctx.strokeStyle = echoStyle;
        ctx.lineWidth = 1.2;
        for (let k = 0; k < 2; k += 1) {
          const phase = (echoClock + k * 0.5) % 1;
          const ea = p.echo * phase * (1 - phase) * 1.6 * alphaMul;
          if (ea <= 0.004) continue;
          ctx.globalAlpha = clamp01(ea);
          ctx.beginPath();
          ctx.arc(cx, cx, R * (1.02 - phase * 0.72), 0, TWO_PI);
          ctx.stroke();
        }
      }

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let pass = 0; pass < 2; pass += 1) {
        const glowPass = pass === 0;
        ctx.globalCompositeOperation = glowPass ? 'lighter' : 'source-over';
        ctx.lineWidth = glowPass
          ? 5.5 + level * 6 * p.glowGain
          : Math.max(0.7, 1.7 + level * 1.5 * p.lineGain - w.disabled * 0.8);
        const passAlpha = (glowPass ? 0.16 : 0.92) * alphaMul;
        let cursor = 0;
        for (let b = 0; b < BUCKETS; b += 1) {
          const count = counts[b];
          if (count === 0) continue;
          const ab = b % ALPHA_BUCKETS;
          const a = passAlpha * (ab / (ALPHA_BUCKETS - 1));
          if (a > 0.004) {
            ctx.globalAlpha = a;
            ctx.strokeStyle = colorStyles[(b - ab) / ALPHA_BUCKETS];
            ctx.beginPath();
            let prev = -2;
            for (let k = cursor; k < cursor + count; k += 1) {
              const i = order[k];
              if (i !== prev + 1) ctx.moveTo(xs[i], ys[i]);
              ctx.lineTo(xs[i + 1], ys[i + 1]);
              prev = i;
            }
            ctx.stroke();
          }
          cursor += count;
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    };

    drawRef.current = draw;
    draw({ ...frameRef.current, dt: 0 });

    return () => {
      drawRef.current = null;
    };
  }, [size, samplesRef, frameRef]);

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
        transition: 'opacity 0.3s ease, filter 0.3s ease',
      }}
    >
      <canvas ref={canvasRef} aria-hidden style={{ width: size, height: size }} />
    </div>
  );
};
