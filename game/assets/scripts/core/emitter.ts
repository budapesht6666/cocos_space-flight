// Bullet emitters driven by EmitterSpec data (aimed, spread, ring, spiral, burst). Engine-free.
// Angles are radians from straight up the screen (-Z), positive to the right; straight down = π.

import type { EmitterSpec } from '../data/types';

const DEG = Math.PI / 180;

export interface EmitterState {
  /** Seconds until the next volley. */
  timer: number;
  /** Volleys left in the current burst (0 = waiting for the next burst). */
  volleysLeft: number;
  /** Index of the next volley within its burst. */
  volley: number;
  /** Accumulated rotation, degrees (spirals). */
  spin: number;
}

/** Difficulty scaling applied at fire time. */
export interface EmitterTuning {
  speedScale: number;
  rateScale: number;
  density: number;
}

/** Receives each bullet; implemented by the enemy system (no closures in the hot path). */
export interface ShotSink {
  shot(spec: EmitterSpec, angle: number, speed: number): void;
}

export function createEmitterState(): EmitterState {
  return { timer: 0, volleysLeft: 0, volley: 0, spin: 0 };
}

export function resetEmitter(state: EmitterState, spec: EmitterSpec): void {
  state.timer = spec.delay;
  state.volleysLeft = 0;
  state.volley = 0;
  state.spin = 0;
}

/** Angle from (fromX, fromZ) towards (toX, toZ) in the emitter convention. */
export function aimAngle(fromX: number, fromZ: number, toX: number, toZ: number): number {
  return Math.atan2(toX - fromX, -(toZ - fromZ));
}

/** Advances the emitter; calls `sink.shot` for every bullet due this step. */
export function stepEmitter(spec: EmitterSpec, state: EmitterState, dt: number, aim: number, tuning: EmitterTuning, sink: ShotSink): void {
  state.timer -= dt;
  while (state.timer <= 0) {
    if (state.volleysLeft <= 0) {
      state.volleysLeft = Math.max(1, spec.volleys);
      state.volley = 0;
    }
    fireVolley(spec, state, aim, tuning, sink);
    state.volleysLeft--;
    state.volley++;
    state.spin += spec.spinDeg;
    const gap = state.volleysLeft > 0 ? spec.volleyInterval : spec.cooldown;
    state.timer += Math.max(0.02, gap / tuning.rateScale);
  }
}

/** Bullets per volley after difficulty density. */
export function volleyCount(spec: EmitterSpec, density: number): number {
  return Math.max(1, spec.count + spec.densityStep * density);
}

function fireVolley(spec: EmitterSpec, state: EmitterState, aim: number, tuning: EmitterTuning, sink: ShotSink): void {
  const n = volleyCount(spec, tuning.density);
  const base = (spec.aim ? aim : Math.PI + spec.angleDeg * DEG) + state.spin * DEG;
  const speed = (spec.speed + spec.speedStep * state.volley) * tuning.speedScale;
  const step = spec.ring ? (Math.PI * 2) / n : spec.gapDeg * DEG;
  const first = spec.ring ? 0 : -((n - 1) / 2) * step;
  for (let i = 0; i < n; i++) sink.shot(spec, base + first + i * step, speed);
}
