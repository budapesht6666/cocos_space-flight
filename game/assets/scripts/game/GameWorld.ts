// Entry point of the Game scene: loads the mission's assets, builds the systems and runs the
// fixed-step loop. Simulation order: camera → stars → mission (timeline spawns) → set pieces →
// player → bullets → enemies (movement, fire) → enemy bullets → pickups → collisions → score → fx.
// The mission comes from the start screen (services/Launch), or from URL flags when the scene is
// opened directly.

import { _decorator, Camera, Component, EffectAsset, Game, Node, Prefab, TTFFont, Vec2, director, game, profiler, resources, screen } from 'cc';
import { EventBus } from '../core/EventBus';
import { FixedStep } from '../core/FixedStep';
import { missionNeeds } from '../core/missionNeeds';
import { Rng } from '../core/Rng';
import { DIFFICULTIES } from '../data/difficulty';
import { ENEMIES } from '../data/enemies';
import { DEFAULT_MISSION, MISSIONS, nextMission } from '../data/missions';
import { DEFAULT_LOADOUT, NOVA_BOMB, SPITFIRE } from '../data/player';
import { propPath } from '../data/props';
import type { Difficulty, EnemyBulletId, EnemyId, MissionId, PropId } from '../data/types';
import { BOSS_FX, NOVA_FX } from '../data/visuals';
import { ENEMY_BULLET_CAP, ENEMY_BULLETS, PULSE_CANNON } from '../data/weapons';
import { WORLD } from '../data/world';
import { DebugOverlay } from '../debug/DebugOverlay';
import { readDebugFlags } from '../debug/DebugFlags';
import { CameraRig } from '../fx/CameraRig';
import { Decor } from '../fx/Decor';
import { FxSystem } from '../fx/FxSystem';
import { Nebula } from '../fx/Nebula';
import { RenderKit } from '../fx/RenderKit';
import { Starfield } from '../fx/Starfield';
import { InputService } from '../services/InputService';
import { Launch, SCENES } from '../services/Launch';
import { RecordStore } from '../services/RecordStore';
import { Hud } from '../ui/Hud';
import { BulletSystem, type BulletLook } from './BulletSystem';
import { CollisionSystem } from './CollisionSystem';
import { EnemySystem } from './EnemySystem';
import type { GameContext, GameEvents } from './GameContext';
import { MissionDirector } from './MissionDirector';
import { PickupSystem } from './PickupSystem';
import { Playfield } from './Playfield';
import { PlayerSystem } from './PlayerSystem';
import { ScoreSystem } from './ScoreSystem';
import { SetPieceSystem } from './SetPieceSystem';

const { ccclass, property } = _decorator;

const ENEMY_BULLET_IDS: readonly EnemyBulletId[] = ['orb', 'orbLarge'];

interface Systems {
  ctx: GameContext;
  playfield: Playfield;
  stars: Starfield;
  nebula: Nebula;
  decor: Decor;
  player: PlayerSystem;
  playerBullets: BulletSystem;
  enemyBullets: BulletSystem;
  enemies: EnemySystem;
  setPieces: SetPieceSystem;
  pickups: PickupSystem;
  collisions: CollisionSystem;
  score: ScoreSystem;
  mission: MissionDirector;
  fx: FxSystem;
  cameraRig: CameraRig;
  hud: Hud;
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
  private missionId: MissionId = DEFAULT_MISSION;
  private difficulty: Difficulty = 'normal';
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
    game.on(Game.EVENT_HIDE, this.onHide, this);
    this.boot().catch((err: unknown) => console.error('[GameWorld] boot failed', err));
  }

  onDestroy(): void {
    game.off(Game.EVENT_HIDE, this.onHide, this);
    this.input.detach();
  }

  update(dt: number): void {
    const s = this.s;
    if (!s) return;

    if (s.playfield.resize(screenAspect())) {
      s.cameraRig.apply();
      s.stars.layout();
      s.nebula.layout();
    }

    if (this.paused) this.updatePaused(s);
    else this.updateRunning(s, dt);

    s.stars.render();
    s.nebula.render();
    s.decor.render();
    s.setPieces.render();
    s.player.render();
    s.playerBullets.render();
    s.enemyBullets.render();
    s.enemies.render();
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
      else if (this.input.consumePress('menu')) this.toMenu();
      return;
    }
    this.input.consumeTap();

    let scale = s.ctx.debug.slowmo;
    if (this.slowmo > 0) {
      // Boss kill: drop to slow motion, then ease back to full speed.
      this.slowmo = Math.max(0, this.slowmo - dt);
      const k = 1 - this.slowmo / BOSS_FX.slowmoTime;
      scale *= BOSS_FX.slowmoScale + (1 - BOSS_FX.slowmoScale) * k * k;
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
    if (quit) this.toMenu();
    else if (restart) this.restart();
    else if (resume) this.setPaused(false);
    s.hud.showPause(this.paused);
  }

  private step(s: Systems, h: number): void {
    s.cameraRig.tick(h, s.player.x);
    if (this.freeze > 0) {
      this.freeze -= h;
      return;
    }
    const p = s.player;
    s.stars.tick(h);
    s.nebula.tick(h);
    s.decor.tick(h);
    s.mission.tick(h);
    s.setPieces.tick(h);
    p.tick(h, this.specialQueued);
    this.specialQueued = false;
    s.playerBullets.tick(h);
    s.enemies.tick(h, p.x, p.z, p.alive);
    s.enemyBullets.tick(h);
    s.pickups.tick(h, p.x, p.z, p.magnetRadius, p.pickupRadius, p.canCollect);
    s.collisions.tick();
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
    hud.setSpecial(v.charges, v.energy);
    const boss = s.enemies.boss;
    hud.setBoss(boss ? boss.def.name : null, boss ? boss.hp / boss.maxHp : 0, boss !== null && s.enemies.isArmored(boss));
    hud.tick(dt);
    if (s.mission.phase === 'results' && !this.resultsShown) {
      this.resultsShown = true;
      this.showResults(s);
    }
    s.overlay?.tick(dt);
  }

  private showResults(s: Systems): void {
    const r = s.mission.result;
    if (!r) return;
    // Runs with debug cheats (god mode, seeking, forced Power or elites, slow motion) are not recorded.
    const d = s.ctx.debug;
    const practice = d.god || d.t > 0 || d.power !== null || d.elite !== null || d.slowmo !== 1;
    const run = { complete: r.complete, score: r.score, medals: r.medals, killRate: r.killRate };
    const update = practice ? null : RecordStore.submit(this.missionId, this.difficulty, run);
    s.hud.setPlaying(false);
    s.hud.showResults(r, {
      mission: MISSIONS[this.missionId].title,
      difficulty: practice ? `${this.difficulty} · practice` : this.difficulty,
      best: update ? update.record.score : RecordStore.get(this.missionId, this.difficulty)?.score ?? 0,
      newBest: update ? update.newBest : false,
      newMedals: update ? update.newMedals : 0,
      hasNext: nextMission(this.missionId) !== null,
    });
    // Presses queued during the fight (Enter = retry) must not skip the results screen.
    this.input.flush();
  }

  /** Back to the start screen. */
  private toMenu(): void {
    if (this.leaving) return;
    this.leaving = true;
    director.loadScene(SCENES.menu);
  }

  /** Reloads the scene with the next mission of the sector (same difficulty). */
  private playNext(): void {
    const next = nextMission(this.missionId);
    if (!next || this.leaving) return;
    this.leaving = true;
    Launch.set(next, this.difficulty);
    RecordStore.setLast(next, this.difficulty);
    director.loadScene(SCENES.game);
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
    s.enemies.clear();
    s.pickups.clear();
    s.setPieces.clear();
    s.decor.clear();
    s.fx.clear();
    s.score.reset();
    s.player.reset(debug.power ?? DEFAULT_LOADOUT.startPower, debug.t > 0);
    s.mission.start(debug.t);
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
    if (!this.camera || !this.hudRoot || !this.unlitEffect || !this.standardEffect) {
      throw new Error('GameWorld: camera, hudRoot and effects must be assigned in the scene');
    }
    const debug = readDebugFlags();
    let missionId: MissionId = DEFAULT_MISSION;
    let difficulty: Difficulty = debug.difficulty ?? 'normal';
    const launch = Launch.current;
    if (launch) {
      missionId = launch.mission;
      difficulty = launch.difficulty;
    } else if (debug.mission !== null) {
      if (Object.prototype.hasOwnProperty.call(MISSIONS, debug.mission)) missionId = debug.mission as MissionId;
      else console.warn(`[GameWorld] unknown mission '${debug.mission}', playing ${DEFAULT_MISSION}`);
    }
    this.missionId = missionId;
    this.difficulty = difficulty;
    const mission = MISSIONS[missionId];
    const needs = missionNeeds(mission);
    const enemyIds = Array.from(needs.enemies.keys());
    const propIds = Array.from(needs.props);
    // Assemblies and rocks are built from props / procedural meshes: no prefab of their own.
    const enemyPath = (id: EnemyId): string | null => {
      const look = ENEMIES[id].look;
      return look.kind === 'model' ? look.path : look.kind === 'prop' ? propPath(look.prop) : null;
    };
    const [shipPrefab, enemyPrefabs, propPrefabs] = await Promise.all([
      loadPrefab(SPITFIRE.model),
      Promise.all(enemyIds.map((id) => {
        const path = enemyPath(id);
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

    const playfield = new Playfield(WORLD, screenAspect());
    const kit = new RenderKit(this.unlitEffect, this.standardEffect);
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
        this.freeze = Math.max(this.freeze, seconds);
      },
      shake: (amount) => cameraRig.addTrauma(amount),
    };

    const nebula = new Nebula(ctx);
    const stars = new Starfield(ctx, mission.scrollSpeed);
    const decor = new Decor(ctx, mission.scrollSpeed);
    const playerLooks: BulletLook[] = [
      { material: kit.glow(PULSE_CANNON.color, 1.3), width: PULSE_CANNON.bulletWidth, length: PULSE_CANNON.bulletLength, round: false },
    ];
    const playerBullets = new BulletSystem(ctx, 'PlayerBullets', playerLooks, WORLD.heights.playerBullets, 64, 400);
    const enemyLooks: BulletLook[] = ENEMY_BULLET_IDS.map((id) => {
      const b = ENEMY_BULLETS[id];
      return { material: kit.orb(b.color, 1.7), width: b.size, length: b.size, round: true };
    });
    const enemyBullets = new BulletSystem(ctx, 'EnemyBullets', enemyLooks, WORLD.heights.enemyBullets, 96, ENEMY_BULLET_CAP);
    const bulletLookIndex = {} as Record<EnemyBulletId, number>;
    ENEMY_BULLET_IDS.forEach((id, i) => (bulletLookIndex[id] = i));
    const player = new PlayerSystem(ctx, SPITFIRE, DEFAULT_LOADOUT, PULSE_CANNON, playerBullets, this.input, shipPrefab);
    const enemies = new EnemySystem(ctx, needs.enemies, prefabs, props, enemyBullets, bulletLookIndex, mission.groundSpeed);
    enemies.forceElite = debug.elite;
    const pickups = new PickupSystem(ctx, props);
    const setPieces = new SetPieceSystem(ctx, enemies, pickups, needs.setPieces, props, mission.groundSpeed);
    const collisions = new CollisionSystem(ctx, player, playerBullets, enemyBullets, enemies);
    const score = new ScoreSystem(ctx);
    const missionDirector = new MissionDirector(ctx, mission, enemies, setPieces, pickups, player, score);
    const fx = new FxSystem(ctx);
    const hud = new Hud(this.hudRoot, { title: this.titleFont });
    if (!debug.overlay) profiler.hideStats();
    const overlay = debug.overlay
      ? new DebugOverlay(
          hud.debugLabel(),
          () => ({ enemies: enemies.count, bullets: playerBullets.count, enemyBullets: enemyBullets.count, pickups: pickups.count, fx: fx.count + decor.count }),
          () => {
            const t = missionDirector.timeline;
            return `${mission.id} ${difficulty}  t ${t.time.toFixed(1)}s ${missionDirector.phase}${t.holding !== 'none' ? `/${t.holding}` : ''}  P${player.power}${debug.god ? '  GOD' : ''}`;
          },
        )
      : null;

    const s: Systems = {
      ctx, playfield, stars, nebula, decor, player, playerBullets, enemyBullets, enemies, setPieces, pickups,
      collisions, score, mission: missionDirector, fx, cameraRig, hud, overlay,
    };
    bus.on('banner', (e) => hud.showBanner(e.text, e.sub, e.style, e.time));
    bus.on('novaBomb', () => {
      const erased = this.eraseEnemyBullets(s);
      bus.emit('scoreBonus', { amount: erased * NOVA_BOMB.bulletScore });
      enemies.damageVisible(NOVA_BOMB.damage);
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
