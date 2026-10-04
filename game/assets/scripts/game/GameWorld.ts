// Entry point of the Game scene: loads assets, builds the systems and runs the fixed-step loop.
// Simulation order: stars → waves → player → bullets → enemies → collisions → fx → camera.

import { _decorator, Camera, Component, EffectAsset, Node, Prefab, resources, screen } from 'cc';
import { EventBus } from '../core/EventBus';
import { FixedStep } from '../core/FixedStep';
import { Rng } from '../core/Rng';
import { WaveDirector } from '../core/WaveDirector';
import { formationOffsets } from '../core/formations';
import { ENEMIES } from '../data/enemies';
import { SPITFIRE } from '../data/player';
import type { EnemyId, WaveEvent } from '../data/types';
import { SLICE_LOOP_GAP, SLICE_WAVES } from '../data/waves';
import { PULSE_CANNON } from '../data/weapons';
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
import { BulletSystem } from './BulletSystem';
import { CollisionSystem } from './CollisionSystem';
import { EnemySystem } from './EnemySystem';
import type { GameContext, GameEvents } from './GameContext';
import { Playfield } from './Playfield';
import { PlayerSystem } from './PlayerSystem';

const { ccclass, property } = _decorator;

type State = 'loading' | 'playing' | 'gameover';

interface Systems {
  ctx: GameContext;
  playfield: Playfield;
  stars: Starfield;
  nebula: Nebula;
  director: WaveDirector<WaveEvent>;
  player: PlayerSystem;
  playerBullets: BulletSystem;
  enemies: EnemySystem;
  collisions: CollisionSystem;
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

  private state: State = 'loading';
  private s: Systems | null = null;
  private readonly input = new InputService();
  private readonly fixed = new FixedStep(WORLD.step);
  private freeze = 0;
  private score = 0;
  private gameOverTime = 0;

  start(): void {
    this.boot().catch((err: unknown) => console.error('[GameWorld] boot failed', err));
  }

  onDestroy(): void {
    this.input.detach();
  }

  update(dt: number): void {
    const s = this.s;
    if (!s || this.state === 'loading') return;

    if (s.playfield.resize(screenAspect())) {
      s.cameraRig.apply();
      s.stars.layout();
      s.nebula.layout();
    }

    const steps = this.fixed.advance(dt * s.ctx.debug.slowmo);
    for (let i = 0; i < steps; i++) this.step(s, this.fixed.step);

    s.stars.render();
    s.nebula.render();
    s.player.render();
    s.playerBullets.render();
    s.enemies.render();
    s.fx.render();
    s.cameraRig.render();
    s.hud.setScore(this.score);
    s.hud.setHull(s.player.hull, SPITFIRE.hull);
    s.overlay?.tick(dt);

    const tapped = this.input.consumeTap();
    if (this.state === 'gameover') {
      this.gameOverTime += dt;
      if (this.gameOverTime > 1) s.hud.showGameOver(this.score, true);
      if (tapped && this.gameOverTime > 1) this.restart();
    }
  }

  private step(s: Systems, h: number): void {
    s.cameraRig.tick(h, s.player.x);
    if (this.freeze > 0) {
      this.freeze -= h;
      return;
    }
    s.stars.tick(h);
    s.nebula.tick(h);
    s.director.tick(h, (event) => this.spawnWave(s, event));
    s.player.tick(h);
    s.playerBullets.tick(h);
    s.enemies.tick(h, s.player.x, s.player.z);
    s.collisions.tick();
    s.fx.tick(h);
  }

  private spawnWave(s: Systems, event: WaveEvent): void {
    const z0 = s.playfield.spawnZ;
    const anchorX = event.x * s.playfield.halfWidth(z0) * 0.75;
    for (const o of formationOffsets(event.formation)) s.enemies.spawn(event.enemy, anchorX + o.dx, z0 + o.dz, o.index);
  }

  private restart(): void {
    const s = this.s!;
    s.playerBullets.clear();
    s.enemies.clear();
    s.fx.clear();
    s.director.reset();
    if (s.ctx.debug.t > 0) s.director.seek(s.ctx.debug.t);
    s.player.reset(s.ctx.debug.power);
    s.hud.hideMessage();
    this.score = 0;
    this.freeze = 0;
    this.fixed.reset();
    this.state = 'playing';
  }

  private async boot(): Promise<void> {
    if (!this.camera || !this.hudRoot || !this.unlitEffect || !this.standardEffect) {
      throw new Error('GameWorld: camera, hudRoot and effects must be assigned in the scene');
    }
    const debug = readDebugFlags();
    const enemyIds = Object.keys(ENEMIES) as EnemyId[];
    const [shipPrefab, ...enemyPrefabs] = await Promise.all([
      loadPrefab(SPITFIRE.model),
      ...enemyIds.map((id) => loadPrefab(ENEMIES[id].model)),
    ]);

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
      worldRoot: this.node,
      hitstop: (seconds) => {
        this.freeze = Math.max(this.freeze, seconds);
      },
      shake: (amount) => cameraRig.addTrauma(amount),
    };

    const nebula = new Nebula(ctx);
    const stars = new Starfield(ctx, WORLD.scrollSpeed);
    const playerBullets = new BulletSystem(ctx, 'PlayerBullets', PULSE_CANNON.color, 1.3, 64);
    const player = new PlayerSystem(ctx, SPITFIRE, PULSE_CANNON, playerBullets, this.input, shipPrefab);
    const enemies = new EnemySystem(ctx, new Map(enemyIds.map((id, i) => [id, enemyPrefabs[i]])));
    const collisions = new CollisionSystem(ctx, player, playerBullets, enemies);
    const fx = new FxSystem(ctx);
    const hud = new Hud(this.hudRoot);
    const director = new WaveDirector(SLICE_WAVES, { loop: true, loopGap: SLICE_LOOP_GAP });
    const overlay = debug.overlay
      ? new DebugOverlay(
          hud.debugLabel(),
          () => ({ enemies: enemies.count, bullets: playerBullets.count, fx: fx.count }),
          () => `t ${director.elapsed.toFixed(1)}s  loop ${director.loopCount}  power ${player.power}${debug.god ? '  GOD' : ''}`,
        )
      : null;

    bus.on('enemyKilled', (e) => {
      this.score += e.score;
    });
    bus.on('playerDied', () => {
      this.state = 'gameover';
      this.gameOverTime = 0;
      hud.showGameOver(this.score, false);
    });

    this.s = { ctx, playfield, stars, nebula, director, player, playerBullets, enemies, collisions, fx, cameraRig, hud, overlay };
    this.input.attach();
    this.restart();
  }
}
