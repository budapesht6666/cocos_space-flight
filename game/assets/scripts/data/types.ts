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
  /** Chance that a wave enemy spawns as an elite (GDD §9), and optional weight overrides. */
  eliteChance: number;
  eliteWeights?: Partial<Record<EliteId, number>>;
  /** What sets it apart, shown on the mission page until it is cleared there. */
  note: string;
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

export type ShipId = 'spitfire' | 'executioner' | 'striker';

/** Hangar paints (cosmetic). Red and Purple stay enemy colours (GDD §6). */
export type PaintId = 'orange' | 'blue' | 'green';

export interface PaintDef {
  id: PaintId;
  name: string;
  /** Swatch colour in the hangar. */
  swatch: Rgb;
}

export interface PlayerShipDef {
  id: ShipId;
  name: string;
  /** Short role line for the hangar. */
  role: string;
  /** resources path of the ship prefabs without the paint: `${model}_${paint}`. */
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
  /** Ship travel per finger travel (1 = the ship moves the same fraction of the screen as the finger). */
  dragSensitivity: number;
  /** Keyboard speed, world units per second. */
  keyboardSpeed: number;
  /** How quickly the ship catches up with the finger (higher = snappier). */
  followSharpness: number;
  /** Max roll when strafing, degrees, and the strafe speed that reaches it. */
  bankMaxDeg: number;
  bankFullSpeed: number;
  /** Start position as a fraction of the visible height from the top. */
  startHeight: number;
  /** Engine nozzles on the normalised model: [x across, z towards the tail]. */
  engines: readonly (readonly [number, number])[];
  /** Added on top of the hangar's hull and shield (GDD §6). */
  hullBonus: number;
  shieldBonus: number;
  /** Extra Special charges, both at the start and on top of the maximum. */
  chargeBonus: number;
  /** Multipliers: Energy gain, Primary damage, Secondary cooldown. */
  energyGain: number;
  primaryDamage: number;
  secondaryCooldown: number;
  /** What opens the ship (like the arsenal: a mission cleared or medals earned); null = from the start. */
  unlock: UnlockReq | null;
}

/** An item in a slot and its hangar level (1..5 for guns, 1..3 for drones). */
export interface Equipped<Id> {
  id: Id;
  level: number;
}

/** What the player brings into a mission: hangar upgrades plus the ship's own modifiers. */
export interface Loadout {
  hull: number;
  /** Shield capacity, units. */
  shield: number;
  /** Generator level 1..5: shield regeneration delay and rate. */
  generator: number;
  /** Magnet level 1..5: pickup attraction radius. */
  magnet: number;
  /** Special charges at mission start, and the most it can hold. */
  specialCharges: number;
  maxCharges: number;
  /** Energy gain multiplier. */
  energyGain: number;
  startPower: number;
  /** The four slots (GDD §7). */
  primary: Equipped<PrimaryId>;
  secondary: Equipped<SecondaryId> | null;
  drones: readonly Equipped<DroneId>[];
  special: SpecialId;
  /** Ship modifiers: Primary damage and Secondary cooldown multipliers. */
  primaryDamage: number;
  secondaryCooldown: number;
}

export interface GeneratorLevel {
  /** Seconds after a hit before the shield starts regenerating. */
  delay: number;
  /** Shield units per second while regenerating. */
  rate: number;
}

// ---------------------------------------------------------------------------------------------
// Weapons and bullets

export type PrimaryId = 'pulse' | 'scatter' | 'ion' | 'seeker' | 'plasma' | 'tesla';
export type SecondaryId = 'swarm' | 'wing' | 'rail' | 'rear';
export type WeaponId = PrimaryId | SecondaryId;
export type DroneId = 'gunDrone' | 'guardian' | 'collector';
export type SpecialId = 'nova' | 'overdrive' | 'phase' | 'warp';
/** Everything that goes into the four slots. */
export type ArsenalId = WeaponId | DroneId | SpecialId;
export type ArsenalSlot = 'primary' | 'secondary' | 'drone' | 'special';

/** Player projectile looks; each is one shared instanced material (one draw call). */
export type BoltId = 'pulse' | 'pellet' | 'missile' | 'plasma' | 'rocket' | 'wing' | 'rail' | 'rear' | 'drone';

export interface BoltDef {
  /** Visual size, world units (round looks use `width` for both). */
  width: number;
  length: number;
  color: Rgb;
  /** Glow intensity (1 = normal, 2+ = white-hot). */
  intensity: number;
  /** Round orbs don't turn along their flight. */
  round: boolean;
  /** Made up front when a loadout uses it (peak alive at weapon level 5, Power IV). */
  pool: number;
}

export interface BulletStream {
  /** Offset across the ship, world units. */
  x: number;
  /** Offset towards the tail from the nose, world units (wing guns, rear guns). */
  z?: number;
  /** Direction relative to straight up, degrees (positive = to the right). */
  angleDeg: number;
}

/** What one weapon level (bought in the hangar) multiplies. */
export interface WeaponLevel {
  damage: number;
  /** Fire rate multiplier: the fire interval is divided by it. */
  rate: number;
}

/** One Power level of a bolt weapon. */
export interface BoltForm {
  streams: readonly BulletStream[];
  /** Damage multiplier of this Power level. */
  damage?: number;
  /** Visual size and hit radius multiplier. */
  scale?: number;
  /** Splash radius around every hit, world units (Plasma Orbs). */
  splash?: number;
}

/**
 * Projectile weapons: Pulse Cannon, Scatter Gun, Seeker Missiles, Plasma Orbs and all Secondaries.
 * Each shot fires the current Power form; a `burst` fires it `count` times `gap` seconds apart.
 */
export interface BoltWeaponDef {
  kind: 'bolts';
  id: WeaponId;
  bolt: BoltId;
  /** Seconds between shots (or bursts) at weapon level 1. */
  interval: number;
  burst?: { count: number; gap: number };
  speed: number;
  /** Per bolt at weapon level 1. */
  damage: number;
  radius: number;
  /** Power I..IV (index 0..3). */
  forms: readonly BoltForm[];
  /** Flight time before the bolt fizzles out (range), seconds; none = until it leaves the screen. */
  life?: number;
  /** Damage left at the end of `life` (Scatter Gun loses punch with distance). */
  falloff?: number;
  /** Enemies one bolt can hit (default 1). */
  pierce?: number;
  /** Fraction of a hit's damage dealt to every other enemy within the form's `splash` radius. */
  splashDamage?: number;
  /** Homing after `delay` seconds of straight flight, turning at most `turnRate` degrees per second. */
  homing?: { turnRate: number; delay: number };
  /** Random spread per bolt, ± degrees. */
  jitterDeg?: number;
  /** Fraction of a boss core's armour the hits ignore. */
  armorPierce?: number;
}

/** One Power level of the Ion Laser: the main beam and, from IV, two angled side beams. */
export interface BeamForm {
  width: number;
  damage: number;
  side?: { angleDeg: number; offset: number; width: number; damage: number };
}

/** Continuous piercing beam (Ion Laser): `dps` to everything it touches. */
export interface BeamWeaponDef {
  kind: 'beam';
  id: WeaponId;
  dps: number;
  armorPierce: number;
  color: Rgb;
  forms: readonly BeamForm[];
}

/** Lightning that strikes the nearest enemy and jumps on (Tesla Arc). */
export interface ChainWeaponDef {
  kind: 'chain';
  id: WeaponId;
  interval: number;
  /** To the first target; every jump multiplies it by `decay`. */
  damage: number;
  decay: number;
  /** Reach of the first strike from the nose, and of each jump. */
  range: number;
  jump: number;
  color: Rgb;
  forms: readonly { targets: number; damage: number }[];
}

export type WeaponDef = BoltWeaponDef | BeamWeaponDef | ChainWeaponDef;

/** What every drone has: its model (a prop, normalised to 1 unit), size and glow colour. */
interface DroneLook {
  id: DroneId;
  prop: PropId;
  size: number;
  color: Rgb;
}

/** Drones fly with the ship (GDD §7); `level` (1..3) scales them through `levels`. */
export type DroneDef =
  /** Fires straight bolts worth `share` of the Primary's damage per second. */
  | (DroneLook & { kind: 'gun'; interval: number; speed: number; radius: number; levels: readonly { share: number }[] })
  /** Circles the ship and blocks one enemy bullet, then recharges. */
  | (DroneLook & { kind: 'guardian'; orbit: number; spin: number; block: number; levels: readonly { recharge: number }[] })
  /** Flies out to pickups and sends whatever is within `reach` to the ship. */
  | (DroneLook & { kind: 'collector'; reach: number; levels: readonly { speed: number }[] });

/** Specials spend a charge (GDD §7). */
export type SpecialDef =
  | { kind: 'nova'; id: SpecialId; label: string; damage: number; invulnerableTime: number; bulletScore: number }
  /** Power IV and faster fire for `time` seconds. */
  | { kind: 'overdrive'; id: SpecialId; label: string; time: number; rate: number }
  /** Invulnerable for `time` seconds; touching enemies takes `ramDps`, bullets that touch the bubble pop. */
  | { kind: 'phase'; id: SpecialId; label: string; time: number; ramDps: number; radius: number }
  /** Enemies, their bullets and the level run at `scale` speed for `time` seconds. */
  | { kind: 'warp'; id: SpecialId; label: string; time: number; scale: number };

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
  | 'marauderSpiral'
  | 'volatileRing'
  | 'dreadnoughtGun'
  | 'dreadnoughtBroadside'
  | 'dreadnoughtLance'
  | 'dreadnoughtBarrage'
  | 'wardenPod'
  | 'wardenAimed'
  | 'wardenRings'
  | 'wardenFlower'
  | 'wardenSpiral'
  // Sector 2: Ice Moons.
  | 'spinnerSpiral'
  | 'spinnerRing'
  | 'splitterShot'
  | 'mineBurst'
  | 'cycloneSpiral'
  | 'cycloneRing'
  | 'cycloneStorm'
  | 'shattererFan'
  | 'shattererRain'
  | 'shattererRings'
  | 'hiveFan'
  | 'hiveRing'
  | 'hiveSpiral'
  // Sector 3: Nebula Drift.
  | 'carrierGuns'
  | 'lancerShot'
  | 'arbiterFan'
  | 'arbiterRing'
  | 'broodBroadside'
  | 'broodLance'
  | 'broodBarrage'
  | 'segmentShot'
  | 'segmentRing'
  | 'leviathanFan'
  | 'leviathanRings'
  | 'leviathanSpiral';

export type LaserId = 'lancerBeam' | 'arbiterBeam' | 'arbiterTwin' | 'arbiterSweep' | 'leviathanBeam' | 'leviathanSweep';

/**
 * An enemy laser: a thin warning line for `warn` seconds (aimed at the player when it starts),
 * then a beam `width` wide for `fire` seconds that hits the ship anywhere along it; `count` beams
 * fan `gapDeg` apart. `sweepDeg` turns the beam while it fires (degrees per second, alternating
 * direction each shot). Cooldowns scale with the difficulty's fire rate, warnings never do.
 */
export interface LaserSpec {
  warn: number;
  fire: number;
  width: number;
  length: number;
  count: number;
  gapDeg: number;
  /** Aim at the player when the warning starts; otherwise straight down rotated by `angleDeg`. */
  aim: boolean;
  angleDeg: number;
  sweepDeg: number;
  /** Seconds between the end of one shot and the next warning, and before the first. */
  cooldown: number;
  delay: number;
}

export interface LaserRef {
  laser: LaserId;
  minDifficulty?: Difficulty;
  hpBelow?: number;
  hpAbove?: number;
}

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
  | { kind: 'ground' }
  /** A destructible part riding on its parent (EnemyDef.parts); placed by the enemy system. */
  | { kind: 'attached' }
  /**
   * Splitter shards: fly out with the velocity they were flung at, then home in on the ship for
   * `homeTime` seconds (turning at most `turn` degrees per second) at `speed`, then fly straight.
   */
  | { kind: 'shard'; speed: number; turn: number; homeTime: number }
  /**
   * A serpent (the Leviathan): enters to `depth`, then swims a figure eight `width` half-widths
   * wide and `height` (depth fraction) tall every `period` seconds. Its parts trail behind it,
   * `spacing` units apart, along the path it swam.
   */
  | { kind: 'serpent'; enterSpeed: number; depth: number; width: number; height: number; period: number; spacing: number };

/** Props built by tools/assets/build-props.mjs: one vertex-coloured mesh each (models/props/<id>). */
export type PropId =
  | 'station_platform'
  | 'station_hangar'
  | 'station_corridor'
  | 'station_generator'
  | 'station_dish'
  | 'station_frame'
  | 'station_dome'
  | 'station_hub'
  | 'station_hangarLarge'
  | 'station_pad'
  | 'station_tank'
  | 'station_pipe'
  | 'station_lattice'
  | 'station_ore'
  | 'station_hauler'
  | 'hull_tank'
  | 'hull_pipe'
  | 'turret_single'
  | 'turret_double'
  | 'pickup_power'
  | 'pickup_repair'
  | 'pickup_shield'
  | 'pickup_energy'
  | 'drone_gun'
  | 'drone_guardian'
  | 'drone_collector';

export type EnemyLook =
  /** A ship model with its own textured material. */
  | { kind: 'model'; path: string; size: number }
  /** A prop (shared vertex-colour material); `aim` names the child node that turns towards the player. */
  | { kind: 'prop'; prop: PropId; size: number; aim?: string }
  /** Procedural low-poly rock (ice in the Ice Moons: its own `color`). */
  | { kind: 'rock'; size: number; color?: Rgb; metallic?: number; roughness?: number }
  /** Procedural spiked mine with a blinking beacon. */
  | { kind: 'mine'; size: number }
  /** Station modules put together (boss hulls); `size` scales the whole assembly. */
  | { kind: 'assembly'; size: number; modules: readonly AssemblyModule[]; lights: readonly GlowSpot[] };

/** A station module inside an assembly, world units relative to the centre (+Z = down the screen). */
export interface AssemblyModule {
  prop: PropId;
  x: number;
  z: number;
  y?: number;
  /** Turn around Y, degrees. */
  rot?: number;
  /** Horizontal scale of the pack's tile units (default STATION_TILE) and vertical squash (default 0.6). */
  scale?: number;
  height?: number;
}

export interface GlowSpot {
  x: number;
  z: number;
  y?: number;
  size: number;
  color: Rgb;
}

export type EnemyId =
  | 'scout'
  | 'dart'
  | 'gunship'
  | 'asteroid'
  | 'rock'
  | 'turret'
  | 'turretHeavy'
  | 'marauder'
  | 'dreadnought'
  | 'dreadnoughtGun'
  | 'warden'
  | 'wardenPod'
  // Sector 2.
  | 'iceRock'
  | 'iceChip'
  | 'spinner'
  | 'splitter'
  | 'shard'
  | 'mine'
  | 'swarmer'
  | 'cyclone'
  | 'shatterer'
  | 'hiveMother'
  // Sector 3.
  | 'lancer'
  | 'carrier'
  | 'arbiter'
  | 'broodship'
  | 'leviathan'
  | 'leviathanSegment';

export interface HitCircle {
  x: number;
  z: number;
  r: number;
}

/** A destructible part of a bigger enemy, offset from its centre in world units (x right, z down the screen). */
export interface PartRef {
  enemy: EnemyId;
  x: number;
  z: number;
  /** Height above the parent, so parts sit on top of its hull. */
  y?: number;
}

export type ExplosionSize = 'small' | 'medium' | 'large';

export interface AttackRef {
  pattern: PatternId;
  /** Only from this difficulty up (e.g. Scouts shoot from Hard). */
  minDifficulty?: Difficulty;
  /** Simple boss phases: active only while the HP fraction is ≤ hpBelow and > hpAbove. */
  hpBelow?: number;
  hpAbove?: number;
}

/**
 * Minions launched while the enemy is in the firing zone (Carrier, Hive Mother): one per hatch
 * every `interval` seconds, with no more than `alive` of its own at once. Minions don't count
 * towards the kill rate (they keep coming) and fly their own movement.
 */
export interface BroodRef {
  enemy: EnemyId;
  /** Launch points, world units relative to the centre (x right, z down the screen). */
  hatches: readonly (readonly [number, number])[];
  interval: number;
  delay: number;
  alive: number;
  minDifficulty?: Difficulty;
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
  /** Extra hit circles for long hulls, relative to the centre; replaces `radius` for hits (which stays the bounding radius). */
  hull?: readonly HitCircle[];
  /** Destructible parts (turret pods of a boss); they die with the parent. */
  parts?: readonly PartRef[];
  /** Damage multiplier while any part is alive (an armoured core). */
  armor?: number;
  /** How much it rolls into sideways movement (1 = default, 0 = stays level, e.g. platforms). */
  bank?: number;
  /** Turns around itself, degrees per second (Spinner saucers). */
  spin?: number;
  /** Lasers (data/patterns.ts LASERS), gated like attacks. */
  lasers?: readonly LaserRef[];
  /** Minions it launches (Carrier, Hive Mother). */
  broods?: readonly BroodRef[];
  /**
   * An armoured shell that opens for `open` seconds every time it launches minions (the Hive
   * Mother's weak points): damage is multiplied by `armor` while it is shut.
   */
  shell?: { armor: number; open: number };
  /** Glows shown while the shell is open, relative to the centre (x right, z down the screen). */
  vents?: readonly GlowSpot[];
  /** Fired once when it dies or detonates. */
  deathPattern?: PatternId;
  /** Arms when the ship comes within `radius` and blows up `fuse` seconds later (mines). */
  proximity?: { radius: number; fuse: number };
}

// ---------------------------------------------------------------------------------------------
// Elites (GDD §9): modifiers rolled on wave enemies from Hard up.

export type EliteId = 'armored' | 'swift' | 'volatile' | 'shielded';

export interface EliteDef {
  id: EliteId;
  hp: number;
  /** Movement time scale. */
  speed: number;
  /** Energy shield as a fraction of max HP, soaked before the hull. */
  shield: number;
  /** Fired once when it dies ("revenge bullets"). */
  revenge?: PatternId;
  score: number;
  /** Marker ring colour. */
  color: Rgb;
  /** Relative chance among elites. */
  weight: number;
}

// ---------------------------------------------------------------------------------------------
// Pickups

export type PickupKind = 'credit' | 'bigCredit' | 'power' | 'repair' | 'shield' | 'energy' | 'pod';

export interface PickupDef {
  kind: PickupKind;
  /** Credits value (0 for power-ups). */
  credits: number;
  size: number;
  /** Halo colour (and the cube colour for credits). */
  color: Rgb;
  /** 3D icon; credits are spinning cubes instead. */
  prop?: PropId;
  /** Escape pod: a procedural capsule that has to be flown over — the magnet ignores it (GDD §8). */
  pod?: boolean;
  /** Made up front at mission load (more are made only if a peak goes past it). */
  pool: number;
}

// ---------------------------------------------------------------------------------------------
// Levels

export type MissionId = 's1m1' | 's1m2' | 's1m3' | 's2m1' | 's2m2' | 's2m3' | 's3m1' | 's3m2' | 's3m3';
export type SetPieceId = 'outpost' | 'relay' | 'refinery' | 'depot' | 'bastion' | 'cryoLab' | 'beacon';
export type DecorFieldId = 'asteroidField' | 'denseField' | 'debris' | 'iceField' | 'iceDebris' | 'iceMoon' | 'nebulaClouds' | 'denseClouds';

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

/** Background scenery (asteroid fields) drifting past for `duration` seconds; purely visual. */
export interface DecorEvent {
  t: number;
  type: 'decor';
  field: DecorFieldId;
  duration: number;
}

export type LevelEvent = SpawnEvent | SetPieceEvent | WaitClearEvent | BossEvent | DecorEvent;

export interface MissionDef {
  id: MissionId;
  title: string;
  subtitle: string;
  /** The track that plays through the mission (the boss brings its own). */
  music: MusicId;
  /** First mission: hints teach the controls until it is cleared once (GDD §19). */
  onboarding?: boolean;
  /** Background (stars, nebula) scroll speed, world units per second. */
  scrollSpeed: number;
  /** Set pieces and ground targets scroll slower, so turrets get time to fight. */
  groundSpeed: number;
  events: readonly LevelEvent[];
}

export interface SetPieceModule {
  prop: PropId;
  /** Centre relative to the piece, world units. */
  x: number;
  z: number;
  /** Turn around Y, degrees. */
  rot?: number;
}

export interface SetPieceDef {
  id: SetPieceId;
  /** Extent along Z, world units. */
  length: number;
  modules: readonly SetPieceModule[];
  lights: readonly GlowSpot[];
  turrets: readonly { enemy: EnemyId; x: number; z: number }[];
  /** Escape pods launched from (x, z) once every turret on the piece is destroyed (GDD §8). */
  pods?: { count: number; x: number; z: number };
}

/** What decor is made of: lit rocks, rocks of ice, or soft glowing gas clouds. */
export type DecorLook = 'rock' | 'ice' | 'cloud';

/** Background scenery: rocks, ice or gas clouds drifting below the flight plane. */
export interface DecorFieldDef {
  id: DecorFieldId;
  look: DecorLook;
  /** One piece right when the field starts, then nothing more (a moon passing by). */
  once?: boolean;
  /** Cloud glow colour and strength. */
  color?: Rgb;
  intensity?: number;
  /** Rocks per second. */
  rate: number;
  /** Depth range (y, negative = below the flight plane). */
  depth: readonly [number, number];
  size: readonly [number, number];
  /** Speed as a multiple of the mission scroll speed. */
  speed: number;
}

// ---------------------------------------------------------------------------------------------
// Medals (GDD §12)

export type MedalId = 'hunter' | 'exterminator' | 'rescuer' | 'untouchable';

export interface MedalDef {
  id: MedalId;
  name: string;
  /** One line for the results screen. */
  hint: string;
}

// ---------------------------------------------------------------------------------------------
// Campaign and economy

export interface SectorDef {
  /** 1-based. */
  id: number;
  name: string;
  /** Missions in order, the last one ends with the sector boss; empty while the sector is not built. */
  missions: readonly MissionId[];
  boss: string;
  /** Card stripe colour, the sector palette. */
  color: Rgb;
  /** Medals earned in this sector (any difficulty) needed, with the boss beaten, to open the next one. */
  medalsToAdvance: number;
  /** Backdrop: the nebula baked for its missions. */
  nebula: NebulaPalette;
  /**
   * Credits are worth this much more here (each coin and the clear and medal bonuses): later
   * sectors pay more without more coins on screen.
   */
  pay: number;
}

/** A sector's nebula colours (core/nebula.ts bakes them). */
export interface NebulaPalette {
  seed: number;
  base: Rgb;
  colorA: Rgb;
  colorB: Rgb;
  colorC: Rgb;
  intensity: number;
}

export type SystemId = 'hull' | 'shield' | 'generator' | 'magnet' | 'charges' | 'energy' | 'power' | 'droneBay';

/** Everything bought in the hangar: system upgrades and the arsenal (an arsenal item's value 0 = not owned). */
export type UpgradeId = SystemId | ArsenalId;

/** Progress needed before an item can be bought: a mission cleared, or medals earned over the campaign. */
export type UnlockReq = { mission: MissionId } | { medals: number };

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  /** Hangar tab (systems) or arsenal slot. */
  group: 'systems' | ArsenalSlot;
  /** One hangar line on what it does. */
  hint: string;
  /** Value at each level; index 0 is the base, before any purchase. */
  values: readonly number[];
  /** `costs[i]` buys level i + 1, so there is one cost fewer than values. */
  costs: readonly number[];
  /** How values print: a plain count, a roman numeral (Power) or a level number. */
  format: 'count' | 'roman' | 'level';
  /** Can't be bought before this; null = from the start. */
  unlock: UnlockReq | null;
}

// ---------------------------------------------------------------------------------------------
// Graphics quality

export type QualityId = 'ultra' | 'high' | 'medium' | 'low' | 'lowest';

export interface QualityTier {
  id: QualityId;
  /** 3D resolution, a fraction of the canvas (the UI always renders at the full one). */
  scale: number;
  /** 4× multisampling of the 3D view: smooth edges on the low-poly silhouettes. */
  msaa: boolean;
}

/** What a device is, as far as its GPU goes. */
export type DeviceKind = 'desktop' | 'mobile' | 'software';

// ---------------------------------------------------------------------------------------------
// Cheat codes and settings

export type CheatId = 'arsenal' | 'credits';

export type CheatEffect =
  /** Every weapon, drone and Special open and licensed (level 1), the Drone Bay with one slot. */
  | { kind: 'arsenal' }
  | { kind: 'credits'; amount: number };

export interface CheatDef {
  id: CheatId;
  /** What to type; compared without case and surrounding spaces. */
  code: string;
  effect: CheatEffect;
  /** Shown when the code works. */
  message: string;
}

export type Handedness = 'right' | 'left';

/** The player's settings (device-local, apart from the save). */
export interface Settings {
  /** Volumes, 0..SETTINGS.volumeSteps. */
  music: number;
  sfx: number;
  /** The ship's own guns (shots, the Ion beam, gun drones): off by default — they drown the fight. */
  gunSounds: boolean;
  /** Finger travel multiplier on top of the ship's own. */
  sensitivity: number;
  /** Which side the Special button sits on: under the free thumb. */
  handedness: Handedness;
  /** Graphics tier (data/visuals.ts QUALITY); it never changes by itself. */
  quality: QualityId;
  showFps: boolean;
}

// ---------------------------------------------------------------------------------------------
// Audio (data/audio.ts, services/AudioService.ts)

export type MusicId = 'menu' | 'mercury' | 'venus' | 'mars' | 'bossIntro' | 'boss' | 'jingleStart' | 'jingleWin';

export type SfxId =
  | 'pulse' | 'scatter' | 'seeker' | 'ion' | 'plasma' | 'tesla'
  | 'swarm' | 'wing' | 'rail' | 'rear' | 'drone'
  | 'hit' | 'hitArmored' | 'explodeSmall' | 'explodeMedium' | 'explodeLarge' | 'blast' | 'playerDied'
  | 'playerHit' | 'shieldHit' | 'shieldDown' | 'graze' | 'blocked'
  | 'credit' | 'power' | 'repair' | 'shieldUp' | 'energy' | 'podRescued' | 'podsLaunched' | 'podLost'
  | 'enemyShieldBroken' | 'armorBroken'
  | 'nova' | 'overdrive' | 'phase' | 'warp' | 'warning'
  | 'laserCharge' | 'laserFire' | 'mineArmed' | 'broodLaunch'
  | 'uiTap' | 'uiBack' | 'uiTab' | 'uiEquip' | 'uiBuy' | 'uiDenied' | 'launch' | 'cheat';

export interface SfxDef {
  /** Files `audio/sfx/<id>_<i>`; one is picked at random each time. */
  variants: number;
  /** 0..1 before the SFX setting. */
  volume: number;
  /** Seconds before it may play again: rapid fire and hit storms stay one sound, not a roar. */
  gap: number;
}

export interface MusicDef {
  volume: number;
  loop: boolean;
  /** Plays when a non-looping track ends (the boss intro leads into the boss loop). */
  next?: MusicId;
}
