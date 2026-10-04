// Best results per mission and difficulty in local storage (core/records.ts does the logic).
// Stage 4's SaveService will take over and migrate this key.

import { sys } from 'cc';
import { applyRun, getRecord, parseBook, type MissionRecord, type RecordBook, type RecordUpdate, type RunOutcome } from '../core/records';

const KEY = 'spaceflight.records';

let book: RecordBook | null = null;

function load(): RecordBook {
  if (!book) {
    let json: string | null = null;
    try {
      json = sys.localStorage.getItem(KEY);
    } catch (err) {
      console.warn('[RecordStore] storage unavailable', err);
    }
    book = parseBook(json);
  }
  return book;
}

function save(): void {
  try {
    sys.localStorage.setItem(KEY, JSON.stringify(load()));
  } catch (err) {
    console.warn('[RecordStore] could not save', err);
  }
}

export const RecordStore = {
  get(mission: string, difficulty: string): MissionRecord | null {
    return getRecord(load(), mission, difficulty);
  },

  /** Folds a finished run in and saves. */
  submit(mission: string, difficulty: string, run: RunOutcome): RecordUpdate {
    const update = applyRun(load(), mission, difficulty, run);
    save();
    return update;
  },

  get last(): { mission: string; difficulty: string } | null {
    return load().last;
  },

  setLast(mission: string, difficulty: string): void {
    load().last = { mission, difficulty };
    save();
  },
};
