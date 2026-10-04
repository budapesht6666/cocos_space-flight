// In-game HUD built in code under the scene Canvas: score and combo, hull / shield / credits /
// escape pods, the Special and pause buttons, the boss bar, banners, and the pause and results
// panels. Setters only touch labels and redraw graphics when the shown value changes.

import { Color, Graphics, Label, Node, TTFFont, UITransform } from 'cc';
import { hasMedal, MEDAL_BITS } from '../core/medals';
import { MEDALS } from '../data/medals';
import type { BannerStyle } from '../game/GameContext';
import type { MissionResult } from '../game/MissionDirector';
import type { ButtonId } from '../services/InputService';
import { contains, drawMedal, UI, uiButton, uiLabel, uiNode, uiPanel } from './UiKit';

const SPECIAL_READY = new Color(30, 90, 140, 220);
const SPECIAL_EMPTY = new Color(16, 24, 40, 200);
const SPECIAL_RIM = new Color(40, 60, 90, 255);
const BOSS_BACK = new Color(20, 10, 16, 220);
const BOSS_HP = new Color(255, 80, 70, 255);
const BOSS_HP_LOW = new Color(255, 170, 60, 255);
const BOSS_ARMORED = new Color(150, 165, 190, 255);
const DEBUG = new Color(160, 230, 160, 255);

const BAR_EMPTY = new Color(22, 30, 50, 230);
const HULL_DIM = new Color(255, 196, 90, 200);
const DANGER_DIM = new Color(255, 90, 80, 200);
const SHIELD_DIM = new Color(90, 210, 255, 200);
const SHIELD_REGEN = new Color(90, 210, 255, 140);

/** Status block (top left): rows of icon + bar; the bars never grow past BAR_MAX_WIDTH. */
const ROW_HULL = -22;
const ROW_SHIELD = -64;
const ROW_CREDITS = -106;
const BAR_X = 50;
/** Escape pods share the credits row, to the right. */
const PODS_X = 172;
const BAR_HEIGHT = 18;
const BAR_GAP = 6;
const BAR_SEGMENT = 34;
const BAR_MAX_WIDTH = 210;

const SPECIAL_RADIUS = 66;
const BOSS_BAR_WIDTH = 520;
const BOSS_BAR_HEIGHT = 14;

/** Results screen layout (offsets from the screen centre, UI units). */
const MEDAL_ROW_Y = 150;
const MEDAL_SPACING = 168;
const MEDAL_RADIUS = 46;
const RESULT_BUTTON_Y = -440;

export interface HudFonts {
  /** Orbitron Bold: banners, titles, buttons. */
  title: TTFFont | null;
}

/** What the results screen shows next to the run itself. */
export interface ResultsExtras {
  mission: string;
  difficulty: string;
  best: number;
  newBest: boolean;
  /** Medals earned for the first time (bit mask). */
  newMedals: number;
  hasNext: boolean;
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
  private readonly podsIcon: Node;
  private readonly pods: Label;
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
  private readonly quitButton: Node;
  private readonly resultsPanel: Node;
  private readonly resultsTitle: Label;
  private readonly resultsMission: Label;
  private readonly resultsScore: Label;
  private readonly resultsRecord: Label;
  private readonly resultsBody: Label;
  private readonly medalGfx: Graphics;
  private readonly medalNames: Label[] = [];
  private readonly retryButton: Node;
  private readonly nextButton: Node;
  private readonly menuButton: Node;
  private shown = { score: -1, combo: -1, hull: -1, hullMax: -1, shield: -1, shieldMax: -1, shieldFill: -1, credits: -1, charges: -1, energy: -1, boss: -1, armored: false, pods: -1, podsTotal: -1 };
  private time = 0;
  private podsFlash = 0;
  private recordBlink = false;

  constructor(
    private readonly root: Node,
    fonts: HudFonts,
  ) {
    const font = fonts.title;
    this.score = uiLabel(root, 'Score', 46, UI.white, { top: 70, centerX: true });
    this.combo = uiLabel(root, 'Combo', 30, UI.accent, { top: 124, centerX: true });
    // Status block, top left (the bottom of the screen is under the player's thumb): icons are
    // drawn once, bars redraw when the values change.
    const status = uiNode(root, 'Status', BAR_X + BAR_MAX_WIDTH, 128, { top: 60, left: 24 });
    status.getComponent(UITransform)!.setAnchorPoint(0, 1);
    drawStatusIcons(uiNode(status, 'Icons', 0, 0, {}).addComponent(Graphics));
    this.bars = uiNode(status, 'Bars', 0, 0, {}).addComponent(Graphics);
    this.credits = this.rowLabel(status, 'Credits', UI.gold, ROW_CREDITS);
    this.podsIcon = uiNode(status, 'PodIcon', 0, 0, {});
    drawPodIcon(this.podsIcon.addComponent(Graphics), PODS_X, ROW_CREDITS);
    this.pods = this.rowLabel(status, 'Pods', UI.rescue, ROW_CREDITS);
    this.pods.node.setPosition(PODS_X + 24, ROW_CREDITS);
    this.podsIcon.active = this.pods.node.active = false;

    this.pauseNode = uiNode(root, 'PauseButton', 72, 72, { top: 64, right: 24 });
    const pauseGfx = this.pauseNode.addComponent(Graphics);
    pauseGfx.lineWidth = 4;
    pauseGfx.strokeColor = UI.white;
    pauseGfx.circle(0, 0, 30);
    pauseGfx.stroke();
    pauseGfx.fillColor = UI.white;
    pauseGfx.rect(-11, -13, 7, 26);
    pauseGfx.rect(4, -13, 7, 26);
    pauseGfx.fill();

    const size = SPECIAL_RADIUS * 2 + 16;
    this.specialNode = uiNode(root, 'Special', size, size, { bottom: 70, right: 36 });
    this.specialGfx = this.specialNode.addComponent(Graphics);
    this.specialLabel = uiLabel(this.specialNode, 'SpecialLabel', 26, UI.white, {});
    this.specialLabel.node.setPosition(0, 0);

    this.bossNode = uiNode(root, 'BossBar', BOSS_BAR_WIDTH, 60, { top: 178, centerX: true });
    this.bossGfx = this.bossNode.addComponent(Graphics);
    this.bossName = uiLabel(this.bossNode, 'BossName', 24, UI.danger, {}, font);
    this.bossName.node.setPosition(0, 22);
    this.bossNode.active = false;

    this.banner = {
      title: uiLabel(root, 'BannerTitle', 56, UI.white, { centerX: true, centerY: true, dy: 160 }, font),
      sub: uiLabel(root, 'BannerSub', 28, UI.accent, { centerX: true, centerY: true, dy: 100 }, font),
      time: 0,
      style: 'title',
    };
    this.banner.title.node.active = false;
    this.banner.sub.node.active = false;

    this.pausePanel = uiPanel(root, 'PausePanel');
    uiLabel(this.pausePanel, 'PausedTitle', 60, UI.white, { centerX: true, centerY: true, dy: 220 }, font).string = 'PAUSED';
    this.resumeButton = uiButton(this.pausePanel, 'RESUME', 360, 92, { centerX: true, centerY: true, dy: 60 }, font);
    this.restartButton = uiButton(this.pausePanel, 'RESTART', 360, 92, { centerX: true, centerY: true, dy: -60 }, font);
    this.quitButton = uiButton(this.pausePanel, 'MENU', 360, 92, { centerX: true, centerY: true, dy: -180 }, font);
    this.pausePanel.active = false;

    this.resultsPanel = uiPanel(root, 'ResultsPanel');
    const p = this.resultsPanel;
    this.resultsTitle = uiLabel(p, 'ResultsTitle', 46, UI.success, { centerX: true, centerY: true, dy: 470 }, font);
    this.resultsMission = uiLabel(p, 'ResultsMission', 24, UI.accent, { centerX: true, centerY: true, dy: 410 }, font);
    this.resultsScore = uiLabel(p, 'ResultsScore', 64, UI.white, { centerX: true, centerY: true, dy: 320 }, font);
    this.resultsRecord = uiLabel(p, 'ResultsRecord', 24, UI.gold, { centerX: true, centerY: true, dy: 255 }, font);
    this.medalGfx = uiNode(p, 'Medals', 0, 0, { centerX: true, centerY: true, dy: MEDAL_ROW_Y }).addComponent(Graphics);
    MEDALS.forEach((m, i) => {
      const label = uiLabel(p, `Medal-${m.id}`, 17, UI.dim, { centerX: true, centerY: true, dx: (i - 1.5) * MEDAL_SPACING, dy: MEDAL_ROW_Y - MEDAL_RADIUS - 24 }, font);
      label.string = m.name;
      this.medalNames.push(label);
    });
    this.resultsBody = uiLabel(p, 'ResultsBody', 28, UI.white, { centerX: true, centerY: true, dy: -140 });
    this.resultsBody.lineHeight = 44;
    this.retryButton = uiButton(p, 'RETRY', 200, 88, { centerX: true, centerY: true, dx: -220, dy: RESULT_BUTTON_Y }, font, 28);
    this.nextButton = uiButton(p, 'NEXT', 200, 88, { centerX: true, centerY: true, dx: 0, dy: RESULT_BUTTON_Y }, font, 28);
    this.menuButton = uiButton(p, 'MENU', 200, 88, { centerX: true, centerY: true, dx: 220, dy: RESULT_BUTTON_Y }, font, 28);
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
    drawSegments(g, ROW_HULL, hull, hullMax, 0, low ? UI.danger : UI.accent, low ? DANGER_DIM : HULL_DIM);
    if (shieldMax > 0) drawSegments(g, ROW_SHIELD, shield, shieldMax, fill, UI.shield, SHIELD_DIM);
  }

  setCredits(credits: number): void {
    if (credits === this.shown.credits) return;
    this.shown.credits = credits;
    this.credits.string = credits.toLocaleString('en-US');
  }

  /** Escape pods picked up; the row is hidden in missions without pods. */
  setPods(pods: number, total: number): void {
    if (pods === this.shown.pods && total === this.shown.podsTotal) return;
    if (pods > this.shown.pods && this.shown.pods >= 0) this.podsFlash = 0.6;
    this.shown.pods = pods;
    this.shown.podsTotal = total;
    this.podsIcon.active = this.pods.node.active = total > 0;
    this.pods.string = `${pods}/${total}`;
  }

  /** Pods were launched: make the counter pulse so the player looks for them. */
  flashPods(): void {
    this.podsFlash = 1.2;
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
      g.strokeColor = e >= 1 ? UI.gold : UI.shield;
      // Clockwise from the top.
      g.arc(0, 0, SPECIAL_RADIUS, Math.PI / 2, Math.PI / 2 - Math.PI * 2 * Math.min(1, e), false);
      g.stroke();
    }
    this.specialLabel.string = `NOVA\n${charges > 0 ? '●'.repeat(charges) : '–'}`;
    this.specialLabel.color = ready ? UI.white : UI.dim;
  }

  /** Boss bar with phase marks; `name` null hides it. An armoured core shows a steel bar. */
  setBoss(name: string | null, fraction: number, armored: boolean): void {
    if (name === null) {
      if (this.bossNode.active) this.bossNode.active = false;
      this.shown.boss = -1;
      return;
    }
    const f = Math.max(0, Math.round(fraction * 200) / 200);
    if (this.bossNode.active && f === this.shown.boss && armored === this.shown.armored) return;
    this.bossNode.active = true;
    this.shown.boss = f;
    this.shown.armored = armored;
    this.bossName.string = armored ? `${name}  ·  ARMORED` : name;
    const g = this.bossGfx;
    const x0 = -BOSS_BAR_WIDTH / 2;
    const y0 = -BOSS_BAR_HEIGHT / 2 - 6;
    g.clear();
    g.fillColor = BOSS_BACK;
    g.rect(x0 - 3, y0 - 3, BOSS_BAR_WIDTH + 6, BOSS_BAR_HEIGHT + 6);
    g.fill();
    g.fillColor = armored ? BOSS_ARMORED : f > 0.33 ? BOSS_HP : BOSS_HP_LOW;
    g.rect(x0, y0, BOSS_BAR_WIDTH * f, BOSS_BAR_HEIGHT);
    g.fill();
    g.fillColor = UI.white;
    for (const mark of [0.33, 0.66]) g.rect(x0 + BOSS_BAR_WIDTH * mark - 1, y0 - 3, 2, BOSS_BAR_HEIGHT + 6);
    g.fill();
  }

  showBanner(text: string, sub: string, style: BannerStyle, time: number): void {
    const b = this.banner;
    b.title.string = text;
    b.sub.string = sub;
    b.title.color = style === 'warning' ? UI.danger : style === 'success' ? UI.success : UI.white;
    b.sub.color = style === 'warning' ? UI.danger : UI.accent;
    b.title.node.active = true;
    b.sub.node.active = sub.length > 0;
    b.time = time;
    b.style = style;
  }

  /** Banner timing and blinking. */
  tick(dt: number): void {
    this.time += dt;
    if (this.podsFlash > 0) {
      this.podsFlash -= dt;
      const on = this.podsFlash > 0 && Math.floor(this.podsFlash * 8) % 2 === 0;
      const s = on ? 1.25 : 1;
      this.pods.node.setScale(s, s, 1);
    }
    if (this.resultsPanel.active && this.recordBlink) this.resultsRecord.node.active = Math.floor(this.time * 3) % 3 !== 0;
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

  showResults(r: MissionResult | null, extras: ResultsExtras | null): void {
    this.resultsPanel.active = r !== null;
    if (!r || !extras) return;
    this.banner.time = 0;
    this.banner.title.node.active = false;
    this.banner.sub.node.active = false;
    this.resultsTitle.string = r.complete ? 'MISSION COMPLETE' : 'MISSION FAILED';
    this.resultsTitle.color = r.complete ? UI.success : UI.danger;
    this.resultsMission.string = `${extras.mission}  ·  ${extras.difficulty.toUpperCase()}`;
    this.resultsScore.string = r.score.toLocaleString('en-US');
    this.recordBlink = extras.newBest;
    this.resultsRecord.node.active = true;
    this.resultsRecord.string = extras.newBest ? 'NEW RECORD' : `BEST  ${extras.best.toLocaleString('en-US')}`;
    this.resultsRecord.color = extras.newBest ? UI.gold : UI.dim;

    const g = this.medalGfx;
    g.clear();
    MEDALS.forEach((m, i) => {
      const lit = hasMedal(r.medals, m.id);
      drawMedal(g, m.id, (i - 1.5) * MEDAL_SPACING, 0, MEDAL_RADIUS, lit);
      const fresh = (extras.newMedals & MEDAL_BITS[m.id]) !== 0;
      this.medalNames[i].string = fresh ? `${m.name}\nNEW` : m.name;
      this.medalNames[i].color = lit ? (fresh ? UI.gold : UI.white) : UI.dim;
    });

    const rate = Math.round(r.killRate * 100);
    const lines = [
      `CREDITS  ${r.credits.toLocaleString('en-US')}`,
      `KILLS  ${r.kills}/${r.spawned}  (${rate}%)`,
    ];
    if (r.podsTotal > 0) lines.push(`ESCAPE PODS  ${r.pods}/${r.podsTotal}`);
    lines.push(`BEST COMBO  ×${r.bestMultiplier}`, `GRAZES  ${r.grazes}`, `HULL LOST  ${r.hullLost}`);
    if (r.shieldBonus > 0) lines.push(`SHIELD BONUS  +${r.shieldBonus.toLocaleString('en-US')}`);
    if (r.noDamageBonus > 0) lines.push(`NO DAMAGE  +${r.noDamageBonus.toLocaleString('en-US')}`);
    this.resultsBody.string = lines.join('\n');
    this.nextButton.active = extras.hasNext && r.complete;
  }

  /** Which on-screen button is under a UI-space point (for InputService). */
  hitTest(x: number, y: number): ButtonId | null {
    if (this.pausePanel.active) {
      if (contains(this.resumeButton, x, y)) return 'resume';
      if (contains(this.restartButton, x, y)) return 'restart';
      if (contains(this.quitButton, x, y)) return 'menu';
      return null;
    }
    if (this.resultsPanel.active) {
      if (contains(this.retryButton, x, y)) return 'retry';
      if (contains(this.nextButton, x, y)) return 'next';
      if (contains(this.menuButton, x, y)) return 'menu';
      return null;
    }
    if (contains(this.specialNode, x, y)) return 'special';
    if (contains(this.pauseNode, x, y)) return 'pause';
    return null;
  }

  /** Small extra label for debug info, below the left column. */
  debugLabel(): Label {
    const label = uiLabel(this.root, 'Debug', 22, DEBUG, { top: 236, left: 16 });
    // Keep it under the panels.
    label.node.setSiblingIndex(this.pausePanel.getSiblingIndex());
    return label;
  }

  private rowLabel(parent: Node, name: string, color: Color, y: number): Label {
    const label = uiLabel(parent, name, 30, color, {});
    label.node.getComponent(UITransform)!.setAnchorPoint(0, 0.5);
    label.horizontalAlign = Label.HorizontalAlign.LEFT;
    label.node.setPosition(BAR_X, y);
    return label;
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

/** Escape pod: a capsule with two portholes. */
function drawPodIcon(g: Graphics, cx: number, cy: number): void {
  g.fillColor = UI.rescue;
  g.roundRect(cx - 16, cy - 8, 32, 16, 8);
  g.fill();
  g.fillColor = UI.ink;
  g.circle(cx - 5, cy, 3);
  g.circle(cx + 5, cy, 3);
  g.fill();
}

/** Hull: armour plate with a repair cross. Shield: crest. Credits: coin. Icon size ~34 UI units. */
function drawStatusIcons(g: Graphics): void {
  const k = 1.15;
  const cx = 18;
  // Hull: hexagonal plate.
  g.fillColor = UI.accent;
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    const x = cx + Math.cos(a) * 15 * k;
    const y = ROW_HULL + Math.sin(a) * 15 * k;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.close();
  g.fill();
  g.fillColor = UI.ink;
  g.rect(cx - 3, ROW_HULL - 9, 6, 18);
  g.rect(cx - 9, ROW_HULL - 3, 18, 6);
  g.fill();

  // Shield: flat top, curved sides meeting in a point.
  const top = ROW_SHIELD + 16;
  g.fillColor = UI.shield;
  g.moveTo(cx - 15, top);
  g.lineTo(cx + 15, top);
  g.lineTo(cx + 15, top - 11);
  g.quadraticCurveTo(cx + 14, top - 27, cx, top - 34);
  g.quadraticCurveTo(cx - 14, top - 27, cx - 15, top - 11);
  g.close();
  g.fill();
  g.fillColor = UI.ink;
  g.moveTo(cx, top - 5);
  g.lineTo(cx + 8, top - 8);
  g.lineTo(cx + 8, top - 15);
  g.quadraticCurveTo(cx + 7, top - 23, cx, top - 27);
  g.close();
  g.fill();

  // Credits: coin with an inner ring and a diamond.
  g.fillColor = UI.gold;
  g.circle(cx, ROW_CREDITS, 16);
  g.fill();
  g.lineWidth = 3;
  g.strokeColor = UI.ink;
  g.circle(cx, ROW_CREDITS, 11);
  g.stroke();
  g.fillColor = UI.ink;
  g.moveTo(cx, ROW_CREDITS + 6.5);
  g.lineTo(cx + 4.5, ROW_CREDITS);
  g.lineTo(cx, ROW_CREDITS - 6.5);
  g.lineTo(cx - 4.5, ROW_CREDITS);
  g.close();
  g.fill();
}
