// Entry point of the Game scene: loads the mission's assets, builds the systems and runs the
// fixed-step loop. Simulation order: camera → stars → mission (timeline spawns) → set pieces →
// player → weapons → bullets → enemies (movement, fire) → enemy bullets → drones → pickups →
// collisions → score → fx. Time Warp slows the level, enemies and their bullets, not the ship.
// The mission comes from the menu (services/SceneRouter), or from URL flags when the scene is
// opened directly; the ship and its loadout come from the hangar (services/SaveService).

import { _decorator, Camera, Component, EffectAsset, Game, Node, Prefab, TTFFont, Vec2, game, profiler, resources, screen, sys } from 'cc';
import { EventBus } from '../core/EventBus';
import { FixedStep } from '../core/FixedStep';
import { smoothstep } from '../core/math';
import { hasOverride, overrideLoadout } from '../core/loadout';
import { enemyPrefabPath, missionNeeds } from '../core/missionNeeds';
import { isCleared, missionPay, missionUnlocked, sectorOf } from '../core/progress';
import { Rng } from '../core/Rng';
import { SECTORS } from '../data/campaign';
import { DIFFICULTIES } from '../data/difficulty';
import { DEFAULT_MISSION, MISSIONS, nextMission } from '../data/missions';
import { DEMO } from '../data/demo';
import { DEFAULT_PAINT, SHIPS, shipModel } from '../data/player';
import { propPath } from '../data/props';
import type { BoltId, Difficulty, EnemyBulletId, EnemyId, Loadout, MissionId, PropId } from '../data/types';
import { BOSS_FX, NOVA_FX, POST_FX } from '../data/visuals';
import { BOLTS, DRONES, ENEMY_BULLET_CAP, ENEMY_BULLET_POOLS, ENEMY_BULLETS, PLAYER_BULLET_CAP, SPECIALS, WEAPONS } from '../data/weapons';
import { WORLD } from '../data/world';
import { DebugOverlay } from '../debug/DebugOverlay';
import { readDebugFlags } from '../debug/DebugFlags';
import { CameraRig } from '../fx/CameraRig';
import { Decor } from '../fx/Decor';
import { FxSystem } from '../fx/FxSystem';
import { Nebula } from '../fx/Nebula';
import { RenderKit } from '../fx/RenderKit';
import { keepRenderTargets } from '../fx/PipelineFix';
import { pipelineSettings, RenderScaler } from '../fx/RenderScaler';
import { Starfield } from '../fx/Starfield';
import { InputService } from '../services/InputService';
import { ScreenFade } from '../ui/ScreenFade';
import { safeRoot } from '../ui/UiKit';
import { AudioService } from '../services/AudioService';
import { SaveService } from '../services/SaveService';
import { SettingsService } from '../services/SettingsService';
import { SceneRouter, type MenuEntry } from '../services/SceneRouter';
import { ScreenFit } from '../services/ScreenFit';
import { WebPage } from '../services/WebPage';
import { Hud } from '../ui/Hud';
import { BulletSystem, type BulletLook } from './BulletSystem';
import { CollisionSystem } from './CollisionSystem';
import { DroneSystem } from './DroneSystem';
import { EnemySystem } from './EnemySystem';
import { GameAudio } from './GameAudio';
import { LaserSystem } from './LaserSystem';
import type { GameContext, GameEvents } from './GameContext';
import { MissionDirector } from './MissionDirector';
import { Onboarding } from './Onboarding';
import { PickupSystem } from './PickupSystem';
import { Playfield } from './Playfield';
import { PlayerSystem } from './PlayerSystem';
import { ScoreSystem } from './ScoreSystem';
import { SetPieceSystem } from './SetPieceSystem';
import { WeaponSystem } from './WeaponSystem';

const { ccclass, property } = _decorator;

const ENEMY_BULLET_IDS: readonly EnemyBulletId[] = ['orb', 'orbLarge'];

interface Systems {
  ctx: GameContext;
  playfield: Playfield;
  stars: Starfield;
  nebula: Nebula;
  decor: Decor;
  player: PlayerSystem;
  weapons: WeaponSystem;
  drones: DroneSystem;
  playerBullets: BulletSystem;
  enemyBullets: BulletSystem;
  enemies: EnemySystem;
  lasers: LaserSystem;
  setPieces: SetPieceSystem;
  pickups: PickupSystem;
  collisions: CollisionSystem;
  score: ScoreSystem;
  mission: MissionDirector;
  fx: FxSystem;
  cameraRig: CameraRig;
  hud: Hud;
  audio: GameAudio;
  onboarding: Onboarding | null;
  overlay: DebugOverlay | null;
}

function loadPrefab(path: string): Promise<Prefab> {
  return new Promise((resolve, reject) => {
    resources.load(path, Prefab, (err, prefab) => (err ? reject(err) : resolve(prefab)));
  });
}

function screenAspect(): number {
  const size = screen.windowSize;
  return size.height > 0 ? size.width / size.height : 9 / 16;
}

@ccclass('GameWorld')
export class GameWorld extends Component {
  @property(Camera)
  camera: Camera | null = null;

  @property(Node)
  hudRoot: Node | null = null;

  /** builtin-unlit; referenced here so the effect is always included in builds. */
  @property(EffectAsset)
  unlitEffect: EffectAsset | null = null;

  /** builtin-standard; used for lit debris. */
  @property(EffectAsset)
  standardEffect: EffectAsset | null = null;

  /** Orbitron Bold for banners, titles and buttons. */
  @property(TTFFont)
  titleFont: TTFFont | null = null;

  private s: Systems | null = null;
  /** hudRoot inset by the safe area: the HUD is built in it. */
  private ui: Node | null = null;
  private missionId: MissionId = DEFAULT_MISSION;
  private difficulty: Difficulty = 'normal';
  private loadout: Loadout | null = null;
  private fade: ScreenFade | null = null;
  /** The graphics tier on the camera (Settings → GRAPHICS, or URL flags). */
  private scaler: RenderScaler | null = null;
  /** Real seconds of boss-kill slow motion left. */
  private slowmo = 0;
  private leaving = false;
  private readonly input = new InputService();
  private readonly fixed = new FixedStep(WORLD.step);
  private readonly scratch = new Vec2();
  private freeze = 0;
  private paused = false;
  private specialQueued = false;
  private resultsShown = false;

  start(): void {
    ScreenFit.init();
    AudioService.init();
    game.on(Game.EVENT_HIDE, this.onHide, this);
    if (this.hudRoot) this.ui = safeRoot(this.hudRoot);
    // Covered from the first frame until everything is loaded and built.
    if (this.ui) this.fade = new ScreenFade(this.ui, this.titleFont);
    this.boot()
      .then(() => {
        this.fade?.raise();
        this.fade?.reveal();
        // A link with `?mission=` skips the menu: the page's loading splash is still up.
        WebPage.hideSplash();
      })
      .catch((err: unknown) => console.error('[GameWorld] boot failed', err));
  }

  onDestroy(): void {
    game.off(Game.EVENT_HIDE, this.onHide, this);
    this.input.detach();
    this.s?.audio.stop();
    this.s?.ctx.kit.releaseScene();
  }

  update(dt: number): void {
    keepRenderTargets();
    this.fade?.tick(dt);
    const s = this.s;
    if (!s) return;

    if (s.playfield.resize(screenAspect())) {
      s.cameraRig.apply();
      s.stars.layout();
      s.nebula.layout();
    }

    if (this.paused) this.updatePaused(s);
    else this.updateRunning(s, dt);
    s.audio.tick(this.paused, s.mission.phase === 'results');

    s.stars.render();
    s.nebula.render();
    s.decor.render();
    s.setPieces.render();
    s.player.render();
    s.drones.render();
    s.playerBullets.render();
    s.enemyBullets.render();
    s.enemies.render();
    s.lasers.render();
    s.pickups.render();
    s.fx.render();
    s.cameraRig.render();
    this.present(s, dt);
  }

  private updateRunning(s: Systems, dt: number): void {
    const phase = s.mission.phase;
    if (this.input.consumePress('pause') && phase !== 'results') {
      this.setPaused(true);
      return;
    }
    if (this.input.consumePress('special')) this.specialQueued = true;
    if (phase === 'results') {
      this.specialQueued = false;
      this.input.consumeTap();
      if (this.input.consumePress('retry')) this.restart();
      else if (this.input.consumePress('next')) this.playNext();
      else if (this.input.consumePress('hangar')) this.toMenu('hangar');
      else if (this.input.consumePress('menu')) this.toMenu('main');
      return;
    }
    this.input.consumeTap();

    // Hitstop: the world holds still for a moment of real time; the camera keeps shaking.
    if (this.freeze > 0) {
      this.freeze -= dt;
      s.cameraRig.tick(dt, s.player.x);
      this.fixed.reset();
      return;
    }
    let scale = s.ctx.debug.slowmo;
    if (this.slowmo > 0) {
      // Boss kill: drop to slow motion, then ease back to full speed.
      this.slowmo = Math.max(0, this.slowmo - dt);
      const k = 1 - this.slowmo / BOSS_FX.slowmoTime;
      scale *= BOSS_FX.slowmoScale + (1 - BOSS_FX.slowmoScale) * smoothstep(k);
    }
    if (scale < 1) {
      // Slow motion: one short step every frame. Fixed steps would land only every few frames
      // and the picture would stutter instead of gliding.
      this.fixed.reset();
      this.step(s, Math.min(dt * scale, WORLD.step));
      return;
    }
    const steps = this.fixed.advance(dt * scale);
    for (let i = 0; i < steps; i++) this.step(s, this.fixed.step);
  }

  private updatePaused(s: Systems): void {
    const resume = this.input.consumePress('resume') || this.input.consumePress('pause');
    const restart = this.input.consumePress('restart');
    const quit = this.input.consumePress('menu');
    // Whatever the fingers did on the pause screen must not move the ship afterwards.
    this.input.consumeDrag(this.scratch);
    this.input.consumeTap();
    this.input.consumePress('special');
    if (quit) this.toMenu('main');
    else if (restart) this.restart();
    else if (resume) this.setPaused(false);
    s.hud.showPause(this.paused);
  }

  private step(s: Systems, h: number): void {
    s.cameraRig.tick(h, s.player.x);
    // A hitstop requested mid-frame holds the rest of this frame's steps too.
    if (this.freeze > 0) return;
    const p = s.player;
    // Time Warp: the level, enemies and their bullets run slow; the ship and its guns don't.
    const w = h * p.warpScale;
    s.stars.tick(w);
    s.nebula.tick(w);
    s.decor.tick(w);
    s.mission.tick(w);
    s.setPieces.tick(w);
    p.tick(h, this.specialQueued);
    this.specialQueued = false;
    s.weapons.tick(h);
    s.playerBullets.tick(h);
    s.enemies.tick(w, p.x, p.z, p.alive);
    s.lasers.tick(w);
    s.enemyBullets.tick(w);
    s.drones.tick(h);
    s.pickups.tick(h, p.x, p.z, p.magnetRadius, p.pickupRadius, p.canCollect);
    s.collisions.tick(h);
    s.score.tick(h);
    s.fx.tick(h);
  }

  private present(s: Systems, dt: number): void {
    const hud = s.hud;
    const v = s.player.vitals;
    const stats = s.score.stats;
    hud.setScore(stats.score);
    hud.setCombo(s.score.combo.multiplier);
    hud.setVitals(v.hull, v.maxHull, v.shield, v.maxShield, v.shieldFill);
    hud.setCredits(stats.credits);
    hud.setPods(stats.pods, s.mission.podsTotal);
    hud.setSpecial(s.player.special.label, v.charges, v.energy, s.player.specialLeft);
    const boss = s.enemies.boss;
    hud.setBoss(boss ? boss.def.name : null, boss ? boss.hp / boss.maxHp : 0, boss !== null && s.enemies.isArmored(boss));
    hud.tick(dt);
    if (!this.paused && s.onboarding) s.onboarding.tick(dt);
    if (s.mission.phase === 'results' && !this.resultsShown) {
      this.resultsShown = true;
      this.showResults(s);
    }
    s.overlay?.tick(dt);
  }

  private showResults(s: Systems): void {
    const r = s.mission.result;
    if (!r) return;
    // Runs with debug cheats (god mode, seeking, forced Power or elites, slow motion, everything
    // unlocked, a borrowed loadout) are practice: no records, no credits.
    const d = s.ctx.debug;
    const practice = d.god || d.t > 0 || d.power !== null || d.elite !== null || d.slowmo !== 1 || d.unlock || hasOverride(d.loadout) || d.ship !== null;
    const run = { complete: r.complete, score: r.score, medals: r.medals, killRate: r.killRate };
    const report = practice ? null : SaveService.submitRun(this.missionId, this.difficulty, run, r.credits);
    const next = nextMission(this.missionId);
    s.audio.results(r.complete);
    s.hud.setPlaying(false);
    s.hud.showResults(r, {
      mission: MISSIONS[this.missionId].title,
      difficulty: d.demo ? 'demo' : practice ? `${this.difficulty} · practice` : this.difficulty,
      best: report ? report.update.record.score : SaveService.record(this.missionId, this.difficulty)?.score ?? 0,
      newBest: report ? report.update.newBest : false,
      newMedals: report ? report.update.newMedals : 0,
      rewards: report ? report.rewards : null,
      balance: report ? report.balance : SaveService.credits,
      hasNext: !d.demo && next !== null && (d.unlock || missionUnlocked(SaveService.records, next)),
      unlocked: report ? report.unlocked : [],
      pitch: d.demo ? DEMO.pitch : null,
    });
    // Presses queued during the fight (Enter = retry) must not skip the results screen.
    this.input.flush();
  }

  /** Back to the menu: its main page, or straight into the hangar. The demo has no menu (its MENU is a link, ui/Hud.ts). */
  private toMenu(entry: MenuEntry): void {
    if (this.leaving || this.s?.ctx.debug.demo) return;
    this.leaving = true;
    this.leave(() => SceneRouter.toMenu(entry));
  }

  /** Fades out, then switches scenes. */
  private leave(fn: () => void): void {
    if (this.fade) this.fade.leave(fn);
    else fn();
  }

  /** Reloads the scene with the next mission of the sector (same difficulty). */
  private playNext(): void {
    const next = nextMission(this.missionId);
    if (!next || this.leaving) return;
    this.leaving = true;
    this.leave(() => SceneRouter.play(next, this.difficulty));
  }

  private setPaused(paused: boolean): void {
    this.paused = paused;
    this.fixed.reset();
    this.input.flush();
    this.s?.hud.showPause(paused);
  }

  private onHide(): void {
    const phase = this.s?.mission.phase;
    if (phase && phase !== 'results') this.setPaused(true);
  }

  /** Erases every enemy bullet with a pop; returns how many there were. */
  private eraseEnemyBullets(s: Systems): number {
    const bullets = s.enemyBullets.active;
    const count = bullets.length;
    for (let i = 0; i < count && i < NOVA_FX.maxPops; i++) s.fx.bulletPop(bullets[i].x, bullets[i].z);
    s.enemyBullets.clear();
    return count;
  }

  private restart(): void {
    const s = this.s!;
    const debug = s.ctx.debug;
    s.playerBullets.clear();
    s.enemyBullets.clear();
    s.weapons.clear();
    s.drones.clear();
    s.enemies.clear();
    s.lasers.clear();
    s.pickups.clear();
    s.setPieces.clear();
    s.decor.clear();
    s.fx.clear();
    s.score.reset();
    s.player.reset(debug.power ?? (this.loadout as Loadout).startPower, debug.t > 0);
    s.weapons.reset();
    s.drones.reset();
    s.mission.start(debug.t);
    s.audio.start(debug.t);
    s.onboarding?.reset();
    s.hud.showResults(null, null);
    s.hud.setPlaying(true);
    this.resultsShown = false;
    this.specialQueued = false;
    this.freeze = 0;
    this.slowmo = 0;
    this.fixed.reset();
    this.input.flush();
    this.setPaused(false);
  }

  private async boot(): Promise<void> {
    if (!this.camera || !this.ui || !this.unlitEffect || !this.standardEffect) {
      throw new Error('GameWorld: camera, hudRoot and effects must be assigned in the scene');
    }
    const debug = readDebugFlags();
    let missionId: MissionId = DEFAULT_MISSION;
    let difficulty: Difficulty = debug.difficulty ?? 'normal';
    const launch = SceneRouter.launch;
    if (launch) {
      missionId = launch.mission;
      difficulty = launch.difficulty;
    } else if (debug.mission !== null) {
      if (Object.prototype.hasOwnProperty.call(MISSIONS, debug.mission)) missionId = debug.mission as MissionId;
      else console.warn(`[GameWorld] unknown mission '${debug.mission}', playing ${DEFAULT_MISSION}`);
    }
    this.missionId = missionId;
    this.difficulty = difficulty;
    const shipId = debug.ship ?? SaveService.shipToFly(debug.unlock);
    // The demo's page carries one paint of its ship (tools/build-playable.mjs keeps only that model).
    const paint = debug.demo ? DEFAULT_PAINT : SaveService.paintOf(shipId);
    const ship = SHIPS[shipId];
    const loadout = overrideLoadout(SaveService.loadout(shipId), debug.loadout);
    this.loadout = loadout;
    const mission = MISSIONS[missionId];
    const needs = missionNeeds(mission);
    for (const d of loadout.drones) needs.props.add(DRONES[d.id].prop);
    const enemyIds = Array.from(needs.enemies.keys());
    const propIds = Array.from(needs.props);
    // Assemblies and rocks are built from props / procedural meshes: no prefab of their own.
    const [shipPrefab, enemyPrefabs, propPrefabs] = await Promise.all([
      loadPrefab(shipModel(shipId, paint)),
      Promise.all(enemyIds.map((id) => {
        const path = enemyPrefabPath(id);
        return path ? loadPrefab(path) : Promise.resolve(null);
      })),
      Promise.all(propIds.map((id) => loadPrefab(propPath(id)))),
    ]);
    const prefabs = new Map<EnemyId, Prefab>();
    enemyIds.forEach((id, i) => {
      const prefab = enemyPrefabs[i];
      if (prefab) prefabs.set(id, prefab);
    });
    const props = new Map<PropId, Prefab>(propIds.map((id, i) => [id, propPrefabs[i]]));

    const pipe = pipelineSettings(this.camera);
    if (pipe) {
      pipe.bloomEnable = debug.bloom ?? POST_FX.bloom;
      pipe.fxaaEnable = debug.fxaa ?? POST_FX.fxaa;
      this.scaler = new RenderScaler(pipe, debug);
    }
    const playfield = new Playfield(WORLD, screenAspect());
    const kit = RenderKit.shared(this.unlitEffect, this.standardEffect);
    const bus = new EventBus<GameEvents>();
    const rng = new Rng(debug.seed ?? Math.floor(Math.random() * 0x7fffffff));
    const cameraRig = new CameraRig(this.camera, playfield);
    const ctx: GameContext = {
      bus,
      rng,
      playfield,
      kit,
      debug,
      difficulty,
      tuning: DIFFICULTIES[difficulty],
      worldRoot: this.node,
      hitstop: (seconds) => {
        // The boss kill's slow motion is the emphasis; blasts during it don't stop the world again.
        if (this.slowmo > 0) return;
        this.freeze = Math.max(this.freeze, seconds);
      },
      shake: (amount) => cameraRig.addTrauma(amount),
    };

    const nebula = new Nebula(ctx, sectorOf(missionId) ?? SECTORS[0]);
    const stars = new Starfield(ctx, mission.scrollSpeed);
    const decor = new Decor(ctx, mission.scrollSpeed, mission);
    // Player projectile looks: only the bolts this loadout fires, one instanced draw call each.
    const bolts: BoltId[] = [];
    for (const item of [loadout.primary, loadout.secondary]) {
      const def = item ? WEAPONS[item.id] : null;
      if (def && def.kind === 'bolts' && bolts.indexOf(def.bolt) < 0) bolts.push(def.bolt);
    }
    if (loadout.drones.some((d) => d.id === 'gunDrone')) bolts.push('drone');
    const playerLooks: BulletLook[] = bolts.map((id) => {
      const b = BOLTS[id];
      return { material: kit.glow(b.color, b.intensity), width: b.width, length: b.length, round: b.round };
    });
    const boltLooks = new Map<BoltId, number>(bolts.map((id, i) => [id, i]));
    const playerBullets = new BulletSystem(ctx, 'PlayerBullets', playerLooks, WORLD.heights.playerBullets, bolts.map((id) => BOLTS[id].pool), PLAYER_BULLET_CAP);
    const enemyLooks: BulletLook[] = ENEMY_BULLET_IDS.map((id) => {
      const b = ENEMY_BULLETS[id];
      return { material: kit.orb(b.color, 1.7), width: b.size, length: b.size, round: true };
    });
    const enemyBullets = new BulletSystem(ctx, 'EnemyBullets', enemyLooks, WORLD.heights.enemyBullets, ENEMY_BULLET_POOLS, ENEMY_BULLET_CAP);
    const bulletLookIndex = {} as Record<EnemyBulletId, number>;
    ENEMY_BULLET_IDS.forEach((id, i) => (bulletLookIndex[id] = i));
    const player = new PlayerSystem(ctx, ship, loadout, this.input, shipPrefab);
    const lasers = new LaserSystem(ctx, player, needs.lasers);
    const enemies = new EnemySystem(ctx, needs.enemies, prefabs, props, enemyBullets, bulletLookIndex, mission.groundSpeed, lasers);
    enemies.forceElite = debug.elite;
    const weapons = new WeaponSystem(ctx, loadout, player, playerBullets, enemies, boltLooks);
    const pickups = new PickupSystem(ctx, props);
    const drones = new DroneSystem(ctx, loadout, player, playerBullets, enemyBullets, pickups, boltLooks.get('drone') ?? -1, props);
    const setPieces = new SetPieceSystem(ctx, enemies, pickups, needs.setPieces, props, mission.groundSpeed);
    const collisions = new CollisionSystem(ctx, player, playerBullets, enemyBullets, enemies);
    const score = new ScoreSystem(ctx, missionPay(missionId));
    const missionDirector = new MissionDirector(ctx, mission, enemies, setPieces, pickups, player, score);
    const fx = new FxSystem(ctx);
    const settings = SettingsService.current;
    player.sensitivity = settings.sensitivity;
    const hud = new Hud(this.ui, { title: this.titleFont }, { leftHanded: settings.handedness === 'left', showFps: settings.showFps, menuLink: debug.demo ? { label: DEMO.cta, url: DEMO.fullGameUrl } : null });
    const audio = new GameAudio(ctx, mission, weapons);
    // Mission 1-1 teaches the controls until it has been cleared once.
    const teach = mission.onboarding === true && debug.t === 0 && !isCleared(SaveService.records, missionId);
    const onboarding = teach ? new Onboarding(ctx, player, pickups, enemyBullets, hud, !sys.isMobile) : null;
    if (!debug.overlay) profiler.hideStats();
    const overlay = debug.overlay
      ? new DebugOverlay(
          hud.debugLabel(),
          () => ({ enemies: enemies.count, bullets: playerBullets.count, enemyBullets: enemyBullets.count + lasers.count, pickups: pickups.count, fx: fx.count + decor.count }),
          () => {
            const t = missionDirector.timeline;
            const kit = `${loadout.primary.id}${loadout.secondary ? `+${loadout.secondary.id}` : ''}`;
            return `${mission.id} ${difficulty}  t ${t.time.toFixed(1)}s ${missionDirector.phase}${t.holding !== 'none' ? `/${t.holding}` : ''}  P${player.firePower} ${kit}${debug.god ? '  GOD' : ''}  ${this.scaler?.label ?? ''}`;
          },
        )
      : null;

    const s: Systems = {
      ctx, playfield, stars, nebula, decor, player, weapons, drones, playerBullets, enemyBullets, enemies, lasers, setPieces, pickups,
      collisions, score, mission: missionDirector, fx, cameraRig, hud, audio, onboarding, overlay,
    };
    bus.on('banner', (e) => hud.showBanner(e.text, e.sub, e.style, e.time));
    const nova = SPECIALS.nova;
    bus.on('novaBomb', () => {
      // Damage first: whatever bursts on death (mines, Volatile elites) is erased with the rest.
      if (nova.kind === 'nova') enemies.damageVisible(nova.damage);
      const erased = this.eraseEnemyBullets(s);
      lasers.clear();
      if (nova.kind === 'nova') bus.emit('scoreBonus', { amount: erased * nova.bulletScore });
    });
    bus.on('enemyKilled', (e) => {
      if (!e.boss) return;
      this.eraseEnemyBullets(s);
      this.slowmo = BOSS_FX.slowmoTime;
    });
    bus.on('armorBroken', () => hud.showBanner('CORE EXPOSED', '', 'success', 1.6));
    bus.on('podsLaunched', () => hud.flashPods());

    this.s = s;
    this.input.attach((x, y) => hud.hitTest(x, y));
    this.restart();
  }
}
