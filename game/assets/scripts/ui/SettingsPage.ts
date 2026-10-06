// Settings (GDD §17): music and effects volume, the ship's gun sounds (off by default), finger sensitivity, which hand holds the Special
// button, graphics quality (a tier; it never changes by itself) and an FPS counter; CREDITS at the bottom.
// Each row steps with ◀ ▶ (keys: ↑/↓ pick a row, ←/→ change it). Changes save at once and apply
// to the menu (volume, graphics); the rest takes effect in the next mission.

import { Color, Graphics, KeyCode, Label, Node } from 'cc';
import { stepSetting, type SettingId } from '../core/settings';
import { SETTINGS } from '../data/settings';
import type { Settings } from '../data/types';
import { AudioService } from '../services/AudioService';
import { SettingsService } from '../services/SettingsService';
import { HEADER_TOP, pageHeader, pageRoot, type MenuHost, type MenuPage } from './MenuPage';
import { drawButton, drawCard, drawChevron, onTap, placeLabel, UI, uiLabel, uiNode } from './UiKit';

const CARD_WIDTH = 640;
const LEFT = -CARD_WIDTH / 2 + 26;
const ROW_HEIGHT = 96;
const ROW_GAP = 12;
const ROWS_TOP = HEADER_TOP + 108;
const ARROW = 68;
const RIGHT_ARROW_X = CARD_WIDTH / 2 - 18 - ARROW / 2;
const VALUE_WIDTH = 200;
const VALUE_X = RIGHT_ARROW_X - ARROW / 2 - 8 - VALUE_WIDTH / 2;
const LEFT_ARROW_X = VALUE_X - VALUE_WIDTH / 2 - 8 - ARROW / 2;
const PIP_GAP = 4;
const HINT = new Color(140, 160, 190, 255);

const ROWS: readonly { id: SettingId; name: string; hint: string }[] = [
  { id: 'music', name: 'MUSIC', hint: 'Volume' },
  { id: 'sfx', name: 'SOUND FX', hint: 'Volume' },
  { id: 'gunSounds', name: 'GUN SOUNDS', hint: 'Your shots and beam' },
  { id: 'sensitivity', name: 'SENSITIVITY', hint: 'Ship travel per finger' },
  { id: 'handedness', name: 'CONTROLS', hint: 'Special button side' },
  { id: 'quality', name: 'GRAPHICS', hint: 'Lower it if the phone heats' },
  { id: 'showFps', name: 'SHOW FPS', hint: 'Counter in flight' },
];

interface Row {
  id: SettingId;
  gfx: Graphics;
  value: Label;
  pips: Graphics;
}

export class SettingsPage implements MenuPage {
  readonly root: Node;
  readonly pose = null;
  readonly logo = false;
  private readonly rows: Row[] = [];
  private selected = 0;

  constructor(parent: Node, private readonly host: MenuHost) {
    const font = host.font;
    this.root = pageRoot(parent, 'SettingsPage');
    pageHeader(this.root, 'SETTINGS', host);
    ROWS.forEach((r, i) => {
      const node = uiNode(this.root, `Row-${r.id}`, CARD_WIDTH, ROW_HEIGHT, { top: ROWS_TOP + i * (ROW_HEIGHT + ROW_GAP), centerX: true });
      const gfx = node.addComponent(Graphics);
      const name = uiLabel(node, 'Name', 26, UI.white, {}, font);
      name.string = r.name;
      placeLabel(name, LEFT, 15, 'left');
      const hint = uiLabel(node, 'Hint', 17, HINT, {}, font);
      hint.outlineWidth = 2;
      hint.string = r.hint;
      placeLabel(hint, LEFT, -21, 'left');
      const value = uiLabel(node, 'Value', 20, UI.accent, {}, font);
      value.lineHeight = 26;
      placeLabel(value, VALUE_X, 0);
      const pips = uiNode(node, 'Pips', 0, 0, {}).addComponent(Graphics);
      for (const dir of [-1, 1]) {
        const arrow = uiNode(node, dir < 0 ? 'Less' : 'More', ARROW, ARROW, {});
        arrow.setPosition(dir < 0 ? LEFT_ARROW_X : RIGHT_ARROW_X, 0);
        const g = arrow.addComponent(Graphics);
        drawButton(g, ARROW, ARROW, false);
        drawChevron(g, 0, 0, 26, dir, UI.white);
        onTap(arrow, () => this.step(i, dir), null);
      }
      this.rows.push({ id: r.id, gfx, value, pips });
    });

    const credits = uiNode(this.root, 'Credits', 320, 96, { bottom: 56, centerX: true });
    drawButton(credits.addComponent(Graphics), 320, 96, false);
    const label = uiLabel(credits, 'Label', 28, UI.white, {}, font);
    label.string = 'CREDITS';
    placeLabel(label, 0, 0);
    onTap(credits, () => host.open('credits'));
  }

  enter(): void {
    this.refresh();
  }

  key(code: KeyCode): boolean {
    if (code === KeyCode.ARROW_UP || code === KeyCode.ARROW_DOWN) {
      this.selected = (this.selected + (code === KeyCode.ARROW_UP ? -1 : 1) + ROWS.length) % ROWS.length;
      this.refresh();
      return true;
    }
    if (code === KeyCode.ARROW_LEFT || code === KeyCode.ARROW_RIGHT) {
      this.step(this.selected, code === KeyCode.ARROW_LEFT ? -1 : 1);
      return true;
    }
    return false;
  }

  private step(i: number, dir: number): void {
    this.selected = i;
    const id = this.rows[i].id;
    const next = stepSetting(SettingsService.current, id, dir);
    SettingsService.set(next);
    // The click is heard at the new volume.
    AudioService.play('uiTap');
    if (id === 'quality') this.host.graphicsChanged();
    this.refresh();
  }

  private refresh(): void {
    const s = SettingsService.current;
    this.rows.forEach((row, i) => {
      drawCard(row.gfx, CARD_WIDTH, ROW_HEIGHT, i === this.selected ? UI.buttonEdge : null);
      const g = row.pips;
      g.clear();
      const volume = row.id === 'music' || row.id === 'sfx';
      row.value.node.active = !volume;
      if (volume) drawVolume(g, s[row.id as 'music' | 'sfx']);
      else row.value.string = valueText(s, row.id);
    });
  }
}

/** Volume as a row of rising bars, lit up to the level. */
function drawVolume(g: Graphics, level: number): void {
  const n = SETTINGS.volumeSteps;
  const w = (VALUE_WIDTH - (n - 1) * PIP_GAP) / n;
  for (let i = 0; i < n; i++) {
    const h = 14 + (i * 26) / (n - 1);
    g.fillColor = i < level ? UI.accent : UI.faint;
    g.roundRect(VALUE_X - VALUE_WIDTH / 2 + i * (w + PIP_GAP), -20, w, h, 2);
    g.fill();
  }
}

function valueText(s: Readonly<Settings>, id: SettingId): string {
  switch (id) {
    case 'sensitivity':
      return `×${s.sensitivity.toFixed(1)}`;
    case 'handedness':
      return s.handedness === 'right' ? 'RIGHT HAND' : 'LEFT HAND';
    case 'quality':
      return s.quality.toUpperCase();
    case 'showFps':
      return s.showFps ? 'ON' : 'OFF';
    case 'gunSounds':
      return s.gunSounds ? 'ON' : 'OFF';
    default:
      return '';
  }
}
