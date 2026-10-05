// URL parameters for previews and debug builds, e.g. ?debug=1&god=1&power=4&t=20&slowmo=0.25.
// Engine-free so it can be unit-tested; the caller passes `location.search`.

import type { Difficulty, EliteId } from '../data/types';

const DIFFICULTIES: readonly Difficulty[] = ['normal', 'hard', 'insane', 'nightmare'];
const ELITES: readonly EliteId[] = ['armored', 'swift', 'volatile', 'shielded'];

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
  /** Every wave enemy becomes this elite (`?elite=volatile`), or a random one (`?elite=1`). */
  elite: EliteId | 'random' | null;
  /** Every sector, mission, difficulty and ship is open (`?unlock=1`); nothing is saved as earned. */
  unlock: boolean;
  /** Developer wallet: set the credits to this once per page load (`?credits=50000`), or null. */
  credits: number | null;
  /** Wipe the save once per page load (`?reset=1`), before `credits`. */
  reset: boolean;
  /** Fixed 3D resolution (`?scale=0.5`, 0.3..1) instead of the adaptive one, or null. */
  scale: number | null;
  /** Post effects forced on or off (`?bloom=0`, `?fxaa=1`), or null for the defaults in data. */
  bloom: boolean | null;
  fxaa: boolean | null;
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
  const toggle = (key: string): boolean | null => {
    const raw = params.get(key);
    return raw === null ? null : raw !== '0' && raw !== 'false';
  };
  const seed = num('seed', NaN);
  const credits = num('credits', NaN);
  const scale = num('scale', NaN);
  const power = num('power', NaN);
  const difficulty = (params.get('difficulty') ?? '').toLowerCase();
  const elite = (params.get('elite') ?? '').toLowerCase();
  return {
    overlay: flag('debug'),
    god: flag('god'),
    power: Number.isFinite(power) ? Math.min(4, Math.max(1, Math.round(power))) : null,
    t: Math.max(0, num('t', 0)),
    seed: Number.isFinite(seed) ? seed : null,
    slowmo: Math.min(4, Math.max(0.05, num('slowmo', 1))),
    mission: params.get('mission') || null,
    difficulty: DIFFICULTIES.indexOf(difficulty as Difficulty) >= 0 ? (difficulty as Difficulty) : null,
    elite: ELITES.indexOf(elite as EliteId) >= 0 ? (elite as EliteId) : flag('elite') ? 'random' : null,
    unlock: flag('unlock'),
    credits: Number.isFinite(credits) ? Math.min(1e9, Math.max(0, Math.floor(credits))) : null,
    reset: flag('reset'),
    scale: Number.isFinite(scale) ? Math.min(1, Math.max(0.3, scale)) : null,
    bloom: toggle('bloom'),
    fxaa: toggle('fxaa'),
  };
}

export function readDebugFlags(): DebugFlags {
  const search = typeof window !== 'undefined' && window.location ? window.location.search : '';
  return parseDebugFlags(search);
}
