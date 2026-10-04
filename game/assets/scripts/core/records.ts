// Local best results per mission and difficulty, plus the last menu selection. Engine-free:
// services/RecordStore.ts reads and writes the JSON. Stage 4's SaveService will migrate this.

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

export interface RecordBook {
  version: number;
  records: { [key: string]: MissionRecord };
  /** Last mission and difficulty picked in the menu. */
  last: { mission: string; difficulty: string } | null;
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
}

export const RECORDS_VERSION = 1;

export function recordKey(mission: string, difficulty: string): string {
  return `${mission}:${difficulty}`;
}

export function emptyBook(): RecordBook {
  return { version: RECORDS_VERSION, records: {}, last: null };
}

/** Parses stored JSON; anything broken or from an unknown version yields an empty book. */
export function parseBook(json: string | null): RecordBook {
  if (!json) return emptyBook();
  try {
    const raw = JSON.parse(json) as Partial<RecordBook> | null;
    if (!raw || raw.version !== RECORDS_VERSION || typeof raw.records !== 'object' || raw.records === null) return emptyBook();
    const book = emptyBook();
    for (const key of Object.keys(raw.records)) {
      const r = raw.records[key] as Partial<MissionRecord> | undefined;
      if (!r) continue;
      book.records[key] = {
        score: num(r.score),
        medals: num(r.medals) & 15,
        killRate: Math.min(1, num(r.killRate)),
        clears: num(r.clears),
      };
    }
    const last = raw.last;
    if (last && typeof last.mission === 'string' && typeof last.difficulty === 'string') book.last = { mission: last.mission, difficulty: last.difficulty };
    return book;
  } catch (err) {
    return emptyBook();
  }
}

export function getRecord(book: RecordBook, mission: string, difficulty: string): MissionRecord | null {
  return book.records[recordKey(mission, difficulty)] ?? null;
}

/** Folds a run into the book (mutates it) and reports what improved. */
export function applyRun(book: RecordBook, mission: string, difficulty: string, run: RunOutcome): RecordUpdate {
  const key = recordKey(mission, difficulty);
  const prev = book.records[key];
  const record: MissionRecord = prev ? Object.assign({}, prev) : { score: 0, medals: 0, killRate: 0, clears: 0 };
  const newBest = run.score > record.score;
  if (newBest) record.score = run.score;
  let newMedals = 0;
  if (run.complete) {
    newMedals = run.medals & ~record.medals & 15;
    record.medals |= run.medals & 15;
    record.killRate = Math.max(record.killRate, run.killRate);
    record.clears++;
  }
  book.records[key] = record;
  return { record, newBest: newBest && run.score > 0, newMedals };
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
}
