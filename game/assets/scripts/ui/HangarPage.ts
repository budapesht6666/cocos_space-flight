// Hangar (GDD §6, §7, §14): three tabs. SHIP — pick a ship and its paint on the turntable; SYSTEMS —
// hull, shield, generator, magnet, Nova charges, Energy gain, starting Power; WEAPONS — the four
// slots with their arsenal (ui/HangarWeapons.ts). LAUNCH plays the mission picked on the main or
// mission page.

import { Graphics, KeyCode, Label, Node, view } from 'cc';
import { shipUnlocked, unlockHint } from '../core/progress';
import { shipStats } from '../core/shipCard';
import { UPGRADE_ORDER, UPGRADES } from '../data/economy';
import { PAINT_ORDER, PAINTS, SHIP_ORDER, SHIPS } from '../data/player';
import type { ArsenalId, PaintId, ShipId, UpgradeId } from '../data/types';
import { toColor } from '../fx/RenderKit';
import { AudioService } from '../services/AudioService';
import { SaveService } from '../services/SaveService';
import { ROW_GAP, ROW_HEIGHT, UpgradeRow } from './HangarRows';
import { SHIP_CARD_HEIGHT, ShipCard } from './ShipCard';
import { WeaponsPanel } from './HangarWeapons';
import { pickLabel } from './MenuPages';
import { HEADER_TOP, pageHeader, pageRoot, type MenuHost, type MenuPage, type ShipPose } from './MenuPage';
import { drawButton, drawChevron, onTap, placeLabel, UI, uiLabel, uiNode } from './UiKit';

type Tab = 'ship' | 'systems' | 'weapons';

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'ship', label: 'SHIP' },
  { id: 'systems', label: 'SYSTEMS' },
  { id: 'weapons', label: 'WEAPONS' },
];
const TAB_WIDTH = 204;
const TAB_HEIGHT = 66;
const TABS_TOP = HEADER_TOP + 92;
const CONTENT_TOP = TABS_TOP + TAB_HEIGHT + 24;
const SWATCH_R = 30;
const SWATCH_GAP = 104;
const SWATCH_BOTTOM = 160;
const SHIP_CARD_BOTTOM = SWATCH_BOTTOM + SWATCH_R * 2 + 32;
/** Top of the ship card, from the bottom of the screen: the turntable sits above it. */
const SHIP_INFO_TOP = SHIP_CARD_BOTTOM + SHIP_CARD_HEIGHT + 14;

interface Swatch {
  paint: PaintId;
  node: Node;
  gfx: Graphics;
}

export class HangarPage implements MenuPage {
  readonly root: Node;
  readonly logo = false;
  private tab: Tab = 'ship';
  private readonly shipPose: ShipPose = { row: 0.4, scale: 1.1 };
  /** Ship on the turntable: the flown one, or a locked one being looked at. */
  private browsed: ShipId = 'spitfire';
  private readonly tabs: { id: Tab; gfx: Graphics; label: Label }[] = [];
  private readonly panels: Record<Tab, Node>;
  private readonly rows: UpgradeRow[] = [];
  private readonly shipCard: ShipCard;
  /** Under the card of a locked ship, where its paints would be: how to unlock it. */
  private readonly shipLocked: Label;
  private readonly swatches: Swatch[] = [];
  private readonly weapons: WeaponsPanel;
  private readonly launchLabel: Label;

  constructor(parent: Node, private readonly host: MenuHost) {
    const font = host.font;
    this.root = pageRoot(parent, 'HangarPage');
    pageHeader(this.root, 'HANGAR', host);

    TABS.forEach((t, i) => {
      const node = uiNode(this.root, `Tab-${t.id}`, TAB_WIDTH, TAB_HEIGHT, { top: TABS_TOP, centerX: true, dx: (i - 1) * (TAB_WIDTH + 12) });
      const gfx = node.addComponent(Graphics);
      const label = uiLabel(node, 'Label', 24, UI.white, {}, font);
      label.string = t.label;
      placeLabel(label, 0, 0);
      onTap(node, () => this.showTab(t.id), 'uiTab');
      this.tabs.push({ id: t.id, gfx, label });
    });
    const panel = (name: string): Node => uiNode(this.root, name, 0, 0, { top: 0, bottom: 0, left: 0, right: 0 });
    this.panels = { ship: panel('ShipTab'), systems: panel('SystemsTab'), weapons: panel('WeaponsTab') };

    // SHIP: arrows either side of the turntable, the ship card, then the paints.
    const ship = this.panels.ship;
    for (const dir of [-1, 1]) {
      // Level with the turntable, which sits halfway between the tabs and the ship's name.
      const dy = (SHIP_INFO_TOP - CONTENT_TOP) / 2;
      const arrow = uiNode(ship, dir < 0 ? 'Prev' : 'Next', 84, 120, dir < 0 ? { centerY: true, dy, left: 16 } : { centerY: true, dy, right: 16 });
      const g = arrow.addComponent(Graphics);
      drawButton(g, 84, 120, false);
      drawChevron(g, 0, 0, 40, dir, UI.white);
      onTap(arrow, () => this.browse(dir));
    }
    this.shipCard = new ShipCard(ship, SHIP_CARD_BOTTOM, font);
    this.shipLocked = uiLabel(ship, 'Unlock', 22, UI.danger, { bottom: SWATCH_BOTTOM + SWATCH_R - 4, centerX: true }, font);
    PAINT_ORDER.forEach((paint, i) => {
      const node = uiNode(ship, `Paint-${paint}`, SWATCH_R * 2 + 16, SWATCH_R * 2 + 16, { bottom: SWATCH_BOTTOM, centerX: true, dx: (i - (PAINT_ORDER.length - 1) / 2) * SWATCH_GAP });
      const gfx = node.addComponent(Graphics);
      onTap(node, () => this.paint(paint));
      this.swatches.push({ paint, node, gfx });
    });

    // SYSTEMS: one row per upgrade.
    const onBuy = (id: UpgradeId): void => this.buy(id);
    UPGRADE_ORDER.filter((id) => UPGRADES[id].group === 'systems').forEach((id, i) => {
      this.rows.push(new UpgradeRow(this.panels.systems, UPGRADES[id], CONTENT_TOP + i * (ROW_HEIGHT + ROW_GAP), font, onBuy));
    });

    // WEAPONS: the four slots and their arsenal.
    this.weapons = new WeaponsPanel(this.panels.weapons, CONTENT_TOP, font, host.unlockAll, {
      buy: onBuy,
      equip: (id) => this.equip(id),
    });

    const launch = uiNode(this.root, 'Launch', 600, 100, { bottom: 44, centerX: true });
    drawButton(launch.addComponent(Graphics), 600, 100, true);
    this.launchLabel = uiLabel(launch, 'Label', 28, UI.white, {}, font);
    placeLabel(this.launchLabel, 0, 0);
    onTap(launch, () => host.launch(), null);
  }

  get pose(): ShipPose | null {
    if (this.tab !== 'ship') return null;
    // Centre the turntable between the tabs and the ship's name on any screen height.
    const h = view.getVisibleSize().height;
    this.shipPose.row = (CONTENT_TOP + h - SHIP_INFO_TOP) / 2 / h;
    return this.shipPose;
  }

  enter(): void {
    this.browsed = SaveService.shipToFly(this.host.unlockAll);
    this.launchLabel.string = `LAUNCH  ${pickLabel(this.host.pick.mission, this.host.pick.difficulty)}`;
    this.showTab(this.tab);
  }

  key(code: KeyCode): boolean {
    if (code === KeyCode.ENTER) {
      this.host.launch();
      return true;
    }
    if (code === KeyCode.TAB) {
      const i = TABS.findIndex((t) => t.id === this.tab);
      this.showTab(TABS[(i + 1) % TABS.length].id);
      return true;
    }
    if (code === KeyCode.ARROW_LEFT || code === KeyCode.ARROW_RIGHT) {
      const dir = code === KeyCode.ARROW_LEFT ? -1 : 1;
      if (this.tab === 'ship') this.browse(dir);
      else if (this.tab === 'weapons') this.weapons.step(dir);
      else return false;
      return true;
    }
    return false;
  }

  private showTab(tab: Tab): void {
    this.tab = tab;
    for (const t of this.tabs) {
      drawButton(t.gfx, TAB_WIDTH, TAB_HEIGHT, t.id === tab);
      t.label.color = t.id === tab ? UI.white : UI.dim;
    }
    for (const id of Object.keys(this.panels) as Tab[]) this.panels[id].active = id === tab;
    this.refresh();
    // The turntable shows only on the SHIP tab; StartScreen reads `pose` every frame.
    this.host.showShip(this.browsed, SaveService.paintOf(this.browsed));
  }

  private refresh(): void {
    for (const row of this.rows) row.refresh();
    this.weapons.refresh();
    this.refreshShip();
  }

  private isOpen(ship: ShipId): boolean {
    return this.host.unlockAll || shipUnlocked(SaveService.records, SHIPS[ship]);
  }

  private refreshShip(): void {
    const def = SHIPS[this.browsed];
    const open = this.isOpen(this.browsed);
    // Compared with the ship being flown; a locked one being looked at shows what it would change.
    const flownId = SaveService.shipToFly(this.host.unlockAll);
    const flown = flownId === this.browsed ? null : shipStats(SHIPS[flownId], SaveService.loadout(flownId));
    // What opens it, with the progress: "TO UNLOCK: CLEAR MISSION 1-3", "… EARN 12 MEDALS  ·  5 / 12".
    const locked = open ? null : def.unlock ? `TO UNLOCK: ${unlockHint(SaveService.records, def.unlock)}` : 'LOCKED';
    this.shipCard.show(def, SaveService.loadout(this.browsed), flown, locked);
    this.shipLocked.node.active = locked !== null;
    this.shipLocked.string = locked ?? '';
    const current = SaveService.paintOf(this.browsed);
    for (const s of this.swatches) {
      const g = s.gfx;
      g.clear();
      g.fillColor = toColor(PAINTS[s.paint].swatch);
      g.circle(0, 0, SWATCH_R);
      g.fill();
      if (s.paint === current) {
        g.lineWidth = 5;
        g.strokeColor = UI.white;
        g.circle(0, 0, SWATCH_R + 8);
        g.stroke();
      }
      s.node.active = open;
    }
  }

  private browse(dir: number): void {
    const i = (SHIP_ORDER.indexOf(this.browsed) + dir + SHIP_ORDER.length) % SHIP_ORDER.length;
    this.browsed = SHIP_ORDER[i];
    // An open ship becomes the one you fly; a locked one is only looked at.
    if (this.isOpen(this.browsed)) SaveService.selectShip(this.browsed);
    this.refresh();
    this.host.showShip(this.browsed, SaveService.paintOf(this.browsed));
  }

  private paint(paint: PaintId): void {
    if (!this.isOpen(this.browsed)) return;
    SaveService.setPaint(this.browsed, paint);
    this.refreshShip();
    this.host.showShip(this.browsed, paint);
  }

  private buy(id: UpgradeId): void {
    const result = SaveService.buy(id, this.host.unlockAll);
    AudioService.play(result === 'bought' ? 'uiBuy' : 'uiDenied');
    if (result === 'poor') this.host.walletDenied();
    if (result !== 'bought') return;
    this.host.walletChanged();
    this.refresh();
  }

  private equip(id: ArsenalId): void {
    const result = SaveService.equip(id);
    if (result === 'equipped' || result === 'unequipped') {
      AudioService.play('uiEquip');
      this.weapons.refresh();
    }
  }
}
