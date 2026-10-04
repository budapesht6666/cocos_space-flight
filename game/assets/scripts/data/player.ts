import type { GeneratorLevel, Loadout, PlayerShipDef } from './types';

export const SPITFIRE: PlayerShipDef = {
  model: 'models/ships/spitfire_orange/spitfire_orange',
  size: 1.5,
  hitboxRadius: 0.25,
  bodyRadius: 0.55,
  grazeRadius: 1.0,
  pickupRadius: 0.8,
  invulnerableTime: 1.5,
  shieldInvulnerableTime: 0.35,
  keyboardSpeed: 9,
  followSharpness: 28,
  bankMaxDeg: 32,
  bankFullSpeed: 12,
  startHeight: 0.8,
};

/** Starting loadout until the hangar exists (stage 4). */
export const DEFAULT_LOADOUT: Loadout = {
  hull: 3,
  shield: 2,
  generator: 1,
  magnet: 1,
  specialCharges: 1,
  energyGain: 1,
  startPower: 1,
};

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
