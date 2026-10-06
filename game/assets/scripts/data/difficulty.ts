// Difficulty multipliers (GDD §13). Applied when enemies spawn and when emitters fire.

import type { Difficulty, DifficultyDef } from './types';

export const DIFFICULTY_ORDER: readonly Difficulty[] = ['normal', 'hard', 'insane', 'nightmare'];

export const DIFFICULTIES: Record<Difficulty, DifficultyDef> = {
  normal: { hp: 1, bulletSpeed: 1, fireRate: 1, density: 0, credits: 1, eliteChance: 0, note: '' },
  hard: { hp: 1.4, bulletSpeed: 1.15, fireRate: 1.25, density: 1, credits: 2, eliteChance: 0.1, note: 'CREDITS ×2  ·  ELITES  ·  SCOUTS SHOOT' },
  insane: { hp: 1.8, bulletSpeed: 1.3, fireRate: 1.5, density: 2, credits: 3, eliteChance: 0.25, eliteWeights: { volatile: 4 }, note: 'CREDITS ×3  ·  MORE ELITES' },
  nightmare: { hp: 2.2, bulletSpeed: 1.4, fireRate: 1.7, density: 2, credits: 3, maxHull: 1, eliteChance: 0.4, eliteWeights: { volatile: 4 }, note: 'CREDITS ×3  ·  ONE HULL SEGMENT' },
};

/** True if `current` is at least `min` (content gated by difficulty). */
export function atLeast(current: Difficulty, min: Difficulty | undefined): boolean {
  return min === undefined || DIFFICULTY_ORDER.indexOf(current) >= DIFFICULTY_ORDER.indexOf(min);
}
