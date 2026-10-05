// Hangar WEAPONS tab (GDD §7): four slot tabs — PRIMARY, SECONDARY, DRONES (with the Drone Bay),
// SPECIAL — each listing its items. Buying a licence fits the item at once; tapping an owned card
// equips it (the Secondary and drones toggle).

import { Graphics, Label, Node, TTFFont } from 'cc';
import { UPGRADE_ORDER, UPGRADES } from '../data/economy';
import type { ArsenalId, ArsenalSlot, UpgradeId } from '../data/types';
import { SaveService } from '../services/SaveService';
import { ArsenalRow, ROW_GAP, ROW_HEIGHT, UpgradeRow } from './HangarRows';
import { drawButton, onTap, placeLabel, UI, uiLabel, uiNode } from './UiKit';

const SLOTS: readonly { id: ArsenalSlot; label: string }[] = [
  { id: 'primary', label: 'PRIMARY' },
  { id: 'secondary', label: 'SECONDARY' },
  { id: 'drone', label: 'DRONES' },
  { id: 'special', label: 'SPECIAL' },
];
const SLOT_WIDTH = 152;
const SLOT_HEIGHT = 58;
const SLOT_GAP = 10;

export interface WeaponsActions {
  buy(id: UpgradeId): void;
  equip(id: ArsenalId): void;
}

export class WeaponsPanel {
  private slot: ArsenalSlot = 'primary';
  private readonly tabs: { id: ArsenalSlot; gfx: Graphics; label: Label }[] = [];
  private readonly lists: Record<ArsenalSlot, Node>;
  private readonly rows: (ArsenalRow | UpgradeRow)[] = [];
  private readonly specialInfo: Label;

  constructor(parent: Node, top: number, font: TTFFont | null, private readonly unlockAll: boolean, actions: WeaponsActions) {
    SLOTS.forEach((s, i) => {
      const dx = (i - (SLOTS.length - 1) / 2) * (SLOT_WIDTH + SLOT_GAP);
      const node = uiNode(parent, `Slot-${s.id}`, SLOT_WIDTH, SLOT_HEIGHT, { top, centerX: true, dx });
      const gfx = node.addComponent(Graphics);
      const label = uiLabel(node, 'Label', 18, UI.white, {}, font);
      label.string = s.label;
      placeLabel(label, 0, 0);
      onTap(node, () => this.show(s.id));
      this.tabs.push({ id: s.id, gfx, label });
    });
    const list = (name: string): Node => uiNode(parent, name, 0, 0, { top: 0, bottom: 0, left: 0, right: 0 });
    this.lists = { primary: list('Primary'), secondary: list('Secondary'), drone: list('Drones'), special: list('Special') };
    const buy = (id: UpgradeId): void => actions.buy(id);
    const equip = (id: ArsenalId): void => actions.equip(id);
    let specialEnd = 0;
    for (const s of SLOTS) {
      let y = top + SLOT_HEIGHT + 18;
      for (const id of UPGRADE_ORDER) {
        const def = UPGRADES[id];
        if (def.group !== s.id) continue;
        // The Drone Bay is a plain upgrade heading the drone list.
        this.rows.push(id === 'droneBay' ? new UpgradeRow(this.lists[s.id], def, y, font, buy) : new ArsenalRow(this.lists[s.id], def, y, font, unlockAll, buy, equip));
        y += ROW_HEIGHT + ROW_GAP;
      }
      if (s.id === 'special') specialEnd = y;
    }
    this.specialInfo = uiLabel(this.lists.special, 'Charges', 18, UI.dim, { top: specialEnd + 8, centerX: true }, font);
  }

  /** Arrow keys step through the slots. */
  step(dir: number): void {
    const i = SLOTS.findIndex((s) => s.id === this.slot);
    this.show(SLOTS[(i + dir + SLOTS.length) % SLOTS.length].id);
  }

  refresh(): void {
    for (const t of this.tabs) {
      drawButton(t.gfx, SLOT_WIDTH, SLOT_HEIGHT, t.id === this.slot);
      t.label.color = t.id === this.slot ? UI.white : UI.dim;
    }
    for (const s of SLOTS) this.lists[s.id].active = s.id === this.slot;
    for (const row of this.rows) row.refresh();
    const l = SaveService.loadout(SaveService.shipToFly(this.unlockAll));
    this.specialInfo.string = `Charges: ${l.specialCharges} at start, holds ${l.maxCharges}  ·  more in SYSTEMS`;
  }

  private show(slot: ArsenalSlot): void {
    this.slot = slot;
    this.refresh();
  }
}
