// Shared state handed to every gameplay system.

import type { Node } from 'cc';
import type { EventBus } from '../core/EventBus';
import type { Rng } from '../core/Rng';
import type { Difficulty, DifficultyDef, EnemyDef, PickupKind } from '../data/types';
import type { DebugFlags } from '../debug/DebugFlags';
import type { RenderKit } from '../fx/RenderKit';
import type { Playfield } from './Playfield';

export interface EnemyKilledEvent {
  x: number;
  z: number;
  def: EnemyDef;
  /** Spawn group id, or -1. */
  group: number;
  boss: boolean;
}

export type BannerStyle = 'title' | 'warning' | 'success';

export interface GameEvents {
  enemyKilled: EnemyKilledEvent;
  /** Left the field alive (flew off screen). */
  enemyEscaped: { group: number };
  enemyHit: { x: number; z: number };
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
}

export interface GameContext {
  readonly bus: EventBus<GameEvents>;
  readonly rng: Rng;
  readonly playfield: Playfield;
  readonly kit: RenderKit;
  readonly debug: DebugFlags;
  readonly difficulty: Difficulty;
  readonly tuning: DifficultyDef;
  /** Parent for all 3D gameplay nodes. */
  readonly worldRoot: Node;
  /** Freezes the simulation for a few frames to sell big impacts. */
  hitstop(seconds: number): void;
  /** Adds camera shake trauma (0..1). */
  shake(amount: number): void;
}
