// The playable demo: one mission in a single HTML file for game feeds (BingePlay), built by
// `npm run build:playable` (tools/build-playable.mjs). The page sets `window.SPACEFLIGHT_DEMO`; the
// game then skips the menu, flies this ship with a late-game arsenal (the demo has no hangar, so
// it shows the guns at their best) and points to the full game at the end. Nothing is saved.

import type { Difficulty, DroneId, MissionId, PrimaryId, SecondaryId, ShipId, SpecialId } from './types';

export interface DemoDef {
  mission: MissionId;
  difficulty: Difficulty;
  ship: ShipId;
  /** Start at this Power (1..4). */
  power: number;
  primary: PrimaryId;
  secondary: SecondaryId;
  drones: DroneId[];
  special: SpecialId;
  /** Level of every gun (1..5; drones are capped at 3). */
  level: number;
  /** Where the results and pause screens send the player. */
  fullGameUrl: string;
  /** Button that opens it, and the line under the run's numbers. */
  cta: string;
  pitch: string;
}

export const DEMO: DemoDef = {
  mission: 's1m1',
  difficulty: 'normal',
  ship: 'executioner',
  power: 4,
  primary: 'tesla',
  secondary: 'swarm',
  drones: ['gunDrone', 'guardian'],
  special: 'nova',
  level: 5,
  fullGameUrl: 'https://spaceflight.p1gog.duckdns.org/',
  cta: 'FULL GAME',
  pitch: '9 MISSIONS · 10 GUNS · FREE\nSPACEFLIGHT.P1GOG.DUCKDNS.ORG',
};
