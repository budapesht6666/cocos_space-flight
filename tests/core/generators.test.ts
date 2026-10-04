import { describe, expect, it } from 'vitest';
import { bakeBadge } from '../../game/assets/scripts/core/glyphs';
import { buildRock } from '../../game/assets/scripts/core/rock';

describe('buildRock', () => {
  const spec = { seed: 3, roughness: 0.2, stretch: [1, 1, 1] as const };

  it('builds 80 flat-shaded faces with unit outward normals', () => {
    const g = buildRock(spec);
    expect(g.positions.length).toBe(80 * 3 * 3);
    expect(g.normals.length).toBe(g.positions.length);
    for (let f = 0; f < 80; f++) {
      const o = f * 9;
      const nx = g.normals[o];
      const ny = g.normals[o + 1];
      const nz = g.normals[o + 2];
      expect(Math.hypot(nx, ny, nz)).toBeCloseTo(1, 5);
      // Outward: the normal points the same way as the face centre.
      const cx = (g.positions[o] + g.positions[o + 3] + g.positions[o + 6]) / 3;
      const cy = (g.positions[o + 1] + g.positions[o + 4] + g.positions[o + 7]) / 3;
      const cz = (g.positions[o + 2] + g.positions[o + 5] + g.positions[o + 8]) / 3;
      expect(nx * cx + ny * cy + nz * cz).toBeGreaterThan(0);
    }
  });

  it('stays within the jitter of a unit sphere and is deterministic', () => {
    const g = buildRock(spec);
    for (let i = 0; i < g.positions.length; i += 3) {
      const r = Math.hypot(g.positions[i], g.positions[i + 1], g.positions[i + 2]);
      expect(r).toBeGreaterThanOrEqual(0.8 - 1e-6);
      expect(r).toBeLessThanOrEqual(1.2 + 1e-6);
    }
    expect(buildRock(spec).positions).toEqual(g.positions);
  });
});

describe('bakeBadge', () => {
  it('draws an opaque white letter inside a round badge with transparent corners', () => {
    const size = 64;
    const data = bakeBadge('P', size, [1, 0.5, 0.1]);
    expect(data.length).toBe(size * size * 4);
    expect(data[3]).toBe(0); // corner
    let white = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255 && data[i + 3] === 255) white++;
    expect(white).toBeGreaterThan(100);
  });

  it('rejects letters without a glyph', () => {
    expect(() => bakeBadge('Q', 32, [1, 1, 1])).toThrow();
  });
});
