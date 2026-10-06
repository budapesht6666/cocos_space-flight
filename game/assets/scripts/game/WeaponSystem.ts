// The ship's guns (GDD §7): the Primary and the optional Secondary fire on their own cooldowns at
// the current Power (Overdrive: IV and faster). Bolt weapons spawn pooled projectiles (homing ones
// are steered here every step); the Ion Laser is a beam that hurts everything it crosses; the Tesla
// Arc strikes the nearest enemy and jumps on. Hits go through EnemySystem.hitAt.

import { angleTo, CHAIN_BEHIND, fireInterval, pickChain, shotDamage, turnTowards, type GunScale } from '../core/arsenal';
import type { BeamWeaponDef, BoltId, BoltWeaponDef, ChainWeaponDef, DroneId, Equipped, Loadout, WeaponDef, WeaponId } from '../data/types';
import { WEAPONS } from '../data/weapons';
import { WeaponFx } from '../fx/WeaponFx';
import type { Bullet, BulletSystem } from './BulletSystem';
import { enemyOnSegment, type Enemy, type EnemySystem } from './EnemySystem';
import type { GameContext } from './GameContext';
import type { PlayerSystem } from './PlayerSystem';

const DEG = Math.PI / 180;
/** Beam impact sparks at most this often (it deals damage every step). */
const BEAM_SPARK_INTERVAL = 0.07;
/** Most chain targets of any Power form. */
const MAX_CHAIN = 8;

/** One equipped gun's state. */
interface Gun {
  def: WeaponDef;
  scale: GunScale;
  /** Bolt look index (bolt weapons). */
  look: number;
  /** Damage of one shot per Power (index 0..3). */
  damage: number[];
  /** Seconds between shots at rate 1. */
  interval: number;
  cooldown: number;
  burstLeft: number;
  burstTimer: number;
}

export class WeaponSystem {
  readonly primary: Gun;
  readonly secondary: Gun | null;
  /** The Ion Laser is firing this step (its sound loops while it does). */
  beamOn = false;
  private readonly fx: WeaponFx;
  private readonly shot: { source: WeaponId | DroneId } = { source: 'pulse' };
  private beamSparks = 0;
  private readonly chain: number[] = [];
  private readonly chainValid = (i: number): boolean => this.isChainTarget(this.enemies.active[i]);
  private readonly chainRadius = (i: number): number => this.enemies.active[i].def.radius;

  constructor(
    private readonly ctx: GameContext,
    loadout: Loadout,
    private readonly player: PlayerSystem,
    private readonly bullets: BulletSystem,
    private readonly enemies: EnemySystem,
    /** Look index of each bolt the loadout uses. */
    looks: ReadonlyMap<BoltId, number>,
  ) {
    const gun = (item: Equipped<WeaponId>, scale: GunScale): Gun => {
      const def = WEAPONS[item.id];
      const damage: number[] = [];
      for (let p = 1; p <= 4; p++) damage.push(shotDamage(def, p, scale));
      return {
        def,
        scale,
        look: def.kind === 'bolts' ? (looks.get(def.bolt) ?? 0) : 0,
        damage,
        interval: fireInterval(def, scale),
        cooldown: 0,
        burstLeft: 0,
        burstTimer: 0,
      };
    };
    this.primary = gun(loadout.primary, { level: loadout.primary.level, damage: loadout.primaryDamage, cooldown: 1 });
    this.secondary = loadout.secondary
      ? gun(loadout.secondary, { level: loadout.secondary.level, damage: 1, cooldown: loadout.secondaryCooldown })
      : null;
    const beam = this.primary.def.kind === 'beam' ? this.primary.def.color : null;
    const arc = this.primary.def.kind === 'chain' ? this.primary.def.color : null;
    this.fx = new WeaponFx(ctx, beam, arc, ctx.rng);
    for (let i = 0; i < MAX_CHAIN; i++) this.chain.push(-1);
  }

  reset(): void {
    for (const g of [this.primary, this.secondary]) {
      if (!g) continue;
      g.cooldown = 0;
      g.burstLeft = 0;
      g.burstTimer = 0;
    }
    // The Secondary's first salvo waits a moment into the mission.
    if (this.secondary) this.secondary.cooldown = this.secondary.interval * 0.5;
    this.fx.clear();
  }

  tick(dt: number): void {
    this.steerHoming(dt);
    this.fx.tick(dt);
    const p = this.player;
    this.beamOn = false;
    if (p.mode !== 'control') {
      this.fx.hideBeams();
      return;
    }
    const power = p.firePower;
    const rate = p.fireRate;
    this.run(this.primary, dt, power, rate);
    if (this.secondary) this.run(this.secondary, dt, power, rate);
  }

  clear(): void {
    this.fx.clear();
  }

  private run(g: Gun, dt: number, power: number, rate: number): void {
    const def = g.def;
    if (def.kind === 'beam') {
      this.beam(g, def, dt, power);
      this.beamOn = true;
      return;
    }
    if (g.burstLeft > 0) {
      g.burstTimer -= dt;
      while (g.burstLeft > 0 && g.burstTimer <= 0) {
        this.bolts(g, def as BoltWeaponDef, power);
        this.fired(def.id);
        g.burstLeft--;
        g.burstTimer += (def as BoltWeaponDef).burst?.gap ?? 0;
      }
    }
    g.cooldown -= dt;
    while (g.cooldown <= 0) {
      if (def.kind === 'chain') this.zap(g, def, power);
      else {
        this.bolts(g, def, power);
        if (def.burst) {
          g.burstLeft = def.burst.count - 1;
          g.burstTimer = def.burst.gap;
        }
      }
      this.fired(def.id);
      g.cooldown += g.interval / rate;
    }
  }

  private fired(id: WeaponId): void {
    this.shot.source = id;
    this.ctx.bus.emit('shot', this.shot);
  }

  /** One shot of a bolt weapon: every stream of the Power form. */
  private bolts(g: Gun, def: BoltWeaponDef, power: number): void {
    const p = this.player;
    const form = def.forms[power - 1];
    const scale = form.scale ?? 1;
    const damage = g.damage[power - 1];
    const noseZ = p.noseZ;
    const rng = this.ctx.rng;
    for (let i = 0; i < form.streams.length; i++) {
      const s = form.streams[i];
      let angle = s.angleDeg * DEG;
      if (def.jitterDeg) angle += rng.range(-def.jitterDeg, def.jitterDeg) * DEG;
      const b = this.bullets.spawn(g.look, p.x + s.x, noseZ + (s.z ?? 0), angle, def.speed, damage, def.radius * scale);
      if (!b) return;
      if (scale !== 1) this.bullets.setScale(b, scale);
      if (def.life !== undefined) b.life = b.maxLife = def.life;
      b.falloff = def.falloff ?? 1;
      b.pierce = def.pierce ?? 1;
      b.splash = form.splash ?? 0;
      b.splashDamage = def.splashDamage ?? 0;
      b.armorPierce = def.armorPierce ?? 0;
      if (def.homing) {
        b.homing = def.homing.turnRate * DEG;
        b.homingDelay = def.homing.delay;
      }
    }
  }

  /** Ion Laser: the main beam straight up from the nose, side beams from IV. */
  private beam(g: Gun, def: BeamWeaponDef, dt: number, power: number): void {
    const p = this.player;
    const form = def.forms[power - 1];
    const x = p.x;
    const z = p.noseZ;
    const top = this.ctx.playfield.topZ - 1;
    this.beamSparks -= dt;
    const sparks = this.beamSparks <= 0;
    if (sparks) this.beamSparks = BEAM_SPARK_INTERVAL;
    const dps = g.damage[power - 1] * p.fireRate;
    this.beamHits(x, z, x, top, form.width / 2, dps * dt, def.armorPierce, sparks);
    this.fx.beam(0, x, z, x, top, form.width);
    const side = form.side;
    if (!side) {
      this.fx.hideBeam(1);
      this.fx.hideBeam(2);
      return;
    }
    const a = side.angleDeg * DEG;
    const length = (z - top) / Math.cos(a);
    for (let k = 0; k < 2; k++) {
      const dir = k === 0 ? -1 : 1;
      const sx = x + dir * side.offset;
      const sz = z + 0.3;
      const ex = sx + Math.sin(a * dir) * length;
      const ez = sz - Math.cos(a) * length;
      this.beamHits(sx, sz, ex, ez, side.width / 2, ((dps * side.damage) / form.damage) * dt, def.armorPierce, sparks);
      this.fx.beam(1 + k, sx, sz, ex, ez, side.width);
    }
  }

  private beamHits(x0: number, z0: number, x1: number, z1: number, hw: number, damage: number, armorPierce: number, sparks: boolean): void {
    const field = this.ctx.playfield;
    const list = this.enemies.active;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.dead || !field.isVisible(e.x, e.z, -e.def.radius) || !enemyOnSegment(e, x0, z0, x1, z1, hw)) continue;
      // Sparks where the beam meets the hull: the side facing the ship.
      this.enemies.hitAt(e, damage, x0 + (x1 - x0) * ((z0 - e.z) / Math.max(1e-3, z0 - z1)), e.z + e.def.radius * 0.6, armorPierce, sparks);
    }
  }

  /** Tesla Arc: strike the nearest enemy in reach, then jump from target to target. */
  private zap(g: Gun, def: ChainWeaponDef, power: number): void {
    const p = this.player;
    const form = def.forms[power - 1];
    const list = this.enemies.active;
    const x = p.x;
    const z = p.noseZ;
    const n = pickChain(list, list.length, this.chainValid, this.chainRadius, x, z, def.range, def.jump, Math.min(form.targets, MAX_CHAIN), this.chain);
    if (n === 0) {
      // Nothing in reach: a short crackle at the nose.
      const rng = this.ctx.rng;
      this.fx.arc(x, z, x + rng.range(-0.6, 0.6), z - rng.range(0.6, 1.2));
      return;
    }
    let damage = g.damage[power - 1];
    let fromX = x;
    let fromZ = z;
    // Targets are picked before any damage: a kill (or a split) mustn't reshuffle the list.
    for (let i = 0; i < n; i++) {
      const e = list[this.chain[i]];
      this.fx.arc(fromX, fromZ, e.x, e.z);
      fromX = e.x;
      fromZ = e.z;
      this.enemies.hitAt(e, damage, e.x, e.z, 0, true);
      damage *= def.decay;
    }
  }

  private isChainTarget(e: Enemy): boolean {
    return !e.dead && e.z < this.player.z + CHAIN_BEHIND && this.ctx.playfield.isVisible(e.x, e.z, -e.def.radius);
  }

  /** Homing bolts turn towards their target (picked when the delay runs out, re-picked when it dies). */
  private steerHoming(dt: number): void {
    const list = this.bullets.active;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (b.homing <= 0 || b.dead) continue;
      if (b.homingDelay > 0) {
        b.homingDelay -= dt;
        continue;
      }
      let t = b.target;
      if (!t || t.dead || t.uid !== b.targetUid) t = this.acquire(b);
      if (!t) continue;
      b.angle = turnTowards(b.angle, angleTo(b.x, b.z, t.x, t.z), b.homing * dt);
      b.vx = Math.sin(b.angle) * b.speed;
      b.vz = -Math.cos(b.angle) * b.speed;
    }
  }

  /** The best target for a homing bolt: close, ahead of it, on screen; rocks only if nothing else. */
  private acquire(b: Bullet): Enemy | null {
    const field = this.ctx.playfield;
    const list = this.enemies.active;
    let best: Enemy | null = null;
    let bestScore = Infinity;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.dead || !field.isVisible(e.x, e.z, -e.def.radius)) continue;
      const dx = e.x - b.x;
      const dz = e.z - b.z;
      let score = dx * dx + dz * dz;
      if (e.def.obstacle) score *= 4;
      if (dz > 1) score *= 3; // behind the bolt
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    b.target = best;
    b.targetUid = best ? best.uid : -1;
    return best;
  }
}
