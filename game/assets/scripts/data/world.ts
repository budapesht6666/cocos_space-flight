import type { WorldDef } from './types';

export const WORLD: WorldDef = {
  framing: {
    width: 10,
    pitchDeg: 70,
    hFovDeg: 30,
    focusZ: 0,
  },
  step: 1 / 60,
  scrollSpeed: 6,
  playerTopLimit: 0.35,
  playerEdgeMargin: 0.45,
  spawnMargin: 2,
};
