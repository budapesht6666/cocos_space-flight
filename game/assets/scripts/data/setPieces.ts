// Ground structures that scroll under the flight plane, with turrets on them.
// Geometry is a placeholder built from boxes until a station asset is chosen (docs/ASSETS.md).
// Coordinates are relative to the piece centre, world units; -z is the end that enters first.
// Blocks rise `h` above the deck surface (WORLD.heights.ground), where turrets stand.

import type { SetPieceDef, SetPieceId } from './types';

const AMBER = [1.0, 0.55, 0.15] as const;
const TEAL = [0.2, 0.9, 1.0] as const;

export const SET_PIECES: Record<SetPieceId, SetPieceDef> = {
  outpost: {
    id: 'outpost',
    length: 8,
    blocks: [
      { x: 0, z: 0, w: 5.6, l: 7.4, h: 0, tone: 'hull' },
      { x: 0, z: 0.3, w: 2.0, l: 2.6, h: 0.7, tone: 'dark' },
      { x: 0, z: 0.3, w: 1.2, l: 1.6, h: 1.0, tone: 'hull' },
      { x: -2.9, z: 1.6, w: 1.4, l: 2.4, h: 0.35, tone: 'dark' },
      { x: 2.9, z: 1.6, w: 1.4, l: 2.4, h: 0.35, tone: 'dark' },
      { x: -2.75, z: -1.8, w: 0.14, l: 3.2, h: 0.12, tone: 'trim' },
      { x: 2.75, z: -1.8, w: 0.14, l: 3.2, h: 0.12, tone: 'trim' },
      { x: 0, z: -3.6, w: 5.2, l: 0.14, h: 0.12, tone: 'trim' },
    ],
    lights: [
      { x: -2.75, z: -3.5, size: 0.7, color: AMBER },
      { x: 2.75, z: -3.5, size: 0.7, color: AMBER },
      { x: 0, z: 0.3, size: 1.1, color: TEAL },
      { x: -2.9, z: 2.9, size: 0.6, color: TEAL },
      { x: 2.9, z: 2.9, size: 0.6, color: TEAL },
    ],
    turrets: [
      { enemy: 'turret', x: -1.7, z: -2.2 },
      { enemy: 'turret', x: 1.7, z: -2.2 },
      { enemy: 'turret', x: 0, z: 2.6 },
    ],
  },
  relay: {
    id: 'relay',
    length: 15,
    blocks: [
      { x: 0, z: 0, w: 1.4, l: 15, h: 0, tone: 'hull' },
      { x: 0, z: 0, w: 0.5, l: 14.6, h: 0.25, tone: 'dark' },
      { x: -1.6, z: -4.5, w: 2.2, l: 2.2, h: 0, tone: 'hull' },
      { x: 1.6, z: 0, w: 2.2, l: 2.2, h: 0, tone: 'hull' },
      { x: -1.6, z: 4.5, w: 2.2, l: 2.2, h: 0, tone: 'hull' },
      { x: 0, z: -7.3, w: 2.6, l: 0.4, h: 0.4, tone: 'dark' },
      { x: 0, z: 7.3, w: 2.6, l: 0.4, h: 0.4, tone: 'dark' },
      { x: 0.75, z: -3, w: 0.12, l: 4, h: 0.1, tone: 'trim' },
      { x: -0.75, z: 2, w: 0.12, l: 4, h: 0.1, tone: 'trim' },
    ],
    lights: [
      { x: 0, z: -7.3, size: 0.9, color: AMBER },
      { x: 0, z: 7.3, size: 0.9, color: AMBER },
      { x: 0, z: -2, size: 0.5, color: TEAL },
      { x: 0, z: 2, size: 0.5, color: TEAL },
    ],
    turrets: [
      { enemy: 'turret', x: -1.6, z: -4.5 },
      { enemy: 'turret', x: 1.6, z: 0 },
      { enemy: 'turret', x: -1.6, z: 4.5 },
    ],
  },
};

export const SET_PIECE_TONES = {
  // Dark albedo: the scene's HDR sun (110 000 lux) blows light greys out to white.
  hull: [0.1, 0.115, 0.15] as const,
  dark: [0.035, 0.04, 0.055] as const,
  trim: [0.9, 0.5, 0.15] as const,
};

/** Blocks extend this far below the deck surface. */
export const SET_PIECE_DEPTH = 1.2;
