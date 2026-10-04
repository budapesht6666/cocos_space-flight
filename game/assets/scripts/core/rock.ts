// Procedural low-poly asteroid: a once-subdivided icosahedron with jittered vertices, flat-shaded
// (every face has its own vertices and normal). Engine-free; RenderKit turns it into a mesh.

import { Rng } from './Rng';

export interface RockGeometry {
  positions: number[];
  normals: number[];
}

export interface RockSpec {
  seed: number;
  /** Radial jitter, fraction of the radius. */
  roughness: number;
  /** Per-axis stretch so rocks aren't round. */
  stretch: readonly [number, number, number];
}

const T = (1 + Math.sqrt(5)) / 2;
const ICO_VERTS = [
  [-1, T, 0], [1, T, 0], [-1, -T, 0], [1, -T, 0],
  [0, -1, T], [0, 1, T], [0, -1, -T], [0, 1, -T],
  [T, 0, -1], [T, 0, 1], [-T, 0, -1], [-T, 0, 1],
];
const ICO_FACES = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
];

/** Unit-radius rock (before stretch), 80 faces. */
export function buildRock(spec: RockSpec): RockGeometry {
  const rng = new Rng(spec.seed);
  const verts: number[][] = ICO_VERTS.map((v) => normalize(v));
  const midpoints = new Map<string, number>();
  const midpoint = (a: number, b: number): number => {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    let index = midpoints.get(key);
    if (index === undefined) {
      const va = verts[a];
      const vb = verts[b];
      index = verts.push(normalize([(va[0] + vb[0]) / 2, (va[1] + vb[1]) / 2, (va[2] + vb[2]) / 2])) - 1;
      midpoints.set(key, index);
    }
    return index;
  };
  const faces: number[][] = [];
  for (const [a, b, c] of ICO_FACES) {
    const ab = midpoint(a, b);
    const bc = midpoint(b, c);
    const ca = midpoint(c, a);
    faces.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
  }

  // Jitter each shared vertex once so faces stay connected (no cracks).
  const shaped = verts.map((v) => {
    const r = 1 + (rng.next() - 0.5) * 2 * spec.roughness;
    return [v[0] * r * spec.stretch[0], v[1] * r * spec.stretch[1], v[2] * r * spec.stretch[2]];
  });

  const positions: number[] = [];
  const normals: number[] = [];
  for (const face of faces) {
    let [a, b, c] = face.map((i) => shaped[i]);
    let n = cross(sub(b, a), sub(c, a));
    const centroid = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    if (dot(n, centroid) < 0) {
      // Wind counter-clockwise as seen from outside, so the normal points out.
      [b, c] = [c, b];
      n = [-n[0], -n[1], -n[2]];
    }
    n = normalize(n);
    for (const p of [a, b, c]) {
      positions.push(p[0], p[1], p[2]);
      normals.push(n[0], n[1], n[2]);
    }
  }
  return { positions, normals };
}

function normalize(v: number[]): number[] {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function sub(a: number[], b: number[]): number[] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: number[], b: number[]): number[] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a: number[], b: number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
