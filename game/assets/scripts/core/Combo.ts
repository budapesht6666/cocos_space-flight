// Kill chain multiplier (GDD §15): kills within the window grow the chain, the multiplier steps
// up every few kills, a hull hit or a lapse resets it. Engine-free.

export interface ComboSpec {
  window: number;
  killsPerStep: number;
  maxMultiplier: number;
}

export class Combo {
  chain = 0;
  /** Seconds left before the chain lapses. */
  timer = 0;
  bestMultiplier = 1;

  constructor(private readonly spec: ComboSpec) {}

  get multiplier(): number {
    return Math.min(this.spec.maxMultiplier, 1 + Math.floor(this.chain / this.spec.killsPerStep));
  }

  /** Fraction of the window left, for the HUD. */
  get remaining(): number {
    return this.spec.window > 0 ? this.timer / this.spec.window : 0;
  }

  /** Registers a kill and returns the multiplier to apply to it. */
  kill(): number {
    this.chain++;
    this.timer = this.spec.window;
    const m = this.multiplier;
    if (m > this.bestMultiplier) this.bestMultiplier = m;
    return m;
  }

  tick(dt: number): void {
    if (this.timer <= 0) return;
    this.timer -= dt;
    if (this.timer <= 0) this.chain = 0;
  }

  break(): void {
    this.chain = 0;
    this.timer = 0;
  }

  reset(): void {
    this.break();
    this.bestMultiplier = 1;
  }
}
