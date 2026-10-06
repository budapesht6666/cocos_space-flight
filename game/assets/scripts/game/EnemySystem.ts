// Pooled enemies: data-driven movement and fire patterns, hit flash, splitting, death events.
// Bosses may carry destructible parts (separate enemies that ride on them and die with them) and
// an armoured core; wave enemies may roll elite modifiers from Hard up.
// Stage 7: lasers (game/LaserSystem.ts), minions launched from hatches (broods) with a shell that
// opens as they launch, proximity mines that blow up into a ring, and serpents whose parts trail
// behind them along the path they swam.

import { Color, Node, Prefab } from 'cc';
import { armorScale, distToSegment2 } from '../core/arsenal';
import { createEmitterState, aimAngle, fireOnce, resetEmitter, stepEmitter, type EmitterState, type EmitterTuning, type ShotSink } from '../core/emitter';
import type { Offset } from '../core/formations';
import { circlesOverlap, damp, dampAngle } from '../core/math';
import { createMotionState, initMotion, resetMotion, stepMotion, type MotionContext, type MotionState } from '../core/motion';
import { Pool, swapRemove } from '../core/Pool';
import { Trail, type TrailSample } from '../core/trail';
import { pickWeighted } from '../core/weighted';
import { atLeast } from '../data/difficulty';
import { ARMORED_TINT, ELITE_IDS, ELITES } from '../data/elites';
import { ENEMIES } from '../data/enemies';
import { LASERS, PATTERNS } from '../data/patterns';
import type { EliteDef, EliteId, EmitterSpec, EnemyBulletId, EnemyDef, EnemyId, MoveSpec, PropId } from '../data/types';
import { ENEMY_BULLETS } from '../data/weapons';
import { WORLD } from '../data/world';
import { createEnemyView, MARKER_PARK_Y, type EnemyView } from '../entities/EnemyView';
import type { BulletSystem } from './BulletSystem';
import type { EnemyKilledEvent, GameContext } from './GameContext';
import type { LaserSystem } from './LaserSystem';

export interface Enemy extends MotionState {
  /** Unique per spawn (pooled records are reused): piercing bolts and homing targets track it. */
  uid: number;
  def: EnemyDef;
  move: MoveSpec;
  hp: number;
  maxHp: number;
  bank: number;
  flash: number;
  /** Time until the next hit may flash again, so constant fire doesn't paint it white. */
  flashCooldown: number;
  flashShown: boolean;
  /** Marked by collisions or despawn; removed in `sweep`. */
  dead: boolean;
  /** Spawn group (wave bonus), or -1. */
  group: number;
  /** Set piece instance it stands on (escape pods), or -1. */
  site: number;
  boss: boolean;
  /** For parts: the enemy it rides on, and where (world units, before the parent's roll). */
  parent: Enemy | null;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  /** Live parts riding on this enemy. */
  parts: Enemy[];
  elite: EliteDef | null;
  /** Elite energy shield left, HP. */
  shield: number;
  /** Movement time scale (Swift elites). */
  speedScale: number;
  /** One per def.attacks entry; `armed` is false when the difficulty gate keeps it off. */
  emitters: EmitterState[];
  armed: boolean[];
  /** Turret head yaw, degrees. */
  aimYaw: number;
  /** Fixed tilt for tumbling rocks, degrees. */
  tilt: number;
  /** Counts towards the kill rate (minions launched from hatches don't). */
  counted: boolean;
  /** Who launched it (a brood minion) and that enemy's uid then; null otherwise. */
  owner: Enemy | null;
  ownerUid: number;
  /** Its own minions alive now. */
  minions: number;
  /** Seconds to the next launch per def.broods entry (Infinity = off on this difficulty). */
  broodTimers: number[];
  /** Seconds to the next warning per def.lasers entry (Infinity = off on this difficulty). */
  laserTimers: number[];
  /** Seconds the shell stays open (def.shell). */
  openTime: number;
  ventsShown: boolean;
  /** Mine fuse once armed, seconds; -1 = not armed. */
  fuse: number;
  /** The path a serpent swam (its segments follow it), or null. */
  trail: Trail | null;
  /** Place along a serpent (1 = right behind the head) and the distance it trails behind. */
  segment: number;
  trailDist: number;
  view: EnemyView;
}

const FLASH_TIME = 0.05;
const FLASH_INTERVAL = 0.14;
const FLASH_ON = new Color(255, 255, 255, 255);
/** Bosses and big hulls (Carriers) soak constant fire: a dimmer flash keeps the model readable. */
const FLASH_BOSS = new Color(80, 72, 72, 255);
/** Enemies this big (radius) flash dimly like bosses. */
const BIG_HULL = 1.5;
const FLASH_OFF = new Color(0, 0, 0, 255);
const ARMORED = new Color(ARMORED_TINT[0], ARMORED_TINT[1], ARMORED_TINT[2], 255);
/** Damage an enemy takes from ramming the ship (small fry die, heavies survive). */
const RAM_DAMAGE = 8;
const PARK_Y = -1000;
const DEG = Math.PI / 180;
/** Elite marker ring diameter per unit of enemy radius. */
const MARKER_SCALE = 2.9;
/** Serpent trails keep a point every this many units. */
const TRAIL_STEP = 0.08;
const trailSample: TrailSample = { x: 0, z: 0, dx: 0, dz: -1 };

export class EnemySystem implements ShotSink {
  readonly active: Enemy[] = [];
  /** The boss currently on the field, if any. */
  boss: Enemy | null = null;
  /** Non-obstacle enemies spawned this mission (kill rate). */
  spawnedTally = 0;
  /** Debug: every wave enemy becomes this elite ('random' = rolled), or null. */
  forceElite: EliteId | 'random' | null = null;
  private readonly pools = new Map<EnemyId, Pool<Enemy>>();
  private readonly root: Node;
  private readonly motion: MotionContext;
  private readonly tuning: EmitterTuning;
  private readonly bulletLooks: Record<EnemyBulletId, number>;
  private readonly killed: EnemyKilledEvent;
  private readonly escaped = { group: -1, site: -1 };
  private readonly fxEvent = { x: 0, z: 0 };
  private readonly hitEvent = { x: 0, z: 0, armored: false };
  private readonly broodEvent = { x: 0, z: 0, shell: false };
  private readonly fxEventArmed = { x: 0, z: 0 };
  private nextUid = 1;
  /** Enemy currently firing (ShotSink context). */
  private shooter: Enemy | null = null;
  private playerAlive = true;
  private playerX = 0;
  private playerZ = 0;

  constructor(
    private readonly ctx: GameContext,
    /** Enemies this mission uses and how many of each to create up front. */
    prewarm: ReadonlyMap<EnemyId, number>,
    prefabs: ReadonlyMap<EnemyId, Prefab>,
    props: ReadonlyMap<PropId, Prefab>,
    private readonly bullets: BulletSystem,
    bulletLooks: Record<EnemyBulletId, number>,
    /** Speed of 'ground' movement (set pieces). */
    groundSpeed: number,
    private readonly lasers: LaserSystem,
  ) {
    this.root = new Node('Enemies');
    this.root.layer = ctx.worldRoot.layer;
    ctx.worldRoot.addChild(this.root);
    this.bulletLooks = bulletLooks;
    this.motion = { targetX: 0, targetZ: 0, field: ctx.playfield, scrollSpeed: groundSpeed };
    this.tuning = { speedScale: ctx.tuning.bulletSpeed, rateScale: ctx.tuning.fireRate, density: ctx.tuning.density };
    this.killed = { x: 0, z: 0, def: ENEMIES.scout, group: -1, site: -1, boss: false, part: false, elite: null, self: false, counted: true };
    for (const [id, count] of prewarm) {
      const def = ENEMIES[id];
      let variant = 0;
      const pool = new Pool<Enemy>(
        () => this.createEnemy(def, prefabs.get(id) ?? null, props, variant++),
        (e) => {
          e.view.node.setPosition(0, PARK_Y, 0);
        },
      );
      pool.prewarm(count);
      this.pools.set(id, pool);
    }
  }

  /**
   * Spawns an enemy (and its parts). Most movements start at (x, z); path movers start at their
   * path's first point shifted by the formation offset.
   */
  spawn(def: EnemyDef, move: MoveSpec, x: number, z: number, offset: Offset | null, mirror: boolean, group: number, counted = true): Enemy {
    const pool = this.pools.get(def.id);
    if (!pool) throw new Error(`enemy ${def.id} was not preloaded for this mission`);
    const e = pool.acquire();
    e.uid = this.nextUid++;
    const dx = offset ? (mirror ? -offset.dx : offset.dx) : 0;
    const dz = offset ? offset.dz : 0;
    const slot = offset ? offset.index : 0;
    e.move = move;
    resetMotion(e, x + dx, z + dz, slot, mirror);
    initMotion(move, e, this.motion, this.ctx.rng, dx, dz);
    e.hp = e.maxHp = Math.ceil(def.hp * this.ctx.tuning.hp);
    e.bank = 0;
    e.flash = 0;
    e.flashCooldown = 0;
    e.dead = false;
    e.group = group;
    e.site = -1;
    e.boss = false;
    e.parent = null;
    e.offsetX = e.offsetY = e.offsetZ = 0;
    e.parts.length = 0;
    e.elite = null;
    e.shield = 0;
    e.speedScale = 1;
    e.aimYaw = 180;
    e.tilt = def.look.kind === 'rock' ? this.ctx.rng.range(-60, 60) : 0;
    const difficulty = this.ctx.difficulty;
    for (let i = 0; i < def.attacks.length; i++) {
      const attack = def.attacks[i];
      e.armed[i] = atLeast(difficulty, attack.minDifficulty);
      resetEmitter(e.emitters[i], PATTERNS[attack.pattern]);
    }
    const broods = def.broods;
    if (broods) for (let i = 0; i < broods.length; i++) e.broodTimers[i] = atLeast(difficulty, broods[i].minDifficulty) ? broods[i].delay : Infinity;
    const lasers = def.lasers;
    if (lasers) for (let i = 0; i < lasers.length; i++) e.laserTimers[i] = atLeast(difficulty, lasers[i].minDifficulty) ? LASERS[lasers[i].laser].delay : Infinity;
    e.counted = counted && !def.obstacle;
    e.owner = null;
    e.ownerUid = -1;
    e.minions = 0;
    e.openTime = 0;
    e.fuse = -1;
    e.segment = 0;
    e.trailDist = 0;
    if (e.trail) e.trail.reset(e.x, e.z, 0, -1);
    e.view.marker.node.setPosition(0, MARKER_PARK_Y, 0);
    this.showVents(e, false);
    this.setFlash(e, false);
    if (e.counted) this.spawnedTally++;
    this.active.push(e);
    if (def.parts) {
      for (let i = 0; i < def.parts.length; i++) {
        const ref = def.parts[i];
        const partDef = ENEMIES[ref.enemy];
        const part = this.spawn(partDef, partDef.move, x + ref.x, z + ref.z, null, false, -1);
        part.parent = e;
        part.offsetX = ref.x;
        part.offsetY = ref.y ?? 0;
        part.offsetZ = ref.z;
        part.segment = i + 1;
        // A serpent's segments take turns down its body instead of firing all at once.
        if (e.trail) for (let k = 0; k < part.emitters.length; k++) part.emitters[k].timer += i * 0.45;
        e.parts.push(part);
      }
      for (let i = 0; i < e.parts.length; i++) this.follow(e.parts[i], e, 0);
    }
    this.placeNode(e);
    for (let i = 0; i < e.parts.length; i++) this.placeNode(e.parts[i]);
    return e;
  }

  /** Wave enemies may become elites from Hard up (GDD §9). */
  rollElite(e: Enemy): void {
    const def = e.def;
    if (def.obstacle || def.ground || def.parts || e.parent || e.boss) return;
    const rng = this.ctx.rng;
    const tuning = this.ctx.tuning;
    let id: EliteId;
    if (this.forceElite !== null && this.forceElite !== 'random') id = this.forceElite;
    else {
      if (this.forceElite === null && (tuning.eliteChance <= 0 || !rng.chance(tuning.eliteChance))) return;
      const weights = tuning.eliteWeights;
      id = pickWeighted(ELITE_IDS, (k) => weights?.[k] ?? ELITES[k].weight, rng.next());
    }
    const elite = ELITES[id];
    e.elite = elite;
    e.hp = e.maxHp = Math.ceil(e.maxHp * elite.hp);
    e.shield = elite.shield * e.maxHp;
    e.speedScale = elite.speed;
    const marker = e.view.marker;
    marker.setSharedMaterial(this.ctx.kit.ringGlow(elite.color, elite.shield > 0 ? 2.2 : 1.6), 0);
    const s = e.def.radius * MARKER_SCALE;
    marker.node.setScale(s, 1, s);
    marker.node.setPosition(0, 0.1, 0);
    e.flashShown = true; // re-apply the resting tint (armoured sheen)
    this.setFlash(e, false);
  }

  tick(dt: number, playerX: number, playerZ: number, playerAlive: boolean): void {
    this.motion.targetX = playerX;
    this.motion.targetZ = playerZ;
    this.playerAlive = playerAlive;
    this.playerX = playerX;
    this.playerZ = playerZ;
    const field = this.ctx.playfield;
    const fireTop = field.zAt(WORLD.fireMinDepth);
    const fireBottom = field.zAt(WORLD.fireMaxDepth);
    // Parents move first; parts follow in a second pass (pool order isn't spawn order).
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < this.active.length; i++) {
        const e = this.active[i];
        if (e.dead || (pass === 0) !== (e.parent === null)) continue;
        if (e.flash > 0) e.flash -= dt;
        if (e.flashCooldown > 0) e.flashCooldown -= dt;
        if (e.parent) this.follow(e, e.parent, dt);
        else {
          const m = e.move;
          const strafe = stepMotion(m, e, this.motion, dt * e.speedScale) * e.speedScale;
          // Roll into sideways movement; divers level out while aiming and diving, rocks just tumble.
          const level = (m.kind === 'dive' && e.phase !== 'enter') || m.kind === 'drift' || m.kind === 'ground' || m.kind === 'shard';
          const bankTarget = level ? 0 : Math.max(-35, Math.min(35, strafe * 9)) * (e.def.bank ?? 1);
          e.bank = damp(e.bank, bankTarget, 8, dt);
          if (e.trail) e.trail.push(e.x, e.z);
        }
        if (e.view.head) e.aimYaw = dampAngle(e.aimYaw, (Math.atan2(e.x - playerX, e.z - playerZ) * 180) / Math.PI, 6, dt);
        if (e.openTime > 0) e.openTime -= dt;
        if (e.def.proximity && this.arm(e, dt)) continue;

        const def = e.def;
        if ((def.attacks.length > 0 || def.lasers || def.broods) && playerAlive && e.z > fireTop && e.z < fireBottom && Math.abs(e.x) < field.halfWidth(e.z)) {
          this.fire(e, dt, playerX, playerZ);
        }
        if (!e.parent && field.isFarOutside(e.x, e.z, e.def.ground ? 40 : 8)) this.escape(e);
      }
    }
    this.sweep();
  }

  /** True while the enemy's armour soaks damage (a core whose parts are still alive, a shut shell). */
  isArmored(e: Enemy): boolean {
    return (e.def.armor !== undefined && e.parts.length > 0) || (e.def.shell !== undefined && e.openTime <= 0);
  }

  /** The damage multiplier of whatever armour is up. */
  private armorOf(e: Enemy): number {
    return e.def.armor !== undefined && e.parts.length > 0 ? e.def.armor : (e.def.shell as { armor: number }).armor;
  }

  /**
   * A hit at (x, z) from a player weapon: damage, plus impact sparks (`sparks`; beams and splash
   * ask for them sparingly) while it survives. Returns true if it died.
   */
  hitAt(e: Enemy, amount: number, x: number, z: number, armorPierce: number, sparks: boolean): boolean {
    const armored = this.isArmored(e);
    if (this.damage(e, amount, armorPierce)) return true;
    if (sparks) {
      const h = this.hitEvent;
      h.x = x;
      h.z = z;
      h.armored = armored;
      this.ctx.bus.emit('enemyHit', h);
    }
    return false;
  }

  /** Applies damage (armour soaks it unless pierced); returns true if the enemy died from it. */
  damage(e: Enemy, amount: number, armorPierce = 0): boolean {
    if (e.dead) return false;
    if (this.isArmored(e)) amount *= armorScale(this.armorOf(e), armorPierce);
    if (e.shield > 0) {
      const soaked = Math.min(e.shield, amount);
      e.shield -= soaked;
      amount -= soaked;
      if (e.shield <= 0) {
        e.view.marker.node.setPosition(0, MARKER_PARK_Y, 0);
        this.fxEvent.x = e.x;
        this.fxEvent.z = e.z;
        this.ctx.bus.emit('enemyShieldBroken', this.fxEvent);
      }
    }
    e.hp -= amount;
    if (e.flashCooldown <= 0) {
      e.flash = FLASH_TIME;
      e.flashCooldown = FLASH_INTERVAL;
    }
    if (e.hp > 0) return false;
    this.kill(e);
    return true;
  }

  /** Ship rammed into it: small fry die, heavies take a dent. */
  ram(e: Enemy): void {
    this.damage(e, RAM_DAMAGE);
  }

  /** Nova Bomb: damages every enemy on screen. */
  damageVisible(amount: number): void {
    const field = this.ctx.playfield;
    for (let i = 0; i < this.active.length; i++) {
      const e = this.active[i];
      if (!e.dead && field.isVisible(e.x, e.z, -e.def.radius)) this.damage(e, amount);
    }
  }

  /**
   * Destroys the enemy. `self`: it blew itself up (a mine's fuse ran out) — an explosion with no
   * score, loot or Energy.
   */
  kill(e: Enemy, self = false): void {
    if (e.dead) return;
    e.dead = true;
    if (this.boss === e) this.boss = null;
    this.releaseOwner(e);
    const k = this.killed;
    k.x = e.x;
    k.z = e.z;
    k.def = e.def;
    k.group = e.group;
    k.site = e.site;
    k.boss = e.boss;
    k.part = e.parent !== null;
    k.elite = e.elite;
    k.self = self;
    k.counted = e.counted;
    this.ctx.bus.emit('enemyKilled', k);
    if (this.playerAlive) {
      const aim = aimAngle(e.x, e.z, this.playerX, this.playerZ);
      this.shooter = e;
      if (e.def.deathPattern) fireOnce(PATTERNS[e.def.deathPattern], aim, this.tuning, this);
      const revenge = e.elite?.revenge;
      if (revenge) fireOnce(PATTERNS[revenge], aim, this.tuning, this);
      this.shooter = null;
    }
    const split = e.def.split;
    if (split) this.splitInto(e, split.enemy, split.count, split.speed);
    // Parts go down with their parent.
    while (e.parts.length > 0) {
      const part = e.parts[e.parts.length - 1];
      if (part.dead) {
        e.parts.pop();
        part.parent = null;
      } else this.kill(part);
    }
    if (e.parent) this.detach(e, e.parent);
  }

  /** Marks the enemy as the mission boss (HP bar, timeline hold). */
  markBoss(e: Enemy): void {
    e.boss = true;
    this.boss = e;
  }

  /** ShotSink: one bullet from the current shooter. */
  shot(spec: EmitterSpec, angle: number, speed: number): void {
    const e = this.shooter;
    if (!e) return;
    const bullet = ENEMY_BULLETS[spec.bullet];
    const muzzle = Math.min(e.def.radius, 1.2) * 0.5;
    this.bullets.spawn(this.bulletLooks[spec.bullet], e.x + Math.sin(angle) * muzzle, e.z - Math.cos(angle) * muzzle, angle, speed, 1, bullet.radius);
  }

  sweep(): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      if (e.dead) this.pools.get(e.def.id)!.release(swapRemove(this.active, i));
    }
  }

  render(): void {
    for (let i = 0; i < this.active.length; i++) {
      const e = this.active[i];
      this.placeNode(e);
      const flashing = e.flash > 0;
      if (flashing !== e.flashShown) this.setFlash(e, flashing);
      if (e.def.vents) this.renderVents(e);
      const beacon = e.view.beacon;
      if (beacon) {
        // Slow pulse while waiting, a fast blink once armed.
        const on = e.fuse >= 0 ? Math.sin(e.t * 50) > 0 : Math.sin(e.t * 4) > -0.2;
        const s = on ? e.def.look.size * (e.fuse >= 0 ? 0.9 : 0.55) : 0.001;
        beacon.setScale(s, 1, s);
      }
    }
  }

  /** Vent glows flicker while the shell is open and park once it shuts. */
  private renderVents(e: Enemy): void {
    const open = e.openTime > 0;
    if (open !== e.ventsShown) this.showVents(e, open);
    if (!open) return;
    const vents = e.def.vents!;
    const k = 0.8 + 0.2 * Math.sin(e.t * 24) * Math.min(1, e.openTime * 3);
    for (let i = 0; i < vents.length; i++) {
      const s = vents[i].size * k;
      e.view.vents[i].setScale(s, 1, s);
    }
  }

  private showVents(e: Enemy, open: boolean): void {
    const vents = e.def.vents;
    e.ventsShown = open;
    if (!vents) return;
    for (let i = 0; i < vents.length; i++) {
      const v = vents[i];
      e.view.vents[i].setPosition(-v.x, open ? v.y ?? 0.4 : MARKER_PARK_Y, -v.z);
    }
  }

  clear(): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      e.parts.length = 0;
      e.parent = null;
      this.pools.get(e.def.id)!.release(swapRemove(this.active, i));
    }
    this.boss = null;
    this.spawnedTally = 0;
  }

  get count(): number {
    return this.active.length;
  }

  private fire(e: Enemy, dt: number, playerX: number, playerZ: number): void {
    const hpFraction = e.hp / e.maxHp;
    const aim = aimAngle(e.x, e.z, playerX, playerZ);
    const def = e.def;
    this.shooter = e;
    for (let i = 0; i < def.attacks.length; i++) {
      if (!e.armed[i]) continue;
      const attack = def.attacks[i];
      if (!inPhase(hpFraction, attack.hpBelow, attack.hpAbove)) continue;
      stepEmitter(PATTERNS[attack.pattern], e.emitters[i], dt, aim, this.tuning, this);
    }
    this.shooter = null;
    const lasers = def.lasers;
    if (lasers) {
      for (let i = 0; i < lasers.length; i++) {
        const ref = lasers[i];
        if (!inPhase(hpFraction, ref.hpBelow, ref.hpAbove)) continue;
        e.laserTimers[i] -= dt;
        if (e.laserTimers[i] > 0) continue;
        const spec = LASERS[ref.laser];
        e.laserTimers[i] = spec.warn + spec.fire + spec.cooldown / this.tuning.rateScale;
        this.lasers.fire(e, spec, aim);
      }
    }
    if (def.broods) this.brood(e, dt, hpFraction);
  }

  /** Launches minions from the hatches when a brood is due; a shell opens as they go. */
  private brood(e: Enemy, dt: number, hpFraction: number): void {
    const broods = e.def.broods!;
    for (let i = 0; i < broods.length; i++) {
      const ref = broods[i];
      if (!inPhase(hpFraction, ref.hpBelow, ref.hpAbove)) continue;
      e.broodTimers[i] -= dt;
      if (e.broodTimers[i] > 0) continue;
      e.broodTimers[i] += ref.interval / this.tuning.rateScale;
      if (e.minions >= ref.alive) continue;
      const def = ENEMIES[ref.enemy];
      for (let h = 0; h < ref.hatches.length && e.minions < ref.alive; h++) {
        const hatch = ref.hatches[h];
        const minion = this.spawn(def, def.move, e.x + hatch[0], e.z + hatch[1], null, hatch[0] < 0, -1, false);
        minion.owner = e;
        minion.ownerUid = e.uid;
        e.minions++;
      }
      const shell = e.def.shell;
      if (shell) {
        e.openTime = shell.open;
        this.showVents(e, true);
      }
      const ev = this.broodEvent;
      ev.x = e.x;
      ev.z = e.z;
      ev.shell = shell !== undefined;
      this.ctx.bus.emit('broodLaunched', ev);
    }
  }

  /** Mines: arm when the ship comes close, blow up when the fuse runs out. Returns true if it went off. */
  private arm(e: Enemy, dt: number): boolean {
    const prox = e.def.proximity!;
    if (e.fuse < 0) {
      if (!this.playerAlive) return false;
      const dx = e.x - this.playerX;
      const dz = e.z - this.playerZ;
      if (dx * dx + dz * dz > prox.radius * prox.radius) return false;
      e.fuse = prox.fuse;
      this.fxEventArmed.x = e.x;
      this.fxEventArmed.z = e.z;
      this.ctx.bus.emit('mineArmed', this.fxEventArmed);
      return false;
    }
    e.fuse -= dt;
    if (e.fuse > 0) return false;
    this.kill(e, true);
    return true;
  }

  /** A minion is gone: its launcher (if it's still the same enemy) may launch another. */
  private releaseOwner(e: Enemy): void {
    const owner = e.owner;
    if (owner && owner.uid === e.ownerUid && owner.minions > 0) owner.minions--;
    e.owner = null;
  }

  /**
   * Puts a part where it rides on its parent, rolled with the parent's bank; a serpent's parts
   * trail behind it instead, closing up as segments are destroyed.
   */
  private follow(e: Enemy, parent: Enemy, dt: number): void {
    const trail = parent.trail;
    if (trail && parent.move.kind === 'serpent') {
      let rank = 1;
      for (let i = 0; i < parent.parts.length; i++) {
        const p = parent.parts[i];
        if (p !== e && p.segment < e.segment) rank++;
      }
      const target = Math.min(rank * parent.move.spacing, trail.reach);
      e.trailDist = e.trailDist <= 0 || dt <= 0 ? target : damp(e.trailDist, target, 2.5, dt);
      trail.sample(e.trailDist, trailSample);
      e.x = trailSample.x;
      e.z = trailSample.z;
      e.yaw = (Math.atan2(-trailSample.dx, -trailSample.dz) * 180) / Math.PI;
      e.bank = 0;
      return;
    }
    const b = parent.bank * DEG;
    e.x = parent.x + e.offsetX * Math.cos(b) + e.offsetY * Math.sin(b);
    e.z = parent.z + e.offsetZ;
    e.bank = parent.bank;
  }

  private detach(part: Enemy, parent: Enemy): void {
    const index = parent.parts.indexOf(part);
    if (index >= 0) swapRemove(parent.parts, index);
    part.parent = null;
    if (parent.parts.length === 0 && parent.def.armor !== undefined && !parent.dead) {
      this.fxEvent.x = parent.x;
      this.fxEvent.z = parent.z;
      this.ctx.bus.emit('armorBroken', this.fxEvent);
    }
  }

  private escape(e: Enemy): void {
    if (e.dead) return;
    e.dead = true;
    if (this.boss === e) this.boss = null;
    this.releaseOwner(e);
    this.escaped.group = e.group;
    this.escaped.site = e.site;
    this.ctx.bus.emit('enemyEscaped', this.escaped);
    while (e.parts.length > 0) {
      const part = e.parts.pop() as Enemy;
      part.parent = null;
      this.escape(part);
    }
  }

  private splitInto(parent: Enemy, id: EnemyId, count: number, speed: number): void {
    const def = ENEMIES[id];
    const rng = this.ctx.rng;
    const start = rng.range(0, Math.PI * 2);
    for (let i = 0; i < count; i++) {
      // Fragments don't count towards the kill rate: they are the parent's last trick.
      const child = this.spawn(def, def.move, parent.x, parent.z, null, false, -1, false);
      const angle = start + (i / count) * Math.PI * 2 + rng.range(-0.3, 0.3);
      // Fly apart, keeping the parent's drift.
      child.vx = parent.vx + Math.cos(angle) * speed;
      child.vz = parent.vz + Math.sin(angle) * speed;
    }
  }

  private placeNode(e: Enemy): void {
    const node = e.view.node;
    const look = e.def.look.kind;
    const parent = e.parent;
    if (parent && parent.trail) {
      // Serpent segments face along the trail.
      node.setPosition(e.x, e.offsetY, e.z);
      node.setRotationFromEuler(0, e.view.head ? 0 : e.yaw, 0);
    } else if (parent) {
      // Parts sit on the parent's hull and roll with it (heads aim on their own).
      const b = parent.bank * DEG;
      const y = -e.offsetX * Math.sin(b) + e.offsetY * Math.cos(b);
      node.setPosition(e.x, y, e.z);
      node.setRotationFromEuler(0, e.view.head ? 0 : 180, e.view.head ? -parent.bank : parent.bank);
    } else {
      node.setPosition(e.x, e.def.ground ? WORLD.heights.ground : 0, e.z);
      if (look === 'rock' || look === 'mine') {
        node.setRotationFromEuler(e.tilt + e.t * e.spin * 0.6, e.yaw, e.tilt * 0.5);
      } else {
        const spin = e.def.spin ? e.def.spin * e.t : 0;
        node.setRotationFromEuler(0, e.view.head ? 0 : e.yaw + spin, e.bank);
      }
    }
    if (e.view.head) e.view.head.setRotationFromEuler(0, e.aimYaw, 0);
  }

  private createEnemy(def: EnemyDef, prefab: Prefab | null, props: ReadonlyMap<PropId, Prefab>, variant: number): Enemy {
    const view = createEnemyView(def, prefab, props, this.ctx.kit, this.root, variant);
    view.node.setPosition(0, PARK_Y, 0);
    const motion = createMotionState();
    const e = motion as Enemy;
    e.uid = 0;
    e.def = def;
    e.move = def.move;
    e.hp = e.maxHp = def.hp;
    e.bank = 0;
    e.flash = 0;
    e.flashCooldown = 0;
    e.flashShown = true; // forces the first setFlash to apply
    e.dead = false;
    e.group = -1;
    e.site = -1;
    e.boss = false;
    e.parent = null;
    e.offsetX = e.offsetY = e.offsetZ = 0;
    e.parts = [];
    e.elite = null;
    e.shield = 0;
    e.speedScale = 1;
    e.emitters = def.attacks.map(() => createEmitterState());
    e.armed = def.attacks.map(() => true);
    e.aimYaw = 180;
    e.tilt = 0;
    e.counted = true;
    e.owner = null;
    e.ownerUid = -1;
    e.minions = 0;
    e.broodTimers = (def.broods ?? []).map(() => Infinity);
    e.laserTimers = (def.lasers ?? []).map(() => Infinity);
    e.openTime = 0;
    e.ventsShown = true; // forces the first showVents to park them
    e.fuse = -1;
    const move = def.move;
    // The trail reaches past the last segment so closing up never runs off its end.
    e.trail = move.kind === 'serpent' ? new Trail(Math.ceil((move.spacing * ((def.parts?.length ?? 0) + 2)) / TRAIL_STEP), TRAIL_STEP) : null;
    e.segment = 0;
    e.trailDist = 0;
    e.view = view;
    return e;
  }

  private setFlash(e: Enemy, on: boolean): void {
    if (e.flashShown === on) return;
    e.flashShown = on;
    const dim = e.boss || e.parent !== null || e.def.radius >= BIG_HULL;
    const color = on ? (dim ? FLASH_BOSS : FLASH_ON) : e.elite?.id === 'armored' ? ARMORED : FLASH_OFF;
    for (let i = 0; i < e.view.flash.length; i++) e.view.flash[i].setProperty('emissive', color);
  }
}

/** Simple boss phases: active while the HP fraction is ≤ hpBelow and > hpAbove. */
function inPhase(hp: number, below: number | undefined, above: number | undefined): boolean {
  return (below === undefined || hp <= below) && (above === undefined || hp > above);
}

/** Circle (x, z, r) against the enemy's body: its radius, or its hull circles. */
export function enemyTouches(e: Enemy, x: number, z: number, r: number): boolean {
  const hull = e.def.hull;
  if (!hull) return circlesOverlap(x, z, r, e.x, e.z, e.def.radius);
  for (let i = 0; i < hull.length; i++) {
    const c = hull[i];
    if (circlesOverlap(x, z, r, e.x + c.x, e.z + c.z, c.r)) return true;
  }
  return false;
}

/** A beam of half-width `hw` from (x0, z0) to (x1, z1) touches the enemy's body. */
export function enemyOnSegment(e: Enemy, x0: number, z0: number, x1: number, z1: number, hw: number): boolean {
  const hull = e.def.hull;
  if (!hull) {
    const r = e.def.radius + hw;
    return distToSegment2(e.x, e.z, x0, z0, x1, z1) <= r * r;
  }
  for (let i = 0; i < hull.length; i++) {
    const c = hull[i];
    const r = c.r + hw;
    if (distToSegment2(e.x + c.x, e.z + c.z, x0, z0, x1, z1) <= r * r) return true;
  }
  return false;
}
