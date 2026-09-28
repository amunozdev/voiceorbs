'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  approach,
  blendEnergy,
  ERROR_COLOR_FROM,
  ERROR_COLOR_TO,
  hexToRgb,
  orbVars,
  type OrbProps,
  type OrbState,
} from '../../lib/orb-state';
import { useOrbAnimator } from '../../lib/use-orb-animator';
import type { OrbFrame } from '../../lib/use-orb-animator';
import { useWebGLSupport } from '../../lib/use-webgl-support';

type Vec3 = [number, number, number];

const FLOW_RATE: Record<OrbState, number> = {
  idle: 0.22,
  connecting: 0.55,
  listening: 0.72,
  thinking: 0.46,
  speaking: 1.35,
  error: 0.4,
  disabled: 0.02,
};

const STATE_KEYS = Object.keys(FLOW_RATE) as OrbState[];

const TIME_OFFSET = 4.7;

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

uniform float uSize;
uniform float uTime;
uniform float uFlow;
uniform float uLevel;
uniform vec3 uColorFrom;
uniform vec3 uColorTo;
uniform float uConnect;
uniform float uListen;
uniform float uThink;
uniform float uSpeak;
uniform float uError;
uniform float uDisabled;

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

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.55;
  for (int i = 0; i < 3; i++) {
    v += amp * noise(p);
    p = p * 2.03 + vec2(11.7, 5.3);
    amp *= 0.5;
  }
  return v;
}

void main() {
  vec2 p = (gl_FragCoord.xy * 2.0 - uSize) / uSize;
  float r = length(p);
  float mask = 1.0 - smoothstep(0.86, 0.92, r);
  if (mask < 0.003) {
    gl_FragColor = vec4(0.0);
    return;
  }

  vec2 drift = vec2(uFlow * 0.32, -uFlow * 0.21);
  vec2 q = vec2(fbm(p * 2.1 + drift), fbm(p * 2.1 + drift.yx + vec2(4.7, 1.9)));
  float n = fbm(p * 2.6 + 2.2 * q + vec2(uFlow * 0.42, uFlow * 0.27));

  float inter = sin(r * 24.0 - uTime * 3.1) * sin(r * 15.0 + uTime * 2.3);
  n += uThink * inter * (0.14 + 0.12 * uLevel);

  float ripple = sin(r * 30.0 + uTime * 6.5);
  n += uListen * ripple * (0.05 + 0.2 * uLevel);

  float emit = sin(r * 16.0 - uTime * 4.6);
  n += uSpeak * emit * (0.04 + 0.16 * uLevel);

  n = clamp(n, 0.0, 1.0);

  float fres = pow(smoothstep(0.3, 0.9, r), 2.0);

  float th = n * 1.7 + fres * 1.15 + uFlow * 0.1 + 0.14 * uSpeak - 0.1 * uListen;
  vec3 film = 0.5 + 0.5 * cos(6.28318 * (th + vec3(0.0, 0.33, 0.67)));

  float tone = clamp(smoothstep(0.15, 0.85, n) + 0.28 * uListen - 0.3 * uSpeak, 0.0, 1.0);
  vec3 base = mix(uColorFrom, uColorTo, tone);
  float irid = clamp(0.4 + 0.35 * uSpeak + 0.18 * uListen + 0.3 * uLevel, 0.0, 1.0);
  irid *= 1.0 - 0.75 * uError;
  irid *= 1.0 - 0.7 * uDisabled;

  vec3 col = base * (0.62 + 0.85 * n);
  col += mix(uColorFrom, uColorTo, 0.5) * (1.0 - smoothstep(0.05, 0.75, r)) * 0.3;
  col += film * irid * (0.35 + 0.65 * fres);

  float ang = atan(p.y, p.x);
  float sweep = pow(0.5 + 0.5 * cos(ang - uTime * 2.4), 10.0);
  col += mix(uColorTo, vec3(1.0), 0.55) * sweep * smoothstep(0.35, 0.85, r) * uConnect * 1.1;

  col *= 1.0 + uListen * 0.22 * max(ripple, 0.0) * (0.4 + 0.6 * uLevel);
  col += mix(uColorFrom, vec3(1.0), 0.35) * uSpeak * max(emit, 0.0) * (1.0 - smoothstep(0.1, 0.8, r)) * (0.08 + 0.3 * uLevel);
  col *= 1.0 + uThink * (0.12 * sin(uTime * 4.2) + 0.1 * inter);

  vec3 rim = mix(uColorTo, vec3(1.0), 0.45);
  col += rim * pow(smoothstep(0.55, 0.9, r), 3.0) * (0.4 + 0.55 * uLevel);
  col += vec3(0.98, 0.28, 0.35) * fres * uError * 0.35;

  col *= 0.9 + 0.45 * uLevel + 0.25 * uSpeak * uLevel;

  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(lum), uDisabled * 0.85);
  col *= 1.0 - 0.35 * uDisabled;

  col = col / (1.0 + 0.22 * col);
  col = clamp(col, 0.0, 1.0);

  gl_FragColor = vec4(col * mask, mask);
}
`;

const fallbackOpacity = (state: OrbState): number => {
  switch (state) {
    case 'listening':
    case 'speaking':
      return 1;
    case 'thinking':
      return 0.9;
    case 'connecting':
      return 0.7;
    case 'error':
      return 0.95;
    default:
      return 0.85;
  }
};

type Draw = (frame: OrbFrame) => void;

export const IridescentFlow = ({
  state = 'idle',
  size = 168,
  speed = 1,
  colorFrom = '#c084fc',
  colorTo = '#67e8f9',
  levelRef,
  label = 'Iridescent Flow orb',
  className,
  ref,
}: OrbProps) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef(size);
  const colorRef = useRef({ from: colorFrom, to: colorTo });
  const drawRef = useRef<Draw | null>(null);
  const [lost, setLost] = useState(false);
  const support = useWebGLSupport();
  const showCanvas = support === true && !lost;

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      hostRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  const onFrame = useCallback((frame: OrbFrame) => {
    hostRef.current?.style.setProperty('--orb-level', frame.level.toFixed(3));
    drawRef.current?.(frame);
  }, []);

  const { frameRef } = useOrbAnimator(hostRef, { state, levelRef, speed, onFrame });

  useEffect(() => {
    sizeRef.current = size;
    colorRef.current = { from: colorFrom, to: colorTo };
    drawRef.current?.(frameRef.current);
  }, [size, colorFrom, colorTo, frameRef]);

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

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const loc = {
      size: gl.getUniformLocation(program, 'uSize'),
      time: gl.getUniformLocation(program, 'uTime'),
      flow: gl.getUniformLocation(program, 'uFlow'),
      level: gl.getUniformLocation(program, 'uLevel'),
      colorFrom: gl.getUniformLocation(program, 'uColorFrom'),
      colorTo: gl.getUniformLocation(program, 'uColorTo'),
      connect: gl.getUniformLocation(program, 'uConnect'),
      listen: gl.getUniformLocation(program, 'uListen'),
      think: gl.getUniformLocation(program, 'uThink'),
      speak: gl.getUniformLocation(program, 'uSpeak'),
      error: gl.getUniformLocation(program, 'uError'),
      disabled: gl.getUniformLocation(program, 'uDisabled'),
    };

    let px = 0;
    const ensureSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const next = Math.max(1, Math.round(sizeRef.current * dpr));
      if (next === px) return;
      px = next;
      canvas.width = px;
      canvas.height = px;
      gl.viewport(0, 0, px, px);
      gl.uniform1f(loc.size, px);
    };

    let paletteKey = '';
    let fromV: Vec3 = [1, 1, 1];
    let toV: Vec3 = [1, 1, 1];
    const ensurePalette = () => {
      const key = `${colorRef.current.from}|${colorRef.current.to}`;
      if (key === paletteKey) return;
      paletteKey = key;
      fromV = toUnit(colorRef.current.from);
      toV = toUnit(colorRef.current.to);
    };

    const initial = frameRef.current;
    let flow = 0;
    let lastPhase = initial.phase;
    let flowRate = 0;
    for (const key of STATE_KEYS) flowRate += initial.weights[key] * FLOW_RATE[key];

    const draw: Draw = ({ dt, phase, weights: w, level, reduced }) => {
      ensureSize();
      ensurePalette();
      let rateTarget = 0;
      for (const key of STATE_KEYS) rateTarget += w[key] * FLOW_RATE[key];
      flowRate = reduced ? rateTarget : approach(flowRate, rateTarget, 4, dt);
      flow += Math.max(0, phase - lastPhase) * flowRate;
      lastPhase = phase;
      const from = mix3(fromV, ERROR_FROM_V, w.error);
      const to = mix3(toV, ERROR_TO_V, w.error);
      gl.uniform1f(loc.time, phase + TIME_OFFSET);
      gl.uniform1f(loc.flow, flow);
      gl.uniform1f(loc.level, reduced ? blendEnergy(w, TIME_OFFSET) : level);
      gl.uniform3f(loc.colorFrom, from[0], from[1], from[2]);
      gl.uniform3f(loc.colorTo, to[0], to[1], to[2]);
      gl.uniform1f(loc.connect, w.connecting);
      gl.uniform1f(loc.listen, w.listening);
      gl.uniform1f(loc.think, w.thinking);
      gl.uniform1f(loc.speak, w.speaking);
      gl.uniform1f(loc.error, w.error);
      gl.uniform1f(loc.disabled, w.disabled);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    drawRef.current = draw;
    draw(initial);

    const onLost = (event: Event) => {
      event.preventDefault();
      drawRef.current = null;
      setLost(true);
    };
    canvas.addEventListener('webglcontextlost', onLost);

    return () => {
      canvas.removeEventListener('webglcontextlost', onLost);
      drawRef.current = null;
      gl.deleteBuffer(buffer);
      dropResources();
    };
  }, [showCanvas, frameRef]);

  const isError = state === 'error';
  const fallbackLayer = (from: string, to: string): CSSProperties => ({
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    background: `radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.45), transparent 44%), conic-gradient(from 210deg, ${from}, ${to}, ${from}, ${to}, ${from})`,
    boxShadow: `0 0 calc(${Math.round(size * 0.08)}px + var(--orb-level, 0) * ${Math.round(size * 0.2)}px) color-mix(in oklab, ${to} 55%, transparent)`,
    transition: 'opacity 0.35s ease',
  });

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
        display: 'grid',
        placeItems: 'center',
        opacity: state === 'disabled' ? 0.5 : 1,
        filter: state === 'disabled' ? 'grayscale(0.85)' : 'grayscale(0)',
        transition: 'opacity 300ms ease, filter 300ms ease',
      }}
    >
      {showCanvas ? (
        <canvas ref={canvasRef} style={{ width: size, height: size, borderRadius: '50%' }} />
      ) : (
        <div
          aria-hidden
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            opacity: fallbackOpacity(state),
            transition: 'opacity 0.3s ease',
          }}
        >
          <div style={{ ...fallbackLayer(colorFrom, colorTo), opacity: isError ? 0 : 1 }} />
          <div style={{ ...fallbackLayer(ERROR_COLOR_FROM, ERROR_COLOR_TO), opacity: isError ? 1 : 0 }} />
        </div>
      )}
    </div>
  );
};
