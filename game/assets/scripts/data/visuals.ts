// Colours and effect tuning. Linear-ish RGB in 0..1; values above ~0.8 feed the bloom.

import type { DeviceKind, QualityId, QualityTier, Rgb } from './types';

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
  /** Plasma Orb splash. */
  plasma: [0.2, 1.0, 0.75] as Rgb,
  /** Specials: Overdrive, Time Warp (the Phase Shield uses the shield colour). */
  overdrive: [1.0, 0.75, 0.3] as Rgb,
  warp: [0.55, 0.45, 1.0] as Rgb,
  /** Enemy lasers: the beam and its warning line (enemy colours: red into pink). */
  laser: [1.0, 0.25, 0.4] as Rgb,
  laserWarn: [1.0, 0.2, 0.25] as Rgb,
};

export const STARFIELD = {
  /** Depth (y) of each parallax layer and how many stars it holds. */
  layers: [
    { y: -4, count: 26, size: 0.07, speedScale: 1.6 },
    { y: -14, count: 60, size: 0.12, speedScale: 1.0 },
    { y: -38, count: 110, size: 0.22, speedScale: 0.7 },
  ],
};

/** The nebula plane far below the field; each sector bakes its own colours (SectorDef.nebula). */
export const NEBULA = {
  depth: -70,
  /** Baked texture size; the nebula is soft, so a small texture stretched over the plane is enough. */
  textureWidth: 192,
  textureHeight: 384,
  /** Noise lattice cells across / along one texture (first octave). */
  cellsX: 2,
  cellsY: 4,
  /** Texture lengths per second. */
  scrollSpeed: 0.005,
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
  /** Plasma Orb splashes: ~7 a second at Power IV, a few sparks each. */
  plasma: 40,
  rings: 18,
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

/**
 * Graphics quality (fx/RenderScaler.ts), picked on the Settings page (GRAPHICS). Tiers best first.
 * The engine caps the canvas at 2 pixels per CSS pixel, so `scale` 1 renders at that. The tier
 * never changes by itself: switching it rebuilds the render targets, and on iPhone that seemed to
 * flash a zoomed piece of the scene; measuring frame rates and stepping tiers was dropped in
 * stage 6 (an iPhone ran ~51 FPS at medium and at lowest alike — the engine's CPU work, not fill
 * rate — so stepping only cost quality).
 */
export const QUALITY = {
  tiers: [
    { id: 'ultra', scale: 1, msaa: true },
    { id: 'high', scale: 0.85, msaa: false },
    { id: 'medium', scale: 0.7, msaa: false },
    { id: 'low', scale: 0.6, msaa: false },
    { id: 'lowest', scale: 0.5, msaa: false },
  ] as readonly QualityTier[],
  /** The tier a device starts with until the player picks one. */
  devices: {
    /** A desktop or laptop GPU has room for everything (60 FPS on AMD integrated graphics). */
    desktop: 'ultra',
    /**
     * Phones and tablets: fill rate and heat. 70% is what iPhone 15 Plus was tuned at; a first
     * look at blurry graphics turns players away, a warm phone sends them to the settings.
     */
    mobile: 'medium',
    /**
     * The native iOS app renders with Metal, without Safari: steady 60 FPS at ultra on iPhone 15 Plus
     * in Sector 3 and the Leviathan fight, and the phone stays cool.
     */
    nativePhone: 'ultra',
    /** No GPU (Chrome on SwiftShader, llvmpipe): as light as it gets. */
    software: 'lowest',
  } as Record<DeviceKind, QualityId>,
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

/** Menu motion: pages slide in and fade up; the logo's glow breathes. */
export const MENU_FX = {
  /** Seconds a page takes to come in. */
  pageTime: 0.24,
  /** How far it slides in from (UI units): from the right going forward, from the left going back. */
  pageSlide: 56,
  /** Logo glow: opacity swings between these, once per `glowPeriod` seconds. */
  glowMin: 0.55,
  glowMax: 1,
  glowPeriod: 3.2,
};
