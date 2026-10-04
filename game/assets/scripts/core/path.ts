// Uniform Catmull-Rom curve through world-space points stored as packed (x, z) pairs. Engine-free.
// The curve passes through every point; the ends get mirrored ghost points so it starts and ends
// heading along the first and last segments.

export interface CurveSample {
  x: number;
  z: number;
  /** Derivative with respect to the curve parameter. */
  dx: number;
  dz: number;
}

/**
 * Samples the curve at parameter `u` in [0, count - 1] (segment i spans u = i..i+1).
 * `points` holds `count` (x, z) pairs; `count` must be at least 2.
 */
export function sampleCurve(points: ArrayLike<number>, count: number, u: number, out: CurveSample): CurveSample {
  const last = count - 1;
  const clamped = u < 0 ? 0 : u > last ? last : u;
  let i = Math.floor(clamped);
  if (i >= last) i = last - 1;
  const t = clamped - i;

  const p1x = points[i * 2];
  const p1z = points[i * 2 + 1];
  const p2x = points[(i + 1) * 2];
  const p2z = points[(i + 1) * 2 + 1];
  const p0x = i > 0 ? points[(i - 1) * 2] : 2 * p1x - p2x;
  const p0z = i > 0 ? points[(i - 1) * 2 + 1] : 2 * p1z - p2z;
  const p3x = i + 2 <= last ? points[(i + 2) * 2] : 2 * p2x - p1x;
  const p3z = i + 2 <= last ? points[(i + 2) * 2 + 1] : 2 * p2z - p1z;

  const t2 = t * t;
  const t3 = t2 * t;
  out.x = 0.5 * (2 * p1x + (-p0x + p2x) * t + (2 * p0x - 5 * p1x + 4 * p2x - p3x) * t2 + (-p0x + 3 * p1x - 3 * p2x + p3x) * t3);
  out.z = 0.5 * (2 * p1z + (-p0z + p2z) * t + (2 * p0z - 5 * p1z + 4 * p2z - p3z) * t2 + (-p0z + 3 * p1z - 3 * p2z + p3z) * t3);
  out.dx = 0.5 * (-p0x + p2x + 2 * (2 * p0x - 5 * p1x + 4 * p2x - p3x) * t + 3 * (-p0x + 3 * p1x - 3 * p2x + p3x) * t2);
  out.dz = 0.5 * (-p0z + p2z + 2 * (2 * p0z - 5 * p1z + 4 * p2z - p3z) * t + 3 * (-p0z + 3 * p1z - 3 * p2z + p3z) * t2);
  return out;
}
