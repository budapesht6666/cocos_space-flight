import type { GeneratorLevel, PaintDef, PaintId, PlayerShipDef, ShipId } from './types';

/** The player's ships (GDD §6): stats on top of the hangar upgrades. Hitbox is the same for all. */
export const SHIPS: Record<ShipId, PlayerShipDef> = {
  spitfire: {
    id: 'spitfire',
    name: 'SPITFIRE',
    role: 'BALANCED FIGHTER',
    perks: ['Longer recovery after a hull hit'],
    model: 'models/ships/spitfire',
    size: 1.5,
    hitboxRadius: 0.25,
    bodyRadius: 0.55,
    grazeRadius: 1.0,
    pickupRadius: 0.8,
    invulnerableTime: 1.5,
    shieldInvulnerableTime: 0.35,
    dragSensitivity: 1.05,
    keyboardSpeed: 9.45,
    followSharpness: 28,
    bankMaxDeg: 32,
    bankFullSpeed: 12,
    startHeight: 0.8,
    engines: [
      [-0.42, 0.18],
      [0.42, 0.18],
    ],
    hullBonus: 0,
    shieldBonus: 0,
    chargeBonus: 0,
    energyGain: 1,
    primaryDamage: 1,
    secondaryCooldown: 1,
    unlock: null,
  },
  executioner: {
    id: 'executioner',
    name: 'EXECUTIONER',
    role: 'HEAVY GUNSHIP',
    perks: ['+2 hull, +1 shield', 'Primary damage +15%', 'Slower (×0.85)'],
    model: 'models/ships/executioner',
    size: 1.65,
    hitboxRadius: 0.25,
    bodyRadius: 0.62,
    grazeRadius: 1.0,
    pickupRadius: 0.8,
    invulnerableTime: 1.2,
    shieldInvulnerableTime: 0.35,
    dragSensitivity: 1.05,
    keyboardSpeed: 8.0,
    followSharpness: 24,
    bankMaxDeg: 24,
    bankFullSpeed: 12,
    startHeight: 0.8,
    engines: [
      [-0.435, 0.4],
      [0.435, 0.4],
      [-0.095, 0.37],
      [0.095, 0.37],
    ],
    hullBonus: 2,
    shieldBonus: 1,
    chargeBonus: 0,
    energyGain: 1,
    primaryDamage: 1.15,
    secondaryCooldown: 0.8,
    unlock: { sector: 2 },
  },
  striker: {
    id: 'striker',
    name: 'STRIKER',
    role: 'INTERCEPTOR',
    perks: ['Faster (×1.2), −1 hull', 'Graze ring +30%, Energy +30%', '+1 Nova charge'],
    model: 'models/ships/striker',
    size: 1.55,
    hitboxRadius: 0.25,
    bodyRadius: 0.5,
    grazeRadius: 1.3,
    pickupRadius: 0.8,
    invulnerableTime: 1.2,
    shieldInvulnerableTime: 0.35,
    dragSensitivity: 1.05,
    keyboardSpeed: 11.3,
    followSharpness: 34,
    bankMaxDeg: 38,
    bankFullSpeed: 12,
    startHeight: 0.8,
    engines: [
      [-0.14, 0.34],
      [0.14, 0.34],
    ],
    hullBonus: -1,
    shieldBonus: 0,
    chargeBonus: 1,
    energyGain: 1.3,
    primaryDamage: 1,
    secondaryCooldown: 1,
    unlock: { sector: 3 },
  },
};

export const SHIP_ORDER: readonly ShipId[] = ['spitfire', 'executioner', 'striker'];
export const DEFAULT_SHIP: ShipId = 'spitfire';

export const PAINTS: Record<PaintId, PaintDef> = {
  orange: { id: 'orange', name: 'ORANGE', swatch: [1.0, 0.55, 0.15] },
  blue: { id: 'blue', name: 'BLUE', swatch: [0.25, 0.55, 1.0] },
  green: { id: 'green', name: 'GREEN', swatch: [0.35, 0.85, 0.35] },
};

export const PAINT_ORDER: readonly PaintId[] = ['orange', 'blue', 'green'];
export const DEFAULT_PAINT: PaintId = 'orange';

/** resources path of a ship's model file in a paint (models/ships/spitfire_orange). */
export function shipModelFile(ship: ShipId, paint: PaintId): string {
  return `${SHIPS[ship].model}_${paint}`;
}

/** resources path of the prefab inside that model (the glb's scene, named like the file). */
export function shipModel(ship: ShipId, paint: PaintId): string {
  const file = shipModelFile(ship, paint);
  return `${file}/${file.slice(file.lastIndexOf('/') + 1)}`;
}

/** Indexed by generator level - 1. */
export const GENERATOR_LEVELS: readonly GeneratorLevel[] = [
  { delay: 2.5, rate: 0.5 },
  { delay: 2.2, rate: 0.6 },
  { delay: 1.9, rate: 0.75 },
  { delay: 1.5, rate: 0.9 },
  { delay: 1.2, rate: 1.1 },
];

/** Pickup attraction radius, world units, indexed by magnet level - 1. */
export const MAGNET_RADIUS: readonly number[] = [2.4, 3.0, 3.7, 4.5, 5.5];

export const ENERGY = {
  /** Fraction of the bar per kill and per graze. */
  perKill: 0.025,
  perGraze: 0.02,
  /** Gain multiplier, indexed by energy gain level - 1. */
  gainLevels: [1, 1.25, 1.5] as readonly number[],
  maxCharges: 3,
};

export const NOVA_BOMB = {
  /** Damage to every enemy on screen. */
  damage: 30,
  invulnerableTime: 1.2,
  /** Score per enemy bullet erased. */
  bulletScore: 5,
};

/** Mission intro and outro choreography, seconds. */
export const SHIP_FLIGHT = {
  introTime: 2.2,
  /** Title banner stays this long after the ship arrives. */
  bannerTime: 2.2,
  outroDelay: 1.5,
  outroTime: 1.6,
};
