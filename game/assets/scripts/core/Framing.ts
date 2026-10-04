// Camera framing for the tilted top-down view. Engine-free.
//
// The camera looks at a focus point on the gameplay plane (y = 0) from above, pitched
// `pitchDeg` below the horizon, facing -Z ("up the screen"). The horizontal FOV is fixed,
// so the playfield width at the focus depth is the same on every screen; taller screens
// simply see further up and down.

const DEG = Math.PI / 180;

export interface FramingSpec {
  /** Playfield width (world units) visible at the focus point. */
  width: number;
  /** Camera pitch below the horizon, degrees (90 = straight down). */
  pitchDeg: number;
  /** Horizontal field of view, degrees. */
  hFovDeg: number;
  /** Z of the point on the plane the camera looks at. */
  focusZ: number;
}

export interface Framing {
  /** Camera position. */
  camY: number;
  camZ: number;
  /** Distance from the camera to the focus point along the view axis. */
  distance: number;
  /** Visible Z range on the plane: top edge (smaller z) and bottom edge of the screen. */
  topZ: number;
  bottomZ: number;
  readonly spec: FramingSpec;
  readonly aspect: number;
}

/** @param aspect screen width / height */
export function computeFraming(spec: FramingSpec, aspect: number): Framing {
  const pitch = spec.pitchDeg * DEG;
  const tanHalfH = Math.tan((spec.hFovDeg * DEG) / 2);
  const distance = spec.width / (2 * tanHalfH);
  const camY = distance * Math.sin(pitch);
  const camZ = spec.focusZ + distance * Math.cos(pitch);
  const halfV = Math.atan(tanHalfH / aspect);
  const bottomAngle = pitch + halfV;
  const topAngle = pitch - halfV;
  // A ray pitched `a` below the horizon hits y = 0 at z = camZ - camY / tan(a); past 90° the
  // tangent turns negative and the hit point lands behind the camera's foot, which is correct.
  const bottomZ = camZ - camY / Math.tan(bottomAngle);
  const topZ = topAngle > 1e-3 ? camZ - camY / Math.tan(topAngle) : -Infinity;
  return { camY, camZ, distance, topZ, bottomZ, spec, aspect };
}

/** Half of the visible width of the plane at depth `z`. */
export function halfWidthAt(f: Framing, z: number): number {
  const pitch = f.spec.pitchDeg * DEG;
  const depth = f.camY * Math.sin(pitch) + (f.camZ - z) * Math.cos(pitch);
  return depth * Math.tan((f.spec.hFovDeg * DEG) / 2);
}
