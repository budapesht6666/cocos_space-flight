import { describe, expect, it } from 'vitest';
import { cutTimeline, demoMission, nextDemoDifficulty } from '../../game/assets/scripts/core/demo';
import { DEMO } from '../../game/assets/scripts/data/demo';
import { MISSIONS } from '../../game/assets/scripts/data/missions';
import type { LevelEvent } from '../../game/assets/scripts/data/types';

const wait = (t: number): LevelEvent => ({ t, type: 'waitClear' });

describe('cutTimeline', () => {
  it('drops events inside a span and moves the later ones up', () => {
    const out = cutTimeline([wait(1), wait(10), wait(19.9), wait(20), wait(35)], [[10, 20]]);
    expect(out.map((e) => e.t)).toEqual([1, 10, 25]);
  });

  it('adds up several spans', () => {
    const out = cutTimeline([wait(5), wait(15), wait(25), wait(40)], [[10, 20], [30, 35]]);
    expect(out.map((e) => e.t)).toEqual([5, 15, 25]);
  });

  it('leaves the source untouched', () => {
    const events = [wait(30)];
    cutTimeline(events, [[0, 10]]);
    expect(events[0].t).toBe(30);
  });
});

describe('demoMission', () => {
  it('fits a feed round (15–90 s before the boss fight) and keeps the boss', () => {
    const m = demoMission();
    const boss = m.events.find((e) => e.type === 'boss');
    expect(boss).toBeDefined();
    expect(boss!.t).toBeGreaterThan(15);
    expect(boss!.t).toBeLessThanOrEqual(75);
    expect(m.events.length).toBeLessThan(MISSIONS[DEMO.mission].events.length);
    // Times stay in order.
    for (let i = 1; i < m.events.length; i++) expect(m.events[i].t).toBeGreaterThanOrEqual(m.events[i - 1].t);
  });
});

describe('nextDemoDifficulty', () => {
  it('steps up the ramp after a win, stays after a loss, tops out', () => {
    expect(nextDemoDifficulty('normal', true)).toBe('hard');
    expect(nextDemoDifficulty('hard', true)).toBe('insane');
    expect(nextDemoDifficulty('insane', true)).toBe('insane');
    expect(nextDemoDifficulty('hard', false)).toBe('hard');
    expect(nextDemoDifficulty('nightmare', true)).toBe(DEMO.ramp[0]);
  });
});
