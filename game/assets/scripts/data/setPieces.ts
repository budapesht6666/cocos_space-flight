// Ground structures that scroll under the flight plane, with turrets on them. Built from Kenney
// Space Kit modules (see data/props.ts for tile size). Coordinates are relative to the piece
// centre, world units; -z is the end that enters first. Turrets stand on the deck
// (WORLD.heights.ground) — keep them on platforms.

import type { SetPieceDef, SetPieceId } from './types';

const AMBER = [1.0, 0.55, 0.15] as const;
const TEAL = [0.2, 0.9, 1.0] as const;

export const SET_PIECES: Record<SetPieceId, SetPieceDef> = {
  /** Square deck with a hangar at the back and three guns facing the incoming ship. */
  outpost: {
    id: 'outpost',
    length: 7,
    modules: [
      { prop: 'station_platform', x: -1.6, z: -1.6 },
      { prop: 'station_platform', x: 1.6, z: -1.6 },
      { prop: 'station_platform', x: -1.6, z: 1.6 },
      { prop: 'station_platform', x: 1.6, z: 1.6 },
      { prop: 'station_hangar', x: 0, z: 1.6 },
      { prop: 'station_generator', x: -2.4, z: 1.9 },
      { prop: 'station_dish', x: 2.5, z: 2.2, rot: 200 },
    ],
    lights: [
      { x: -2.9, z: -2.9, size: 0.8, color: AMBER },
      { x: 2.9, z: -2.9, size: 0.8, color: AMBER },
      { x: 0, z: 0.1, size: 1.2, color: TEAL },
      { x: -2.4, z: 3.1, size: 0.6, color: TEAL },
    ],
    turrets: [
      { enemy: 'turret', x: -1.7, z: -2.0 },
      { enemy: 'turret', x: 1.7, z: -2.0 },
      { enemy: 'turretHeavy', x: 0, z: -1.0 },
    ],
  },
  /** Long corridor spine with gun pads on alternating sides. */
  relay: {
    id: 'relay',
    length: 16,
    modules: [
      { prop: 'station_frame', x: 0, z: -7.6 },
      { prop: 'station_corridor', x: 0, z: -6.4 },
      { prop: 'station_corridor', x: 0, z: -4.8 },
      { prop: 'station_corridor', x: 0, z: -3.2 },
      { prop: 'station_corridor', x: 0, z: -1.6 },
      { prop: 'station_corridor', x: 0, z: 0 },
      { prop: 'station_corridor', x: 0, z: 1.6 },
      { prop: 'station_corridor', x: 0, z: 3.2 },
      { prop: 'station_corridor', x: 0, z: 4.8 },
      { prop: 'station_corridor', x: 0, z: 6.4 },
      { prop: 'station_frame', x: 0, z: 7.6 },
      { prop: 'station_platform', x: -2.56, z: -4.6 },
      { prop: 'station_platform', x: 2.56, z: 0 },
      { prop: 'station_platform', x: -2.56, z: 4.6 },
    ],
    lights: [
      { x: 0, z: -7.6, size: 1.0, color: AMBER },
      { x: 0, z: 7.6, size: 1.0, color: AMBER },
      { x: -3.7, z: -4.6, size: 0.6, color: TEAL },
      { x: 3.7, z: 0, size: 0.6, color: TEAL },
      { x: -3.7, z: 4.6, size: 0.6, color: TEAL },
    ],
    turrets: [
      { enemy: 'turret', x: -2.56, z: -4.6 },
      { enemy: 'turretHeavy', x: 2.56, z: 0 },
      { enemy: 'turret', x: -2.56, z: 4.6 },
    ],
  },
};
