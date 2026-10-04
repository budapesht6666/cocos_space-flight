// Content sanity checks: catch broken references and impossible numbers before the game runs.
// Adding content (an enemy, a pattern, a mission) should only ever need data edits — these tests
// are the safety net for that.

import { describe, expect, it } from 'vitest';
import { formationSize } from '../../game/assets/scripts/core/formations';
import { MAX_PATH_POINTS } from '../../game/assets/scripts/core/motion';
import { missionNeeds } from '../../game/assets/scripts/core/missionNeeds';
import { hasGlyph } from '../../game/assets/scripts/core/glyphs';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../../game/assets/scripts/data/difficulty';
import { ENEMIES } from '../../game/assets/scripts/data/enemies';
import { MISSIONS } from '../../game/assets/scripts/data/missions';
import { PATHS } from '../../game/assets/scripts/data/paths';
import { PATTERNS } from '../../game/assets/scripts/data/patterns';
import { PICKUPS } from '../../game/assets/scripts/data/pickups';
import { DEFAULT_LOADOUT, ENERGY, GENERATOR_LEVELS, MAGNET_RADIUS, SPITFIRE } from '../../game/assets/scripts/data/player';
import { SET_PIECES } from '../../game/assets/scripts/data/setPieces';
import type { MoveSpec } from '../../game/assets/scripts/data/types';
import { ENEMY_BULLETS, PULSE_CANNON } from '../../game/assets/scripts/data/weapons';
import { WORLD } from '../../game/assets/scripts/data/world';

function checkMove(m: MoveSpec, where: string): void {
  switch (m.kind) {
    case 'path':
      expect(m.points.length, `${where}: path points`).toBeGreaterThanOrEqual(2);
      expect(m.points.length, `${where}: path points`).toBeLessThanOrEqual(MAX_PATH_POINTS);
      expect(m.speed, where).toBeGreaterThan(0);
      for (const [x, d] of m.points) {
        expect(Math.abs(x), `${where}: path x`).toBeLessThanOrEqual(1.6);
        expect(d, `${where}: path depth`).toBeGreaterThan(-0.5);
        expect(d, `${where}: path depth`).toBeLessThan(1.6);
      }
      break;
    case 'hover':
      expect(m.depth, where).toBeGreaterThan(0);
      expect(m.depth, where).toBeLessThan(0.6);
      expect(m.time, where).toBeGreaterThan(0);
      break;
    case 'dive':
      expect(m.holdDepth, where).toBeGreaterThan(0);
      expect(m.diveSpeed, where).toBeGreaterThan(0);
      break;
    case 'straight':
    case 'sine':
    case 'drift':
      expect(m.speed, where).toBeGreaterThan(0);
      break;
    case 'ground':
      break;
  }
}

describe('enemies', () => {
  it('ids match keys; stats are sane; looks point at models', () => {
    for (const [key, e] of Object.entries(ENEMIES)) {
      expect(e.id).toBe(key);
      expect(e.hp, key).toBeGreaterThan(0);
      expect(e.radius, key).toBeGreaterThan(0);
      expect(e.score, key).toBeGreaterThanOrEqual(0);
      expect(e.name.length, key).toBeGreaterThan(0);
      if (e.look.kind === 'model') expect(e.look.path, key).toMatch(/^models\//);
      expect(e.look.size, key).toBeGreaterThan(0);
      checkMove(e.move, key);
    }
  });

  it('attacks reference existing patterns with valid HP phases', () => {
    for (const e of Object.values(ENEMIES)) {
      for (const a of e.attacks) {
        expect(PATTERNS[a.pattern], `${e.id} → ${a.pattern}`).toBeDefined();
        if (a.minDifficulty) expect(DIFFICULTY_ORDER).toContain(a.minDifficulty);
        if (a.hpBelow !== undefined) expect(a.hpBelow).toBeGreaterThan(0);
        if (a.hpAbove !== undefined) expect(a.hpAbove).toBeLessThan(1);
      }
    }
  });

  it('drops and splits reference existing things and do not loop', () => {
    for (const e of Object.values(ENEMIES)) {
      if (e.drops.extra) {
        expect(PICKUPS[e.drops.extra.kind], e.id).toBeDefined();
        expect(e.drops.extra.chance).toBeGreaterThan(0);
        expect(e.drops.extra.chance).toBeLessThanOrEqual(1);
      }
      if (e.split) {
        const child = ENEMIES[e.split.enemy];
        expect(child, e.id).toBeDefined();
        expect(child.split, `${e.id} splits into something that splits again`).toBeUndefined();
        expect(child.move.kind, 'fragments need drift movement to fly apart').toBe('drift');
      }
      if (e.ground) expect(e.move.kind, e.id).toBe('ground');
    }
  });
});

describe('patterns and bullets', () => {
  it('every pattern fires something and never spins in place', () => {
    for (const [id, p] of Object.entries(PATTERNS)) {
      expect(ENEMY_BULLETS[p.bullet], id).toBeDefined();
      expect(p.count, id).toBeGreaterThan(0);
      expect(p.speed, id).toBeGreaterThan(0);
      expect(p.volleys, id).toBeGreaterThan(0);
      expect(p.cooldown, id).toBeGreaterThan(0);
      if (p.volleys > 1) expect(p.volleyInterval, id).toBeGreaterThan(0);
      if (p.count > 1 && !p.ring) expect(p.gapDeg, `${id}: a fan needs a gap`).toBeGreaterThan(0);
    }
  });

  it('weapon defines all four Power forms', () => {
    expect(PULSE_CANNON.powerForms).toHaveLength(4);
    for (const form of PULSE_CANNON.powerForms) expect(form.length).toBeGreaterThan(0);
  });
});

describe('pickups and player', () => {
  it('pickup ids match keys and letters have glyphs', () => {
    for (const [key, p] of Object.entries(PICKUPS)) {
      expect(p.kind).toBe(key);
      if (p.letter) expect(hasGlyph(p.letter), key).toBe(true);
      else expect(p.credits, `${key} without a letter must be a credit`).toBeGreaterThan(0);
    }
  });

  it('player hitbox is smaller than the ship, graze ring bigger', () => {
    expect(SPITFIRE.hitboxRadius).toBeLessThan(SPITFIRE.bodyRadius);
    expect(SPITFIRE.grazeRadius).toBeGreaterThan(SPITFIRE.bodyRadius);
    expect(SPITFIRE.startHeight).toBeGreaterThan(WORLD.playerTopLimit);
  });

  it('loadout levels exist in their tables', () => {
    expect(GENERATOR_LEVELS[DEFAULT_LOADOUT.generator - 1]).toBeDefined();
    expect(MAGNET_RADIUS[DEFAULT_LOADOUT.magnet - 1]).toBeDefined();
    expect(ENERGY.gainLevels[DEFAULT_LOADOUT.energyGain - 1]).toBeDefined();
    expect(DEFAULT_LOADOUT.specialCharges).toBeLessThanOrEqual(ENERGY.maxCharges);
  });

  it('difficulties are complete and get harder', () => {
    let prev = DIFFICULTIES.normal;
    for (const d of DIFFICULTY_ORDER) {
      const def = DIFFICULTIES[d];
      expect(def.hp).toBeGreaterThanOrEqual(prev.hp);
      expect(def.fireRate).toBeGreaterThanOrEqual(prev.fireRate);
      prev = def;
    }
  });
});

describe('set pieces', () => {
  it('turrets are ground enemies standing on the piece', () => {
    for (const [key, p] of Object.entries(SET_PIECES)) {
      expect(p.id).toBe(key);
      for (const t of p.turrets) {
        expect(ENEMIES[t.enemy].ground, `${key}: ${t.enemy}`).toBe(true);
        expect(Math.abs(t.z), key).toBeLessThanOrEqual(p.length / 2);
      }
    }
  });
});

describe('missions', () => {
  for (const [key, m] of Object.entries(MISSIONS)) {
    describe(key, () => {
      it('id matches its key and the timeline is sorted', () => {
        expect(m.id).toBe(key);
        for (let i = 1; i < m.events.length; i++) expect(m.events[i].t, `event ${i}`).toBeGreaterThanOrEqual(m.events[i - 1].t);
      });

      it('events reference existing content with sane parameters', () => {
        m.events.forEach((e, i) => {
          const where = `${key} event ${i} (t ${e.t})`;
          switch (e.type) {
            case 'spawn':
              expect(ENEMIES[e.enemy], where).toBeDefined();
              expect(Math.abs(e.x), where).toBeLessThanOrEqual(1);
              expect(formationSize(e.formation), where).toBeGreaterThan(0);
              if (e.formation.kind === 'trail') expect(e.stagger ?? 0, `${where}: a trail needs stagger`).toBeGreaterThan(0);
              if (e.bonus) expect(PICKUPS[e.bonus], where).toBeDefined();
              if (e.move) checkMove(e.move, where);
              expect(ENEMIES[e.enemy].ground, `${where}: ground enemies come with set pieces`).not.toBe(true);
              break;
            case 'setPiece':
              expect(SET_PIECES[e.piece], where).toBeDefined();
              expect(Math.abs(e.x), where).toBeLessThanOrEqual(1);
              break;
            case 'boss':
              expect(ENEMIES[e.enemy], where).toBeDefined();
              break;
            case 'waitClear':
              break;
          }
        });
      });

      it('ends with a boss and gives Power along the way', () => {
        expect(m.events[m.events.length - 1].type).toBe('boss');
        const powers = m.events.filter((e) => e.type === 'spawn' && e.bonus === 'power').length;
        expect(powers).toBeGreaterThanOrEqual(3);
      });

      it('preloads every enemy it can spawn', () => {
        const needs = missionNeeds(m);
        for (const e of m.events) {
          if (e.type === 'spawn' || e.type === 'boss') expect(needs.enemies.get(e.enemy), e.enemy).toBeGreaterThan(0);
          if (e.type === 'setPiece') {
            for (const t of SET_PIECES[e.piece].turrets) expect(needs.enemies.get(t.enemy), t.enemy).toBeGreaterThan(0);
          }
        }
        for (const [id] of needs.enemies) {
          const split = ENEMIES[id].split;
          if (split) expect(needs.enemies.get(split.enemy), split.enemy).toBeGreaterThan(0);
        }
      });
    });
  }
});

describe('paths', () => {
  it('all shared paths are valid', () => {
    for (const [key, p] of Object.entries(PATHS)) checkMove(p, key);
  });
});
