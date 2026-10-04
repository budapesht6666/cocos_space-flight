// Entry point of the Menu scene: the simplified start screen of stage 3 (stage 4 grows the full
// menu from it). Nebula, stars and the player's ship turning in the light behind a logo;
// "Tap to start" (the first touch is the gesture iOS needs before audio may play), then the
// mission list with a difficulty switch and the best result per mission and difficulty.

import { _decorator, Camera, Color, Component, EffectAsset, EventKeyboard, Graphics, Input, KeyCode, Label, Node, Prefab, TTFFont, UITransform, director, input, instantiate, profiler, resources, screen } from 'cc';
import { hasMedal } from '../core/medals';
import { Rng } from '../core/Rng';
import { MEDALS } from '../data/medals';
import { MISSION_ORDER, MISSIONS } from '../data/missions';
import { SPITFIRE } from '../data/player';
import type { Difficulty, MissionId } from '../data/types';
import { COLORS } from '../data/visuals';
import { WORLD } from '../data/world';
import { readDebugFlags } from '../debug/DebugFlags';
import { CameraRig } from '../fx/CameraRig';
import { Nebula } from '../fx/Nebula';
import { RenderKit } from '../fx/RenderKit';
import { Starfield } from '../fx/Starfield';
import type { BackdropContext } from '../game/GameContext';
import { Playfield } from '../game/Playfield';
import { Launch, SCENES } from '../services/Launch';
import { RecordStore } from '../services/RecordStore';
import { drawButton, drawMedal, UI, uiLabel, uiNode } from './UiKit';

const { ccclass, property } = _decorator;

const DIFFICULTIES: readonly Difficulty[] = ['normal', 'hard'];
const CARD_WIDTH = 640;
const CARD_HEIGHT = 150;
const CARD_GAP = 22;
const CARDS_BOTTOM = 120;
const TOGGLE_WIDTH = 230;
const TOGGLE_HEIGHT = 78;
/** Background drift on the start screen, world units per second. */
const MENU_SCROLL = 2.5;
const SHIP_SIZE = 3.4;
/** Where the ship floats, as a fraction of the visible height from the top. */
const SHIP_DEPTH = 0.45;
const LOGO_GLOW = new Color(60, 200, 255, 255);
const LOGO_GLOW_EDGE = new Color(40, 160, 255, 150);
const BUILD_LABEL = 'STAGE 3 PREVIEW';

interface Card {
  mission: MissionId;
  node: Node;
  gfx: Graphics;
  best: Label;
  medals: Graphics;
}

function screenAspect(): number {
  const size = screen.windowSize;
  return size.height > 0 ? size.width / size.height : 9 / 16;
}

function loadPrefab(path: string): Promise<Prefab> {
  return new Promise((resolve, reject) => {
    resources.load(path, Prefab, (err, prefab) => (err ? reject(err) : resolve(prefab)));
  });
}

@ccclass('StartScreen')
export class StartScreen extends Component {
  @property(Camera)
  camera: Camera | null = null;

  @property(Node)
  uiRoot: Node | null = null;

  @property(EffectAsset)
  unlitEffect: EffectAsset | null = null;

  @property(EffectAsset)
  standardEffect: EffectAsset | null = null;

  /** Orbitron Bold: titles, buttons. */
  @property(TTFFont)
  titleFont: TTFFont | null = null;

  /** Orbitron Black: the logo. */
  @property(TTFFont)
  logoFont: TTFFont | null = null;

  private playfield: Playfield | null = null;
  private cameraRig: CameraRig | null = null;
  private nebula: Nebula | null = null;
  private stars: Starfield | null = null;
  private ship: Node | null = null;
  private engines: Node[] = [];
  private tapLabel: Label | null = null;
  private menu: Node | null = null;
  private loading: Label | null = null;
  private readonly cards: Card[] = [];
  private readonly toggles: { difficulty: Difficulty; node: Node; gfx: Graphics; label: Label }[] = [];
  private difficulty: Difficulty = 'normal';
  private started = false;
  private leaving = false;
  private time = 0;

  start(): void {
    const debug = readDebugFlags();
    // `?mission=` (and friends) jump straight into the game once per page load: handy on builds.
    if (debug.mission !== null && Launch.claimAutoStart()) {
      const mission = Object.prototype.hasOwnProperty.call(MISSIONS, debug.mission) ? (debug.mission as MissionId) : MISSION_ORDER[0];
      Launch.set(mission, debug.difficulty ?? 'normal');
      director.loadScene(SCENES.game);
      return;
    }
    Launch.claimAutoStart();
    if (debug.overlay) profiler.showStats();
    else profiler.hideStats();
    const last = RecordStore.last;
    if (last && DIFFICULTIES.indexOf(last.difficulty as Difficulty) >= 0) this.difficulty = last.difficulty as Difficulty;
    this.boot().catch((err: unknown) => console.error('[StartScreen] boot failed', err));
    director.preloadScene(SCENES.game);
  }

  onDestroy(): void {
    input.off(Input.EventType.TOUCH_END, this.onTap, this);
    input.off(Input.EventType.KEY_DOWN, this.onKey, this);
  }

  update(dt: number): void {
    this.time += dt;
    const playfield = this.playfield;
    if (!playfield) return;
    if (playfield.resize(screenAspect())) {
      this.cameraRig?.apply();
      this.stars?.layout();
      this.nebula?.layout();
    }
    this.stars?.tick(dt);
    this.nebula?.tick(dt);
    this.cameraRig?.tick(dt, 0);
    this.stars?.render();
    this.nebula?.render();
    this.cameraRig?.render();
    if (this.ship) {
      // A slow turn shows the model off; a gentle bob and roll keep it alive.
      const z = playfield.zAt(SHIP_DEPTH);
      this.ship.setPosition(0, 0.4 + Math.sin(this.time * 1.3) * 0.15, z);
      this.ship.setRotationFromEuler(Math.sin(this.time * 0.7) * 6, 180 + this.time * 28, Math.sin(this.time * 0.9) * 10);
      const flicker = 0.8 + 0.2 * Math.sin(this.time * 47) * Math.sin(this.time * 31);
      for (const e of this.engines) e.setScale(0.42 * flicker, 1, 0.8 * flicker);
    }
    if (this.tapLabel && !this.started) this.tapLabel.node.active = Math.floor(this.time * 2) % 3 !== 0;
  }

  private async boot(): Promise<void> {
    if (!this.camera || !this.uiRoot || !this.unlitEffect || !this.standardEffect) {
      throw new Error('StartScreen: camera, uiRoot and effects must be assigned in the scene');
    }
    const playfield = new Playfield(WORLD, screenAspect());
    const kit = new RenderKit(this.unlitEffect, this.standardEffect);
    const ctx: BackdropContext = { rng: new Rng(7), playfield, kit, worldRoot: this.node };
    this.playfield = playfield;
    this.cameraRig = new CameraRig(this.camera, playfield);
    this.nebula = new Nebula(ctx);
    this.stars = new Starfield(ctx, MENU_SCROLL);
    this.buildUi();

    const prefab = await loadPrefab(SPITFIRE.model);
    const ship = new Node('Ship');
    ship.layer = this.node.layer;
    this.node.addChild(ship);
    const model = instantiate(prefab);
    model.setScale(SHIP_SIZE, SHIP_SIZE, SHIP_SIZE);
    ship.addChild(model);
    const glow = kit.glow(COLORS.engineGlow, 2.4);
    for (const [ex, ez] of SPITFIRE.engines) {
      const engine = kit.meshNode('engine', ship, kit.plane, glow);
      engine.setPosition(ex * SHIP_SIZE, 0, ez * SHIP_SIZE + 0.45);
      this.engines.push(engine);
    }
    this.ship = ship;
  }

  private buildUi(): void {
    const root = this.uiRoot as Node;
    const font = this.titleFont;
    const logoFont = this.logoFont ?? font;
    // Logo: a cyan glow label under a white one.
    const glow = uiLabel(root, 'LogoGlow', 78, LOGO_GLOW, { top: 150, centerX: true }, logoFont);
    glow.outlineColor = LOGO_GLOW_EDGE;
    glow.outlineWidth = 8;
    glow.string = 'SPACE FLIGHT';
    const logo = uiLabel(root, 'Logo', 78, UI.white, { top: 150, centerX: true }, logoFont);
    logo.outlineWidth = 0;
    logo.enableOutline = false;
    logo.string = 'SPACE FLIGHT';
    uiLabel(root, 'Sector', 26, UI.accent, { top: 250, centerX: true }, font).string = 'SECTOR 1  ·  OUTER RING';

    this.tapLabel = uiLabel(root, 'Tap', 34, UI.white, { bottom: 260, centerX: true }, font);
    this.tapLabel.string = 'TAP TO START';
    uiLabel(root, 'Build', 18, UI.dim, { bottom: 40, centerX: true }, font).string = BUILD_LABEL;

    const menu = uiNode(root, 'Menu', 0, 0, { top: 0, bottom: 0, left: 0, right: 0 });
    this.menu = menu;
    const togglesBottom = CARDS_BOTTOM + MISSION_ORDER.length * (CARD_HEIGHT + CARD_GAP) + 30;
    DIFFICULTIES.forEach((difficulty, i) => {
      const dx = (i - 0.5) * (TOGGLE_WIDTH + 24);
      const node = uiNode(menu, `Toggle-${difficulty}`, TOGGLE_WIDTH, TOGGLE_HEIGHT, { bottom: togglesBottom, centerX: true, dx });
      const gfx = node.addComponent(Graphics);
      const label = uiLabel(node, 'Label', 28, UI.white, {}, font);
      label.string = difficulty.toUpperCase();
      label.node.setPosition(0, 0);
      node.on(Node.EventType.TOUCH_END, () => this.selectDifficulty(difficulty));
      this.toggles.push({ difficulty, node, gfx, label });
    });
    // Missions bottom-up, so the first one sits on top.
    MISSION_ORDER.forEach((mission, i) => {
      const def = MISSIONS[mission];
      const bottom = CARDS_BOTTOM + (MISSION_ORDER.length - 1 - i) * (CARD_HEIGHT + CARD_GAP);
      const node = uiNode(menu, `Card-${mission}`, CARD_WIDTH, CARD_HEIGHT, { bottom, centerX: true });
      const gfx = node.addComponent(Graphics);
      drawCard(gfx);
      const title = uiLabel(node, 'Title', 32, UI.white, {}, font);
      title.string = def.title;
      placeLeft(title, -CARD_WIDTH / 2 + 32, 26);
      const sub = uiLabel(node, 'Subtitle', 22, UI.accent, {}, font);
      sub.string = def.subtitle;
      placeLeft(sub, -CARD_WIDTH / 2 + 32, -24);
      const best = uiLabel(node, 'Best', 24, UI.white, {}, font);
      placeRight(best, CARD_WIDTH / 2 - 30, 30);
      const medals = uiNode(node, 'Medals', 0, 0, {}).addComponent(Graphics);
      node.on(Node.EventType.TOUCH_END, () => this.launch(mission));
      this.cards.push({ mission, node, gfx, best, medals });
    });
    this.loading = uiLabel(root, 'Loading', 34, UI.white, { centerX: true, centerY: true }, font);
    this.loading.string = 'LOADING…';
    this.loading.node.active = false;
    menu.active = false;
    this.refresh();

    input.on(Input.EventType.TOUCH_END, this.onTap, this);
    input.on(Input.EventType.KEY_DOWN, this.onKey, this);
  }

  private onTap(): void {
    if (!this.started) this.showMenu();
  }

  private onKey(event: EventKeyboard): void {
    if (!this.started) {
      if (event.keyCode === KeyCode.ENTER || event.keyCode === KeyCode.SPACE) this.showMenu();
      return;
    }
    // Keyboard shortcuts: 1–3 launch a mission, Left/Right switch the difficulty.
    if (event.keyCode >= KeyCode.DIGIT_1 && event.keyCode < KeyCode.DIGIT_1 + MISSION_ORDER.length) this.launch(MISSION_ORDER[event.keyCode - KeyCode.DIGIT_1]);
    else if (event.keyCode === KeyCode.ARROW_LEFT) this.selectDifficulty('normal');
    else if (event.keyCode === KeyCode.ARROW_RIGHT) this.selectDifficulty('hard');
  }

  /** First touch: the gesture iOS needs to unlock audio (AudioService, stage 6), then the menu. */
  private showMenu(): void {
    this.started = true;
    if (this.tapLabel) this.tapLabel.node.active = false;
    if (this.menu) this.menu.active = true;
  }

  private selectDifficulty(difficulty: Difficulty): void {
    if (!this.started || this.leaving) return;
    this.difficulty = difficulty;
    this.refresh();
  }

  private launch(mission: MissionId): void {
    if (!this.started || this.leaving) return;
    this.leaving = true;
    Launch.set(mission, this.difficulty);
    RecordStore.setLast(mission, this.difficulty);
    if (this.menu) this.menu.active = false;
    if (this.loading) this.loading.node.active = true;
    director.loadScene(SCENES.game);
  }

  /** Redraws the toggles and the per-difficulty records on the cards. */
  private refresh(): void {
    for (const t of this.toggles) {
      const on = t.difficulty === this.difficulty;
      drawButton(t.gfx, TOGGLE_WIDTH, TOGGLE_HEIGHT, on);
      t.label.color = on ? UI.white : UI.dim;
    }
    for (const c of this.cards) {
      const record = RecordStore.get(c.mission, this.difficulty);
      c.best.string = record && record.score > 0 ? record.score.toLocaleString('en-US') : '—';
      c.best.color = record && record.score > 0 ? UI.gold : UI.dim;
      const g = c.medals;
      g.clear();
      MEDALS.forEach((m, i) => drawMedal(g, m.id, CARD_WIDTH / 2 - 46 - (MEDALS.length - 1 - i) * 42, -28, 16, record !== null && hasMedal(record.medals, m.id)));
    }
  }
}

function drawCard(g: Graphics): void {
  g.clear();
  g.fillColor = UI.card;
  g.roundRect(-CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 20);
  g.fill();
  g.lineWidth = 3;
  g.strokeColor = UI.cardEdge;
  g.roundRect(-CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 20);
  g.stroke();
}

/** Left-aligned label at (x, y) inside its parent. */
function placeLeft(label: Label, x: number, y: number): void {
  label.node.getComponent(UITransform)?.setAnchorPoint(0, 0.5);
  label.horizontalAlign = Label.HorizontalAlign.LEFT;
  label.node.setPosition(x, y);
}

function placeRight(label: Label, x: number, y: number): void {
  label.node.getComponent(UITransform)?.setAnchorPoint(1, 0.5);
  label.horizontalAlign = Label.HorizontalAlign.RIGHT;
  label.node.setPosition(x, y);
}
