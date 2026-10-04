// Runs a mission: intro → combat (the level timeline) → outro → results, or failure.
// Implements LevelHost, turning timeline events into enemies, set pieces and the boss, and tracks
// spawn groups so a fully destroyed wave drops its bonus pickup.

import { formationOffsets, formationSize, type Offset } from '../core/formations';
import { LevelTimeline, type LevelHost } from '../core/LevelTimeline';
import { atLeast } from '../data/difficulty';
import { ENEMIES } from '../data/enemies';
import { BOSS_WARNING_TIME } from '../data/missions';
import { SHIP_FLIGHT } from '../data/player';
import type { BossEvent, MissionDef, PickupKind, SetPieceEvent, SpawnEvent } from '../data/types';
import type { EnemySystem } from './EnemySystem';
import type { GameContext } from './GameContext';
import type { PickupSystem } from './PickupSystem';
import type { PlayerSystem } from './PlayerSystem';
import type { ScoreSystem } from './ScoreSystem';
import type { SetPieceSystem } from './SetPieceSystem';

export type MissionPhase = 'intro' | 'combat' | 'outro' | 'failed' | 'results';

export interface MissionResult {
  complete: boolean;
  score: number;
  credits: number;
  kills: number;
  spawned: number;
  grazes: number;
  bestMultiplier: number;
  hullLost: number;
  shieldBonus: number;
  noDamageBonus: number;
  /** Mission clock at the end, seconds. */
  time: number;
}

interface Group {
  remaining: number;
  /** A member escaped: no bonus. */
  broken: boolean;
  bonus: PickupKind | undefined;
  x: number;
  z: number;
}

/** Seconds from the ship's death to the results screen. */
const FAIL_DELAY = 1.8;

export class MissionDirector implements LevelHost {
  phase: MissionPhase = 'intro';
  result: MissionResult | null = null;
  readonly timeline: LevelTimeline;
  private phaseTime = 0;
  private outroStarted = false;
  private readonly offsets = new Map<SpawnEvent, Offset[]>();
  private readonly groups: Group[] = [];
  private readonly freeGroups: number[] = [];

  constructor(
    private readonly ctx: GameContext,
    readonly mission: MissionDef,
    private readonly enemies: EnemySystem,
    private readonly setPieces: SetPieceSystem,
    private readonly pickups: PickupSystem,
    private readonly player: PlayerSystem,
    private readonly score: ScoreSystem,
  ) {
    this.timeline = new LevelTimeline(mission.events, BOSS_WARNING_TIME);
    for (const e of mission.events) if (e.type === 'spawn') this.offsets.set(e, formationOffsets(e.formation));

    ctx.bus.on('enemyKilled', (e) => {
      if (e.group >= 0) this.memberGone(e.group, false, e.x, e.z);
    });
    ctx.bus.on('enemyEscaped', (e) => {
      if (e.group >= 0) this.memberGone(e.group, true, 0, 0);
    });
    ctx.bus.on('playerDied', () => {
      if (this.phase === 'combat' || this.phase === 'outro') this.setPhase('failed');
    });
  }

  /** Starts (or restarts) the mission; `seekT` > 0 skips the intro and jumps the timeline. */
  start(seekT: number): void {
    this.result = null;
    this.outroStarted = false;
    this.groups.length = 0;
    this.freeGroups.length = 0;
    if (seekT > 0) {
      this.timeline.seek(seekT);
      this.setPhase('combat');
    } else {
      this.timeline.reset();
      this.setPhase('intro');
      this.banner(this.mission.title, this.mission.subtitle, 'title', SHIP_FLIGHT.introTime + SHIP_FLIGHT.bannerTime);
    }
  }

  tick(dt: number): void {
    this.phaseTime += dt;
    switch (this.phase) {
      case 'intro':
        if (this.player.mode === 'control') this.setPhase('combat');
        break;
      case 'combat':
        this.timeline.tick(dt, this);
        if (this.timeline.exhausted && this.enemies.count === 0) this.beginOutro();
        break;
      case 'outro':
        if (!this.outroStarted && this.phaseTime >= SHIP_FLIGHT.outroDelay) {
          this.outroStarted = true;
          this.player.beginOutro(SHIP_FLIGHT.outroTime);
        }
        if (this.phaseTime >= SHIP_FLIGHT.outroDelay + SHIP_FLIGHT.outroTime) this.finish(true);
        break;
      case 'failed':
        if (this.phaseTime >= FAIL_DELAY) this.finish(false);
        break;
      case 'results':
        break;
    }
  }

  // ---- LevelHost ------------------------------------------------------------------------------

  accepts(event: SpawnEvent): boolean {
    return atLeast(this.ctx.difficulty, event.minDifficulty);
  }

  openGroup(event: SpawnEvent): number {
    const index = this.freeGroups.length > 0 ? (this.freeGroups.pop() as number) : this.groups.push({ remaining: 0, broken: false, bonus: undefined, x: 0, z: 0 }) - 1;
    const g = this.groups[index];
    g.remaining = formationSize(event.formation);
    g.broken = false;
    g.bonus = event.bonus;
    return index;
  }

  spawnMember(event: SpawnEvent, member: number, group: number): void {
    const def = ENEMIES[event.enemy];
    const field = this.ctx.playfield;
    const x = field.contentX(event.mirror ? -event.x : event.x);
    const offset = (this.offsets.get(event) as Offset[])[member];
    this.enemies.spawn(def, event.move ?? def.move, x, field.spawnZ, offset, event.mirror === true, group);
  }

  spawnSetPiece(event: SetPieceEvent): void {
    this.setPieces.spawn(event);
  }

  warnBoss(event: BossEvent): void {
    this.banner('WARNING', ENEMIES[event.enemy].name, 'warning', BOSS_WARNING_TIME);
  }

  spawnBoss(event: BossEvent): void {
    const def = ENEMIES[event.enemy];
    const field = this.ctx.playfield;
    const boss = this.enemies.spawn(def, def.move, field.contentX(event.x), field.spawnZ - def.radius, null, false, -1);
    this.enemies.markBoss(boss);
  }

  isClear(): boolean {
    return this.enemies.count === 0;
  }

  isBossAlive(): boolean {
    return this.enemies.boss !== null;
  }

  // ---------------------------------------------------------------------------------------------

  private beginOutro(): void {
    this.setPhase('outro');
    this.pickups.collectAll = true;
    this.player.vitals.makeInvulnerable(SHIP_FLIGHT.outroDelay + SHIP_FLIGHT.outroTime + 1);
    this.banner('MISSION COMPLETE', this.mission.subtitle, 'success', SHIP_FLIGHT.outroDelay + SHIP_FLIGHT.outroTime);
  }

  private finish(complete: boolean): void {
    const v = this.player.vitals;
    const bonus = complete ? this.score.missionBonus(v.shield, v.hullLost) : { shield: 0, noDamage: 0 };
    const s = this.score.stats;
    this.result = {
      complete,
      score: s.score,
      credits: s.credits,
      kills: s.kills,
      spawned: this.enemies.spawnedTally,
      grazes: s.grazes,
      bestMultiplier: s.bestMultiplier,
      hullLost: v.hullLost,
      shieldBonus: bonus.shield,
      noDamageBonus: bonus.noDamage,
      time: this.timeline.time,
    };
    this.setPhase('results');
  }

  private memberGone(index: number, escaped: boolean, x: number, z: number): void {
    const g = this.groups[index];
    if (!g || g.remaining <= 0) return;
    g.remaining--;
    if (escaped) g.broken = true;
    else {
      g.x = x;
      g.z = z;
    }
    if (g.remaining > 0) return;
    if (!g.broken && g.bonus) this.pickups.spawn(g.bonus, g.x, g.z);
    this.freeGroups.push(index);
  }

  private setPhase(phase: MissionPhase): void {
    this.phase = phase;
    this.phaseTime = 0;
  }

  private banner(text: string, sub: string, style: 'title' | 'warning' | 'success', time: number): void {
    this.ctx.bus.emit('banner', { text, sub, style, time });
  }
}
