// The path a serpent swam, so its segments can follow it (the Leviathan). Engine-free.
// A ring buffer of points at least `step` apart; sampling walks back from the head by arc length.

export interface TrailSample {
  x: number;
  z: number;
  /** Unit direction of travel at that point (towards the head). */
  dx: number;
  dz: number;
}

export class Trail {
  private readonly xs: Float32Array;
  private readonly zs: Float32Array;
  /** Index of the newest point. */
  private newest = 0;
  private count = 0;
  private headX = 0;
  private headZ = 0;

  constructor(
    private readonly capacity: number,
    private readonly step: number,
  ) {
    this.xs = new Float32Array(capacity);
    this.zs = new Float32Array(capacity);
  }

  /** Longest distance behind the head the trail can answer for. */
  get reach(): number {
    return (this.capacity - 1) * this.step;
  }

  /** Starts over at (x, z) with a straight tail stretching away along (backX, backZ). */
  reset(x: number, z: number, backX: number, backZ: number): void {
    const len = Math.hypot(backX, backZ) || 1;
    const bx = backX / len;
    const bz = backZ / len;
    this.count = this.capacity;
    // Oldest first, so the newest point ends up at (x, z).
    for (let i = 0; i < this.capacity; i++) {
      const back = (this.capacity - 1 - i) * this.step;
      this.xs[i] = x + bx * back;
      this.zs[i] = z + bz * back;
    }
    this.newest = this.capacity - 1;
    this.headX = x;
    this.headZ = z;
  }

  /** The head moved to (x, z): records a point once it is a step away from the last one. */
  push(x: number, z: number): void {
    this.headX = x;
    this.headZ = z;
    const dx = x - this.xs[this.newest];
    const dz = z - this.zs[this.newest];
    if (dx * dx + dz * dz < this.step * this.step) return;
    this.newest = (this.newest + 1) % this.capacity;
    this.xs[this.newest] = x;
    this.zs[this.newest] = z;
    if (this.count < this.capacity) this.count++;
  }

  /** The point `distance` behind the head along the trail, into `out`. */
  sample(distance: number, out: TrailSample): TrailSample {
    // Walk from the head through the recorded points, newest first.
    let ax = this.headX;
    let az = this.headZ;
    let left = distance;
    for (let k = 0; k < this.count; k++) {
      const i = (this.newest - k + this.capacity) % this.capacity;
      const bx = this.xs[i];
      const bz = this.zs[i];
      const seg = Math.hypot(bx - ax, bz - az);
      if (seg >= left && seg > 1e-6) {
        const t = left / seg;
        out.x = ax + (bx - ax) * t;
        out.z = az + (bz - az) * t;
        out.dx = (ax - bx) / seg;
        out.dz = (az - bz) / seg;
        return out;
      }
      if (seg > 1e-6) {
        out.dx = (ax - bx) / seg;
        out.dz = (az - bz) / seg;
      }
      left -= seg;
      ax = bx;
      az = bz;
    }
    // Past the oldest point: carry on straight.
    out.x = ax - out.dx * left;
    out.z = az - out.dz * left;
    return out;
  }
}
