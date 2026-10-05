// Campaign structure (GDD §11): five sectors of three missions. Sectors without missions are not
// built yet and show as "coming soon".

import type { Difficulty, SectorDef } from './types';

export const SECTORS: readonly SectorDef[] = [
  { id: 1, name: 'OUTER RING', missions: ['s1m1', 's1m2', 's1m3'], boss: 'WARDEN', color: [0.3, 0.8, 1.0], medalsToAdvance: 8 },
  { id: 2, name: 'ICE MOONS', missions: [], boss: 'HIVE MOTHER', color: [0.8, 0.92, 1.0], medalsToAdvance: 8 },
  { id: 3, name: 'NEBULA DRIFT', missions: [], boss: 'LEVIATHAN', color: [0.7, 0.4, 1.0], medalsToAdvance: 8 },
  { id: 4, name: 'SCRAPYARD', missions: [], boss: 'DUELIST', color: [1.0, 0.55, 0.25], medalsToAdvance: 8 },
  { id: 5, name: 'CORE', missions: [], boss: 'OVERMIND', color: [1.0, 0.75, 0.3], medalsToAdvance: 0 },
];

/** Difficulties offered in the campaign; Insane and Nightmare join with the later sectors (stage 7). */
export const CAMPAIGN_DIFFICULTIES: readonly Difficulty[] = ['normal', 'hard'];
