// Enemy movement patterns as pure functions, so they can be unit-tested. Engine-free.

import type { MoveSpec } from '../data/types';
import { dampAngle } from './math';

const RAD = 180 / Math.PI;

export type DivePhase = 'enter' | 'hold' | 'dive';

export interface MotionState {
  x: number;
  z: number;
  /** Dive velocity, locked when the dive starts. */
  vx: number;
  vz: number;
  /** Seconds since spawn. */
  t: number;
  /** Spawn X, the centre line of sine movement. */
  baseX: number;
  /** Slot in the formation, phase-shifts sine movement. */
  slot: number;
  phase: DivePhase;
  phaseTime: number;
  /** Facing, degrees around Y: 180 = nose down the screen (+Z). */
  yaw: number;
}

export interface MotionContext {
  /** Where the player is now. */
  targetX: number;
  targetZ: number;
  /** Z of the line where diving enemies stop to aim. */
  holdZ: number;
}

export function resetMotion(s: MotionState, x: number, z: number, slot: number): void {
  s.x = s.baseX = x;
  s.z = z;
  s.vx = 0;
  s.vz = 0;
  s.t = 0;
  s.slot = slot;
  s.phase = 'enter';
  s.phaseTime = 0;
  s.yaw = 180;
}

/** Advances the movement by `dt`. Returns the sideways speed this step (for banking). */
export function stepMotion(m: MoveSpec, s: MotionState, ctx: MotionContext, dt: number): number {
  const prevX = s.x;
  s.t += dt;
  switch (m.kind) {
    case 'straight':
      s.z += m.speed * dt;
      break;
    case 'sine':
      s.z += m.speed * dt;
      s.x = s.baseX + m.amplitude * Math.sin(Math.PI * 2 * m.frequency * s.t + s.slot * 0.9);
      break;
    case 'dive':
      stepDive(m.enterSpeed, m.holdTime, m.diveSpeed, s, ctx, dt);
      break;
  }
  return (s.x - prevX) / dt;
}

function stepDive(enterSpeed: number, holdTime: number, diveSpeed: number, s: MotionState, ctx: MotionContext, dt: number): void {
  s.phaseTime += dt;
  if (s.phase === 'enter') {
    // Ease into the hold line.
    const speed = Math.max(1.5, Math.min(enterSpeed, (ctx.holdZ - s.z) * 3));
    s.z += speed * dt;
    if (s.z >= ctx.holdZ - 0.05) {
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
