// What a mission needs loaded and pooled up front, so gameplay never instantiates. Engine-free.

import { ENEMIES } from '../data/enemies';
import { PICKUPS } from '../data/pickups';
import { propPath } from '../data/props';
import { SET_PIECES } from '../data/setPieces';
import type { EnemyId, MissionDef, PickupKind, PropId, SetPieceId } from '../data/types';
import { formationSize } from './formations';

export interface MissionNeeds {
  /** Enemy pools: how many to create up front. */
  enemies: Map<EnemyId, number>;
  /** Set pieces to build (every placement gets its own instance). */
  setPieces: Map<SetPieceId, number>;
  /** Prop models to load: prop-look enemies, boss assemblies, station modules, pickup icons. */
  props: Set<PropId>;
  /** Escape pods the mission offers (Rescuer medal). */
  pods: number;
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

  // Splitting enemies need their fragments, bosses their parts (one level deep is enough).
  for (const [id, count] of Array.from(enemies)) {
    const def = ENEMIES[id];
    if (def.split) raise(def.split.enemy, count * def.split.count);
    if (def.parts) {
      const perParent = new Map<EnemyId, number>();
      for (const part of def.parts) perParent.set(part.enemy, (perParent.get(part.enemy) ?? 0) + 1);
      for (const [part, n] of perParent) raise(part, (enemies.get(part) ?? 0) + n * count);
    }
  }

  const props = new Set<PropId>();
  for (const [id] of enemies) {
    const look = ENEMIES[id].look;
    if (look.kind === 'prop') props.add(look.prop);
    if (look.kind === 'assembly') for (const m of look.modules) props.add(m.prop);
  }
  for (const [id] of setPieces) for (const m of SET_PIECES[id].modules) props.add(m.prop);
  for (const kind of Object.keys(PICKUPS) as PickupKind[]) {
    const prop = PICKUPS[kind].prop;
    if (prop) props.add(prop);
  }
  return { enemies, setPieces, props, pods: countPods(mission) };
}

/** resources path of an enemy's prefab; null for looks built from props or procedural meshes. */
export function enemyPrefabPath(id: EnemyId): string | null {
  const look = ENEMIES[id].look;
  return look.kind === 'model' ? look.path : look.kind === 'prop' ? propPath(look.prop) : null;
}

/** Every prefab a mission loads (enemies, station modules, pickup icons), for preloading. */
export function missionPrefabPaths(needs: MissionNeeds): string[] {
  const paths: string[] = [];
  for (const [id] of needs.enemies) {
    const path = enemyPrefabPath(id);
    if (path) paths.push(path);
  }
  for (const id of needs.props) paths.push(propPath(id));
  return paths;
}

/** Escape pods offered by a mission: every set piece launches its pods once its turrets fall. */
export function countPods(mission: MissionDef): number {
  let pods = 0;
  for (const e of mission.events) if (e.type === 'setPiece') pods += SET_PIECES[e.piece].pods?.count ?? 0;
  return pods;
}
