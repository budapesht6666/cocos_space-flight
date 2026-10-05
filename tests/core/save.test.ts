import { describe, expect, it } from 'vitest';
import { buyUpgrade, formatUpgradeValue, grantCredits, nextCost, runRewards, setWallet, upgradeLevel, upgradeValue } from '../../game/assets/scripts/core/economy';
import { buildLoadout } from '../../game/assets/scripts/core/loadout';
import { MEDAL_BITS } from '../../game/assets/scripts/core/medals';
import {
  continueTarget,
  difficultyUnlocked,
  isCleared,
  missionUnlocked,
  sectorMedals,
  sectorState,
  shipUnlocked,
} from '../../game/assets/scripts/core/progress';
import { applyRun, type RecordMap } from '../../game/assets/scripts/core/records';
import { loadSave, newSave, SAVE_VERSION, serializeSave } from '../../game/assets/scripts/core/save';
import { SECTORS } from '../../game/assets/scripts/data/campaign';
import { REWARDS, UPGRADES } from '../../game/assets/scripts/data/economy';
import { ENERGY, SHIPS } from '../../game/assets/scripts/data/player';
import type { Difficulty, MissionId } from '../../game/assets/scripts/data/types';

const ALL = 15;

function clear(records: RecordMap, mission: MissionId, difficulty: Difficulty, medals = 0): void {
  applyRun(records, mission, difficulty, { complete: true, score: 1000, medals, killRate: 1 });
}

describe('save', () => {
  it('starts fresh with nothing stored', () => {
    const r = loadSave(null, null);
    expect(r.status).toBe('new');
    expect(r.save).toEqual(newSave());
    expect(r.save.version).toBe(SAVE_VERSION);
  });

  it('round-trips through JSON', () => {
    const save = newSave();
    save.credits = 1234;
    save.earned = 5000;
    save.upgrades.hull = 2;
    save.ship = 'striker';
    save.paints.striker = 'green';
    clear(save.records, 's1m1', 'normal', MEDAL_BITS.hunter);
    save.last = { mission: 's1m1', difficulty: 'normal' };
    const r = loadSave(serializeSave(save), null);
    expect(r.status).toBe('loaded');
    expect(r.save).toEqual(save);
  });

  it('migrates stage 3 records (v1) and keeps them', () => {
    const v1 = {
      version: 1,
      records: { 's1m2:hard': { score: 9000, medals: 5, killRate: 0.9, clears: 3 } },
      last: { mission: 's1m2', difficulty: 'hard' },
    };
    const r = loadSave(null, JSON.stringify(v1));
    expect(r.status).toBe('migrated');
    expect(r.save.version).toBe(SAVE_VERSION);
    expect(r.save.records).toEqual(v1.records);
    expect(r.save.last).toEqual(v1.last);
    expect(r.save.credits).toBe(0);
    expect(r.save.ship).toBe('spitfire');
  });

  it('ignores the old key once a save exists, and unreadable old records', () => {
    const save = newSave();
    save.credits = 7;
    expect(loadSave(serializeSave(save), JSON.stringify({ version: 1, records: { x: { score: 1 } } })).save.credits).toBe(7);
    expect(loadSave(null, '{broken').status).toBe('new');
    expect(loadSave(null, JSON.stringify({ version: 9 })).status).toBe('new');
  });

  it('reports broken documents as corrupt and starts over', () => {
    for (const bad of ['{nope', '[]', '"text"', '42', JSON.stringify({ credits: 5 }), JSON.stringify({ version: 0 }), JSON.stringify({ version: 1.5 })]) {
      const r = loadSave(bad, null);
      expect(r.status, bad).toBe('corrupt');
      expect(r.save).toEqual(newSave());
    }
  });

  it('reads a newer save as far as it can and flags it', () => {
    const doc = { version: SAVE_VERSION + 1, credits: 300, upgrades: { hull: 1, laser: 4 }, ship: 'zenith', futureField: true };
    const r = loadSave(JSON.stringify(doc), null);
    expect(r.status).toBe('newer');
    expect(r.save.credits).toBe(300);
    expect(r.save.upgrades).toEqual({ hull: 1 });
    expect(r.save.ship).toBe('spitfire');
  });

  it('repairs bad values', () => {
    const doc = {
      version: SAVE_VERSION,
      credits: -50,
      earned: 'lots',
      upgrades: { hull: 99, shield: -1, magnet: 2.6, nonsense: 3 },
      ship: 42,
      paints: { spitfire: 'red', striker: 'blue', zenith: 'green' },
      records: { 's1m1:normal': { score: 10, medals: 99, killRate: 2, clears: 1 } },
      last: { mission: 7 },
    };
    const s = loadSave(JSON.stringify(doc), null).save;
    expect(s.credits).toBe(0);
    expect(s.earned).toBe(0);
    expect(s.upgrades).toEqual({ hull: UPGRADES.hull.costs.length, magnet: 2 });
    expect(s.ship).toBe('spitfire');
    expect(s.paints).toEqual({ striker: 'blue' });
    expect(s.records['s1m1:normal']).toEqual({ score: 10, medals: 3, killRate: 1, clears: 1 });
    expect(s.last).toBeNull();
  });
});

describe('economy', () => {
  it('buys levels in order until maxed, only when affordable', () => {
    const save = newSave();
    const costs = UPGRADES.hull.costs;
    expect(upgradeLevel(save, 'hull')).toBe(0);
    expect(upgradeValue(save, 'hull')).toBe(3);
    expect(buyUpgrade(save, 'hull')).toBe('poor');
    save.credits = costs.reduce((a, b) => a + b, 0) + 10;
    for (let i = 0; i < costs.length; i++) {
      expect(nextCost(save, 'hull')).toBe(costs[i]);
      expect(buyUpgrade(save, 'hull')).toBe('bought');
    }
    expect(upgradeValue(save, 'hull')).toBe(8);
    expect(nextCost(save, 'hull')).toBeNull();
    expect(buyUpgrade(save, 'hull')).toBe('max');
    expect(save.credits).toBe(10);
  });

  it('rewards: credits kept on defeat, bonuses for clears and first medals scale with difficulty', () => {
    expect(runRewards(false, 420.7, MEDAL_BITS.hunter, 1)).toEqual({ collected: 420, clear: 0, medals: REWARDS.firstMedal, total: 420 + REWARDS.firstMedal });
    const hard = runRewards(true, 1000, MEDAL_BITS.hunter | MEDAL_BITS.rescuer, 2);
    expect(hard.clear).toBe(REWARDS.clear * 2);
    expect(hard.medals).toBe(REWARDS.firstMedal * 2 * 2);
    expect(hard.total).toBe(1000 + hard.clear + hard.medals);
    const save = newSave();
    grantCredits(save, hard.total);
    grantCredits(save, -5);
    expect(save.credits).toBe(hard.total);
    expect(save.earned).toBe(hard.total);
  });

  it('developer wallet sets credits and keeps the lifetime total at least as high', () => {
    const save = newSave();
    save.earned = 900;
    setWallet(save, 50000.9);
    expect(save.credits).toBe(50000);
    expect(save.earned).toBe(50000);
    setWallet(save, -10);
    expect(save.credits).toBe(0);
    expect(save.earned).toBe(50000);
  });

  it('formats values', () => {
    expect(formatUpgradeValue(UPGRADES.power, 2)).toBe('II');
    expect(formatUpgradeValue(UPGRADES.generator, 3)).toBe('LV 3');
    expect(formatUpgradeValue(UPGRADES.hull, 5)).toBe('5');
  });
});

describe('loadout', () => {
  it('a fresh Spitfire matches the stage 3 starting kit', () => {
    const l = buildLoadout(newSave(), SHIPS.spitfire);
    expect(l).toEqual({
      hull: 3,
      shield: 2,
      generator: 1,
      magnet: 1,
      specialCharges: 1,
      maxCharges: ENERGY.maxCharges,
      energyGain: 1,
      startPower: 1,
      weaponLevel: 1,
      primaryDamage: 1,
    });
  });

  it('applies upgrades and ship modifiers', () => {
    const save = newSave();
    save.upgrades = { hull: 5, shield: 4, charges: 2, energy: 2, power: 1, pulse: 4, generator: 4, magnet: 4 };
    const exe = buildLoadout(save, SHIPS.executioner);
    expect(exe.hull).toBe(10);
    expect(exe.shield).toBe(7);
    expect(exe.primaryDamage).toBeCloseTo(1.15);
    expect(exe.weaponLevel).toBe(5);
    expect(exe.startPower).toBe(2);
    const striker = buildLoadout(save, SHIPS.striker);
    expect(striker.hull).toBe(7);
    expect(striker.maxCharges).toBe(ENERGY.maxCharges + 1);
    expect(striker.specialCharges).toBe(4);
    expect(striker.energyGain).toBeCloseTo(ENERGY.gainLevels[2] * 1.3);
    // Striker on a fresh save: one hull fewer, never below one.
    expect(buildLoadout(newSave(), SHIPS.striker).hull).toBe(2);
  });
});

describe('progress', () => {
  it('a fresh campaign: first mission on Normal only, first sector only', () => {
    const r: RecordMap = {};
    expect(missionUnlocked(r, 's1m1')).toBe(true);
    expect(missionUnlocked(r, 's1m2')).toBe(false);
    expect(difficultyUnlocked(r, 's1m1', 'normal')).toBe(true);
    expect(difficultyUnlocked(r, 's1m1', 'hard')).toBe(false);
    expect(sectorState(r, SECTORS[0])).toBe('open');
    expect(sectorState(r, SECTORS[1])).toBe('soon');
    expect(shipUnlocked(r, SHIPS.spitfire)).toBe(true);
    expect(shipUnlocked(r, SHIPS.executioner)).toBe(false);
    expect(continueTarget(r, null)).toEqual({ mission: 's1m1', difficulty: 'normal' });
  });

  it('clearing a mission opens the next; a failed run does not', () => {
    const r: RecordMap = {};
    applyRun(r, 's1m1', 'normal', { complete: false, score: 500, medals: 0, killRate: 0.5 });
    expect(missionUnlocked(r, 's1m2')).toBe(false);
    clear(r, 's1m1', 'normal');
    expect(isCleared(r, 's1m1')).toBe(true);
    expect(isCleared(r, 's1m1', 'hard')).toBe(false);
    expect(missionUnlocked(r, 's1m2')).toBe(true);
    expect(missionUnlocked(r, 's1m3')).toBe(false);
  });

  it('Hard opens with all four Normal medals, earned over several runs', () => {
    const r: RecordMap = {};
    clear(r, 's1m1', 'normal', MEDAL_BITS.hunter | MEDAL_BITS.exterminator | MEDAL_BITS.rescuer);
    expect(difficultyUnlocked(r, 's1m1', 'hard')).toBe(false);
    clear(r, 's1m1', 'normal', MEDAL_BITS.untouchable);
    expect(difficultyUnlocked(r, 's1m1', 'hard')).toBe(true);
    expect(difficultyUnlocked(r, 's1m2', 'hard')).toBe(false);
    expect(difficultyUnlocked(r, 's1m1', 'insane')).toBe(false);
  });

  it('keeps open whatever stage 3 players already played', () => {
    const r: RecordMap = {};
    applyRun(r, 's1m3', 'hard', { complete: false, score: 300, medals: 0, killRate: 0 });
    expect(missionUnlocked(r, 's1m3')).toBe(true);
    expect(difficultyUnlocked(r, 's1m3', 'hard')).toBe(true);
    expect(missionUnlocked(r, 's1m2')).toBe(false);
  });

  it('counts sector medals over the campaign difficulties', () => {
    const r: RecordMap = {};
    clear(r, 's1m1', 'normal', ALL);
    clear(r, 's1m2', 'hard', MEDAL_BITS.hunter);
    clear(r, 's1m3', 'insane', ALL);
    expect(sectorMedals(r, SECTORS[0])).toEqual({ earned: 5, total: 24 });
  });

  it('continue follows the campaign', () => {
    const r: RecordMap = {};
    expect(continueTarget(r, { mission: 's1m2', difficulty: 'normal' })).toEqual({ mission: 's1m1', difficulty: 'normal' });
    expect(continueTarget(r, { mission: 'bogus', difficulty: 'normal' })).toEqual({ mission: 's1m1', difficulty: 'normal' });
    expect(continueTarget(r, { mission: 's1m1', difficulty: 'normal' })).toEqual({ mission: 's1m1', difficulty: 'normal' });
    clear(r, 's1m1', 'normal', ALL);
    expect(continueTarget(r, { mission: 's1m1', difficulty: 'normal' })).toEqual({ mission: 's1m2', difficulty: 'normal' });
    // Cleared on Hard, but Hard is not open on the next mission: Normal there.
    clear(r, 's1m1', 'hard');
    expect(continueTarget(r, { mission: 's1m1', difficulty: 'hard' })).toEqual({ mission: 's1m2', difficulty: 'normal' });
    // Next already cleared: replay the last one.
    clear(r, 's1m2', 'normal');
    expect(continueTarget(r, { mission: 's1m1', difficulty: 'normal' })).toEqual({ mission: 's1m1', difficulty: 'normal' });
    // The end of the built campaign.
    clear(r, 's1m3', 'normal');
    expect(continueTarget(r, { mission: 's1m3', difficulty: 'normal' })).toEqual({ mission: 's1m3', difficulty: 'normal' });
  });
});
