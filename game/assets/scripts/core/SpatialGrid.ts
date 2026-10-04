// Uniform grid on the XZ gameplay plane for broad-phase circle queries. Engine-free.
// Rebuilt every step: `clear()`, then `insert()` each collider, then `query()`.
// Storage is reused between steps, so steady-state use doesn't allocate.

export class SpatialGrid {
  private readonly cells = new Map<number, number[]>();
  private readonly usedCells: number[][] = [];

  constructor(private readonly cellSize: number) {}

  clear(): void {
    for (let i = 0; i < this.usedCells.length; i++) this.usedCells[i].length = 0;
    this.usedCells.length = 0;
  }

  /** Registers item `id` with a circle at (x, z) and radius r. */
  insert(id: number, x: number, z: number, r: number): void {
    const minX = this.cellOf(x - r);
    const maxX = this.cellOf(x + r);
    const minZ = this.cellOf(z - r);
    const maxZ = this.cellOf(z + r);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const key = this.key(cx, cz);
        let bucket = this.cells.get(key);
        if (!bucket) {
          bucket = [];
          this.cells.set(key, bucket);
        }
        if (bucket.length === 0) this.usedCells.push(bucket);
        bucket.push(id);
      }
    }
  }

  /**
   * Calls `visit(id)` for every item whose cells overlap the circle's bounding box.
   * An item spanning several cells may be visited more than once; callers dedupe if needed.
   */
  query(x: number, z: number, r: number, visit: (id: number) => void): void {
    const minX = this.cellOf(x - r);
    const maxX = this.cellOf(x + r);
    const minZ = this.cellOf(z - r);
    const maxZ = this.cellOf(z + r);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const bucket = this.cells.get(this.key(cx, cz));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) visit(bucket[i]);
      }
    }
  }

  private cellOf(v: number): number {
    return Math.floor(v / this.cellSize);
  }

  private key(cx: number, cz: number): number {
    // Packs two signed 16-bit cell coordinates into one number key.
    return ((cx + 32768) << 16) | (cz + 32768);
  }
}
