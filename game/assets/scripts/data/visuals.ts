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
  /** Sparks off armour that soaks the hit. */
  deflect: [0.6, 0.65, 0.75] as Rgb,
  /** Escape pods and rescues. */
  rescue: [0.45, 1.0, 0.6] as Rgb,
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

/**
 * Effect particles made up front per kind at mission load. Peaks measured on full Hard runs and
 * the Marauder and Warden kills, plus a margin. Effects never grow mid-fight: past a peak, extra
 * sparks are skipped — a few sparks less is invisible, a hitch on iPhone is not.
 */
export const FX_POOLS = {
  sparkHot: 130,
  sparkFire: 90,
  hitSpark: 50,
  flash: 8,
  fireball: 32,
  debris: 64,
  cyan: 40,
  pop: 60,
  deflect: 32,
  rescue: 40,
  rings: 10,
};

/**
 * Post effects on the game and menu cameras. FXAA runs at the full screen resolution, the most
 * expensive pass per pixel; with the 3D view upscaled from 70% it made no visible difference on
 * iPhone, so it is off (`?fxaa=1` turns it on to compare).
 */
export const POST_FX = {
  bloom: true,
  fxaa: false,
};

/** Adaptive 3D resolution (fx/RenderScaler.ts). */
export const RENDER_SCALE = {
  /** Steps of the 3D resolution (fraction of the screen's), best first; the UI stays at full resolution. */
  levels: [0.7, 0.6, 0.5] as readonly number[],
  /** Frame times are averaged over this many seconds. */
  window: 2,
  /** An average frame slower than this (ms; 18.5 ≈ 54 FPS) steps the resolution down. */
  slowFrameMs: 18.5,
  /** Seconds at a lower step before trying the one above again; doubles after each failed try. */
  retryAfter: 12,
};

export const BOSS_FX = {
  /** Follow-up blasts around a dead boss: delay (s), offset (units), size. */
  chain: [
    { t: 0.12, dx: -1.1, dz: -0.4, size: 'medium' },
    { t: 0.26, dx: 1.0, dz: 0.5, size: 'medium' },
    { t: 0.42, dx: 0.2, dz: -0.9, size: 'medium' },
    { t: 0.6, dx: 0, dz: 0, size: 'large' },
  ] as const,
  /** Real seconds the world holds still on the kill, before the slow motion. */
  hitstop: 0.15,
  /** Slow motion after a boss dies: time scale and how long it lasts (real seconds, eased back). */
  slowmoScale: 0.35,
  slowmoTime: 1.4,
};
