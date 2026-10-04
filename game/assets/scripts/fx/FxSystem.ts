// Explosions and impact effects built from pooled primitives: additive glow sparks, a flash,
// tumbling lit debris and an expanding shockwave ring. Driven by gameplay events.

import { Material, MeshRenderer, Node, Color } from 'cc';
import { Pool, swapRemove } from '../core/Pool';
import { lerp } from '../core/math';
import type { ExplosionSize, Rgb } from '../data/types';
import { COLORS, EXPLOSIONS } from '../data/visuals';
import type { GameContext } from '../game/GameContext';
import { toColor } from './RenderKit';

/** Free particles are parked far below the view (culled) instead of toggling `active`, which is costly on phones. */
const PARK_Y = -1000;

enum Kind {
  SparkHot,
  SparkFire,
  HitSpark,
  Flash,
  Fireball,
  Debris,
}

interface Particle {
  kind: Kind;
  node: Node;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Euler spin for debris, degrees per second. */
  rx: number;
  ry: number;
  rz: number;
  spinX: number;
  spinY: number;
  spinZ: number;
  life: number;
  maxLife: number;
  size: number;
  /** Velocity damping per second (space "drag" so sparks settle). */
  drag: number;
}

interface Ring {
  node: Node;
  material: Material;
  color: Color;
  life: number;
  maxLife: number;
  from: number;
  to: number;
}

export class FxSystem {
  private readonly root: Node;
  private readonly particles: Particle[] = [];
  private readonly rings: Ring[] = [];
  private readonly pools: Pool<Particle>[] = [];
  private readonly ringPool: Pool<Ring>;
  private readonly ringColor: Rgb = COLORS.sparkHot;

  constructor(private readonly ctx: GameContext) {
    this.root = new Node('Fx');
    this.root.layer = ctx.worldRoot.layer;
    ctx.worldRoot.addChild(this.root);
    const kit = ctx.kit;
    const materials: Record<Kind, Material> = {
      [Kind.SparkHot]: kit.glow(COLORS.sparkHot, 2.6),
      [Kind.SparkFire]: kit.glow(COLORS.sparkFire, 2.3),
      [Kind.HitSpark]: kit.glow(COLORS.hitSpark, 2.3),
      [Kind.Flash]: kit.glow(COLORS.sparkHot, 3.2),
      [Kind.Fireball]: kit.glow(COLORS.sparkFire, 1.5),
      [Kind.Debris]: kit.solid(COLORS.debris),
    };
    for (const kind of [Kind.SparkHot, Kind.SparkFire, Kind.HitSpark, Kind.Flash, Kind.Fireball, Kind.Debris]) {
      const mesh = kind === Kind.Debris ? kit.cube : kit.plane;
      const pool = new Pool<Particle>(
        () => {
          const node = kit.meshNode('fx', this.root, mesh, materials[kind]);
          node.setPosition(0, PARK_Y, 0);
          return {
            kind,
            node,
            x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
            rx: 0, ry: 0, rz: 0, spinX: 0, spinY: 0, spinZ: 0,
            life: 0, maxLife: 1, size: 1, drag: 0,
          };
        },
        (p) => {
          p.node.setPosition(0, PARK_Y, 0);
        },
      );
      pool.prewarm(kind === Kind.Flash ? 4 : kind === Kind.Fireball ? 12 : 24);
      this.pools[kind] = pool;
    }
    this.ringPool = new Pool<Ring>(() => {
      const material = kit.ringInstance(this.ringColor, 2.4);
      const node = new Node('ring');
      node.layer = this.root.layer;
      this.root.addChild(node);
      const renderer = node.addComponent(MeshRenderer);
      renderer.mesh = kit.plane;
      renderer.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF;
      renderer.setSharedMaterial(material, 0);
      node.setPosition(0, PARK_Y, 0);
      return { node, material, color: toColor(this.ringColor), life: 0, maxLife: 1, from: 0, to: 1 };
    }, (r) => {
      r.node.setPosition(0, PARK_Y, 0);
    });
    this.ringPool.prewarm(4);

    ctx.bus.on('enemyKilled', (e) => this.explode(e.x, e.z, e.explosion));
    ctx.bus.on('enemyHit', (e) => this.hitSparks(e.x, e.z));
    ctx.bus.on('playerHit', (e) => {
      this.explode(e.x, e.z, 'small');
      ctx.shake(0.45);
    });
    ctx.bus.on('playerDied', (e) => {
      this.explode(e.x, e.z, 'large');
      ctx.hitstop(0.12);
    });
  }

  explode(x: number, z: number, size: ExplosionSize): void {
    const spec = EXPLOSIONS[size];
    const rng = this.ctx.rng;
    this.emit(Kind.Flash, x, 0.3, z, 0, 0, 0, 0.14, spec.flashSize, 0);
    // Soft fireballs give the blast volume; they drift a little and shrink away.
    const fireballs = Math.round(spec.flashSize * 2);
    for (let i = 0; i < fireballs; i++) {
      const angle = rng.range(0, Math.PI * 2);
      const speed = rng.range(0.4, 1.6);
      this.emit(
        Kind.Fireball,
        x + Math.cos(angle) * 0.25, 0.25, z + Math.sin(angle) * 0.25,
        Math.cos(angle) * speed, 0, Math.sin(angle) * speed + 0.8,
        rng.range(0.3, 0.5), spec.flashSize * rng.range(0.35, 0.55), 2,
      );
    }
    for (let i = 0; i < spec.sparks; i++) {
      const angle = rng.range(0, Math.PI * 2);
      const speed = spec.sparkSpeed * rng.range(0.35, 1);
      const hot = i % 3 === 0;
      this.emit(
        hot ? Kind.SparkHot : Kind.SparkFire,
        x, 0.2, z,
        Math.cos(angle) * speed, rng.range(-1, 2), Math.sin(angle) * speed,
        rng.range(0.3, 0.6), rng.range(0.24, 0.5), 3.5,
      );
    }
    for (let i = 0; i < spec.debris; i++) {
      const angle = rng.range(0, Math.PI * 2);
      const speed = spec.sparkSpeed * rng.range(0.2, 0.6);
      const p = this.emit(
        Kind.Debris,
        x, 0, z,
        Math.cos(angle) * speed, rng.range(-2, 3), Math.sin(angle) * speed + this.scrollDrift(),
        rng.range(0.6, 1.1), rng.range(0.08, 0.18), 1.2,
      );
      p.spinX = rng.range(-540, 540);
      p.spinY = rng.range(-540, 540);
      p.spinZ = rng.range(-540, 540);
    }
    this.ring(x, z, 0.4, spec.flashSize * 1.3, 0.32);
    this.ctx.shake(spec.shake);
    if (size !== 'small') this.ctx.hitstop(size === 'medium' ? 0.035 : 0.08);
  }

  hitSparks(x: number, z: number): void {
    const rng = this.ctx.rng;
    for (let i = 0; i < 3; i++) {
      const angle = rng.range(Math.PI * 0.15, Math.PI * 0.85); // fan downwards (+Z)
      const speed = rng.range(3, 7);
      this.emit(Kind.HitSpark, x, 0.25, z, Math.cos(angle) * speed * 0.8, 0, Math.sin(angle) * speed, rng.range(0.1, 0.2), rng.range(0.14, 0.24), 6);
    }
  }

  tick(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.pools[p.kind].release(swapRemove(this.particles, i));
        continue;
      }
      const damping = Math.exp(-p.drag * dt);
      p.vx *= damping;
      p.vy *= damping;
      p.vz *= damping;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rx += p.spinX * dt;
      p.ry += p.spinY * dt;
      p.rz += p.spinZ * dt;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) this.ringPool.release(swapRemove(this.rings, i));
    }
  }

  render(): void {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const t = p.life / p.maxLife; // 1 → 0
      let s: number;
      if (p.kind === Kind.Flash) s = p.size * (t > 0.6 ? lerp(1, 0.6, (1 - t) / 0.4) : t / 0.6);
      else if (p.kind === Kind.Fireball) s = p.size * Math.sqrt(t) * (1.2 - 0.2 * t);
      else if (p.kind === Kind.Debris) s = p.size * Math.min(1, t * 4);
      else s = p.size * t;
      p.node.setPosition(p.x, p.y, p.z);
      if (p.kind === Kind.Debris) {
        p.node.setRotationFromEuler(p.rx, p.ry, p.rz);
        p.node.setScale(s, s, s);
      } else {
        // Sparks stretch along their motion a little.
        const round = p.kind === Kind.Flash || p.kind === Kind.Fireball;
        p.node.setScale(s, 1, round ? s : s * 1.8);
        if (!round) p.node.setRotationFromEuler(0, (Math.atan2(-p.vx, -p.vz) * 180) / Math.PI, 0);
      }
    }
    for (let i = 0; i < this.rings.length; i++) {
      const r = this.rings[i];
      const t = 1 - r.life / r.maxLife; // 0 → 1
      const eased = 1 - (1 - t) * (1 - t);
      const s = lerp(r.from, r.to, eased);
      r.node.setScale(s, 1, s);
      r.color.a = Math.round((1 - t) * 255);
      r.material.setProperty('mainColor', r.color);
    }
  }

  clear(): void {
    for (let i = this.particles.length - 1; i >= 0; i--) this.pools[this.particles[i].kind].release(swapRemove(this.particles, i));
    for (let i = this.rings.length - 1; i >= 0; i--) this.ringPool.release(swapRemove(this.rings, i));
  }

  get count(): number {
    return this.particles.length + this.rings.length;
  }

  /** Debris drifts with the scrolling background, so it reads as left behind. */
  private scrollDrift(): number {
    return 2.5;
  }

  private emit(kind: Kind, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, drag: number): Particle {
    const p = this.pools[kind].acquire();
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.rx = p.ry = p.rz = 0;
    p.spinX = p.spinY = p.spinZ = 0;
    p.life = p.maxLife = life;
    p.size = size;
    p.drag = drag;
    p.node.setRotationFromEuler(0, 0, 0);
    p.node.setPosition(x, y, z);
    this.particles.push(p);
    return p;
  }

  private ring(x: number, z: number, from: number, to: number, life: number): void {
    const r = this.ringPool.acquire();
    r.from = from;
    r.to = to;
    r.life = r.maxLife = life;
    r.node.setPosition(x, 0.1, z);
    r.node.setScale(from, 1, from);
    this.rings.push(r);
  }
}
