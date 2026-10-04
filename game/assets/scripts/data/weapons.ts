import type { WeaponDef } from './types';

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
