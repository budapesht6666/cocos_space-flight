// Enemy lasers (Lancer, Arbiter, Leviathan): a thin pulsing warning line, aimed when it appears,
// then a beam that hits the ship anywhere along it. Shots ride on their owner and end with it; the
// Nova Bomb cancels them. Strips are pooled planes with shared instanced materials, parked below
// the view when free.

import { Node, Quat, Vec3 } from 'cc';
import { distToSegment2 } from '../core/arsenal';
import { Pool, swapRemove } from '../core/Pool';
import type { LaserSpec } from '../data/types';
import { COLORS } from '../data/visuals';
import { WORLD } from '../data/world';
import type { Enemy } from './EnemySystem';
import type { GameContext } from './GameContext';
import type { PlayerSystem } from './PlayerSystem';

interface Shot {
  owner: Enemy;
  /** The owner's uid when it fired: pooled enemies are reused. */
  uid: number;
  spec: LaserSpec;
  /** Radians from straight up the screen, positive to the right (down = π). */
  angle: number;
  /** Radians per second while firing. */
  sweep: number;
  /** Seconds since the warning appeared. */
  t: number;
  firing: boolean;
  grazed: boolean;
  /** A shot hurts the ship once at most, like a bullet: a beam outlasts the shield's grace time. */
  struck: boolean;
  line: Node;
  beam: Node;
  flare: Node;
}

const PARK_Y = -1000;
const DEG = Math.PI / 180;
const UP = new Vec3(0, 1, 0);
const tmpQuat = new Quat();
/** Shots at once: three Lancers and a boss with a twin beam, with room to spare. */
const MAX_SHOTS = 8;
/** The beam's glow is wider than the strip that hurts. */
const BEAM_GLOW = 1.7;
/** The warning line: wide enough to stay a solid line on a phone, widening as the shot nears. */
const LINE_WIDTH = 0.16;

export class LaserSystem {
  private readonly shots: Shot[] = [];
  private readonly free: Shot[] = [];
  private readonly root: Node;
  private readonly y = WORLD.heights.enemyBullets - 0.05;
  private readonly event = { x: 0, z: 0, firing: false };
  private readonly grazeEvent = { x: 0, z: 0 };
  private sweepSign = 1;
  private time = 0;

  constructor(
    private readonly ctx: GameContext,
    private readonly player: PlayerSystem,
    /** Missions without lasers make no strips. */
    used: boolean,
  ) {
    this.root = new Node('Lasers');
    this.root.layer = ctx.worldRoot.layer;
    ctx.worldRoot.addChild(this.root);
    if (!used) return;
    const kit = ctx.kit;
    const lineMaterial = kit.beam(COLORS.laserWarn, 2.2);
    const beamMaterial = kit.beam(COLORS.laser, 2.6);
    const flareMaterial = kit.glow(COLORS.laser, 2.4);
    const pool = new Pool<Shot>(() => {
      const line = kit.meshNode('laserLine', this.root, kit.plane, lineMaterial);
      const beam = kit.meshNode('laserBeam', this.root, kit.plane, beamMaterial);
      const flare = kit.meshNode('laserFlare', this.root, kit.plane, flareMaterial);
      line.setPosition(0, PARK_Y, 0);
      beam.setPosition(0, PARK_Y, 0);
      flare.setPosition(0, PARK_Y, 0);
      return { owner: null as unknown as Enemy, uid: -1, spec: null as unknown as LaserSpec, angle: 0, sweep: 0, t: 0, firing: false, grazed: false, struck: false, line, beam, flare };
    });
    pool.prewarm(MAX_SHOTS);
    for (let i = 0; i < MAX_SHOTS; i++) this.free.push(pool.acquire());
  }

  get count(): number {
    return this.shots.length;
  }

  /** Starts a shot (its warning line) from `owner`; `aim` is the angle to the ship. */
  fire(owner: Enemy, spec: LaserSpec, aim: number): void {
    const base = spec.aim ? aim : Math.PI + spec.angleDeg * DEG;
    this.sweepSign = -this.sweepSign;
    for (let k = 0; k < spec.count; k++) {
      const shot = this.free.pop();
      if (!shot) return;
      shot.owner = owner;
      shot.uid = owner.uid;
      shot.spec = spec;
      shot.angle = base + (k - (spec.count - 1) / 2) * spec.gapDeg * DEG;
      shot.sweep = spec.sweepDeg * DEG * this.sweepSign;
      shot.t = 0;
      shot.firing = false;
      shot.grazed = false;
      shot.struck = false;
      this.shots.push(shot);
    }
    this.emit(owner, false);
  }

  tick(dt: number): void {
    this.time += dt;
    const p = this.player;
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      if (s.owner.dead || s.owner.uid !== s.uid) {
        this.release(i);
        continue;
      }
      s.t += dt;
      if (!s.firing) {
        if (s.t < s.spec.warn) continue;
        s.firing = true;
        this.emit(s.owner, true);
      }
      s.angle += s.sweep * dt;
      if (s.t >= s.spec.warn + s.spec.fire) {
        this.release(i);
        continue;
      }
      if (s.struck || !p.vulnerable) continue;
      const x0 = this.originX(s);
      const z0 = this.originZ(s);
      const x1 = x0 + Math.sin(s.angle) * s.spec.length;
      const z1 = z0 - Math.cos(s.angle) * s.spec.length;
      const d2 = distToSegment2(p.x, p.z, x0, z0, x1, z1);
      const half = s.spec.width / 2;
      const hit = half + p.hitboxRadius;
      if (d2 <= hit * hit) {
        s.struck = true;
        p.hit();
        continue;
      }
      const graze = half + p.grazeRadius;
      if (!s.grazed && d2 <= graze * graze) {
        s.grazed = true;
        this.grazeEvent.x = p.x;
        this.grazeEvent.z = p.z;
        this.ctx.bus.emit('graze', this.grazeEvent);
      }
    }
  }

  render(): void {
    for (let i = 0; i < this.shots.length; i++) {
      const s = this.shots[i];
      const x0 = this.originX(s);
      const z0 = this.originZ(s);
      const x1 = x0 + Math.sin(s.angle) * s.spec.length;
      const z1 = z0 - Math.cos(s.angle) * s.spec.length;
      const flicker = 0.85 + 0.15 * Math.sin(this.time * 60 + i * 1.7);
      if (s.firing) {
        s.line.setPosition(0, PARK_Y, 0);
        this.strip(s.beam, x0, z0, x1, z1, s.spec.width * BEAM_GLOW * flicker);
        const f = s.spec.width * 3 * flicker;
        s.flare.setScale(f, 1, f);
      } else {
        // The warning line pulses faster as the shot gets close; the muzzle glow charges up.
        const k = s.t / s.spec.warn;
        const pulse = 0.75 + 0.25 * Math.sin(this.time * (14 + 26 * k));
        this.strip(s.line, x0, z0, x1, z1, LINE_WIDTH * (1 + 1.2 * k) * pulse);
        const f = s.spec.width * 2.4 * k;
        s.flare.setScale(f, 1, f);
      }
      s.flare.setPosition(x0, this.y + 0.05, z0);
    }
  }

  /** Every shot ends now (Nova Bomb, restart). */
  clear(): void {
    for (let i = this.shots.length - 1; i >= 0; i--) this.release(i);
  }

  private originX(s: Shot): number {
    return s.owner.x + Math.sin(s.angle) * this.muzzle(s.owner);
  }

  private originZ(s: Shot): number {
    return s.owner.z - Math.cos(s.angle) * this.muzzle(s.owner);
  }

  private muzzle(owner: Enemy): number {
    return Math.min(owner.def.radius, 1.6) * 0.6;
  }

  private release(i: number): void {
    const s = swapRemove(this.shots, i);
    s.line.setPosition(0, PARK_Y, 0);
    s.beam.setPosition(0, PARK_Y, 0);
    s.flare.setPosition(0, PARK_Y, 0);
    this.free.push(s);
  }

  private emit(owner: Enemy, firing: boolean): void {
    const e = this.event;
    e.x = owner.x;
    e.z = owner.z;
    e.firing = firing;
    this.ctx.bus.emit('laser', e);
  }

  /** Lays a unit plane along (x0, z0)–(x1, z1). */
  private strip(node: Node, x0: number, z0: number, x1: number, z1: number, width: number): void {
    const dx = x1 - x0;
    const dz = z1 - z0;
    node.setPosition((x0 + x1) / 2, this.y, (z0 + z1) / 2);
    Quat.fromAxisAngle(tmpQuat, UP, -Math.atan2(dx, -dz));
    node.setRotation(tmpQuat);
    node.setScale(width, 1, Math.hypot(dx, dz));
  }
}
