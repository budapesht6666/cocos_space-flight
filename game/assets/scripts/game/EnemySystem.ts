// Pooled enemies: data-driven movement and fire patterns, hit flash, splitting, death events.
// Bosses may carry destructible parts (separate enemies that ride on them and die with them) and
// an armoured core; wave enemies may roll elite modifiers from Hard up.

import { Color, Node, Prefab } from 'cc';
import { createEmitterState, aimAngle, fireOnce, resetEmitter, stepEmitter, type EmitterState, type EmitterTuning, type ShotSink } from '../core/emitter';
import type { Offset } from '../core/formations';
import { damp, dampAngle } from '../core/math';
import { createMotionState, initMotion, resetMotion, stepMotion, type MotionContext, type MotionState } from '../core/motion';
import { Pool, swapRemove } from '../core/Pool';
import { pickWeighted } from '../core/weighted';
import { atLeast } from '../data/difficulty';
import { ARMORED_TINT, ELITE_IDS, ELITES } from '../data/elites';
import { ENEMIES } from '../data/enemies';
import { PATTERNS } from '../data/patterns';
import type { EliteDef, EliteId, EmitterSpec, EnemyBulletId, EnemyDef, EnemyId, MoveSpec, PropId } from '../data/types';
import { ENEMY_BULLETS } from '../data/weapons';
import { WORLD } from '../data/world';
import { createEnemyView, MARKER_PARK_Y, type EnemyView } from '../entities/EnemyView';
import type { BulletSystem } from './BulletSystem';
import type { EnemyKilledEvent, GameContext } from './GameContext';

export interface Enemy extends MotionState {
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
  view: EnemyView;
}

const FLASH_TIME = 0.05;
const FLASH_INTERVAL = 0.14;
const FLASH_ON = new Color(255, 255, 255, 255);
/** Bosses soak constant fire: a dimmer flash keeps the model readable. */
const FLASH_BOSS = new Color(80, 72, 72, 255);
const FLASH_OFF = new Color(0, 0, 0, 255);
const ARMORED = new Color(ARMORED_TINT[0], ARMORED_TINT[1], ARMORED_TINT[2], 255);
/** Damage an enemy takes from ramming the ship (small fry die, heavies survive). */
const RAM_DAMAGE = 8;
const PARK_Y = -1000;
const DEG = Math.PI / 180;
/** Elite marker ring diameter per unit of enemy radius. */
const MARKER_SCALE = 2.9;

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
  ) {
    this.root = new Node('Enemies');
    this.root.layer = ctx.worldRoot.layer;
    ctx.worldRoot.addChild(this.root);
    this.bulletLooks = bulletLooks;
    this.motion = { targetX: 0, targetZ: 0, field: ctx.playfield, scrollSpeed: groundSpeed };
    this.tuning = { speedScale: ctx.tuning.bulletSpeed, rateScale: ctx.tuning.fireRate, density: ctx.tuning.density };
    this.killed = { x: 0, z: 0, def: ENEMIES.scout, group: -1, site: -1, boss: false, part: false, elite: null };
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
  spawn(def: EnemyDef, move: MoveSpec, x: number, z: number, offset: Offset | null, mirror: boolean, group: number): Enemy {
    const pool = this.pools.get(def.id);
    if (!pool) throw new Error(`enemy ${def.id} was not preloaded for this mission`);
    const e = pool.acquire();
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
    for (let i = 0; i < def.attacks.length; i++) {
      const attack = def.attacks[i];
      e.armed[i] = atLeast(this.ctx.difficulty, attack.minDifficulty);
      resetEmitter(e.emitters[i], PATTERNS[attack.pattern]);
    }
    e.view.marker.node.setPosition(0, MARKER_PARK_Y, 0);
    this.setFlash(e, false);
    if (!def.obstacle) this.spawnedTally++;
    this.active.push(e);
    if (def.parts) {
      for (const ref of def.parts) {
        const partDef = ENEMIES[ref.enemy];
        const part = this.spawn(partDef, partDef.move, x + ref.x, z + ref.z, null, false, -1);
        part.parent = e;
        part.offsetX = ref.x;
        part.offsetY = ref.y ?? 0;
        part.offsetZ = ref.z;
        e.parts.push(part);
      }
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
        if (e.parent) this.follow(e, e.parent);
        else {
          const m = e.move;
          const strafe = stepMotion(m, e, this.motion, dt * e.speedScale) * e.speedScale;
          // Roll into sideways movement; divers level out while aiming and diving, rocks just tumble.
          const level = (m.kind === 'dive' && e.phase !== 'enter') || m.kind === 'drift' || m.kind === 'ground';
          const bankTarget = level ? 0 : Math.max(-35, Math.min(35, strafe * 9)) * (e.def.bank ?? 1);
          e.bank = damp(e.bank, bankTarget, 8, dt);
        }
        if (e.view.head) e.aimYaw = dampAngle(e.aimYaw, (Math.atan2(e.x - playerX, e.z - playerZ) * 180) / Math.PI, 6, dt);

        if (e.def.attacks.length > 0 && playerAlive && e.z > fireTop && e.z < fireBottom && Math.abs(e.x) < field.halfWidth(e.z)) {
          this.fire(e, dt, playerX, playerZ);
        }
        if (!e.parent && field.isFarOutside(e.x, e.z, e.def.ground ? 40 : 8)) this.escape(e);
      }
    }
    this.sweep();
  }

  /** True while the enemy's armour soaks damage (a core whose parts are still alive). */
  isArmored(e: Enemy): boolean {
    return e.def.armor !== undefined && e.parts.length > 0;
  }

  /** Applies damage; returns true if the enemy died from it. */
  damage(e: Enemy, amount: number): boolean {
    if (e.dead) return false;
    if (this.isArmored(e)) amount *= e.def.armor as number;
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

  kill(e: Enemy): void {
    if (e.dead) return;
    e.dead = true;
    if (this.boss === e) this.boss = null;
    const k = this.killed;
    k.x = e.x;
    k.z = e.z;
    k.def = e.def;
    k.group = e.group;
    k.site = e.site;
    k.boss = e.boss;
    k.part = e.parent !== null;
    k.elite = e.elite;
    this.ctx.bus.emit('enemyKilled', k);
    const revenge = e.elite?.revenge;
    if (revenge && this.playerAlive) {
      this.shooter = e;
      fireOnce(PATTERNS[revenge], aimAngle(e.x, e.z, this.playerX, this.playerZ), this.tuning, this);
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
    this.shooter = e;
    for (let i = 0; i < e.def.attacks.length; i++) {
      if (!e.armed[i]) continue;
      const attack = e.def.attacks[i];
      if (attack.hpBelow !== undefined && hpFraction > attack.hpBelow) continue;
      if (attack.hpAbove !== undefined && hpFraction <= attack.hpAbove) continue;
      stepEmitter(PATTERNS[attack.pattern], e.emitters[i], dt, aim, this.tuning, this);
    }
    this.shooter = null;
  }

  /** Puts a part where it rides on its parent, rolled with the parent's bank. */
  private follow(e: Enemy, parent: Enemy): void {
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
      const child = this.spawn(def, def.move, parent.x, parent.z, null, false, -1);
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
    if (parent) {
      // Parts sit on the parent's hull and roll with it (heads aim on their own).
      const b = parent.bank * DEG;
      const y = -e.offsetX * Math.sin(b) + e.offsetY * Math.cos(b);
      node.setPosition(e.x, y, e.z);
      node.setRotationFromEuler(0, e.view.head ? 0 : 180, e.view.head ? -parent.bank : parent.bank);
    } else {
      node.setPosition(e.x, e.def.ground ? WORLD.heights.ground : 0, e.z);
      if (look === 'rock') {
        node.setRotationFromEuler(e.tilt + e.t * e.spin * 0.6, e.yaw, e.tilt * 0.5);
      } else {
        node.setRotationFromEuler(0, e.view.head ? 0 : e.yaw, e.bank);
      }
    }
    if (e.view.head) e.view.head.setRotationFromEuler(0, e.aimYaw, 0);
  }

  private createEnemy(def: EnemyDef, prefab: Prefab | null, props: ReadonlyMap<PropId, Prefab>, variant: number): Enemy {
    const view = createEnemyView(def, prefab, props, this.ctx.kit, this.root, variant);
    view.node.setPosition(0, PARK_Y, 0);
    const motion = createMotionState();
    const e = motion as Enemy;
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
    e.view = view;
    return e;
  }

  private setFlash(e: Enemy, on: boolean): void {
    if (e.flashShown === on) return;
    e.flashShown = on;
    const color = on ? (e.boss || e.parent ? FLASH_BOSS : FLASH_ON) : e.elite?.id === 'armored' ? ARMORED : FLASH_OFF;
    for (let i = 0; i < e.view.flash.length; i++) e.view.flash[i].setProperty('emissive', color);
  }
}
