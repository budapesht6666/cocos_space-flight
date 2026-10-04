// Entry point of the Game scene: loads the mission's assets, builds the systems and runs the
// fixed-step loop. Simulation order: camera → stars → mission (timeline spawns) → set pieces →
// player → bullets → enemies (movement, fire) → enemy bullets → pickups → collisions → score → fx.

import { _decorator, Camera, Component, EffectAsset, Game, Node, Prefab, Vec2, game, resources, screen } from 'cc';
import { EventBus } from '../core/EventBus';
import { FixedStep } from '../core/FixedStep';
import { missionNeeds } from '../core/missionNeeds';
import { Rng } from '../core/Rng';
import { DIFFICULTIES } from '../data/difficulty';
import { ENEMIES } from '../data/enemies';
import { DEFAULT_MISSION, MISSIONS } from '../data/missions';
import { DEFAULT_LOADOUT, NOVA_BOMB, SPITFIRE } from '../data/player';
import { propPath } from '../data/props';
import type { EnemyBulletId, EnemyId, MissionId, PropId } from '../data/types';
import { NOVA_FX } from '../data/visuals';
import { ENEMY_BULLET_CAP, ENEMY_BULLETS, PULSE_CANNON } from '../data/weapons';
import { WORLD } from '../data/world';
import { DebugOverlay } from '../debug/DebugOverlay';
import { readDebugFlags } from '../debug/DebugFlags';
import { CameraRig } from '../fx/CameraRig';
import { FxSystem } from '../fx/FxSystem';
import { Nebula } from '../fx/Nebula';
import { RenderKit } from '../fx/RenderKit';
import { Starfield } from '../fx/Starfield';
import { InputService } from '../services/InputService';
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

  private s: Systems | null = null;
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
      if (this.input.consumeTap() || this.specialQueued) this.restart();
      return;
    }
    this.input.consumeTap();

    const steps = this.fixed.advance(dt * s.ctx.debug.slowmo);
    for (let i = 0; i < steps; i++) this.step(s, this.fixed.step);
  }

  private updatePaused(s: Systems): void {
    const resume = this.input.consumePress('resume') || this.input.consumePress('pause');
    const restart = this.input.consumePress('restart');
    // Whatever the fingers did on the pause screen must not move the ship afterwards.
    this.input.consumeDrag(this.scratch);
    this.input.consumeTap();
    this.input.consumePress('special');
    if (restart) this.restart();
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
    hud.setHull(v.hull, v.maxHull);
    hud.setShield(v.shield, v.maxShield);
    hud.setCredits(stats.credits);
    hud.setSpecial(v.charges, v.energy);
    const boss = s.enemies.boss;
    hud.setBoss(boss ? boss.def.name : null, boss ? boss.hp / boss.maxHp : 0);
    hud.tick(dt);
    if (s.mission.phase === 'results' && !this.resultsShown) {
      this.resultsShown = true;
      hud.setPlaying(false);
      hud.showResults(s.mission.result);
    }
    s.overlay?.tick(dt);
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
    s.fx.clear();
    s.score.reset();
    s.player.reset(debug.power ?? DEFAULT_LOADOUT.startPower, debug.t > 0);
    s.mission.start(debug.t);
    s.hud.showResults(null);
    s.hud.setPlaying(true);
    this.resultsShown = false;
    this.specialQueued = false;
    this.freeze = 0;
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
    if (debug.mission !== null) {
      if (Object.prototype.hasOwnProperty.call(MISSIONS, debug.mission)) missionId = debug.mission as MissionId;
      else console.warn(`[GameWorld] unknown mission '${debug.mission}', playing ${DEFAULT_MISSION}`);
    }
    const mission = MISSIONS[missionId];
    const difficulty = debug.difficulty ?? 'normal';
    const needs = missionNeeds(mission);
    const enemyIds = Array.from(needs.enemies.keys());
    const propIds = Array.from(needs.props);
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
    const enemies = new EnemySystem(ctx, needs.enemies, prefabs, enemyBullets, bulletLookIndex, mission.groundSpeed);
    const setPieces = new SetPieceSystem(ctx, enemies, needs.setPieces, props, mission.groundSpeed);
    const pickups = new PickupSystem(ctx, props);
    const collisions = new CollisionSystem(ctx, player, playerBullets, enemyBullets, enemies);
    const score = new ScoreSystem(ctx);
    const missionDirector = new MissionDirector(ctx, mission, enemies, setPieces, pickups, player, score);
    const fx = new FxSystem(ctx);
    const hud = new Hud(this.hudRoot);
    const overlay = debug.overlay
      ? new DebugOverlay(
          hud.debugLabel(),
          () => ({ enemies: enemies.count, bullets: playerBullets.count, enemyBullets: enemyBullets.count, pickups: pickups.count, fx: fx.count }),
          () => {
            const t = missionDirector.timeline;
            return `${mission.id} ${difficulty}  t ${t.time.toFixed(1)}s ${missionDirector.phase}${t.holding !== 'none' ? `/${t.holding}` : ''}  P${player.power}${debug.god ? '  GOD' : ''}`;
          },
        )
      : null;

    const s: Systems = {
      ctx, playfield, stars, nebula, player, playerBullets, enemyBullets, enemies, setPieces, pickups,
      collisions, score, mission: missionDirector, fx, cameraRig, hud, overlay,
    };
    bus.on('banner', (e) => hud.showBanner(e.text, e.sub, e.style, e.time));
    bus.on('novaBomb', () => {
      const erased = this.eraseEnemyBullets(s);
      bus.emit('scoreBonus', { amount: erased * NOVA_BOMB.bulletScore });
      enemies.damageVisible(NOVA_BOMB.damage);
    });
    bus.on('enemyKilled', (e) => {
      if (e.boss) this.eraseEnemyBullets(s);
    });

    this.s = s;
    this.input.attach((x, y) => hud.hitTest(x, y));
    this.restart();
  }
}
