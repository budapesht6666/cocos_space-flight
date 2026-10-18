// Entry point of the Menu scene: the backdrop (nebula, stars), the player's ship on a turntable,
// and the menu pages, all panels of this one scene: Title ("Tap to start" — the first touch is
// the gesture iOS needs before audio may play), Main, Campaign, Mission (ui/MenuPages.ts),
// Hangar (ui/HangarPage.ts), Settings, Cheats and Credits. Pages slide in; the menu theme plays. The title shows once per page load; coming back from a mission
// opens the main page or the hangar directly (services/SceneRouter).

import { _decorator, Camera, Color, Component, EffectAsset, EventKeyboard, Graphics, Input, KeyCode, Label, Node, Prefab, TTFFont, UIOpacity, director, input, instantiate, profiler, resources, screen } from 'cc';
import { INSTALL_TIPS, installPlatform } from '../core/install';
import { damp, smoothstep } from '../core/math';
import { missionNeeds, missionPrefabPaths } from '../core/missionNeeds';
import { continueTarget, sectorOf, type MissionPick } from '../core/progress';
import { Rng } from '../core/Rng';
import { SECTORS } from '../data/campaign';
import { MISSION_ORDER, MISSIONS } from '../data/missions';
import { SHIPS, shipModel } from '../data/player';
import type { MissionId, PaintId, ShipId } from '../data/types';
import { COLORS, MENU_FX, POST_FX } from '../data/visuals';
import { WORLD } from '../data/world';
import { readDebugFlags } from '../debug/DebugFlags';
import { CameraRig } from '../fx/CameraRig';
import { Nebula } from '../fx/Nebula';
import { RenderKit } from '../fx/RenderKit';
import { keepRenderTargets } from '../fx/PipelineFix';
import { pipelineSettings, RenderScaler } from '../fx/RenderScaler';
import { Starfield } from '../fx/Starfield';
import type { BackdropContext } from '../game/GameContext';
import { Playfield } from '../game/Playfield';
import { AudioService } from '../services/AudioService';
import { SaveService } from '../services/SaveService';
import { SCENES, SceneRouter } from '../services/SceneRouter';
import { ScreenFit } from '../services/ScreenFit';
import { WebPage } from '../services/WebPage';
import { CheatsPage } from './CheatsPage';
import { CreditsPage } from './CreditsPage';
import { HangarPage } from './HangarPage';
import type { MenuHost, MenuPage, PageId } from './MenuPage';
import { CampaignPage, MainPage, MissionPage } from './MenuPages';
import { ScreenFade } from './ScreenFade';
import { SettingsPage } from './SettingsPage';
import { drawCoin, placeLabel, safeRoot, UI, uiLabel, uiNode } from './UiKit';

const { ccclass, property } = _decorator;

/** Background drift on the menu, world units per second. */
const MENU_SCROLL = 2.5;
/** Turntable ship size on the title screen (the hangar shows it a little smaller). */
const SHIP_SIZE = 3.4;
/** The turntable floats this high above the plane. */
const SHIP_HEIGHT = 0.4;
const LOGO_GLOW = new Color(60, 200, 255, 255);
const LOGO_GLOW_EDGE = new Color(40, 160, 255, 150);
const BUILD_LABEL = 'VERSION 1.0';
const WALLET_WIDTH = 240;

/** One ship on the turntable: its paints (loaded on demand) and engine glows. */
interface Turntable {
  node: Node;
  engines: Node[];
  models: Map<PaintId, Node>;
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

/** The title page: "Tap to start" under the logo. */
class TitlePage implements MenuPage {
  readonly root: Node;
  readonly pose = { row: 0.36, scale: 1 };
  readonly logo = true;
  readonly tap: Label;
  private readonly sector: Label;

  constructor(parent: Node, host: MenuHost) {
    this.root = uiNode(parent, 'TitlePage', 0, 0, { top: 0, bottom: 0, left: 0, right: 0 });
    this.root.active = false;
    this.sector = uiLabel(this.root, 'Sector', 26, UI.accent, { top: 250, centerX: true }, host.font);
    this.tap = uiLabel(this.root, 'Tap', 34, UI.white, { bottom: 260, centerX: true }, host.font);
    this.tap.string = 'TAP TO START';
    // In a phone's browser: how to install the game (full screen, offline). Not once installed.
    const env = WebPage.env();
    const platform = env ? installPlatform(env) : null;
    if (platform) {
      const tip = INSTALL_TIPS[platform];
      uiLabel(this.root, 'InstallTitle', 22, UI.shield, { bottom: 150, centerX: true }, host.font).string = tip.title;
      uiLabel(this.root, 'InstallSteps', 20, UI.white, { bottom: 116, centerX: true }, host.font).string = tip.steps;
    }
  }

  enter(): void {
    // Where the player is in the campaign: the sector CONTINUE goes to.
    const save = SaveService.data;
    const sector = sectorOf(continueTarget(save.records, save.last).mission) ?? SECTORS[0];
    this.sector.string = `SECTOR ${sector.id}  ·  ${sector.name}`;
  }

  key(): boolean {
    return false;
  }
}

@ccclass('StartScreen')
export class StartScreen extends Component implements MenuHost {
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

  pick: MissionPick = { mission: MISSION_ORDER[0], difficulty: 'normal' };
  unlockAll = false;

  private playfield: Playfield | null = null;
  private cameraRig: CameraRig | null = null;
  private nebula: Nebula | null = null;
  private stars: Starfield | null = null;
  private kit: RenderKit | null = null;
  private turntableRoot: Node | null = null;
  private readonly turntables = new Map<ShipId, Turntable>();
  private shown: { ship: ShipId; paint: PaintId } | null = null;
  /** Latest turntable request: an older load finishing late must not replace it. */
  private showToken = 0;
  private shipRow = 0.36;
  private shipScale = 1;
  private readonly pages = new Map<PageId, MenuPage>();
  private readonly stack: PageId[] = [];
  private logo: Node[] = [];
  private logoGlow: Label | null = null;
  private scaler: RenderScaler | null = null;
  /** The page coming in: its opacity, progress 0..1 and slide direction. */
  private arrival: { root: Node; opacity: UIOpacity; t: number; dir: number } | null = null;
  private title: TitlePage | null = null;
  private wallet: Node | null = null;
  private walletLabel: Label | null = null;
  private walletFlash = 0;
  private fade: ScreenFade | null = null;
  /** Missions whose prefabs are already being fetched. */
  private readonly preloaded = new Set<MissionId>();
  /** The first turntable model is up: the menu can be revealed. */
  private ready = false;
  private leaving = false;
  private time = 0;

  get font(): TTFFont | null {
    return this.titleFont;
  }

  start(): void {
    ScreenFit.init();
    AudioService.init();
    const debug = readDebugFlags();
    SaveService.applyDevFlags(debug.reset, debug.credits);
    // `?mission=` (and friends) jump straight into the game once per page load: handy on builds.
    if (debug.mission !== null && SceneRouter.claimAutoStart()) {
      const mission = Object.prototype.hasOwnProperty.call(MISSIONS, debug.mission) ? (debug.mission as MissionId) : MISSION_ORDER[0];
      SceneRouter.play(mission, debug.difficulty ?? 'normal', false);
      return;
    }
    SceneRouter.claimAutoStart();
    AudioService.music('menu');
    this.unlockAll = debug.unlock;
    if (debug.overlay) profiler.showStats();
    else profiler.hideStats();
    this.boot();
    director.preloadScene(SCENES.game);
  }

  onDestroy(): void {
    input.off(Input.EventType.TOUCH_END, this.onTap, this);
    input.off(Input.EventType.KEY_DOWN, this.onKey, this);
    this.kit?.releaseScene();
  }

  update(dt: number): void {
    keepRenderTargets();
    this.time += dt;
    const fade = this.fade;
    if (fade) {
      // Reveal once the ship is on the turntable (or after a second without it).
      if (fade.covering && !this.leaving && (this.ready || this.time > 1)) {
        fade.reveal();
        WebPage.hideSplash();
      }
      fade.tick(dt);
    }
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
    this.spinShip(playfield, dt);
    this.animatePage(dt);
    if (this.logoGlow && this.logoGlow.node.activeInHierarchy) {
      const k = 0.5 + 0.5 * Math.sin((this.time * Math.PI * 2) / MENU_FX.glowPeriod);
      this.logoGlow.color.set(LOGO_GLOW.r, LOGO_GLOW.g, LOGO_GLOW.b, Math.round(255 * (MENU_FX.glowMin + (MENU_FX.glowMax - MENU_FX.glowMin) * k)));
      this.logoGlow.color = this.logoGlow.color;
    }
    const title = this.title;
    if (title && this.current === 'title') title.tap.node.active = Math.floor(this.time * 2) % 3 !== 0;
    if (this.walletFlash > 0 && this.walletLabel) {
      this.walletFlash -= dt;
      this.walletLabel.color = this.walletFlash > 0 && Math.floor(this.walletFlash * 10) % 2 === 0 ? UI.danger : UI.gold;
    }
  }

  // ---- MenuHost --------------------------------------------------------------------------------

  open(page: PageId): void {
    if (this.leaving) return;
    if (page === 'main') this.stack.length = 0;
    const fromTitle = this.current === 'title';
    this.stack.push(page);
    this.showPage(fromTitle ? 0 : 1);
  }

  back(): void {
    if (this.leaving || this.stack.length <= 1) return;
    this.stack.pop();
    this.showPage(-1);
  }

  launch(): void {
    if (this.leaving) return;
    this.leaving = true;
    AudioService.play('launch');
    const pick = this.pick;
    if (this.fade) this.fade.leave(() => SceneRouter.play(pick.mission, pick.difficulty));
    else SceneRouter.play(pick.mission, pick.difficulty);
  }

  showShip(ship: ShipId, paint: PaintId): void {
    this.shown = { ship, paint };
    const token = ++this.showToken;
    this.prepareShip(ship, paint)
      .then(() => {
        if (token === this.showToken) this.applyShip();
        this.ready = true;
      })
      .catch((err: unknown) => console.error('[StartScreen] ship model failed', err));
  }

  walletChanged(): void {
    if (this.walletLabel) this.walletLabel.string = SaveService.credits.toLocaleString('en-US');
  }

  walletDenied(): void {
    this.walletFlash = 0.5;
  }

  graphicsChanged(): void {
    this.scaler?.refresh();
  }

  // ---------------------------------------------------------------------------------------------

  private get current(): PageId | null {
    return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
  }

  private boot(): void {
    if (!this.camera || !this.uiRoot || !this.unlitEffect || !this.standardEffect) {
      throw new Error('StartScreen: camera, uiRoot and effects must be assigned in the scene');
    }
    // The graphics tier from the settings; the GRAPHICS row changes it on the spot (graphicsChanged).
    const debug = readDebugFlags();
    const pipe = pipelineSettings(this.camera);
    if (pipe) {
      pipe.bloomEnable = debug.bloom ?? POST_FX.bloom;
      pipe.fxaaEnable = debug.fxaa ?? POST_FX.fxaa;
      this.scaler = new RenderScaler(pipe, debug);
    }
    const playfield = new Playfield(WORLD, screenAspect());
    const kit = RenderKit.shared(this.unlitEffect, this.standardEffect);
    const ctx: BackdropContext = { rng: new Rng(7), playfield, kit, worldRoot: this.node };
    this.playfield = playfield;
    this.kit = kit;
    this.cameraRig = new CameraRig(this.camera, playfield);
    // The backdrop of the sector the player is in (what CONTINUE launches).
    const save = SaveService.data;
    this.nebula = new Nebula(ctx, sectorOf(continueTarget(save.records, save.last).mission) ?? SECTORS[0]);
    this.stars = new Starfield(ctx, MENU_SCROLL);
    const turntable = new Node('Turntable');
    turntable.layer = this.node.layer;
    this.node.addChild(turntable);
    this.turntableRoot = turntable;

    // The menu is laid out inside the safe area (clear of the status bar and home indicator).
    this.buildChrome(safeRoot(this.uiRoot));
    const ship = SaveService.shipToFly(this.unlockAll);
    this.showShip(ship, SaveService.paintOf(ship));
    input.on(Input.EventType.TOUCH_END, this.onTap, this);
    input.on(Input.EventType.KEY_DOWN, this.onKey, this);

    // Back from a mission: straight to the main page or the hangar. First load: the title.
    const entry = SceneRouter.takeMenuEntry();
    if (entry === null) {
      this.stack.push('title');
      this.showPage(0);
    } else {
      this.open('main');
      if (entry === 'hangar') this.open('hangar');
    }
  }

  private buildChrome(root: Node): void {
    const font = this.titleFont;
    const logoFont = this.logoFont ?? font;
    // Logo: a cyan glow label under a white one.
    const glow = uiLabel(root, 'LogoGlow', 78, LOGO_GLOW, { top: 150, centerX: true }, logoFont);
    glow.outlineColor = LOGO_GLOW_EDGE;
    glow.outlineWidth = 8;
    glow.string = 'SPACE FLIGHT';
    const logo = uiLabel(root, 'Logo', 78, UI.white, { top: 150, centerX: true }, logoFont);
    logo.enableOutline = false;
    logo.string = 'SPACE FLIGHT';
    this.logoGlow = glow;
    const build = uiLabel(root, 'Build', 18, UI.dim, { bottom: 16, centerX: true }, font);
    build.string = BUILD_LABEL;
    this.logo = [glow.node, logo.node, build.node];

    const host: MenuHost = this;
    this.title = new TitlePage(root, host);
    this.pages.set('title', this.title);
    this.pages.set('main', new MainPage(root, host));
    this.pages.set('campaign', new CampaignPage(root, host));
    this.pages.set('mission', new MissionPage(root, host));
    this.pages.set('hangar', new HangarPage(root, host));
    this.pages.set('settings', new SettingsPage(root, host));
    this.pages.set('cheats', new CheatsPage(root, host));
    this.pages.set('credits', new CreditsPage(root, host));

    // Wallet: credits and a coin, top right on every page but the title.
    this.wallet = uiNode(root, 'Wallet', WALLET_WIDTH, 50, { top: 50, right: 24 });
    drawCoin(this.wallet.addComponent(Graphics), WALLET_WIDTH / 2 - 18, 0, 16);
    this.walletLabel = uiLabel(this.wallet, 'Credits', 30, UI.gold, {}, font);
    placeLabel(this.walletLabel, WALLET_WIDTH / 2 - 44, 0, 'right');
    this.walletChanged();

    // Last, so it covers everything: the menu fades in from black.
    this.fade = new ScreenFade(root, font);
  }

  /** Shows the page on top of the stack; it slides in from the right (dir 1), the left (−1) or just fades up (0). */
  private showPage(dir: number): void {
    const id = this.current;
    for (const [pid, page] of this.pages) page.root.active = pid === id;
    const page = id ? this.pages.get(id) : undefined;
    if (!page) return;
    const root = page.root;
    const opacity = root.getComponent(UIOpacity) ?? root.addComponent(UIOpacity);
    opacity.opacity = 0;
    this.arrival = { root, opacity, t: 0, dir };
    for (const n of this.logo) n.active = page.logo;
    if (this.wallet) this.wallet.active = id !== 'title';
    if (id === 'main') {
      // Leaving the hangar: the turntable shows the ship you fly.
      const ship = SaveService.shipToFly(this.unlockAll);
      this.showShip(ship, SaveService.paintOf(ship));
    }
    page.enter();
    this.walletChanged();
    this.preloadMission(this.pick.mission);
  }

  /** Slides and fades the arriving page in (the Widget put it in place; this offsets it for a moment). */
  private animatePage(dt: number): void {
    const a = this.arrival;
    if (!a) return;
    a.t = Math.min(1, a.t + dt / MENU_FX.pageTime);
    const k = smoothstep(a.t);
    a.opacity.opacity = Math.round(255 * k);
    a.root.setPosition(a.dir * MENU_FX.pageSlide * (1 - k), a.root.position.y);
    if (a.t >= 1) this.arrival = null;
  }

  /** Fetches the picked mission's models while the player is still in the menu, so LAUNCH is quick. */
  private preloadMission(mission: MissionId): void {
    if (this.preloaded.has(mission)) return;
    this.preloaded.add(mission);
    resources.preload(missionPrefabPaths(missionNeeds(MISSIONS[mission])), Prefab);
  }

  private onTap(): void {
    if (this.current === 'title') this.open('main');
  }

  private onKey(event: EventKeyboard): void {
    const id = this.current;
    if (!id || this.leaving) return;
    if (id === 'title') {
      if (event.keyCode === KeyCode.ENTER || event.keyCode === KeyCode.SPACE) this.open('main');
      return;
    }
    const page = this.pages.get(id);
    if (page && page.key(event.keyCode)) return;
    // Android's system Back works as Esc.
    if (event.keyCode === KeyCode.ESCAPE || event.keyCode === KeyCode.BACKSPACE || event.keyCode === KeyCode.MOBILE_BACK) this.back();
  }

  /** Loads (once) the model of a ship in a paint, with the ship's engine glows. */
  private async prepareShip(ship: ShipId, paint: PaintId): Promise<void> {
    const root = this.turntableRoot;
    const kit = this.kit;
    if (!root || !kit) return;
    let table = this.turntables.get(ship);
    if (!table) {
      const node = new Node(`Ship-${ship}`);
      node.layer = this.node.layer;
      root.addChild(node);
      node.active = false;
      const def = SHIPS[ship];
      const size = (SHIP_SIZE * def.size) / SHIPS.spitfire.size;
      const glow = kit.glow(COLORS.engineGlow, 2.4);
      const engines: Node[] = [];
      for (const [ex, ez] of def.engines) {
        const engine = kit.meshNode('engine', node, kit.plane, glow);
        engine.setPosition(ex * size, 0, ez * size + 0.45);
        engines.push(engine);
      }
      table = { node, engines, models: new Map() };
      this.turntables.set(ship, table);
    }
    if (table.models.has(paint)) return;
    const prefab = await loadPrefab(shipModel(ship, paint));
    if (table.models.has(paint)) return;
    const model = instantiate(prefab);
    const size = (SHIP_SIZE * SHIPS[ship].size) / SHIPS.spitfire.size;
    model.setScale(size, size, size);
    model.active = false;
    table.node.addChild(model);
    table.models.set(paint, model);
  }

  /** Shows the requested ship and paint, hides the rest. */
  private applyShip(): void {
    const want = this.shown;
    if (!want) return;
    for (const [ship, table] of this.turntables) {
      table.node.active = ship === want.ship;
      for (const [paint, model] of table.models) model.active = ship === want.ship && paint === want.paint;
    }
  }

  /** Turns the ship slowly, bobbing, and glides it to where the open page wants it. */
  private spinShip(playfield: Playfield, dt: number): void {
    const root = this.turntableRoot;
    if (!root) return;
    const id = this.current;
    const pose = id && !this.leaving ? this.pages.get(id)?.pose ?? null : null;
    root.active = pose !== null;
    if (!pose) return;
    this.shipRow = damp(this.shipRow, pose.row, 8, dt);
    this.shipScale = damp(this.shipScale, pose.scale, 8, dt);
    const z = playfield.zAtScreen(this.shipRow, SHIP_HEIGHT);
    root.setPosition(0, SHIP_HEIGHT + Math.sin(this.time * 1.3) * 0.15, z);
    root.setScale(this.shipScale, this.shipScale, this.shipScale);
    root.setRotationFromEuler(Math.sin(this.time * 0.7) * 6, 180 + this.time * 28, Math.sin(this.time * 0.9) * 10);
    const flicker = 0.8 + 0.2 * Math.sin(this.time * 47) * Math.sin(this.time * 31);
    const table = this.shown ? this.turntables.get(this.shown.ship) : undefined;
    if (table) for (const e of table.engines) e.setScale(0.42 * flicker, 1, 0.8 * flicker);
  }
}
