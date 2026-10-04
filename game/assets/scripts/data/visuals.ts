// Colours and effect tuning. Linear-ish RGB in 0..1; values above ~0.8 feed the bloom.

import type { Rgb } from './types';

export const COLORS = {
  background: [0.012, 0.016, 0.045] as Rgb,
  starNear: [0.85, 0.92, 1.0] as Rgb,
  starFar: [0.45, 0.55, 0.85] as Rgb,
  sparkHot: [1.0, 0.85, 0.45] as Rgb,
  sparkFire: [1.0, 0.42, 0.12] as Rgb,
  hitSpark: [0.55, 0.95, 1.0] as Rgb,
  debris: [0.32, 0.3, 0.3] as Rgb,
  engineGlow: [1.0, 0.6, 0.2] as Rgb,
  /** The ship's real hitbox, shown as a small white-cyan core. */
  hitbox: [0.75, 1.0, 1.0] as Rgb,
  shield: [0.3, 0.85, 1.0] as Rgb,
  graze: [0.85, 0.95, 1.0] as Rgb,
  nova: [0.7, 0.9, 1.0] as Rgb,
  /** Erased enemy bullets pop in their own colour family. */
  bulletPop: [1.0, 0.4, 0.65] as Rgb,
};

export const STARFIELD = {
  /** Depth (y) of each parallax layer and how many stars it holds. */
  layers: [
    { y: -4, count: 26, size: 0.07, speedScale: 1.6 },
    { y: -14, count: 60, size: 0.12, speedScale: 1.0 },
    { y: -38, count: 110, size: 0.22, speedScale: 0.7 },
  ],
};

/** Sector 1 "Outer Ring" palette: deep blue with violet and teal clouds. */
export const NEBULA = {
  depth: -70,
  /** Baked texture size; the nebula is soft, so a small texture stretched over the plane is enough. */
  textureWidth: 192,
  textureHeight: 384,
  /** Noise lattice cells across / along one texture (first octave). */
  cellsX: 2,
  cellsY: 4,
  seed: 11,
  base: [0.006, 0.008, 0.03] as Rgb,
  colorA: [0.05, 0.12, 0.42] as Rgb,
  colorB: [0.36, 0.08, 0.5] as Rgb,
  colorC: [0.02, 0.45, 0.55] as Rgb,
  /** Texture lengths per second. */
  scrollSpeed: 0.005,
  intensity: 0.24,
};

export const EXPLOSIONS = {
  small: { sparks: 14, debris: 5, flashSize: 2.2, sparkSpeed: 7, shake: 0.18 },
  medium: { sparks: 22, debris: 8, flashSize: 3.2, sparkSpeed: 9, shake: 0.3 },
  large: { sparks: 40, debris: 14, flashSize: 5, sparkSpeed: 11, shake: 0.6 },
};

export const CAMERA_SHAKE = {
  /** Max positional offset at full trauma, world units. */
  maxOffset: 0.45,
  /** Trauma lost per second. */
  decay: 1.6,
  frequency: 22,
};

export const NOVA_FX = {
  /** Shockwave grows to this diameter, world units, over `time` seconds. */
  ringSize: 26,
  time: 0.55,
  shake: 0.7,
  hitstop: 0.06,
  /** Max bullets that get a pop effect when erased (the rest just vanish). */
  maxPops: 60,
};

export const BOSS_FX = {
  /** Follow-up blasts around a dead boss: delay (s), offset (units), size. */
  chain: [
    { t: 0.12, dx: -1.1, dz: -0.4, size: 'medium' },
    { t: 0.26, dx: 1.0, dz: 0.5, size: 'medium' },
    { t: 0.42, dx: 0.2, dz: -0.9, size: 'medium' },
    { t: 0.6, dx: 0, dz: 0, size: 'large' },
  ] as const,
  hitstop: 0.18,
};
