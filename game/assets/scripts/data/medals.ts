// Mission medals (GDD §12): four per mission and difficulty, kept once earned.

import type { MedalDef } from './types';

export const MEDALS: readonly MedalDef[] = [
  { id: 'hunter', name: 'HUNTER', hint: 'Destroy 70% of enemies' },
  { id: 'exterminator', name: 'EXTERMINATOR', hint: 'Destroy every enemy' },
  { id: 'rescuer', name: 'RESCUER', hint: 'Pick up every escape pod' },
  { id: 'untouchable', name: 'UNTOUCHABLE', hint: 'Take no hull damage' },
];

/** Kill rate for Hunter. */
export const HUNTER_RATE = 0.7;
