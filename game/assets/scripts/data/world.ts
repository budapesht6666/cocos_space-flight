import type { WorldDef } from './types';

export const WORLD: WorldDef = {
  framing: {
    width: 10,
    pitchDeg: 70,
    hFovDeg: 30,
    focusZ: 0,
  },
  step: 1 / 60,
  playerTopLimit: 0.35,
  playerEdgeMargin: 0.45,
  spawnMargin: 2,
  heights: { playerBullets: 0.05, enemyBullets: 0.35, pickups: 0.25, ground: -0.7 },
  fireMinDepth: 0.03,
  fireMaxDepth: 0.72,
};
