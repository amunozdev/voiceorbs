'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
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
import { useOrbAnimator, type OrbFrame } from '../../lib/use-orb-animator';
import { useReducedMotion } from '../../lib/use-reduced-motion';
import { useWebGLSupport } from '../../lib/use-webgl-support';

type Vec3 = [number, number, number];

interface AuraParams extends Record<string, number> {
  speed: number;
  scale: number;
  thick: number;
  warp: number;
  brightLo: number;
  brightHi: number;
  shimmer: number;
  sweepRate: number;
  desat: number;
}

const AURA_TABLE: Record<OrbState, AuraParams> = {
  idle: { speed: 10, scale: 0.24, thick: 0.05, warp: 0.055, brightLo: 1, brightHi: 1, shimmer: 0, sweepRate: 0.6, desat: 0 },
  connecting: { speed: 14, scale: 0.22, thick: 0.045, warp: 0.04, brightLo: 0.9, brightHi: 0.9, shimmer: 1, sweepRate: 1.3, desat: 0 },
  listening: { speed: 20, scale: 0.3, thick: 0.058, warp: 0.1, brightLo: 1.5, brightHi: 2, shimmer: 0, sweepRate: 0.8, desat: 0 },
  thinking: { speed: 30, scale: 0.27, thick: 0.05, warp: 0.14, brightLo: 0.5, brightHi: 2.5, shimmer: 0.6, sweepRate: 2.8, desat: 0 },
  speaking: { speed: 70, scale: 0.2, thick: 0.06, warp: 0.12, brightLo: 1.6, brightHi: 1.6, shimmer: 0, sweepRate: 1, desat: 0 },
  error: { speed: 25, scale: 0.24, thick: 0.058, warp: 0.18, brightLo: 1.4, brightHi: 1.4, shimmer: 0, sweepRate: 0.6, desat: 0 },
  disabled: { speed: 0, scale: 0.2, thick: 0.04, warp: 0.05, brightLo: 0.5, brightHi: 0.5, shimmer: 0, sweepRate: 0, desat: 0.85 },
};

const SPEED_UNIT = 0.02;
const PULSE_HALF_PERIOD = 0.35;
const RADIUS_BASE = 0.26;
const RADIUS_GAIN = 1.05;
const SPEAK_SCALE_GAIN = 0.2;
const BOUNCY_SPRING = { omega: (2 * Math.PI) / 1, zeta: 1 - 0.35 };
const SMOOTH_SPRING = { omega: (2 * Math.PI) / 0.8, zeta: 1 };

interface Spring {
  x: number;
  v: number;
}

const stepSpring = (spring: Spring, target: number, omega: number, zeta: number, dt: number) => {
  if (dt <= 0) return;
  const x0 = spring.x - target;
  const v0 = spring.v;
  if (zeta < 1) {
    const wd = omega * Math.sqrt(1 - zeta * zeta);
    const decay = Math.exp(-zeta * omega * dt);
    const c = Math.cos(wd * dt);
    const s = Math.sin(wd * dt);
    const b = (v0 + zeta * omega * x0) / wd;
    const x = decay * (x0 * c + b * s);
    spring.x = target + x;
    spring.v = -zeta * omega * x + decay * wd * (b * c - x0 * s);
    return;
  }
  const decay = Math.exp(-omega * dt);
  const k = v0 + omega * x0;
  spring.x = target + (x0 + k * dt) * decay;
  spring.v = (v0 - omega * dt * k) * decay;
};

const pingPong = (t: number): number => {
  const p = t / PULSE_HALF_PERIOD;
  const leg = Math.floor(p);
  const f = p - leg;
  const eased = 1 - (1 - f) * (1 - f);
  return leg % 2 === 0 ? eased : 1 - eased;
};

const toUnit = (hex: string): Vec3 => {
  const [r, g, b] = hexToRgb(hex);
  return [r / 255, g / 255, b / 255];
};

const mix3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const ERROR_FROM_V = toUnit(ERROR_COLOR_FROM);
const ERROR_TO_V = toUnit(ERROR_COLOR_TO);

const VERT = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;

uniform float uRes;
uniform float uPhase;
uniform float uSweep;
uniform float uRadius;
uniform float uThick;
uniform float uWarp;
uniform float uBright;
uniform float uShimmer;
uniform float uDesat;
uniform vec3 uFrom;
uniform vec3 uTo;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

void main() {
  vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / uRes;
  float r = length(p);
  float edge = 1.0 - smoothstep(0.8, 1.0, r);
  if (edge <= 0.0) {
    gl_FragColor = vec4(0.0);
    return;
  }
  float a = atan(p.y, p.x);

  vec3 acc = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float ph = uPhase * (1.0 + 0.35 * fi) + fi * 2.1;
    float amp1 = 0.6 + 0.8 * noise(vec2(ph * 0.35, fi * 7.3));
    float amp2 = 0.4 + 0.8 * noise(vec2(fi * 3.9, ph * 0.28 + 4.0));
    float n = 0.5 * amp1 * sin(3.0 * a + ph * 1.3)
      + 0.32 * amp2 * sin(5.0 * a - ph * 1.7 + fi * 2.0)
      + 0.22 * sin(2.0 * a + ph * 0.8 + fi);
    n *= 0.5;
    float rr = uRadius * (1.0 + n * uWarp * 2.2) + (fi - 1.0) * uThick * 0.9;
    float d = abs(r - rr);
    float w = uThick * (0.8 + 0.6 * abs(n));
    float band = exp(-(d * d) / (w * w));
    float bloom = exp(-d / (w * 2.6));
    float hue = 0.5 + 0.5 * sin(a + uPhase * 0.3 + fi * 1.4 + n * 3.0);
    vec3 c = mix(uFrom, uTo, smoothstep(0.1, 0.9, hue));
    float layer = i == 1 ? 1.0 : 0.55;
    acc += c * (band * 1.0 + bloom * 0.28) * layer;
    acc += mix(c, vec3(1.0), 0.45) * pow(band, 6.0) * 0.35 * layer;
  }

  float hollow = smoothstep(uRadius * 0.25, uRadius * 0.95, r);
  acc *= mix(0.1, 1.0, hollow);

  float sweep = pow(0.5 + 0.5 * cos(a - uSweep), 6.0);
  float sweep2 = pow(0.5 + 0.5 * cos(a - uSweep * 0.7 + 2.6), 10.0);
  acc *= 1.0 + uShimmer * (sweep * 1.5 + sweep2 * 0.8);

  acc *= uBright;

  float lum = dot(acc, vec3(0.299, 0.587, 0.114));
  acc = mix(acc, vec3(lum), uDesat);

  float peak = max(max(acc.r, acc.g), acc.b);
  vec3 hueKeep = acc * ((1.0 - exp(-peak * 1.3)) / max(peak, 1e-4));
  vec3 col = mix(hueKeep, 1.0 - exp(-acc * 1.3), 0.45);
  col *= edge;
  float alpha = clamp(max(max(col.r, col.g), col.b) * 1.25, 0.0, 1.0);
  col *= mix(1.0, 0.78, uDesat);
  gl_FragColor = vec4(col, alpha);
}
`;

interface GlHandle {
  gl: WebGLRenderingContext;
  loc: Record<string, WebGLUniformLocation | null>;
}

const UNIFORMS = [
  'uRes',
  'uPhase',
  'uSweep',
  'uRadius',
  'uThick',
  'uWarp',
  'uBright',
  'uShimmer',
  'uDesat',
  'uFrom',
  'uTo',
] as const;

const fallbackRing = (from: string, to: string, size: number): CSSProperties => ({
  position: 'absolute',
  inset: '14%',
  borderRadius: '50%',
  background: `conic-gradient(from 0deg, ${from}, ${to}, ${from}, ${to}, ${from})`,
  WebkitMask: 'radial-gradient(closest-side, transparent 72%, #000 80%, #000 88%, transparent 100%)',
  mask: 'radial-gradient(closest-side, transparent 72%, #000 80%, #000 88%, transparent 100%)',
  filter: `blur(${Math.max(1, Math.round(size * 0.012))}px) drop-shadow(0 0 ${Math.round(size * 0.06)}px ${to})`,
});

export const AuraField = ({
  state = 'idle',
  size = 168,
  speed = 1,
  colorFrom = '#34d399',
  colorTo = '#60a5fa',
  levelRef,
  label = 'Aura Field orb',
  className,
  ref,
}: OrbProps) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const shakeRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fallbackRef = useRef<HTMLDivElement>(null);
  const brandLayerRef = useRef<HTMLDivElement>(null);
  const errorLayerRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<GlHandle | null>(null);
  const motionRef = useRef({
    shaderPhase: 0,
    sweep: 0,
    pulse: 0,
    spring: { x: AURA_TABLE[state].scale, v: 0 },
  });
  const [lost, setLost] = useState(false);
  const support = useWebGLSupport();
  const reduced = useReducedMotion();
  const showCanvas = support === true && !lost;

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      hostRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );


  const fromV = useMemo(() => toUnit(colorFrom), [colorFrom]);
  const toV = useMemo(() => toUnit(colorTo), [colorTo]);

  const onFrame = useCallback((frame: OrbFrame) => {
    const { dt, weights, level, reduced: still, state: current } = frame;
    const m = motionRef.current;
    const p = blendStates(weights, AURA_TABLE);
    const rate = Math.max(0, speed);

    const target = AURA_TABLE[current].scale;
    if (still) {
      m.spring.x = target;
      m.spring.v = 0;
    } else {
      const cfg = current === 'listening' ? BOUNCY_SPRING : SMOOTH_SPRING;
      stepSpring(m.spring, target, cfg.omega, cfg.zeta, dt);
      m.shaderPhase += dt * rate * p.speed * SPEED_UNIT;
      m.sweep += dt * rate * p.sweepRate;
      m.pulse += dt * rate;
    }

    const pulse = still ? 0.5 : pingPong(m.pulse);
    const bright = p.brightLo + (p.brightHi - p.brightLo) * pulse;
    const speak = weights.speaking * level;
    const scale = m.spring.x + SPEAK_SCALE_GAIN * speak;
    const radius = RADIUS_BASE + RADIUS_GAIN * scale;
    const thick = p.thick + 0.035 * speak;
    const warp = p.warp + 0.14 * speak + 0.04 * weights.listening * level;
    const shade = 0.5 + 0.42 * bright;

    const handle = glRef.current;
    if (handle) {
      const { gl, loc } = handle;
      const from = mix3(fromV, ERROR_FROM_V, weights.error);
      const to = mix3(toV, ERROR_TO_V, weights.error);
      gl.uniform1f(loc.uPhase, m.shaderPhase);
      gl.uniform1f(loc.uSweep, m.sweep);
      gl.uniform1f(loc.uRadius, radius);
      gl.uniform1f(loc.uThick, thick);
      gl.uniform1f(loc.uWarp, warp);
      gl.uniform1f(loc.uBright, shade);
      gl.uniform1f(loc.uShimmer, p.shimmer);
      gl.uniform1f(loc.uDesat, p.desat);
      gl.uniform3f(loc.uFrom, from[0], from[1], from[2]);
      gl.uniform3f(loc.uTo, to[0], to[1], to[2]);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    const ring = fallbackRef.current;
    if (ring) {
      const deg = ((m.shaderPhase * 40) % 360).toFixed(2);
      ring.style.transform = `rotate(${deg}deg) scale(${(radius / (RADIUS_BASE + RADIUS_GAIN * 0.3)).toFixed(4)})`;
      ring.style.opacity = clamp01(0.35 + 0.5 * shade).toFixed(3);
      ring.style.filter = `grayscale(${p.desat.toFixed(3)})`;
    }
    const brandLayer = brandLayerRef.current;
    if (brandLayer) brandLayer.style.opacity = (1 - weights.error).toFixed(3);
    const errorLayer = errorLayerRef.current;
    if (errorLayer) errorLayer.style.opacity = weights.error.toFixed(3);
  }, [speed, fromV, toV]);

  const { frameRef } = useOrbAnimator(hostRef, { state, levelRef, speed, onFrame });
  const drawRef = useRef(onFrame);

  useEffect(() => {
    drawRef.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    if (!showCanvas) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      powerPreference: 'low-power',
    });
    if (!gl) {
      setLost(true);
      return;
    }
    const compile = (type: number, source: string): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };
    const vert = compile(gl.VERTEX_SHADER, VERT);
    const frag = compile(gl.FRAGMENT_SHADER, FRAG);
    const program = gl.createProgram();
    const dropResources = () => {
      if (vert) gl.deleteShader(vert);
      if (frag) gl.deleteShader(frag);
      if (program) gl.deleteProgram(program);
    };
    if (!vert || !frag || !program) {
      dropResources();
      setLost(true);
      return;
    }
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      dropResources();
      setLost(true);
      return;
    }
    gl.useProgram(program);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.max(1, Math.round(size * dpr));
    canvas.width = px;
    canvas.height = px;
    gl.viewport(0, 0, px, px);
    gl.clearColor(0, 0, 0, 0);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const loc: Record<string, WebGLUniformLocation | null> = {};
    for (const name of UNIFORMS) loc[name] = gl.getUniformLocation(program, name);
    gl.uniform1f(loc.uRes, px);
    glRef.current = { gl, loc };
    drawRef.current(frameRef.current);

    const onLost = (event: Event) => {
      event.preventDefault();
      glRef.current = null;
      setLost(true);
    };
    canvas.addEventListener('webglcontextlost', onLost);

    return () => {
      canvas.removeEventListener('webglcontextlost', onLost);
      glRef.current = null;
      gl.deleteBuffer(buffer);
      dropResources();
    };
  }, [size, showCanvas, frameRef]);

  useEffect(() => {
    if (state !== 'error' || reduced) return;
    const el = shakeRef.current;
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

  return (
    <div
      ref={setRefs}
      role="img"
      aria-label={label}
      data-state={state}
      className={className}
      style={{
        ...orbVars({ size, speed, colorFrom, colorTo }),
        width: size,
        height: size,
        position: 'relative',
      }}
    >
      <div ref={shakeRef} aria-hidden style={{ position: 'absolute', inset: 0 }}>
        {showCanvas ? (
          <canvas ref={canvasRef} style={{ width: size, height: size, display: 'block' }} />
        ) : (
          <div ref={fallbackRef} style={{ position: 'absolute', inset: 0 }}>
            <div ref={brandLayerRef} style={fallbackRing(colorFrom, colorTo, size)} />
            <div
              ref={errorLayerRef}
              style={{ ...fallbackRing(ERROR_COLOR_FROM, ERROR_COLOR_TO, size), opacity: 0 }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
