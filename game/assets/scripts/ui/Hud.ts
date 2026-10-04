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

const BAR_EMPTY = new Color(22, 30, 50, 230);
const HULL_DIM = new Color(255, 196, 90, 200);
const DANGER_DIM = new Color(255, 90, 80, 200);
const SHIELD_DIM = new Color(90, 210, 255, 200);
const SHIELD_REGEN = new Color(90, 210, 255, 140);
const ICON_INK = new Color(10, 14, 26, 255);

/** Status block (top left): rows of icon + bar; the bars never grow past BAR_MAX_WIDTH. */
const ROW_HULL = -22;
const ROW_SHIELD = -64;
const ROW_CREDITS = -106;
const BAR_X = 50;
const BAR_HEIGHT = 18;
const BAR_GAP = 6;
const BAR_SEGMENT = 34;
const BAR_MAX_WIDTH = 210;

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
  private readonly bars: Graphics;
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
  private shown = { score: -1, combo: -1, hull: -1, hullMax: -1, shield: -1, shieldMax: -1, shieldFill: -1, credits: -1, charges: -1, energy: -1, boss: -1 };
  private time = 0;

  constructor(private readonly root: Node) {
    this.score = this.label(root, 'Score', 46, WHITE, { top: 70, centerX: true });
    this.combo = this.label(root, 'Combo', 30, ACCENT, { top: 124, centerX: true });
    // Status block, top left (the bottom of the screen is under the player's thumb): icons are
    // drawn once, bars redraw when the values change.
    const status = this.node(root, 'Status', BAR_X + BAR_MAX_WIDTH, 128, { top: 60, left: 24 });
    status.getComponent(UITransform)!.setAnchorPoint(0, 1);
    drawStatusIcons(this.node(status, 'Icons', 0, 0, {}).addComponent(Graphics));
    this.bars = this.node(status, 'Bars', 0, 0, {}).addComponent(Graphics);
    this.credits = this.label(status, 'Credits', 30, GOLD, {});
    this.credits.node.getComponent(UITransform)!.setAnchorPoint(0, 0.5);
    this.credits.horizontalAlign = Label.HorizontalAlign.LEFT;
    this.credits.node.setPosition(BAR_X, ROW_CREDITS);

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

  /** Hull and shield as segmented bars; the next shield segment fills up while it regenerates. */
  setVitals(hull: number, hullMax: number, shield: number, shieldMax: number, shieldFill: number): void {
    const fill = shield < shieldMax ? Math.round(shieldFill * 20) / 20 : 0;
    const v = this.shown;
    if (hull === v.hull && hullMax === v.hullMax && shield === v.shield && shieldMax === v.shieldMax && fill === v.shieldFill) return;
    v.hull = hull;
    v.hullMax = hullMax;
    v.shield = shield;
    v.shieldMax = shieldMax;
    v.shieldFill = fill;
    const g = this.bars;
    g.clear();
    const low = hull <= 1;
    drawSegments(g, ROW_HULL, hull, hullMax, 0, low ? DANGER : ACCENT, low ? DANGER_DIM : HULL_DIM);
    if (shieldMax > 0) drawSegments(g, ROW_SHIELD, shield, shieldMax, fill, SHIELD, SHIELD_DIM);
  }

  setCredits(credits: number): void {
    if (credits === this.shown.credits) return;
    this.shown.credits = credits;
    this.credits.string = credits.toLocaleString('en-US');
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

/** One row of bar segments: `filled` solid, the next one `partial` full, the rest empty. */
function drawSegments(g: Graphics, y: number, filled: number, max: number, partial: number, color: Color, dim: Color): void {
  const width = Math.min(BAR_SEGMENT, (BAR_MAX_WIDTH - BAR_GAP * (max - 1)) / max);
  const top = y - BAR_HEIGHT / 2;
  for (let i = 0; i < max; i++) {
    const x = BAR_X + i * (width + BAR_GAP);
    g.fillColor = i < filled ? color : BAR_EMPTY;
    g.roundRect(x, top, width, BAR_HEIGHT, 3);
    g.fill();
    if (i >= filled) {
      if (i === filled && partial > 0) {
        g.fillColor = SHIELD_REGEN;
        g.roundRect(x, top, width * partial, BAR_HEIGHT, 3);
        g.fill();
      }
      g.lineWidth = 2;
      g.strokeColor = dim;
      g.roundRect(x, top, width, BAR_HEIGHT, 3);
      g.stroke();
    }
  }
}

/** Hull: armour plate with a repair cross. Shield: crest. Credits: coin. Icon size ~34 UI units. */
function drawStatusIcons(g: Graphics): void {
  const k = 1.15;
  const cx = 18;
  // Hull: hexagonal plate.
  g.fillColor = ACCENT;
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    const x = cx + Math.cos(a) * 15 * k;
    const y = ROW_HULL + Math.sin(a) * 15 * k;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.close();
  g.fill();
  g.fillColor = ICON_INK;
  g.rect(cx - 3, ROW_HULL - 9, 6, 18);
  g.rect(cx - 9, ROW_HULL - 3, 18, 6);
  g.fill();

  // Shield: flat top, curved sides meeting in a point.
  const top = ROW_SHIELD + 16;
  g.fillColor = SHIELD;
  g.moveTo(cx - 15, top);
  g.lineTo(cx + 15, top);
  g.lineTo(cx + 15, top - 11);
  g.quadraticCurveTo(cx + 14, top - 27, cx, top - 34);
  g.quadraticCurveTo(cx - 14, top - 27, cx - 15, top - 11);
  g.close();
  g.fill();
  g.fillColor = ICON_INK;
  g.moveTo(cx, top - 5);
  g.lineTo(cx + 8, top - 8);
  g.lineTo(cx + 8, top - 15);
  g.quadraticCurveTo(cx + 7, top - 23, cx, top - 27);
  g.close();
  g.fill();

  // Credits: coin with an inner ring and a diamond.
  g.fillColor = GOLD;
  g.circle(cx, ROW_CREDITS, 16);
  g.fill();
  g.lineWidth = 3;
  g.strokeColor = ICON_INK;
  g.circle(cx, ROW_CREDITS, 11);
  g.stroke();
  g.fillColor = ICON_INK;
  g.moveTo(cx, ROW_CREDITS + 6.5);
  g.lineTo(cx + 4.5, ROW_CREDITS);
  g.lineTo(cx, ROW_CREDITS - 6.5);
  g.lineTo(cx - 4.5, ROW_CREDITS);
  g.close();
  g.fill();
}
