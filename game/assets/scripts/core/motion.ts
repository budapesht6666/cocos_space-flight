// Enemy movement patterns as pure functions, so they can be unit-tested. Engine-free.

import type { MoveSpec, PathPoint } from '../data/types';
import { dampAngle } from './math';
import { sampleCurve, type CurveSample } from './path';
import type { Rng } from './Rng';

const RAD = 180 / Math.PI;

/** enter → hold → dive (Dart) or exit (hover, end of a path). */
export type MovePhase = 'enter' | 'hold' | 'dive' | 'exit';

export const MAX_PATH_POINTS = 8;

export interface MotionState {
  x: number;
  z: number;
  /** Velocity for dives, drifts and path exits. */
  vx: number;
  vz: number;
  /** Seconds since spawn. */
  t: number;
  /** Spawn X, the centre line of sine and sway movement. */
  baseX: number;
  /** Slot in the formation, phase-shifts sine movement. */
  slot: number;
  /** Mirrored left-right. */
  mirror: boolean;
  phase: MovePhase;
  phaseTime: number;
  /** Facing, degrees around Y: 180 = nose down the screen (+Z). */
  yaw: number;
  /** Tumble speed for drifting rocks, degrees per second. */
  spin: number;
  /** Path points resolved to world space at spawn, packed (x, z). */
  path: Float32Array;
  pathCount: number;
  /** Curve parameter along the path. */
  pathU: number;
}

/** The parts of the playfield that normalised content coordinates need. */
export interface FieldMapper {
  /** Z at a fraction of the visible height: 0 = top edge, 1 = bottom edge. */
  zAt(fraction: number): number;
  halfWidth(z: number): number;
}

export interface MotionContext {
  /** Where the player is now. */
  targetX: number;
  targetZ: number;
  field: FieldMapper;
  /** Ground scroll speed, units per second. */
  scrollSpeed: number;
}

export function createMotionState(): MotionState {
  return {
    x: 0,
    z: 0,
    vx: 0,
    vz: 0,
    t: 0,
    baseX: 0,
    slot: 0,
    mirror: false,
    phase: 'enter',
    phaseTime: 0,
    yaw: 180,
    spin: 0,
    path: new Float32Array(MAX_PATH_POINTS * 2),
    pathCount: 0,
    pathU: 0,
  };
}

export function resetMotion(s: MotionState, x: number, z: number, slot: number, mirror = false): void {
  s.x = s.baseX = x;
  s.z = z;
  s.vx = 0;
  s.vz = 0;
  s.t = 0;
  s.slot = slot;
  s.mirror = mirror;
  s.phase = 'enter';
  s.phaseTime = 0;
  s.yaw = 180;
  s.spin = 0;
  s.pathCount = 0;
  s.pathU = 0;
}

/**
 * Kind-specific setup after `resetMotion`. Path movers are moved to the start of their path,
 * shifted by their formation offset (offsetX, offsetZ).
 */
export function initMotion(m: MoveSpec, s: MotionState, ctx: MotionContext, rng: Rng, offsetX: number, offsetZ: number): void {
  if (m.kind === 'path') {
    resolvePath(s, m.points, ctx.field, offsetX, offsetZ);
    s.x = s.baseX = s.path[0];
    s.z = s.path[1];
    const first = sampleCurve(s.path, s.pathCount, 0, sample);
    s.yaw = Math.atan2(-first.dx, -first.dz) * RAD;
  } else if (m.kind === 'drift') {
    s.vx = rng.range(-m.spreadX, m.spreadX);
    s.vz = m.speed;
    s.spin = rng.sign() * m.spin * rng.range(0.6, 1);
    s.yaw = rng.range(0, 360);
  }
}

/** Advances the movement by `dt`. Returns the sideways speed this step (for banking). */
export function stepMotion(m: MoveSpec, s: MotionState, ctx: MotionContext, dt: number): number {
  const prevX = s.x;
  s.t += dt;
  s.phaseTime += dt;
  switch (m.kind) {
    case 'straight':
      s.z += m.speed * dt;
      break;
    case 'sine': {
      const side = s.mirror ? -1 : 1;
      s.z += m.speed * dt;
      s.x = s.baseX + side * m.amplitude * Math.sin(Math.PI * 2 * m.frequency * s.t + s.slot * 0.9);
      break;
    }
    case 'dive':
      stepDive(m.enterSpeed, m.holdTime, ctx.field.zAt(m.holdDepth), m.diveSpeed, s, ctx, dt);
      break;
    case 'path':
      stepPath(m.speed, s, dt);
      break;
    case 'hover':
      stepHover(m, s, ctx, dt);
      break;
    case 'drift':
      s.x += s.vx * dt;
      s.z += s.vz * dt;
      s.yaw += s.spin * dt;
      break;
    case 'ground':
      s.z += ctx.scrollSpeed * dt;
      break;
  }
  return (s.x - prevX) / dt;
}

const sample: CurveSample = { x: 0, z: 0, dx: 0, dz: 0 };

function resolvePath(s: MotionState, points: readonly PathPoint[], field: FieldMapper, offsetX: number, offsetZ: number): void {
  const n = Math.min(points.length, MAX_PATH_POINTS);
  const side = s.mirror ? -1 : 1;
  for (let i = 0; i < n; i++) {
    const z = field.zAt(points[i][1]);
    s.path[i * 2] = side * points[i][0] * field.halfWidth(z) + offsetX;
    s.path[i * 2 + 1] = z + offsetZ;
  }
  s.pathCount = n;
  s.pathU = 0;
}

function stepPath(speed: number, s: MotionState, dt: number): void {
  const last = s.pathCount - 1;
  if (s.phase !== 'exit') {
    // Constant speed along the curve: advance the parameter by distance / |dP/du|.
    const d = sampleCurve(s.path, s.pathCount, s.pathU, sample);
    const rate = Math.hypot(d.dx, d.dz);
    s.pathU += (speed * dt) / (rate > 1e-3 ? rate : 1e-3);
    if (s.pathU >= last) {
      const end = sampleCurve(s.path, s.pathCount, last, sample);
      const len = Math.hypot(end.dx, end.dz) || 1;
      s.vx = (end.dx / len) * speed;
      s.vz = (end.dz / len) * speed;
      s.x = end.x;
      s.z = end.z;
      s.phase = 'exit';
      s.phaseTime = 0;
    } else {
      const p = sampleCurve(s.path, s.pathCount, s.pathU, sample);
      s.x = p.x;
      s.z = p.z;
      s.yaw = dampAngle(s.yaw, Math.atan2(-p.dx, -p.dz) * RAD, 12, dt);
      return;
    }
  }
  s.x += s.vx * dt;
  s.z += s.vz * dt;
  s.yaw = dampAngle(s.yaw, Math.atan2(-s.vx, -s.vz) * RAD, 12, dt);
}

function stepHover(m: Extract<MoveSpec, { kind: 'hover' }>, s: MotionState, ctx: MotionContext, dt: number): void {
  const holdZ = ctx.field.zAt(m.depth);
  if (s.phase === 'enter') {
    // Ease into the hover line.
    const speed = Math.max(1.2, Math.min(m.enterSpeed, (holdZ - s.z) * 2.5));
    s.z += speed * dt;
    if (s.z >= holdZ - 0.05) {
      s.phase = 'hold';
      s.phaseTime = 0;
    }
    return;
  }
  if (s.phase === 'hold') {
    const side = s.mirror ? -1 : 1;
    s.x = s.baseX + side * m.sway * Math.sin(Math.PI * 2 * m.swayFrequency * s.phaseTime);
    s.z = holdZ + 0.15 * Math.sin(s.phaseTime * 1.7);
    if (s.phaseTime >= m.time) {
      s.phase = 'exit';
      s.phaseTime = 0;
    }
    return;
  }
  // Exit: accelerate away over about a second.
  const k = Math.min(1, s.phaseTime);
  s.z += m.exitSpeed * k * dt;
}

function stepDive(enterSpeed: number, holdTime: number, holdZ: number, diveSpeed: number, s: MotionState, ctx: MotionContext, dt: number): void {
  if (s.phase === 'enter') {
    // Ease into the hold line.
    const speed = Math.max(1.5, Math.min(enterSpeed, (holdZ - s.z) * 3));
    s.z += speed * dt;
    if (s.z >= holdZ - 0.05) {
      s.phase = 'hold';
      s.phaseTime = 0;
    }
    return;
  }
  if (s.phase === 'hold') {
    // Turn to face the player, then lock the dive direction at their current position.
    const dx = ctx.targetX - s.x;
    const dz = ctx.targetZ - s.z;
    const targetYaw = Math.atan2(-dx, -dz) * RAD;
    s.yaw = dampAngle(s.yaw, targetYaw, 10, dt);
    if (s.phaseTime >= holdTime) {
      const len = Math.hypot(dx, dz) || 1;
      s.vx = (dx / len) * diveSpeed;
      s.vz = (dz / len) * diveSpeed;
      s.yaw = targetYaw;
      s.phase = 'dive';
      s.phaseTime = 0;
    }
    return;
  }
  s.x += s.vx * dt;
  s.z += s.vz * dt;
}
