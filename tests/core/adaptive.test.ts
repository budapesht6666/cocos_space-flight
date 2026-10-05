import { describe, expect, it } from 'vitest';
import { AdaptiveLevel } from '../../game/assets/scripts/core/AdaptiveLevel';

const spec = { steps: 3, window: 2, slowFrameMs: 18.5, retryAfter: 12 };

/** Feeds `seconds` of frames at `fps`; returns how many times the step changed. */
function run(a: AdaptiveLevel, seconds: number, fps: number): number {
  let changes = 0;
  for (let t = 0; t < seconds; t += 1 / fps) if (a.frame(1 / fps)) changes++;
  return changes;
}

describe('adaptive quality step', () => {
  it('stays on the best step at 60 FPS', () => {
    const a = new AdaptiveLevel(spec);
    expect(run(a, 60, 60)).toBe(0);
    expect(a.level).toBe(0);
  });

  it('steps down while slow, one step per warm-up and window, never past the last', () => {
    const a = new AdaptiveLevel(spec);
    run(a, 4.1, 45);
    expect(a.level).toBe(1);
    run(a, 4.1, 45);
    expect(a.level).toBe(2);
    run(a, 20, 45);
    expect(a.level).toBe(2);
  });

  it('ignores hitches and the warm-up after a change', () => {
    const a = new AdaptiveLevel(spec);
    for (let i = 0; i < 20; i++) a.frame(0.5);
    run(a, 3.9, 60);
    expect(a.level).toBe(0);
  });

  it('retries the step above after a while; a failed try doubles the wait, a good one resets it', () => {
    const a = new AdaptiveLevel(spec);
    run(a, 4.1, 45);
    expect(a.level).toBe(1);
    expect(run(a, 12.1, 60)).toBe(1);
    expect(a.level).toBe(0);
    // Too slow up there: back down, and the next try waits twice as long.
    run(a, 4.1, 45);
    expect(a.level).toBe(1);
    expect(a.retryDelay).toBe(24);
    run(a, 13, 60);
    expect(a.level).toBe(1);
    run(a, 12, 60);
    expect(a.level).toBe(0);
    // This time it holds: the wait is back to normal.
    run(a, 4.1, 60);
    expect(a.level).toBe(0);
    expect(a.retryDelay).toBe(12);
  });

  it('restart keeps the step but measures afresh', () => {
    const a = new AdaptiveLevel(spec);
    run(a, 4.1, 45);
    a.restart();
    expect(a.level).toBe(1);
    expect(run(a, 1.9, 30)).toBe(0);
  });
});
