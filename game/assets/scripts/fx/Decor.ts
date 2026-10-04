// Background scenery: procedural rocks drifting far below the flight plane while an asteroid
// field is active ('decor' timeline events). Purely visual. Rocks share meshes and one material
// per field colour, so the whole field draws as a few instanced calls.

import { Node } from 'cc';
import { Pool, swapRemove } from '../core/Pool';
import { DECOR, DECOR_POOL, DECOR_ROCK } from '../data/decor';
import type { DecorFieldDef, DecorFieldId } from '../data/types';
import type { GameContext } from '../game/GameContext';

interface Rock {
  node: Node;
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
  variant: number;
}

interface Field {
  def: DecorFieldDef;
  timeLeft: number;
  /** Fractional rocks owed (spawn accumulator). */
  owed: number;
}

const PARK_Y = -1000;
const MAX_FIELDS = 3;

export class Decor {
  private readonly root: Node;
  private readonly pools: Pool<Rock>[] = [];
  private readonly rocks: Rock[] = [];
  private readonly fields: Field[] = [];

  constructor(
    private readonly ctx: GameContext,
    private readonly scrollSpeed: number,
  ) {
    this.root = new Node('Decor');
    this.root.layer = ctx.worldRoot.layer;
    ctx.worldRoot.addChild(this.root);
    const kit = ctx.kit;
    const material = kit.solid(DECOR_ROCK, 0.05, 0.95);
    for (let v = 0; v < kit.rocks.length; v++) {
      const mesh = kit.rocks[v];
      const pool = new Pool<Rock>(
        () => {
          const node = kit.meshNode('decor', this.root, mesh, material);
          node.setPosition(0, PARK_Y, 0);
          return { node, x: 0, y: 0, z: 0, maxZ: 0, speed: 0, rx: 0, ry: 0, spinX: 0, spinY: 0, variant: v };
        },
        (r) => {
          r.node.setPosition(0, PARK_Y, 0);
        },
      );
      pool.prewarm(Math.ceil(DECOR_POOL / kit.rocks.length));
      this.pools.push(pool);
    }
    for (let i = 0; i < MAX_FIELDS; i++) this.fields.push({ def: DECOR.asteroidField, timeLeft: 0, owed: 0 });
    ctx.bus.on('decor', (e) => this.start(e.field, e.duration));
  }

  start(id: DecorFieldId, duration: number): void {
    let slot = this.fields[0];
    for (const f of this.fields) if (f.timeLeft < slot.timeLeft) slot = f;
    slot.def = DECOR[id];
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
    for (let i = this.rocks.length - 1; i >= 0; i--) {
      const r = this.rocks[i];
      r.z += r.speed * dt;
      r.rx += r.spinX * dt;
      r.ry += r.spinY * dt;
      if (r.z > r.maxZ) this.pools[r.variant].release(swapRemove(this.rocks, i));
    }
  }

  render(): void {
    for (let i = 0; i < this.rocks.length; i++) {
      const r = this.rocks[i];
      r.node.setPosition(r.x, r.y, r.z);
      r.node.setRotationFromEuler(r.rx, r.ry, 0);
    }
  }

  clear(): void {
    for (const f of this.fields) f.timeLeft = 0;
    for (let i = this.rocks.length - 1; i >= 0; i--) this.pools[this.rocks[i].variant].release(swapRemove(this.rocks, i));
  }

  get count(): number {
    return this.rocks.length;
  }

  private spawn(def: DecorFieldDef): void {
    if (this.rocks.length >= DECOR_POOL) return;
    const rng = this.ctx.rng;
    const f = this.ctx.playfield.framing;
    const y = rng.range(def.depth[0], def.depth[1]);
    // What the camera sees at depth y is the y = 0 view scaled about the camera's foot point.
    const k = (f.camY - y) / f.camY;
    const size = rng.range(def.size[0], def.size[1]);
    const halfWidth = this.ctx.playfield.halfWidth(f.topZ) * k;
    const r = this.pools[rng.int(0, this.pools.length - 1)].acquire();
    r.x = rng.range(-halfWidth, halfWidth);
    r.y = y;
    r.z = f.camZ + (f.topZ - f.camZ) * k - size * 1.5;
    r.maxZ = f.camZ + (f.bottomZ - f.camZ) * k + size * 1.5;
    r.speed = this.scrollSpeed * def.speed * rng.range(0.85, 1.15);
    r.rx = rng.range(0, 360);
    r.ry = rng.range(0, 360);
    r.spinX = rng.range(-25, 25);
    r.spinY = rng.range(-40, 40);
    const s = size / 2;
    r.node.setScale(s, s * rng.range(0.7, 1), s);
    this.rocks.push(r);
  }
}
