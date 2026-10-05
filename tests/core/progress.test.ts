import { describe, expect, it } from 'vitest';
import { earnedMedals, hasMedal, killRate, medalCount, MEDAL_BITS, type MedalStats } from '../../game/assets/scripts/core/medals';
import { applyRun, getRecord, sanitizeRecords, type RecordMap } from '../../game/assets/scripts/core/records';
import { pickWeighted } from '../../game/assets/scripts/core/weighted';

const perfect: MedalStats = { complete: true, kills: 50, spawned: 50, pods: 3, podsTotal: 3, hullLost: 0 };

describe('medals', () => {
  it('a perfect run earns all four', () => {
    const mask = earnedMedals(perfect);
    expect(medalCount(mask)).toBe(4);
    for (const id of ['hunter', 'exterminator', 'rescuer', 'untouchable'] as const) expect(hasMedal(mask, id)).toBe(true);
  });

  it('a failed run earns nothing', () => {
    expect(earnedMedals({ ...perfect, complete: false })).toBe(0);
  });

  it('Hunter at 70%, Exterminator only at 100%', () => {
    const at70 = earnedMedals({ ...perfect, kills: 35 });
    expect(hasMedal(at70, 'hunter')).toBe(true);
    expect(hasMedal(at70, 'exterminator')).toBe(false);
    expect(hasMedal(earnedMedals({ ...perfect, kills: 34 }), 'hunter')).toBe(false);
  });

  it('Rescuer needs every pod and at least one pod in the mission; Untouchable ignores shield hits', () => {
    expect(hasMedal(earnedMedals({ ...perfect, pods: 2 }), 'rescuer')).toBe(false);
    expect(hasMedal(earnedMedals({ ...perfect, pods: 0, podsTotal: 0 }), 'rescuer')).toBe(false);
    expect(hasMedal(earnedMedals({ ...perfect, hullLost: 1 }), 'untouchable')).toBe(false);
  });

  it('kill rate is capped and safe for empty missions', () => {
    expect(killRate(5, 10)).toBe(0.5);
    expect(killRate(12, 10)).toBe(1);
    expect(killRate(0, 0)).toBe(1);
  });
});

describe('records', () => {
  it('keeps the best score, accumulates medals and counts clears', () => {
    const records: RecordMap = {};
    const first = applyRun(records, 's1m1', 'normal', { complete: true, score: 1000, medals: MEDAL_BITS.hunter, killRate: 0.8 });
    expect(first.newBest).toBe(true);
    expect(first.newMedals).toBe(MEDAL_BITS.hunter);
    expect(first.firstClear).toBe(true);
    const second = applyRun(records, 's1m1', 'normal', { complete: true, score: 800, medals: MEDAL_BITS.untouchable, killRate: 0.6 });
    expect(second.newBest).toBe(false);
    expect(second.newMedals).toBe(MEDAL_BITS.untouchable);
    expect(second.firstClear).toBe(false);
    const r = getRecord(records, 's1m1', 'normal')!;
    expect(r.score).toBe(1000);
    expect(r.medals).toBe(MEDAL_BITS.hunter | MEDAL_BITS.untouchable);
    expect(r.killRate).toBe(0.8);
    expect(r.clears).toBe(2);
    expect(getRecord(records, 's1m1', 'hard')).toBeNull();
  });

  it('a failed run can set the high score but earns no medals or clears', () => {
    const records: RecordMap = {};
    const u = applyRun(records, 's1m2', 'hard', { complete: false, score: 5000, medals: MEDAL_BITS.hunter, killRate: 1 });
    expect(u.newBest).toBe(true);
    expect(u.firstClear).toBe(false);
    expect(u.record).toEqual({ score: 5000, medals: 0, killRate: 0, clears: 0 });
  });

  it('sanitizes untrusted records', () => {
    expect(sanitizeRecords(null)).toEqual({});
    expect(sanitizeRecords('x')).toEqual({});
    const dirty = sanitizeRecords({ a: { score: -5, medals: 255, killRate: 7, clears: 'x' }, b: null, c: { score: 12.7, clears: 2.9 } });
    expect(dirty).toEqual({ a: { score: 0, medals: 15, killRate: 1, clears: 0 }, c: { score: 12, medals: 0, killRate: 0, clears: 2 } });
  });
});

describe('weighted pick', () => {
  it('follows the weights', () => {
    const items = ['a', 'b', 'c'];
    const w = (x: string): number => (x === 'a' ? 1 : x === 'b' ? 3 : 0);
    expect(pickWeighted(items, w, 0)).toBe('a');
    expect(pickWeighted(items, w, 0.24)).toBe('a');
    expect(pickWeighted(items, w, 0.26)).toBe('b');
    expect(pickWeighted(items, w, 0.999)).toBe('b');
  });
});
