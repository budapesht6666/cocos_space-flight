// Hangar (GDD §6, §7, §14): three tabs. SHIP — pick a ship and its paint on the turntable; SYSTEMS —
// hull, shield, generator, magnet, Nova charges, Energy gain, starting Power; WEAPONS — the four
// slots (Primary with its level; Secondary and Drones arrive with stage 5; Special). LAUNCH plays
// the mission picked on the main or mission page.

import { Color, Graphics, KeyCode, Label, Node, view } from 'cc';
import { formatUpgradeValue, nextCost, upgradeLevel, upgradeValue } from '../core/economy';
import { shipUnlocked } from '../core/progress';
import { SECTORS } from '../data/campaign';
import { UPGRADE_ORDER, UPGRADES } from '../data/economy';
import { PAINT_ORDER, PAINTS, SHIP_ORDER, SHIPS } from '../data/player';
import type { PaintId, ShipId, UpgradeDef, UpgradeId } from '../data/types';
import { toColor } from '../fx/RenderKit';
import { SaveService } from '../services/SaveService';
import { pickLabel } from './MenuPages';
import { HEADER_TOP, pageHeader, pageRoot, type MenuHost, type MenuPage, type ShipPose } from './MenuPage';
import { drawButton, drawCard, drawChevron, drawCoin, drawLock, onTap, placeLabel, UI, uiLabel, uiNode } from './UiKit';

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
const CARD_WIDTH = 640;
const LEFT = -CARD_WIDTH / 2 + 24;
const ROW_HEIGHT = 108;
const ROW_GAP = 10;
const BUY_WIDTH = 176;
const BUY_HEIGHT = 72;
const BUY_X = CARD_WIDTH / 2 - BUY_WIDTH / 2 - 16;
const PIP = 18;
const SWATCH_R = 30;
const SWATCH_GAP = 104;
/** Top of the ship name block, from the bottom of the screen: the turntable sits above it. */
const SHIP_INFO_TOP = 568;

const BUY_POOR = new Color(26, 30, 44, 230);
const PIP_ON = new Color(90, 200, 255, 255);

/** One upgrade: name, hint, current → next value, level pips and a BUY button with the price. */
class UpgradeRow {
  readonly node: Node;
  private readonly card: Graphics;
  private readonly value: Label;
  private readonly pips: Graphics;
  private readonly buy: Node;
  private readonly buyGfx: Graphics;
  private readonly price: Label;

  constructor(
    parent: Node,
    private readonly def: UpgradeDef,
    top: number,
    private readonly host: MenuHost,
    onBuy: (id: UpgradeId) => void,
  ) {
    const font = host.font;
    this.node = uiNode(parent, `Upgrade-${def.id}`, CARD_WIDTH, ROW_HEIGHT, { top, centerX: true });
    this.card = this.node.addComponent(Graphics);
    const name = uiLabel(this.node, 'Name', 24, UI.white, {}, font);
    name.string = def.name;
    placeLabel(name, LEFT, 30, 'left');
    const hint = uiLabel(this.node, 'Hint', 17, UI.dim, {}, font);
    hint.string = def.hint;
    placeLabel(hint, LEFT, 0, 'left');
    this.value = uiLabel(this.node, 'Value', 20, UI.accent, {}, font);
    placeLabel(this.value, LEFT, -32, 'left');
    this.pips = uiNode(this.node, 'Pips', 0, 0, {}).addComponent(Graphics);
    this.buy = uiNode(this.node, 'Buy', BUY_WIDTH, BUY_HEIGHT, {});
    this.buy.setPosition(BUY_X, 0);
    this.buyGfx = this.buy.addComponent(Graphics);
    this.price = uiLabel(this.buy, 'Price', 24, UI.gold, {}, font);
    onTap(this.buy, () => onBuy(def.id));
  }

  refresh(): void {
    const save = SaveService.data;
    const def = this.def;
    const level = upgradeLevel(save, def.id);
    const max = def.costs.length;
    const cost = nextCost(save, def.id);
    drawCard(this.card, CARD_WIDTH, ROW_HEIGHT);
    const now = formatUpgradeValue(def, upgradeValue(save, def.id));
    this.value.string = cost === null ? `${now}  ·  MAX` : `${now}  →  ${formatUpgradeValue(def, def.values[level + 1])}`;

    // Level pips, right-aligned before the button.
    const g = this.pips;
    g.clear();
    const x0 = BUY_X - BUY_WIDTH / 2 - 18 - max * (PIP + 6);
    for (let i = 0; i < max; i++) {
      g.fillColor = i < level ? PIP_ON : UI.faint;
      g.roundRect(x0 + i * (PIP + 6), 22, PIP, PIP, 4);
      g.fill();
    }

    const b = this.buyGfx;
    b.clear();
    if (cost === null) {
      this.price.string = 'MAX';
      this.price.color = UI.dim;
      placeLabel(this.price, 0, 0);
      return;
    }
    const affordable = SaveService.credits >= cost;
    if (affordable) drawButton(b, BUY_WIDTH, BUY_HEIGHT, false);
    else {
      b.fillColor = BUY_POOR;
      b.roundRect(-BUY_WIDTH / 2, -BUY_HEIGHT / 2, BUY_WIDTH, BUY_HEIGHT, 18);
      b.fill();
    }
    drawCoin(b, -BUY_WIDTH / 2 + 30, 0, 14);
    this.price.string = cost.toLocaleString('en-US');
    this.price.color = affordable ? UI.gold : UI.dim;
    placeLabel(this.price, 16, 0);
  }
}

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
  private readonly shipName: Label;
  private readonly shipRole: Label;
  private readonly shipPerks: Label;
  private readonly shipStatus: Label;
  private readonly swatches: Swatch[] = [];
  private readonly specialInfo: Label;
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
      onTap(node, () => this.showTab(t.id));
      this.tabs.push({ id: t.id, gfx, label });
    });
    const panel = (name: string): Node => uiNode(this.root, name, 0, 0, { top: 0, bottom: 0, left: 0, right: 0 });
    this.panels = { ship: panel('ShipTab'), systems: panel('SystemsTab'), weapons: panel('WeaponsTab') };

    // SHIP: arrows either side of the turntable, then name, role, perks, status and paints.
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
    this.shipName = uiLabel(ship, 'Name', 40, UI.white, { bottom: SHIP_INFO_TOP - 48, centerX: true }, font);
    this.shipRole = uiLabel(ship, 'Role', 22, UI.accent, { bottom: 484, centerX: true }, font);
    this.shipPerks = uiLabel(ship, 'Perks', 21, UI.white, { bottom: 330, centerX: true }, font);
    this.shipPerks.lineHeight = 34;
    this.shipStatus = uiLabel(ship, 'Status', 22, UI.success, { bottom: 286, centerX: true }, font);
    PAINT_ORDER.forEach((paint, i) => {
      const node = uiNode(ship, `Paint-${paint}`, SWATCH_R * 2 + 16, SWATCH_R * 2 + 16, { bottom: 168, centerX: true, dx: (i - (PAINT_ORDER.length - 1) / 2) * SWATCH_GAP });
      const gfx = node.addComponent(Graphics);
      onTap(node, () => this.paint(paint));
      this.swatches.push({ paint, node, gfx });
    });

    // SYSTEMS: one row per upgrade.
    const onBuy = (id: UpgradeId): void => this.buy(id);
    UPGRADE_ORDER.filter((id) => UPGRADES[id].group === 'systems').forEach((id, i) => {
      this.rows.push(new UpgradeRow(this.panels.systems, UPGRADES[id], CONTENT_TOP + i * (ROW_HEIGHT + ROW_GAP), host, onBuy));
    });

    // WEAPONS: the four slots.
    const weapons = this.panels.weapons;
    let top = CONTENT_TOP;
    const caption = (text: string): void => {
      const label = uiLabel(weapons, `Slot-${text}`, 20, UI.accent, { top, left: 46 }, font);
      label.string = text;
      top += 34;
    };
    caption('PRIMARY');
    for (const id of UPGRADE_ORDER.filter((u) => UPGRADES[u].group === 'weapons')) {
      this.rows.push(new UpgradeRow(weapons, UPGRADES[id], top, host, onBuy));
      top += ROW_HEIGHT + 22;
    }
    caption('SECONDARY');
    this.lockedSlot(weapons, top, 'Rockets, wing cannons and more', 'IN A LATER UPDATE');
    top += 96 + 22;
    caption('DRONES');
    this.lockedSlot(weapons, top, 'Gun, guardian and collector drones', 'IN A LATER UPDATE');
    top += 96 + 22;
    caption('SPECIAL');
    const special = uiNode(weapons, 'Special', CARD_WIDTH, 96, { top, centerX: true });
    drawCard(special.addComponent(Graphics), CARD_WIDTH, 96);
    const nova = uiLabel(special, 'Name', 24, UI.white, {}, font);
    nova.string = 'NOVA BOMB';
    placeLabel(nova, LEFT, 18, 'left');
    this.specialInfo = uiLabel(special, 'Info', 17, UI.dim, {}, font);
    placeLabel(this.specialInfo, LEFT, -18, 'left');

    const launch = uiNode(this.root, 'Launch', 600, 100, { bottom: 44, centerX: true });
    drawButton(launch.addComponent(Graphics), 600, 100, true);
    this.launchLabel = uiLabel(launch, 'Label', 28, UI.white, {}, font);
    placeLabel(this.launchLabel, 0, 0);
    onTap(launch, () => host.launch());
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
    if (this.tab === 'ship' && (code === KeyCode.ARROW_LEFT || code === KeyCode.ARROW_RIGHT)) {
      this.browse(code === KeyCode.ARROW_LEFT ? -1 : 1);
      return true;
    }
    return false;
  }

  private lockedSlot(parent: Node, top: number, text: string, status: string): void {
    const node = uiNode(parent, `Locked-${top}`, CARD_WIDTH, 96, { top, centerX: true });
    const g = node.addComponent(Graphics);
    drawCard(g, CARD_WIDTH, 96, null, true);
    drawLock(g, CARD_WIDTH / 2 - 52, 0, 44, UI.dim);
    const label = uiLabel(node, 'Text', 20, UI.dim, {}, this.host.font);
    label.string = text;
    placeLabel(label, LEFT, 16, 'left');
    const sub = uiLabel(node, 'Status', 17, UI.faint, {}, this.host.font);
    sub.string = status;
    placeLabel(sub, LEFT, -18, 'left');
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
    this.refreshShip();
    const l = SaveService.loadout(SaveService.shipToFly(this.host.unlockAll));
    this.specialInfo.string = `Clears the screen  ·  ${l.specialCharges} at start, holds ${l.maxCharges}`;
  }

  private isOpen(ship: ShipId): boolean {
    return this.host.unlockAll || shipUnlocked(SaveService.records, SHIPS[ship]);
  }

  private refreshShip(): void {
    const def = SHIPS[this.browsed];
    const open = this.isOpen(this.browsed);
    this.shipName.string = def.name;
    this.shipRole.string = def.role;
    const l = SaveService.loadout(this.browsed);
    this.shipPerks.string = `${def.perks.join('\n')}\nHULL ${l.hull}  ·  SHIELD ${l.shield}`;
    if (open) {
      this.shipStatus.string = 'READY TO FLY';
      this.shipStatus.color = UI.success;
    } else {
      const sector = def.unlock ? SECTORS[def.unlock.sector - 1] : null;
      this.shipStatus.string = sector ? `LOCKED  ·  DEFEAT ${sector.boss}` : 'LOCKED';
      this.shipStatus.color = UI.danger;
    }
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
    const result = SaveService.buy(id);
    if (result === 'poor') this.host.walletDenied();
    if (result !== 'bought') return;
    this.host.walletChanged();
    this.refresh();
  }
}
