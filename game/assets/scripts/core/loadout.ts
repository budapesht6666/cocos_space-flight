// Builds what the ship brings into a mission from the hangar upgrades, the equipped arsenal and
// the ship's own modifiers (GDD §6, §7, §14), and equips arsenal items. Engine-free.

import { UPGRADES } from '../data/economy';
import { ENERGY } from '../data/player';
import type { ArsenalId, ArsenalSlot, DroneId, Equipped, Loadout, PlayerShipDef, PrimaryId, SecondaryId, SpecialId, UpgradeId } from '../data/types';
import { upgradeValue } from './economy';
import { clamp } from './math';
import type { SaveData } from './save';

const DRONE_ORDER: readonly DroneId[] = ['gunDrone', 'guardian', 'collector'];

export function slotOf(id: ArsenalId): ArsenalSlot {
  return UPGRADES[id].group as ArsenalSlot;
}

/** Bought (or stock: Pulse Cannon, Nova Bomb). */
export function owns(save: SaveData, id: ArsenalId): boolean {
  return upgradeValue(save, id) >= 1;
}

/** How many drones fly. */
export function droneSlots(save: SaveData): number {
  return upgradeValue(save, 'droneBay');
}

export function isEquipped(save: SaveData, id: ArsenalId): boolean {
  const e = save.equip;
  switch (slotOf(id)) {
    case 'primary':
      return e.primary === id;
    case 'secondary':
      return e.secondary === id;
    case 'drone':
      return e.drones.indexOf(id as DroneId) >= 0 && e.drones.indexOf(id as DroneId) < droneSlots(save);
    case 'special':
      return e.special === id;
  }
}

/** equipped / unequipped (a Secondary or drone tapped again), or why not. */
export type EquipResult = 'equipped' | 'unequipped' | 'notOwned' | 'noSlot';

/**
 * Puts an owned item in its slot (mutates the save). Primary and Special always hold one item;
 * the Secondary and drones toggle. A drone joining full bays replaces the one equipped longest.
 */
export function equipItem(save: SaveData, id: ArsenalId): EquipResult {
  if (!owns(save, id)) return 'notOwned';
  const e = save.equip;
  switch (slotOf(id)) {
    case 'primary':
      e.primary = id as PrimaryId;
      return 'equipped';
    case 'special':
      e.special = id as SpecialId;
      return 'equipped';
    case 'secondary':
      if (e.secondary === id) {
        e.secondary = null;
        return 'unequipped';
      }
      e.secondary = id as SecondaryId;
      return 'equipped';
    case 'drone': {
      const slots = droneSlots(save);
      // Forget drones beyond the bay (never flown) before toggling.
      if (e.drones.length > slots) e.drones.length = slots;
      const index = e.drones.indexOf(id as DroneId);
      if (index >= 0) {
        e.drones.splice(index, 1);
        return 'unequipped';
      }
      if (slots === 0) return 'noSlot';
      if (e.drones.length >= slots) e.drones.shift();
      e.drones.push(id as DroneId);
      return 'equipped';
    }
  }
}

/**
 * After a purchase: a freshly licensed item goes straight into its slot (a drone only into a free
 * bay), and a new Drone Bay fills up with drones already owned.
 */
export function autoEquip(save: SaveData, id: UpgradeId): void {
  if (id === 'droneBay') {
    for (const drone of DRONE_ORDER) {
      if (save.equip.drones.length >= droneSlots(save)) break;
      if (owns(save, drone) && save.equip.drones.indexOf(drone) < 0) save.equip.drones.push(drone);
    }
    return;
  }
  if (!isArsenal(id) || upgradeValue(save, id) !== 1 || isEquipped(save, id)) return;
  if (slotOf(id) === 'drone' && save.equip.drones.length >= droneSlots(save)) return;
  equipItem(save, id);
}

function isArsenal(id: UpgradeId): id is ArsenalId {
  return UPGRADES[id].group !== 'systems' && id !== 'droneBay';
}

function level<Id extends ArsenalId>(save: SaveData, id: Id): Equipped<Id> {
  return { id, level: Math.max(1, upgradeValue(save, id)) };
}

export function buildLoadout(save: SaveData, ship: PlayerShipDef): Loadout {
  const maxCharges = ENERGY.maxCharges + ship.chargeBonus;
  const energyLevel = clamp(upgradeValue(save, 'energy'), 1, ENERGY.gainLevels.length);
  const e = save.equip;
  const drones: Equipped<DroneId>[] = [];
  for (const id of e.drones) if (drones.length < droneSlots(save) && owns(save, id)) drones.push(level(save, id));
  return {
    hull: Math.max(1, upgradeValue(save, 'hull') + ship.hullBonus),
    shield: Math.max(0, upgradeValue(save, 'shield') + ship.shieldBonus),
    generator: upgradeValue(save, 'generator'),
    magnet: upgradeValue(save, 'magnet'),
    specialCharges: Math.min(maxCharges, upgradeValue(save, 'charges') + ship.chargeBonus),
    maxCharges,
    energyGain: ENERGY.gainLevels[energyLevel - 1] * ship.energyGain,
    startPower: upgradeValue(save, 'power'),
    primary: level(save, owns(save, e.primary) ? e.primary : 'pulse'),
    secondary: e.secondary && owns(save, e.secondary) ? level(save, e.secondary) : null,
    drones,
    special: owns(save, e.special) ? e.special : 'nova',
    primaryDamage: ship.primaryDamage,
    secondaryCooldown: ship.secondaryCooldown,
  };
}

/** Debug loadout flags (`?primary=ion&secondary=rail&drones=guardian&special=warp&level=5`). */
export interface LoadoutOverride {
  primary: PrimaryId | null;
  /** 'none' empties the slot. */
  secondary: SecondaryId | 'none' | null;
  drones: DroneId[] | null;
  special: SpecialId | null;
  /** Level of every equipped gun (1..5) and drone (1..3). */
  level: number | null;
}

/** Applies debug flags on top of a loadout; anything not given stays as bought. */
export function overrideLoadout(l: Loadout, o: LoadoutOverride): Loadout {
  const gunLevel = (current: number): number => (o.level !== null ? clamp(o.level, 1, 5) : current);
  const droneLevel = (current: number): number => (o.level !== null ? clamp(o.level, 1, 3) : current);
  const primary = o.primary !== null ? { id: o.primary, level: 1 } : l.primary;
  let secondary = l.secondary;
  if (o.secondary === 'none') secondary = null;
  else if (o.secondary !== null) secondary = { id: o.secondary, level: 1 };
  const drones = o.drones !== null ? o.drones.slice(0, 2).map((id) => ({ id, level: 1 })) : l.drones;
  return Object.assign({}, l, {
    primary: { id: primary.id, level: gunLevel(primary.level) },
    secondary: secondary ? { id: secondary.id, level: gunLevel(secondary.level) } : null,
    drones: drones.map((d) => ({ id: d.id, level: droneLevel(d.level) })),
    special: o.special ?? l.special,
  });
}

export function hasOverride(o: LoadoutOverride): boolean {
  return o.primary !== null || o.secondary !== null || o.drones !== null || o.special !== null || o.level !== null;
}
