// Plays a mission timeline: emits spawn requests when their time comes. Engine-free.

export interface TimedEvent {
  /** Seconds from the start of the timeline. */
  t: number;
}

export interface TimelineOptions {
  /** Restart from the beginning after the last event (endless test loop). */
  loop: boolean;
  /** Extra gap after the last event before looping, seconds. */
  loopGap: number;
}

export class WaveDirector<E extends TimedEvent> {
  private time = 0;
  private cursor = 0;
  private loops = 0;
  private readonly duration: number;

  constructor(
    private readonly events: readonly E[],
    private readonly options: TimelineOptions,
  ) {
    for (let i = 1; i < events.length; i++) {
      if (events[i].t < events[i - 1].t) throw new Error(`timeline not sorted at index ${i}`);
    }
    const last = events.length ? events[events.length - 1].t : 0;
    this.duration = last + options.loopGap;
  }

  /** Number of completed loops; useful to ramp difficulty in the endless test loop. */
  get loopCount(): number {
    return this.loops;
  }

  get elapsed(): number {
    return this.time;
  }

  get finished(): boolean {
    return !this.options.loop && this.cursor >= this.events.length;
  }

  /** Jumps to `t` seconds without firing the skipped events (debug `?t=`). */
  seek(t: number): void {
    this.time = Math.max(0, t);
    this.cursor = 0;
    while (this.cursor < this.events.length && this.events[this.cursor].t < this.time) this.cursor++;
  }

  reset(): void {
    this.time = 0;
    this.cursor = 0;
    this.loops = 0;
  }

  /** Advances by `dt` and calls `fire` for every event whose time has come. */
  tick(dt: number, fire: (event: E, loop: number) => void): void {
    this.time += dt;
    while (this.cursor < this.events.length && this.events[this.cursor].t <= this.time) {
      fire(this.events[this.cursor], this.loops);
      this.cursor++;
    }
    if (this.options.loop && this.events.length > 0 && this.time >= this.duration) {
      this.time -= this.duration;
      this.cursor = 0;
      this.loops++;
    }
  }
}
