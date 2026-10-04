// Pooled enemies: movement patterns from data, hit flash, death events.

import { Color, MeshRenderer, Node, Prefab, instantiate, renderer } from 'cc';
import { Pool, swapRemove } from '../core/Pool';
import { damp } from '../core/math';
import { resetMotion, stepMotion, type MotionContext, type MotionState } from '../core/motion';
import { ENEMIES } from '../data/enemies';
import type { EnemyDef, EnemyId } from '../data/types';
import type { GameContext } from './GameContext';

export interface Enemy extends MotionState {
  def: EnemyDef;
  hp: number;
  bank: number;
  flash: number;
  flashShown: boolean;
  /** Marked by collisions or despawn; removed in `sweep`. */
  dead: boolean;
  node: Node;
  material: renderer.MaterialInstance | null;
}

const FLASH_TIME = 0.06;
const FLASH_ON = new Color(255, 255, 255, 255);
const FLASH_OFF = new Color(0, 0, 0, 255);

export class EnemySystem {
  readonly active: Enemy[] = [];
  private readonly pools = new Map<EnemyId, Pool<Enemy>>();
  private readonly root: Node;
  private readonly motion: MotionContext = { targetX: 0, targetZ: 0, holdZ: 0 };

  constructor(
    private readonly ctx: GameContext,
    prefabs: ReadonlyMap<EnemyId, Prefab>,
  ) {
    this.root = new Node('Enemies');
    this.root.layer = ctx.worldRoot.layer;
    ctx.worldRoot.addChild(this.root);
    for (const [id, prefab] of prefabs) {
      const def = ENEMIES[id];
      const pool = new Pool<Enemy>(
        () => this.createEnemy(def, prefab),
        (e) => {
          e.node.active = false;
        },
      );
      pool.prewarm(8);
      this.pools.set(id, pool);
    }
  }

  spawn(id: EnemyId, x: number, z: number, slot: number): void {
    const pool = this.pools.get(id);
    if (!pool) throw new Error(`no prefab loaded for enemy ${id}`);
    const e = pool.acquire();
    resetMotion(e, x, z, slot);
    e.hp = e.def.hp;
    e.bank = 0;
    e.flash = 0;
    e.dead = false;
    this.setFlash(e, false);
    e.node.active = true;
    this.active.push(e);
  }

  tick(dt: number, playerX: number, playerZ: number): void {
    this.motion.targetX = playerX;
    this.motion.targetZ = playerZ;
    for (let i = 0; i < this.active.length; i++) {
      const e = this.active[i];
      if (e.flash > 0) e.flash -= dt;
      const m = e.def.move;
      if (m.kind === 'dive') this.motion.holdZ = this.ctx.playfield.zAt(m.holdDepth);
      const strafe = stepMotion(m, e, this.motion, dt);
      // Roll into sideways movement; divers level out while aiming and diving.
      const bankTarget = m.kind === 'dive' && e.phase !== 'enter' ? 0 : Math.max(-35, Math.min(35, strafe * 9));
      e.bank = damp(e.bank, bankTarget, 8, dt);
      if (this.ctx.playfield.isFarOutside(e.x, e.z)) e.dead = true;
    }
    this.sweep();
  }

  /** Applies damage; returns true if the enemy died from it. */
  damage(e: Enemy, amount: number): boolean {
    if (e.dead) return false;
    e.hp -= amount;
    e.flash = FLASH_TIME;
    if (e.hp > 0) return false;
    this.kill(e);
    return true;
  }

  kill(e: Enemy): void {
    if (e.dead) return;
    e.dead = true;
    this.ctx.bus.emit('enemyKilled', { x: e.x, z: e.z, score: e.def.score, explosion: e.def.explosion });
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
      e.node.setPosition(e.x, 0, e.z);
      e.node.setRotationFromEuler(0, e.yaw, e.bank);
      const flashing = e.flash > 0;
      if (flashing !== e.flashShown) this.setFlash(e, flashing);
    }
  }

  clear(): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      this.pools.get(e.def.id)!.release(swapRemove(this.active, i));
    }
  }

  get count(): number {
    return this.active.length;
  }

  private createEnemy(def: EnemyDef, prefab: Prefab): Enemy {
    const node = instantiate(prefab);
    node.setScale(def.size, def.size, def.size);
    node.active = false;
    this.root.addChild(node);
    const meshRenderer = node.getComponentInChildren(MeshRenderer);
    // Own material instance per enemy so the hit flash doesn't light up the whole squad.
    const material = meshRenderer ? meshRenderer.getMaterialInstance(0) : null;
    return {
      def,
      x: 0,
      z: 0,
      vx: 0,
      vz: 0,
      hp: def.hp,
      t: 0,
      baseX: 0,
      slot: 0,
      phase: 'enter',
      phaseTime: 0,
      yaw: 180,
      bank: 0,
      flash: 0,
      flashShown: false,
      dead: false,
      node,
      material,
    };
  }

  private setFlash(e: Enemy, on: boolean): void {
    e.flashShown = on;
    e.material?.setProperty('emissive', on ? FLASH_ON : FLASH_OFF);
  }
}
