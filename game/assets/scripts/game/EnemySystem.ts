// Pooled enemies: data-driven movement and fire patterns, hit flash, splitting, death events.

import { Color, Node, Prefab } from 'cc';
import { createEmitterState, aimAngle, resetEmitter, stepEmitter, type EmitterState, type EmitterTuning, type ShotSink } from '../core/emitter';
import type { Offset } from '../core/formations';
import { damp, dampAngle } from '../core/math';
import { createMotionState, initMotion, resetMotion, stepMotion, type MotionContext, type MotionState } from '../core/motion';
import { Pool, swapRemove } from '../core/Pool';
import { atLeast } from '../data/difficulty';
import { ENEMIES } from '../data/enemies';
import { PATTERNS } from '../data/patterns';
import type { EmitterSpec, EnemyBulletId, EnemyDef, EnemyId, MoveSpec } from '../data/types';
import { ENEMY_BULLETS } from '../data/weapons';
import { WORLD } from '../data/world';
import { createEnemyView, type EnemyView } from '../entities/EnemyView';
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
  boss: boolean;
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
const FLASH_BOSS = new Color(110, 100, 100, 255);
const FLASH_OFF = new Color(0, 0, 0, 255);
/** Damage an enemy takes from ramming the ship (small fry die, heavies survive). */
const RAM_DAMAGE = 8;
const PARK_Y = -1000;

export class EnemySystem implements ShotSink {
  readonly active: Enemy[] = [];
  /** The boss currently on the field, if any. */
  boss: Enemy | null = null;
  /** Non-obstacle enemies spawned this mission (kill rate). */
  spawnedTally = 0;
  private readonly pools = new Map<EnemyId, Pool<Enemy>>();
  private readonly root: Node;
  private readonly motion: MotionContext;
  private readonly tuning: EmitterTuning;
  private readonly bulletLooks: Record<EnemyBulletId, number>;
  private readonly killed: EnemyKilledEvent;
  private readonly escaped = { group: -1 };
  /** Enemy currently firing (ShotSink context). */
  private shooter: Enemy | null = null;
  private playerAlive = true;

  constructor(
    private readonly ctx: GameContext,
    /** Enemies this mission uses and how many of each to create up front. */
    prewarm: ReadonlyMap<EnemyId, number>,
    prefabs: ReadonlyMap<EnemyId, Prefab>,
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
    this.killed = { x: 0, z: 0, def: ENEMIES.scout, group: -1, boss: false };
    for (const [id, count] of prewarm) {
      const def = ENEMIES[id];
      let variant = 0;
      const pool = new Pool<Enemy>(
        () => this.createEnemy(def, prefabs.get(id) ?? null, variant++),
        (e) => {
          e.view.node.setPosition(0, PARK_Y, 0);
        },
      );
      pool.prewarm(count);
      this.pools.set(id, pool);
    }
  }

  /**
   * Spawns an enemy. Most movements start at (x, z); path movers start at their path's first point
   * shifted by the formation offset.
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
    e.boss = false;
    e.aimYaw = 180;
    e.tilt = def.look.kind === 'rock' ? this.ctx.rng.range(-60, 60) : 0;
    for (let i = 0; i < def.attacks.length; i++) {
      const attack = def.attacks[i];
      e.armed[i] = atLeast(this.ctx.difficulty, attack.minDifficulty);
      resetEmitter(e.emitters[i], PATTERNS[attack.pattern]);
    }
    this.setFlash(e, false);
    this.placeNode(e);
    if (!def.obstacle) this.spawnedTally++;
    this.active.push(e);
    return e;
  }

  tick(dt: number, playerX: number, playerZ: number, playerAlive: boolean): void {
    this.motion.targetX = playerX;
    this.motion.targetZ = playerZ;
    this.playerAlive = playerAlive;
    const field = this.ctx.playfield;
    const fireTop = field.zAt(WORLD.fireMinDepth);
    const fireBottom = field.zAt(WORLD.fireMaxDepth);
    for (let i = 0; i < this.active.length; i++) {
      const e = this.active[i];
      if (e.dead) continue;
      if (e.flash > 0) e.flash -= dt;
      if (e.flashCooldown > 0) e.flashCooldown -= dt;
      const m = e.move;
      const strafe = stepMotion(m, e, this.motion, dt);
      // Roll into sideways movement; divers level out while aiming and diving, rocks just tumble.
      const level = (m.kind === 'dive' && e.phase !== 'enter') || m.kind === 'drift' || m.kind === 'ground';
      const bankTarget = level ? 0 : Math.max(-35, Math.min(35, strafe * 9));
      e.bank = damp(e.bank, bankTarget, 8, dt);
      if (e.view.head) e.aimYaw = dampAngle(e.aimYaw, (Math.atan2(e.x - playerX, e.z - playerZ) * 180) / Math.PI, 6, dt);

      if (e.def.attacks.length > 0 && playerAlive && e.z > fireTop && e.z < fireBottom && Math.abs(e.x) < field.halfWidth(e.z)) {
        this.fire(e, dt, playerX, playerZ);
      }
      if (field.isFarOutside(e.x, e.z, e.def.ground ? 40 : 8)) this.escape(e);
    }
    this.sweep();
  }

  /** Applies damage; returns true if the enemy died from it. */
  damage(e: Enemy, amount: number): boolean {
    if (e.dead) return false;
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
    k.boss = e.boss;
    this.ctx.bus.emit('enemyKilled', k);
    const split = e.def.split;
    if (split) this.splitInto(e, split.enemy, split.count, split.speed);
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
    const muzzle = e.def.radius * 0.5;
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

  private escape(e: Enemy): void {
    if (e.dead) return;
    e.dead = true;
    if (this.boss === e) this.boss = null;
    this.escaped.group = e.group;
    this.ctx.bus.emit('enemyEscaped', this.escaped);
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
    node.setPosition(e.x, e.def.ground ? WORLD.heights.ground : 0, e.z);
    if (look === 'rock') {
      node.setRotationFromEuler(e.tilt + e.t * e.spin * 0.6, e.yaw, e.tilt * 0.5);
    } else {
      node.setRotationFromEuler(0, e.view.head ? 0 : e.yaw, e.bank);
    }
    if (e.view.head) e.view.head.setRotationFromEuler(0, e.aimYaw, 0);
  }

  private createEnemy(def: EnemyDef, prefab: Prefab | null, variant: number): Enemy {
    const view = createEnemyView(def, prefab, this.ctx.kit, this.root, variant);
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
    e.boss = false;
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
    const color = on ? (e.boss ? FLASH_BOSS : FLASH_ON) : FLASH_OFF;
    for (let i = 0; i < e.view.flash.length; i++) e.view.flash[i].setProperty('emissive', color);
  }
}
