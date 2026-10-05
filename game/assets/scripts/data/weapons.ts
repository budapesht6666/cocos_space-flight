import type { EnemyBulletDef, EnemyBulletId, WeaponDef, WeaponLevel } from './types';

export const PULSE_CANNON: WeaponDef = {
  id: 'pulse',
  name: 'PULSE CANNON',
  fireInterval: 0.09,
  bulletSpeed: 30,
  damage: 1,
  bulletRadius: 0.18,
  bulletWidth: 0.38,
  bulletLength: 1.0,
  color: [0.12, 0.62, 1.0],
  powerForms: [
    [{ x: 0, angleDeg: 0 }],
    [
      { x: -0.16, angleDeg: 0 },
      { x: 0.16, angleDeg: 0 },
    ],
    [
      { x: 0, angleDeg: 0 },
      { x: -0.22, angleDeg: -5 },
      { x: 0.22, angleDeg: 5 },
    ],
    [
      { x: -0.12, angleDeg: 0 },
      { x: 0.12, angleDeg: 0 },
      { x: -0.3, angleDeg: -7 },
      { x: 0.3, angleDeg: 7 },
      { x: 0, angleDeg: 0 },
    ],
  ],
};

/** Weapon levels 1..5 bought in the hangar (GDD §7): damage and fire rate, indexed by level - 1. */
export const WEAPON_LEVELS: readonly WeaponLevel[] = [
  { damage: 1, rate: 1 },
  { damage: 1.12, rate: 1.05 },
  { damage: 1.25, rate: 1.1 },
  { damage: 1.4, rate: 1.15 },
  { damage: 1.6, rate: 1.2 },
];

/** Enemy bullets: pink-orange glow with a white core, always drawn above everything (GDD §2). */
export const ENEMY_BULLETS: Record<EnemyBulletId, EnemyBulletDef> = {
  orb: { radius: 0.13, size: 0.55, color: [1.0, 0.25, 0.55] },
  orbLarge: { radius: 0.22, size: 0.85, color: [1.0, 0.45, 0.12] },
};

/** Total enemy bullets alive at once (performance budget: 500). */
export const ENEMY_BULLET_CAP = 500;

/**
 * Bullets made up front at mission load, per look (player bolt; enemy orb, large orb). Peaks: the
 * Warden on Hard keeps ~210 orbs alive; Power IV at weapon level 5 ~70 bolts. A pool that grows
 * mid-fight instantiates nodes, which hitches on iPhone.
 */
export const BULLET_POOLS = { player: [80], enemy: [260, 120] };
