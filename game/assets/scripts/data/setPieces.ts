// Ground structures that scroll under the flight plane, with turrets on them. Built from Kenney
// Space Kit modules (see data/props.ts for tile size). Coordinates are relative to the piece
// centre, world units; -z is the end that enters first. Turrets stand on the deck
// (WORLD.heights.ground) — keep them on flat platforms. Destroying every turret of a piece makes
// its crew launch escape pods (`pods`), needed for the Rescuer medal.

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
    pods: { count: 1, x: 0, z: 1.6 },
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
    pods: { count: 1, x: 2.56, z: 0 },
  },
  /** Mining platform: ore piles, fuel tanks, a parked hauler and a big hangar full of miners. */
  refinery: {
    id: 'refinery',
    length: 11,
    modules: [
      { prop: 'station_platform', x: -1.6, z: -3.4 },
      { prop: 'station_platform', x: 1.6, z: -3.4 },
      { prop: 'station_platform', x: -1.6, z: -0.2 },
      { prop: 'station_platform', x: 1.6, z: -0.2 },
      { prop: 'station_ore', x: -2.3, z: -0.7 },
      { prop: 'station_ore', x: -1.0, z: 0.4, rot: 140 },
      { prop: 'station_ore', x: -2.5, z: 0.8, rot: 60 },
      { prop: 'station_hangarLarge', x: 0, z: 3.4, rot: 90 },
      { prop: 'station_tank', x: 3.6, z: -1.2 },
      { prop: 'station_tank', x: 3.6, z: 0.2 },
      { prop: 'station_lattice', x: -3.7, z: -3.4 },
      { prop: 'station_hauler', x: 3.9, z: 3.6, rot: -12 },
    ],
    lights: [
      { x: -3.1, z: -4.9, size: 0.8, color: AMBER },
      { x: 3.1, z: -4.9, size: 0.8, color: AMBER },
      { x: 0, z: 3.4, size: 1.3, color: TEAL },
      { x: 3.6, z: -0.5, size: 0.6, color: TEAL },
    ],
    turrets: [
      { enemy: 'turret', x: -1.8, z: -3.6 },
      { enemy: 'turret', x: 1.8, z: -3.6 },
      { enemy: 'turretHeavy', x: 1.5, z: -0.2 },
    ],
    pods: { count: 2, x: 0, z: 3.2 },
  },
  /** Fuel depot: a corridor spine lined with tanks, two gun pads. */
  depot: {
    id: 'depot',
    length: 14,
    modules: [
      { prop: 'station_frame', x: 0, z: -6.2 },
      { prop: 'station_corridor', x: 0, z: -4.8 },
      { prop: 'station_corridor', x: 0, z: -3.2 },
      { prop: 'station_corridor', x: 0, z: -1.6 },
      { prop: 'station_corridor', x: 0, z: 0 },
      { prop: 'station_corridor', x: 0, z: 1.6 },
      { prop: 'station_corridor', x: 0, z: 3.2 },
      { prop: 'station_corridor', x: 0, z: 4.8 },
      { prop: 'station_frame', x: 0, z: 6.2 },
      { prop: 'station_platform', x: -2.56, z: -2.6 },
      { prop: 'station_platform', x: 2.56, z: 2.6 },
      { prop: 'station_tank', x: 1.45, z: -4.4 },
      { prop: 'station_tank', x: 1.45, z: -3.1 },
      { prop: 'station_tank', x: 1.45, z: -1.8 },
      { prop: 'station_tank', x: -1.45, z: 1.0 },
      { prop: 'station_tank', x: -1.45, z: 2.3 },
      { prop: 'station_tank', x: -1.45, z: 3.6 },
      { prop: 'station_pipe', x: 0, z: 0, rot: 90 },
    ],
    lights: [
      { x: 0, z: -6.2, size: 1.0, color: AMBER },
      { x: 0, z: 6.2, size: 1.0, color: AMBER },
      { x: -3.7, z: -2.6, size: 0.6, color: TEAL },
      { x: 3.7, z: 2.6, size: 0.6, color: TEAL },
    ],
    turrets: [
      { enemy: 'turret', x: -2.56, z: -2.6 },
      { enemy: 'turret', x: 2.56, z: 2.6 },
    ],
    pods: { count: 1, x: 0, z: 0 },
  },
  /** Fortress of the home station's defence ring: a round hub with four gun pads. */
  bastion: {
    id: 'bastion',
    length: 10,
    modules: [
      { prop: 'station_hub', x: 0, z: 0.4 },
      { prop: 'station_platform', x: -3.4, z: -3.0 },
      { prop: 'station_platform', x: 3.4, z: -3.0 },
      { prop: 'station_platform', x: -3.4, z: 3.0 },
      { prop: 'station_platform', x: 3.4, z: 3.0 },
      { prop: 'station_pipe', x: -2.2, z: -1.7, rot: 45 },
      { prop: 'station_pipe', x: 2.2, z: -1.7, rot: -45 },
      { prop: 'station_dish', x: 0, z: -2.9, rot: 180 },
    ],
    lights: [
      { x: 0, z: 0.4, size: 1.6, color: TEAL },
      { x: -4.6, z: -4.2, size: 0.7, color: AMBER },
      { x: 4.6, z: -4.2, size: 0.7, color: AMBER },
      { x: -4.6, z: 4.2, size: 0.7, color: AMBER },
      { x: 4.6, z: 4.2, size: 0.7, color: AMBER },
    ],
    turrets: [
      { enemy: 'turretHeavy', x: -3.4, z: -3.2 },
      { enemy: 'turretHeavy', x: 3.4, z: -3.2 },
      { enemy: 'turret', x: -3.4, z: 3.0 },
      { enemy: 'turret', x: 3.4, z: 3.0 },
    ],
    pods: { count: 2, x: 0, z: 0.4 },
  },
};
