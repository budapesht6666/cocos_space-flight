// Content sanity checks: catch broken references and impossible numbers before the game runs.
// Adding content (an enemy, a pattern, a mission) should only ever need data edits — these tests
// are the safety net for that.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { formationSize } from '../../game/assets/scripts/core/formations';
import { MAX_PATH_POINTS } from '../../game/assets/scripts/core/motion';
import { countPods, missionNeeds, missionPrefabPaths } from '../../game/assets/scripts/core/missionNeeds';
import { CAMPAIGN_DIFFICULTIES, SECTORS } from '../../game/assets/scripts/data/campaign';
import { DECOR } from '../../game/assets/scripts/data/decor';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../../game/assets/scripts/data/difficulty';
import { UPGRADE_ORDER, UPGRADES } from '../../game/assets/scripts/data/economy';
import { ELITE_IDS, ELITES } from '../../game/assets/scripts/data/elites';
import { ENEMIES } from '../../game/assets/scripts/data/enemies';
import { MEDALS } from '../../game/assets/scripts/data/medals';
import { MISSION_ORDER, MISSIONS, nextMission } from '../../game/assets/scripts/data/missions';
import { PATHS } from '../../game/assets/scripts/data/paths';
import { PATTERNS } from '../../game/assets/scripts/data/patterns';
import { PICKUPS } from '../../game/assets/scripts/data/pickups';
import { DEFAULT_PAINT, DEFAULT_SHIP, ENERGY, GENERATOR_LEVELS, MAGNET_RADIUS, PAINT_ORDER, PAINTS, SHIP_ORDER, SHIPS, shipModel, shipModelFile } from '../../game/assets/scripts/data/player';
import { SET_PIECES } from '../../game/assets/scripts/data/setPieces';
import type { MoveSpec } from '../../game/assets/scripts/data/types';
import { ENEMY_BULLETS, PULSE_CANNON, WEAPON_LEVELS } from '../../game/assets/scripts/data/weapons';
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
    case 'attached':
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
      if (e.look.kind === 'assembly') for (const m of e.look.modules) expect(m.prop, key).toMatch(/^station_/);
      expect(e.look.size, key).toBeGreaterThan(0);
      checkMove(e.move, key);
      if (e.hull) {
        expect(e.hull.length, key).toBeGreaterThan(0);
        for (const c of e.hull) expect(Math.hypot(c.x, c.z) + c.r, `${key}: hull circle outside the bounding radius`).toBeLessThanOrEqual(e.radius + 1e-6);
      }
      if (e.bank !== undefined) expect(e.bank, key).toBeGreaterThanOrEqual(0);
    }
  });

  it('parts are attached enemies that ride only on parents; armour needs parts', () => {
    const partIds = new Set<string>();
    for (const e of Object.values(ENEMIES)) {
      for (const p of e.parts ?? []) {
        const part = ENEMIES[p.enemy];
        expect(part, `${e.id} → ${p.enemy}`).toBeDefined();
        expect(part.move.kind, `${p.enemy} must use 'attached' movement`).toBe('attached');
        expect(part.parts, `${p.enemy}: parts of parts are not supported`).toBeUndefined();
        partIds.add(p.enemy);
      }
      if (e.armor !== undefined) {
        expect(e.parts?.length ?? 0, `${e.id}: armour without parts never drops`).toBeGreaterThan(0);
        expect(e.armor).toBeGreaterThanOrEqual(0);
        expect(e.armor).toBeLessThan(1);
      }
    }
    for (const e of Object.values(ENEMIES)) if (e.move.kind === 'attached') expect(partIds.has(e.id), `${e.id} is attached but nothing carries it`).toBe(true);
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
  it('pickup ids match keys; power-ups have an icon, credits a value', () => {
    for (const [key, p] of Object.entries(PICKUPS)) {
      expect(p.kind).toBe(key);
      if (p.prop) expect(p.prop, key).toMatch(/^pickup_/);
      else if (!p.pod) expect(p.credits, `${key} without an icon must be a credit`).toBeGreaterThan(0);
    }
  });

  it('elites are complete and only make enemies tougher', () => {
    expect(ELITE_IDS.slice().sort()).toEqual(Object.keys(ELITES).sort());
    for (const [key, e] of Object.entries(ELITES)) {
      expect(e.id).toBe(key);
      expect(e.hp, key).toBeGreaterThanOrEqual(1);
      expect(e.speed, key).toBeGreaterThanOrEqual(1);
      expect(e.shield, key).toBeGreaterThanOrEqual(0);
      expect(e.score, key).toBeGreaterThanOrEqual(1);
      expect(e.weight, key).toBeGreaterThan(0);
      if (e.revenge) expect(PATTERNS[e.revenge], key).toBeDefined();
    }
    expect(DIFFICULTIES.normal.eliteChance).toBe(0);
    for (const d of DIFFICULTY_ORDER) {
      expect(DIFFICULTIES[d].eliteChance).toBeGreaterThanOrEqual(0);
      expect(DIFFICULTIES[d].eliteChance).toBeLessThan(1);
    }
  });

  it('medals: four, one per id', () => {
    expect(MEDALS.map((m) => m.id)).toEqual(['hunter', 'exterminator', 'rescuer', 'untouchable']);
  });

  it('ships: hitbox the same for all, smaller than the ship, graze ring bigger; every paint has a model', () => {
    expect(SHIP_ORDER.slice().sort()).toEqual(Object.keys(SHIPS).sort());
    expect(PAINT_ORDER.slice().sort()).toEqual(Object.keys(PAINTS).sort());
    expect(SHIPS[DEFAULT_SHIP].unlock).toBeNull();
    expect(PAINTS[DEFAULT_PAINT]).toBeDefined();
    for (const [key, ship] of Object.entries(SHIPS)) {
      expect(ship.id).toBe(key);
      expect(ship.hitboxRadius, key).toBe(SHIPS[DEFAULT_SHIP].hitboxRadius);
      expect(ship.hitboxRadius, key).toBeLessThan(ship.bodyRadius);
      expect(ship.grazeRadius, key).toBeGreaterThan(ship.bodyRadius);
      expect(ship.startHeight, key).toBeGreaterThan(WORLD.playerTopLimit);
      expect(ship.engines.length, key).toBeGreaterThan(0);
      expect(ship.perks.length, key).toBeGreaterThan(0);
      if (ship.unlock) expect(SECTORS[ship.unlock.sector - 1], `${key} unlock sector`).toBeDefined();
      for (const paint of PAINT_ORDER) {
        const file = path.resolve(__dirname, '../../game/assets/resources', `${shipModelFile(ship.id, paint)}.glb`);
        expect(fs.existsSync(file), file).toBe(true);
        expect(shipModel(ship.id, paint)).toBe(`${shipModelFile(ship.id, paint)}/${ship.id}_${paint}`);
      }
    }
  });

  it('every upgrade level exists in the tables it indexes', () => {
    for (const v of UPGRADES.generator.values) expect(GENERATOR_LEVELS[v - 1]).toBeDefined();
    for (const v of UPGRADES.magnet.values) expect(MAGNET_RADIUS[v - 1]).toBeDefined();
    for (const v of UPGRADES.energy.values) expect(ENERGY.gainLevels[v - 1]).toBeDefined();
    for (const v of UPGRADES.pulse.values) expect(WEAPON_LEVELS[v - 1]).toBeDefined();
    for (const v of UPGRADES.charges.values) expect(v).toBeLessThanOrEqual(ENERGY.maxCharges);
    for (const v of UPGRADES.power.values) expect(v).toBeLessThanOrEqual(PULSE_CANNON.powerForms.length);
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
      if (p.pods) {
        expect(p.pods.count, key).toBeGreaterThan(0);
        expect(p.turrets.length, `${key}: pods are freed by destroying turrets`).toBeGreaterThan(0);
        expect(Math.abs(p.pods.z), key).toBeLessThanOrEqual(p.length / 2);
      }
    }
  });

  it('modules are station props within the piece', () => {
    for (const [key, p] of Object.entries(SET_PIECES)) {
      expect(p.modules.length, key).toBeGreaterThan(0);
      for (const m of p.modules) {
        expect(m.prop, key).toMatch(/^station_/);
        expect(Math.abs(m.z), `${key}: ${m.prop}`).toBeLessThanOrEqual(p.length / 2);
        expect(Math.abs(m.x), `${key}: ${m.prop}`).toBeLessThan(5);
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
            case 'decor':
              expect(DECOR[e.field], where).toBeDefined();
              expect(e.duration, where).toBeGreaterThan(0);
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

      it('offers escape pods (Rescuer medal)', () => {
        expect(countPods(m)).toBeGreaterThan(0);
      });

      it('every prefab it loads exists (menu preloading uses the same list)', () => {
        const paths = missionPrefabPaths(missionNeeds(m));
        expect(paths.length).toBeGreaterThan(0);
        for (const p of paths) {
          // 'models/ships/bob_red/bob_red' is the prefab inside models/ships/bob_red.glb.
          const file = path.resolve(__dirname, '../../game/assets/resources', `${p.slice(0, p.lastIndexOf('/'))}.glb`);
          expect(fs.existsSync(file), file).toBe(true);
        }
      });

      it('parts never spawn on their own', () => {
        for (const e of m.events) if (e.type === 'spawn' || e.type === 'boss') expect(ENEMIES[e.enemy].move.kind).not.toBe('attached');
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
          const look = ENEMIES[id].look;
          if (look.kind === 'prop') expect(needs.props.has(look.prop), look.prop).toBe(true);
        }
        for (const e of m.events) {
          if (e.type === 'setPiece') for (const mod of SET_PIECES[e.piece].modules) expect(needs.props.has(mod.prop), mod.prop).toBe(true);
        }
        for (const p of Object.values(PICKUPS)) if (p.prop) expect(needs.props.has(p.prop), p.prop).toBe(true);
        for (const [id] of needs.enemies) {
          const def = ENEMIES[id];
          for (const part of def.parts ?? []) expect(needs.enemies.get(part.enemy) ?? 0, part.enemy).toBeGreaterThanOrEqual(def.parts!.filter((p) => p.enemy === part.enemy).length);
          if (def.look.kind === 'assembly') for (const mod of def.look.modules) expect(needs.props.has(mod.prop), mod.prop).toBe(true);
        }
      });
    });
  }
});

describe('economy', () => {
  it('upgrades: one per id, one cost per level, prices and values only go up', () => {
    expect(UPGRADE_ORDER.slice().sort()).toEqual(Object.keys(UPGRADES).sort());
    for (const [key, u] of Object.entries(UPGRADES)) {
      expect(u.id).toBe(key);
      expect(u.costs.length, key).toBe(u.values.length - 1);
      for (let i = 1; i < u.values.length; i++) expect(u.values[i], key).toBeGreaterThan(u.values[i - 1]);
      for (let i = 0; i < u.costs.length; i++) {
        expect(Number.isInteger(u.costs[i]), key).toBe(true);
        if (i > 0) expect(u.costs[i], key).toBeGreaterThan(u.costs[i - 1]);
      }
    }
  });

  it('weapon levels only make the gun stronger', () => {
    expect(WEAPON_LEVELS[0]).toEqual({ damage: 1, rate: 1 });
    for (let i = 1; i < WEAPON_LEVELS.length; i++) {
      expect(WEAPON_LEVELS[i].damage).toBeGreaterThan(WEAPON_LEVELS[i - 1].damage);
      expect(WEAPON_LEVELS[i].rate).toBeGreaterThanOrEqual(WEAPON_LEVELS[i - 1].rate);
    }
  });
});

describe('campaign', () => {
  it('sectors hold every mission once, in campaign order; medal thresholds are reachable', () => {
    SECTORS.forEach((s, i) => expect(s.id).toBe(i + 1));
    expect(SECTORS.reduce<string[]>((all, s) => all.concat(s.missions), [])).toEqual(MISSION_ORDER.slice());
    for (const s of SECTORS) {
      if (s.missions.length > 0) expect(s.missions.length, s.name).toBe(3);
      expect(s.medalsToAdvance, s.name).toBeLessThanOrEqual(3 * 4 * CAMPAIGN_DIFFICULTIES.length);
    }
    expect(CAMPAIGN_DIFFICULTIES).toEqual(DIFFICULTY_ORDER.slice(0, CAMPAIGN_DIFFICULTIES.length));
  });

  it('lists every mission once, in order, with NEXT following it', () => {
    expect(MISSION_ORDER.slice().sort()).toEqual(Object.keys(MISSIONS).sort());
    for (let i = 0; i < MISSION_ORDER.length - 1; i++) expect(nextMission(MISSION_ORDER[i])).toBe(MISSION_ORDER[i + 1]);
    expect(nextMission(MISSION_ORDER[MISSION_ORDER.length - 1])).toBeNull();
  });
});

describe('paths', () => {
  it('all shared paths are valid', () => {
    for (const [key, p] of Object.entries(PATHS)) checkMove(p, key);
  });
});
