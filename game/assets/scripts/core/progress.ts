// What the campaign has opened up (GDD §11, §13, §6), derived from the records alone, so there is
// no separate unlock state to migrate. Engine-free.
//
// - A sector opens when the previous sector's boss mission is cleared and enough of its medals
//   are earned. Sectors without missions are not built yet ("soon").
// - A mission opens when the previous mission of its sector is cleared on any difficulty.
// - A difficulty opens when all four medals are earned on the previous one.
// - A ship opens when its sector's boss is beaten.
// Anything already played (stage 3 had everything open) stays open.

import { CAMPAIGN_DIFFICULTIES, SECTORS } from '../data/campaign';
import { DIFFICULTY_ORDER } from '../data/difficulty';
import { MISSION_ORDER, nextMission } from '../data/missions';
import type { Difficulty, MissionId, PlayerShipDef, SectorDef } from '../data/types';
import { medalCount } from './medals';
import { getRecord, type RecordMap } from './records';

export type SectorState = 'open' | 'locked' | 'soon';

export interface MissionPick {
  mission: MissionId;
  difficulty: Difficulty;
}

/** Completed on `difficulty`, or on any difficulty when it is omitted. */
export function isCleared(records: RecordMap, mission: MissionId, difficulty?: Difficulty): boolean {
  if (difficulty) return (getRecord(records, mission, difficulty)?.clears ?? 0) > 0;
  for (const d of DIFFICULTY_ORDER) if ((getRecord(records, mission, d)?.clears ?? 0) > 0) return true;
  return false;
}

/** Played at all on `difficulty` (any score), or on any difficulty. */
function isPlayed(records: RecordMap, mission: MissionId, difficulty?: Difficulty): boolean {
  const list = difficulty ? [difficulty] : DIFFICULTY_ORDER;
  for (const d of list) {
    const r = getRecord(records, mission, d);
    if (r && (r.score > 0 || r.clears > 0)) return true;
  }
  return false;
}

export function sectorOf(mission: MissionId): SectorDef | null {
  for (const s of SECTORS) if (s.missions.indexOf(mission) >= 0) return s;
  return null;
}

/** Medals earned in a sector over the campaign difficulties, and how many there are. */
export function sectorMedals(records: RecordMap, sector: SectorDef): { earned: number; total: number } {
  let earned = 0;
  for (const m of sector.missions) for (const d of CAMPAIGN_DIFFICULTIES) earned += medalCount(getRecord(records, m, d)?.medals ?? 0);
  return { earned, total: sector.missions.length * CAMPAIGN_DIFFICULTIES.length * 4 };
}

/** The sector's boss beaten (its last mission cleared). */
export function bossBeaten(records: RecordMap, sector: SectorDef): boolean {
  return sector.missions.length > 0 && isCleared(records, sector.missions[sector.missions.length - 1]);
}

export function sectorState(records: RecordMap, sector: SectorDef): SectorState {
  if (sector.missions.length === 0) return 'soon';
  const i = SECTORS.indexOf(sector);
  if (i <= 0) return 'open';
  const prev = SECTORS[i - 1];
  if (bossBeaten(records, prev) && sectorMedals(records, prev).earned >= prev.medalsToAdvance) return 'open';
  for (const m of sector.missions) if (isPlayed(records, m)) return 'open';
  return 'locked';
}

export function missionUnlocked(records: RecordMap, mission: MissionId): boolean {
  const sector = sectorOf(mission);
  if (!sector || sectorState(records, sector) !== 'open') return false;
  const i = sector.missions.indexOf(mission);
  return i === 0 || isCleared(records, sector.missions[i - 1]) || isPlayed(records, mission);
}

export function difficultyUnlocked(records: RecordMap, mission: MissionId, difficulty: Difficulty): boolean {
  const i = DIFFICULTY_ORDER.indexOf(difficulty);
  if (i <= 0) return true;
  const prev = getRecord(records, mission, DIFFICULTY_ORDER[i - 1]);
  return (prev !== null && prev.medals === 15) || isPlayed(records, mission, difficulty);
}

export function shipUnlocked(records: RecordMap, ship: PlayerShipDef): boolean {
  if (!ship.unlock) return true;
  const sector = SECTORS[ship.unlock.sector - 1];
  return sector !== undefined && bossBeaten(records, sector);
}

function isMission(id: string): id is MissionId {
  return MISSION_ORDER.indexOf(id as MissionId) >= 0;
}

function isDifficulty(id: string): id is Difficulty {
  return DIFFICULTY_ORDER.indexOf(id as Difficulty) >= 0;
}

/**
 * Where CONTINUE goes: the last mission launched, or the next one when the last is already
 * cleared on that difficulty and the next is open and not (on the same difficulty if that is
 * open there, else on the first). A fresh save starts the campaign.
 */
export function continueTarget(records: RecordMap, last: { mission: string; difficulty: string } | null): MissionPick {
  if (!last || !isMission(last.mission) || !isDifficulty(last.difficulty) || !missionUnlocked(records, last.mission)) {
    return { mission: MISSION_ORDER[0], difficulty: CAMPAIGN_DIFFICULTIES[0] };
  }
  const pick: MissionPick = { mission: last.mission, difficulty: last.difficulty };
  if (isCleared(records, pick.mission, pick.difficulty)) {
    const next = nextMission(pick.mission);
    if (next && missionUnlocked(records, next)) {
      const difficulty = difficultyUnlocked(records, next, pick.difficulty) ? pick.difficulty : CAMPAIGN_DIFFICULTIES[0];
      if (!isCleared(records, next, difficulty)) return { mission: next, difficulty };
    }
  }
  return pick;
}
