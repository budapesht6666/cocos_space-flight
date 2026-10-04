// Which medals a finished run earns (GDD §12). Engine-free. Medals are stored as a bit mask.

import { HUNTER_RATE } from '../data/medals';
import type { MedalId } from '../data/types';

export interface MedalStats {
  complete: boolean;
  /** Non-obstacle enemies destroyed and spawned. */
  kills: number;
  spawned: number;
  pods: number;
  podsTotal: number;
  hullLost: number;
}

export const MEDAL_BITS: Record<MedalId, number> = { hunter: 1, exterminator: 2, rescuer: 4, untouchable: 8 };

export function killRate(kills: number, spawned: number): number {
  return spawned > 0 ? Math.min(1, kills / spawned) : 1;
}

/** Medals earned by one run, as a bit mask. A failed mission earns nothing. */
export function earnedMedals(s: MedalStats): number {
  if (!s.complete) return 0;
  let mask = 0;
  const rate = killRate(s.kills, s.spawned);
  if (rate >= HUNTER_RATE) mask |= MEDAL_BITS.hunter;
  if (s.kills >= s.spawned) mask |= MEDAL_BITS.exterminator;
  if (s.podsTotal > 0 && s.pods >= s.podsTotal) mask |= MEDAL_BITS.rescuer;
  if (s.hullLost === 0) mask |= MEDAL_BITS.untouchable;
  return mask;
}

export function hasMedal(mask: number, id: MedalId): boolean {
  return (mask & MEDAL_BITS[id]) !== 0;
}

export function medalCount(mask: number): number {
  let n = 0;
  for (let m = mask & 15; m !== 0; m &= m - 1) n++;
  return n;
}
