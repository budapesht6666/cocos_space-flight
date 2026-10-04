// Bakes the nebula backdrop into an RGBA texture once at start-up. Engine-free.
//
// The full-screen procedural shader was too heavy for phones (retina fill rate), so the same
// domain-warped fBm is computed on the CPU into a small texture that tiles seamlessly and is
// scrolled via UV offset. Noise is periodic on an integer lattice, so the result wraps in both axes.

import { Rng } from './Rng';

export type Rgb = readonly [number, number, number];

export interface NebulaSpec {
  width: number;
  height: number;
  /** Lattice cells of the first octave across / along the texture (integers, keep the texture aspect). */
  cellsX: number;
  cellsY: number;
  base: Rgb;
  colorA: Rgb;
  colorB: Rgb;
  colorC: Rgb;
  /** Cloud brightness (linear). */
  intensity: number;
  seed: number;
}

export interface BakedNebula {
  /** sRGB-encoded RGBA8, normalised so the brightest pixel uses the full range. */
  data: Uint8Array;
  width: number;
  height: number;
  /** Multiply the sampled (linear) colour by this to restore the original brightness. */
  scale: number;
}

const OCTAVES = 4;

export function bakeNebula(spec: NebulaSpec): BakedNebula {
  const { width, height } = spec;
  const noise = new PeriodicNoise(spec.seed);
  const linear = new Float32Array(width * height * 3);
  let max = 1e-6;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = (x / width) * spec.cellsX;
      const py = (y / height) * spec.cellsY;
      const qx = noise.fbm(px, py, spec.cellsX, spec.cellsY);
      const qy = noise.fbm(px + 5.2, py + 1.3, spec.cellsX, spec.cellsY);
      const n = noise.fbm(px + 2.2 * qx, py + 2.2 * qy, spec.cellsX, spec.cellsY);
      const clouds = smoothstep(0.32, 0.92, n);
      const ab = clamp01(qx * 1.4 - 0.2);
      const cMix = clamp01(qy * qy * 1.8);
      const dust = 0.55 + 0.45 * noise.fbm(px * 2 + qx * 1.5, py * 2 + qy * 1.5, spec.cellsX * 2, spec.cellsY * 2);
      const k = clouds * dust * spec.intensity;
      const i = (y * width + x) * 3;
      for (let c = 0; c < 3; c++) {
        const tint = lerp(lerp(spec.colorA[c], spec.colorB[c], ab), spec.colorC[c], cMix);
        const v = spec.base[c] + tint * k;
        linear[i + c] = v;
        if (v > max) max = v;
      }
    }
  }

  const data = new Uint8Array(width * height * 4);
  for (let p = 0, i = 0; p < width * height; p++, i += 3) {
    const o = p * 4;
    data[o] = toSrgb8(linear[i] / max);
    data[o + 1] = toSrgb8(linear[i + 1] / max);
    data[o + 2] = toSrgb8(linear[i + 2] / max);
    data[o + 3] = 255;
  }
  return { data, width, height, scale: max };
}

/** Value noise whose lattice wraps every `periodX` × `periodY` cells. */
class PeriodicNoise {
  private readonly perm: Uint8Array;

  constructor(seed: number) {
    const rng = new Rng(seed);
    this.perm = new Uint8Array(512);
    const base = new Uint8Array(256);
    for (let i = 0; i < 256; i++) base[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = rng.int(0, i);
      const t = base[i];
      base[i] = base[j];
      base[j] = t;
    }
    for (let i = 0; i < 512; i++) this.perm[i] = base[i & 255];
  }

  fbm(x: number, y: number, periodX: number, periodY: number): number {
    let value = 0;
    let amplitude = 0.5;
    let px = periodX;
    let py = periodY;
    for (let o = 0; o < OCTAVES; o++) {
      value += amplitude * this.value(x, y, px, py, o);
      x *= 2;
      y *= 2;
      px *= 2;
      py *= 2;
      amplitude *= 0.5;
    }
    return value;
  }

  private value(x: number, y: number, periodX: number, periodY: number, octave: number): number {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const x0 = mod(xi, periodX);
    const y0 = mod(yi, periodY);
    const x1 = mod(xi + 1, periodX);
    const y1 = mod(yi + 1, periodY);
    const a = this.hash(x0, y0, octave);
    const b = this.hash(x1, y0, octave);
    const c = this.hash(x0, y1, octave);
    const d = this.hash(x1, y1, octave);
    return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
  }

  private hash(x: number, y: number, octave: number): number {
    const p = this.perm;
    return p[(p[(p[(x & 255)] + (y & 255)) & 511] + octave * 37) & 511] / 255;
  }
}

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

function toSrgb8(linear: number): number {
  const v = clamp01(linear);
  const s = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.round(s * 255);
}
