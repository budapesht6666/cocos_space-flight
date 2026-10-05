// Picks a quality step from frame times: steps down while frames are slow, retries the step above
// after a while, waiting twice as long after each failed try. Engine-free (fx/RenderScaler.ts
// turns the step into a 3D resolution).

export interface AdaptiveSpec {
  /** Number of steps; 0 is the best. */
  steps: number;
  /** Frame times are averaged over this many seconds; the first window after a change is warm-up. */
  window: number;
  /** An average frame slower than this (ms) steps down. */
  slowFrameMs: number;
  /** Seconds at a lower step before trying the one above. */
  retryAfter: number;
}

/** Frames longer than this are hitches or tab switches, not the steady rate. */
const HITCH = 0.1;

export class AdaptiveLevel {
  level = 0;
  private backoff = 1;
  private sum = 0;
  private frames = 0;
  private atLevel = 0;
  /** Just stepped up to try: a slow window now means the try failed. */
  private probing = false;

  constructor(private readonly spec: AdaptiveSpec) {}

  /** Starts measuring afresh (a new scene) without forgetting the step. */
  restart(): void {
    this.atLevel = 0;
    this.sum = 0;
    this.frames = 0;
  }

  /** Feeds one frame's real duration (s); returns true when the step changed. */
  frame(dt: number): boolean {
    const s = this.spec;
    this.atLevel += dt;
    if (dt > HITCH || this.atLevel < s.window) return false;
    this.sum += dt;
    this.frames++;
    if (this.sum < s.window) return false;
    const frameMs = (this.sum / this.frames) * 1000;
    this.sum = 0;
    this.frames = 0;
    if (frameMs > s.slowFrameMs) {
      if (this.probing) this.backoff *= 2;
      this.probing = false;
      return this.moveTo(this.level + 1);
    }
    if (this.probing) {
      this.probing = false;
      this.backoff = 1;
    }
    if (this.level > 0 && this.atLevel >= s.retryAfter * this.backoff) {
      this.probing = true;
      return this.moveTo(this.level - 1);
    }
    return false;
  }

  /** Seconds to wait at a lower step before the next try (grows after failed tries). */
  get retryDelay(): number {
    return this.spec.retryAfter * this.backoff;
  }

  private moveTo(next: number): boolean {
    if (next < 0 || next >= this.spec.steps || next === this.level) return false;
    this.level = next;
    this.restart();
    return true;
  }
}
