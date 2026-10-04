// `?debug=1`: engine stats (FPS, draw calls, triangles) plus our own entity counts.

import { Label, profiler } from 'cc';

export interface EntityCounts {
  enemies: number;
  bullets: number;
  fx: number;
}

export class DebugOverlay {
  private timer = 0;

  constructor(
    private readonly label: Label,
    private readonly counts: () => EntityCounts,
    private readonly extra: () => string,
  ) {
    profiler.showStats();
  }

  tick(dt: number): void {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.25;
    const c = this.counts();
    this.label.string = `enemies ${c.enemies}  bullets ${c.bullets}  fx ${c.fx}\n${this.extra()}`;
  }
}
