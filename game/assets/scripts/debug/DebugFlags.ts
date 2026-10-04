// URL parameters for previews and debug builds, e.g. ?debug=1&god=1&power=4&t=20&slowmo=0.25.
// Engine-free so it can be unit-tested; the caller passes `location.search`.

export interface DebugFlags {
  /** FPS / draw calls / entity counts overlay. */
  overlay: boolean;
  /** Player takes no damage. */
  god: boolean;
  /** Starting Power level 1..4. */
  power: number;
  /** Seek the wave timeline to this many seconds. */
  t: number;
  /** Fixed RNG seed, or null for a random one. */
  seed: number | null;
  /** Game speed multiplier for inspecting effects, e.g. 0.25. */
  slowmo: number;
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
  return {
    overlay: flag('debug'),
    god: flag('god'),
    power: Math.min(4, Math.max(1, Math.round(num('power', 1)))),
    t: Math.max(0, num('t', 0)),
    seed: Number.isFinite(seed) ? seed : null,
    slowmo: Math.min(4, Math.max(0.05, num('slowmo', 1))),
  };
}

export function readDebugFlags(): DebugFlags {
  const search = typeof window !== 'undefined' && window.location ? window.location.search : '';
  return parseDebugFlags(search);
}
