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
  const newBest = run.score > record.score;
  if (newBest) record.score = run.score;
  let newMedals = 0;
  const firstClear = run.complete && record.clears === 0;
  if (run.complete) {
    newMedals = run.medals & ~record.medals & 15;
    record.medals |= run.medals & 15;
    record.killRate = Math.max(record.killRate, run.killRate);
    record.clears++;
  }
  records[key] = record;
  return { record, newBest: newBest && run.score > 0, newMedals, firstClear };
}

/** Rebuilds records from untrusted JSON: bad numbers become 0, medals keep their four bits. */
export function sanitizeRecords(raw: unknown): RecordMap {
  const out: RecordMap = {};
  if (!raw || typeof raw !== 'object') return out;
  const src = raw as { [key: string]: unknown };
  for (const key of Object.keys(src)) {
    const r = src[key] as Partial<MissionRecord> | null | undefined;
    if (!r || typeof r !== 'object') continue;
    out[key] = {
      score: int(r.score),
      medals: int(r.medals) & 15,
      killRate: Math.min(1, num(r.killRate)),
      clears: int(r.clears),
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
