// Content and tuning types. Engine-free: data modules are plain typed objects.
//
// Normalised screen coordinates used by content: x in half-widths of the visible field
// (-1 = left edge, 1 = right edge), depth as a fraction of the visible height
// (0 = top edge, 1 = bottom edge; negative = above the screen).

import type { FormationSpec } from '../core/formations';
import type { FramingSpec } from '../core/Framing';

export type Rgb = readonly [number, number, number];

export type Difficulty = 'normal' | 'hard' | 'insane' | 'nightmare';

export interface DifficultyDef {
  /** Enemy HP multiplier. */
  hp: number;
  bulletSpeed: number;
  /** Fire rate multiplier: emitter cooldowns are divided by it. */
  fireRate: number;
  /** Pattern density steps: emitters add `densityStep` bullets per step. */
  density: number;
  credits: number;
  /** Caps the hull (Nightmare: one segment). */
  maxHull?: number;
}

export interface WorldDef {
  framing: FramingSpec;
  /** Fixed simulation step, seconds. */
  step: number;
  /** Player may not go higher than this fraction of the visible height (0 = top, 1 = bottom). */
  playerTopLimit: number;
  /** Keep this much space between the ship and the screen edges, world units. */
  playerEdgeMargin: number;
  /** Enemies spawn this far above the top edge and despawn this far below the bottom edge. */
  spawnMargin: number;
  /** Heights (y) of render layers; gameplay itself is flat. Enemy bullets sit on top of everything. */
  heights: { playerBullets: number; enemyBullets: number; pickups: number; ground: number };
  /** Enemies hold fire above this depth and below `fireMaxDepth`, so shots never come from off-screen or point-blank. */
  fireMinDepth: number;
  fireMaxDepth: number;
}

// ---------------------------------------------------------------------------------------------
// Player

export interface PlayerShipDef {
  /** resources path of the ship prefab. */
  model: string;
  /** Visual size: the model is normalised to 1 unit, this scales it. */
  size: number;
  hitboxRadius: number;
  /** Radius used for ramming enemies. */
  bodyRadius: number;
  /** Enemy bullets passing within this radius (but missing the hitbox) count as a graze. */
  grazeRadius: number;
  /** Pickups within this radius are collected. */
  pickupRadius: number;
  /** Invulnerability after a hull hit, and the short one after a shield hit. */
  invulnerableTime: number;
  shieldInvulnerableTime: number;
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

/** What the player brings into a mission. The hangar (stage 4) will build it from upgrades. */
export interface Loadout {
  hull: number;
  /** Shield capacity, units. */
  shield: number;
  /** Generator level 1..5: shield regeneration delay and rate. */
  generator: number;
  /** Magnet level 1..5: pickup attraction radius. */
  magnet: number;
  /** Special charges at mission start. */
  specialCharges: number;
  /** Energy gain level 1..3. */
  energyGain: number;
  startPower: number;
}

export interface GeneratorLevel {
  /** Seconds after a hit before the shield starts regenerating. */
  delay: number;
  /** Shield units per second while regenerating. */
  rate: number;
}

// ---------------------------------------------------------------------------------------------
// Weapons and bullets

export type WeaponId = 'pulse';

export interface BulletStream {
  /** Offset across the ship, world units. */
  x: number;
  /** Direction relative to straight up, degrees (positive = to the right). */
  angleDeg: number;
}

export interface WeaponDef {
  id: WeaponId;
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

export type EnemyBulletId = 'orb' | 'orbLarge';

export interface EnemyBulletDef {
  radius: number;
  /** Visual diameter; the glow is bigger than the hit circle. */
  size: number;
  /** Rim colour; the core is always white. */
  color: Rgb;
}

export type PatternId =
  | 'scoutShot'
  | 'gunshipBurst'
  | 'turretShot'
  | 'turretFan'
  | 'marauderFan'
  | 'marauderRing'
  | 'marauderSpiral';

/**
 * A bullet emitter (BulletML-lite). A volley is `count` bullets fanned `gapDeg` apart around a base
 * direction (or spread evenly over a full `ring`); a burst is `volleys` volleys `volleyInterval`
 * apart; bursts repeat every `cooldown`.
 * aimed = count 1, aim; spread = count n, gapDeg; ring; spiral = spinDeg per volley; burst = volleys > 1.
 */
export interface EmitterSpec {
  bullet: EnemyBulletId;
  speed: number;
  count: number;
  /** Angle between neighbouring bullets of a fan, degrees. */
  gapDeg: number;
  /** Spread the volley evenly over 360° instead of a fan. */
  ring: boolean;
  /** Aim at the player; otherwise fire straight down rotated by `angleDeg`. */
  aim: boolean;
  angleDeg: number;
  /** Rotation added after every volley, degrees (spirals). */
  spinDeg: number;
  volleys: number;
  volleyInterval: number;
  /** Pause between bursts, seconds. */
  cooldown: number;
  /** Delay before the first burst once the enemy may fire. */
  delay: number;
  /** Extra bullets per volley for each difficulty density step. */
  densityStep: number;
  /** Speed added to each following volley of a burst (layered streams). */
  speedStep: number;
}

// ---------------------------------------------------------------------------------------------
// Enemies

/** [x in half-widths, depth fraction] — see the coordinate note at the top. */
export type PathPoint = readonly [number, number];

export type MoveSpec =
  | { kind: 'straight'; speed: number }
  | { kind: 'sine'; speed: number; amplitude: number; frequency: number }
  /** Enters, slows down and aims at the player, then dives. */
  | { kind: 'dive'; enterSpeed: number; holdTime: number; holdDepth: number; diveSpeed: number }
  /** Follows a smooth curve through the points at constant speed, then keeps going straight. */
  | { kind: 'path'; speed: number; points: readonly PathPoint[] }
  /** Enters to `depth`, hovers (swaying) for `time`, then leaves (`exitSpeed` < 0 = back up). */
  | { kind: 'hover'; enterSpeed: number; depth: number; time: number; sway: number; swayFrequency: number; exitSpeed: number }
  /** Drifts down with a random sideways component and tumbles (asteroids). */
  | { kind: 'drift'; speed: number; spreadX: number; spin: number }
  /** Moves with the level's ground (turrets on set pieces). */
  | { kind: 'ground' };

export type EnemyLook =
  | { kind: 'model'; path: string; size: number }
  /** Procedural low-poly rock (placeholder until an asteroid asset is chosen). */
  | { kind: 'rock'; size: number }
  /** Turret built from primitives (placeholder); its head turns to aim. */
  | { kind: 'turret'; size: number };

export type EnemyId = 'scout' | 'dart' | 'gunship' | 'asteroid' | 'rock' | 'turret' | 'marauder';

export type ExplosionSize = 'small' | 'medium' | 'large';

export interface AttackRef {
  pattern: PatternId;
  /** Only from this difficulty up (e.g. Scouts shoot from Hard). */
  minDifficulty?: Difficulty;
  /** Simple boss phases: active only while the HP fraction is ≤ hpBelow and > hpAbove. */
  hpBelow?: number;
  hpAbove?: number;
}

export interface DropSpec {
  credits: number;
  bigCredits: number;
  /** Optional rarer pickup. */
  extra?: { kind: PickupKind; chance: number };
}

export interface EnemyDef {
  id: EnemyId;
  /** Shown on the boss bar. */
  name: string;
  look: EnemyLook;
  hp: number;
  radius: number;
  score: number;
  move: MoveSpec;
  attacks: readonly AttackRef[];
  drops: DropSpec;
  explosion: ExplosionSize;
  /** Sits on a set piece below the flight plane: bullets hit it, the ship flies over it. */
  ground?: boolean;
  /** Obstacles (asteroids) don't count towards the kill rate. */
  obstacle?: boolean;
  /** Breaks into smaller enemies on death. */
  split?: { enemy: EnemyId; count: number; speed: number };
}

// ---------------------------------------------------------------------------------------------
// Pickups

export type PickupKind = 'credit' | 'bigCredit' | 'power' | 'repair' | 'shield' | 'energy';

export interface PickupDef {
  kind: PickupKind;
  /** Credits value (0 for power-ups). */
  credits: number;
  size: number;
  color: Rgb;
  /** Letter on the badge; credits are spinning cubes instead. */
  letter?: string;
}

// ---------------------------------------------------------------------------------------------
// Levels

export type MissionId = 's1m1';
export type SetPieceId = 'outpost' | 'relay';

export interface SpawnEvent {
  t: number;
  type: 'spawn';
  enemy: EnemyId;
  formation: FormationSpec;
  /** Anchor X in half-widths at the spawn line. Path movers start at their first point instead. */
  x: number;
  /** Overrides the enemy's own movement (e.g. Scouts flying a path). */
  move?: MoveSpec;
  /** Mirror left-right (paths, sine phase, anchor). */
  mirror?: boolean;
  /** Seconds between members: they spawn one after another (use with formation 'trail'). */
  stagger?: number;
  /** Dropped where the last member dies if the whole group is destroyed. */
  bonus?: PickupKind;
  minDifficulty?: Difficulty;
}

export interface SetPieceEvent {
  t: number;
  type: 'setPiece';
  piece: SetPieceId;
  x: number;
}

/** Stops the timeline clock until no enemies are left (or `timeout` seconds pass). */
export interface WaitClearEvent {
  t: number;
  type: 'waitClear';
  timeout?: number;
}

/** WARNING banner, then the boss; the timeline waits until it is destroyed. */
export interface BossEvent {
  t: number;
  type: 'boss';
  enemy: EnemyId;
  x: number;
}

export type LevelEvent = SpawnEvent | SetPieceEvent | WaitClearEvent | BossEvent;

export interface MissionDef {
  id: MissionId;
  title: string;
  subtitle: string;
  /** Background (stars, nebula) scroll speed, world units per second. */
  scrollSpeed: number;
  /** Set pieces and ground targets scroll slower, so turrets get time to fight. */
  groundSpeed: number;
  events: readonly LevelEvent[];
}

export interface SetPieceBlock {
  /** Centre relative to the piece, world units; y is the top surface height above the ground. */
  x: number;
  z: number;
  w: number;
  l: number;
  h: number;
  tone: 'hull' | 'dark' | 'trim';
}

export interface SetPieceDef {
  id: SetPieceId;
  /** Extent along Z, world units. */
  length: number;
  blocks: readonly SetPieceBlock[];
  lights: readonly { x: number; z: number; size: number; color: Rgb }[];
  turrets: readonly { enemy: EnemyId; x: number; z: number }[];
}
