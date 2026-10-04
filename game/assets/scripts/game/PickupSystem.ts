// Pickups: dropped with a little burst, sink down the screen, get pulled in by the magnet and
// collected by the ship. Effects are applied by whoever listens to `pickupCollected`.

import { MeshRenderer, Node, Prefab, instantiate } from 'cc';
import { Pool, swapRemove } from '../core/Pool';
import { PICKUP_MOTION, PICKUPS } from '../data/pickups';
import type { DropSpec, PickupDef, PickupKind, PropId } from '../data/types';
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
  /** 3D icon that wobbles (null for credits, which spin as a whole). */
  icon: Node | null;
}

const PARK_Y = -1000;
const KINDS: readonly PickupKind[] = ['credit', 'bigCredit', 'power', 'repair', 'shield', 'energy'];
/** Icons are modelled facing +Z; tip them back so they face the tilted camera (pitch 70°). */
const ICON_TILT = -70;

export class PickupSystem {
  readonly active: Pickup[] = [];
  /** Pull everything in regardless of distance (mission outro). */
  collectAll = false;
  private readonly pools = new Map<PickupKind, Pool<Pickup>>();
  private readonly root: Node;
  private readonly collected = { kind: 'credit' as PickupKind, x: 0, z: 0 };

  constructor(
    private readonly ctx: GameContext,
    private readonly props: ReadonlyMap<PropId, Prefab>,
  ) {
    this.root = new Node('Pickups');
    this.root.layer = ctx.worldRoot.layer;
    ctx.worldRoot.addChild(this.root);
    for (const kind of KINDS) {
      const def = PICKUPS[kind];
      const pool = new Pool<Pickup>(
        () => this.create(def),
        (p) => {
          p.node.setPosition(0, PARK_Y, 0);
        },
      );
      pool.prewarm(def.prop ? 2 : 24);
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
      // Credits tumble; icons wobble (a full spin would show their thin side) and pulse.
      if (!p.icon) p.node.setRotationFromEuler(p.t * 160, p.t * 220, 35);
      else {
        p.icon.setRotationFromEuler(0, Math.sin(p.t * 2.6) * 35, 0);
        const s = p.def.size * (1 + 0.06 * Math.sin(p.t * 6));
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

  private create(def: PickupDef): Pickup {
    const kit = this.ctx.kit;
    const node = new Node(def.kind);
    node.layer = this.root.layer;
    this.root.addChild(node);
    let icon: Node | null = null;
    if (def.prop) {
      const prefab = this.props.get(def.prop);
      if (!prefab) throw new Error(`prop ${def.prop} was not loaded`);
      const halo = kit.meshNode('halo', node, kit.plane, kit.glow(def.color, 1.5));
      halo.setScale(1.9, 1, 1.9);
      const tilt = new Node('tilt');
      tilt.layer = node.layer;
      node.addChild(tilt);
      tilt.setRotationFromEuler(ICON_TILT, 0, 0);
      icon = instantiate(prefab);
      tilt.addChild(icon);
      for (const r of icon.getComponentsInChildren(MeshRenderer)) {
        r.setSharedMaterial(kit.props(), 0);
        r.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF;
      }
      node.setScale(def.size, def.size, def.size);
    } else {
      const cube = kit.meshNode('credit', node, kit.cube, kit.solid(def.color, 0.85, 0.25, [0.45, 0.3, 0.05]));
      cube.setScale(def.size, def.size, def.size);
    }
    node.setPosition(0, PARK_Y, 0);
    return { def, x: 0, z: 0, vx: 0, vz: 0, t: 0, pulled: false, dead: false, node, icon };
  }
}
