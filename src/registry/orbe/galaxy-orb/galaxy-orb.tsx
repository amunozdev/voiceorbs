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
import { mixRgb as mix, rgba, type Rgb } from '../../lib/orb-color';
import { useOrbAnimator, type OrbFrame } from '../../lib/use-orb-animator';

const TWO_PI = Math.PI * 2;
const LAYER_COUNTS = [60, 60, 30];
const LAYER_OMEGA = [0.015, 0.03, 0.06];
const SPRITE_OMEGA = 0.022;
const RIM_OMEGA = 0.15;
const ARM_K = 2.35;
const ARM_R0 = 0.16;
const DUST_COUNT = 360;
const TIME_OFFSET = 5.3;
const ALPHA_BUCKETS = 8;
const TINTS = 3;

const WHITE: Rgb = [255, 255, 255];
const DUST_WHITE: Rgb = [235, 240, 255];

interface Star {
  a: number;
  r: number;
  size: number;
  layer: number;
  u: number;
  twinkle: number;
  phase: number;
  bright: number;
  tint: number;
  glow: boolean;
}

const ERROR_RGB: Rgb = mix(hexToRgb(ERROR_COLOR_FROM), hexToRgb(ERROR_COLOR_TO), 0.5);

type StateParams = {
  tempo: number;
  spin: number;
  rest: number;
  nebGain: number;
  rimGain: number;
  coreGain: number;
  armsGain: number;
  think: number;
  thinkRate: number;
  reveal: number;
  error: number;
  dim: number;
  bloom: number;
};

const STATES: Record<OrbState, StateParams> = {
  idle: { tempo: 1, spin: 1, rest: 0, nebGain: 0, rimGain: 0.2, coreGain: 0, armsGain: 0, think: 0, thinkRate: 1, reveal: 0, error: 0, dim: 0, bloom: 0 },
  connecting: { tempo: 1, spin: 1.6, rest: 0.2, nebGain: 0, rimGain: 0.2, coreGain: 0, armsGain: 0, think: 0.45, thinkRate: 0.5, reveal: 1, error: 0, dim: 0, bloom: 0 },
  listening: { tempo: 1, spin: 1.1, rest: 0.78, nebGain: 0.35, rimGain: 1, coreGain: 0, armsGain: 0, think: 0, thinkRate: 1, reveal: 0, error: 0, dim: 0, bloom: 0.1 },
  thinking: { tempo: 1, spin: 3.2, rest: 0.45, nebGain: 0, rimGain: 0.2, coreGain: 0, armsGain: 0, think: 1, thinkRate: 1, reveal: 0, error: 0, dim: 0, bloom: 0 },
  speaking: { tempo: 1, spin: 1.4, rest: 0.92, nebGain: 0, rimGain: 0.3, coreGain: 1, armsGain: 1, think: 0, thinkRate: 1, reveal: 0, error: 0, dim: 0, bloom: 0.14 },
  error: { tempo: 1, spin: 0.5, rest: 0.3, nebGain: 0, rimGain: 0, coreGain: 0, armsGain: 0, think: 0, thinkRate: 1, reveal: 0, error: 1, dim: 0, bloom: 0 },
  disabled: { tempo: 0.05, spin: 0.3, rest: 0, nebGain: 0, rimGain: 0, coreGain: 0, armsGain: 0, think: 0, thinkRate: 1, reveal: 0, error: 0, dim: 1, bloom: 0 },
};

const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const gauss = (seed: number) => {
  const u = Math.max(rand(seed), 1e-6);
  const v = rand(seed + 0.618034);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TWO_PI * v);
};

const armAngle = (r: number, arm: number) =>
  arm * Math.PI + ARM_K * Math.log(Math.max(r, 0.02) / ARM_R0);

const rimColorAt = (u: number, from: Rgb, to: Rgb): Rgb => {
  const w = ((u % 1) + 1) % 1;
  if (w < 1 / 3) return mix(from, WHITE, w * 3);
  if (w < 2 / 3) return mix(WHITE, to, (w - 1 / 3) * 3);
  return mix(to, from, (w - 2 / 3) * 3);
};

const buildStars = (): Star[] => {
  const stars: Star[] = [];
  const total = LAYER_COUNTS[0] + LAYER_COUNTS[1] + LAYER_COUNTS[2];
  let n = 0;
  for (let layer = 0; layer < LAYER_COUNTS.length; layer += 1) {
    for (let i = 0; i < LAYER_COUNTS[layer]; i += 1) {
      n += 1;
      const s = n * 7.13;
      const onArm = rand(s + 0.11) < 0.55;
      const r = onArm ? 0.2 + rand(s + 0.23) * 0.72 : Math.sqrt(rand(s + 0.29)) * 0.92;
      const arm = rand(s + 0.31) > 0.5 ? 1 : 0;
      const a = onArm ? armAngle(r, arm) + gauss(s + 0.41) * 0.2 : rand(s + 0.47) * TWO_PI;
      const roll = rand(s + 0.53);
      const bigCut = layer === 2 ? 0.86 : 0.95;
      const midCut = layer === 2 ? 0.55 : 0.7;
      const px =
        roll > bigCut
          ? 1.6 + rand(s + 0.59) * 0.6
          : roll > midCut
            ? 0.8 + rand(s + 0.61) * 0.6
            : 0.4 + rand(s + 0.67) * 0.3;
      const tintRoll = rand(s + 0.71);
      stars.push({
        a,
        r,
        size: px,
        layer,
        u: n / total,
        twinkle: rand(s + 0.73) < 0.3 ? 1.1 + rand(s + 0.79) * 2.3 : 0,
        phase: rand(s + 0.83) * TWO_PI,
        bright: 0.45 + rand(s + 0.89) * 0.55,
        tint: tintRoll < 0.6 ? 0 : tintRoll < 0.85 ? 1 : 2,
        glow: roll > bigCut,
      });
    }
  }
  return stars;
};

const STARS = buildStars();

export const GalaxyOrb = ({
  state = 'idle',
  size = 168,
  speed = 1,
  colorFrom = '#c084fc',
  colorTo = '#38bdf8',
  levelRef,
  label = 'Assistant orb',
  className,
  ref: refProp,
}: OrbProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorRef = useRef({ from: colorFrom, to: colorTo });
  const drawRef = useRef<((frame: OrbFrame) => void) | null>(null);

  const setRootRef = useCallback(
    (node: HTMLDivElement | null) => {
      ref.current = node;
      if (typeof refProp === 'function') refProp(node);
      else if (refProp) refProp.current = node;
    },
    [refProp],
  );

  const onFrame = useCallback((frame: OrbFrame) => drawRef.current?.(frame), []);
  const { frameRef } = useOrbAnimator(ref, { state, levelRef, speed, onFrame });

  useEffect(() => {
    colorRef.current = { from: colorFrom, to: colorTo };
    drawRef.current?.({ ...frameRef.current, dt: 0 });
  }, [colorFrom, colorTo, frameRef]);

  useEffect(() => {
    const host = ref.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = size / 2;
    const cy = size / 2;
    const R = size * 0.435;
    const supportsConic = typeof ctx.createConicGradient === 'function';

    const makeSprite = () => {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(size * dpr));
      c.height = c.width;
      return c;
    };
    const spriteBase = makeSprite();
    const spriteArms = makeSprite();
    const spriteNebula = makeSprite();

    const noiseTile = document.createElement('canvas');
    noiseTile.width = 64;
    noiseTile.height = 64;
    const noiseCtx = noiseTile.getContext('2d');
    let grain: CanvasPattern | null = null;
    if (noiseCtx) {
      const img = noiseCtx.createImageData(64, 64);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.floor(rand(i + 0.5) * 255);
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      noiseCtx.putImageData(img, 0, 0);
      grain = ctx.createPattern(noiseTile, 'repeat');
    }

    const shadowG = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.8);
    shadowG.addColorStop(0, 'rgba(10, 8, 24, 0.34)');
    shadowG.addColorStop(0.55, 'rgba(10, 8, 24, 0.16)');
    shadowG.addColorStop(1, 'rgba(10, 8, 24, 0)');

    const hxg = cx - R * 0.35;
    const hyg = cy - R * 0.42;
    const broadG = ctx.createRadialGradient(hxg, hyg, 0, hxg, hyg, R * 0.8);
    broadG.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
    broadG.addColorStop(1, 'rgba(255, 255, 255, 0)');

    const specG = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.22);
    specG.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    specG.addColorStop(0.7, 'rgba(255, 255, 255, 0.5)');
    specG.addColorStop(1, 'rgba(255, 255, 255, 0)');

    const spec2G = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.11);
    spec2G.addColorStop(0, 'rgba(255, 255, 255, 0.24)');
    spec2G.addColorStop(1, 'rgba(255, 255, 255, 0)');

    const errFresG = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R);
    errFresG.addColorStop(0, rgba(ERROR_RGB, 0));
    errFresG.addColorStop(0.55, rgba(ERROR_RGB, 0.08));
    errFresG.addColorStop(0.86, rgba(ERROR_RGB, 0.5));
    errFresG.addColorStop(0.97, rgba(ERROR_RGB, 1));
    errFresG.addColorStop(1, rgba(ERROR_RGB, 0.8));

    const errWashG = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    errWashG.addColorStop(0, rgba(ERROR_RGB, 0.5));
    errWashG.addColorStop(1, rgba(ERROR_RGB, 0));

    let paletteKey = '';
    let from: Rgb = WHITE;
    let to: Rgb = WHITE;
    let tintCols: [Rgb, Rgb, Rgb] = [WHITE, WHITE, WHITE];
    let abFrom = '';
    let abTo = '';
    const tintStyles: string[] = ['#fff', '#fff', '#fff'];
    const rimStyles: string[] = new Array<string>(48).fill('#fff');
    const errRimStyle = rgba(ERROR_RGB, 1);
    let thinkG: CanvasGradient | null = null;
    let bloomG: CanvasGradient | null = null;
    let fresG: CanvasGradient | null = null;
    let bounceG: CanvasGradient | null = null;
    let speakG: CanvasGradient | null = null;
    let rimG: CanvasGradient | null = null;

    const paintBase = () => {
      const c = spriteBase.getContext('2d');
      if (!c) return;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.globalCompositeOperation = 'source-over';
      c.clearRect(0, 0, size, size);
      const baseMid = mix([11, 10, 24], from, 0.15);
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, size * 0.72);
      g.addColorStop(0, rgba(mix(baseMid, WHITE, 0.06), 1));
      g.addColorStop(0.42, rgba(baseMid, 1));
      g.addColorStop(1, rgba(mix(baseMid, [2, 2, 8], 0.62), 1));
      c.fillStyle = g;
      c.fillRect(0, 0, size, size);

      c.globalCompositeOperation = 'lighter';
      const hazes: Array<[number, number, Rgb]> = [
        [cx - R * 0.28, cy + R * 0.18, mix(from, to, 0.3)],
        [cx + R * 0.3, cy - R * 0.22, mix(from, to, 0.75)],
      ];
      for (const [hx, hy, col] of hazes) {
        const hg = c.createRadialGradient(hx, hy, 0, hx, hy, R * 0.62);
        hg.addColorStop(0, rgba(col, 0.07));
        hg.addColorStop(1, rgba(col, 0));
        c.fillStyle = hg;
        c.fillRect(0, 0, size, size);
      }

      for (let i = 0; i < DUST_COUNT; i += 1) {
        const s = i * 3.77 + 11;
        const onArm = rand(s + 0.1) < 0.6;
        const r = onArm ? 0.18 + rand(s + 0.2) * 0.74 : Math.sqrt(rand(s + 0.3)) * 0.93;
        const arm = rand(s + 0.4) > 0.5 ? 1 : 0;
        const a = onArm ? armAngle(r, arm) + gauss(s + 0.5) * 0.24 : rand(s + 0.6) * TWO_PI;
        const x = cx + Math.cos(a) * r * R;
        const y = cy + Math.sin(a) * r * R;
        const roll = rand(s + 0.7);
        const col = roll < 0.7 ? DUST_WHITE : roll < 0.88 ? tintCols[1] : tintCols[2];
        c.fillStyle = rgba(col, 0.03 + rand(s + 0.8) * 0.03);
        c.fillRect(x - 0.3, y - 0.3, 0.6, 0.6);
      }
    };

    const paintArms = () => {
      const c = spriteArms.getContext('2d');
      if (!c) return;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.globalCompositeOperation = 'source-over';
      c.clearRect(0, 0, size, size);
      c.globalCompositeOperation = 'lighter';
      for (let arm = 0; arm < 2; arm += 1) {
        for (let i = 0; i < 110; i += 1) {
          const s = arm * 137 + i * 1.93 + 71;
          const u = i / 109;
          const r = ARM_R0 + u ** 0.92 * (0.9 - ARM_R0);
          const a = armAngle(r, arm) + gauss(s + 0.15) * 0.09;
          const x = cx + Math.cos(a) * r * R;
          const y = cy + Math.sin(a) * r * R;
          const blobR = R * (0.05 + (1 - u) * 0.07) * (0.75 + rand(s + 0.25) * 0.55);
          const col = mix(mix(from, to, 0.15 + 0.72 * u), WHITE, 0.1 + 0.16 * (1 - u));
          const g = c.createRadialGradient(x, y, 0, x, y, blobR);
          g.addColorStop(0, rgba(col, 0.05 + (1 - u) * 0.025));
          g.addColorStop(1, rgba(col, 0));
          c.fillStyle = g;
          c.beginPath();
          c.arc(x, y, blobR, 0, TWO_PI);
          c.fill();
        }
      }
      const coreC = mix(from, [255, 240, 218], 0.55);
      const core = c.createRadialGradient(cx, cy, 0, cx, cy, R * 0.2);
      core.addColorStop(0, 'rgba(255, 246, 228, 0.9)');
      core.addColorStop(0.4, rgba(coreC, 0.5));
      core.addColorStop(1, rgba(coreC, 0));
      c.fillStyle = core;
      c.beginPath();
      c.arc(cx, cy, R * 0.2, 0, TWO_PI);
      c.fill();
      const hot = c.createRadialGradient(cx, cy, 0, cx, cy, R * 0.06);
      hot.addColorStop(0, 'rgba(255, 252, 244, 0.95)');
      hot.addColorStop(1, 'rgba(255, 252, 244, 0)');
      c.fillStyle = hot;
      c.beginPath();
      c.arc(cx, cy, R * 0.06, 0, TWO_PI);
      c.fill();
    };

    const paintNebula = () => {
      const c = spriteNebula.getContext('2d');
      if (!c) return;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.globalCompositeOperation = 'source-over';
      c.clearRect(0, 0, size, size);
      c.globalCompositeOperation = 'lighter';
      const rings = [0.3, 0.44, 0.58, 0.72, 0.85];
      for (let arm = 0; arm < 2; arm += 1) {
        for (let k = 0; k < rings.length; k += 1) {
          const rr = rings[k];
          const s = arm * 91 + k * 17.3 + 5;
          const a0 = armAngle(rr, arm);
          const a1 = armAngle(rr + 0.03, arm);
          const x0 = Math.cos(a0) * rr * R;
          const y0 = Math.sin(a0) * rr * R;
          const x1 = Math.cos(a1) * (rr + 0.03) * R;
          const y1 = Math.sin(a1) * (rr + 0.03) * R;
          const tangent = Math.atan2(y1 - y0, x1 - x0);
          const rx = R * (0.14 + rand(s + 0.3) * 0.09);
          const col = mix(mix(from, to, k / (rings.length - 1)), WHITE, 0.15);
          c.save();
          c.translate(cx + x0, cy + y0);
          c.rotate(tangent);
          c.scale(1, 0.42);
          const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
          g.addColorStop(0, rgba(col, 0.42));
          g.addColorStop(0.55, rgba(col, 0.2));
          g.addColorStop(1, rgba(col, 0));
          c.fillStyle = g;
          c.beginPath();
          c.arc(0, 0, rx, 0, TWO_PI);
          c.fill();
          c.restore();
        }
      }
      const glowC = mix(mix(from, to, 0.35), WHITE, 0.1);
      const glow = c.createRadialGradient(cx, cy, 0, cx, cy, R * 0.42);
      glow.addColorStop(0, rgba(glowC, 0.22));
      glow.addColorStop(1, rgba(glowC, 0));
      c.fillStyle = glow;
      c.beginPath();
      c.arc(cx, cy, R * 0.42, 0, TWO_PI);
      c.fill();
    };

    const ensurePalette = () => {
      const key = `${colorRef.current.from}|${colorRef.current.to}`;
      if (key === paletteKey) return;
      paletteKey = key;
      from = hexToRgb(colorRef.current.from);
      to = hexToRgb(colorRef.current.to);
      const midTone = mix(from, to, 0.5);
      tintCols = [[246, 248, 255], mix(to, WHITE, 0.5), mix(from, WHITE, 0.5)];
      abFrom = rgba(from, 0.5);
      abTo = rgba(to, 0.5);
      for (let k = 0; k < TINTS; k += 1) tintStyles[k] = rgba(tintCols[k], 1);
      if (!supportsConic) {
        for (let k = 0; k < rimStyles.length; k += 1) {
          rimStyles[k] = rgba(rimColorAt(k / rimStyles.length, from, to), 1);
        }
      }

      const thinkC = mix(mix(from, to, 0.4), WHITE, 0.55);
      thinkG = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.36);
      thinkG.addColorStop(0, rgba(WHITE, 0.95));
      thinkG.addColorStop(0.3, rgba(thinkC, 0.6));
      thinkG.addColorStop(1, rgba(thinkC, 0));

      bloomG = ctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, R * 1.16);
      bloomG.addColorStop(0, rgba(midTone, 0));
      bloomG.addColorStop(0.62, rgba(midTone, 1));
      bloomG.addColorStop(1, rgba(midTone, 0));

      const fresC = mix(to, WHITE, 0.35);
      fresG = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R);
      fresG.addColorStop(0, rgba(fresC, 0));
      fresG.addColorStop(0.55, rgba(fresC, 0.1));
      fresG.addColorStop(0.86, rgba(fresC, 0.62));
      fresG.addColorStop(0.97, rgba(fresC, 1));
      fresG.addColorStop(1, rgba(fresC, 0.8));

      const bounceC = mix(to, WHITE, 0.5);
      const bx = cx + R * 0.32;
      const by = cy + R * 0.42;
      bounceG = ctx.createRadialGradient(bx, by, 0, bx, by, R * 0.55);
      bounceG.addColorStop(0, rgba(bounceC, 1));
      bounceG.addColorStop(1, rgba(bounceC, 0));

      const speakC = mix(midTone, WHITE, 0.4);
      speakG = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.8);
      speakG.addColorStop(0, rgba(speakC, 1));
      speakG.addColorStop(1, rgba(speakC, 0));

      if (supportsConic) {
        rimG = ctx.createConicGradient(0, 0, 0);
        rimG.addColorStop(0, rgba(from, 1));
        rimG.addColorStop(1 / 3, rgba(WHITE, 0.95));
        rimG.addColorStop(2 / 3, rgba(to, 1));
        rimG.addColorStop(1, rgba(from, 1));
      }

      paintBase();
      paintArms();
      paintNebula();
    };

    let spriteA = -0.9;
    const layerOff = [0, 0, 0];
    let rimOff = 0;
    let clock = 0;
    let thinkClock = 0;
    let revealClock = 0;
    let lastPhase = frameRef.current.phase;
    let lastLevelText = '';
    const starCount = STARS.length;
    const splitAt = LAYER_COUNTS[0];
    const buckets = TINTS * ALPHA_BUCKETS;
    const counts = new Uint16Array(buckets);
    const starts = new Uint16Array(buckets);
    const order = new Uint16Array(starCount);
    const bucketOf = new Uint8Array(starCount);
    const starX = new Float32Array(starCount);
    const starY = new Float32Array(starCount);

    const drawSprite = (img: HTMLCanvasElement, scale: number, alpha: number) => {
      ctx.save();
      ctx.globalAlpha = clamp01(alpha);
      ctx.translate(cx, cy);
      ctx.rotate(spriteA);
      const d = size * scale;
      ctx.drawImage(img, -d / 2, -d / 2, d, d);
      ctx.restore();
    };

    const revealVis = (head: number, u: number): number => {
      const d = (((head - u) % 1) + 1) % 1;
      if (d < 0.06) return 0.15 + 0.85 * (d / 0.06);
      const trail = 1 - (d - 0.06) / 0.94;
      return 0.15 + 0.85 * trail * Math.sqrt(trail);
    };

    const drawStars = (
      start: number,
      end: number,
      Rl: number,
      t: number,
      starBoost: number,
      reveal: number,
      head: number,
    ) => {
      counts.fill(0);
      for (let i = start; i < end; i += 1) {
        const sr = STARS[i];
        const vis = reveal > 0.004 ? 1 + (revealVis(head, sr.u) - 1) * reveal : 1;
        const tw = sr.twinkle > 0 ? 0.68 + 0.32 * Math.sin(t * sr.twinkle + sr.phase) : 1;
        const alpha = clamp01(sr.bright * tw * starBoost * vis);
        if (alpha <= 0.004) {
          bucketOf[i] = 255;
          continue;
        }
        const ang = sr.a + layerOff[sr.layer];
        const rr = sr.r * Rl;
        const x = cx + Math.cos(ang) * rr;
        const y = cy + Math.sin(ang) * rr;
        starX[i] = x;
        starY[i] = y;
        if (sr.glow) {
          const len = sr.size * 3;
          ctx.globalAlpha = alpha * 0.3;
          ctx.strokeStyle = tintStyles[sr.tint];
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(x - len, y);
          ctx.lineTo(x + len, y);
          ctx.moveTo(x, y - len);
          ctx.lineTo(x, y + len);
          ctx.stroke();
          ctx.globalAlpha = alpha * 0.16;
          ctx.fillStyle = tintStyles[sr.tint];
          ctx.beginPath();
          ctx.arc(x, y, sr.size * 2.1, 0, TWO_PI);
          ctx.fill();
        }
        const b = sr.tint * ALPHA_BUCKETS + Math.min(ALPHA_BUCKETS - 1, Math.floor(alpha * ALPHA_BUCKETS));
        bucketOf[i] = b;
        counts[b] += 1;
      }
      let acc = 0;
      for (let b = 0; b < buckets; b += 1) {
        starts[b] = acc;
        acc += counts[b];
      }
      for (let i = start; i < end; i += 1) {
        const b = bucketOf[i];
        if (b === 255) continue;
        order[starts[b]] = i;
        starts[b] += 1;
      }
      let cursor = 0;
      for (let b = 0; b < buckets; b += 1) {
        const count = counts[b];
        if (count === 0) continue;
        const ab = b % ALPHA_BUCKETS;
        ctx.globalAlpha = (ab + 0.5) / ALPHA_BUCKETS;
        ctx.fillStyle = tintStyles[(b - ab) / ALPHA_BUCKETS];
        ctx.beginPath();
        for (let k = cursor; k < cursor + count; k += 1) {
          const i = order[k];
          const s = STARS[i].size;
          ctx.moveTo(starX[i] + s, starY[i]);
          ctx.arc(starX[i], starY[i], s, 0, TWO_PI);
        }
        ctx.fill();
        cursor += count;
      }
      ctx.globalAlpha = 1;
    };

    const draw = (frame: OrbFrame) => {
      ensurePalette();
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
      const wError = p.error;
      const wDisabled = p.dim;
      const wReveal = clamp01(p.reveal);
      const think = p.think;

      clock += dPhase * p.tempo;
      thinkClock += dPhase * p.tempo * p.thinkRate;
      revealClock += dPhase * 0.4;
      const t = clock + TIME_OFFSET;
      const drive = dPhase * p.spin;
      spriteA += SPRITE_OMEGA * drive;
      rimOff += RIM_OMEGA * dPhase * p.tempo;
      for (let k = 0; k < layerOff.length; k += 1) layerOff[k] += LAYER_OMEGA[k] * drive;

      const beatBase = 0.5 + 0.5 * Math.sin((thinkClock + TIME_OFFSET) * 4.2);
      const beat = beatBase * beatBase;
      const head = revealClock % 1;

      const breathe = 1 + 0.008 * Math.sin(t * 1.15) + level * 0.006;
      const Rl = R * breathe;

      const jAmp = frame.reduced ? 0 : wError;
      const jx = jAmp > 0.004 ? (Math.sin(t * 29.3) * 0.9 + Math.sin(t * 17.1) * 0.6) * jAmp : 0;
      const jy = jAmp > 0.004 ? (Math.cos(t * 23.7) * 0.9 + Math.sin(t * 13.3) * 0.6) * jAmp : 0;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, size, size);

      ctx.save();
      ctx.translate(cx, cy + R * 0.99);
      ctx.scale(1, 0.24);
      ctx.fillStyle = shadowG;
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.8, 0, TWO_PI);
      ctx.fill();
      ctx.restore();

      if (bloomG) {
        ctx.globalAlpha = clamp01((0.22 + level * p.bloom) * (1 - 0.4 * wError - 0.5 * wDisabled));
        ctx.fillStyle = bloomG;
        ctx.fillRect(0, 0, size, size);
        ctx.globalAlpha = 1;
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, Rl, 0, TWO_PI);
      ctx.clip();

      ctx.save();
      ctx.translate(jx, jy);
      drawSprite(spriteBase, 1, 1);

      ctx.globalCompositeOperation = 'lighter';
      const starBoost = (0.68 + level * 0.5) * (1 - 0.15 * wError);
      drawStars(0, splitAt, Rl, t, starBoost, wReveal, head);

      const wobble = (1 - w.listening) * 0.02 * Math.sin(t * 0.6);
      const nebScale = 1 + p.nebGain * level + wobble - think * 0.08 * beat;
      const nebBase = 0.9 + level * 0.1 * p.armsGain;
      const nebConn = 0.55 + 0.25 * Math.sin(head * TWO_PI);
      const nebAlpha = nebBase + wReveal * (nebConn - nebBase) + wError * (0.5 - nebBase);
      drawSprite(spriteNebula, nebScale, nebAlpha);
      const armsBase = 0.88 + level * 0.12 * p.armsGain + think * (0.08 + 0.22 * beat);
      const armScale = 1 - think * (0.03 + 0.11 * beat);
      drawSprite(spriteArms, armScale, armsBase + wError * (0.65 - armsBase));

      drawStars(splitAt, starCount, Rl, t, starBoost, wReveal, head);

      const thinkA = think * (0.18 + 0.72 * beat);
      if (thinkG && thinkA > 0.004) {
        const k = 0.7 + 0.55 * beat;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(k, k);
        ctx.globalAlpha = clamp01(thinkA);
        ctx.fillStyle = thinkG;
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.36, 0, TWO_PI);
        ctx.fill();
        ctx.restore();
      }
      const speakA = level * 0.22 * p.coreGain;
      if (speakG && speakA > 0.004) {
        ctx.globalAlpha = speakA;
        ctx.fillStyle = speakG;
        ctx.fillRect(0, 0, size, size);
        ctx.globalAlpha = 1;
      }
      if (wError > 0.004) {
        ctx.globalAlpha = 0.14 * wError;
        ctx.fillStyle = errWashG;
        ctx.fillRect(0, 0, size, size);
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      ctx.globalCompositeOperation = 'screen';
      const fresA = clamp01(0.45 + level * 0.12 * (p.coreGain + p.rimGain * 0.5));
      if (fresG && fresA * (1 - wError) > 0.004) {
        ctx.globalAlpha = fresA * (1 - wError);
        ctx.fillStyle = fresG;
        ctx.fillRect(0, 0, size, size);
        ctx.globalAlpha = 1;
      }
      if (fresA * wError > 0.004) {
        ctx.globalAlpha = fresA * wError;
        ctx.fillStyle = errFresG;
        ctx.fillRect(0, 0, size, size);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = broadG;
      ctx.fillRect(0, 0, size, size);
      if (bounceG) {
        ctx.globalAlpha = 0.09;
        ctx.fillStyle = bounceG;
        ctx.fillRect(0, 0, size, size);
        ctx.globalAlpha = 1;
      }

      ctx.save();
      ctx.translate(cx - Rl * 0.33, cy - Rl * 0.45);
      ctx.rotate(-Math.PI / 6);
      ctx.scale(1, 0.455);
      ctx.fillStyle = specG;
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.22, 0, TWO_PI);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(cx + Rl * 0.36, cy + Rl * 0.44);
      ctx.rotate(Math.PI - Math.PI / 5);
      ctx.scale(1, 0.5);
      ctx.fillStyle = spec2G;
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.11, 0, TWO_PI);
      ctx.fill();
      ctx.restore();

      if (grain) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.02;
        ctx.fillStyle = grain;
        ctx.fillRect(cx - Rl, cy - Rl, Rl * 2, Rl * 2);
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      const rimW = 2 + level * (0.5 + p.rimGain * 1.5);
      const rimR = Rl - rimW / 2 - 0.35;
      const rimA =
        clamp01((0.5 + level * (0.15 + p.rimGain * 0.4)) * (1 - 0.55 * wDisabled)) * (1 - wError);
      ctx.globalCompositeOperation = 'screen';
      if (wError > 0.004) {
        ctx.globalAlpha = clamp01((0.55 + 0.3 * Math.sin(t * 9)) * wError);
        ctx.strokeStyle = errRimStyle;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(cx, cy, rimR, 0, TWO_PI);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (rimA > 0.004) {
        if (rimG) {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(rimOff);
          ctx.globalAlpha = rimA;
          ctx.strokeStyle = rimG;
          ctx.lineWidth = rimW;
          ctx.beginPath();
          ctx.arc(0, 0, rimR, 0, TWO_PI);
          ctx.stroke();
          ctx.restore();
        } else {
          const seg = rimStyles.length;
          ctx.lineWidth = rimW;
          ctx.globalAlpha = rimA;
          for (let i = 0; i < seg; i += 1) {
            const a0 = rimOff + (i / seg) * TWO_PI;
            ctx.strokeStyle = rimStyles[i];
            ctx.beginPath();
            ctx.arc(cx, cy, rimR, a0, a0 + (TWO_PI / seg) * 1.5);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = rimA * 0.7;
        ctx.lineWidth = 1;
        ctx.strokeStyle = abFrom;
        ctx.beginPath();
        ctx.arc(cx + 0.7, cy, rimR, 0, TWO_PI);
        ctx.stroke();
        ctx.strokeStyle = abTo;
        ctx.beginPath();
        ctx.arc(cx - 0.7, cy, rimR, 0, TWO_PI);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
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
      ref={setRootRef}
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
        transition: 'opacity 300ms ease, filter 300ms ease',
      }}
    >
      <canvas ref={canvasRef} style={{ width: size, height: size }} />
    </div>
  );
};
