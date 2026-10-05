// Engine-free weapon math (GDD §7): weapon level scaling, homing turns, beam and chain geometry,
// damage falloff and damage-per-second figures shared by the game and the balance table.
//
// Angles follow the bullet convention: radians from straight up the screen (-Z), positive to the
// right, so velocity = (sin a, -cos a) * speed.

import type { WeaponDef, WeaponLevel } from '../data/types';
import { WEAPON_LEVELS } from '../data/weapons';
import { clamp } from './math';

/** Chain lightning only strikes enemies no further below the ship's centre than this. */
export const CHAIN_BEHIND = 1.5;

export function weaponLevel(level: number): WeaponLevel {
  return WEAPON_LEVELS[clamp(Math.round(level), 1, WEAPON_LEVELS.length) - 1];
}

/** Bullet-convention angle of the direction from (x, z) to (tx, tz). */
export function angleTo(x: number, z: number, tx: number, tz: number): number {
  return Math.atan2(tx - x, -(tz - z));
}

/** Wraps an angle difference into -π..π. */
export function wrapAngle(a: number): number {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
}

/** Turns `angle` towards `target` by at most `maxTurn` radians. */
export function turnTowards(angle: number, target: number, maxTurn: number): number {
  return angle + clamp(wrapAngle(target - angle), -maxTurn, maxTurn);
}

/** Squared distance from point (px, pz) to the segment (x0, z0)–(x1, z1). */
export function distToSegment2(px: number, pz: number, x0: number, z0: number, x1: number, z1: number): number {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((px - x0) * dx + (pz - z0) * dz) / len2 : 0;
  t = clamp(t, 0, 1);
  const ex = x0 + dx * t - px;
  const ez = z0 + dz * t - pz;
  return ex * ex + ez * ez;
}

/**
 * How far a shot from (sx, sz) at `angle` travels before it passes within `reach` of (tx, tz), or
 * -1 if it never does (the target is behind it or off its line).
 */
export function rayDistance(sx: number, sz: number, angle: number, tx: number, tz: number, reach: number): number {
  const dirX = Math.sin(angle);
  const dirZ = -Math.cos(angle);
  const rx = tx - sx;
  const rz = tz - sz;
  const along = rx * dirX + rz * dirZ;
  if (along <= 0) return -1;
  const across = rx * dirZ - rz * dirX;
  return Math.abs(across) <= reach ? along : -1;
}

/** Damage multiplier of a bolt that has `life` of `maxLife` seconds left (falls to `falloff`). */
export function falloffScale(life: number, maxLife: number, falloff: number): number {
  if (!(maxLife > 0) || !Number.isFinite(maxLife) || falloff >= 1) return 1;
  const k = clamp(1 - life / maxLife, 0, 1);
  return 1 + (falloff - 1) * k;
}

/** Armour multiplier after a weapon's armour piercing: armour 0.25, pierce 0.6 → 0.7. */
export function armorScale(armor: number, pierce: number): number {
  return armor + (1 - armor) * clamp(pierce, 0, 1);
}

/** Something a chain can strike. */
export interface ChainTarget {
  x: number;
  z: number;
}

/**
 * Picks a chain of up to `max` targets: the closest to (x, z) whose edge is within `range`, then
 * each next one the closest unvisited target within `jump` of the previous. `radius(i)` is a
 * target's size, `valid(i)` filters candidates. Writes indices into `out`, returns how many.
 * No allocations.
 */
export function pickChain(
  targets: readonly ChainTarget[],
  count: number,
  valid: (i: number) => boolean,
  radius: (i: number) => number,
  x: number,
  z: number,
  range: number,
  jump: number,
  max: number,
  out: number[],
): number {
  let n = 0;
  let fromX = x;
  let fromZ = z;
  let reach = range;
  while (n < max) {
    let best = -1;
    let bestGap = reach;
    for (let i = 0; i < count; i++) {
      if (!valid(i)) continue;
      let used = false;
      for (let j = 0; j < n; j++) {
        if (out[j] === i) {
          used = true;
          break;
        }
      }
      if (used) continue;
      const gap = Math.hypot(targets[i].x - fromX, targets[i].z - fromZ) - radius(i);
      if (gap <= bestGap) {
        bestGap = gap;
        best = i;
      }
    }
    if (best < 0) break;
    out[n++] = best;
    fromX = targets[best].x;
    fromZ = targets[best].z;
    reach = jump;
  }
  return n;
}

// ---------------------------------------------------------------------------------------------
// Damage per second (balance table, gun drones)

/** How hard an equipped gun hits: its level and the ship's damage and cooldown modifiers. */
export interface GunScale {
  level: number;
  /** Damage multiplier (Executioner's Primary +15%). */
  damage: number;
  /** Cooldown multiplier (Executioner's Secondary −20%). */
  cooldown: number;
}

export const STOCK_GUN: GunScale = { level: 1, damage: 1, cooldown: 1 };

/** Seconds between shots (or bursts) of a bolt or chain weapon at this level. */
export function fireInterval(def: WeaponDef, scale: GunScale, rate = 1): number {
  if (def.kind === 'beam') return 0;
  return (def.interval * scale.cooldown) / (weaponLevel(scale.level).rate * rate);
}

/** Damage of one projectile (or the first chain strike) at Power 1..4. */
export function shotDamage(def: WeaponDef, power: number, scale: GunScale): number {
  const lv = weaponLevel(scale.level);
  const p = clamp(power, 1, 4) - 1;
  if (def.kind === 'bolts') return def.damage * (def.forms[p].damage ?? 1) * lv.damage * scale.damage;
  if (def.kind === 'chain') return def.damage * def.forms[p].damage * lv.damage * scale.damage;
  return def.dps * def.forms[p].damage * lv.damage * lv.rate * scale.damage;
}

/**
 * Damage per second if everything the weapon fires lands on targets: every bolt hits, the beam
 * (with side beams) and every chain link connect. The upper bound; the balance table also works
 * out what lands on one target at range.
 */
export function peakDps(def: WeaponDef, power: number, scale: GunScale = STOCK_GUN): number {
  const p = clamp(power, 1, 4) - 1;
  const hit = shotDamage(def, power, scale);
  if (def.kind === 'beam') {
    const form = def.forms[p];
    return hit * (1 + (form.side ? (2 * form.side.damage) / form.damage : 0));
  }
  if (def.kind === 'chain') {
    let total = 0;
    for (let i = 0; i < def.forms[p].targets; i++) total += hit * Math.pow(def.decay, i);
    return total / fireInterval(def, scale);
  }
  return (hit * def.forms[p].streams.length * (def.burst?.count ?? 1)) / fireInterval(def, scale);
}
