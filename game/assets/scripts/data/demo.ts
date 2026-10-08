// The playable demo: one mission in a single HTML file for game feeds (BingePlay), built by
// `npm run build:playable` (tools/build-playable.mjs). The page sets `window.SPACEFLIGHT_DEMO`; the
// game then skips the menu, flies this ship with a late-game arsenal (the demo has no hangar, so
// it shows the guns at their best), plays a shortened mission and saves nothing. Feed rules
// (BingePlay's gamic spec): a round of 15–90 s, difficulty that ramps over the first plays, no
// links out (no window.open) — the full game's address is only written on the results screen.

import type { Difficulty, DroneId, MissionId, PrimaryId, SecondaryId, ShipId, SpecialId } from './types';

export interface DemoDef {
  mission: MissionId;
  /** Spans of the mission's timeline left out, [from, to) seconds; later events move up. */
  cuts: readonly (readonly [number, number])[];
  /** Difficulty of the first play; each RETRY after a win steps to the next one. */
  ramp: readonly Difficulty[];
  ship: ShipId;
  /** Start at this Power (1..4). */
  power: number;
  primary: PrimaryId;
  secondary: SecondaryId;
  drones: DroneId[];
  special: SpecialId;
  /** Level of every gun (1..5; drones are capped at 3). */
  level: number;
  /** Lines under the run's numbers, in place of the wallet and the record. */
  pitch: string;
}

export const DEMO: DemoDef = {
  mission: 's1m1',
  // Mission 1-1 is ~2.5 min: without the asteroid drift (B) and the last rush (D) it's ~80 s —
  // first waves, the stations with their turrets, the Marauder.
  cuts: [
    [30.5, 56],
    [90.5, 122],
  ],
  ramp: ['normal', 'hard', 'insane'],
  ship: 'executioner',
  power: 4,
  primary: 'tesla',
  secondary: 'swarm',
  drones: ['gunDrone', 'guardian'],
  special: 'nova',
  level: 5,
  pitch: 'FULL GAME FREE: 9 MISSIONS · 10 GUNS\nSPACEFLIGHT.P1GOG.DUCKDNS.ORG',
};
