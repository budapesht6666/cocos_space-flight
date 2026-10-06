// Background scenery drifting far below the flight plane: asteroid fields, ice and an ice moon
// (Ice Moons), gas clouds (Nebula Drift). Purely visual — nothing here collides. Started by
// 'decor' timeline events.

import type { DecorFieldDef, DecorFieldId, Rgb } from './types';

/** Lit rock colour shared by all rock decor (one material). Dark: light albedo blows out under HDR. */
export const DECOR_ROCK: Rgb = [0.2, 0.17, 0.15];
/** Ice: a cold blue-grey, glossier than rock. */
export const DECOR_ICE: Rgb = [0.13, 0.18, 0.25];

const CLOUD_VIOLET: Rgb = [0.55, 0.2, 0.85];
const CLOUD_PINK: Rgb = [0.85, 0.25, 0.55];

export const DECOR: Record<DecorFieldId, DecorFieldDef> = {
  asteroidField: { id: 'asteroidField', look: 'rock', rate: 1.1, depth: [-10, -3.5], size: [1.4, 3.4], speed: 0.6 },
  denseField: { id: 'denseField', look: 'rock', rate: 2.6, depth: [-11, -3], size: [1.1, 4.2], speed: 0.6 },
  /** Small wreckage and gravel close under the ship. */
  debris: { id: 'debris', look: 'rock', rate: 2.2, depth: [-4, -1.8], size: [0.3, 0.75], speed: 0.85 },
  /** Ice Moons: floes of ice. */
  iceField: { id: 'iceField', look: 'ice', rate: 1.3, depth: [-11, -3.5], size: [1.2, 3.8], speed: 0.6 },
  /** Ice shards close under the ship. */
  iceDebris: { id: 'iceDebris', look: 'ice', rate: 2.4, depth: [-4, -1.8], size: [0.3, 0.8], speed: 0.85 },
  /** One frozen moon passing far below, slowly. */
  iceMoon: { id: 'iceMoon', look: 'ice', once: true, rate: 0, depth: [-34, -30], size: [17, 20], speed: 0.22 },
  /** Nebula Drift: gas clouds between the field and the stars. */
  nebulaClouds: { id: 'nebulaClouds', look: 'cloud', rate: 0.32, depth: [-22, -10], size: [9, 15], speed: 0.45, color: CLOUD_VIOLET, intensity: 0.32 },
  denseClouds: { id: 'denseClouds', look: 'cloud', rate: 0.55, depth: [-20, -8], size: [8, 14], speed: 0.5, color: CLOUD_PINK, intensity: 0.28 },
};

/** Rocks kept in the decor pool (dense fields at their peak). */
export const DECOR_POOL = 44;
/** Clouds at once: big translucent planes cost fill rate on phones, so few. */
export const CLOUD_POOL = 8;
