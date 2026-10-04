import { describe, expect, it } from 'vitest';
import { resetMotion, stepMotion, type MotionState } from '../../game/assets/scripts/core/motion';
import type { MoveSpec } from '../../game/assets/scripts/data/types';

function fresh(x: number, z: number, slot = 0): MotionState {
  const s = { x: 0, z: 0, vx: 0, vz: 0, t: 0, baseX: 0, slot: 0, phase: 'enter', phaseTime: 0, yaw: 0 } as MotionState;
  resetMotion(s, x, z, slot);
  return s;
}

const DT = 1 / 60;
const dive: MoveSpec = { kind: 'dive', enterSpeed: 7, holdTime: 0.7, holdDepth: 0.25, diveSpeed: 17 };

describe('stepMotion — dive', () => {
  it('locks onto the player and dives towards them, not straight down', () => {
    const s = fresh(2, -15);
    const ctx = { targetX: -4, targetZ: 7, holdZ: -8 };
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
    const s = fresh(0, -15);
    const ctx = { targetX: 0, targetZ: 7, holdZ: -8 };
    while (s.phase !== 'dive') stepMotion(dive, s, ctx, DT);
    ctx.targetX = 4; // dodge
    while (s.z < ctx.targetZ) stepMotion(dive, s, ctx, DT);
    expect(Math.abs(s.x - ctx.targetX)).toBeGreaterThan(3);
  });

  it('faces the player while aiming (short way round)', () => {
    const s = fresh(0, -15);
    const ctx = { targetX: -3, targetZ: 7, holdZ: -8 };
    while (s.phase !== 'dive') stepMotion(dive, s, ctx, DT);
    // Yaw θ turns the nose (0,0,-1) into (-sin θ, 0, -cos θ); down-left needs sin θ > 0, cos θ < 0.
    const yaw = ((s.yaw % 360) + 360) % 360;
    expect(yaw).toBeGreaterThan(90);
    expect(yaw).toBeLessThan(180);
  });
});

describe('stepMotion — sine and straight', () => {
  it('sine oscillates around its spawn line while descending', () => {
    const s = fresh(1, -10);
    const m: MoveSpec = { kind: 'sine', speed: 4, amplitude: 1.5, frequency: 0.5 };
    const ctx = { targetX: 0, targetZ: 0, holdZ: 0 };
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < 240; i++) {
      stepMotion(m, s, ctx, DT);
      minX = Math.min(minX, s.x);
      maxX = Math.max(maxX, s.x);
    }
    expect(s.z).toBeCloseTo(-10 + 4 * 4, 5);
    expect(maxX).toBeCloseTo(2.5, 1);
    expect(minX).toBeCloseTo(-0.5, 1);
  });

  it('straight only moves down and reports no strafe', () => {
    const s = fresh(3, -10);
    const strafe = stepMotion({ kind: 'straight', speed: 6 }, s, { targetX: 0, targetZ: 0, holdZ: 0 }, DT);
    expect(strafe).toBe(0);
    expect(s.x).toBe(3);
    expect(s.z).toBeCloseTo(-10 + 6 * DT, 6);
  });
});
