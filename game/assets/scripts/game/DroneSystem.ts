// Drones (GDD §7), one per Drone Bay slot. A Gun Drone flies beside the ship and fires straight
// bolts worth a share of the Primary's damage; a Guardian circles the ship and stops one enemy
// bullet, then recharges; a Collector flies out to loose pickups and sends them to the ship.
// Models are Kenney Space Kit craft (tools/assets/build-props.mjs) drawn with the shared props
// material, over a soft halo in the drone's colour so the dark hulls read against space.

import { MeshRenderer, Node, Prefab, instantiate } from 'cc';
import { damp, dampAngle } from '../core/math';
import { peakDps, type GunScale } from '../core/arsenal';
import type { DroneDef, Loadout, PropId } from '../data/types';
import { DRONE_FLIGHT, DRONES, WEAPONS } from '../data/weapons';
import type { BulletSystem } from './BulletSystem';
import type { GameContext } from './GameContext';
import type { PickupSystem } from './PickupSystem';
import type { PlayerSystem } from './PlayerSystem';

const PARK_Y = -1000;
const RAD_TO_DEG = 180 / Math.PI;
/** Models are built facing up the screen (-Z) and seen from the tilted camera. */
const GUARDIAN_SPIN = 90;

interface Drone {
  def: DroneDef;
  /** Index into the def's levels. */
  level: number;
  slot: number;
  x: number;
  z: number;
  /** Gun: seconds to the next shot. Guardian: recharge left. */
  cooldown: number;
  /** Guardian: orbit angle. */
  angle: number;
  /** Collector: heading for a pickup. */
  hunting: boolean;
  /** Facing, degrees around Y (collector: its course; guardian: its dish turning). */
  yaw: number;
  node: Node;
  model: Node;
  halo: Node;
  ring: Node | null;
}

export class DroneSystem {
  private readonly drones: Drone[] = [];
  private readonly root: Node;
  /** Gun drone bolt damage per second, per Power (index 0..3), before its share. */
  private readonly primaryDps: number[] = [];
  private readonly blockEvent = { x: 0, z: 0 };
  private readonly target = { x: 0, z: 0 };
  private shown = false;

  constructor(
    private readonly ctx: GameContext,
    loadout: Loadout,
    private readonly player: PlayerSystem,
    private readonly playerBullets: BulletSystem,
    private readonly enemyBullets: BulletSystem,
    private readonly pickups: PickupSystem,
    /** Look index of the drone bolt, or -1 if no gun drone flies. */
    private readonly boltLook: number,
    props: ReadonlyMap<PropId, Prefab>,
  ) {
    const kit = ctx.kit;
    this.root = new Node('Drones');
    this.root.layer = ctx.worldRoot.layer;
    ctx.worldRoot.addChild(this.root);
    const scale: GunScale = { level: loadout.primary.level, damage: loadout.primaryDamage, cooldown: 1 };
    for (let p = 1; p <= 4; p++) this.primaryDps.push(peakDps(WEAPONS[loadout.primary.id], p, scale));
    loadout.drones.forEach((item, slot) => {
      const def = DRONES[item.id];
      const node = new Node(`Drone-${def.id}`);
      node.layer = this.root.layer;
      this.root.addChild(node);
      const halo = kit.meshNode('halo', node, kit.plane, kit.glow(def.color, 1.5));
      halo.setPosition(0, -0.1, 0);
      const prefab = props.get(def.prop);
      if (!prefab) throw new Error(`prop ${def.prop} was not loaded`);
      const model = instantiate(prefab);
      node.addChild(model);
      for (const r of model.getComponentsInChildren(MeshRenderer)) {
        r.setSharedMaterial(kit.props(), 0);
        r.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF;
      }
      model.setScale(def.size, def.size * DRONE_FLIGHT.height, def.size);
      const ring = def.kind === 'guardian' ? kit.meshNode('ring', node, kit.plane, kit.ringGlow(def.color, 1.8)) : null;
      ring?.setScale(def.size * 2, 1, def.size * 2);
      node.setPosition(0, PARK_Y, 0);
      this.drones.push({
        def,
        level: Math.max(0, Math.min(def.levels.length, item.level) - 1),
        slot,
        x: 0,
        z: 0,
        cooldown: 0,
        angle: slot * Math.PI,
        hunting: false,
        yaw: 0,
        node,
        model,
        halo,
        ring,
      });
    });
  }

  reset(): void {
    for (const d of this.drones) {
      d.x = this.player.x + DRONE_FLIGHT.slots[d.slot].x;
      d.z = this.player.z + DRONE_FLIGHT.slots[d.slot].z;
      d.cooldown = 0;
      d.hunting = false;
      d.yaw = 0;
    }
  }

  tick(dt: number): void {
    const p = this.player;
    if (!p.alive) return;
    const fighting = p.mode === 'control';
    for (let i = 0; i < this.drones.length; i++) {
      const d = this.drones[i];
      const def = d.def;
      const slot = DRONE_FLIGHT.slots[d.slot];
      let homeX = p.x + slot.x;
      let homeZ = p.z + slot.z;
      if (def.kind === 'guardian') {
        d.angle += def.spin * dt;
        homeX = p.x + Math.cos(d.angle) * def.orbit;
        homeZ = p.z + Math.sin(d.angle) * def.orbit;
        d.x = homeX;
        d.z = homeZ;
        d.yaw += GUARDIAN_SPIN * dt;
        if (d.cooldown > 0) d.cooldown -= dt;
        else if (fighting) this.guard(d, def.block, def.levels[d.level].recharge);
        continue;
      }
      if (def.kind === 'collector' && p.canCollect) {
        d.hunting = this.pickups.findLoose(d.x, d.z, this.target);
        if (d.hunting) {
          const dx = this.target.x - d.x;
          const dz = this.target.z - d.z;
          const dist = Math.hypot(dx, dz);
          const step = Math.min(dist, def.levels[d.level].speed * dt);
          if (dist > 1e-4) {
            d.x += (dx / dist) * step;
            d.z += (dz / dist) * step;
            // Turn the claws towards the pickup.
            d.yaw = dampAngle(d.yaw, Math.atan2(-dx, -dz) * RAD_TO_DEG, 10, dt);
          }
          this.pickups.pullNear(d.x, d.z, def.reach);
          continue;
        }
        this.pickups.pullNear(d.x, d.z, def.reach);
        d.yaw = dampAngle(d.yaw, 0, 6, dt);
      }
      d.x = damp(d.x, homeX, DRONE_FLIGHT.follow, dt);
      d.z = damp(d.z, homeZ, DRONE_FLIGHT.follow, dt);
      if (def.kind === 'gun' && fighting && this.boltLook >= 0) {
        d.cooldown -= dt;
        const interval = def.interval / p.fireRate;
        while (d.cooldown <= 0) {
          const damage = this.primaryDps[p.firePower - 1] * def.levels[d.level].share * def.interval;
          this.playerBullets.spawn(this.boltLook, d.x, d.z - 0.3, 0, def.speed, damage, def.radius);
          d.cooldown += interval;
        }
      }
    }
  }

  render(): void {
    const alive = this.player.alive;
    if (!alive) {
      if (this.shown) for (const d of this.drones) d.node.setPosition(0, PARK_Y, 0);
      this.shown = false;
      return;
    }
    this.shown = true;
    for (let i = 0; i < this.drones.length; i++) {
      const d = this.drones[i];
      d.node.setPosition(d.x, 0.1, d.z);
      d.model.setRotationFromEuler(0, d.yaw, 0);
      // A recharging guardian dims its halo and drops its ring.
      const ready = d.def.kind !== 'guardian' || d.cooldown <= 0;
      const glow = d.def.size * DRONE_FLIGHT.halo * (ready ? 1 : 0.45);
      d.halo.setScale(glow, 1, glow);
      if (d.ring) d.ring.setPosition(0, ready ? 0.05 : PARK_Y, 0);
    }
  }

  clear(): void {
    for (const d of this.drones) d.node.setPosition(0, PARK_Y, 0);
    this.shown = false;
  }

  /** Guardian: the first enemy bullet within reach pops, then the drone recharges. */
  private guard(d: Drone, block: number, recharge: number): void {
    const bullets = this.enemyBullets.active;
    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      if (b.dead) continue;
      const dx = b.x - d.x;
      const dz = b.z - d.z;
      const reach = block + b.radius;
      if (dx * dx + dz * dz > reach * reach) continue;
      b.dead = true;
      d.cooldown = recharge;
      this.blockEvent.x = b.x;
      this.blockEvent.z = b.z;
      this.ctx.bus.emit('bulletBlocked', this.blockEvent);
      return;
    }
  }

  get count(): number {
    return this.drones.length;
  }
}
