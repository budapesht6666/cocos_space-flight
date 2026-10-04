// What a mission needs loaded and pooled up front, so gameplay never instantiates. Engine-free.

import { ENEMIES } from '../data/enemies';
import { SET_PIECES } from '../data/setPieces';
import type { EnemyId, MissionDef, SetPieceId } from '../data/types';
import { formationSize } from './formations';

export interface MissionNeeds {
  /** Enemy pools: how many to create up front. */
  enemies: Map<EnemyId, number>;
  /** Set pieces to build (every placement gets its own instance). */
  setPieces: Map<SetPieceId, number>;
}

/** Events closer than this (seconds) are assumed to be on screen together. */
const OVERLAP = 7;

export function missionNeeds(mission: MissionDef): MissionNeeds {
  const enemies = new Map<EnemyId, number>();
  const setPieces = new Map<SetPieceId, number>();
  const raise = (id: EnemyId, count: number): void => {
    enemies.set(id, Math.max(enemies.get(id) ?? 0, count));
  };
  const events = mission.events;

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.type === 'spawn') {
      // Everything of this kind spawned within the overlap window could be alive at once.
      let together = 0;
      for (const other of events) {
        if (other.type === 'spawn' && other.enemy === e.enemy && Math.abs(other.t - e.t) <= OVERLAP) together += formationSize(other.formation);
      }
      raise(e.enemy, together);
    } else if (e.type === 'boss') {
      raise(e.enemy, 1);
    } else if (e.type === 'setPiece') {
      setPieces.set(e.piece, (setPieces.get(e.piece) ?? 0) + 1);
    }
  }

  // Turrets: two pieces' worth at most on screen.
  for (const [id] of setPieces) {
    for (const t of SET_PIECES[id].turrets) raise(t.enemy, (enemies.get(t.enemy) ?? 0) + 1);
  }

  // Splitting enemies need their fragments too (one level deep is enough for current content).
  for (const [id, count] of Array.from(enemies)) {
    const split = ENEMIES[id].split;
    if (split) raise(split.enemy, count * split.count);
  }
  return { enemies, setPieces };
}
