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
      unlock: false,
      credits: null,
      reset: false,
      scale: null,
      bloom: null,
      fxaa: null,
    });
  });

  it('reads flags and numbers', () => {
    expect(parseDebugFlags('?debug=1&god=true&power=3&t=12.5&seed=42&mission=s1m1&difficulty=Hard&unlock=1&credits=5000.7&reset=1&scale=0.55&bloom=0&fxaa=false')).toEqual({
      overlay: true,
      god: true,
      power: 3,
      t: 12.5,
      seed: 42,
      slowmo: 1,
      mission: 's1m1',
      difficulty: 'hard',
      elite: null,
      unlock: true,
      credits: 5000,
      reset: true,
      scale: 0.55,
      bloom: false,
      fxaa: false,
    });
  });

  it('clamps power and ignores garbage', () => {
    expect(parseDebugFlags('?power=9&t=abc&god=0').power).toBe(4);
    expect(parseDebugFlags('?power=9&t=abc&god=0').t).toBe(0);
    expect(parseDebugFlags('?god=0').god).toBe(false);
    expect(parseDebugFlags('?difficulty=extreme').difficulty).toBeNull();
    expect(parseDebugFlags('?credits=-5').credits).toBe(0);
    expect(parseDebugFlags('?credits=lots').credits).toBeNull();
    expect(parseDebugFlags('?scale=5').scale).toBe(1);
    expect(parseDebugFlags('?scale=0.1').scale).toBe(0.3);
    expect(parseDebugFlags('?bloom=1').bloom).toBe(true);
    expect(parseDebugFlags('?fxaa=yes').fxaa).toBe(true);
  });

  it('forces elites: a named one or random', () => {
    expect(parseDebugFlags('?elite=Volatile').elite).toBe('volatile');
    expect(parseDebugFlags('?elite=1').elite).toBe('random');
    expect(parseDebugFlags('?elite=0').elite).toBeNull();
  });
});
