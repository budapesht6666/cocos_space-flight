// Background scenery: rocks drifting far below the flight plane (asteroid fields). Purely visual —
// nothing here collides. Started by 'decor' timeline events.

import type { DecorFieldDef, DecorFieldId, Rgb } from './types';

/** Lit rock colour shared by all decor (one material). Dark: light albedo blows out under HDR. */
export const DECOR_ROCK: Rgb = [0.2, 0.17, 0.15];

export const DECOR: Record<DecorFieldId, DecorFieldDef> = {
  asteroidField: { id: 'asteroidField', rate: 1.1, depth: [-10, -3.5], size: [1.4, 3.4], speed: 0.6 },
  denseField: { id: 'denseField', rate: 2.6, depth: [-11, -3], size: [1.1, 4.2], speed: 0.6 },
  /** Small wreckage and gravel close under the ship. */
  debris: { id: 'debris', rate: 2.2, depth: [-4, -1.8], size: [0.3, 0.75], speed: 0.85 },
};

/** Rocks kept in the decor pool (dense fields at their peak). */
export const DECOR_POOL = 44;
