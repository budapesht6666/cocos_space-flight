// Mission timelines. Times are seconds of the mission clock, which starts after the intro and
// stops while a `waitClear` or `boss` event is holding. Events must stay sorted by `t`.

import type { FormationSpec } from '../core/formations';
import { PATHS } from './paths';
import type { MissionDef, MissionId } from './types';

const single: FormationSpec = { kind: 'single', count: 1, spacing: 0 };
const line = (count: number, spacing = 1.5): FormationSpec => ({ kind: 'line', count, spacing });
const v = (count: number, spacing = 1.2): FormationSpec => ({ kind: 'v', count, spacing });
const column = (count: number, spacing = 1.3): FormationSpec => ({ kind: 'column', count, spacing });
const trail = (count: number): FormationSpec => ({ kind: 'trail', count, spacing: 0 });

/** Sector 1, mission 1: Scouts and Darts, first Gunships, an asteroid drift, two stations, the Marauder. */
const S1M1: MissionDef = {
  id: 's1m1',
  title: 'MISSION 1-1',
  subtitle: 'OUTER RING',
  scrollSpeed: 6,
  groundSpeed: 3.2,
  events: [
    // A — first contact: formations, a swooping pack that carries Power.
    { t: 1.0, type: 'spawn', enemy: 'scout', formation: line(4, 1.6), x: 0 },
    { t: 4.0, type: 'spawn', enemy: 'scout', formation: v(5), x: -0.35 },
    { t: 6.5, type: 'spawn', enemy: 'scout', formation: v(5), x: 0.35 },
    { t: 9.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.swoop, stagger: 0.35, bonus: 'power' },
    { t: 13.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.swoop, mirror: true, stagger: 0.35 },
    { t: 16.0, type: 'spawn', enemy: 'dart', formation: single, x: -0.5 },
    { t: 16.6, type: 'spawn', enemy: 'dart', formation: single, x: 0.5 },
    { t: 19.0, type: 'spawn', enemy: 'scout', formation: column(5), x: -0.6 },
    { t: 19.0, type: 'spawn', enemy: 'scout', formation: column(5), x: 0.6 },
    { t: 23.0, type: 'spawn', enemy: 'gunship', formation: single, x: 0 },
    { t: 25.5, type: 'spawn', enemy: 'scout', formation: line(5, 1.4), x: 0 },
    { t: 30.0, type: 'waitClear', timeout: 8 },

    // B — asteroid drift with Darts and a Gunship pair.
    { t: 31.0, type: 'spawn', enemy: 'asteroid', formation: single, x: -0.5 },
    { t: 32.5, type: 'spawn', enemy: 'asteroid', formation: single, x: 0.4 },
    { t: 34.0, type: 'spawn', enemy: 'rock', formation: line(2, 4), x: -0.1 },
    { t: 35.0, type: 'spawn', enemy: 'dart', formation: single, x: 0 },
    { t: 36.5, type: 'spawn', enemy: 'asteroid', formation: single, x: 0.7 },
    { t: 38.0, type: 'spawn', enemy: 'asteroid', formation: single, x: -0.2 },
    { t: 39.0, type: 'spawn', enemy: 'scout', formation: trail(4), x: 0, move: PATHS.cross, stagger: 0.4 },
    { t: 41.0, type: 'spawn', enemy: 'asteroid', formation: single, x: 0 },
    { t: 42.0, type: 'spawn', enemy: 'dart', formation: line(2, 4), x: 0 },
    { t: 44.0, type: 'spawn', enemy: 'asteroid', formation: single, x: -0.6 },
    { t: 45.0, type: 'spawn', enemy: 'asteroid', formation: single, x: 0.5 },
    { t: 47.0, type: 'spawn', enemy: 'gunship', formation: line(2, 5), x: 0, bonus: 'energy' },
    { t: 52.0, type: 'spawn', enemy: 'scout', formation: v(5), x: 0 },
    { t: 55.0, type: 'waitClear', timeout: 10 },

    // C — stations with turrets, mixed air traffic.
    { t: 56.0, type: 'setPiece', piece: 'outpost', x: -0.2 },
    { t: 58.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.hook, stagger: 0.3 },
    { t: 62.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.hook, mirror: true, stagger: 0.3, bonus: 'power' },
    { t: 64.0, type: 'spawn', enemy: 'dart', formation: single, x: 0.6 },
    { t: 66.0, type: 'spawn', enemy: 'dart', formation: single, x: -0.6 },
    { t: 68.0, type: 'setPiece', piece: 'relay', x: 0.45 },
    { t: 69.0, type: 'spawn', enemy: 'scout', formation: line(4, 1.5), x: -0.3 },
    { t: 72.0, type: 'spawn', enemy: 'gunship', formation: single, x: -0.4 },
    { t: 75.0, type: 'spawn', enemy: 'scout', formation: v(7, 1.1), x: 0 },
    { t: 78.0, type: 'spawn', enemy: 'dart', formation: line(3, 2.4), x: 0 },
    { t: 80.0, type: 'spawn', enemy: 'scout', formation: trail(6), x: 0, move: PATHS.snake, stagger: 0.3 },
    { t: 84.0, type: 'spawn', enemy: 'gunship', formation: line(2, 4.5), x: 0 },
    { t: 90.0, type: 'waitClear', timeout: 10 },

    // D — everything at once, then the Marauder.
    { t: 91.0, type: 'spawn', enemy: 'asteroid', formation: single, x: -0.6 },
    { t: 91.5, type: 'spawn', enemy: 'asteroid', formation: single, x: 0.6 },
    { t: 93.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.swoop, stagger: 0.3 },
    { t: 93.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.swoop, mirror: true, stagger: 0.3 },
    { t: 97.0, type: 'spawn', enemy: 'dart', formation: line(2, 5), x: 0 },
    { t: 98.0, type: 'spawn', enemy: 'dart', formation: single, x: 0 },
    { t: 100.0, type: 'setPiece', piece: 'outpost', x: 0.25 },
    { t: 102.0, type: 'spawn', enemy: 'gunship', formation: single, x: 0.6 },
    { t: 104.0, type: 'spawn', enemy: 'scout', formation: column(6), x: -0.65 },
    { t: 104.0, type: 'spawn', enemy: 'scout', formation: column(6), x: 0.65 },
    { t: 108.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.dropIn, stagger: 0.3, bonus: 'power' },
    { t: 110.0, type: 'spawn', enemy: 'asteroid', formation: single, x: 0 },
    { t: 112.0, type: 'spawn', enemy: 'gunship', formation: line(2, 5), x: 0 },
    { t: 114.0, type: 'spawn', enemy: 'dart', formation: line(3, 2.6), x: 0 },
    { t: 117.0, type: 'spawn', enemy: 'scout', formation: v(7, 1.1), x: 0 },
    { t: 122.0, type: 'waitClear', timeout: 12 },
    { t: 123.0, type: 'boss', enemy: 'marauder', x: 0 },
  ],
};

export const MISSIONS: Record<MissionId, MissionDef> = {
  s1m1: S1M1,
};

export const DEFAULT_MISSION: MissionId = 's1m1';

/** Seconds between the WARNING banner and the boss entering. */
export const BOSS_WARNING_TIME = 2.6;
