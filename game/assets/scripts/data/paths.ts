// Reusable flight paths for SpawnEvent.move. Points are [x in half-widths, depth fraction]
// (0 = top edge, 1 = bottom edge). Mirror a path with SpawnEvent.mirror.

import type { MoveSpec } from './types';

export type PathId = 'swoop' | 'hook' | 'cross' | 'snake' | 'dropIn';

export const PATHS: Record<PathId, MoveSpec> = {
  /** From the top-left, a U-turn through the middle, out over the top-right. */
  swoop: {
    kind: 'path',
    speed: 6,
    points: [
      [-1.25, -0.08],
      [-0.7, 0.22],
      [0.0, 0.38],
      [0.65, 0.24],
      [1.3, -0.1],
    ],
  },
  /** Straight down the left third, a hook across and back up. */
  hook: {
    kind: 'path',
    speed: 5.5,
    points: [
      [-0.55, -0.12],
      [-0.55, 0.3],
      [-0.1, 0.5],
      [0.45, 0.32],
      [0.5, -0.15],
    ],
  },
  /** Crosses the screen from the left edge, sinking slowly. */
  cross: {
    kind: 'path',
    speed: 5.5,
    points: [
      [-1.3, 0.06],
      [-0.4, 0.2],
      [0.4, 0.22],
      [1.35, 0.4],
    ],
  },
  /** Snakes down the screen in wide zigzags. */
  snake: {
    kind: 'path',
    speed: 6.5,
    points: [
      [-0.6, -0.1],
      [0.6, 0.15],
      [-0.6, 0.4],
      [0.6, 0.65],
      [-0.4, 0.95],
      [-0.4, 1.3],
    ],
  },
  /** Drops in, then peels off to the right. */
  dropIn: {
    kind: 'path',
    speed: 6,
    points: [
      [0.25, -0.1],
      [0.25, 0.32],
      [0.6, 0.52],
      [1.35, 0.6],
    ],
  },
};
