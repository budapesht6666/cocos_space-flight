// Shared state handed to every gameplay system.

import type { Node } from 'cc';
import type { EventBus } from '../core/EventBus';
import type { Rng } from '../core/Rng';
import type { DecorFieldId, Difficulty, DifficultyDef, EliteDef, EnemyDef, PickupKind } from '../data/types';
import type { DebugFlags } from '../debug/DebugFlags';
import type { RenderKit } from '../fx/RenderKit';
import type { Playfield } from './Playfield';

export interface EnemyKilledEvent {
  x: number;
  z: number;
  def: EnemyDef;
  /** Spawn group id, or -1. */
  group: number;
  /** Set piece instance it stood on, or -1 (escape pods). */
  site: number;
  boss: boolean;
  /** A destructible part of a bigger enemy. */
  part: boolean;
  elite: EliteDef | null;
}

export type BannerStyle = 'title' | 'warning' | 'success';

export interface GameEvents {
  enemyKilled: EnemyKilledEvent;
  /** Left the field alive (flew off screen). */
  enemyEscaped: { group: number; site: number };
  /** `armored`: the hit was soaked by armour (core with live parts). */
  enemyHit: { x: number; z: number; armored: boolean };
  /** An elite's energy shield collapsed. */
  enemyShieldBroken: { x: number; z: number };
  /** A boss lost its last part: the core is exposed. */
  armorBroken: { x: number; z: number };
  /** A hull segment lost. */
  playerHit: { x: number; z: number; hull: number };
  shieldHit: { x: number; z: number; shield: number };
  playerDied: { x: number; z: number };
  graze: { x: number; z: number };
  pickupCollected: { kind: PickupKind; x: number; z: number };
  /** Score that isn't a kill: wasted pickups, erased bullets. */
  scoreBonus: { amount: number };
  novaBomb: { x: number; z: number };
  banner: { text: string; sub: string; style: BannerStyle; time: number };
  /** Background scenery starts drifting past. */
  decor: { field: DecorFieldId; duration: number };
  /** Escape pods launched by a station whose guns were all destroyed. */
  podsLaunched: { count: number; x: number; z: number };
  /** A pod fell off the screen. */
  podLost: { x: number; z: number };
}

/** What background systems (nebula, stars) need; the start screen builds one without a game. */
export interface BackdropContext {
  readonly rng: Rng;
  readonly playfield: Playfield;
  readonly kit: RenderKit;
  /** Parent for all 3D nodes. */
  readonly worldRoot: Node;
}

export interface GameContext extends BackdropContext {
  readonly bus: EventBus<GameEvents>;
  readonly debug: DebugFlags;
  readonly difficulty: Difficulty;
  readonly tuning: DifficultyDef;
  /** Freezes the simulation for a few frames to sell big impacts. */
  hitstop(seconds: number): void;
  /** Adds camera shake trauma (0..1). */
  shake(amount: number): void;
}
