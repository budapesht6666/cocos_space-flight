// Cheat codes, typed on the menu's CHEATS page. They change the save for good (no practice flag):
// they are the owner's shortcuts for trying the arsenal, not a debug mode.

import type { CheatDef, CheatId } from './types';

export const CHEATS: Record<CheatId, CheatDef> = {
  arsenal: { id: 'arsenal', code: 'p1gog.weapon', effect: { kind: 'arsenal' }, message: 'ARSENAL UNLOCKED' },
  credits: { id: 'credits', code: 'p1gog.credits', effect: { kind: 'credits', amount: 50000 }, message: '+50,000 CREDITS' },
};
