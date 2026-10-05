import { describe, expect, it } from 'vitest';
import { allMissionIncome, hangarCosts, situationDps, SITUATIONS, timeToKill, weaponRows, type Situation } from '../../game/assets/scripts/core/balance';
import { peakDps, STOCK_GUN } from '../../game/assets/scripts/core/arsenal';
import type { PrimaryId, SecondaryId, WeaponId } from '../../game/assets/scripts/data/types';
import { PRIMARIES, SECONDARIES } from '../../game/assets/scripts/data/weapons';

const primaries = Object.keys(PRIMARIES) as PrimaryId[];
const secondaries = Object.keys(SECONDARIES) as SecondaryId[];

/** Situations each weapon is the best in, and those it is a contender in (≥ 85% of the best). */
function crowns(ids: readonly WeaponId[]): { best: Map<WeaponId, Situation[]>; near: Map<WeaponId, Situation[]> } {
  const rows = weaponRows(ids);
  const best = new Map<WeaponId, Situation[]>(ids.map((id) => [id, []]));
  const near = new Map<WeaponId, Situation[]>(ids.map((id) => [id, []]));
  for (const s of SITUATIONS) {
    const top = Math.max(...rows.map((r) => r.situations[s]));
    for (const r of rows) {
      if (top > 0 && r.situations[s] >= top - 1e-9) best.get(r.id)!.push(s);
      if (top > 0 && r.situations[s] >= top * 0.85) near.get(r.id)!.push(s);
    }
  }
  return { best, near };
}

describe('balance: no weapon dominates (docs/BALANCE.md)', () => {
  it('no Primary is the best everywhere, nor in more than half the situations', () => {
    const { best } = crowns(primaries);
    for (const id of primaries) expect(best.get(id)!.length, `${id}: ${best.get(id)}`).toBeLessThanOrEqual(Math.floor(SITUATIONS.length / 2));
  });

  it('every weapon has a niche: the best, or close to it, somewhere', () => {
    for (const ids of [primaries, secondaries]) {
      const { near } = crowns(ids);
      for (const id of ids) expect(near.get(id)!.length, id).toBeGreaterThan(0);
    }
  });

  it('no Secondary is the best everywhere', () => {
    const { best } = crowns(secondaries);
    for (const id of secondaries) expect(best.get(id)!.length, id).toBeLessThan(SITUATIONS.length);
  });

  it('every Primary can fight a boss: 50–110% of the Pulse Cannon at Power IV', () => {
    const pulse = situationDps(PRIMARIES.pulse, 'focus', 4, STOCK_GUN);
    for (const id of primaries) {
      const dps = situationDps(PRIMARIES[id], 'focus', 4, STOCK_GUN);
      expect(dps / pulse, id).toBeGreaterThanOrEqual(0.5);
      expect(dps / pulse, id).toBeLessThanOrEqual(1.1);
    }
  });

  it('Power makes every weapon stronger', () => {
    for (const def of [...Object.values(PRIMARIES), ...Object.values(SECONDARIES)]) {
      for (let p = 2; p <= 4; p++) expect(peakDps(def, p), `${def.id} P${p}`).toBeGreaterThanOrEqual(peakDps(def, p - 1));
    }
  });

  it('Secondaries supplement the Primary: well below the Pulse Cannon on a boss', () => {
    const pulse = situationDps(PRIMARIES.pulse, 'focus', 4, STOCK_GUN);
    for (const id of secondaries) expect(situationDps(SECONDARIES[id], 'focus', 4, STOCK_GUN), id).toBeLessThan(pulse * 0.5);
  });

  it('times to kill are finite for every Primary and grow with HP', () => {
    for (const id of primaries) {
      const def = PRIMARIES[id];
      expect(timeToKill(def, 'scout', 4, STOCK_GUN), id).toBeLessThan(1);
      expect(timeToKill(def, 'marauder', 4, STOCK_GUN), id).toBeGreaterThan(timeToKill(def, 'gunship', 4, STOCK_GUN));
      expect(Number.isFinite(timeToKill(def, 'warden', 4, STOCK_GUN)), id).toBe(true);
    }
  });

  it('the Ion Laser is the armour breaker', () => {
    const ion = situationDps(PRIMARIES.ion, 'armor', 4, STOCK_GUN);
    for (const id of primaries) if (id !== 'ion') expect(ion, id).toBeGreaterThan(situationDps(PRIMARIES[id], 'armor', 4, STOCK_GUN));
  });
});

describe('balance: economy', () => {
  it('missions pay more on Hard, later missions more than earlier ones', () => {
    const rows = allMissionIncome(['normal', 'hard']);
    for (let i = 0; i < rows.length; i += 2) expect(rows[i + 1].drops, rows[i].mission).toBeGreaterThan(rows[i].drops);
    const normal = rows.filter((r) => r.difficulty === 'normal');
    for (let i = 1; i < normal.length; i++) expect(normal[i].drops).toBeGreaterThan(normal[i - 1].drops);
    // GDD §14: a Normal run of a Sector 1 mission brings ~1,200–1,700 when ~80% is collected.
    for (const r of normal) {
      expect(r.drops * 0.8 + r.clear, r.mission).toBeGreaterThan(1000);
      expect(r.drops * 0.8 + r.clear, r.mission).toBeLessThan(2000);
    }
  });

  it('the hangar costs something in every group', () => {
    const costs = hangarCosts();
    for (const group of ['systems', 'primary', 'secondary', 'drone', 'special']) expect(costs[group], group).toBeGreaterThan(0);
  });
});
