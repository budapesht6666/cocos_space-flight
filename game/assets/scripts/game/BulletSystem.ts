// Pooled projectiles. Records live in a dense array; nodes only mirror them for rendering.
// One system per side (player / enemy). Each look has its own pool and shared material, so every
// look is a single instanced draw call.

import { Material, Node, Quat, Vec3 } from 'cc';
import { Pool, swapRemove } from '../core/Pool';
import type { GameContext } from './GameContext';

export interface Bullet {
  x: number;
  z: number;
  vx: number;
  vz: number;
  radius: number;
  damage: number;
  look: number;
  /** Already counted as a graze (enemy bullets). */
  grazed: boolean;
  /** Marked by collisions; removed in `sweep`. */
  dead: boolean;
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
          return { x: 0, z: 0, vx: 0, vz: 0, radius: 0, damage: 0, look: index, grazed: false, dead: false, node };
        },
        (b) => {
          b.node.setPosition(0, PARK_Y, 0);
        },
      );
      pool.prewarm(prewarm[index] ?? 0);
      this.pools.push(pool);
    });
  }

  /** `angle` is radians from straight up (-Z), positive to the right. Returns false when capped. */
  spawn(look: number, x: number, z: number, angle: number, speed: number, damage: number, radius: number): boolean {
    if (this.active.length >= this.cap) return false;
    const b = this.pools[look].acquire();
    b.x = x;
    b.z = z;
    b.vx = Math.sin(angle) * speed;
    b.vz = -Math.cos(angle) * speed;
    b.radius = radius;
    b.damage = damage;
    b.grazed = false;
    b.dead = false;
    if (!this.looks[look].round) {
      Quat.fromAxisAngle(tmpQuat, UP, -angle);
      b.node.setRotation(tmpQuat);
    }
    b.node.setPosition(x, this.y, z);
    this.active.push(b);
    return true;
  }

  tick(dt: number): void {
    const field = this.ctx.playfield;
    for (let i = 0; i < this.active.length; i++) {
      const b = this.active[i];
      b.x += b.vx * dt;
      b.z += b.vz * dt;
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
