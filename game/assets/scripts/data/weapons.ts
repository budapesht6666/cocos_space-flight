// The arsenal (GDD §7): Primary and Secondary weapons, drones and Specials, their projectile looks,
// the hangar weapon levels, and enemy bullets. Hangar names, prices and unlocks are in economy.ts;
// docs/BALANCE.md (npm run balance) tabulates what these numbers add up to.
//
// Player shots stay in the cool family (blue, cyan, teal, violet, white): pink and orange belong
// to enemy bullets (GDD §2).

import type {
  BoltDef,
  BoltId,
  DroneDef,
  DroneId,
  EnemyBulletDef,
  EnemyBulletId,
  PrimaryId,
  SecondaryId,
  SpecialDef,
  SpecialId,
  WeaponDef,
  WeaponId,
  WeaponLevel,
} from './types';

export const BOLTS: Record<BoltId, BoltDef> = {
  pulse: { width: 0.38, length: 1.0, color: [0.12, 0.62, 1.0], intensity: 1.3, round: false, pool: 80 },
  pellet: { width: 0.3, length: 0.55, color: [0.55, 0.95, 1.0], intensity: 1.5, round: false, pool: 48 },
  missile: { width: 0.3, length: 0.8, color: [0.45, 1.0, 0.8], intensity: 1.5, round: false, pool: 36 },
  plasma: { width: 0.8, length: 0.8, color: [0.2, 1.0, 0.75], intensity: 1.7, round: true, pool: 24 },
  rocket: { width: 0.26, length: 0.62, color: [0.8, 0.88, 1.0], intensity: 1.6, round: false, pool: 24 },
  wing: { width: 0.3, length: 0.8, color: [0.35, 0.85, 1.0], intensity: 1.3, round: false, pool: 48 },
  rail: { width: 0.46, length: 3.6, color: [0.78, 0.62, 1.0], intensity: 2.4, round: false, pool: 4 },
  rear: { width: 0.3, length: 0.75, color: [0.3, 0.7, 1.0], intensity: 1.3, round: false, pool: 48 },
  drone: { width: 0.26, length: 0.62, color: [0.45, 0.85, 1.0], intensity: 1.2, round: false, pool: 32 },
};

/** Spread of the wings' and tail's gun points (streams use them as offsets from the nose). */
const WING = 0.62;
const WING_Z = 0.55;
const TAIL_Z = 1.0;

export const PRIMARIES: Record<PrimaryId, WeaponDef> = {
  /** Balanced: fast straight bolts. */
  pulse: {
    kind: 'bolts',
    id: 'pulse',
    bolt: 'pulse',
    interval: 0.09,
    speed: 30,
    damage: 1,
    radius: 0.18,
    forms: [
      { streams: [{ x: 0, angleDeg: 0 }] },
      { streams: [{ x: -0.16, angleDeg: 0 }, { x: 0.16, angleDeg: 0 }] },
      { streams: [{ x: 0, angleDeg: 0 }, { x: -0.22, angleDeg: -5 }, { x: 0.22, angleDeg: 5 }] },
      {
        streams: [
          { x: -0.12, angleDeg: 0 },
          { x: 0.12, angleDeg: 0 },
          { x: -0.3, angleDeg: -7 },
          { x: 0.3, angleDeg: 7 },
          { x: 0, angleDeg: 0 },
        ],
      },
    ],
  },
  /** Against swarms: a wide fan of short-lived pellets that lose punch with distance. */
  scatter: {
    kind: 'bolts',
    id: 'scatter',
    bolt: 'pellet',
    interval: 0.17,
    speed: 24,
    damage: 2.2,
    radius: 0.16,
    life: 0.45,
    falloff: 0.5,
    jitterDeg: 2.5,
    forms: [
      { streams: fan(3, 10), damage: 0.5 },
      { streams: fan(5, 8), damage: 0.7 },
      { streams: fan(7, 7), damage: 0.85 },
      { streams: fan(9, 6.5) },
    ],
  },
  /** Against armour: a continuous beam through everything in its way. */
  ion: {
    kind: 'beam',
    id: 'ion',
    dps: 12,
    armorPierce: 0.6,
    color: [0.62, 0.48, 1.0],
    forms: [
      { width: 0.3, damage: 1 },
      { width: 0.42, damage: 1.4 },
      { width: 0.55, damage: 1.85 },
      { width: 0.62, damage: 2.2, side: { angleDeg: 9, offset: 0.45, width: 0.3, damage: 0.45 } },
    ],
  },
  /** Safe play: homing missiles, low damage per second. */
  seeker: {
    kind: 'bolts',
    id: 'seeker',
    bolt: 'missile',
    interval: 0.55,
    speed: 15,
    damage: 3.4,
    radius: 0.2,
    life: 2.4,
    homing: { turnRate: 420, delay: 0.1 },
    forms: [
      { streams: pairs([[0.45, 25]]) },
      { streams: [{ x: 0, angleDeg: 0 }, ...pairs([[0.45, 25]])] },
      { streams: pairs([[0.3, 15], [0.55, 35]]) },
      { streams: pairs([[0.25, 10], [0.5, 30], [0.7, 50]]) },
    ],
  },
  /** Area control: slow orbs that pass through small fry and splash everything around a hit. */
  plasma: {
    kind: 'bolts',
    id: 'plasma',
    bolt: 'plasma',
    interval: 0.4,
    speed: 10,
    damage: 3.5,
    radius: 0.34,
    pierce: 2,
    splashDamage: 0.4,
    forms: [
      { streams: [{ x: 0, angleDeg: 0 }], scale: 1, splash: 0.7 },
      { streams: [{ x: 0, angleDeg: 0 }], damage: 1.35, scale: 1.15, splash: 0.8 },
      { streams: pairs([[0.25, 4]]), damage: 1.2, scale: 1.15, splash: 0.9 },
      { streams: [{ x: 0, angleDeg: 0 }, ...pairs([[0.3, 10]])], damage: 1.15, scale: 1.3, splash: 1.0 },
    ],
  },
  /** Close combat: lightning strikes the nearest enemy and jumps to its neighbours. */
  tesla: {
    kind: 'chain',
    id: 'tesla',
    interval: 0.13,
    damage: 3.8,
    decay: 0.7,
    range: 5.5,
    jump: 3.2,
    color: [0.62, 0.85, 1.0],
    forms: [
      { targets: 2, damage: 0.45 },
      { targets: 3, damage: 0.65 },
      { targets: 4, damage: 0.85 },
      { targets: 5, damage: 1.3 },
    ],
  },
};

export const SECONDARIES: Record<SecondaryId, WeaponDef> = {
  /** A salvo of homing rockets fanned out sideways. */
  swarm: {
    kind: 'bolts',
    id: 'swarm',
    bolt: 'rocket',
    interval: 3,
    speed: 13,
    damage: 5,
    radius: 0.2,
    life: 2.8,
    homing: { turnRate: 300, delay: 0.2 },
    forms: [
      { streams: pairs([[0.4, 40], [0.4, 70]], WING_Z) },
      { streams: [{ x: 0, z: WING_Z, angleDeg: 0 }, ...pairs([[0.4, 40], [0.4, 70]], WING_Z)] },
      { streams: pairs([[0.4, 25], [0.4, 50], [0.4, 75]], WING_Z) },
      { streams: pairs([[0.4, 15], [0.4, 35], [0.4, 55], [0.4, 75]], WING_Z) },
    ],
  },
  /** Diagonal bursts from the wingtips cover the flanks. */
  wing: {
    kind: 'bolts',
    id: 'wing',
    bolt: 'wing',
    interval: 1,
    burst: { count: 3, gap: 0.09 },
    speed: 28,
    damage: 2.4,
    radius: 0.17,
    forms: [
      { streams: pairs([[WING, 28]], WING_Z) },
      { streams: pairs([[WING, 22], [WING + 0.1, 36]], WING_Z) },
      { streams: pairs([[WING, 22], [WING + 0.1, 36]], WING_Z), damage: 1.25 },
      { streams: pairs([[WING, 20], [WING + 0.08, 32], [WING + 0.16, 44]], WING_Z) },
    ],
  },
  /** Every few seconds a slug that goes through everything for huge damage. */
  rail: {
    kind: 'bolts',
    id: 'rail',
    bolt: 'rail',
    interval: 3,
    speed: 75,
    damage: 30,
    radius: 0.3,
    pierce: 99,
    armorPierce: 0.3,
    forms: [
      { streams: [{ x: 0, angleDeg: 0 }] },
      { streams: [{ x: 0, angleDeg: 0 }], damage: 1.2 },
      { streams: [{ x: 0, angleDeg: 0 }], damage: 1.45 },
      { streams: [{ x: 0, angleDeg: 0 }], damage: 1.8, scale: 1.2 },
    ],
  },
  /** Backwards and sideways, against whatever comes from below and the sides. */
  rear: {
    kind: 'bolts',
    id: 'rear',
    bolt: 'rear',
    interval: 0.85,
    burst: { count: 2, gap: 0.1 },
    speed: 24,
    damage: 2,
    radius: 0.17,
    forms: [
      { streams: pairs([[0.22, 176]], TAIL_Z) },
      { streams: [...pairs([[0.22, 176]], TAIL_Z), ...pairs([[0.5, 95]], WING_Z)] },
      { streams: [...pairs([[0.22, 176]], TAIL_Z), ...pairs([[0.5, 95], [0.4, 140]], WING_Z)] },
      {
        streams: [
          { x: 0, z: TAIL_Z, angleDeg: 180 },
          ...pairs([[0.25, 172]], TAIL_Z),
          ...pairs([[0.5, 95], [0.45, 120], [0.4, 145]], WING_Z),
        ],
      },
    ],
  },
};

export const WEAPONS: Record<WeaponId, WeaponDef> = Object.assign({}, PRIMARIES, SECONDARIES);

/** Weapon levels 1..5 bought in the hangar (GDD §7): damage and fire rate, indexed by level - 1. */
export const WEAPON_LEVELS: readonly WeaponLevel[] = [
  { damage: 1, rate: 1 },
  { damage: 1.12, rate: 1.05 },
  { damage: 1.25, rate: 1.1 },
  { damage: 1.4, rate: 1.15 },
  { damage: 1.6, rate: 1.2 },
];

/** Drones, levels 1..3 (index = level - 1). */
export const DRONES: Record<DroneId, DroneDef> = {
  gunDrone: {
    kind: 'gun',
    id: 'gunDrone',
    prop: 'drone_gun',
    size: 0.85,
    color: [0.4, 0.8, 1.0],
    interval: 0.16,
    speed: 28,
    radius: 0.16,
    levels: [{ share: 0.3 }, { share: 0.38 }, { share: 0.46 }],
  },
  guardian: {
    kind: 'guardian',
    id: 'guardian',
    prop: 'drone_guardian',
    size: 0.8,
    color: [0.3, 0.9, 1.0],
    orbit: 1.2,
    spin: 3,
    block: 0.42,
    levels: [{ recharge: 4 }, { recharge: 3.2 }, { recharge: 2.5 }],
  },
  collector: {
    kind: 'collector',
    id: 'collector',
    prop: 'drone_collector',
    size: 0.95,
    color: [1.0, 0.8, 0.3],
    reach: 1.4,
    levels: [{ speed: 8 }, { speed: 10 }, { speed: 12.5 }],
  },
};

/** Where drones fly next to the ship (by slot), how tightly they follow, and their glow under the model. */
export const DRONE_FLIGHT = {
  slots: [
    { x: -1.15, z: 0.35 },
    { x: 1.15, z: 0.35 },
  ],
  follow: 9,
  /** Halo diameter per unit of drone size. */
  halo: 1.7,
  /** Models are flattened a little, like station modules, so they stay below enemy bullets. */
  height: 0.6,
};

export const SPECIALS: Record<SpecialId, SpecialDef> = {
  nova: { kind: 'nova', id: 'nova', label: 'NOVA', damage: 30, invulnerableTime: 1.2, bulletScore: 5 },
  overdrive: { kind: 'overdrive', id: 'overdrive', label: 'DRIVE', time: 6, rate: 1.5 },
  phase: { kind: 'phase', id: 'phase', label: 'PHASE', time: 4, ramDps: 40, radius: 1.0 },
  warp: { kind: 'warp', id: 'warp', label: 'WARP', time: 5, scale: 0.5 },
};

/** Enemy bullets: pink-orange glow with a white core, always drawn above everything (GDD §2). */
export const ENEMY_BULLETS: Record<EnemyBulletId, EnemyBulletDef> = {
  orb: { radius: 0.13, size: 0.55, color: [1.0, 0.25, 0.55] },
  orbLarge: { radius: 0.22, size: 0.85, color: [1.0, 0.45, 0.12] },
};

/** Total enemy bullets alive at once (performance budget: 500), and player projectiles. */
export const ENEMY_BULLET_CAP = 500;
export const PLAYER_BULLET_CAP = 400;

/**
 * Enemy bullets made up front at mission load, per look (orb, large orb). Peak: the Warden on Hard
 * keeps ~210 orbs alive. A pool that grows mid-fight instantiates nodes, which hitches on iPhone.
 * Player projectile pools are per look, in BOLTS.
 */
export const ENEMY_BULLET_POOLS = [260, 120];

/** `count` streams fanned `stepDeg` apart around straight ahead. */
function fan(count: number, stepDeg: number): { x: number; angleDeg: number }[] {
  const out: { x: number; angleDeg: number }[] = [];
  for (let i = 0; i < count; i++) out.push({ x: 0, angleDeg: (i - (count - 1) / 2) * stepDeg });
  return out;
}

/** Mirrored pairs of [x offset, angle] (left first), optionally `z` towards the tail. */
function pairs(list: readonly (readonly [number, number])[], z?: number): { x: number; z?: number; angleDeg: number }[] {
  const out: { x: number; z?: number; angleDeg: number }[] = [];
  for (const [x, angle] of list) {
    out.push({ x: -x, z, angleDeg: -angle });
    out.push({ x, z, angleDeg: angle });
  }
  return out;
}
