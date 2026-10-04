// Pickups: dropped with a little burst, sink down the screen, get pulled in by the magnet and
// collected by the ship. Effects are applied by whoever listens to `pickupCollected`.

import { Node } from 'cc';
import { Pool, swapRemove } from '../core/Pool';
import { PICKUP_MOTION, PICKUPS } from '../data/pickups';
import type { DropSpec, PickupDef, PickupKind } from '../data/types';
import { WORLD } from '../data/world';
import type { GameContext } from './GameContext';

interface Pickup {
  def: PickupDef;
  x: number;
  z: number;
  vx: number;
  vz: number;
  t: number;
  /** Caught by the magnet: homes in on the ship from now on. */
  pulled: boolean;
  dead: boolean;
  node: Node;
}

const PARK_Y = -1000;
const KINDS: readonly PickupKind[] = ['credit', 'bigCredit', 'power', 'repair', 'shield', 'energy'];
/** Badges lean towards the tilted camera so their letters read square-on. */
const BADGE_TILT = 20;

export class PickupSystem {
  readonly active: Pickup[] = [];
  /** Pull everything in regardless of distance (mission outro). */
  collectAll = false;
  private readonly pools = new Map<PickupKind, Pool<Pickup>>();
  private readonly root: Node;
  private readonly collected = { kind: 'credit' as PickupKind, x: 0, z: 0 };

  constructor(private readonly ctx: GameContext) {
    this.root = new Node('Pickups');
    this.root.layer = ctx.worldRoot.layer;
    ctx.worldRoot.addChild(this.root);
    for (const kind of KINDS) {
      const def = PICKUPS[kind];
      const pool = new Pool<Pickup>(
        () => ({ def, x: 0, z: 0, vx: 0, vz: 0, t: 0, pulled: false, dead: false, node: this.createNode(def) }),
        (p) => {
          p.node.setPosition(0, PARK_Y, 0);
        },
      );
      pool.prewarm(def.letter ? 2 : 24);
      this.pools.set(kind, pool);
    }
    ctx.bus.on('enemyKilled', (e) => this.drop(e.def.drops, e.x, e.z));
  }

  spawn(kind: PickupKind, x: number, z: number): void {
    const p = this.pools.get(kind)!.acquire();
    const rng = this.ctx.rng;
    const angle = rng.range(0, Math.PI * 2);
    const speed = PICKUP_MOTION.scatterSpeed * rng.range(0.3, 1);
    p.x = x;
    p.z = z;
    p.vx = Math.cos(angle) * speed;
    p.vz = Math.sin(angle) * speed - 1.5; // a little pop upwards first
    p.t = rng.range(0, 10);
    p.pulled = false;
    p.dead = false;
    p.node.setPosition(x, WORLD.heights.pickups, z);
    this.active.push(p);
  }

  /** Drops an enemy's loot (credits scaled by difficulty) plus the optional extra. */
  drop(drops: DropSpec, x: number, z: number): void {
    const rng = this.ctx.rng;
    const scale = this.ctx.tuning.credits;
    for (let i = 0; i < drops.credits * scale; i++) this.spawn('credit', x, z);
    for (let i = 0; i < drops.bigCredits * scale; i++) this.spawn('bigCredit', x, z);
    if (drops.extra && rng.chance(drops.extra.chance)) this.spawn(drops.extra.kind, x, z);
  }

  tick(dt: number, shipX: number, shipZ: number, magnetRadius: number, pickupRadius: number, canCollect: boolean): void {
    const field = this.ctx.playfield;
    const drag = Math.exp(-PICKUP_MOTION.drag * dt);
    for (let i = 0; i < this.active.length; i++) {
      const p = this.active[i];
      p.t += dt;
      const dx = shipX - p.x;
      const dz = shipZ - p.z;
      const dist = Math.hypot(dx, dz);
      if (canCollect && !p.pulled && (this.collectAll || dist < magnetRadius)) p.pulled = true;
      if (p.pulled && canCollect) {
        // Accelerate towards the ship.
        const speed = PICKUP_MOTION.magnetSpeed * Math.min(1, 0.35 + p.t * 0.1);
        const step = Math.min(dist, speed * dt);
        if (dist > 1e-4) {
          p.x += (dx / dist) * step;
          p.z += (dz / dist) * step;
        }
      } else {
        p.vx *= drag;
        p.vz *= drag;
        p.x += p.vx * dt;
        p.z += (p.vz + PICKUP_MOTION.fallSpeed) * dt;
      }
      if (canCollect && dist < pickupRadius) {
        p.dead = true;
        const c = this.collected;
        c.kind = p.def.kind;
        c.x = p.x;
        c.z = p.z;
        this.ctx.bus.emit('pickupCollected', c);
      } else if (p.z > field.despawnZ) {
        p.dead = true;
      }
    }
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      if (p.dead) this.pools.get(p.def.kind)!.release(swapRemove(this.active, i));
    }
  }

  render(): void {
    const y = WORLD.heights.pickups;
    for (let i = 0; i < this.active.length; i++) {
      const p = this.active[i];
      const bob = Math.sin(p.t * 4) * 0.06;
      p.node.setPosition(p.x, y + bob, p.z);
      // Credits spin; badges pulse a little.
      if (!p.def.letter) p.node.setRotationFromEuler(p.t * 160, p.t * 220, 35);
      else {
        const s = p.def.size * (1 + 0.08 * Math.sin(p.t * 6));
        p.node.setScale(s, s, s);
      }
    }
  }

  clear(): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      this.pools.get(p.def.kind)!.release(swapRemove(this.active, i));
    }
    this.collectAll = false;
  }

  get count(): number {
    return this.active.length;
  }

  private createNode(def: PickupDef): Node {
    const kit = this.ctx.kit;
    const node = new Node(def.kind);
    node.layer = this.root.layer;
    this.root.addChild(node);
    if (def.letter) {
      const halo = kit.meshNode('halo', node, kit.plane, kit.glow(def.color, 1.4));
      halo.setScale(1.9, 1, 1.9);
      const badge = kit.meshNode('badge', node, kit.plane, kit.badge(def.letter, def.color, 1.8));
      badge.setPosition(0, 0.05, 0);
      badge.setRotationFromEuler(BADGE_TILT, 0, 0);
      node.setScale(def.size, def.size, def.size);
    } else {
      const cube = kit.meshNode('credit', node, kit.cube, kit.solid(def.color, 0.85, 0.25, [0.45, 0.3, 0.05]));
      cube.setScale(def.size, def.size, def.size);
    }
    node.setPosition(0, PARK_Y, 0);
    return node;
  }
}
