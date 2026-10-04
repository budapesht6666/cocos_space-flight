import { describe, expect, it } from 'vitest';
import { computeFraming, halfWidthAt } from '../../game/assets/scripts/core/Framing';
import { formationOffsets } from '../../game/assets/scripts/core/formations';

describe('Framing', () => {
  const spec = { width: 10, pitchDeg: 70, hFovDeg: 30, focusZ: 0 };

  it('shows exactly the configured width at the focus point', () => {
    const f = computeFraming(spec, 390 / 844);
    expect(halfWidthAt(f, 0) * 2).toBeCloseTo(10, 5);
  });

  it('places the camera above and behind the focus point', () => {
    const f = computeFraming(spec, 390 / 844);
    expect(f.camY).toBeGreaterThan(0);
    expect(f.camZ).toBeGreaterThan(0);
    expect(f.topZ).toBeLessThan(0);
    expect(f.bottomZ).toBeGreaterThan(0);
  });

  it('is wider at the top of the screen than at the bottom (perspective)', () => {
    const f = computeFraming(spec, 390 / 844);
    expect(halfWidthAt(f, f.topZ)).toBeGreaterThan(halfWidthAt(f, f.bottomZ));
  });

  it('taller screens see more of the plane, same width at focus', () => {
    const phone = computeFraming(spec, 390 / 844);
    const tablet = computeFraming(spec, 3 / 4);
    expect(phone.bottomZ - phone.topZ).toBeGreaterThan(tablet.bottomZ - tablet.topZ);
    expect(halfWidthAt(tablet, 0)).toBeCloseTo(halfWidthAt(phone, 0), 5);
  });
});

describe('formationOffsets', () => {
  it('centres a line', () => {
    const o = formationOffsets({ kind: 'line', count: 3, spacing: 2 });
    expect(o.map((p) => p.dx)).toEqual([-2, 0, 2]);
  });

  it('builds a V with the leader in front', () => {
    const o = formationOffsets({ kind: 'v', count: 5, spacing: 1 });
    expect(o[0]).toMatchObject({ dx: 0, dz: 0 });
    expect(o[1].dx).toBe(-1);
    expect(o[2].dx).toBe(1);
    expect(o[3].dz).toBeLessThan(o[1].dz);
  });

  it('single ignores count', () => {
    expect(formationOffsets({ kind: 'single', count: 9, spacing: 3 })).toHaveLength(1);
  });

  it('trail stacks everyone on the anchor (they are staggered in time)', () => {
    const o = formationOffsets({ kind: 'trail', count: 4, spacing: 0 });
    expect(o).toHaveLength(4);
    expect(o.every((p) => p.dx === 0 && p.dz === 0)).toBe(true);
    expect(o.map((p) => p.index)).toEqual([0, 1, 2, 3]);
  });
});
