// Pooled projectiles. Records live in a dense array; nodes only mirror them for rendering.
// One system per side (player / enemy). Each look has its own pool and shared material, so every
// look is a single instanced draw call. Player bolts may also have a range (with damage falloff),
// pierce, splash and home in (steered by the WeaponSystem); `spawn` resets all of that.

import { Material, Node, Quat, Vec3 } from 'cc';
import { Pool, swapRemove } from '../core/Pool';
import type { Enemy } from './EnemySystem';
import type { GameContext } from './GameContext';

export interface Bullet {
  x: number;
  z: number;
  vx: number;
  vz: number;
  /** Flight direction (radians from straight up, positive right) and speed. */
  angle: number;
  speed: number;
  radius: number;
  damage: number;
  look: number;
  /** Visual size multiplier. */
  scale: number;
  /** Already counted as a graze (enemy bullets). */
  grazed: boolean;
  /** Marked by collisions; removed in `sweep`. */
  dead: boolean;
  /** Seconds of flight left and the full range; Infinity = until it leaves the screen. */
  life: number;
  maxLife: number;
  /** Damage left at the end of its life (1 = none). */
  falloff: number;
  /** Enemies it may still hit, and the ones it already did (uids), so it hits each once. */
  pierce: number;
  hits: number[];
  hitCount: number;
  /** Splash radius and the fraction of the hit dealt within it. */
  splash: number;
  splashDamage: number;
  /** Fraction of a boss core's armour ignored. */
  armorPierce: number;
  /** Homing turn rate (rad/s, 0 = flies straight), delay before it starts, and the target. */
  homing: number;
  homingDelay: number;
  target: Enemy | null;
  targetUid: number;
  node: Node;
}

export interface BulletLook {
  material: Material;
  width: number;
  length: number;
  /** Round orbs don't need to turn along their direction. */
  round: boolean;
}

const UP = new Vec3(0, 1, 0);
const tmpQuat = new Quat();
/** Free bullets are parked far below the view (culled) instead of toggling `active`, which is costly on phones. */
const PARK_Y = -1000;

export class BulletSystem {
  readonly active: Bullet[] = [];
  private readonly pools: Pool<Bullet>[] = [];
  private readonly root: Node;

  constructor(
    private readonly ctx: GameContext,
    name: string,
    private readonly looks: readonly BulletLook[],
    private readonly y: number,
    /** Bullets made up front, per look. */
    prewarm: readonly number[],
    /** Spawns beyond this many live bullets are dropped (performance budget). */
    private readonly cap: number,
  ) {
    this.root = new Node(name);
    this.root.layer = ctx.worldRoot.layer;
    ctx.worldRoot.addChild(this.root);
    looks.forEach((look, index) => {
      const pool = new Pool<Bullet>(
        () => {
          const node = ctx.kit.meshNode('bullet', this.root, ctx.kit.plane, look.material);
          node.setScale(look.width, 1, look.length);
          node.setPosition(0, PARK_Y, 0);
          return {
            x: 0, z: 0, vx: 0, vz: 0, angle: 0, speed: 0, radius: 0, damage: 0, look: index, scale: 1, grazed: false, dead: false,
            life: Infinity, maxLife: Infinity, falloff: 1, pierce: 1, hits: [0, 0, 0, 0, 0, 0, 0, 0], hitCount: 0,
            splash: 0, splashDamage: 0, armorPierce: 0, homing: 0, homingDelay: 0, target: null, targetUid: -1, node,
          };
        },
        (b) => {
          b.node.setPosition(0, PARK_Y, 0);
        },
      );
      pool.prewarm(prewarm[index] ?? 0);
      this.pools.push(pool);
    });
  }

  /**
   * `angle` is radians from straight up (-Z), positive to the right. Returns the bullet (a plain
   * straight one; the caller adds range, pierce, homing...) or null when capped.
   */
  spawn(look: number, x: number, z: number, angle: number, speed: number, damage: number, radius: number): Bullet | null {
    if (this.active.length >= this.cap) return null;
    const b = this.pools[look].acquire();
    b.x = x;
    b.z = z;
    b.angle = angle;
    b.speed = speed;
    b.vx = Math.sin(angle) * speed;
    b.vz = -Math.cos(angle) * speed;
    b.radius = radius;
    b.damage = damage;
    b.grazed = false;
    b.dead = false;
    b.life = b.maxLife = Infinity;
    b.falloff = 1;
    b.pierce = 1;
    b.hitCount = 0;
    b.splash = b.splashDamage = b.armorPierce = 0;
    b.homing = b.homingDelay = 0;
    b.target = null;
    b.targetUid = -1;
    if (b.scale !== 1) this.setScale(b, 1);
    this.turn(b);
    b.node.setPosition(x, this.y, z);
    this.active.push(b);
    return b;
  }

  /** Grows or shrinks one bullet's look (Plasma Orbs by Power). */
  setScale(b: Bullet, scale: number): void {
    const look = this.looks[b.look];
    b.scale = scale;
    b.node.setScale(look.width * scale, 1, look.length * scale);
  }

  /** Points the bolt along `b.angle` (round looks don't turn). */
  turn(b: Bullet): void {
    if (this.looks[b.look].round) return;
    Quat.fromAxisAngle(tmpQuat, UP, -b.angle);
    b.node.setRotation(tmpQuat);
  }

  tick(dt: number): void {
    const field = this.ctx.playfield;
    for (let i = 0; i < this.active.length; i++) {
      const b = this.active[i];
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      if (b.life !== Infinity) {
        b.life -= dt;
        if (b.life <= 0) b.dead = true;
      }
      if (field.isBulletGone(b.x, b.z)) b.dead = true;
    }
    this.sweep();
  }

  /** Releases bullets marked dead. */
  sweep(): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const b = this.active[i];
      if (b.dead) this.pools[b.look].release(swapRemove(this.active, i));
    }
  }

  render(): void {
    for (let i = 0; i < this.active.length; i++) {
      const b = this.active[i];
      b.node.setPosition(b.x, this.y, b.z);
      if (b.homing > 0) this.turn(b);
    }
  }

  clear(): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const b = this.active[i];
      this.pools[b.look].release(swapRemove(this.active, i));
    }
  }

  get count(): number {
    return this.active.length;
  }
}
