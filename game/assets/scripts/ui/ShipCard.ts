// The hangar's ship card (GDD §17): name and role with a status chip, a table of stats — label,
// pips or a bar, value and the difference from the ship being flown (green ▲ / red ▼, signed, so
// colour is never the only cue) — and a row of trait cells for what sets the ship apart. Numbers
// come from core/shipCard.ts.

import { Color, Graphics, Label, Node, TTFFont } from 'cc';
import { shipStats, shipTraits, statDelta, type ShipStat, type ShipStatId, type ShipTraitId } from '../core/shipCard';
import type { Loadout, PlayerShipDef } from '../data/types';
import { drawCard, drawLock, placeLabel, UI, uiLabel, uiNode } from './UiKit';

export const SHIP_CARD_WIDTH = 640;
export const SHIP_CARD_HEIGHT = 352;

const LEFT = -SHIP_CARD_WIDTH / 2 + 26;
const RIGHT = SHIP_CARD_WIDTH / 2 - 26;
const TOP = SHIP_CARD_HEIGHT / 2;
const NAME_Y = TOP - 38;
const ROLE_Y = TOP - 74;
const TABLE_TOP = TOP - 94;
const ROW_HEIGHT = 40;
const ROWS = 4;
const BAR_X = -148;
const BAR_WIDTH = 236;
const BAR_HEIGHT = 14;
const PIP_GAP = 4;
const VALUE_X = 190;
/** The ▲/▼ of a difference, and its text to the right of it. */
const ARROW_X = 210;
const DELTA_X = 224;
const CELLS_TOP = TABLE_TOP - ROWS * ROW_HEIGHT - 12;
const CELL_HEIGHT = 66;
const CELL_GAP = 12;
const CHIP_HEIGHT = 40;

const STAT_COLORS: Record<ShipStatId, Color> = {
  hull: UI.accent,
  shield: UI.shield,
  speed: new Color(200, 225, 255, 255),
  firepower: new Color(255, 130, 90, 255),
};
const EMPTY = new Color(28, 38, 62, 255);
/** Row labels and trait captions: quieter than values, still readable on a phone. */
const LABEL = new Color(150, 170, 200, 255);
const RULE = new Color(40, 60, 90, 160);
const CELL_BACK = new Color(16, 30, 54, 230);
const CHIP_READY = new Color(16, 50, 34, 230);
const CHIP_LOCKED = new Color(54, 16, 18, 230);

interface StatRow {
  label: Label;
  value: Label;
  delta: Label;
}

interface TraitCell {
  value: Label;
  caption: Label;
}

export class ShipCard {
  readonly node: Node;
  private readonly gfx: Graphics;
  private readonly name: Label;
  private readonly role: Label;
  private readonly chip: Label;
  private readonly rows: StatRow[] = [];
  private readonly cells: TraitCell[] = [];

  constructor(parent: Node, bottom: number, font: TTFFont | null) {
    this.node = uiNode(parent, 'ShipCard', SHIP_CARD_WIDTH, SHIP_CARD_HEIGHT, { bottom, centerX: true });
    this.gfx = this.node.addComponent(Graphics);
    this.name = uiLabel(this.node, 'Name', 36, UI.white, {}, font);
    placeLabel(this.name, LEFT, NAME_Y, 'left');
    this.role = uiLabel(this.node, 'Role', 20, UI.accent, {}, font);
    placeLabel(this.role, LEFT, ROLE_Y, 'left');
    this.chip = uiLabel(this.node, 'Status', 17, UI.success, {}, font);
    this.chip.outlineWidth = 2;
    for (let i = 0; i < ROWS; i++) {
      const y = this.rowY(i);
      const label = uiLabel(this.node, `Stat${i}`, 19, LABEL, {}, font);
      placeLabel(label, LEFT, y, 'left');
      const value = uiLabel(this.node, `Value${i}`, 22, UI.white, {}, font);
      placeLabel(value, VALUE_X, y, 'right');
      const delta = uiLabel(this.node, `Delta${i}`, 19, UI.success, {}, font);
      placeLabel(delta, DELTA_X, y, 'left');
      this.rows.push({ label, value, delta });
    }
    for (let i = 0; i < 3; i++) {
      const value = uiLabel(this.node, `Trait${i}`, 23, UI.white, {}, font);
      const caption = uiLabel(this.node, `TraitCaption${i}`, 14, LABEL, {}, font);
      caption.outlineWidth = 2;
      this.cells.push({ value, caption });
    }
  }

  /**
   * Shows a ship with the player's upgrades. `flown`: the stats of the ship being flown, to compare
   * against (null when this is it). `lockedText`: why it is closed, or null when it can be flown.
   */
  show(ship: PlayerShipDef, loadout: Loadout, flown: readonly ShipStat[] | null, lockedText: string | null): void {
    const g = this.gfx;
    drawCard(g, SHIP_CARD_WIDTH, SHIP_CARD_HEIGHT, null, lockedText !== null);
    this.name.string = ship.name;
    this.role.string = ship.role;
    this.drawChip(g, lockedText === null);

    // Table: rules between the rows.
    g.lineWidth = 1.5;
    g.strokeColor = RULE;
    for (let i = 0; i <= ROWS; i++) {
      const y = TABLE_TOP - i * ROW_HEIGHT;
      g.moveTo(LEFT, y);
      g.lineTo(RIGHT, y);
    }
    g.stroke();
    const stats = shipStats(ship, loadout);
    // Pips are the same size in every row: one unit of hull looks like one unit of shield.
    let pips = 1;
    for (const s of stats) if (s.pips) pips = Math.max(pips, s.max);
    const pip = (BAR_WIDTH - (pips - 1) * PIP_GAP) / pips;
    stats.forEach((stat, i) => {
      const row = this.rows[i];
      const base = flown ? flown[i] : null;
      const delta = base ? statDelta(stat, base) : { sign: 0, text: '' };
      row.label.string = stat.label;
      row.value.string = stat.text;
      row.delta.string = delta.text;
      row.delta.color = delta.sign > 0 ? UI.success : UI.danger;
      const y = this.rowY(i);
      if (stat.pips) this.drawPips(g, stat, base, y, pip);
      else this.drawBar(g, stat, base, y);
      if (delta.sign !== 0) drawArrow(g, ARROW_X, y, delta.sign);
    });

    // Traits: one cell each, sharing the card's width.
    const traits = shipTraits(ship);
    const n = Math.max(1, traits.length);
    const width = (RIGHT - LEFT - (n - 1) * CELL_GAP) / n;
    const cy = CELLS_TOP - CELL_HEIGHT / 2;
    this.cells.forEach((cell, i) => {
      const trait = traits[i];
      cell.value.node.active = cell.caption.node.active = trait !== undefined;
      if (!trait) return;
      const x0 = LEFT + i * (width + CELL_GAP);
      g.fillColor = CELL_BACK;
      g.roundRect(x0, cy - CELL_HEIGHT / 2, width, CELL_HEIGHT, 12);
      g.fill();
      g.lineWidth = 2;
      g.strokeColor = RULE;
      g.roundRect(x0, cy - CELL_HEIGHT / 2, width, CELL_HEIGHT, 12);
      g.stroke();
      drawTrait(g, trait.id, x0 + 27, cy, UI.accent);
      cell.value.string = trait.value;
      placeLabel(cell.value, x0 + 52, cy + 13, 'left');
      cell.caption.string = trait.caption;
      placeLabel(cell.caption, x0 + 52, cy - 16, 'left');
    });
  }

  private rowY(i: number): number {
    return TABLE_TOP - (i + 0.5) * ROW_HEIGHT;
  }

  /** Status chip in the top right corner: READY TO FLY or a padlock and LOCKED. */
  private drawChip(g: Graphics, ready: boolean): void {
    const width = ready ? 178 : 132;
    const x = RIGHT - width;
    const y = NAME_Y - CHIP_HEIGHT / 2 - 16;
    g.fillColor = ready ? CHIP_READY : CHIP_LOCKED;
    g.roundRect(x, y, width, CHIP_HEIGHT, CHIP_HEIGHT / 2);
    g.fill();
    g.lineWidth = 2;
    g.strokeColor = ready ? UI.success : UI.danger;
    g.roundRect(x, y, width, CHIP_HEIGHT, CHIP_HEIGHT / 2);
    g.stroke();
    const cy = y + CHIP_HEIGHT / 2;
    if (!ready) drawLock(g, x + 26, cy, 20, UI.danger);
    this.chip.string = ready ? 'READY TO FLY' : 'LOCKED';
    this.chip.color = ready ? UI.success : UI.danger;
    placeLabel(this.chip, ready ? x + width / 2 : x + 44, cy, ready ? 'center' : 'left');
  }

  /** One pip per unit; against the flown ship, extra pips are green and missing ones red outlines. */
  private drawPips(g: Graphics, stat: ShipStat, base: ShipStat | null, y: number, size: number): void {
    const color = STAT_COLORS[stat.id];
    const from = base ? Math.min(base.value, stat.value) : stat.value;
    for (let i = 0; i < stat.max; i++) {
      const x = BAR_X + i * (size + PIP_GAP);
      const filled = i < stat.value;
      const gained = filled && i >= from;
      const lost = !filled && base !== null && i < base.value;
      g.fillColor = gained ? UI.success : filled ? color : EMPTY;
      g.roundRect(x, y - BAR_HEIGHT / 2, size, BAR_HEIGHT, 3);
      g.fill();
      if (lost) {
        g.lineWidth = 2;
        g.strokeColor = UI.danger;
        g.roundRect(x, y - BAR_HEIGHT / 2, size, BAR_HEIGHT, 3);
        g.stroke();
      }
    }
  }

  /** A continuous bar filled to value / max; the difference from the flown ship in green or red. */
  private drawBar(g: Graphics, stat: ShipStat, base: ShipStat | null, y: number): void {
    const fill = (v: number): number => BAR_WIDTH * Math.min(1, v / stat.max);
    const w = fill(stat.value);
    const b = base ? fill(base.value) : w;
    g.fillColor = EMPTY;
    g.roundRect(BAR_X, y - BAR_HEIGHT / 2, BAR_WIDTH, BAR_HEIGHT, 4);
    g.fill();
    g.fillColor = STAT_COLORS[stat.id];
    g.roundRect(BAR_X, y - BAR_HEIGHT / 2, Math.min(w, b), BAR_HEIGHT, 4);
    g.fill();
    if (w > b + 0.5) {
      g.fillColor = UI.success;
      g.rect(BAR_X + b, y - BAR_HEIGHT / 2, w - b, BAR_HEIGHT);
      g.fill();
    } else if (b > w + 0.5) {
      g.lineWidth = 2;
      g.strokeColor = UI.danger;
      g.rect(BAR_X + w, y - BAR_HEIGHT / 2, b - w, BAR_HEIGHT);
      g.stroke();
    }
  }
}

/** ▲ (better) or ▼ (worse). */
function drawArrow(g: Graphics, x: number, y: number, sign: number): void {
  const s = 7;
  g.fillColor = sign > 0 ? UI.success : UI.danger;
  g.moveTo(x - s, y - (sign * s) / 2);
  g.lineTo(x + s, y - (sign * s) / 2);
  g.lineTo(x, y + (sign * s * 3) / 4);
  g.close();
  g.fill();
}

/** Trait pictograms, ~36 units across, centred on (x, y). */
function drawTrait(g: Graphics, id: ShipTraitId, x: number, y: number, color: Color): void {
  g.strokeColor = color;
  g.fillColor = color;
  g.lineWidth = 3;
  switch (id) {
    case 'recovery':
      // Stopwatch.
      g.circle(x, y - 2, 13);
      g.moveTo(x, y - 2);
      g.lineTo(x, y + 6);
      g.moveTo(x, y - 2);
      g.lineTo(x + 6, y - 6);
      g.moveTo(x - 4, y + 15);
      g.lineTo(x + 4, y + 15);
      g.stroke();
      break;
    case 'reload': {
      // Circular arrow.
      g.arc(x, y, 12, Math.PI * 0.15, Math.PI * 1.75, true);
      g.stroke();
      const ax = x + 12 * Math.cos(Math.PI * 0.15);
      const ay = y + 12 * Math.sin(Math.PI * 0.15);
      g.moveTo(ax - 7, ay + 2);
      g.lineTo(ax + 2, ay + 9);
      g.lineTo(ax + 4, ay - 3);
      g.close();
      g.fill();
      break;
    }
    case 'graze':
      // A ring around the ship's core.
      g.circle(x, y, 14);
      g.stroke();
      g.circle(x, y, 4);
      g.fill();
      g.circle(x + 10, y + 10, 3);
      g.fill();
      break;
    case 'energy':
      // Lightning bolt.
      g.moveTo(x + 4, y + 16);
      g.lineTo(x - 9, y - 1);
      g.lineTo(x - 1, y - 1);
      g.lineTo(x - 4, y - 16);
      g.lineTo(x + 9, y + 3);
      g.lineTo(x + 1, y + 3);
      g.close();
      g.fill();
      break;
    case 'charges':
      // A charge with a plus.
      g.circle(x - 3, y - 3, 10);
      g.fill();
      g.moveTo(x + 9, y + 7);
      g.lineTo(x + 9, y + 17);
      g.moveTo(x + 4, y + 12);
      g.lineTo(x + 14, y + 12);
      g.stroke();
      break;
  }
}
