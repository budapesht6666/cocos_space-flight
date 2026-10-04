// Content sanity checks: catch broken references and impossible numbers before the game runs.

import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../game/assets/scripts/data/enemies';
import { SPITFIRE } from '../../game/assets/scripts/data/player';
import { SLICE_WAVES } from '../../game/assets/scripts/data/waves';
import { PULSE_CANNON } from '../../game/assets/scripts/data/weapons';
import { WORLD } from '../../game/assets/scripts/data/world';

describe('data', () => {
  it('waves reference existing enemies and are sorted', () => {
    for (let i = 0; i < SLICE_WAVES.length; i++) {
      const w = SLICE_WAVES[i];
      expect(ENEMIES[w.enemy], `wave ${i} enemy ${w.enemy}`).toBeDefined();
      expect(Math.abs(w.x)).toBeLessThanOrEqual(1);
      if (i > 0) expect(w.t).toBeGreaterThanOrEqual(SLICE_WAVES[i - 1].t);
    }
  });

  it('enemy ids match their keys and stats are positive', () => {
    for (const [key, e] of Object.entries(ENEMIES)) {
      expect(e.id).toBe(key);
      expect(e.hp).toBeGreaterThan(0);
      expect(e.radius).toBeGreaterThan(0);
      expect(e.model).toMatch(/^models\//);
    }
  });

  it('weapon defines all four Power forms', () => {
    expect(PULSE_CANNON.powerForms).toHaveLength(4);
    for (const form of PULSE_CANNON.powerForms) expect(form.length).toBeGreaterThan(0);
  });

  it('player hitbox is smaller than the ship body', () => {
    expect(SPITFIRE.hitboxRadius).toBeLessThan(SPITFIRE.bodyRadius);
    expect(SPITFIRE.startHeight).toBeGreaterThan(WORLD.playerTopLimit);
  });
});
