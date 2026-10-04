// Tiny 5×7 bitmap letters and the round pickup badge baked from them. Engine-free, so it works the
// same in the browser and in a native build (no DOM canvas).

import type { Rgb } from '../data/types';

const FONT: Record<string, readonly string[]> = {
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
};

export function hasGlyph(letter: string): boolean {
  return FONT[letter] !== undefined;
}

/**
 * RGBA8 badge: a dark disc in `color` with a bright rim and a white letter. Colours are baked in
 * (sRGB-ish 0..1 inputs), so the material can stay white and every badge kind is its own texture.
 */
export function bakeBadge(letter: string, size: number, color: Rgb): Uint8Array {
  const rows = FONT[letter];
  if (!rows) throw new Error(`no glyph for '${letter}'`);
  const data = new Uint8Array(size * size * 4);
  const half = size / 2;
  // Letter box: 5×7 cells centred, about half the badge tall.
  const cell = Math.max(1, Math.floor((size * 0.52) / 7));
  const left = Math.floor(half - (5 * cell) / 2);
  const top = Math.floor(half - (7 * cell) / 2);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - half, y + 0.5 - half) / half;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      if (d <= 1) {
        const rim = d > 0.78;
        const k = rim ? 1 : 0.28;
        r = color[0] * k;
        g = color[1] * k;
        b = color[2] * k;
        // Soft outer edge.
        a = Math.min(1, (1 - d) * size * 0.25);
        const cx = Math.floor((x - left) / cell);
        const cy = Math.floor((y - top) / cell);
        if (cx >= 0 && cx < 5 && cy >= 0 && cy < 7 && rows[cy][cx] === '#') {
          r = g = b = 1;
          a = 1;
        }
      }
      const i = (y * size + x) * 4;
      data[i] = Math.round(r * 255);
      data[i + 1] = Math.round(g * 255);
      data[i + 2] = Math.round(b * 255);
      data[i + 3] = Math.round(a * 255);
    }
  }
  return data;
}
