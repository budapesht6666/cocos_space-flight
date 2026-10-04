// Shared state handed to every gameplay system.

import type { Node } from 'cc';
import type { EventBus } from '../core/EventBus';
import type { Rng } from '../core/Rng';
import type { ExplosionSize } from '../data/types';
import type { DebugFlags } from '../debug/DebugFlags';
import type { RenderKit } from '../fx/RenderKit';
import type { Playfield } from './Playfield';

export interface GameEvents {
  enemyKilled: { x: number; z: number; score: number; explosion: ExplosionSize };
  enemyHit: { x: number; z: number };
  playerHit: { x: number; z: number; hull: number };
  playerDied: { x: number; z: number };
}

export interface GameContext {
  readonly bus: EventBus<GameEvents>;
  readonly rng: Rng;
  readonly playfield: Playfield;
  readonly kit: RenderKit;
  readonly debug: DebugFlags;
  /** Parent for all 3D gameplay nodes. */
  readonly worldRoot: Node;
  /** Freezes the simulation for a few frames to sell big impacts. */
  hitstop(seconds: number): void;
  /** Adds camera shake trauma (0..1). */
  shake(amount: number): void;
}
