// Campaign structure (GDD §11): three sectors of three missions (stage 7 cut the plan of five to
// three). A sector without missions would show as "coming soon".

import type { Difficulty, SectorDef } from './types';

export const SECTORS: readonly SectorDef[] = [
  {
    id: 1,
    name: 'OUTER RING',
    missions: ['s1m1', 's1m2', 's1m3'],
    boss: 'WARDEN',
    color: [0.3, 0.8, 1.0],
    medalsToAdvance: 8,
    pay: 1,
    // Deep blue with violet and teal clouds.
    nebula: { seed: 11, base: [0.006, 0.008, 0.03], colorA: [0.05, 0.12, 0.42], colorB: [0.36, 0.08, 0.5], colorC: [0.02, 0.45, 0.55], intensity: 0.24 },
  },
  {
    id: 2,
    name: 'ICE MOONS',
    missions: ['s2m1', 's2m2', 's2m3'],
    boss: 'HIVE MOTHER',
    color: [0.8, 0.92, 1.0],
    medalsToAdvance: 8,
    pay: 1.35,
    // Cold: steel blue and frost white with a little teal.
    nebula: { seed: 23, base: [0.006, 0.01, 0.025], colorA: [0.08, 0.2, 0.42], colorB: [0.42, 0.55, 0.72], colorC: [0.05, 0.36, 0.48], intensity: 0.2 },
  },
  {
    id: 3,
    name: 'NEBULA DRIFT',
    missions: ['s3m1', 's3m2', 's3m3'],
    boss: 'LEVIATHAN',
    color: [0.7, 0.4, 1.0],
    medalsToAdvance: 0,
    pay: 1.7,
    // Thick violet and magenta gas.
    nebula: { seed: 37, base: [0.012, 0.004, 0.028], colorA: [0.36, 0.05, 0.52], colorB: [0.62, 0.08, 0.34], colorC: [0.14, 0.08, 0.6], intensity: 0.36 },
  },
];

/** Difficulties offered in the campaign (Insane and Nightmare since stage 7). */
export const CAMPAIGN_DIFFICULTIES: readonly Difficulty[] = ['normal', 'hard', 'insane', 'nightmare'];
