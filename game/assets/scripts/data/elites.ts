// Elite modifiers (GDD §9): from Hard up, a wave enemy may spawn as an elite. Each elite wears a
// coloured ring so it reads at a glance.

import type { EliteDef, EliteId } from './types';

export const ELITES: Record<EliteId, EliteDef> = {
  /** +60% HP, steel sheen. */
  armored: { id: 'armored', hp: 1.6, speed: 1, shield: 0, score: 1.5, color: [0.75, 0.82, 0.95], weight: 3 },
  /** +40% speed. */
  swift: { id: 'swift', hp: 1, speed: 1.4, shield: 0, score: 1.3, color: [0.3, 1.0, 0.55], weight: 3 },
  /** Releases a ring of bullets when it dies. */
  volatile: { id: 'volatile', hp: 1, speed: 1, shield: 0, revenge: 'volatileRing', score: 1.4, color: [1.0, 0.45, 0.1], weight: 2 },
  /** Energy shield worth 30% of its HP, soaked first. */
  shielded: { id: 'shielded', hp: 1, speed: 1, shield: 0.3, score: 1.4, color: [0.3, 0.7, 1.0], weight: 2 },
};

export const ELITE_IDS: readonly EliteId[] = ['armored', 'swift', 'volatile', 'shielded'];

/** Emissive tint of armoured elites between hit flashes (0..255). */
export const ARMORED_TINT = [34, 38, 48] as const;
