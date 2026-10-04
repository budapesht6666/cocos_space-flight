import { describe, expect, it } from 'vitest';
import { parseDebugFlags } from '../../game/assets/scripts/debug/DebugFlags';

describe('parseDebugFlags', () => {
  it('defaults to a normal game', () => {
    expect(parseDebugFlags('')).toEqual({ overlay: false, god: false, power: 1, t: 0, seed: null, slowmo: 1 });
  });

  it('reads flags and numbers', () => {
    expect(parseDebugFlags('?debug=1&god=true&power=3&t=12.5&seed=42')).toEqual({ overlay: true, god: true, power: 3, t: 12.5, seed: 42, slowmo: 1 });
  });

  it('clamps power and ignores garbage', () => {
    expect(parseDebugFlags('?power=9&t=abc&god=0').power).toBe(4);
    expect(parseDebugFlags('?power=9&t=abc&god=0').t).toBe(0);
    expect(parseDebugFlags('?god=0').god).toBe(false);
  });
});
