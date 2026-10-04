// In-game HUD built in code under the scene Canvas: score and combo, hull / shield / credits,
// the Special and pause buttons, the boss bar, banners, and the pause and results panels.
// Setters only touch labels and redraw graphics when the shown value changes.

import { Color, Graphics, Label, Layers, Node, UITransform, Vec2, Widget } from 'cc';
import type { BannerStyle } from '../game/GameContext';
import type { MissionResult } from '../game/MissionDirector';
import type { ButtonId } from '../services/InputService';

const WHITE = new Color(235, 245, 255, 255);
const ACCENT = new Color(255, 196, 90, 255);
const DANGER = new Color(255, 90, 80, 255);
const SHIELD = new Color(90, 210, 255, 255);
const GOLD = new Color(255, 205, 80, 255);
const SUCCESS = new Color(120, 255, 170, 255);
const DIM = new Color(90, 100, 120, 255);
const OUTLINE = new Color(0, 0, 0, 190);
const PANEL = new Color(4, 8, 20, 190);
const BUTTON = new Color(20, 40, 70, 230);
const BUTTON_EDGE = new Color(90, 200, 255, 255);
const SPECIAL_READY = new Color(30, 90, 140, 220);
const SPECIAL_EMPTY = new Color(16, 24, 40, 200);
const SPECIAL_RIM = new Color(40, 60, 90, 255);
const BOSS_BACK = new Color(20, 10, 16, 220);
const BOSS_HP = new Color(255, 80, 70, 255);
const BOSS_HP_LOW = new Color(255, 170, 60, 255);
const DEBUG = new Color(160, 230, 160, 255);

const SPECIAL_RADIUS = 66;
const BOSS_BAR_WIDTH = 520;
const BOSS_BAR_HEIGHT = 14;

interface Anchor {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  centerX?: boolean;
  centerY?: boolean;
  /** Offset from the vertical centre, UI units (with centerY). */
  dy?: number;
}

interface Banner {
  title: Label;
  sub: Label;
  time: number;
  style: BannerStyle;
}

export class Hud {
  private readonly score: Label;
  private readonly combo: Label;
  private readonly hull: Label;
  private readonly shield: Label;
  private readonly credits: Label;
  private readonly specialNode: Node;
  private readonly specialGfx: Graphics;
  private readonly specialLabel: Label;
  private readonly pauseNode: Node;
  private readonly bossNode: Node;
  private readonly bossGfx: Graphics;
  private readonly bossName: Label;
  private readonly banner: Banner;
  private readonly pausePanel: Node;
  private readonly resumeButton: Node;
  private readonly restartButton: Node;
  private readonly resultsPanel: Node;
  private readonly resultsTitle: Label;
  private readonly resultsBody: Label;
  private readonly resultsHint: Label;
  private readonly hitPoint = new Vec2();
  private shown = { score: -1, combo: -1, hull: -1, hullMax: -1, shield: -1, shieldMax: -1, credits: -1, charges: -1, energy: -1, boss: -1 };
  private time = 0;

  constructor(private readonly root: Node) {
    this.score = this.label(root, 'Score', 46, WHITE, { top: 70, centerX: true });
    this.combo = this.label(root, 'Combo', 30, ACCENT, { top: 124, centerX: true });
    // Left column: the bottom of the screen is under the player's thumb.
    this.hull = this.label(root, 'Hull', 28, ACCENT, { top: 74, left: 28 });
    this.shield = this.label(root, 'Shield', 28, SHIELD, { top: 110, left: 28 });
    this.credits = this.label(root, 'Credits', 26, GOLD, { top: 146, left: 28 });

    this.pauseNode = this.node(root, 'PauseButton', 72, 72, { top: 64, right: 24 });
    const pauseGfx = this.pauseNode.addComponent(Graphics);
    pauseGfx.lineWidth = 4;
    pauseGfx.strokeColor = WHITE;
    pauseGfx.circle(0, 0, 30);
    pauseGfx.stroke();
    pauseGfx.fillColor = WHITE;
    pauseGfx.rect(-11, -13, 7, 26);
    pauseGfx.rect(4, -13, 7, 26);
    pauseGfx.fill();

    const size = SPECIAL_RADIUS * 2 + 16;
    this.specialNode = this.node(root, 'Special', size, size, { bottom: 70, right: 36 });
    this.specialGfx = this.specialNode.addComponent(Graphics);
    this.specialLabel = this.label(this.specialNode, 'SpecialLabel', 26, WHITE, {});
    this.specialLabel.node.setPosition(0, 0);

    this.bossNode = this.node(root, 'BossBar', BOSS_BAR_WIDTH, 60, { top: 178, centerX: true });
    this.bossGfx = this.bossNode.addComponent(Graphics);
    this.bossName = this.label(this.bossNode, 'BossName', 24, DANGER, {});
    this.bossName.node.setPosition(0, 22);
    this.bossNode.active = false;

    this.banner = {
      title: this.label(root, 'BannerTitle', 64, WHITE, { centerX: true, centerY: true, dy: 160 }),
      sub: this.label(root, 'BannerSub', 30, ACCENT, { centerX: true, centerY: true, dy: 100 }),
      time: 0,
      style: 'title',
    };
    this.banner.title.node.active = false;
    this.banner.sub.node.active = false;

    this.pausePanel = this.panel('PausePanel');
    this.label(this.pausePanel, 'PausedTitle', 64, WHITE, { centerX: true, centerY: true, dy: 170 }).string = 'PAUSED';
    this.resumeButton = this.button(this.pausePanel, 'RESUME', 30);
    this.restartButton = this.button(this.pausePanel, 'RESTART', -90);
    this.pausePanel.active = false;

    this.resultsPanel = this.panel('ResultsPanel');
    this.resultsTitle = this.label(this.resultsPanel, 'ResultsTitle', 54, SUCCESS, { centerX: true, centerY: true, dy: 300 });
    this.resultsBody = this.label(this.resultsPanel, 'ResultsBody', 30, WHITE, { centerX: true, centerY: true, dy: 20 });
    this.resultsBody.lineHeight = 46;
    this.resultsHint = this.label(this.resultsPanel, 'ResultsHint', 30, ACCENT, { centerX: true, centerY: true, dy: -300 });
    this.resultsPanel.active = false;
  }

  // ---- per-frame state --------------------------------------------------------------------------

  setScore(score: number): void {
    if (score === this.shown.score) return;
    this.shown.score = score;
    this.score.string = score.toLocaleString('en-US');
  }

  setCombo(multiplier: number): void {
    if (multiplier === this.shown.combo) return;
    this.shown.combo = multiplier;
    this.combo.node.active = multiplier > 1;
    this.combo.string = `×${multiplier}`;
  }

  setHull(hull: number, max: number): void {
    if (hull === this.shown.hull && max === this.shown.hullMax) return;
    this.shown.hull = hull;
    this.shown.hullMax = max;
    this.hull.string = `HULL ${cells(hull, max)}`;
    this.hull.color = hull <= 1 ? DANGER : ACCENT;
  }

  setShield(shield: number, max: number): void {
    if (shield === this.shown.shield && max === this.shown.shieldMax) return;
    this.shown.shield = shield;
    this.shown.shieldMax = max;
    this.shield.node.active = max > 0;
    this.shield.string = `SHLD ${cells(shield, max)}`;
  }

  setCredits(credits: number): void {
    if (credits === this.shown.credits) return;
    this.shown.credits = credits;
    this.credits.string = `CR ${credits.toLocaleString('en-US')}`;
  }

  /** Special button: charges in the middle, Energy as a ring around it. */
  setSpecial(charges: number, energy: number): void {
    const e = Math.round(energy * 100) / 100;
    if (charges === this.shown.charges && e === this.shown.energy) return;
    this.shown.charges = charges;
    this.shown.energy = e;
    const g = this.specialGfx;
    const ready = charges > 0;
    g.clear();
    g.fillColor = ready ? SPECIAL_READY : SPECIAL_EMPTY;
    g.circle(0, 0, SPECIAL_RADIUS - 8);
    g.fill();
    g.lineWidth = 8;
    g.strokeColor = SPECIAL_RIM;
    g.circle(0, 0, SPECIAL_RADIUS);
    g.stroke();
    if (e > 0) {
      g.strokeColor = e >= 1 ? GOLD : SHIELD;
      // Clockwise from the top.
      g.arc(0, 0, SPECIAL_RADIUS, Math.PI / 2, Math.PI / 2 - Math.PI * 2 * Math.min(1, e), false);
      g.stroke();
    }
    this.specialLabel.string = `NOVA\n${charges > 0 ? '●'.repeat(charges) : '–'}`;
    this.specialLabel.color = ready ? WHITE : DIM;
  }

  /** Boss bar with phase marks; `name` null hides it. */
  setBoss(name: string | null, fraction: number): void {
    if (name === null) {
      if (this.bossNode.active) this.bossNode.active = false;
      this.shown.boss = -1;
      return;
    }
    const f = Math.max(0, Math.round(fraction * 200) / 200);
    if (this.bossNode.active && f === this.shown.boss) return;
    this.bossNode.active = true;
    this.shown.boss = f;
    this.bossName.string = name;
    const g = this.bossGfx;
    const x0 = -BOSS_BAR_WIDTH / 2;
    const y0 = -BOSS_BAR_HEIGHT / 2 - 6;
    g.clear();
    g.fillColor = BOSS_BACK;
    g.rect(x0 - 3, y0 - 3, BOSS_BAR_WIDTH + 6, BOSS_BAR_HEIGHT + 6);
    g.fill();
    g.fillColor = f > 0.33 ? BOSS_HP : BOSS_HP_LOW;
    g.rect(x0, y0, BOSS_BAR_WIDTH * f, BOSS_BAR_HEIGHT);
    g.fill();
    g.fillColor = WHITE;
    for (const mark of [0.33, 0.66]) g.rect(x0 + BOSS_BAR_WIDTH * mark - 1, y0 - 3, 2, BOSS_BAR_HEIGHT + 6);
    g.fill();
  }

  showBanner(text: string, sub: string, style: BannerStyle, time: number): void {
    const b = this.banner;
    b.title.string = text;
    b.sub.string = sub;
    b.title.color = style === 'warning' ? DANGER : style === 'success' ? SUCCESS : WHITE;
    b.sub.color = style === 'warning' ? DANGER : ACCENT;
    b.title.node.active = true;
    b.sub.node.active = sub.length > 0;
    b.time = time;
    b.style = style;
  }

  /** Banner timing and blinking. */
  tick(dt: number): void {
    this.time += dt;
    const b = this.banner;
    if (b.time <= 0) return;
    b.time -= dt;
    if (b.time <= 0) {
      b.title.node.active = false;
      b.sub.node.active = false;
      return;
    }
    if (b.style === 'warning') b.title.node.active = Math.floor(this.time * 4) % 2 === 0;
  }

  /** Gameplay HUD visibility (hidden on the results screen). */
  setPlaying(playing: boolean): void {
    this.specialNode.active = playing;
    this.pauseNode.active = playing;
  }

  showPause(visible: boolean): void {
    this.pausePanel.active = visible;
  }

  showResults(r: MissionResult | null): void {
    this.resultsPanel.active = r !== null;
    if (!r) return;
    this.banner.time = 0;
    this.banner.title.node.active = false;
    this.banner.sub.node.active = false;
    this.resultsTitle.string = r.complete ? 'MISSION COMPLETE' : 'MISSION FAILED';
    this.resultsTitle.color = r.complete ? SUCCESS : DANGER;
    const rate = r.spawned > 0 ? Math.round((r.kills / r.spawned) * 100) : 0;
    const lines = [
      `SCORE  ${r.score.toLocaleString('en-US')}`,
      `CREDITS  ${r.credits.toLocaleString('en-US')}`,
      `KILLS  ${r.kills}/${r.spawned}  (${rate}%)`,
      `BEST COMBO  ×${r.bestMultiplier}`,
      `GRAZES  ${r.grazes}`,
      `HULL LOST  ${r.hullLost}`,
    ];
    if (r.shieldBonus > 0) lines.push(`SHIELD BONUS  +${r.shieldBonus.toLocaleString('en-US')}`);
    if (r.noDamageBonus > 0) lines.push(`NO DAMAGE  +${r.noDamageBonus.toLocaleString('en-US')}`);
    this.resultsBody.string = lines.join('\n');
    this.resultsHint.string = 'Tap to play again';
  }

  /** Which on-screen button is under a UI-space point (for InputService). */
  hitTest(x: number, y: number): ButtonId | null {
    this.hitPoint.set(x, y);
    if (this.pausePanel.active) {
      if (this.contains(this.resumeButton)) return 'resume';
      if (this.contains(this.restartButton)) return 'restart';
      return null;
    }
    if (this.resultsPanel.active) return null;
    if (this.specialNode.active && this.contains(this.specialNode)) return 'special';
    if (this.pauseNode.active && this.contains(this.pauseNode)) return 'pause';
    return null;
  }

  /** Small extra label for debug info, below the left column. */
  debugLabel(): Label {
    const label = this.label(this.root, 'Debug', 22, DEBUG, { top: 236, left: 16 });
    // Keep it under the panels.
    label.node.setSiblingIndex(this.pausePanel.getSiblingIndex());
    return label;
  }

  // ---- building blocks --------------------------------------------------------------------------

  private contains(node: Node): boolean {
    const t = node.getComponent(UITransform);
    return t !== null && t.getBoundingBoxToWorld().contains(this.hitPoint);
  }

  private panel(name: string): Node {
    const node = this.node(this.root, name, 0, 0, { top: 0, bottom: 0, left: 0, right: 0 });
    const g = node.addComponent(Graphics);
    g.fillColor = PANEL;
    // Oversized so it covers any screen shape without depending on the layout pass.
    g.rect(-3000, -3000, 6000, 6000);
    g.fill();
    return node;
  }

  private button(parent: Node, text: string, dy: number): Node {
    const node = this.node(parent, text, 360, 92, { centerX: true, centerY: true, dy });
    const g = node.addComponent(Graphics);
    g.fillColor = BUTTON;
    g.roundRect(-180, -46, 360, 92, 18);
    g.fill();
    g.lineWidth = 3;
    g.strokeColor = BUTTON_EDGE;
    g.roundRect(-180, -46, 360, 92, 18);
    g.stroke();
    const label = this.label(node, `${text}Label`, 34, WHITE, {});
    label.string = text;
    label.node.setPosition(0, 0);
    return node;
  }

  private node(parent: Node, name: string, width: number, height: number, anchor: Anchor): Node {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    parent.addChild(node);
    node.addComponent(UITransform).setContentSize(width, height);
    this.align(node, anchor);
    return node;
  }

  private label(parent: Node, name: string, size: number, color: Color, anchor: Anchor): Label {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    parent.addChild(node);
    const transform = node.addComponent(UITransform);
    // Edge-anchored labels grow away from their edge when the text changes length.
    if (anchor.left !== undefined) transform.setAnchorPoint(0, 0.5);
    else if (anchor.right !== undefined) transform.setAnchorPoint(1, 0.5);
    const label = node.addComponent(Label);
    label.fontSize = size;
    label.lineHeight = Math.round(size * 1.2);
    label.color = color;
    label.isBold = true;
    label.horizontalAlign =
      anchor.left !== undefined ? Label.HorizontalAlign.LEFT : anchor.right !== undefined ? Label.HorizontalAlign.RIGHT : Label.HorizontalAlign.CENTER;
    label.enableOutline = true;
    label.outlineColor = OUTLINE;
    label.outlineWidth = 3;
    this.align(node, anchor);
    return label;
  }

  private align(node: Node, anchor: Anchor): void {
    if (Object.keys(anchor).length === 0) return;
    const widget = node.addComponent(Widget);
    if (anchor.top !== undefined) {
      widget.isAlignTop = true;
      widget.top = anchor.top;
    }
    if (anchor.bottom !== undefined) {
      widget.isAlignBottom = true;
      widget.bottom = anchor.bottom;
    }
    if (anchor.left !== undefined) {
      widget.isAlignLeft = true;
      widget.left = anchor.left;
    }
    if (anchor.right !== undefined) {
      widget.isAlignRight = true;
      widget.right = anchor.right;
    }
    if (anchor.centerX) widget.isAlignHorizontalCenter = true;
    if (anchor.centerY) {
      widget.isAlignVerticalCenter = true;
      widget.verticalCenter = anchor.dy ?? 0;
    }
  }
}

function cells(filled: number, max: number): string {
  let s = '';
  for (let i = 0; i < max; i++) s += i < filled ? (i > 0 ? ' ■' : '■') : i > 0 ? ' □' : '□';
  return s;
}
