import { describe, expect, it } from 'vitest';
import {
  angleTo,
  armorScale,
  distToSegment2,
  falloffScale,
  fireInterval,
  peakDps,
  pickChain,
  rayDistance,
  shotDamage,
  turnTowards,
  weaponLevel,
  wrapAngle,
} from '../../game/assets/scripts/core/arsenal';
import { PRIMARIES, SECONDARIES } from '../../game/assets/scripts/data/weapons';

const DEG = Math.PI / 180;

describe('arsenal geometry', () => {
  it('angles follow the bullet convention: 0 = up the screen (-Z), positive = right', () => {
    expect(angleTo(0, 0, 0, -5)).toBeCloseTo(0);
    expect(angleTo(0, 0, 5, 0)).toBeCloseTo(Math.PI / 2);
    expect(angleTo(0, 0, -5, 0)).toBeCloseTo(-Math.PI / 2);
    expect(Math.abs(angleTo(0, 0, 0, 5))).toBeCloseTo(Math.PI);
  });

  it('wraps and turns by the shortest way, never past the target', () => {
    expect(wrapAngle(Math.PI * 1.5)).toBeCloseTo(-Math.PI / 2);
    expect(wrapAngle(-Math.PI * 1.5)).toBeCloseTo(Math.PI / 2);
    expect(turnTowards(0, 1, 0.25)).toBeCloseTo(0.25);
    expect(turnTowards(0, -1, 0.25)).toBeCloseTo(-0.25);
    expect(turnTowards(0, 0.1, 0.25)).toBeCloseTo(0.1);
    // From just left of straight down to just right of it: across the bottom, not the top.
    expect(turnTowards(Math.PI - 0.1, -Math.PI + 0.1, 0.05)).toBeCloseTo(Math.PI - 0.05);
  });

  it('measures distance to a segment', () => {
    expect(distToSegment2(1, -5, 0, 0, 0, -10)).toBeCloseTo(1);
    expect(distToSegment2(0, 3, 0, 0, 0, -10)).toBeCloseTo(9);
    expect(distToSegment2(2, 0, 0, 0, 0, 0)).toBeCloseTo(4);
  });

  it('rays hit circles ahead of them only', () => {
    expect(rayDistance(0, 0, 0, 0, -5, 0.5)).toBeCloseTo(5);
    expect(rayDistance(0, 0, 0, 0.4, -5, 0.5)).toBeCloseTo(5);
    expect(rayDistance(0, 0, 0, 1, -5, 0.5)).toBe(-1);
    expect(rayDistance(0, 0, 0, 0, 5, 0.5)).toBe(-1);
    expect(rayDistance(0, 0, Math.PI, 0, 5, 0.5)).toBeCloseTo(5);
    expect(rayDistance(0, 0, 45 * DEG, 3, -3, 0.2)).toBeCloseTo(Math.SQRT2 * 3);
  });

  it('falloff and armour', () => {
    expect(falloffScale(Infinity, Infinity, 0.5)).toBe(1);
    expect(falloffScale(1, 1, 0.5)).toBeCloseTo(1);
    expect(falloffScale(0.5, 1, 0.5)).toBeCloseTo(0.75);
    expect(falloffScale(0, 1, 0.5)).toBeCloseTo(0.5);
    expect(armorScale(0.25, 0)).toBeCloseTo(0.25);
    expect(armorScale(0.25, 0.6)).toBeCloseTo(0.7);
    expect(armorScale(0.25, 1)).toBeCloseTo(1);
  });

  it('chains strike the nearest in reach, then jump, never twice, never too far', () => {
    const targets = [
      { x: 0, z: -3, r: 0.5 },
      { x: 2, z: -3, r: 0.5 },
      { x: 4, z: -3, r: 0.5 },
      { x: 20, z: -3, r: 0.5 },
      { x: 0.5, z: -2, r: 0.5 },
    ];
    const out: number[] = [];
    const all = (): boolean => true;
    const radius = (i: number): number => targets[i].r;
    expect(pickChain(targets, targets.length, all, radius, 0, 0, 5, 2.5, 10, out)).toBe(4);
    expect(out.slice(0, 4)).toEqual([4, 0, 1, 2]);
    // Nothing in reach of the first strike.
    expect(pickChain(targets, targets.length, all, radius, 0, 10, 5, 2.5, 10, out)).toBe(0);
    // Filtered and capped.
    expect(pickChain(targets, targets.length, (i) => i !== 4, radius, 0, 0, 5, 2.5, 2, out)).toBe(2);
    expect(out.slice(0, 2)).toEqual([0, 1]);
    // A big target is reached by its edge.
    expect(pickChain([{ x: 0, z: -6 }], 1, all, () => 1.5, 0, 0, 5, 2.5, 1, out)).toBe(1);
  });
});

describe('arsenal numbers', () => {
  it('weapon levels scale damage and rate; out of range clamps', () => {
    expect(weaponLevel(0)).toEqual(weaponLevel(1));
    expect(weaponLevel(9)).toEqual(weaponLevel(5));
    const pulse = PRIMARIES.pulse;
    expect(shotDamage(pulse, 1, { level: 5, damage: 1.15, cooldown: 1 })).toBeCloseTo(1.6 * 1.15);
    expect(fireInterval(pulse, { level: 5, damage: 1, cooldown: 1 })).toBeCloseTo(0.09 / 1.2);
    // Executioner: Secondary cooldown −20%.
    expect(fireInterval(SECONDARIES.rail, { level: 1, damage: 1, cooldown: 0.8 })).toBeCloseTo(3 * 0.8);
    expect(fireInterval(pulse, { level: 1, damage: 1, cooldown: 1 }, 1.5)).toBeCloseTo(0.06);
  });

  it('the Pulse Cannon keeps its stage 1 numbers: ~11 DPS at Power I, ~56 at IV', () => {
    expect(peakDps(PRIMARIES.pulse, 1)).toBeCloseTo(11.11, 1);
    expect(peakDps(PRIMARIES.pulse, 4)).toBeCloseTo(55.56, 1);
  });

  it('beams add their side beams, chains their decaying links, bursts every shot', () => {
    const ion = PRIMARIES.ion;
    if (ion.kind !== 'beam') throw new Error('ion is a beam');
    const iv = ion.forms[3];
    expect(peakDps(ion, 4)).toBeCloseTo(ion.dps * iv.damage + 2 * ion.dps * (iv.side?.damage ?? 0));
    const tesla = PRIMARIES.tesla;
    if (tesla.kind !== 'chain') throw new Error('tesla is a chain');
    const links = tesla.forms[0].targets;
    let sum = 0;
    for (let i = 0; i < links; i++) sum += Math.pow(tesla.decay, i);
    expect(peakDps(tesla, 1)).toBeCloseTo((tesla.damage * tesla.forms[0].damage * sum) / tesla.interval);
    const wing = SECONDARIES.wing;
    if (wing.kind !== 'bolts' || !wing.burst) throw new Error('wing cannons fire bursts');
    expect(peakDps(wing, 1)).toBeCloseTo((wing.damage * wing.forms[0].streams.length * wing.burst.count) / wing.interval);
  });
});
