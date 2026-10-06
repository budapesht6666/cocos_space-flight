// Background scenery drifting far below the flight plane while a field is active ('decor' timeline
// events): procedural rocks, the same rocks in ice (Ice Moons — one of them moon-sized), and soft
// glowing gas clouds (Nebula Drift). Purely visual. Pieces share meshes and one material per look,
// so a whole field draws as a few instanced calls.

import { Material, MeshRenderer, Node } from 'cc';
import { Pool, swapRemove } from '../core/Pool';
import { CLOUD_POOL, DECOR, DECOR_ICE, DECOR_POOL, DECOR_ROCK } from '../data/decor';
import type { DecorFieldDef, DecorFieldId, DecorLook, MissionDef } from '../data/types';
import type { GameContext } from '../game/GameContext';

interface Piece {
  node: Node;
  renderer: MeshRenderer;
  look: DecorLook;
  x: number;
  y: number;
  z: number;
  /** Visible z range at this depth. */
  maxZ: number;
  speed: number;
  rx: number;
  ry: number;
  spinX: number;
  spinY: number;
  /** Rock shape, or -1 for a cloud. */
  variant: number;
}

interface Field {
  def: DecorFieldDef;
  timeLeft: number;
  /** Fractional pieces owed (spawn accumulator). */
  owed: number;
}

const PARK_Y = -1000;
const MAX_FIELDS = 3;

export class Decor {
  private readonly root: Node;
  private readonly rockPools: Pool<Piece>[] = [];
  private readonly cloudPool: Pool<Piece>;
  private readonly pieces: Piece[] = [];
  private readonly fields: Field[] = [];
  private readonly materials: Record<'rock' | 'ice', Material>;
  private rocks = 0;
  private clouds = 0;

  constructor(
    private readonly ctx: GameContext,
    private readonly scrollSpeed: number,
    mission: MissionDef,
  ) {
    this.root = new Node('Decor');
    this.root.layer = ctx.worldRoot.layer;
    ctx.worldRoot.addChild(this.root);
    const kit = ctx.kit;
    this.materials = { rock: kit.solid(DECOR_ROCK, 0.05, 0.95), ice: kit.solid(DECOR_ICE, 0.15, 0.35) };
    const park = (p: Piece): void => {
      p.node.setPosition(0, PARK_Y, 0);
    };
    for (let v = 0; v < kit.rocks.length; v++) {
      const mesh = kit.rocks[v];
      const pool = new Pool<Piece>(() => this.create(kit.meshNode('decor', this.root, mesh, this.materials.rock), 'rock', v), park);
      pool.prewarm(Math.ceil(DECOR_POOL / kit.rocks.length));
      this.rockPools.push(pool);
    }
    // Clouds come in one colour per mission at most (their field's), so the material is set on spawn.
    this.cloudPool = new Pool<Piece>(() => this.create(kit.meshNode('cloud', this.root, kit.plane, kit.glow([1, 1, 1], 0.3)), 'cloud', -1), park);
    if (mission.events.some((e) => e.type === 'decor' && DECOR[e.field].look === 'cloud')) this.cloudPool.prewarm(CLOUD_POOL);
    for (let i = 0; i < MAX_FIELDS; i++) this.fields.push({ def: DECOR.asteroidField, timeLeft: 0, owed: 0 });
    ctx.bus.on('decor', (e) => this.start(e.field, e.duration));
  }

  start(id: DecorFieldId, duration: number): void {
    const def = DECOR[id];
    if (def.once) {
      this.spawn(def);
      return;
    }
    let slot = this.fields[0];
    for (const f of this.fields) if (f.timeLeft < slot.timeLeft) slot = f;
    slot.def = def;
    slot.timeLeft = duration;
    slot.owed = 0;
  }

  tick(dt: number): void {
    for (let i = 0; i < this.fields.length; i++) {
      const f = this.fields[i];
      if (f.timeLeft <= 0) continue;
      f.timeLeft -= dt;
      f.owed += f.def.rate * dt;
      while (f.owed >= 1) {
        f.owed -= 1;
        this.spawn(f.def);
      }
    }
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const p = this.pieces[i];
      p.z += p.speed * dt;
      p.rx += p.spinX * dt;
      p.ry += p.spinY * dt;
      if (p.z > p.maxZ) this.release(i);
    }
  }

  render(): void {
    for (let i = 0; i < this.pieces.length; i++) {
      const p = this.pieces[i];
      p.node.setPosition(p.x, p.y, p.z);
      p.node.setRotationFromEuler(p.rx, p.ry, 0);
    }
  }

  clear(): void {
    for (const f of this.fields) f.timeLeft = 0;
    for (let i = this.pieces.length - 1; i >= 0; i--) this.release(i);
  }

  get count(): number {
    return this.pieces.length;
  }

  private create(node: Node, look: DecorLook, variant: number): Piece {
    node.setPosition(0, PARK_Y, 0);
    const renderer = node.getComponent(MeshRenderer) as MeshRenderer;
    return { node, renderer, look, x: 0, y: 0, z: 0, maxZ: 0, speed: 0, rx: 0, ry: 0, spinX: 0, spinY: 0, variant };
  }

  private release(i: number): void {
    const p = swapRemove(this.pieces, i);
    if (p.variant < 0) {
      this.clouds--;
      this.cloudPool.release(p);
    } else {
      this.rocks--;
      this.rockPools[p.variant].release(p);
    }
  }

  private spawn(def: DecorFieldDef): void {
    const cloud = def.look === 'cloud';
    if (cloud ? this.clouds >= CLOUD_POOL : this.rocks >= DECOR_POOL) return;
    const rng = this.ctx.rng;
    const f = this.ctx.playfield.framing;
    const y = rng.range(def.depth[0], def.depth[1]);
    // What the camera sees at depth y is the y = 0 view scaled about the camera's foot point.
    const k = (f.camY - y) / f.camY;
    const size = rng.range(def.size[0], def.size[1]);
    const halfWidth = this.ctx.playfield.halfWidth(f.topZ) * k;
    let p: Piece;
    if (cloud) {
      p = this.cloudPool.acquire();
      p.renderer.setSharedMaterial(this.ctx.kit.glow(def.color ?? [1, 1, 1], def.intensity ?? 0.3), 0);
      this.clouds++;
      p.rx = 0;
      p.ry = rng.range(0, 360);
      p.spinX = 0;
      p.spinY = rng.range(-6, 6);
      p.node.setScale(size, 1, size * rng.range(0.6, 1));
    } else {
      p = this.rockPools[rng.int(0, this.rockPools.length - 1)].acquire();
      const look = def.look === 'ice' ? 'ice' : 'rock';
      if (p.look !== look) {
        p.look = look;
        p.renderer.setSharedMaterial(this.materials[look], 0);
      }
      this.rocks++;
      // Big pieces turn slowly.
      const spin = 1 / Math.max(1, size / 3);
      p.rx = rng.range(0, 360);
      p.ry = rng.range(0, 360);
      p.spinX = rng.range(-25, 25) * spin;
      p.spinY = rng.range(-40, 40) * spin;
      const s = size / 2;
      p.node.setScale(s, s * rng.range(0.7, 1), s);
    }
    p.x = rng.range(-halfWidth, halfWidth) * (def.once ? 0.5 : 1);
    p.y = y;
    // Enters just above the view (rocks tumble, so they get room; a moon is round enough).
    const margin = size * (cloud ? 0.7 : def.once ? 0.6 : 1.5);
    p.z = f.camZ + (f.topZ - f.camZ) * k - margin;
    p.maxZ = f.camZ + (f.bottomZ - f.camZ) * k + margin;
    p.speed = this.scrollSpeed * def.speed * rng.range(0.85, 1.15);
    this.pieces.push(p);
  }
}
