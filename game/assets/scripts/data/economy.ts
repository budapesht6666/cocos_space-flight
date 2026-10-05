// Hangar upgrades and mission rewards (GDD §14). Prices follow a ~×2.3 curve; a Normal run of a
// Sector 1 mission brings ~1,200–1,700 credits, Hard twice that. First calibration: stage 5's
// balance table revisits it.

import type { UpgradeDef, UpgradeId } from './types';

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  hull: {
    id: 'hull',
    name: 'HULL',
    group: 'systems',
    hint: 'Armour segments',
    values: [3, 4, 5, 6, 7, 8],
    costs: [300, 700, 1600, 3500, 7500],
    format: 'count',
  },
  shield: {
    id: 'shield',
    name: 'SHIELD',
    group: 'systems',
    hint: 'Soaks hits before the hull',
    values: [2, 3, 4, 5, 6],
    costs: [250, 600, 1400, 3200],
    format: 'count',
  },
  generator: {
    id: 'generator',
    name: 'GENERATOR',
    group: 'systems',
    hint: 'Shield recharges sooner',
    values: [1, 2, 3, 4, 5],
    costs: [200, 500, 1200, 2800],
    format: 'level',
  },
  magnet: {
    id: 'magnet',
    name: 'MAGNET',
    group: 'systems',
    hint: 'Pulls credits from further',
    values: [1, 2, 3, 4, 5],
    costs: [150, 400, 900, 2000],
    format: 'level',
  },
  charges: {
    id: 'charges',
    name: 'NOVA CHARGES',
    group: 'systems',
    hint: 'Nova Bombs at mission start',
    values: [1, 2, 3],
    costs: [800, 2400],
    format: 'count',
  },
  energy: {
    id: 'energy',
    name: 'ENERGY GAIN',
    group: 'systems',
    hint: 'Fills the Nova bar faster',
    values: [1, 2, 3],
    costs: [600, 1800],
    format: 'level',
  },
  power: {
    id: 'power',
    name: 'STARTING POWER',
    group: 'systems',
    hint: 'Start with more guns',
    values: [1, 2],
    costs: [2500],
    format: 'roman',
  },
  pulse: {
    id: 'pulse',
    name: 'PULSE CANNON',
    group: 'weapons',
    hint: 'Damage and fire rate',
    values: [1, 2, 3, 4, 5],
    costs: [300, 750, 1700, 3800],
    format: 'level',
  },
};

/** Hangar order. */
export const UPGRADE_ORDER: readonly UpgradeId[] = ['hull', 'shield', 'generator', 'magnet', 'charges', 'energy', 'power', 'pulse'];

/** Credits on top of what the run collected, times the difficulty's credit multiplier. */
export const REWARDS = {
  /** Every completed mission. */
  clear: 150,
  /** Each medal earned for the first time on a mission and difficulty (GDD §12). */
  firstMedal: 200,
};
