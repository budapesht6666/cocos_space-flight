// Vertical-slice timeline: an endless loop of short waves that ramps up each loop.
// Real missions (stage 2+) get their own timelines with set pieces and bosses.

import type { WaveEvent } from './types';

export const SLICE_LOOP_GAP = 3;

export const SLICE_WAVES: WaveEvent[] = [
  { t: 1.0, enemy: 'scout', formation: { kind: 'line', count: 4, spacing: 1.6 }, x: 0 },
  { t: 4.0, enemy: 'scout', formation: { kind: 'v', count: 5, spacing: 1.2 }, x: -0.35 },
  { t: 6.5, enemy: 'scout', formation: { kind: 'v', count: 5, spacing: 1.2 }, x: 0.35 },
  { t: 9.0, enemy: 'dart', formation: { kind: 'single', count: 1, spacing: 0 }, x: -0.5 },
  { t: 9.6, enemy: 'dart', formation: { kind: 'single', count: 1, spacing: 0 }, x: 0.5 },
  { t: 12.0, enemy: 'scout', formation: { kind: 'column', count: 6, spacing: 1.3 }, x: -0.6 },
  { t: 12.0, enemy: 'scout', formation: { kind: 'column', count: 6, spacing: 1.3 }, x: 0.6 },
  { t: 16.0, enemy: 'dart', formation: { kind: 'line', count: 3, spacing: 2.4 }, x: 0 },
  { t: 19.0, enemy: 'scout', formation: { kind: 'line', count: 6, spacing: 1.3 }, x: 0 },
  { t: 21.0, enemy: 'dart', formation: { kind: 'single', count: 1, spacing: 0 }, x: 0 },
  { t: 23.0, enemy: 'scout', formation: { kind: 'v', count: 7, spacing: 1.1 }, x: 0 },
  { t: 25.5, enemy: 'dart', formation: { kind: 'line', count: 2, spacing: 4 }, x: 0 },
];
