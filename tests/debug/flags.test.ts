import { describe, expect, it } from 'vitest';
import { parseDebugFlags } from '../../game/assets/scripts/debug/DebugFlags';

describe('parseDebugFlags', () => {
  it('defaults to a normal game', () => {
    expect(parseDebugFlags('')).toEqual({
      overlay: false,
      god: false,
      power: null,
      t: 0,
      seed: null,
      slowmo: 1,
      mission: null,
      difficulty: null,
      elite: null,
    });
  });

  it('reads flags and numbers', () => {
    expect(parseDebugFlags('?debug=1&god=true&power=3&t=12.5&seed=42&mission=s1m1&difficulty=Hard')).toEqual({
      overlay: true,
      god: true,
      power: 3,
      t: 12.5,
      seed: 42,
      slowmo: 1,
      mission: 's1m1',
      difficulty: 'hard',
      elite: null,
    });
  });

  it('clamps power and ignores garbage', () => {
    expect(parseDebugFlags('?power=9&t=abc&god=0').power).toBe(4);
    expect(parseDebugFlags('?power=9&t=abc&god=0').t).toBe(0);
    expect(parseDebugFlags('?god=0').god).toBe(false);
    expect(parseDebugFlags('?difficulty=extreme').difficulty).toBeNull();
  });

  it('forces elites: a named one or random', () => {
    expect(parseDebugFlags('?elite=Volatile').elite).toBe('volatile');
    expect(parseDebugFlags('?elite=1').elite).toBe('random');
    expect(parseDebugFlags('?elite=0').elite).toBeNull();
  });
});
