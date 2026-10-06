// Cheat codes (data/cheats.ts) applied to the save. Engine-free.

import { CHEATS } from '../data/cheats';
import { UPGRADE_ORDER, UPGRADES } from '../data/economy';
import type { CheatDef, CheatId } from '../data/types';
import { grantCredits, upgradeLevel } from './economy';
import type { SaveData } from './save';

/** The cheat a typed code names, or null. Case and surrounding spaces don't matter. */
export function findCheat(input: string): CheatDef | null {
  const code = input.trim().toLowerCase();
  if (code.length === 0) return null;
  for (const id of Object.keys(CHEATS) as CheatId[]) if (CHEATS[id].code.toLowerCase() === code) return CHEATS[id];
  return null;
}

/** A lasting cheat already applied to this save. */
export function hasCheat(save: SaveData, id: CheatId): boolean {
  return save.cheats.indexOf(id) >= 0;
}

/** Applies a cheat to the save (mutates it). */
export function applyCheat(save: SaveData, def: CheatDef): void {
  const effect = def.effect;
  switch (effect.kind) {
    case 'credits':
      grantCredits(save, effect.amount);
      break;
    case 'arsenal':
      // Open for good (levels can be bought), and every item not owned yet gets its licence.
      if (!hasCheat(save, def.id)) save.cheats.push(def.id);
      for (const id of UPGRADE_ORDER) {
        const def = UPGRADES[id];
        if (def.group === 'systems' || def.values[0] > 0 || upgradeLevel(save, id) > 0) continue;
        save.upgrades[id] = 1;
      }
      break;
  }
}
