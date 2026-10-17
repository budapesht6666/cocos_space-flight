// URL parameters for previews and debug builds, e.g. ?debug=1&god=1&power=4&t=20&slowmo=0.25.
// Engine-free so it can be unit-tested; the caller passes `location.search`.

import type { LoadoutOverride } from '../core/loadout';
import { DEMO } from '../data/demo';
import { WALLET_CAP } from '../data/economy';
import { SHIPS } from '../data/player';
import type { Difficulty, DroneId, EliteId, PrimaryId, QualityId, SecondaryId, ShipId, SpecialId } from '../data/types';
import { QUALITY } from '../data/visuals';
import { DRONES, PRIMARIES, SECONDARIES, SPECIALS } from '../data/weapons';

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
  /** Developer wallet: set the credits to this once per page load (`?credits=50000`), or null. Dev hosts only. */
  credits: number | null;
  /** Wipe the save once per page load (`?reset=1`), before `credits`. Dev hosts only. */
  reset: boolean;
  /**
   * Graphics quality tier for the page (`?quality=high`) instead of the one in the settings, or null.
   * `?scale=0.5` (0.3..1) and `?msaa=1` override that knob of the tier.
   */
  quality: QualityId | null;
  scale: number | null;
  msaa: boolean | null;
  /** Post effects forced on or off (`?bloom=0`, `?fxaa=1`), or null for the defaults in data. */
  bloom: boolean | null;
  fxaa: boolean | null;
  /** Try any arsenal without buying it: `?primary=ion&secondary=rail&drones=gunDrone,guardian&special=warp&level=5`. */
  loadout: LoadoutOverride;
  /** Fly this ship (`?ship=striker`), open or not, or null for the hangar's. */
  ship: ShipId | null;
  /** The playable demo (data/demo.ts): set by its page, never by the URL. */
  demo: boolean;
}

/**
 * A machine of the developer's: localhost, loopback, the home network, file://. The flags that
 * rewrite the saved progress (`credits`, `reset`) work only there — on the public site a link
 * (`/?reset=1`) must not be able to wipe or enrich somebody's save. The other flags only make
 * practice runs (no records, no credits), so they stay everywhere.
 */
export function isDevHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === '' || h === 'localhost' || h === '::1' || h.endsWith('.localhost') || h.endsWith('.local')) return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(h);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
}

export function parseDebugFlags(search: string, devHost = true): DebugFlags {
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
  const pick = <T extends string>(key: string, table: object): T | null => {
    const raw = params.get(key);
    return raw !== null && Object.prototype.hasOwnProperty.call(table, raw) ? (raw as T) : null;
  };
  const rawDrones = params.get('drones');
  const level = num('level', NaN);
  const secondary = params.get('secondary');
  const elite = (params.get('elite') ?? '').toLowerCase();
  const quality = (params.get('quality') ?? '').toLowerCase();
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
    credits: devHost && Number.isFinite(credits) ? Math.min(WALLET_CAP, Math.max(0, Math.floor(credits))) : null,
    reset: devHost && flag('reset'),
    quality: QUALITY.tiers.some((t) => t.id === quality) ? (quality as QualityId) : null,
    scale: Number.isFinite(scale) ? Math.min(1, Math.max(0.3, scale)) : null,
    msaa: toggle('msaa'),
    bloom: toggle('bloom'),
    fxaa: toggle('fxaa'),
    loadout: {
      primary: pick<PrimaryId>('primary', PRIMARIES),
      secondary: secondary === 'none' ? 'none' : pick<SecondaryId>('secondary', SECONDARIES),
      drones: rawDrones === null ? null : (rawDrones.split(',').filter((id) => Object.prototype.hasOwnProperty.call(DRONES, id)) as DroneId[]),
      special: pick<SpecialId>('special', SPECIALS),
      level: Number.isFinite(level) ? Math.round(level) : null,
    },
    ship: pick<ShipId>('ship', SHIPS),
    demo: false,
  };
}

/** The playable demo's flags: its mission and arsenal, whatever the URL of the page around it. */
export function demoFlags(): DebugFlags {
  return Object.assign(parseDebugFlags(''), {
    mission: DEMO.mission,
    difficulty: DEMO.ramp[0],
    power: DEMO.power,
    loadout: { primary: DEMO.primary, secondary: DEMO.secondary, drones: DEMO.drones.slice(), special: DEMO.special, level: DEMO.level },
    ship: DEMO.ship,
    demo: true,
  });
}

export function readDebugFlags(): DebugFlags {
  if (typeof window !== 'undefined' && (window as unknown as { SPACEFLIGHT_DEMO?: boolean }).SPACEFLIGHT_DEMO === true) return demoFlags();
  const search = typeof window !== 'undefined' && window.location ? window.location.search : '';
  const host = typeof window !== 'undefined' && window.location ? window.location.hostname : '';
  return parseDebugFlags(search, isDevHost(host));
}
