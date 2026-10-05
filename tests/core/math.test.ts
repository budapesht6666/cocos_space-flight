import { describe, expect, it } from 'vitest';
import { approach, circlesOverlap, clamp, damp, dampAngle, smoothstep, wrap } from '../../game/assets/scripts/core/math';

describe('math', () => {
  it('smoothstep eases in and out within 0..1', () => {
    expect(smoothstep(-1)).toBe(0);
    expect(smoothstep(0.5)).toBe(0.5);
    expect(smoothstep(2)).toBe(1);
    expect(smoothstep(0.1)).toBeLessThan(0.1);
  });

  it('clamps', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it('damp converges and is frame-rate independent', () => {
    let a = 0;
    for (let i = 0; i < 60; i++) a = damp(a, 10, 5, 1 / 60);
    let b = 0;
    for (let i = 0; i < 30; i++) b = damp(b, 10, 5, 1 / 30);
    expect(a).toBeCloseTo(b, 6);
    expect(a).toBeGreaterThan(9.9);
  });

  it('dampAngle turns the short way across ±180', () => {
    const a = dampAngle(170, -170, 10, 1 / 60);
    expect(a).toBeGreaterThan(170);
    const b = dampAngle(-170, 170, 10, 1 / 60);
    expect(b).toBeLessThan(-170);
  });

  it('approach never overshoots', () => {
    expect(approach(0, 1, 0.3)).toBeCloseTo(0.3);
    expect(approach(0.9, 1, 0.3)).toBe(1);
    expect(approach(1, -1, 5)).toBe(-1);
  });

  it('wraps into range', () => {
    expect(wrap(12, 0, 10)).toBe(2);
    expect(wrap(-1, 0, 10)).toBe(9);
    expect(wrap(-25, -20, 5)).toBe(0);
  });

  it('detects circle overlap including touching', () => {
    expect(circlesOverlap(0, 0, 1, 2, 0, 1)).toBe(true);
    expect(circlesOverlap(0, 0, 1, 2.01, 0, 1)).toBe(false);
  });
});
