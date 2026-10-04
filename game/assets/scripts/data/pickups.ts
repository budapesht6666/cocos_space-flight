// In-mission pickups (GDD §8): 3D icons from Quaternius Ultimate Space Kit with a coloured halo;
// credits are spinning gold cubes.

import type { PickupDef, PickupKind } from './types';

export const PICKUPS: Record<PickupKind, PickupDef> = {
  credit: { kind: 'credit', credits: 5, size: 0.24, color: [1.0, 0.78, 0.25] },
  bigCredit: { kind: 'bigCredit', credits: 25, size: 0.4, color: [1.0, 0.78, 0.25] },
  power: { kind: 'power', credits: 0, size: 0.85, color: [1.0, 0.55, 0.1], prop: 'pickup_power' },
  repair: { kind: 'repair', credits: 0, size: 0.85, color: [0.35, 1.0, 0.45], prop: 'pickup_repair' },
  shield: { kind: 'shield', credits: 0, size: 0.85, color: [0.3, 0.8, 1.0], prop: 'pickup_shield' },
  energy: { kind: 'energy', credits: 0, size: 0.85, color: [1.0, 0.92, 0.3], prop: 'pickup_energy' },
};

export const PICKUP_MOTION = {
  /** Initial burst speed when dropped, units/s. */
  scatterSpeed: 3.2,
  /** Drag on the burst, per second. */
  drag: 3,
  /** Pickups sink down the screen at this speed. */
  fallSpeed: 2.2,
  /** Speed towards the ship once inside the magnet radius. */
  magnetSpeed: 16,
};

/** Shield units restored by an S pickup. */
export const SHIELD_CELL = 2;

/** Score instead of the effect when it would be wasted (full hull, max Power...). */
export const WASTED_PICKUP_SCORE = 500;
