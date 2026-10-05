// The player's progress in local storage: wallet, hangar, ship and paints, records. Parsing,
// migrations and rules live in core/ (save, economy, loadout, progress); this is the storage and
// the one copy of the save every scene shares.

import { sys } from 'cc';
import { buyUpgrade, grantCredits, runRewards, setWallet, type BuyResult, type RunRewards } from '../core/economy';
import { buildLoadout } from '../core/loadout';
import { shipUnlocked } from '../core/progress';
import { applyRun, getRecord, type MissionRecord, type RecordMap, type RecordUpdate, type RunOutcome } from '../core/records';
import { loadSave, newSave, serializeSave, type SaveData } from '../core/save';
import { DIFFICULTIES } from '../data/difficulty';
import { DEFAULT_PAINT, DEFAULT_SHIP, SHIPS } from '../data/player';
import type { Difficulty, Loadout, PaintId, ShipId, UpgradeId } from '../data/types';

const KEY = 'spaceflight.save';
/** Stage 3 kept only records, here; migrated into the save once and removed. */
const LEGACY_KEY = 'spaceflight.records';
/** An unreadable save is kept here for a post-mortem instead of being lost silently. */
const BROKEN_KEY = 'spaceflight.save.broken';

export interface RunReport {
  update: RecordUpdate;
  rewards: RunRewards;
  /** Wallet after the rewards. */
  balance: number;
}

let data: SaveData | null = null;
/** The stored save is from a newer game version: play on, but never overwrite it. */
let readOnly = false;
let devApplied = false;

function storage(): Storage | null {
  try {
    return sys.localStorage;
  } catch (err) {
    console.warn('[SaveService] storage unavailable', err);
    return null;
  }
}

function load(): SaveData {
  if (data) return data;
  const store = storage();
  let json: string | null = null;
  let legacy: string | null = null;
  try {
    json = store ? store.getItem(KEY) : null;
    legacy = store && !json ? store.getItem(LEGACY_KEY) : null;
  } catch (err) {
    console.warn('[SaveService] could not read the save', err);
  }
  const result = loadSave(json, legacy);
  data = result.save;
  switch (result.status) {
    case 'corrupt':
      console.warn('[SaveService] save unreadable, starting over; the old one is kept under', BROKEN_KEY);
      try {
        if (store && json) store.setItem(BROKEN_KEY, json);
      } catch (err) {
        // Nothing more to do.
      }
      break;
    case 'newer':
      readOnly = true;
      console.warn('[SaveService] save is from a newer version of the game; progress will not be saved');
      break;
    case 'migrated':
      if (persist()) {
        try {
          store?.removeItem(LEGACY_KEY);
        } catch (err) {
          // The old key is ignored once the save exists.
        }
      }
      break;
    default:
      break;
  }
  return data;
}

/** Writes the save; false if it could not. */
function persist(): boolean {
  if (readOnly || !data) return false;
  try {
    const store = storage();
    if (!store) return false;
    store.setItem(KEY, serializeSave(data));
    return true;
  } catch (err) {
    console.warn('[SaveService] could not save', err);
    return false;
  }
}

export const SaveService = {
  /**
   * Developer URL flags, once per page load (the menu scene loads again after every mission):
   * `?reset=1` wipes the progress, `?credits=N` sets the wallet.
   */
  applyDevFlags(reset: boolean, credits: number | null): void {
    if (devApplied) return;
    devApplied = true;
    if (!reset && credits === null) return;
    if (reset) {
      data = newSave();
      readOnly = false;
      console.warn('[SaveService] ?reset=1: progress wiped');
    }
    if (credits !== null) {
      setWallet(load(), credits);
      console.warn(`[SaveService] ?credits=${credits}: wallet set`);
    }
    persist();
  },

  get data(): Readonly<SaveData> {
    return load();
  },

  get records(): RecordMap {
    return load().records;
  },

  get credits(): number {
    return load().credits;
  },

  record(mission: string, difficulty: string): MissionRecord | null {
    return getRecord(load().records, mission, difficulty);
  },

  setLast(mission: string, difficulty: string): void {
    load().last = { mission, difficulty };
    persist();
  },

  /** Folds a finished run in: records, credits kept from the run, clear and first-medal bonuses. */
  submitRun(mission: string, difficulty: Difficulty, run: RunOutcome, collected: number): RunReport {
    const save = load();
    const update = applyRun(save.records, mission, difficulty, run);
    const rewards = runRewards(run.complete, collected, update.newMedals, DIFFICULTIES[difficulty].credits);
    grantCredits(save, rewards.total);
    persist();
    return { update, rewards, balance: save.credits };
  },

  buy(id: UpgradeId): BuyResult {
    const result = buyUpgrade(load(), id);
    if (result === 'bought') persist();
    return result;
  },

  /** The ship to fly: the chosen one if it's open (or `unlockAll`, a debug flag), else the starter. */
  shipToFly(unlockAll: boolean): ShipId {
    const save = load();
    return unlockAll || shipUnlocked(save.records, SHIPS[save.ship]) ? save.ship : DEFAULT_SHIP;
  },

  selectShip(ship: ShipId): void {
    const save = load();
    if (save.ship === ship) return;
    save.ship = ship;
    persist();
  },

  paintOf(ship: ShipId): PaintId {
    return load().paints[ship] ?? DEFAULT_PAINT;
  },

  setPaint(ship: ShipId, paint: PaintId): void {
    const save = load();
    if (save.paints[ship] === paint) return;
    save.paints[ship] = paint;
    persist();
  },

  loadout(ship: ShipId): Loadout {
    return buildLoadout(load(), SHIPS[ship]);
  },
};
