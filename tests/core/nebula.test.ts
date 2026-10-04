import { describe, expect, it } from 'vitest';
import { bakeNebula, type NebulaSpec } from '../../game/assets/scripts/core/nebula';

const spec: NebulaSpec = {
  width: 64,
  height: 128,
  cellsX: 2,
  cellsY: 4,
  base: [0.006, 0.008, 0.03],
  colorA: [0.05, 0.12, 0.42],
  colorB: [0.36, 0.08, 0.5],
  colorC: [0.02, 0.45, 0.55],
  intensity: 0.18,
  seed: 11,
};

const lum = (d: Uint8Array, w: number, x: number, y: number): number => {
  const i = (y * w + x) * 4;
  return d[i] + d[i + 1] + d[i + 2];
};

describe('bakeNebula', () => {
  it('produces an opaque RGBA buffer of the requested size and a positive scale', () => {
    const n = bakeNebula(spec);
    expect(n.data.length).toBe(64 * 128 * 4);
    expect(n.data[3]).toBe(255);
    expect(n.scale).toBeGreaterThan(0);
  });

  it('is deterministic for a seed', () => {
    expect(bakeNebula(spec).data).toEqual(bakeNebula(spec).data);
  });

  it('tiles seamlessly: the wrap-around seam is no harsher than ordinary neighbours', () => {
    const { data, width: w, height: h } = bakeNebula(spec);
    let seamX = 0;
    let inner = 0;
    for (let y = 0; y < h; y++) {
      seamX += Math.abs(lum(data, w, w - 1, y) - lum(data, w, 0, y));
      inner += Math.abs(lum(data, w, w / 2 - 1, y) - lum(data, w, w / 2, y));
    }
    let seamY = 0;
    for (let x = 0; x < w; x++) seamY += Math.abs(lum(data, w, x, h - 1) - lum(data, w, x, 0));
    expect(seamX / h).toBeLessThan((inner / h) * 3 + 6);
    expect(seamY / w).toBeLessThan((inner / h) * 3 + 6);
  });
});
