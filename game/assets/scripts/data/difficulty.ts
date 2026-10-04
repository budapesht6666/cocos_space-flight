// Difficulty multipliers (GDD §13). Applied when enemies spawn and when emitters fire.

import type { Difficulty, DifficultyDef } from './types';

export const DIFFICULTY_ORDER: readonly Difficulty[] = ['normal', 'hard', 'insane', 'nightmare'];

export const DIFFICULTIES: Record<Difficulty, DifficultyDef> = {
  normal: { hp: 1, bulletSpeed: 1, fireRate: 1, density: 0, credits: 1 },
  hard: { hp: 1.4, bulletSpeed: 1.15, fireRate: 1.25, density: 1, credits: 2 },
  insane: { hp: 1.8, bulletSpeed: 1.3, fireRate: 1.5, density: 2, credits: 3 },
  nightmare: { hp: 2.2, bulletSpeed: 1.4, fireRate: 1.7, density: 2, credits: 3, maxHull: 1 },
};

/** True if `current` is at least `min` (content gated by difficulty). */
export function atLeast(current: Difficulty, min: Difficulty | undefined): boolean {
  return min === undefined || DIFFICULTY_ORDER.indexOf(current) >= DIFFICULTY_ORDER.indexOf(min);
}
