// Visible gameplay area for the current screen shape. Engine-free.

import { computeFraming, halfWidthAt, type Framing } from '../core/Framing';
import { clamp } from '../core/math';
import type { WorldDef } from '../data/types';

export class Playfield {
  framing: Framing;

  constructor(private readonly world: WorldDef, aspect: number) {
    this.framing = computeFraming(world.framing, aspect);
  }

  /** Returns true when the framing actually changed. */
  resize(aspect: number): boolean {
    if (Math.abs(aspect - this.framing.aspect) < 1e-4) return false;
    this.framing = computeFraming(this.world.framing, aspect);
    return true;
  }

  get topZ(): number {
    return this.framing.topZ;
  }

  get bottomZ(): number {
    return this.framing.bottomZ;
  }

  /** Z at a fraction of the visible height: 0 = top edge, 1 = bottom edge. */
  zAt(fraction: number): number {
    return this.topZ + (this.bottomZ - this.topZ) * fraction;
  }

  halfWidth(z: number): number {
    return halfWidthAt(this.framing, z);
  }

  get spawnZ(): number {
    return this.topZ - this.world.spawnMargin;
  }

  get despawnZ(): number {
    return this.bottomZ + this.world.spawnMargin;
  }

  get playerMinZ(): number {
    return this.zAt(this.world.playerTopLimit);
  }

  get playerMaxZ(): number {
    return this.bottomZ - this.world.playerEdgeMargin * 1.6;
  }

  clampPlayerZ(z: number): number {
    return clamp(z, this.playerMinZ, this.playerMaxZ);
  }

  clampPlayerX(x: number, z: number): number {
    const limit = this.halfWidth(z) - this.world.playerEdgeMargin;
    return clamp(x, -limit, limit);
  }

  /** True when a point is so far outside the view that its object can be recycled. */
  isFarOutside(x: number, z: number): boolean {
    return z > this.despawnZ || z < this.spawnZ - 6 || Math.abs(x) > this.halfWidth(z) + 4;
  }
}
