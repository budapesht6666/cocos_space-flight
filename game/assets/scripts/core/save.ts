// Player progress as one versioned JSON document. Engine-free: services/SaveService.ts reads and
// writes local storage, this module parses, migrates and repairs.
//
// Versions:
//   1 — stage 3: records and the last menu pick only, under the key `spaceflight.records`.
//   2 — stage 4: credits, hangar upgrades, ship and paints next to the records (`spaceflight.save`).
// A new version adds a step to MIGRATIONS that turns the previous document into the next one.

import { UPGRADE_ORDER, UPGRADES } from '../data/economy';
import { DEFAULT_SHIP, PAINTS, SHIPS } from '../data/player';
import type { PaintId, ShipId } from '../data/types';
import { clamp } from './math';
import { int, sanitizeRecords, type RecordMap } from './records';

export const SAVE_VERSION = 2;

export interface SaveData {
  version: number;
  /** Credits in the wallet. */
  credits: number;
  /** Credits ever earned (stats). */
  earned: number;
  /** Upgrade levels bought by id (0 = base, see data/economy.ts). */
  upgrades: { [id: string]: number };
  ship: ShipId;
  /** Paint per ship; a ship without an entry wears the default paint. */
  paints: { [ship: string]: PaintId };
  records: RecordMap;
  /** Last mission and difficulty launched. */
  last: { mission: string; difficulty: string } | null;
}

/**
 * new: nothing stored. loaded: current version. migrated: converted from an older version.
 * corrupt: unreadable, started over. newer: written by a newer game version and read as far as
 * this one understands it; it must not be written back, or the newer data would be lost.
 */
export type LoadStatus = 'new' | 'loaded' | 'migrated' | 'corrupt' | 'newer';

export interface LoadResult {
  save: SaveData;
  status: LoadStatus;
}

type Raw = { [key: string]: unknown };

const MIGRATIONS: { [from: number]: (raw: Raw) => Raw } = {
  // Records and the last pick carry over; the hangar starts empty.
  1: (raw) => ({ version: 2, credits: 0, earned: 0, upgrades: {}, ship: DEFAULT_SHIP, paints: {}, records: raw.records, last: raw.last }),
};

export function newSave(): SaveData {
  return { version: SAVE_VERSION, credits: 0, earned: 0, upgrades: {}, ship: DEFAULT_SHIP, paints: {}, records: {}, last: null };
}

/**
 * Reads a save. `json` is the stored document, `legacy` the stage 3 records key, used only when
 * there is no save yet.
 */
export function loadSave(json: string | null, legacy: string | null): LoadResult {
  let raw: Raw | null;
  if (json) {
    raw = parse(json);
    if (!raw || !isVersion(raw.version)) return { save: newSave(), status: 'corrupt' };
  } else if (legacy) {
    raw = parse(legacy);
    // Unreadable old records: nothing worth keeping.
    if (!raw || raw.version !== 1) return { save: newSave(), status: 'new' };
  } else {
    return { save: newSave(), status: 'new' };
  }

  const from = raw.version as number;
  if (from > SAVE_VERSION) return { save: sanitize(raw), status: 'newer' };
  let doc = raw;
  while ((doc.version as number) < SAVE_VERSION) {
    const step = MIGRATIONS[doc.version as number];
    if (!step) return { save: newSave(), status: 'corrupt' };
    doc = step(doc);
  }
  return { save: sanitize(doc), status: from < SAVE_VERSION ? 'migrated' : 'loaded' };
}

export function serializeSave(save: SaveData): string {
  return JSON.stringify(save);
}

/** Builds a valid current-version save from a document of the right shape but untrusted values. */
function sanitize(raw: Raw): SaveData {
  const save = newSave();
  save.credits = int(raw.credits);
  save.earned = Math.max(int(raw.earned), save.credits);
  const upgrades = (raw.upgrades && typeof raw.upgrades === 'object' ? raw.upgrades : {}) as Raw;
  for (const id of UPGRADE_ORDER) {
    const level = clamp(int(upgrades[id]), 0, UPGRADES[id].costs.length);
    if (level > 0) save.upgrades[id] = level;
  }
  if (typeof raw.ship === 'string' && Object.prototype.hasOwnProperty.call(SHIPS, raw.ship)) save.ship = raw.ship as ShipId;
  const paints = (raw.paints && typeof raw.paints === 'object' ? raw.paints : {}) as Raw;
  for (const ship of Object.keys(SHIPS)) {
    const paint = paints[ship];
    if (typeof paint === 'string' && Object.prototype.hasOwnProperty.call(PAINTS, paint)) save.paints[ship] = paint as PaintId;
  }
  save.records = sanitizeRecords(raw.records);
  const last = raw.last as Raw | null | undefined;
  if (last && typeof last.mission === 'string' && typeof last.difficulty === 'string') save.last = { mission: last.mission, difficulty: last.difficulty };
  return save;
}

function parse(json: string): Raw | null {
  try {
    const raw = JSON.parse(json) as unknown;
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Raw) : null;
  } catch (err) {
    return null;
  }
}

function isVersion(v: unknown): boolean {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1;
}
