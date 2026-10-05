// Small numeric helpers shared by gameplay code. Engine-free.

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Frame-rate independent exponential smoothing towards `target`.
 * `sharpness` is roughly "how many times per second the gap shrinks by e".
 */
export function damp(current: number, target: number, sharpness: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-sharpness * dt));
}

/** Like `damp`, for angles in degrees: always turns the short way round. */
export function dampAngle(current: number, target: number, sharpness: number, dt: number): number {
  const delta = wrap(target - current, -180, 180);
  return current + delta * (1 - Math.exp(-sharpness * dt));
}

/** Moves `current` towards `target` by at most `maxDelta`. */
export function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
}

/** 0..1 → 0..1 with a gentle start and end. */
export function smoothstep(t: number): number {
  const k = clamp(t, 0, 1);
  return k * k * (3 - 2 * k);
}

export function inverseLerp(a: number, b: number, value: number): number {
  return a === b ? 0 : (value - a) / (b - a);
}

/** Wraps `value` into [min, max). */
export function wrap(value: number, min: number, max: number): number {
  const range = max - min;
  return ((((value - min) % range) + range) % range) + min;
}

export function circlesOverlap(ax: number, az: number, ar: number, bx: number, bz: number, br: number): boolean {
  const dx = ax - bx;
  const dz = az - bz;
  const r = ar + br;
  return dx * dx + dz * dz <= r * r;
}
