// Fixed-timestep accumulator: simulation runs at a constant rate regardless of frame rate. Engine-free.

export class FixedStep {
  private accumulator = 0;

  /**
   * @param step simulation step in seconds (1/60)
   * @param maxStepsPerFrame cap that prevents a "spiral of death" after a long hitch
   */
  constructor(
    readonly step: number,
    private readonly maxStepsPerFrame = 5,
  ) {}

  /** Returns how many simulation steps to run for a frame of `frameDt` seconds. */
  advance(frameDt: number): number {
    this.accumulator += Math.max(0, frameDt);
    let steps = Math.floor(this.accumulator / this.step);
    if (steps > this.maxStepsPerFrame) {
      steps = this.maxStepsPerFrame;
      this.accumulator = 0; // drop the backlog instead of fast-forwarding
    } else {
      this.accumulator -= steps * this.step;
    }
    return steps;
  }

  reset(): void {
    this.accumulator = 0;
  }
}
