import { describe, expect, it } from 'vitest';
import { createMotionState, initMotion, resetMotion, stepMotion, type FieldMapper, type MotionContext, type MotionState } from '../../game/assets/scripts/core/motion';
import { sampleCurve } from '../../game/assets/scripts/core/path';
import { Rng } from '../../game/assets/scripts/core/Rng';
import type { MoveSpec } from '../../game/assets/scripts/data/types';

/** A flat 10-wide field from z = -10 (top) to z = 10 (bottom). */
const field: FieldMapper = {
  zAt: (f) => -10 + 20 * f,
  halfWidth: () => 5,
};

function context(targetX = 0, targetZ = 7): MotionContext {
  return { targetX, targetZ, field, scrollSpeed: 6 };
}

function fresh(m: MoveSpec, x: number, z: number, slot = 0, mirror = false, ctx = context()): MotionState {
  const s = createMotionState();
  resetMotion(s, x, z, slot, mirror);
  initMotion(m, s, ctx, new Rng(1), 0, 0);
  return s;
}

const DT = 1 / 60;
// holdDepth 0.25 → hold line at z = -5.
const dive: MoveSpec = { kind: 'dive', enterSpeed: 7, holdTime: 0.7, holdDepth: 0.25, diveSpeed: 17 };

describe('stepMotion — dive', () => {
  it('locks onto the player and dives towards them, not straight down', () => {
    const ctx = context(-4, 7);
    const s = fresh(dive, 2, -15);
    let steps = 0;
    while (s.phase !== 'dive' && steps++ < 600) stepMotion(dive, s, ctx, DT);
    expect(s.phase).toBe('dive');
    // Locked velocity points at the player.
    const dirX = ctx.targetX - s.x;
    const dirZ = ctx.targetZ - s.z;
    expect(Math.sign(s.vx)).toBe(Math.sign(dirX));
    expect(s.vx / s.vz).toBeCloseTo(dirX / dirZ, 5);
    // Keep diving until it reaches the player's depth: it must arrive near the player's X.
    while (s.z < ctx.targetZ && steps++ < 2000) stepMotion(dive, s, ctx, DT);
    expect(Math.abs(s.x - ctx.targetX)).toBeLessThan(0.5);
  });

  it('commits: moving away after the lock makes it miss', () => {
    const ctx = context(0, 7);
    const s = fresh(dive, 0, -15);
    while (s.phase !== 'dive') stepMotion(dive, s, ctx, DT);
    ctx.targetX = 4; // dodge
    while (s.z < ctx.targetZ) stepMotion(dive, s, ctx, DT);
    expect(Math.abs(s.x - ctx.targetX)).toBeGreaterThan(3);
  });

  it('faces the player while aiming (short way round)', () => {
    const ctx = context(-3, 7);
    const s = fresh(dive, 0, -15);
    while (s.phase !== 'dive') stepMotion(dive, s, ctx, DT);
    // Yaw θ turns the nose (0,0,-1) into (-sin θ, 0, -cos θ); down-left needs sin θ > 0, cos θ < 0.
    const yaw = ((s.yaw % 360) + 360) % 360;
    expect(yaw).toBeGreaterThan(90);
    expect(yaw).toBeLessThan(180);
  });
});

describe('stepMotion — sine, straight, ground', () => {
  it('sine oscillates around its spawn line while descending', () => {
    const m: MoveSpec = { kind: 'sine', speed: 4, amplitude: 1.5, frequency: 0.5 };
    const s = fresh(m, 1, -10);
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < 240; i++) {
      stepMotion(m, s, context(), DT);
      minX = Math.min(minX, s.x);
      maxX = Math.max(maxX, s.x);
    }
    expect(s.z).toBeCloseTo(-10 + 4 * 4, 5);
    expect(maxX).toBeCloseTo(2.5, 1);
    expect(minX).toBeCloseTo(-0.5, 1);
  });

  it('mirrored sine starts swinging the other way', () => {
    const m: MoveSpec = { kind: 'sine', speed: 4, amplitude: 1.5, frequency: 0.5 };
    const a = fresh(m, 0, -10, 0, false);
    const b = fresh(m, 0, -10, 0, true);
    for (let i = 0; i < 20; i++) {
      stepMotion(m, a, context(), DT);
      stepMotion(m, b, context(), DT);
    }
    expect(a.x).toBeCloseTo(-b.x, 6);
    expect(a.x).not.toBeCloseTo(0, 2);
  });

  it('straight only moves down and reports no strafe', () => {
    const m: MoveSpec = { kind: 'straight', speed: 6 };
    const s = fresh(m, 3, -10);
    const strafe = stepMotion(m, s, context(), DT);
    expect(strafe).toBe(0);
    expect(s.x).toBe(3);
    expect(s.z).toBeCloseTo(-10 + 6 * DT, 6);
  });

  it('ground moves with the scroll speed', () => {
    const m: MoveSpec = { kind: 'ground' };
    const s = fresh(m, 1, -12);
    for (let i = 0; i < 60; i++) stepMotion(m, s, context(), DT);
    expect(s.z).toBeCloseTo(-12 + 6, 5);
  });
});

describe('stepMotion — path', () => {
  const m: MoveSpec = {
    kind: 'path',
    speed: 6,
    points: [
      [-1, 0],
      [0, 0.5],
      [1, 0],
    ],
  };

  it('starts at the first point, passes through the middle one and exits along the last segment', () => {
    const s = fresh(m, 0, 0);
    expect(s.x).toBeCloseTo(-5, 5);
    expect(s.z).toBeCloseTo(-10, 5);
    let nearMiddle = Infinity;
    let steps = 0;
    while (s.phase !== 'exit' && steps++ < 2000) {
      stepMotion(m, s, context(), DT);
      nearMiddle = Math.min(nearMiddle, Math.hypot(s.x - 0, s.z - 0));
    }
    expect(s.phase).toBe('exit');
    expect(nearMiddle).toBeLessThan(0.15);
    // At the end point (the exit step itself already moves it one step further).
    expect(Math.hypot(s.x - 5, s.z + 10)).toBeLessThan(0.15);
    // Keeps going up and to the right after the end.
    stepMotion(m, s, context(), DT);
    expect(s.vx).toBeGreaterThan(0);
    expect(s.vz).toBeLessThan(0);
  });

  it('moves at roughly constant speed', () => {
    const s = fresh(m, 0, 0);
    const speeds: number[] = [];
    for (let i = 0; i < 200 && s.phase !== 'exit'; i++) {
      const x = s.x;
      const z = s.z;
      stepMotion(m, s, context(), DT);
      if (s.phase !== 'exit') speeds.push(Math.hypot(s.x - x, s.z - z) / DT);
    }
    for (const v of speeds) expect(v).toBeGreaterThan(6 * 0.85);
    for (const v of speeds) expect(v).toBeLessThan(6 * 1.15);
  });

  it('mirror flips the path and offsets shift it', () => {
    const s = createMotionState();
    resetMotion(s, 0, 0, 0, true);
    initMotion(m, s, context(), new Rng(1), 0.5, -1);
    expect(s.x).toBeCloseTo(5.5, 5);
    expect(s.z).toBeCloseTo(-11, 5);
  });
});

describe('stepMotion — hover and drift', () => {
  it('hover enters, holds at its depth, then leaves upwards', () => {
    const m: MoveSpec = { kind: 'hover', enterSpeed: 6, depth: 0.25, time: 2, sway: 1, swayFrequency: 0.5, exitSpeed: -5 };
    const s = fresh(m, 0, -12);
    let steps = 0;
    while (s.phase === 'enter' && steps++ < 1000) stepMotion(m, s, context(), DT);
    expect(s.phase).toBe('hold');
    expect(s.z).toBeCloseTo(-5, 0);
    let maxSway = 0;
    while (s.phase === 'hold' && steps++ < 2000) {
      stepMotion(m, s, context(), DT);
      maxSway = Math.max(maxSway, Math.abs(s.x));
    }
    expect(maxSway).toBeGreaterThan(0.9);
    const z = s.z;
    for (let i = 0; i < 120; i++) stepMotion(m, s, context(), DT);
    expect(s.z).toBeLessThan(z - 3);
  });

  it('drift is deterministic per seed and tumbles', () => {
    const m: MoveSpec = { kind: 'drift', speed: 3, spreadX: 1, spin: 90 };
    const a = fresh(m, 0, -10);
    const b = fresh(m, 0, -10);
    expect(a.vx).toBe(b.vx);
    expect(Math.abs(a.vx)).toBeLessThanOrEqual(1);
    expect(a.vz).toBe(3);
    const yaw = a.yaw;
    stepMotion(m, a, context(), DT);
    expect(a.yaw).not.toBe(yaw);
  });
});

describe('sampleCurve', () => {
  it('passes through every control point', () => {
    const pts = new Float32Array([0, 0, 2, 1, 4, -1, 6, 0]);
    const out = { x: 0, z: 0, dx: 0, dz: 0 };
    for (let i = 0; i < 4; i++) {
      sampleCurve(pts, 4, i, out);
      expect(out.x).toBeCloseTo(pts[i * 2], 5);
      expect(out.z).toBeCloseTo(pts[i * 2 + 1], 5);
    }
  });
});
