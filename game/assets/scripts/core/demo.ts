// The playable demo's mission and difficulty ramp (data/demo.ts). Engine-free.

import { DEMO } from '../data/demo';
import { MISSIONS } from '../data/missions';
import type { Difficulty, LevelEvent, MissionDef } from '../data/types';

/** Events without the spans [from, to); everything after a span moves up by its length. */
export function cutTimeline(events: readonly LevelEvent[], cuts: readonly (readonly [number, number])[]): LevelEvent[] {
  const out: LevelEvent[] = [];
  for (const e of events) {
    let shift = 0;
    let dropped = false;
    for (const [from, to] of cuts) {
      if (e.t >= from && e.t < to) dropped = true;
      else if (e.t >= to) shift += to - from;
    }
    if (!dropped) out.push(Object.assign({}, e, { t: e.t - shift }));
  }
  return out;
}

/** The demo's mission: its timeline with the cuts. */
export function demoMission(): MissionDef {
  const mission = MISSIONS[DEMO.mission];
  return Object.assign({}, mission, { events: cutTimeline(mission.events, DEMO.cuts) });
}

/** Difficulty of the next play: one step up the ramp after a win, the same after a loss. */
export function nextDemoDifficulty(current: Difficulty, won: boolean): Difficulty {
  const ramp = DEMO.ramp;
  const i = ramp.indexOf(current);
  if (i < 0) return ramp[0];
  return won ? ramp[Math.min(i + 1, ramp.length - 1)] : current;
}
