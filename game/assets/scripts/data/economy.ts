// Hangar upgrades, the arsenal's prices and unlocks, and mission rewards (GDD §7, §14). Prices
// follow a ~×2.3 curve; a Normal run of a Sector 1 mission brings ~1,200–1,700 credits, Hard twice
// that. docs/BALANCE.md (npm run balance) adds it all up.
//
// Arsenal items are upgrade tracks too: level 0 = not owned, the first price is the licence.
// Sector 1 opens the basics mission by mission; the rest comes with Sectors 2 and 3 (GDD §14).

import type { ArsenalSlot, UnlockReq, UpgradeDef, UpgradeId } from './types';

/** Weapon levels 2..5 after the licence. */
const GUN_LEVELS = [400, 900, 2000, 4200];
/** Drone levels 2..3 after the licence. */
const DRONE_LEVELS = [1500, 3500];

function gun(id: UpgradeId, group: ArsenalSlot, name: string, hint: string, licence: number, unlock: UnlockReq): UpgradeDef {
  return { id, name, group, hint, values: [0, 1, 2, 3, 4, 5], costs: [licence].concat(GUN_LEVELS), format: 'level', unlock };
}

function drone(id: UpgradeId, name: string, hint: string, licence: number, unlock: UnlockReq): UpgradeDef {
  return { id, name, group: 'drone', hint, values: [0, 1, 2, 3], costs: [licence].concat(DRONE_LEVELS), format: 'level', unlock };
}

function special(id: UpgradeId, name: string, hint: string, licence: number, unlock: UnlockReq): UpgradeDef {
  return { id, name, group: 'special', hint, values: [0, 1], costs: [licence], format: 'level', unlock };
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  hull: {
    id: 'hull',
    name: 'HULL',
    group: 'systems',
    hint: 'Armour segments',
    values: [3, 4, 5, 6, 7, 8],
    costs: [300, 700, 1600, 3500, 7500],
    format: 'count',
    unlock: null,
  },
  shield: {
    id: 'shield',
    name: 'SHIELD',
    group: 'systems',
    hint: 'Soaks hits before the hull',
    values: [2, 3, 4, 5, 6],
    costs: [250, 600, 1400, 3200],
    format: 'count',
    unlock: null,
  },
  generator: {
    id: 'generator',
    name: 'GENERATOR',
    group: 'systems',
    hint: 'Shield recharges sooner',
    values: [1, 2, 3, 4, 5],
    costs: [200, 500, 1200, 2800],
    format: 'level',
    unlock: null,
  },
  magnet: {
    id: 'magnet',
    name: 'MAGNET',
    group: 'systems',
    hint: 'Pulls credits from further',
    values: [1, 2, 3, 4, 5],
    costs: [150, 400, 900, 2000],
    format: 'level',
    unlock: null,
  },
  charges: {
    id: 'charges',
    name: 'SPECIAL CHARGES',
    group: 'systems',
    hint: 'Special charges at mission start',
    values: [1, 2, 3],
    costs: [800, 2400],
    format: 'count',
    unlock: null,
  },
  energy: {
    id: 'energy',
    name: 'ENERGY GAIN',
    group: 'systems',
    hint: 'Fills the Special bar faster',
    values: [1, 2, 3],
    costs: [600, 1800],
    format: 'level',
    unlock: null,
  },
  power: {
    id: 'power',
    name: 'STARTING POWER',
    group: 'systems',
    hint: 'Start with more guns',
    values: [1, 2],
    costs: [2500],
    format: 'roman',
    unlock: null,
  },
  droneBay: {
    id: 'droneBay',
    name: 'DRONE BAY',
    group: 'drone',
    hint: 'Drones you can fly with',
    values: [0, 1, 2],
    costs: [1500, 4500],
    format: 'count',
    unlock: { mission: 's1m2' },
  },

  // Primary weapons. Pulse Cannon is owned from the start (values 1..5).
  pulse: {
    id: 'pulse',
    name: 'PULSE CANNON',
    group: 'primary',
    hint: 'Fast straight bolts',
    values: [1, 2, 3, 4, 5],
    costs: [300, 750, 1700, 3800],
    format: 'level',
    unlock: null,
  },
  scatter: gun('scatter', 'primary', 'SCATTER GUN', 'Wide spread, best up close', 800, { mission: 's1m1' }),
  seeker: gun('seeker', 'primary', 'SEEKER MISSILES', 'Homing missiles, safe play', 1500, { mission: 's1m2' }),
  ion: gun('ion', 'primary', 'ION LASER', 'Piercing beam, cuts armour', 2400, { mission: 's1m3' }),
  plasma: gun('plasma', 'primary', 'PLASMA ORBS', 'Slow orbs, splash damage', 3200, { mission: 's2m1' }),
  tesla: gun('tesla', 'primary', 'TESLA ARC', 'Chain lightning, short range', 4000, { mission: 's2m3' }),

  // Secondary weapons.
  swarm: gun('swarm', 'secondary', 'SWARM ROCKETS', 'Homing salvo every 3 s', 900, { mission: 's1m1' }),
  wing: gun('wing', 'secondary', 'WING CANNONS', 'Diagonal bursts guard the flanks', 1400, { mission: 's1m2' }),
  rail: gun('rail', 'secondary', 'RAIL LANCE', 'Huge piercing shot every 3 s', 2400, { mission: 's1m3' }),
  rear: gun('rear', 'secondary', 'REAR GUNS', 'Fire back and to the sides', 2600, { mission: 's2m2' }),

  // Drones (the Drone Bay sets how many fly).
  gunDrone: drone('gunDrone', 'GUN DRONE', 'Adds a share of your Primary', 1200, { mission: 's1m2' }),
  guardian: drone('guardian', 'GUARDIAN DRONE', 'Circles you, blocks a bullet', 2000, { mission: 's1m3' }),
  collector: drone('collector', 'COLLECTOR DRONE', 'Fetches credits and pickups', 2400, { mission: 's2m2' }),

  // Specials. Nova Bomb is owned from the start.
  nova: {
    id: 'nova',
    name: 'NOVA BOMB',
    group: 'special',
    hint: 'Clears bullets, hits everything',
    values: [1],
    costs: [],
    format: 'level',
    unlock: null,
  },
  overdrive: special('overdrive', 'OVERDRIVE', '6 s of Power IV and faster fire', 1600, { mission: 's1m2' }),
  phase: special('phase', 'PHASE SHIELD', '4 s untouchable, ramming hurts', 2200, { mission: 's1m3' }),
  warp: special('warp', 'TIME WARP', '5 s of enemies at half speed', 3600, { mission: 's3m1' }),
};

/** Hangar order (systems, then each arsenal slot). */
export const UPGRADE_ORDER: readonly UpgradeId[] = [
  'hull', 'shield', 'generator', 'magnet', 'charges', 'energy', 'power',
  'pulse', 'scatter', 'seeker', 'ion', 'plasma', 'tesla',
  'swarm', 'wing', 'rail', 'rear',
  'droneBay', 'gunDrone', 'guardian', 'collector',
  'nova', 'overdrive', 'phase', 'warp',
];

/** The most credits a wallet (and the lifetime total) can hold: keeps the numbers printable and finite. */
export const WALLET_CAP = 1000000000;

/** Credits on top of what the run collected, times the difficulty's credit multiplier. */
export const REWARDS = {
  /** Every completed mission. */
  clear: 150,
  /** Each medal earned for the first time on a mission and difficulty (GDD §12). */
  firstMedal: 200,
};
