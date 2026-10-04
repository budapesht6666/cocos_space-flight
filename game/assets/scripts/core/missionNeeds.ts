// What a mission needs loaded and pooled up front, so gameplay never instantiates. Engine-free.

import { ENEMIES } from '../data/enemies';
import { PICKUPS } from '../data/pickups';
import { SET_PIECES } from '../data/setPieces';
import type { EnemyId, MissionDef, PickupKind, PropId, SetPieceId } from '../data/types';
import { formationSize } from './formations';

export interface MissionNeeds {
  /** Enemy pools: how many to create up front. */
  enemies: Map<EnemyId, number>;
  /** Set pieces to build (every placement gets its own instance). */
  setPieces: Map<SetPieceId, number>;
  /** Prop models to load: prop-look enemies, station modules, pickup icons. */
  props: Set<PropId>;
}

/**
 * Events closer than this (seconds) are assumed to be on screen together. Generous on purpose:
 * hovering Gunships live ~10 s, and a pool that grows mid-fight means an instantiate hitch.
 */
const OVERLAP = 12;

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

  const props = new Set<PropId>();
  for (const [id] of enemies) {
    const look = ENEMIES[id].look;
    if (look.kind === 'prop') props.add(look.prop);
  }
  for (const [id] of setPieces) for (const m of SET_PIECES[id].modules) props.add(m.prop);
  for (const kind of Object.keys(PICKUPS) as PickupKind[]) {
    const prop = PICKUPS[kind].prop;
    if (prop) props.add(prop);
  }
  return { enemies, setPieces, props };
}
