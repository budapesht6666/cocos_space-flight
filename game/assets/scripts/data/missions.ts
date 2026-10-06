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
  music: 'mercury',
  onboarding: true,
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

/** Sector 1, mission 2: asteroid fields and pirate-held mining refineries, then the Dreadnought. */
const S1M2: MissionDef = {
  id: 's1m2',
  title: 'MISSION 1-2',
  subtitle: 'MINING BELT',
  music: 'venus',
  scrollSpeed: 6,
  groundSpeed: 3.2,
  events: [
    // A — into the belt: a refinery with crew to free, swooping packs with Power.
    { t: 0.5, type: 'decor', field: 'asteroidField', duration: 32 },
    { t: 1.0, type: 'spawn', enemy: 'scout', formation: v(5), x: 0 },
    { t: 3.5, type: 'spawn', enemy: 'asteroid', formation: single, x: -0.4 },
    { t: 5.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.swoop, stagger: 0.35, bonus: 'power' },
    { t: 6.0, type: 'setPiece', piece: 'refinery', x: 0 },
    { t: 9.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.swoop, mirror: true, stagger: 0.35 },
    { t: 12.0, type: 'spawn', enemy: 'dart', formation: line(2, 4), x: 0 },
    { t: 14.0, type: 'spawn', enemy: 'asteroid', formation: single, x: 0.5 },
    { t: 16.0, type: 'spawn', enemy: 'gunship', formation: single, x: -0.3 },
    { t: 19.0, type: 'spawn', enemy: 'scout', formation: column(5), x: -0.6 },
    { t: 19.0, type: 'spawn', enemy: 'scout', formation: column(5), x: 0.6 },
    { t: 23.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.hook, stagger: 0.3, bonus: 'power' },
    { t: 27.0, type: 'spawn', enemy: 'dart', formation: single, x: 0 },
    { t: 30.0, type: 'waitClear', timeout: 8 },

    // B — dense field: rocks everywhere, a fuel depot, a Gunship pair with Energy.
    { t: 31.0, type: 'decor', field: 'denseField', duration: 26 },
    { t: 31.5, type: 'spawn', enemy: 'asteroid', formation: single, x: -0.6 },
    { t: 32.5, type: 'spawn', enemy: 'asteroid', formation: single, x: 0.3 },
    { t: 34.0, type: 'spawn', enemy: 'rock', formation: line(3, 3), x: 0 },
    { t: 35.0, type: 'spawn', enemy: 'asteroid', formation: single, x: 0.7 },
    { t: 36.0, type: 'spawn', enemy: 'dart', formation: single, x: -0.3 },
    { t: 37.0, type: 'spawn', enemy: 'asteroid', formation: single, x: -0.2 },
    { t: 38.5, type: 'spawn', enemy: 'scout', formation: trail(4), x: 0, move: PATHS.cross, stagger: 0.4 },
    { t: 40.0, type: 'spawn', enemy: 'asteroid', formation: single, x: 0.5 },
    { t: 41.0, type: 'setPiece', piece: 'depot', x: -0.15 },
    { t: 42.0, type: 'spawn', enemy: 'asteroid', formation: single, x: -0.7 },
    { t: 43.0, type: 'spawn', enemy: 'dart', formation: line(2, 4.5), x: 0 },
    { t: 45.0, type: 'spawn', enemy: 'asteroid', formation: single, x: 0.1 },
    { t: 46.0, type: 'spawn', enemy: 'gunship', formation: line(2, 5), x: 0, bonus: 'energy' },
    { t: 50.0, type: 'spawn', enemy: 'scout', formation: v(5), x: 0 },
    { t: 52.0, type: 'spawn', enemy: 'asteroid', formation: single, x: -0.4 },
    { t: 53.0, type: 'spawn', enemy: 'asteroid', formation: single, x: 0.6 },
    { t: 56.0, type: 'waitClear', timeout: 10 },

    // C — the second refinery under heavy traffic.
    { t: 57.0, type: 'decor', field: 'debris', duration: 30 },
    { t: 57.0, type: 'setPiece', piece: 'refinery', x: 0.1 },
    { t: 59.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.hook, stagger: 0.3 },
    { t: 62.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.hook, mirror: true, stagger: 0.3, bonus: 'power' },
    { t: 64.0, type: 'spawn', enemy: 'dart', formation: single, x: 0.6 },
    { t: 65.0, type: 'spawn', enemy: 'dart', formation: single, x: -0.6 },
    { t: 67.0, type: 'spawn', enemy: 'gunship', formation: single, x: 0.45 },
    { t: 70.0, type: 'spawn', enemy: 'scout', formation: line(5, 1.4), x: 0 },
    { t: 72.0, type: 'spawn', enemy: 'asteroid', formation: single, x: -0.5 },
    { t: 74.0, type: 'spawn', enemy: 'scout', formation: trail(6), x: 0, move: PATHS.snake, stagger: 0.3 },
    { t: 76.0, type: 'spawn', enemy: 'gunship', formation: single, x: -0.45 },
    { t: 79.0, type: 'spawn', enemy: 'dart', formation: line(3, 2.4), x: 0 },
    { t: 81.0, type: 'spawn', enemy: 'scout', formation: v(7, 1.1), x: 0 },
    { t: 84.0, type: 'spawn', enemy: 'gunship', formation: line(2, 4.5), x: 0 },
    { t: 88.0, type: 'waitClear', timeout: 10 },

    // D — everything at once in the field, then the Dreadnought.
    { t: 89.0, type: 'decor', field: 'asteroidField', duration: 40 },
    { t: 90.0, type: 'spawn', enemy: 'asteroid', formation: single, x: -0.6 },
    { t: 90.5, type: 'spawn', enemy: 'asteroid', formation: single, x: 0.6 },
    { t: 92.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.swoop, stagger: 0.3 },
    { t: 92.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.swoop, mirror: true, stagger: 0.3 },
    { t: 95.0, type: 'spawn', enemy: 'dart', formation: line(2, 5), x: 0 },
    { t: 97.0, type: 'spawn', enemy: 'gunship', formation: single, x: 0 },
    { t: 99.0, type: 'spawn', enemy: 'scout', formation: column(6), x: -0.65 },
    { t: 99.0, type: 'spawn', enemy: 'scout', formation: column(6), x: 0.65 },
    { t: 103.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.dropIn, stagger: 0.3, bonus: 'power' },
    { t: 105.0, type: 'spawn', enemy: 'asteroid', formation: single, x: 0 },
    { t: 106.0, type: 'spawn', enemy: 'gunship', formation: line(2, 5), x: 0 },
    { t: 109.0, type: 'spawn', enemy: 'dart', formation: line(3, 2.6), x: 0 },
    { t: 112.0, type: 'spawn', enemy: 'scout', formation: v(7, 1.1), x: 0 },
    { t: 116.0, type: 'waitClear', timeout: 12 },
    { t: 117.0, type: 'boss', enemy: 'dreadnought', x: 0 },
  ],
};

/** Sector 1, mission 3: the pirate-held defence ring of the home station, then the Warden. */
const S1M3: MissionDef = {
  id: 's1m3',
  title: 'MISSION 1-3',
  subtitle: 'HOME STATION',
  music: 'mars',
  scrollSpeed: 6.5,
  groundSpeed: 3.4,
  events: [
    // A — the outer posts.
    { t: 1.0, type: 'spawn', enemy: 'scout', formation: line(5, 1.5), x: 0 },
    { t: 3.0, type: 'spawn', enemy: 'scout', formation: v(5), x: -0.35 },
    { t: 5.0, type: 'spawn', enemy: 'scout', formation: v(5), x: 0.35 },
    { t: 6.0, type: 'setPiece', piece: 'outpost', x: -0.25 },
    { t: 8.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.swoop, stagger: 0.35, bonus: 'power' },
    { t: 11.0, type: 'spawn', enemy: 'dart', formation: line(2, 4), x: 0 },
    { t: 13.0, type: 'spawn', enemy: 'gunship', formation: single, x: 0.4 },
    { t: 16.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.swoop, mirror: true, stagger: 0.35 },
    { t: 18.0, type: 'setPiece', piece: 'relay', x: 0.45 },
    { t: 19.0, type: 'spawn', enemy: 'scout', formation: column(5), x: -0.6 },
    { t: 22.0, type: 'spawn', enemy: 'gunship', formation: single, x: -0.4 },
    { t: 24.0, type: 'spawn', enemy: 'dart', formation: line(3, 2.4), x: 0 },
    { t: 26.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.hook, stagger: 0.3, bonus: 'power' },
    { t: 31.0, type: 'waitClear', timeout: 8 },

    // B — a bastion of the defence ring.
    { t: 32.0, type: 'setPiece', piece: 'bastion', x: 0 },
    { t: 34.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.cross, stagger: 0.35 },
    { t: 37.0, type: 'spawn', enemy: 'dart', formation: single, x: -0.5 },
    { t: 37.6, type: 'spawn', enemy: 'dart', formation: single, x: 0.5 },
    { t: 40.0, type: 'spawn', enemy: 'gunship', formation: line(2, 5), x: 0, bonus: 'energy' },
    { t: 44.0, type: 'spawn', enemy: 'scout', formation: v(7, 1.1), x: 0 },
    { t: 46.0, type: 'decor', field: 'debris', duration: 20 },
    { t: 47.0, type: 'spawn', enemy: 'asteroid', formation: single, x: -0.5 },
    { t: 48.0, type: 'spawn', enemy: 'dart', formation: line(2, 4), x: 0 },
    { t: 50.0, type: 'spawn', enemy: 'scout', formation: trail(6), x: 0, move: PATHS.snake, stagger: 0.3 },
    { t: 53.0, type: 'spawn', enemy: 'gunship', formation: single, x: 0 },
    { t: 57.0, type: 'waitClear', timeout: 10 },

    // C — through the rubble past a depot; a Gunship squad.
    { t: 58.0, type: 'decor', field: 'asteroidField', duration: 30 },
    { t: 59.0, type: 'spawn', enemy: 'asteroid', formation: single, x: -0.6 },
    { t: 60.0, type: 'spawn', enemy: 'asteroid', formation: single, x: 0.4 },
    { t: 61.5, type: 'spawn', enemy: 'rock', formation: line(3, 3), x: 0 },
    { t: 62.0, type: 'setPiece', piece: 'depot', x: 0.2 },
    { t: 64.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.hook, stagger: 0.3, bonus: 'power' },
    { t: 66.0, type: 'spawn', enemy: 'asteroid', formation: single, x: 0.7 },
    { t: 67.0, type: 'spawn', enemy: 'gunship', formation: line(3, 3.3), x: 0 },
    { t: 72.0, type: 'spawn', enemy: 'dart', formation: line(3, 2.6), x: 0 },
    { t: 74.0, type: 'spawn', enemy: 'asteroid', formation: single, x: -0.3 },
    { t: 76.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.swoop, mirror: true, stagger: 0.3 },
    { t: 78.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.swoop, stagger: 0.3 },
    { t: 81.0, type: 'spawn', enemy: 'gunship', formation: single, x: -0.5 },
    { t: 82.0, type: 'spawn', enemy: 'gunship', formation: single, x: 0.5 },
    { t: 86.0, type: 'spawn', enemy: 'scout', formation: v(7, 1.1), x: 0 },
    { t: 90.0, type: 'waitClear', timeout: 10 },

    // D — the inner bastion and everything that's left, then the Warden.
    { t: 91.0, type: 'setPiece', piece: 'bastion', x: 0 },
    { t: 93.0, type: 'spawn', enemy: 'scout', formation: column(6), x: -0.65 },
    { t: 93.0, type: 'spawn', enemy: 'scout', formation: column(6), x: 0.65 },
    { t: 96.0, type: 'spawn', enemy: 'dart', formation: line(2, 5), x: 0 },
    { t: 98.0, type: 'spawn', enemy: 'gunship', formation: line(2, 5), x: 0 },
    { t: 101.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.dropIn, stagger: 0.3, bonus: 'power' },
    { t: 103.0, type: 'setPiece', piece: 'outpost', x: 0.25 },
    { t: 104.0, type: 'spawn', enemy: 'dart', formation: line(3, 2.6), x: 0 },
    { t: 107.0, type: 'spawn', enemy: 'scout', formation: trail(6), x: 0, move: PATHS.snake, stagger: 0.3 },
    { t: 110.0, type: 'spawn', enemy: 'gunship', formation: single, x: 0 },
    { t: 113.0, type: 'spawn', enemy: 'scout', formation: v(7, 1.1), x: 0 },
    { t: 117.0, type: 'waitClear', timeout: 12 },
    { t: 118.0, type: 'boss', enemy: 'warden', x: 0 },
  ],
};

// ---- Sector 2: Ice Moons ------------------------------------------------------------------------

/** Sector 2, mission 1: into the ice — Spinners, Splitters and the first mines, then the Cyclone. */
const S2M1: MissionDef = {
  id: 's2m1',
  title: 'MISSION 2-1',
  subtitle: 'FROZEN REACH',
  music: 'venus',
  scrollSpeed: 5.5,
  groundSpeed: 3.0,
  events: [
    // A — ice floes and the first Spinner.
    { t: 0.5, type: 'decor', field: 'iceField', duration: 30 },
    { t: 1.0, type: 'spawn', enemy: 'scout', formation: v(5), x: 0 },
    { t: 3.5, type: 'spawn', enemy: 'iceRock', formation: single, x: -0.5 },
    { t: 5.0, type: 'spawn', enemy: 'spinner', formation: single, x: 0 },
    { t: 7.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.swoop, stagger: 0.35, bonus: 'power' },
    { t: 10.0, type: 'spawn', enemy: 'iceRock', formation: single, x: 0.5 },
    { t: 11.0, type: 'spawn', enemy: 'splitter', formation: line(2, 4.5), x: 0 },
    { t: 14.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.swoop, mirror: true, stagger: 0.35 },
    { t: 16.0, type: 'spawn', enemy: 'dart', formation: line(2, 4), x: 0 },
    { t: 18.0, type: 'spawn', enemy: 'spinner', formation: line(2, 5), x: 0 },
    { t: 21.0, type: 'spawn', enemy: 'iceRock', formation: single, x: -0.2 },
    { t: 22.0, type: 'spawn', enemy: 'scout', formation: column(5), x: -0.6 },
    { t: 22.0, type: 'spawn', enemy: 'scout', formation: column(5), x: 0.6 },
    { t: 26.0, type: 'spawn', enemy: 'splitter', formation: single, x: 0 },
    { t: 29.0, type: 'waitClear', timeout: 8 },

    // B — a moon passes below; mines drift through the floes.
    { t: 30.0, type: 'decor', field: 'iceMoon', duration: 1 },
    { t: 30.0, type: 'decor', field: 'iceDebris', duration: 24 },
    { t: 31.0, type: 'spawn', enemy: 'mine', formation: line(3, 3), x: 0 },
    { t: 33.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.hook, stagger: 0.3, bonus: 'power' },
    { t: 35.0, type: 'spawn', enemy: 'iceRock', formation: single, x: 0.6 },
    { t: 36.5, type: 'spawn', enemy: 'gunship', formation: single, x: -0.3 },
    { t: 39.0, type: 'spawn', enemy: 'mine', formation: line(2, 5), x: 0 },
    { t: 40.0, type: 'spawn', enemy: 'splitter', formation: line(2, 4.5), x: 0 },
    { t: 43.0, type: 'spawn', enemy: 'iceRock', formation: single, x: -0.6 },
    { t: 44.0, type: 'spawn', enemy: 'scout', formation: trail(4), x: 0, move: PATHS.cross, stagger: 0.4 },
    { t: 46.0, type: 'spawn', enemy: 'gunship', formation: line(2, 5), x: 0, bonus: 'energy' },
    { t: 50.0, type: 'spawn', enemy: 'mine', formation: single, x: 0.2 },
    { t: 51.0, type: 'spawn', enemy: 'spinner', formation: single, x: -0.4 },
    { t: 55.0, type: 'waitClear', timeout: 10 },

    // C — a research dome held by pirates.
    { t: 56.0, type: 'decor', field: 'iceField', duration: 30 },
    { t: 56.0, type: 'setPiece', piece: 'cryoLab', x: 0 },
    { t: 58.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.hook, mirror: true, stagger: 0.3 },
    { t: 61.0, type: 'spawn', enemy: 'dart', formation: single, x: 0.6 },
    { t: 62.0, type: 'spawn', enemy: 'dart', formation: single, x: -0.6 },
    { t: 64.0, type: 'spawn', enemy: 'spinner', formation: single, x: 0.4 },
    { t: 66.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.swoop, stagger: 0.3, bonus: 'power' },
    { t: 69.0, type: 'spawn', enemy: 'iceRock', formation: single, x: -0.5 },
    { t: 70.0, type: 'spawn', enemy: 'splitter', formation: line(3, 3), x: 0 },
    { t: 72.0, type: 'setPiece', piece: 'relay', x: -0.45 },
    { t: 74.0, type: 'spawn', enemy: 'mine', formation: line(2, 4), x: 0.2 },
    { t: 76.0, type: 'spawn', enemy: 'scout', formation: trail(6), x: 0, move: PATHS.snake, stagger: 0.3 },
    { t: 79.0, type: 'spawn', enemy: 'gunship', formation: single, x: 0.4 },
    { t: 82.0, type: 'spawn', enemy: 'spinner', formation: line(2, 5), x: 0 },
    { t: 87.0, type: 'waitClear', timeout: 10 },

    // D — all of it, then the Cyclone.
    { t: 88.0, type: 'decor', field: 'iceDebris', duration: 30 },
    { t: 89.0, type: 'spawn', enemy: 'iceRock', formation: single, x: -0.6 },
    { t: 89.5, type: 'spawn', enemy: 'iceRock', formation: single, x: 0.6 },
    { t: 91.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.swoop, stagger: 0.3 },
    { t: 91.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.swoop, mirror: true, stagger: 0.3 },
    { t: 94.0, type: 'spawn', enemy: 'splitter', formation: line(2, 5), x: 0 },
    { t: 96.0, type: 'spawn', enemy: 'mine', formation: line(3, 3), x: 0 },
    { t: 98.0, type: 'spawn', enemy: 'spinner', formation: single, x: 0 },
    { t: 100.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.dropIn, stagger: 0.3, bonus: 'power' },
    { t: 103.0, type: 'spawn', enemy: 'dart', formation: line(3, 2.6), x: 0 },
    { t: 105.0, type: 'spawn', enemy: 'gunship', formation: line(2, 5), x: 0 },
    { t: 108.0, type: 'spawn', enemy: 'scout', formation: v(7, 1.1), x: 0 },
    { t: 113.0, type: 'waitClear', timeout: 12 },
    { t: 114.0, type: 'boss', enemy: 'cyclone', x: 0 },
  ],
};

/** Sector 2, mission 2: the shattered moon — fields of ice and mines, Splitters everywhere, then the Shatterer. */
const S2M2: MissionDef = {
  id: 's2m2',
  title: 'MISSION 2-2',
  subtitle: 'SHATTERED MOON',
  music: 'mercury',
  scrollSpeed: 5.5,
  groundSpeed: 3.0,
  events: [
    // A — the debris belt of a moon broken in two.
    { t: 0.5, type: 'decor', field: 'iceMoon', duration: 1 },
    { t: 0.5, type: 'decor', field: 'iceField', duration: 30 },
    { t: 1.0, type: 'spawn', enemy: 'splitter', formation: line(3, 3), x: 0 },
    { t: 4.0, type: 'spawn', enemy: 'iceRock', formation: single, x: 0.4 },
    { t: 5.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.swoop, stagger: 0.35, bonus: 'power' },
    { t: 8.0, type: 'spawn', enemy: 'mine', formation: line(2, 4), x: 0 },
    { t: 9.0, type: 'spawn', enemy: 'iceRock', formation: single, x: -0.5 },
    { t: 11.0, type: 'spawn', enemy: 'spinner', formation: single, x: 0.35 },
    { t: 13.0, type: 'spawn', enemy: 'scout', formation: v(5), x: -0.3 },
    { t: 15.0, type: 'spawn', enemy: 'splitter', formation: v(3, 2), x: 0 },
    { t: 18.0, type: 'spawn', enemy: 'iceRock', formation: line(2, 5), x: 0 },
    { t: 19.0, type: 'spawn', enemy: 'dart', formation: line(2, 4.5), x: 0 },
    { t: 21.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.hook, stagger: 0.3, bonus: 'power' },
    { t: 24.0, type: 'spawn', enemy: 'mine', formation: line(3, 3), x: 0 },
    { t: 26.0, type: 'spawn', enemy: 'spinner', formation: single, x: -0.35 },
    { t: 29.0, type: 'waitClear', timeout: 8 },

    // B — the thick of the field: rocks, mines, a fuel depot.
    { t: 30.0, type: 'decor', field: 'iceDebris', duration: 26 },
    { t: 30.5, type: 'spawn', enemy: 'iceRock', formation: single, x: -0.6 },
    { t: 31.5, type: 'spawn', enemy: 'iceRock', formation: single, x: 0.3 },
    { t: 33.0, type: 'spawn', enemy: 'iceChip', formation: line(3, 3), x: 0 },
    { t: 34.0, type: 'setPiece', piece: 'depot', x: 0.15 },
    { t: 35.0, type: 'spawn', enemy: 'mine', formation: single, x: -0.3 },
    { t: 36.0, type: 'spawn', enemy: 'splitter', formation: line(2, 4), x: 0 },
    { t: 38.0, type: 'spawn', enemy: 'iceRock', formation: single, x: 0.6 },
    { t: 39.0, type: 'spawn', enemy: 'scout', formation: trail(4), x: 0, move: PATHS.cross, stagger: 0.4 },
    { t: 41.0, type: 'spawn', enemy: 'mine', formation: line(2, 5), x: 0 },
    { t: 42.0, type: 'spawn', enemy: 'gunship', formation: line(2, 5), x: 0, bonus: 'energy' },
    { t: 46.0, type: 'spawn', enemy: 'iceRock', formation: single, x: -0.2 },
    { t: 47.0, type: 'spawn', enemy: 'spinner', formation: line(2, 5), x: 0 },
    { t: 51.0, type: 'spawn', enemy: 'splitter', formation: single, x: 0.5 },
    { t: 55.0, type: 'waitClear', timeout: 10 },

    // C — a cryo lab on the moon's broken half.
    { t: 56.0, type: 'decor', field: 'iceField', duration: 32 },
    { t: 56.0, type: 'setPiece', piece: 'cryoLab', x: -0.1 },
    { t: 58.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.hook, mirror: true, stagger: 0.3, bonus: 'power' },
    { t: 61.0, type: 'spawn', enemy: 'splitter', formation: line(3, 3), x: 0 },
    { t: 63.0, type: 'spawn', enemy: 'dart', formation: single, x: 0.6 },
    { t: 64.0, type: 'spawn', enemy: 'dart', formation: single, x: -0.6 },
    { t: 66.0, type: 'spawn', enemy: 'mine', formation: line(3, 3), x: 0 },
    { t: 68.0, type: 'spawn', enemy: 'gunship', formation: single, x: -0.4 },
    { t: 70.0, type: 'spawn', enemy: 'spinner', formation: single, x: 0.4 },
    { t: 72.0, type: 'spawn', enemy: 'scout', formation: trail(6), x: 0, move: PATHS.snake, stagger: 0.3 },
    { t: 75.0, type: 'spawn', enemy: 'iceRock', formation: line(2, 5), x: 0 },
    { t: 77.0, type: 'spawn', enemy: 'splitter', formation: v(3, 2), x: 0 },
    { t: 80.0, type: 'spawn', enemy: 'gunship', formation: line(2, 4.5), x: 0 },
    { t: 86.0, type: 'waitClear', timeout: 10 },

    // D — everything left in the belt, then the Shatterer.
    { t: 87.0, type: 'decor', field: 'iceDebris', duration: 30 },
    { t: 88.0, type: 'spawn', enemy: 'mine', formation: line(3, 3), x: 0 },
    { t: 90.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.swoop, stagger: 0.3 },
    { t: 90.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.swoop, mirror: true, stagger: 0.3 },
    { t: 93.0, type: 'spawn', enemy: 'splitter', formation: line(3, 3), x: 0 },
    { t: 95.0, type: 'spawn', enemy: 'spinner', formation: line(2, 5), x: 0 },
    { t: 98.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.dropIn, stagger: 0.3, bonus: 'power' },
    { t: 100.0, type: 'spawn', enemy: 'iceRock', formation: single, x: 0 },
    { t: 101.0, type: 'spawn', enemy: 'dart', formation: line(3, 2.6), x: 0 },
    { t: 104.0, type: 'spawn', enemy: 'mine', formation: line(2, 5), x: 0 },
    { t: 106.0, type: 'spawn', enemy: 'scout', formation: v(7, 1.1), x: 0 },
    { t: 111.0, type: 'waitClear', timeout: 12 },
    { t: 112.0, type: 'boss', enemy: 'shatterer', x: 0 },
  ],
};

/** Sector 2, mission 3: the hive among the moons — swarms, a fortress and a lab, then the Hive Mother. */
const S2M3: MissionDef = {
  id: 's2m3',
  title: 'MISSION 2-3',
  subtitle: 'THE HIVE',
  music: 'mars',
  scrollSpeed: 6,
  groundSpeed: 3.2,
  events: [
    // A — the hive's pickets: swarms and Spinners.
    { t: 0.5, type: 'decor', field: 'iceField', duration: 30 },
    { t: 1.0, type: 'spawn', enemy: 'swarmer', formation: line(4, 1.8), x: 0 },
    { t: 3.0, type: 'spawn', enemy: 'scout', formation: v(5), x: 0.3 },
    { t: 5.0, type: 'spawn', enemy: 'spinner', formation: single, x: -0.3 },
    { t: 7.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.swoop, stagger: 0.35, bonus: 'power' },
    { t: 10.0, type: 'spawn', enemy: 'swarmer', formation: v(5, 1.4), x: 0 },
    { t: 12.0, type: 'spawn', enemy: 'iceRock', formation: single, x: 0.5 },
    { t: 13.0, type: 'spawn', enemy: 'splitter', formation: line(2, 4.5), x: 0 },
    { t: 16.0, type: 'spawn', enemy: 'spinner', formation: line(2, 5), x: 0 },
    { t: 19.0, type: 'spawn', enemy: 'swarmer', formation: line(5, 1.6), x: 0 },
    { t: 21.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.hook, stagger: 0.3, bonus: 'power' },
    { t: 24.0, type: 'spawn', enemy: 'mine', formation: line(3, 3), x: 0 },
    { t: 26.0, type: 'spawn', enemy: 'gunship', formation: single, x: 0 },
    { t: 30.0, type: 'waitClear', timeout: 8 },

    // B — a fortress on the ice.
    { t: 31.0, type: 'setPiece', piece: 'bastion', x: 0 },
    { t: 33.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.cross, stagger: 0.35 },
    { t: 36.0, type: 'spawn', enemy: 'swarmer', formation: line(4, 2), x: 0 },
    { t: 38.0, type: 'spawn', enemy: 'splitter', formation: line(2, 5), x: 0 },
    { t: 40.0, type: 'spawn', enemy: 'gunship', formation: line(2, 5), x: 0, bonus: 'energy' },
    { t: 44.0, type: 'spawn', enemy: 'mine', formation: line(2, 4), x: 0 },
    { t: 45.0, type: 'decor', field: 'iceDebris', duration: 20 },
    { t: 46.0, type: 'spawn', enemy: 'spinner', formation: single, x: 0.4 },
    { t: 48.0, type: 'spawn', enemy: 'scout', formation: trail(6), x: 0, move: PATHS.snake, stagger: 0.3 },
    { t: 51.0, type: 'spawn', enemy: 'swarmer', formation: v(5, 1.4), x: 0 },
    { t: 53.0, type: 'spawn', enemy: 'iceRock', formation: line(2, 5), x: 0 },
    { t: 57.0, type: 'waitClear', timeout: 10 },

    // C — the lab where the hive grows its swarm.
    { t: 58.0, type: 'decor', field: 'iceMoon', duration: 1 },
    { t: 58.0, type: 'decor', field: 'iceField', duration: 30 },
    { t: 59.0, type: 'setPiece', piece: 'cryoLab', x: 0.1 },
    { t: 61.0, type: 'spawn', enemy: 'swarmer', formation: line(5, 1.6), x: 0 },
    { t: 63.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.hook, mirror: true, stagger: 0.3, bonus: 'power' },
    { t: 66.0, type: 'spawn', enemy: 'spinner', formation: line(2, 5), x: 0 },
    { t: 68.0, type: 'spawn', enemy: 'mine', formation: line(3, 3), x: 0 },
    { t: 70.0, type: 'spawn', enemy: 'splitter', formation: v(3, 2), x: 0 },
    { t: 73.0, type: 'spawn', enemy: 'swarmer', formation: v(7, 1.2), x: 0 },
    { t: 75.0, type: 'spawn', enemy: 'gunship', formation: single, x: -0.45 },
    { t: 77.0, type: 'spawn', enemy: 'gunship', formation: single, x: 0.45 },
    { t: 80.0, type: 'spawn', enemy: 'scout', formation: v(7, 1.1), x: 0 },
    { t: 86.0, type: 'waitClear', timeout: 10 },

    // D — the inner hive, then the Hive Mother.
    { t: 87.0, type: 'setPiece', piece: 'outpost', x: -0.25 },
    { t: 89.0, type: 'spawn', enemy: 'swarmer', formation: line(5, 1.6), x: 0 },
    { t: 91.0, type: 'spawn', enemy: 'scout', formation: column(6), x: -0.65 },
    { t: 91.0, type: 'spawn', enemy: 'scout', formation: column(6), x: 0.65 },
    { t: 94.0, type: 'spawn', enemy: 'spinner', formation: single, x: 0 },
    { t: 96.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.dropIn, stagger: 0.3, bonus: 'power' },
    { t: 98.0, type: 'spawn', enemy: 'mine', formation: line(3, 3), x: 0 },
    { t: 100.0, type: 'spawn', enemy: 'splitter', formation: line(3, 3), x: 0 },
    { t: 103.0, type: 'spawn', enemy: 'swarmer', formation: v(7, 1.2), x: 0 },
    { t: 105.0, type: 'spawn', enemy: 'gunship', formation: line(2, 5), x: 0 },
    { t: 110.0, type: 'waitClear', timeout: 12 },
    { t: 111.0, type: 'boss', enemy: 'hiveMother', x: 0 },
  ],
};

// ---- Sector 3: Nebula Drift ---------------------------------------------------------------------

/** Sector 3, mission 1: the edge of the nebula — Lancers and the first Carriers, then the Arbiter. */
const S3M1: MissionDef = {
  id: 's3m1',
  title: 'MISSION 3-1',
  subtitle: 'NEBULA EDGE',
  music: 'mercury',
  scrollSpeed: 6,
  groundSpeed: 3.2,
  events: [
    // A — first Lancers in the gas.
    { t: 0.5, type: 'decor', field: 'nebulaClouds', duration: 60 },
    { t: 1.0, type: 'spawn', enemy: 'scout', formation: line(5, 1.5), x: 0 },
    { t: 3.0, type: 'spawn', enemy: 'lancer', formation: single, x: -0.7 },
    { t: 5.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.swoop, stagger: 0.35, bonus: 'power' },
    { t: 8.0, type: 'spawn', enemy: 'dart', formation: line(2, 4), x: 0 },
    { t: 10.0, type: 'spawn', enemy: 'lancer', formation: single, x: 0.7 },
    { t: 12.0, type: 'spawn', enemy: 'spinner', formation: single, x: 0 },
    { t: 14.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.swoop, mirror: true, stagger: 0.35 },
    { t: 17.0, type: 'spawn', enemy: 'splitter', formation: line(2, 4.5), x: 0 },
    { t: 19.0, type: 'spawn', enemy: 'lancer', formation: line(2, 7), x: 0 },
    { t: 22.0, type: 'spawn', enemy: 'scout', formation: column(5), x: -0.6 },
    { t: 22.0, type: 'spawn', enemy: 'scout', formation: column(5), x: 0.6 },
    { t: 25.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.hook, stagger: 0.3, bonus: 'power' },
    { t: 30.0, type: 'waitClear', timeout: 8 },

    // B — a Carrier crosses with its Scouts.
    { t: 31.0, type: 'spawn', enemy: 'carrier', formation: single, x: -0.3 },
    { t: 34.0, type: 'spawn', enemy: 'dart', formation: single, x: 0.6 },
    { t: 36.0, type: 'spawn', enemy: 'lancer', formation: single, x: 0.75 },
    { t: 39.0, type: 'spawn', enemy: 'mine', formation: line(2, 5), x: 0 },
    { t: 41.0, type: 'spawn', enemy: 'gunship', formation: line(2, 5), x: 0, bonus: 'energy' },
    { t: 45.0, type: 'spawn', enemy: 'scout', formation: trail(4), x: 0, move: PATHS.cross, stagger: 0.4 },
    { t: 47.0, type: 'spawn', enemy: 'spinner', formation: single, x: -0.4 },
    { t: 50.0, type: 'spawn', enemy: 'scout', formation: v(5), x: 0 },
    { t: 55.0, type: 'waitClear', timeout: 10 },

    // C — a navigation beacon held by pirates.
    { t: 56.0, type: 'setPiece', piece: 'beacon', x: 0 },
    { t: 57.0, type: 'decor', field: 'denseClouds', duration: 26 },
    { t: 58.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.hook, mirror: true, stagger: 0.3, bonus: 'power' },
    { t: 61.0, type: 'spawn', enemy: 'lancer', formation: single, x: -0.75 },
    { t: 63.0, type: 'spawn', enemy: 'splitter', formation: line(3, 3), x: 0 },
    { t: 66.0, type: 'spawn', enemy: 'dart', formation: line(3, 2.4), x: 0 },
    { t: 68.0, type: 'spawn', enemy: 'lancer', formation: single, x: 0.75 },
    { t: 70.0, type: 'spawn', enemy: 'scout', formation: trail(6), x: 0, move: PATHS.snake, stagger: 0.3 },
    { t: 73.0, type: 'spawn', enemy: 'gunship', formation: single, x: 0 },
    { t: 76.0, type: 'spawn', enemy: 'spinner', formation: line(2, 5), x: 0 },
    { t: 79.0, type: 'spawn', enemy: 'scout', formation: v(7, 1.1), x: 0 },
    { t: 85.0, type: 'waitClear', timeout: 10 },

    // D — everything, then the Arbiter.
    { t: 86.0, type: 'decor', field: 'nebulaClouds', duration: 40 },
    { t: 87.0, type: 'spawn', enemy: 'carrier', formation: single, x: 0.35 },
    { t: 89.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.swoop, stagger: 0.3 },
    { t: 92.0, type: 'spawn', enemy: 'lancer', formation: single, x: -0.75 },
    { t: 94.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.dropIn, stagger: 0.3, bonus: 'power' },
    { t: 97.0, type: 'spawn', enemy: 'mine', formation: line(3, 3), x: 0 },
    { t: 99.0, type: 'spawn', enemy: 'dart', formation: line(2, 5), x: 0 },
    { t: 101.0, type: 'spawn', enemy: 'gunship', formation: line(2, 5), x: 0 },
    { t: 104.0, type: 'spawn', enemy: 'scout', formation: v(7, 1.1), x: 0 },
    { t: 109.0, type: 'waitClear', timeout: 12 },
    { t: 110.0, type: 'boss', enemy: 'arbiter', x: 0 },
  ],
};

/** Sector 3, mission 2: deep in the drift — Carrier convoys and Lancer nests, then the Broodship. */
const S3M2: MissionDef = {
  id: 's3m2',
  title: 'MISSION 3-2',
  subtitle: 'DEEP DRIFT',
  music: 'venus',
  scrollSpeed: 6,
  groundSpeed: 3.2,
  events: [
    // A — a convoy in the clouds.
    { t: 0.5, type: 'decor', field: 'denseClouds', duration: 30 },
    { t: 1.0, type: 'spawn', enemy: 'carrier', formation: single, x: 0.4 },
    { t: 3.0, type: 'spawn', enemy: 'scout', formation: v(5), x: -0.35 },
    { t: 5.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.swoop, stagger: 0.35, bonus: 'power' },
    { t: 8.0, type: 'spawn', enemy: 'lancer', formation: single, x: -0.75 },
    { t: 10.0, type: 'spawn', enemy: 'splitter', formation: line(2, 4.5), x: 0 },
    { t: 13.0, type: 'spawn', enemy: 'dart', formation: line(2, 4), x: 0 },
    { t: 15.0, type: 'spawn', enemy: 'lancer', formation: single, x: 0.75 },
    { t: 17.0, type: 'spawn', enemy: 'spinner', formation: single, x: 0 },
    { t: 20.0, type: 'spawn', enemy: 'carrier', formation: single, x: -0.4 },
    { t: 23.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.hook, stagger: 0.3, bonus: 'power' },
    { t: 26.0, type: 'spawn', enemy: 'mine', formation: line(2, 5), x: 0 },
    { t: 30.0, type: 'waitClear', timeout: 10 },

    // B — a Lancer nest around an outpost.
    { t: 31.0, type: 'decor', field: 'nebulaClouds', duration: 26 },
    { t: 31.0, type: 'setPiece', piece: 'outpost', x: 0.2 },
    { t: 33.0, type: 'spawn', enemy: 'lancer', formation: line(2, 7), x: 0 },
    { t: 36.0, type: 'spawn', enemy: 'scout', formation: trail(4), x: 0, move: PATHS.cross, stagger: 0.4 },
    { t: 38.0, type: 'spawn', enemy: 'gunship', formation: line(2, 5), x: 0, bonus: 'energy' },
    { t: 42.0, type: 'spawn', enemy: 'splitter', formation: v(3, 2), x: 0 },
    { t: 44.0, type: 'spawn', enemy: 'lancer', formation: single, x: 0.75 },
    { t: 46.0, type: 'spawn', enemy: 'dart', formation: line(3, 2.4), x: 0 },
    { t: 49.0, type: 'spawn', enemy: 'spinner', formation: line(2, 5), x: 0 },
    { t: 52.0, type: 'spawn', enemy: 'scout', formation: trail(6), x: 0, move: PATHS.snake, stagger: 0.3 },
    { t: 57.0, type: 'waitClear', timeout: 10 },

    // C — the beacon the convoys steer by.
    { t: 58.0, type: 'decor', field: 'denseClouds', duration: 28 },
    { t: 58.0, type: 'setPiece', piece: 'beacon', x: -0.1 },
    { t: 60.0, type: 'spawn', enemy: 'carrier', formation: single, x: 0.45 },
    { t: 62.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.hook, mirror: true, stagger: 0.3, bonus: 'power' },
    { t: 65.0, type: 'spawn', enemy: 'mine', formation: line(3, 3), x: 0 },
    { t: 67.0, type: 'spawn', enemy: 'lancer', formation: single, x: -0.75 },
    { t: 70.0, type: 'spawn', enemy: 'splitter', formation: line(3, 3), x: 0 },
    { t: 72.0, type: 'spawn', enemy: 'gunship', formation: single, x: -0.4 },
    { t: 74.0, type: 'spawn', enemy: 'gunship', formation: single, x: 0.4 },
    { t: 77.0, type: 'spawn', enemy: 'scout', formation: v(7, 1.1), x: 0 },
    { t: 83.0, type: 'waitClear', timeout: 10 },

    // D — the convoy's escort, then the Broodship.
    { t: 84.0, type: 'decor', field: 'nebulaClouds', duration: 40 },
    { t: 85.0, type: 'spawn', enemy: 'carrier', formation: line(2, 5.5), x: 0 },
    { t: 88.0, type: 'spawn', enemy: 'lancer', formation: single, x: 0.75 },
    { t: 90.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.dropIn, stagger: 0.3, bonus: 'power' },
    { t: 93.0, type: 'spawn', enemy: 'spinner', formation: single, x: -0.3 },
    { t: 95.0, type: 'spawn', enemy: 'dart', formation: line(3, 2.6), x: 0 },
    { t: 97.0, type: 'spawn', enemy: 'mine', formation: line(2, 5), x: 0 },
    { t: 99.0, type: 'spawn', enemy: 'scout', formation: v(7, 1.1), x: 0 },
    { t: 105.0, type: 'waitClear', timeout: 12 },
    { t: 106.0, type: 'boss', enemy: 'broodship', x: 0 },
  ],
};

/** Sector 3, mission 3: the heart of the nebula — everything at once, then the Leviathan. */
const S3M3: MissionDef = {
  id: 's3m3',
  title: 'MISSION 3-3',
  subtitle: 'DARK HEART',
  music: 'mars',
  scrollSpeed: 6.5,
  groundSpeed: 3.4,
  events: [
    // A — the gate: Lancers and swarms.
    { t: 0.5, type: 'decor', field: 'nebulaClouds', duration: 30 },
    { t: 1.0, type: 'spawn', enemy: 'scout', formation: line(5, 1.5), x: 0 },
    { t: 3.0, type: 'spawn', enemy: 'lancer', formation: line(2, 7), x: 0 },
    { t: 6.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.swoop, stagger: 0.35, bonus: 'power' },
    { t: 9.0, type: 'spawn', enemy: 'swarmer', formation: line(4, 1.8), x: 0 },
    { t: 11.0, type: 'spawn', enemy: 'spinner', formation: single, x: 0.35 },
    { t: 13.0, type: 'spawn', enemy: 'splitter', formation: line(2, 4.5), x: 0 },
    { t: 16.0, type: 'spawn', enemy: 'carrier', formation: single, x: -0.35 },
    { t: 19.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.hook, stagger: 0.3, bonus: 'power' },
    { t: 22.0, type: 'spawn', enemy: 'lancer', formation: single, x: 0.75 },
    { t: 24.0, type: 'spawn', enemy: 'mine', formation: line(3, 3), x: 0 },
    { t: 30.0, type: 'waitClear', timeout: 10 },

    // B — the fortress at the gate.
    { t: 31.0, type: 'decor', field: 'denseClouds', duration: 26 },
    { t: 31.0, type: 'setPiece', piece: 'bastion', x: 0 },
    { t: 33.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.cross, stagger: 0.35 },
    { t: 36.0, type: 'spawn', enemy: 'dart', formation: line(2, 5), x: 0 },
    { t: 38.0, type: 'spawn', enemy: 'gunship', formation: line(2, 5), x: 0, bonus: 'energy' },
    { t: 42.0, type: 'spawn', enemy: 'lancer', formation: single, x: -0.75 },
    { t: 44.0, type: 'spawn', enemy: 'swarmer', formation: v(5, 1.4), x: 0 },
    { t: 47.0, type: 'spawn', enemy: 'spinner', formation: line(2, 5), x: 0 },
    { t: 50.0, type: 'spawn', enemy: 'scout', formation: trail(6), x: 0, move: PATHS.snake, stagger: 0.3 },
    { t: 53.0, type: 'spawn', enemy: 'splitter', formation: v(3, 2), x: 0 },
    { t: 57.0, type: 'waitClear', timeout: 10 },

    // C — the beacon and a convoy.
    { t: 58.0, type: 'decor', field: 'nebulaClouds', duration: 30 },
    { t: 58.0, type: 'setPiece', piece: 'beacon', x: 0.1 },
    { t: 60.0, type: 'spawn', enemy: 'carrier', formation: single, x: -0.45 },
    { t: 62.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.hook, mirror: true, stagger: 0.3, bonus: 'power' },
    { t: 65.0, type: 'spawn', enemy: 'lancer', formation: single, x: 0.75 },
    { t: 67.0, type: 'spawn', enemy: 'mine', formation: line(3, 3), x: 0 },
    { t: 69.0, type: 'spawn', enemy: 'gunship', formation: line(3, 3.3), x: 0 },
    { t: 74.0, type: 'spawn', enemy: 'swarmer', formation: line(5, 1.6), x: 0 },
    { t: 76.0, type: 'spawn', enemy: 'splitter', formation: line(3, 3), x: 0 },
    { t: 79.0, type: 'spawn', enemy: 'scout', formation: v(7, 1.1), x: 0 },
    { t: 85.0, type: 'waitClear', timeout: 10 },

    // D — the last guard, then the Leviathan.
    { t: 86.0, type: 'decor', field: 'denseClouds', duration: 40 },
    { t: 86.0, type: 'setPiece', piece: 'cryoLab', x: -0.2 },
    { t: 88.0, type: 'spawn', enemy: 'lancer', formation: line(2, 7), x: 0 },
    { t: 90.0, type: 'spawn', enemy: 'scout', formation: column(6), x: -0.65 },
    { t: 90.0, type: 'spawn', enemy: 'scout', formation: column(6), x: 0.65 },
    { t: 93.0, type: 'spawn', enemy: 'scout', formation: trail(5), x: 0, move: PATHS.dropIn, stagger: 0.3, bonus: 'power' },
    { t: 95.0, type: 'spawn', enemy: 'carrier', formation: single, x: 0.4 },
    { t: 98.0, type: 'spawn', enemy: 'dart', formation: line(3, 2.6), x: 0 },
    { t: 100.0, type: 'spawn', enemy: 'spinner', formation: single, x: -0.35 },
    { t: 103.0, type: 'spawn', enemy: 'scout', formation: v(7, 1.1), x: 0 },
    { t: 109.0, type: 'waitClear', timeout: 12 },
    { t: 110.0, type: 'boss', enemy: 'leviathan', x: 0 },
  ],
};

export const MISSIONS: Record<MissionId, MissionDef> = {
  s1m1: S1M1,
  s1m2: S1M2,
  s1m3: S1M3,
  s2m1: S2M1,
  s2m2: S2M2,
  s2m3: S2M3,
  s3m1: S3M1,
  s3m2: S3M2,
  s3m3: S3M3,
};

/** Campaign order (the start screen lists missions in this order; NEXT follows it). */
export const MISSION_ORDER: readonly MissionId[] = ['s1m1', 's1m2', 's1m3', 's2m1', 's2m2', 's2m3', 's3m1', 's3m2', 's3m3'];

export const DEFAULT_MISSION: MissionId = 's1m1';

export function nextMission(id: MissionId): MissionId | null {
  const i = MISSION_ORDER.indexOf(id);
  return i >= 0 && i + 1 < MISSION_ORDER.length ? MISSION_ORDER[i + 1] : null;
}

/** Seconds between the WARNING banner and the boss entering. */
export const BOSS_WARNING_TIME = 2.6;
