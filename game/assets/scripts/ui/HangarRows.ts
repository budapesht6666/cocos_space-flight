// Hangar list rows. UpgradeRow: a system upgrade (name, hint, current → next value, level pips,
// a BUY button with the price). ArsenalRow: a weapon, drone or Special — locked with its unlock
// condition, for sale (the licence), or owned with its level; tapping the card equips it.

import { Color, Graphics, Label, Node, TTFFont } from 'cc';
import { formatUpgradeValue, nextCost, upgradeLevel, upgradeUnlocked, upgradeValue } from '../core/economy';
import { droneSlots, isEquipped, owns } from '../core/loadout';
import { unlockHint } from '../core/progress';
import type { ArsenalId, DroneId, UpgradeDef, UpgradeId } from '../data/types';
import { SaveService } from '../services/SaveService';
import { drawButton, drawCard, drawCoin, drawLock, onTap, placeLabel, UI, uiLabel, uiNode } from './UiKit';

export const CARD_WIDTH = 640;
export const ROW_HEIGHT = 108;
export const ROW_GAP = 10;
const LEFT = -CARD_WIDTH / 2 + 24;
const BUY_WIDTH = 176;
const BUY_HEIGHT = 72;
const BUY_X = CARD_WIDTH / 2 - BUY_WIDTH / 2 - 16;
const PIP = 18;

const BUY_POOR = new Color(26, 30, 44, 230);
const PIP_ON = new Color(90, 200, 255, 255);

/** The BUY button: coin and price (dimmed when the wallet is short), or `done` (MAX, OWNED). */
function drawPrice(g: Graphics, price: Label, cost: number | null, done = 'MAX'): void {
  g.clear();
  if (cost === null) {
    price.string = done;
    price.color = UI.dim;
    placeLabel(price, 0, 0);
    return;
  }
  const affordable = SaveService.credits >= cost;
  if (affordable) drawButton(g, BUY_WIDTH, BUY_HEIGHT, false);
  else {
    g.fillColor = BUY_POOR;
    g.roundRect(-BUY_WIDTH / 2, -BUY_HEIGHT / 2, BUY_WIDTH, BUY_HEIGHT, 18);
    g.fill();
  }
  drawCoin(g, -BUY_WIDTH / 2 + 30, 0, 14);
  price.string = cost.toLocaleString('en-US');
  price.color = affordable ? UI.gold : UI.dim;
  placeLabel(price, 16, 0);
}

/** Level pips, right-aligned before the button: `level` of `max` lit. */
function drawPips(g: Graphics, level: number, max: number): void {
  g.clear();
  const x0 = BUY_X - BUY_WIDTH / 2 - 18 - max * (PIP + 6);
  for (let i = 0; i < max; i++) {
    g.fillColor = i < level ? PIP_ON : UI.faint;
    g.roundRect(x0 + i * (PIP + 6), 22, PIP, PIP, 4);
    g.fill();
  }
}

interface RowParts {
  node: Node;
  card: Graphics;
  name: Label;
  hint: Label;
  status: Label;
  pips: Graphics;
  buy: Node;
  buyGfx: Graphics;
  price: Label;
}

function buildRow(parent: Node, def: UpgradeDef, top: number, font: TTFFont | null, onBuy: (id: UpgradeId) => void): RowParts {
  const node = uiNode(parent, `Row-${def.id}`, CARD_WIDTH, ROW_HEIGHT, { top, centerX: true });
  const card = node.addComponent(Graphics);
  const name = uiLabel(node, 'Name', 24, UI.white, {}, font);
  name.string = def.name;
  placeLabel(name, LEFT, 30, 'left');
  const hint = uiLabel(node, 'Hint', 17, UI.dim, {}, font);
  hint.string = def.hint;
  placeLabel(hint, LEFT, 0, 'left');
  const status = uiLabel(node, 'Status', 20, UI.accent, {}, font);
  placeLabel(status, LEFT, -32, 'left');
  const pips = uiNode(node, 'Pips', 0, 0, {}).addComponent(Graphics);
  const buy = uiNode(node, 'Buy', BUY_WIDTH, BUY_HEIGHT, {});
  buy.setPosition(BUY_X, 0);
  const buyGfx = buy.addComponent(Graphics);
  const price = uiLabel(buy, 'Price', 24, UI.gold, {}, font);
  onTap(buy, () => onBuy(def.id), null);
  return { node, card, name, hint, status, pips, buy, buyGfx, price };
}

export class UpgradeRow {
  private readonly parts: RowParts;

  constructor(parent: Node, private readonly def: UpgradeDef, top: number, font: TTFFont | null, onBuy: (id: UpgradeId) => void) {
    this.parts = buildRow(parent, def, top, font, onBuy);
  }

  refresh(): void {
    const save = SaveService.data;
    const def = this.def;
    const p = this.parts;
    const level = upgradeLevel(save, def.id);
    const cost = nextCost(save, def.id);
    drawCard(p.card, CARD_WIDTH, ROW_HEIGHT);
    const now = formatUpgradeValue(def, upgradeValue(save, def.id));
    p.status.string = cost === null ? `${now}  ·  MAX` : `${now}  →  ${formatUpgradeValue(def, def.values[level + 1])}`;
    drawPips(p.pips, level, def.costs.length);
    drawPrice(p.buyGfx, p.price, cost);
  }
}

/**
 * An arsenal item. Locked: dim card, padlock, the condition. For sale: price of the licence.
 * Owned: level and pips, the next level's price; tap the card to equip (Secondary and drones
 * toggle). The equipped item has a bright edge.
 */
export class ArsenalRow {
  private readonly parts: RowParts;
  private readonly lock: Graphics;

  constructor(
    parent: Node,
    private readonly def: UpgradeDef,
    top: number,
    font: TTFFont | null,
    private readonly unlockAll: boolean,
    onBuy: (id: UpgradeId) => void,
    onEquip: (id: ArsenalId) => void,
  ) {
    this.parts = buildRow(parent, def, top, font, onBuy);
    // The card left of the button equips (a separate node, so a tap on BUY doesn't equip too).
    const hit = uiNode(this.parts.node, 'Equip', CARD_WIDTH - BUY_WIDTH - 32, ROW_HEIGHT, {});
    hit.setPosition(-CARD_WIDTH / 2 + (CARD_WIDTH - BUY_WIDTH - 32) / 2, 0);
    onTap(hit, () => onEquip(def.id as ArsenalId), null);
    this.lock = uiNode(this.parts.node, 'Lock', 0, 0, {}).addComponent(Graphics);
    this.lock.node.setPosition(BUY_X, 0);
  }

  refresh(): void {
    const save = SaveService.data;
    const def = this.def;
    const id = def.id as ArsenalId;
    const p = this.parts;
    const owned = owns(save, id);
    const open = owned || upgradeUnlocked(save, id, this.unlockAll);
    const equipped = owned && isEquipped(save, id);
    const cost = nextCost(save, id);
    const levels = def.values[def.values.length - 1];
    drawCard(p.card, CARD_WIDTH, ROW_HEIGHT, equipped ? UI.success : null, !open);
    p.name.color = open ? UI.white : UI.dim;
    this.lock.clear();
    p.buy.active = open;
    p.pips.clear();
    if (!open) {
      drawLock(this.lock, 0, 0, 40, UI.dim);
      p.status.string = `LOCKED  ·  ${def.unlock ? unlockHint(save.records, def.unlock) : ''}`;
      p.status.color = UI.dim;
      return;
    }
    drawPrice(p.buyGfx, p.price, cost, levels > 1 ? 'MAX' : 'OWNED');
    if (!owned) {
      p.status.string = 'FOR SALE';
      p.status.color = UI.accent;
      return;
    }
    const value = upgradeValue(save, id);
    if (levels > 1) drawPips(p.pips, value, levels);
    let state: string;
    if (equipped) state = def.group === 'drone' ? `SLOT ${save.equip.drones.indexOf(id as DroneId) + 1}` : 'EQUIPPED';
    else if (def.group === 'drone' && droneSlots(save) === 0) state = 'NEEDS A DRONE BAY';
    else state = def.group === 'secondary' || def.group === 'drone' ? 'TAP TO FIT' : 'TAP TO EQUIP';
    p.status.string = levels > 1 ? `${state}  ·  LV ${value}` : state;
    p.status.color = equipped ? UI.success : UI.accent;
  }
}
