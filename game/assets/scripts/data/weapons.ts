import type { EnemyBulletDef, EnemyBulletId, WeaponDef } from './types';

export const PULSE_CANNON: WeaponDef = {
  id: 'pulse',
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

/** Enemy bullets: pink-orange glow with a white core, always drawn above everything (GDD §2). */
export const ENEMY_BULLETS: Record<EnemyBulletId, EnemyBulletDef> = {
  orb: { radius: 0.13, size: 0.55, color: [1.0, 0.25, 0.55] },
  orbLarge: { radius: 0.22, size: 0.85, color: [1.0, 0.45, 0.12] },
};

/** Total enemy bullets alive at once (performance budget: 500). */
export const ENEMY_BULLET_CAP = 500;
