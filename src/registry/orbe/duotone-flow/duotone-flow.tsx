'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
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
import { mixHex, shadeHex, tintHex } from '../../lib/orb-color';
import { useOrbAnimator, type OrbFrame } from '../../lib/use-orb-animator';
import { useReducedMotion } from '../../lib/use-reduced-motion';
import { useWebGLSupport } from '../../lib/use-webgl-support';

type Vec3 = [number, number, number];

type StateRow = {
  input: number;
  output: number;
  spin: number;
  motion: number;
  saturation: number;
  brightness: number;
};

interface Uniforms {
  flow: number;
  spin: number;
  input: number;
  output: number;
  saturation: number;
  brightness: number;
  from: Vec3;
  to: Vec3;
}

const REDUCED_LEVEL = 0.35;
const CHANNEL_ATTACK = 10;
const CHANNEL_RELEASE = 4;
const FLOW_SCALE = 1;

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

const flowSpeed = (output: number): number => 0.1 + (1 - (output - 1) ** 2) * 0.9;

const stateRows = (t: number, level: number): Record<OrbState, StateRow> => ({
  idle: {
    input: 0.05 + 0.03 * Math.sin(t * 0.9),
    output: 0.12 + 0.05 * Math.sin(t * 0.63 + 1.1),
    spin: 0.05,
    motion: 1,
    saturation: 1,
    brightness: 0.96,
  },
  connecting: {
    input: 0.14 + 0.07 * Math.sin(t * 0.8),
    output: 0.22 + 0.14 * Math.sin(t * 1.05 + 0.4),
    spin: 0.18,
    motion: 1,
    saturation: 0.92,
    brightness: 0.94,
  },
  listening: {
    input: level,
    output: 0.12,
    spin: 0.06,
    motion: 1,
    saturation: 1,
    brightness: 1,
  },
  thinking: {
    input: 0.2 + 0.1 * Math.sin(t * 1.6),
    output: 0.35 + 0.25 * Math.sin(t * 2.1),
    spin: 0.38,
    motion: 1,
    saturation: 1,
    brightness: 1,
  },
  speaking: {
    input: 0.06,
    output: level,
    spin: 0.08,
    motion: 1,
    saturation: 1.04,
    brightness: 1.04,
  },
  error: {
    input: 0.32,
    output: 0.42,
    spin: 0.1,
    motion: 1,
    saturation: 1,
    brightness: 1,
  },
  disabled: {
    input: 0,
    output: 0,
    spin: 0,
    motion: 0,
    saturation: 0.12,
    brightness: 0.62,
  },
});

const VERT = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;

uniform float uSize;
uniform float uFlow;
uniform float uSpin;
uniform float uIn;
uniform float uOut;
uniform float uSat;
uniform float uBright;
uniform vec3 uFrom;
uniform vec3 uTo;

vec2 rotate(vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

vec3 toLinear(vec3 c) {
  return pow(c, vec3(2.2));
}

vec3 toSrgb(vec3 c) {
  return pow(max(c, 0.0), vec3(1.0 / 2.2));
}

void main() {
  vec2 p = (gl_FragCoord.xy * 2.0 - uSize) / uSize;
  float r = length(p);
  float aa = 3.0 / uSize;
  float edge = 0.96;
  float mask = 1.0 - smoothstep(edge - aa, edge, r);
  if (mask <= 0.0) {
    gl_FragColor = vec4(0.0);
    return;
  }

  vec2 q = rotate(p, uSpin);
  float amount = 0.08 + 0.17 * uOut;
  vec2 warp = vec2(
    sin(q.y * 3.1 + uFlow * 1.7) + 0.5 * sin(q.x * 5.3 - uFlow * 2.3),
    cos(q.x * 2.7 - uFlow * 1.3) + 0.5 * cos(q.y * 4.9 + uFlow * 1.9)
  );
  q += amount * warp;

  float num = 0.0;
  float den = 0.0;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float a = fi * 0.8976 + uFlow * (0.32 + 0.06 * fi);
    float b = fi * 1.7 + uFlow * (0.27 + 0.05 * (6.0 - fi));
    float rad = 0.22 + 0.42 * fract(fi * 0.618 + 0.13);
    vec2 c = vec2(cos(a), sin(b)) * rad;
    vec2 d = q - c;
    float w = exp(-dot(d, d) * 6.0);
    num += w * mod(fi, 2.0);
    den += w;
  }
  float t = num / max(den, 1e-5);
  float tone = smoothstep(0.14, 0.86, t);

  vec3 from = toLinear(uFrom);
  vec3 to = toLinear(uTo);
  vec3 col = mix(from, to, tone);

  float seam = 1.0 - abs(2.0 * t - 1.0);
  col += mix(from, to, 0.5) * seam * 0.14;
  col *= 0.82 + 0.3 * (1.0 - r * r);

  float ang = atan(q.y, q.x);
  float ringAlpha = 0.2 + 0.4 * uIn;
  vec3 ringCol = mix(col, vec3(1.0), 0.75);
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float radius = 0.5 + 0.12 * fk + 0.2 * uIn * (0.55 + 0.225 * fk);
    radius = min(radius, 0.915);
    float wobble = 0.01 * sin(ang * 3.0 + uFlow * (0.6 + 0.3 * fk) + fk * 2.1) * (0.5 + uIn);
    float width = 0.009 + 0.008 * uIn;
    float dr = (r + wobble - radius) / width;
    float line = exp(-dr * dr);
    float fade = 0.55 + 0.225 * fk;
    col = mix(col, ringCol, clamp(line * ringAlpha * fade, 0.0, 1.0));
  }

  float rim = smoothstep(edge - 0.07, edge, r);
  col = mix(col, col * 0.7, rim * 0.6);
  col += mix(from, to, 0.5) * smoothstep(edge - 0.035, edge - 0.005, r) * (1.0 - smoothstep(edge - 0.005, edge, r)) * 0.35;

  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(lum), col, uSat) * uBright;

  vec3 outCol = clamp(toSrgb(col), 0.0, 1.0);
  gl_FragColor = vec4(outCol * mask, mask);
}
`;

const SHAKE: Keyframe[] = [
  { transform: 'translateX(0)' },
  { transform: 'translateX(-1.5px)' },
  { transform: 'translateX(3px)' },
  { transform: 'translateX(-2px)' },
  { transform: 'translateX(1px)' },
  { transform: 'translateX(0)' },
];

export const DuotoneFlow = ({
  state = 'idle',
  size = 168,
  speed = 1,
  colorFrom = '#38bdf8',
  colorTo = '#f472b6',
  levelRef,
  label = 'Duotone Flow orb',
  className,
  ref,
}: OrbProps) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const discRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef<(() => void) | null>(null);
  const simRef = useRef({ input: 0, output: 0, flow: 3.7, spin: 0, primed: false });
  const uniformsRef = useRef<Uniforms>({
    flow: 3.7,
    spin: 0,
    input: 0,
    output: 0,
    saturation: 1,
    brightness: 1,
    from: toUnit(colorFrom),
    to: toUnit(colorTo),
  });
  const [lost, setLost] = useState(false);
  const support = useWebGLSupport();
  const reducedMotion = useReducedMotion();
  const showCanvas = support === true && !lost;

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      hostRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  const onFrame = useCallback(
    (frame: OrbFrame) => {
      const sim = simRef.current;
      const level = frame.reduced ? REDUCED_LEVEL : frame.level;
      const time = frame.reduced ? 2.4 : frame.time;
      const row = blendStates(frame.weights, stateRows(time, level));
      const inputTarget = clamp01(row.input);
      const outputTarget = clamp01(row.output);
      if (!sim.primed || frame.reduced) {
        sim.input = inputTarget;
        sim.output = outputTarget;
        sim.primed = true;
      } else {
        sim.input = approach(
          sim.input,
          inputTarget,
          inputTarget > sim.input ? CHANNEL_ATTACK : CHANNEL_RELEASE,
          frame.dt,
        );
        sim.output = approach(
          sim.output,
          outputTarget,
          outputTarget > sim.output ? CHANNEL_ATTACK : CHANNEL_RELEASE,
          frame.dt,
        );
      }
      if (!frame.reduced) {
        const step = frame.dt * Math.max(0, speed) * row.motion;
        sim.flow += step * FLOW_SCALE * flowSpeed(sim.output);
        sim.spin += step * row.spin;
      }
      const u = uniformsRef.current;
      u.flow = sim.flow;
      u.spin = sim.spin;
      u.input = sim.input;
      u.output = sim.output;
      u.saturation = row.saturation;
      u.brightness = row.brightness;
      u.from = mix3(toUnit(colorFrom), ERROR_FROM_V, frame.weights.error);
      u.to = mix3(toUnit(colorTo), ERROR_TO_V, frame.weights.error);
      hostRef.current?.style.setProperty('--orb-level', Math.max(sim.input, sim.output).toFixed(3));
      drawRef.current?.();
    },
    [colorFrom, colorTo, speed],
  );

  useOrbAnimator(hostRef, { state, levelRef, speed, onFrame });

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

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const loc = {
      size: gl.getUniformLocation(program, 'uSize'),
      flow: gl.getUniformLocation(program, 'uFlow'),
      spin: gl.getUniformLocation(program, 'uSpin'),
      input: gl.getUniformLocation(program, 'uIn'),
      output: gl.getUniformLocation(program, 'uOut'),
      saturation: gl.getUniformLocation(program, 'uSat'),
      brightness: gl.getUniformLocation(program, 'uBright'),
      from: gl.getUniformLocation(program, 'uFrom'),
      to: gl.getUniformLocation(program, 'uTo'),
    };
    gl.uniform1f(loc.size, px);

    const draw = () => {
      const u = uniformsRef.current;
      gl.uniform1f(loc.flow, u.flow);
      gl.uniform1f(loc.spin, u.spin);
      gl.uniform1f(loc.input, u.input);
      gl.uniform1f(loc.output, u.output);
      gl.uniform1f(loc.saturation, u.saturation);
      gl.uniform1f(loc.brightness, u.brightness);
      gl.uniform3f(loc.from, u.from[0], u.from[1], u.from[2]);
      gl.uniform3f(loc.to, u.to[0], u.to[1], u.to[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    drawRef.current = draw;
    draw();

    const onLost = (event: Event) => {
      event.preventDefault();
      drawRef.current = null;
      setLost(true);
    };
    canvas.addEventListener('webglcontextlost', onLost);

    return () => {
      drawRef.current = null;
      canvas.removeEventListener('webglcontextlost', onLost);
      gl.deleteBuffer(buffer);
      dropResources();
    };
  }, [size, showCanvas]);

  useEffect(() => {
    if (state !== 'error' || reducedMotion) return;
    const el = discRef.current;
    if (!el) return;
    const shake = el.animate(SHAKE, { duration: 340, easing: 'ease-out' });
    return () => shake.cancel();
  }, [state, reducedMotion]);

  const isError = state === 'error';
  const isDisabled = state === 'disabled';
  const fallbackLayer = (from: string, to: string, visible: boolean): CSSProperties => ({
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    backgroundImage: `radial-gradient(circle at 30% 32%, ${tintHex(from, 0.15)}, transparent 58%), radial-gradient(circle at 70% 66%, ${tintHex(to, 0.1)}, transparent 60%), linear-gradient(140deg, ${from}, ${mixHex(from, to, 0.5)} 50%, ${to})`,
    boxShadow: `inset 0 0 ${Math.round(size * 0.06)}px ${shadeHex(mixHex(from, to, 0.5), 0.35)}`,
    opacity: visible ? 1 : 0,
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
      }}
    >
      <div ref={discRef} aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: '50%' }}>
        {showCanvas ? (
          <canvas ref={canvasRef} style={{ width: size, height: size, display: 'block', borderRadius: '50%' }} />
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: `${Math.round(size * 0.02)}px`,
              borderRadius: '50%',
              scale: 'calc(1 + var(--orb-level, 0) * 0.04)',
              opacity: isDisabled ? 0.55 : 1,
              filter: isDisabled ? 'grayscale(0.88)' : 'grayscale(0)',
              transition: 'opacity 0.4s ease, filter 0.4s ease',
            }}
          >
            <div style={fallbackLayer(colorFrom, colorTo, !isError)} />
            <div style={fallbackLayer(ERROR_COLOR_FROM, ERROR_COLOR_TO, isError)} />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                backgroundImage:
                  'radial-gradient(circle closest-side, transparent 54%, rgba(255,255,255,0.55) 55%, transparent 56.5%, transparent 66%, rgba(255,255,255,0.5) 67%, transparent 68.5%, transparent 78%, rgba(255,255,255,0.45) 79%, transparent 80.5%)',
                opacity: 'calc(0.2 + var(--orb-level, 0) * 0.4)',
                scale: 'calc(1 + var(--orb-level, 0) * 0.12)',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
