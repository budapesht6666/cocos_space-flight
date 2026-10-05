// Balance table (GDD §14, PLAN stage 5): what the arsenal's numbers add up to — damage per second
// in typical situations, time to kill each enemy, credits a mission can pay and what the hangar
// costs. Engine-free; tools/balance.mjs prints it to docs/BALANCE.md and tests hold the invariants
// ("no weapon is the best everywhere").
//
// A situation is a set of targets around the ship's nose (x across, `ahead` up the screen,
// negative = behind). Straight shots fly their stream lines and hit what is on them (piercing
// shots the first few, with range falloff and splash), homing shots all land, a beam hurts
// everything on its lines, a chain links what it can reach.

import { atLeast, DIFFICULTIES } from '../data/difficulty';
import { REWARDS, UPGRADE_ORDER, UPGRADES } from '../data/economy';
import { ENEMIES } from '../data/enemies';
import { MEDALS } from '../data/medals';
import { MISSION_ORDER, MISSIONS } from '../data/missions';
import { PICKUPS } from '../data/pickups';
import { SET_PIECES } from '../data/setPieces';
import type { Difficulty, DropSpec, EnemyId, MissionId, WeaponDef, WeaponId } from '../data/types';
import { WEAPONS } from '../data/weapons';
import { armorScale, CHAIN_BEHIND, falloffScale, fireInterval, peakDps, pickChain, rayDistance, shotDamage, type GunScale } from './arsenal';
import { formationSize } from './formations';

const DEG = Math.PI / 180;

/** A target `ahead` of the nose (negative = behind) and `x` across. */
export interface Target {
  x: number;
  ahead: number;
  radius: number;
}

export type Situation = 'focus' | 'small' | 'armor' | 'close' | 'wave' | 'trail' | 'cluster' | 'flank' | 'rear';
export const SITUATIONS: readonly Situation[] = ['focus', 'small', 'armor', 'close', 'wave', 'trail', 'cluster', 'flank', 'rear'];

/** Boss core armour in the `armor` situation (Warden: 25% while its modules live). */
const ARMOR = 0.25;

function row(count: number, ahead: number, spacing: number, radius: number): Target[] {
  const out: Target[] = [];
  for (let i = 0; i < count; i++) out.push({ x: (i - (count - 1) / 2) * spacing, ahead, radius });
  return out;
}

/** A V formation (data formations 'v'): the leader nearest, wings trailing up the screen. */
function vee(count: number, ahead: number, spacing: number, radius: number): Target[] {
  const out: Target[] = [{ x: 0, ahead, radius }];
  for (let i = 1; i < count; i++) {
    const rank = Math.ceil(i / 2);
    out.push({ x: (i % 2 === 1 ? -1 : 1) * rank * spacing, ahead: ahead + rank * spacing * 0.8, radius });
  }
  return out;
}

function column(count: number, ahead: number, spacing: number, radius: number): Target[] {
  const out: Target[] = [];
  for (let i = 0; i < count; i++) out.push({ x: 0, ahead: ahead + i * spacing, radius });
  return out;
}

export const SITUATION_TARGETS: Record<Situation, readonly Target[]> = {
  /** One big target (a boss, radius 1.5) at mid screen. */
  focus: [{ x: 0, ahead: 7, radius: 1.5 }],
  /** A Gunship-sized target there: precision. */
  small: [{ x: 0, ahead: 7, radius: 0.75 }],
  /** A boss core under armour (Warden). */
  armor: [{ x: 0, ahead: 7, radius: 2 }],
  /** A swarm in your face: 5 Scouts 3 units ahead. */
  close: row(5, 3, 1, 0.5),
  /** The usual wave: a V of 7 Scouts (spacing 1.2), its leader 5 ahead. */
  wave: vee(7, 5, 1.2, 0.5),
  /** A trail of 5 Scouts one behind another (spacing 1), from 4 ahead: piercing and splash. */
  trail: column(5, 4, 1, 0.5),
  /** A tight pack (rock fragments, a turret nest): 4 Scout-sized targets 0.9 apart around 6 ahead. */
  cluster: [
    { x: -0.45, ahead: 5.55, radius: 0.5 },
    { x: 0.45, ahead: 5.55, radius: 0.5 },
    { x: -0.45, ahead: 6.45, radius: 0.5 },
    { x: 0.45, ahead: 6.45, radius: 0.5 },
  ],
  /** One coming in from the side. */
  flank: [{ x: 3.5, ahead: 3, radius: 0.6 }],
  /** One that got behind the ship. */
  rear: [{ x: 0, ahead: -3.2, radius: 0.5 }],
};

/** Damage per second a weapon deals into a group of targets. */
export function groupDps(def: WeaponDef, power: number, targets: readonly Target[], scale: GunScale): number {
  const p = power - 1;
  const hit = shotDamage(def, power, scale);
  if (def.kind === 'chain') {
    // Same pick as the game: the nearest in reach, then jumps; nothing far behind the ship.
    const points = targets.map((t) => ({ x: t.x, z: -t.ahead }));
    const out: number[] = [];
    const n = pickChain(points, points.length, (i) => targets[i].ahead > -CHAIN_BEHIND, (i) => targets[i].radius, 0, 0, def.range, def.jump, def.forms[p].targets, out);
    let total = 0;
    for (let i = 0; i < n; i++) total += hit * Math.pow(def.decay, i);
    return total / fireInterval(def, scale);
  }
  if (def.kind === 'beam') {
    const form = def.forms[p];
    const lines = [{ x: 0, z: 0, angle: 0, dps: hit, hw: form.width / 2 }];
    const side = form.side;
    if (side) {
      for (const dir of [-1, 1]) lines.push({ x: dir * side.offset, z: 0.3, angle: dir * side.angleDeg * DEG, dps: (hit * side.damage) / form.damage, hw: side.width / 2 });
    }
    let dps = 0;
    for (const t of targets) for (const l of lines) if (rayDistance(l.x, l.z, l.angle, t.x, -t.ahead, t.radius + l.hw) >= 0) dps += l.dps;
    return dps;
  }
  const form = def.forms[p];
  const shots = (def.burst?.count ?? 1) / fireInterval(def, scale);
  const splash = (t: Target): number => 1 + neighbours(form.splash ?? 0, targets, t) * (def.splashDamage ?? 0);
  if (def.homing) return hit * form.streams.length * shots * splash(targets[0]);
  const r = def.radius * (form.scale ?? 1);
  let damage = 0;
  for (const s of form.streams) {
    const a = s.angleDeg * DEG;
    // Targets on this stream's line, nearest first; the bolt stops after `pierce` of them.
    const struck = targets
      .map((t) => ({ t, at: rayDistance(s.x, s.z ?? 0, a, t.x, -t.ahead, t.radius + r) }))
      .filter((h) => h.at >= 0)
      .sort((u, v) => u.at - v.at)
      .slice(0, def.pierce ?? 1);
    for (const h of struck) {
      const flight = h.at / def.speed;
      if (def.life !== undefined && flight > def.life) continue;
      const fall = def.life !== undefined ? falloffScale(def.life - flight, def.life, def.falloff ?? 1) : 1;
      damage += hit * fall * splash(h.t);
    }
  }
  return damage * shots;
}

/** Other targets within a splash radius of `t`. */
function neighbours(radius: number, targets: readonly Target[], t: Target): number {
  if (radius <= 0) return 0;
  let n = 0;
  for (const o of targets) if (o !== t && Math.hypot(o.x - t.x, o.ahead - t.ahead) <= radius + o.radius) n++;
  return n;
}

function armorPierce(def: WeaponDef): number {
  return def.kind === 'chain' ? 0 : (def.armorPierce ?? 0);
}

/** Situations where the player has no time to line up: the ship stays where it is. */
const UNAIMED: readonly Situation[] = ['flank', 'rear'];
/** How far the player slides the ship to line up a shot, and in what steps. */
const AIM_REACH = 2;
const AIM_STEP = 0.05;

/**
 * Damage per second a weapon deals in a situation. The player lines up: the ship slides sideways
 * to wherever the weapon does the most (except on the flank and rear).
 */
export function situationDps(def: WeaponDef, situation: Situation, power: number, scale: GunScale): number {
  const targets = SITUATION_TARGETS[situation];
  let dps = groupDps(def, power, targets, scale);
  if (UNAIMED.indexOf(situation) < 0) {
    for (let dx = -AIM_REACH; dx <= AIM_REACH + 1e-9; dx += AIM_STEP) {
      const moved = targets.map((t) => ({ x: t.x - dx, ahead: t.ahead, radius: t.radius }));
      dps = Math.max(dps, groupDps(def, power, moved, scale));
    }
  }
  return situation === 'armor' ? dps * armorScale(ARMOR, armorPierce(def)) : dps;
}

export interface WeaponRow {
  id: WeaponId;
  /** Peak damage per second (everything lands) at Power I and IV. */
  peak: [number, number];
  /** Per situation, at Power IV. */
  situations: Record<Situation, number>;
}

export function weaponRows(ids: readonly WeaponId[], level = 1): WeaponRow[] {
  const scale: GunScale = { level, damage: 1, cooldown: 1 };
  return ids.map((id) => {
    const def = WEAPONS[id];
    const situations = {} as Record<Situation, number>;
    for (const s of SITUATIONS) situations[s] = situationDps(def, s, 4, scale);
    return { id, peak: [peakDps(def, 1, scale), peakDps(def, 4, scale)], situations };
  });
}

/** Typical fighting distance for time to kill. */
const TTK_AHEAD = 5;

/**
 * Seconds to kill an enemy 5 units ahead with one weapon (HP of the difficulty); Infinity if it
 * can't. An armoured core counts as armoured for its whole life (an upper bound).
 */
export function timeToKill(def: WeaponDef, enemy: EnemyId, power: number, scale: GunScale, difficulty: Difficulty = 'normal'): number {
  const e = ENEMIES[enemy];
  const hp = Math.ceil(e.hp * DIFFICULTIES[difficulty].hp);
  let dps = groupDps(def, power, [{ x: 0, ahead: TTK_AHEAD, radius: e.radius }], scale);
  if (e.armor !== undefined) dps *= armorScale(e.armor, armorPierce(def));
  return dps > 0 ? hp / dps : Infinity;
}

// ---------------------------------------------------------------------------------------------
// Economy

/** Credits an enemy is worth at a difficulty, its fragments and parts included. */
function enemyValue(id: EnemyId, scale: number): number {
  const def = ENEMIES[id];
  let v = dropValue(def.drops, scale);
  if (def.split) v += def.split.count * enemyValue(def.split.enemy, scale);
  for (const part of def.parts ?? []) v += enemyValue(part.enemy, scale);
  return v;
}

/** PickupSystem drops `credits × scale` small and `bigCredits × scale` big credits, and the extra by chance. */
function dropValue(drops: DropSpec, scale: number): number {
  let v = Math.ceil(drops.credits * scale) * PICKUPS.credit.credits + Math.ceil(drops.bigCredits * scale) * PICKUPS.bigCredit.credits;
  if (drops.extra) v += drops.extra.chance * PICKUPS[drops.extra.kind].credits;
  return v;
}

export interface MissionIncome {
  mission: MissionId;
  difficulty: Difficulty;
  /** Every enemy destroyed and every credit picked up. */
  drops: number;
  clear: number;
  /** All four medals for the first time. */
  medals: number;
}

export function missionIncome(mission: MissionId, difficulty: Difficulty): MissionIncome {
  const scale = DIFFICULTIES[difficulty].credits;
  let drops = 0;
  for (const e of MISSIONS[mission].events) {
    if (e.type === 'spawn') {
      if (atLeast(difficulty, e.minDifficulty)) drops += formationSize(e.formation) * enemyValue(e.enemy, scale);
    } else if (e.type === 'setPiece') {
      for (const t of SET_PIECES[e.piece].turrets) drops += enemyValue(t.enemy, scale);
    } else if (e.type === 'boss') {
      drops += enemyValue(e.enemy, scale);
    }
  }
  return {
    mission,
    difficulty,
    drops: Math.round(drops),
    clear: Math.round(REWARDS.clear * scale),
    medals: Math.round(MEDALS.length * REWARDS.firstMedal * scale),
  };
}

export function allMissionIncome(difficulties: readonly Difficulty[]): MissionIncome[] {
  const out: MissionIncome[] = [];
  for (const m of MISSION_ORDER) for (const d of difficulties) out.push(missionIncome(m, d));
  return out;
}

/** What the hangar costs with everything bought, by group. */
export function hangarCosts(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of UPGRADE_ORDER) {
    const u = UPGRADES[id];
    out[u.group] = (out[u.group] ?? 0) + u.costs.reduce((a, b) => a + b, 0);
  }
  return out;
}
