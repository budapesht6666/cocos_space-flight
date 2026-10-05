// Builds what the ship brings into a mission from the hangar upgrades and the ship's own
// modifiers (GDD §6, §14). Engine-free.

import { ENERGY } from '../data/player';
import type { Loadout, PlayerShipDef } from '../data/types';
import { upgradeValue } from './economy';
import { clamp } from './math';
import type { SaveData } from './save';

export function buildLoadout(save: SaveData, ship: PlayerShipDef): Loadout {
  const maxCharges = ENERGY.maxCharges + ship.chargeBonus;
  const energyLevel = clamp(upgradeValue(save, 'energy'), 1, ENERGY.gainLevels.length);
  return {
    hull: Math.max(1, upgradeValue(save, 'hull') + ship.hullBonus),
    shield: Math.max(0, upgradeValue(save, 'shield') + ship.shieldBonus),
    generator: upgradeValue(save, 'generator'),
    magnet: upgradeValue(save, 'magnet'),
    specialCharges: Math.min(maxCharges, upgradeValue(save, 'charges') + ship.chargeBonus),
    maxCharges,
    energyGain: ENERGY.gainLevels[energyLevel - 1] * ship.energyGain,
    startPower: upgradeValue(save, 'power'),
    weaponLevel: upgradeValue(save, 'pulse'),
    primaryDamage: ship.primaryDamage,
  };
}
