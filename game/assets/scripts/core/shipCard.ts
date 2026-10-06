// What the hangar's ship card shows (GDD §6, §17): a table of stats every ship has — hull, shield,
// speed, firepower — with the difference from the ship being flown, and trait cells for what sets
// a ship apart. Derived from the ship data, so the card cannot drift from what the ship does.
// Engine-free.

import { UPGRADES } from '../data/economy';
import { DEFAULT_SHIP, SHIP_ORDER, SHIPS, STOCK_SHIP } from '../data/player';
import type { Loadout, PlayerShipDef } from '../data/types';

export type ShipStatId = 'hull' | 'shield' | 'speed' | 'firepower';

export interface ShipStat {
  id: ShipStatId;
  label: string;
  value: number;
  /** As printed: "5", "×0.85". */
  text: string;
  /** Pips (hull, shield): one per unit, `max` of them; a bar (speed, firepower): filled to value / max. */
  pips: boolean;
  max: number;
}

export interface StatDelta {
  /** Positive is better. */
  sign: -1 | 0 | 1;
  /** As printed: "+2", "−15%"; empty when equal. */
  text: string;
}

export type ShipTraitId = 'recovery' | 'reload' | 'graze' | 'energy' | 'charges';

export interface ShipTrait {
  id: ShipTraitId;
  /** Big line: "1.5 s", "−20%", "+1". */
  value: string;
  /** Small line: what it applies to. */
  caption: string;
}

/** A SPEED and FIREPOWER bar is full at this multiplier. */
export const BAR_MAX = 1.3;
const MINUS = '−';

function maxOf(values: readonly number[]): number {
  let max = -Infinity;
  for (const v of values) if (v > max) max = v;
  return max;
}

/** The most hull and shield any ship can have: the hangar maximum plus the biggest ship bonus. */
export function statCeilings(): { hull: number; shield: number } {
  const ships = SHIP_ORDER.map((id) => SHIPS[id]);
  return {
    hull: maxOf(UPGRADES.hull.values) + maxOf(ships.map((s) => s.hullBonus)),
    shield: maxOf(UPGRADES.shield.values) + maxOf(ships.map((s) => s.shieldBonus)),
  };
}

/** Relative speed: keyboard speed against the starter's (the finger follow scales with it). */
export function speedOf(ship: PlayerShipDef): number {
  return Math.round((ship.keyboardSpeed / SHIPS[DEFAULT_SHIP].keyboardSpeed) * 100) / 100;
}

/** "×1.0", "×0.85", "×1.15". */
export function formatFactor(value: number): string {
  const text = value.toFixed(2).replace(/0$/, '');
  return `×${text}`;
}

/** The table rows for a ship with the player's upgrades (its loadout). */
export function shipStats(ship: PlayerShipDef, loadout: Loadout): ShipStat[] {
  const ceil = statCeilings();
  const speed = speedOf(ship);
  return [
    { id: 'hull', label: 'HULL', value: loadout.hull, text: String(loadout.hull), pips: true, max: ceil.hull },
    { id: 'shield', label: 'SHIELD', value: loadout.shield, text: String(loadout.shield), pips: true, max: ceil.shield },
    { id: 'speed', label: 'SPEED', value: speed, text: formatFactor(speed), pips: false, max: BAR_MAX },
    { id: 'firepower', label: 'FIREPOWER', value: ship.primaryDamage, text: formatFactor(ship.primaryDamage), pips: false, max: BAR_MAX },
  ];
}

/** How a stat compares with the same stat of the ship being flown: "+2" for units, "−15%" for factors. */
export function statDelta(stat: ShipStat, flown: ShipStat): StatDelta {
  const diff = stat.value - flown.value;
  if (Math.abs(diff) < 1e-6) return { sign: 0, text: '' };
  const sign = diff > 0 ? 1 : -1;
  const amount = stat.pips ? Math.abs(diff) : Math.round((Math.abs(diff) / flown.value) * 100);
  return { sign, text: `${sign > 0 ? '+' : MINUS}${amount}${stat.pips ? '' : '%'}` };
}

function percent(factor: number): number {
  return Math.round(Math.abs(factor - 1) * 100);
}

/** What sets the ship apart from the stock values, beyond the table. */
export function shipTraits(ship: PlayerShipDef): ShipTrait[] {
  const traits: ShipTrait[] = [];
  if (ship.invulnerableTime > STOCK_SHIP.invulnerableTime) {
    traits.push({ id: 'recovery', value: `${ship.invulnerableTime} s`, caption: 'HIT RECOVERY' });
  }
  if (ship.secondaryCooldown < STOCK_SHIP.secondaryCooldown) {
    traits.push({ id: 'reload', value: `${MINUS}${percent(ship.secondaryCooldown)}%`, caption: 'SECONDARY RELOAD' });
  }
  if (ship.grazeRadius > STOCK_SHIP.grazeRadius) {
    traits.push({ id: 'graze', value: `+${percent(ship.grazeRadius / STOCK_SHIP.grazeRadius)}%`, caption: 'GRAZE RING' });
  }
  if (ship.energyGain > STOCK_SHIP.energyGain) {
    traits.push({ id: 'energy', value: `+${percent(ship.energyGain)}%`, caption: 'ENERGY GAIN' });
  }
  if (ship.chargeBonus > STOCK_SHIP.chargeBonus) {
    traits.push({ id: 'charges', value: `+${ship.chargeBonus}`, caption: 'EXTRA CHARGE' });
  }
  return traits;
}
