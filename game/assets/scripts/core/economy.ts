// Hangar purchases and mission rewards (GDD §14). Engine-free; works on the save document.

import { REWARDS, UPGRADES } from '../data/economy';
import type { UpgradeDef, UpgradeId } from '../data/types';
import { clamp } from './math';
import { medalCount } from './medals';
import type { SaveData } from './save';

/** Levels bought, 0..max. */
export function upgradeLevel(save: SaveData, id: UpgradeId): number {
  return clamp(save.upgrades[id] ?? 0, 0, UPGRADES[id].costs.length);
}

/** The upgrade's current value (hull segments, generator level...). */
export function upgradeValue(save: SaveData, id: UpgradeId): number {
  return UPGRADES[id].values[upgradeLevel(save, id)];
}

/** Price of the next level, or null when maxed out. */
export function nextCost(save: SaveData, id: UpgradeId): number | null {
  const level = upgradeLevel(save, id);
  const costs = UPGRADES[id].costs;
  return level < costs.length ? costs[level] : null;
}

export type BuyResult = 'bought' | 'max' | 'poor';

/** Buys the next level if there is one and the wallet allows it (mutates the save). */
export function buyUpgrade(save: SaveData, id: UpgradeId): BuyResult {
  const cost = nextCost(save, id);
  if (cost === null) return 'max';
  if (save.credits < cost) return 'poor';
  save.credits -= cost;
  save.upgrades[id] = upgradeLevel(save, id) + 1;
  return 'bought';
}

export interface RunRewards {
  /** Credits picked up during the run. */
  collected: number;
  /** Mission clear bonus. */
  clear: number;
  /** Bonus for medals earned for the first time. */
  medals: number;
  total: number;
}

/**
 * What a finished run pays. Collected credits are kept even after a defeat (GDD §2); the clear
 * and first-medal bonuses scale with the difficulty's credit multiplier.
 */
export function runRewards(complete: boolean, collected: number, newMedals: number, creditScale: number): RunRewards {
  const clear = complete ? Math.round(REWARDS.clear * creditScale) : 0;
  const medals = Math.round(medalCount(newMedals) * REWARDS.firstMedal * creditScale);
  const kept = Math.max(0, Math.floor(collected));
  return { collected: kept, clear, medals, total: kept + clear + medals };
}

/** Developer wallet (`?credits=`): sets the credits, keeping the lifetime total consistent. */
export function setWallet(save: SaveData, amount: number): void {
  save.credits = Math.max(0, Math.floor(amount));
  save.earned = Math.max(save.earned, save.credits);
}

/** Adds credits to the wallet and the lifetime total (mutates the save). */
export function grantCredits(save: SaveData, amount: number): void {
  const n = Math.max(0, Math.floor(amount));
  save.credits += n;
  save.earned += n;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

/** An upgrade value as the hangar prints it: "4", "II", "LV 3". */
export function formatUpgradeValue(def: UpgradeDef, value: number): string {
  if (def.format === 'roman') return ROMAN[value - 1] ?? String(value);
  if (def.format === 'level') return `LV ${value}`;
  return String(value);
}
