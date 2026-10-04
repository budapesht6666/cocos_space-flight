// URL parameters for previews and debug builds, e.g. ?debug=1&god=1&power=4&t=20&slowmo=0.25.
// Engine-free so it can be unit-tested; the caller passes `location.search`.

import type { Difficulty } from '../data/types';

const DIFFICULTIES: readonly Difficulty[] = ['normal', 'hard', 'insane', 'nightmare'];

export interface DebugFlags {
  /** FPS / draw calls / entity counts overlay. */
  overlay: boolean;
  /** Player takes no damage. */
  god: boolean;
  /** Starting Power level 1..4, or null for the loadout's. */
  power: number | null;
  /** Seek the mission timeline to this many seconds (skips the intro). */
  t: number;
  /** Fixed RNG seed, or null for a random one. */
  seed: number | null;
  /** Game speed multiplier for inspecting effects, e.g. 0.25. */
  slowmo: number;
  /** Mission id to open (validated by the game), or null for the default. */
  mission: string | null;
  difficulty: Difficulty | null;
}

export function parseDebugFlags(search: string): DebugFlags {
  const params = new URLSearchParams(search);
  const num = (key: string, fallback: number): number => {
    const raw = params.get(key);
    const value = raw === null ? NaN : Number(raw);
    return Number.isFinite(value) ? value : fallback;
  };
  const flag = (key: string): boolean => {
    const raw = params.get(key);
    return raw !== null && raw !== '0' && raw !== 'false';
  };
  const seed = num('seed', NaN);
  const power = num('power', NaN);
  const difficulty = (params.get('difficulty') ?? '').toLowerCase();
  return {
    overlay: flag('debug'),
    god: flag('god'),
    power: Number.isFinite(power) ? Math.min(4, Math.max(1, Math.round(power))) : null,
    t: Math.max(0, num('t', 0)),
    seed: Number.isFinite(seed) ? seed : null,
    slowmo: Math.min(4, Math.max(0.05, num('slowmo', 1))),
    mission: params.get('mission') || null,
    difficulty: DIFFICULTIES.indexOf(difficulty as Difficulty) >= 0 ? (difficulty as Difficulty) : null,
  };
}

export function readDebugFlags(): DebugFlags {
  const search = typeof window !== 'undefined' && window.location ? window.location.search : '';
  return parseDebugFlags(search);
}
