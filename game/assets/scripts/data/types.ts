// Content and tuning types. Engine-free: data modules are plain typed objects.

import type { FormationSpec } from '../core/formations';
import type { FramingSpec } from '../core/Framing';

export type Rgb = readonly [number, number, number];

export interface WorldDef {
  framing: FramingSpec;
  /** Fixed simulation step, seconds. */
  step: number;
  /** Background scroll speed, world units per second (towards +Z). */
  scrollSpeed: number;
  /** Player may not go higher than this fraction of the visible height (0 = top, 1 = bottom). */
  playerTopLimit: number;
  /** Keep this much space between the ship and the screen edges, world units. */
  playerEdgeMargin: number;
  /** Enemies spawn this far above the top edge and despawn this far below the bottom edge. */
  spawnMargin: number;
}

export interface PlayerShipDef {
  /** resources path of the ship prefab. */
  model: string;
  /** Visual size: the model is normalised to 1 unit, this scales it. */
  size: number;
  hull: number;
  hitboxRadius: number;
  /** Radius used for ramming enemies. */
  bodyRadius: number;
  invulnerableTime: number;
  /** Keyboard speed, world units per second. */
  keyboardSpeed: number;
  /** How quickly the ship catches up with the finger (higher = snappier). */
  followSharpness: number;
  /** Max roll when strafing, degrees, and the strafe speed that reaches it. */
  bankMaxDeg: number;
  bankFullSpeed: number;
  /** Start position as a fraction of the visible height from the top. */
  startHeight: number;
}

export interface BulletStream {
  /** Offset across the ship, world units. */
  x: number;
  /** Direction relative to straight up, degrees (positive = to the right). */
  angleDeg: number;
}

export interface WeaponDef {
  id: string;
  fireInterval: number;
  bulletSpeed: number;
  damage: number;
  bulletRadius: number;
  /** Visual size of the bolt. */
  bulletWidth: number;
  bulletLength: number;
  color: Rgb;
  /** Bullet pattern for Power I..IV (index 0..3). */
  powerForms: readonly (readonly BulletStream[])[];
}

export type MoveSpec =
  | { kind: 'straight'; speed: number }
  | { kind: 'sine'; speed: number; amplitude: number; frequency: number }
  /** Enters, slows down and aims at the player, then dives. */
  | { kind: 'dive'; enterSpeed: number; holdTime: number; holdDepth: number; diveSpeed: number };

export type EnemyId = 'scout' | 'dart';

export type ExplosionSize = 'small' | 'medium' | 'large';

export interface EnemyDef {
  id: EnemyId;
  model: string;
  size: number;
  hp: number;
  radius: number;
  score: number;
  /** Hull damage dealt to the player on contact (the enemy dies too). */
  contactDamage: number;
  move: MoveSpec;
  explosion: ExplosionSize;
}

export interface WaveEvent {
  t: number;
  enemy: EnemyId;
  formation: FormationSpec;
  /** Anchor X in units of the half-width at the spawn line: -1 = left edge, 1 = right edge. */
  x: number;
}
