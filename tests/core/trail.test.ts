import { describe, expect, it } from 'vitest';
import { Trail, type TrailSample } from '../../game/assets/scripts/core/trail';

const out: TrailSample = { x: 0, z: 0, dx: 0, dz: 0 };

describe('Trail (serpent segments)', () => {
  it('starts as a straight tail behind the head', () => {
    const t = new Trail(100, 0.1);
    t.reset(2, 3, 0, -1);
    t.sample(4, out);
    expect(out.x).toBeCloseTo(2, 5);
    expect(out.z).toBeCloseTo(-1, 5);
    // Facing towards the head (down the screen here).
    expect(out.dz).toBeCloseTo(1, 5);
  });

  it('samples by distance along the path the head swam', () => {
    const t = new Trail(400, 0.05);
    t.reset(0, 0, 0, -1);
    // Down 5 units, then right 5 units.
    for (let i = 1; i <= 100; i++) t.push(0, i * 0.05);
    for (let i = 1; i <= 100; i++) t.push(i * 0.05, 5);
    t.sample(2, out);
    expect(out.x).toBeCloseTo(3, 1);
    expect(out.z).toBeCloseTo(5, 5);
    expect(out.dx).toBeCloseTo(1, 5);
    t.sample(7, out);
    expect(out.x).toBeCloseTo(0, 5);
    expect(out.z).toBeCloseTo(3, 1);
    expect(out.dz).toBeCloseTo(1, 5);
  });

  it('keeps going straight past its oldest point', () => {
    const t = new Trail(10, 0.1);
    t.reset(0, 0, 1, 0);
    t.sample(5, out);
    expect(out.x).toBeCloseTo(5, 5);
    expect(out.z).toBeCloseTo(0, 5);
    expect(t.reach).toBeCloseTo(0.9, 5);
  });
});
