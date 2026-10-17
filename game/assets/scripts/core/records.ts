// Best results per mission and difficulty. Engine-free: they live in the save (core/save.ts).

export interface MissionRecord {
  /** Best score of any run, finished or not (arcade rules). */
  score: number;
  /** Medals ever earned here (bit mask, see core/medals.ts). */
  medals: number;
  /** Best kill rate of a completed run, 0..1. */
  killRate: number;
  /** Completed runs. */
  clears: number;
}

/** Records by `recordKey(mission, difficulty)`. */
export interface RecordMap {
  [key: string]: MissionRecord;
}

/**
 * Upper bounds for stored numbers. Nothing a player can earn comes near them; they keep a
 * hand-edited save from breaking the number layout or overflowing into Infinity (which JSON
 * turns into null). This is robustness, not anti-cheat: the save is the player's own file.
 */
export const RECORD_LIMITS = { score: 999999999, clears: 99999 };

export interface RunOutcome {
  complete: boolean;
  score: number;
  medals: number;
  killRate: number;
}

export interface RecordUpdate {
  record: MissionRecord;
  /** The score beat the previous best (and there was something to beat or the run counted). */
  newBest: boolean;
  /** Medals earned for the first time (bit mask). */
  newMedals: number;
  /** First completion on this mission and difficulty. */
  firstClear: boolean;
}

export function recordKey(mission: string, difficulty: string): string {
  return `${mission}:${difficulty}`;
}

export function getRecord(records: RecordMap, mission: string, difficulty: string): MissionRecord | null {
  return records[recordKey(mission, difficulty)] ?? null;
}

/** Folds a run into the records (mutates them) and reports what improved. */
export function applyRun(records: RecordMap, mission: string, difficulty: string, run: RunOutcome): RecordUpdate {
  const key = recordKey(mission, difficulty);
  const prev = records[key];
  const record: MissionRecord = prev ? Object.assign({}, prev) : { score: 0, medals: 0, killRate: 0, clears: 0 };
  const score = Math.min(run.score, RECORD_LIMITS.score);
  const newBest = score > record.score;
  if (newBest) record.score = score;
  let newMedals = 0;
  const firstClear = run.complete && record.clears === 0;
  if (run.complete) {
    newMedals = run.medals & ~record.medals & 15;
    record.medals |= run.medals & 15;
    record.killRate = Math.min(1, Math.max(record.killRate, run.killRate));
    record.clears = Math.min(record.clears + 1, RECORD_LIMITS.clears);
  }
  records[key] = record;
  return { record, newBest: newBest && score > 0, newMedals, firstClear };
}

/**
 * Rebuilds records from untrusted JSON: bad numbers become 0 or the limit, medals keep their four
 * bits. `validKey` (the save passes "a real mission on a real difficulty") drops everything else;
 * a `__proto__` key is always dropped: assigned to a plain object it would swap the map's prototype.
 */
export function sanitizeRecords(raw: unknown, validKey?: (key: string) => boolean): RecordMap {
  const out: RecordMap = {};
  if (!raw || typeof raw !== 'object') return out;
  const src = raw as { [key: string]: unknown };
  for (const key of Object.keys(src)) {
    if (key === '__proto__' || (validKey && !validKey(key))) continue;
    const r = src[key] as Partial<MissionRecord> | null | undefined;
    if (!r || typeof r !== 'object') continue;
    out[key] = {
      score: Math.min(int(r.score), RECORD_LIMITS.score),
      medals: int(r.medals) & 15,
      killRate: Math.min(1, num(r.killRate)),
      clears: Math.min(int(r.clears), RECORD_LIMITS.clears),
    };
  }
  return out;
}

/** Finite and positive, else 0. */
export function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
}

/** Whole, finite and positive, else 0. */
export function int(v: unknown): number {
  return Math.floor(num(v));
}
