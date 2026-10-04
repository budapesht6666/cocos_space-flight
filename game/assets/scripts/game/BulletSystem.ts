// Pooled projectiles. Records live in a dense array; nodes only mirror them for rendering.

import { Node, Quat, Vec3 } from 'cc';
import { Pool, swapRemove } from '../core/Pool';
import type { Rgb } from '../data/types';
import type { GameContext } from './GameContext';

export interface Bullet {
  x: number;
  z: number;
  vx: number;
  vz: number;
  radius: number;
  damage: number;
  /** Marked by collisions; removed in `sweep`. */
  dead: boolean;
  node: Node;
}

const UP = new Vec3(0, 1, 0);
const tmpQuat = new Quat();
/** Free bullets are parked far below the view (culled) instead of toggling `active`, which is costly on phones. */
const PARK_Y = -1000;

export class BulletSystem {
  readonly active: Bullet[] = [];
  private readonly pool: Pool<Bullet>;
  private readonly root: Node;

  constructor(
    private readonly ctx: GameContext,
    name: string,
    color: Rgb,
    intensity: number,
    prewarm: number,
  ) {
    this.root = new Node(name);
    this.root.layer = ctx.worldRoot.layer;
    ctx.worldRoot.addChild(this.root);
    const material = ctx.kit.glow(color, intensity);
    this.pool = new Pool<Bullet>(
      () => {
        const node = ctx.kit.meshNode('bullet', this.root, ctx.kit.plane, material);
        node.setPosition(0, PARK_Y, 0);
        return { x: 0, z: 0, vx: 0, vz: 0, radius: 0, damage: 0, dead: false, node };
      },
      (b) => {
        b.node.setPosition(0, PARK_Y, 0);
      },
    );
    this.pool.prewarm(prewarm);
  }

  /** `angle` is radians from straight up (-Z), positive to the right. */
  spawn(x: number, z: number, angle: number, speed: number, damage: number, radius: number, width: number, length: number): void {
    const b = this.pool.acquire();
    b.x = x;
    b.z = z;
    b.vx = Math.sin(angle) * speed;
    b.vz = -Math.cos(angle) * speed;
    b.radius = radius;
    b.damage = damage;
    b.dead = false;
    b.node.setScale(width, 1, length);
    Quat.fromAxisAngle(tmpQuat, UP, -angle);
    b.node.setRotation(tmpQuat);
    b.node.setPosition(x, 0.05, z);
    this.active.push(b);
  }

  tick(dt: number): void {
    const field = this.ctx.playfield;
    for (let i = 0; i < this.active.length; i++) {
      const b = this.active[i];
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      if (field.isFarOutside(b.x, b.z) || b.z < field.topZ - 1.5) b.dead = true;
    }
    this.sweep();
  }

  /** Releases bullets marked dead. */
  sweep(): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      if (this.active[i].dead) this.pool.release(swapRemove(this.active, i));
    }
  }

  render(): void {
    for (let i = 0; i < this.active.length; i++) {
      const b = this.active[i];
      b.node.setPosition(b.x, 0.05, b.z);
    }
  }

  clear(): void {
    for (let i = this.active.length - 1; i >= 0; i--) this.pool.release(swapRemove(this.active, i));
  }

  get count(): number {
    return this.active.length;
  }
}
