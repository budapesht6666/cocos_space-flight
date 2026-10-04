// Plays a mission timeline (data/missions.ts). Engine-free: the game supplies a LevelHost.
//
// The mission clock stops while a `waitClear` is waiting for the field to empty and while a boss
// is announced and alive, so later events stay relative to the end of the hold. Staggered members
// of a spawn group run on real time, so a hold never waits for its own clock.

import type { BossEvent, DecorEvent, LevelEvent, SetPieceEvent, SpawnEvent } from '../data/types';
import { formationSize } from './formations';

export interface LevelHost {
  /** Difficulty gate for spawn events. */
  accepts(event: SpawnEvent): boolean;
  /** Starts a spawn group; the returned id comes back with every member. */
  openGroup(event: SpawnEvent): number;
  spawnMember(event: SpawnEvent, member: number, group: number): void;
  spawnSetPiece(event: SetPieceEvent): void;
  /** Background scenery starts drifting past. */
  startDecor(event: DecorEvent): void;
  /** Boss announced (WARNING); it spawns `bossWarning` seconds later. */
  warnBoss(event: BossEvent): void;
  spawnBoss(event: BossEvent): void;
  /** No enemies left on the field. */
  isClear(): boolean;
  isBossAlive(): boolean;
}

export type HoldKind = 'none' | 'clear' | 'warning' | 'boss';

interface Pending {
  event: SpawnEvent;
  member: number;
  group: number;
  /** Real time when the member spawns. */
  at: number;
}

export class LevelTimeline {
  private clock = 0;
  private realTime = 0;
  private cursor = 0;
  private hold: HoldKind = 'none';
  private holdTime = 0;
  private holdTimeout = 0;
  private boss: BossEvent | null = null;
  private readonly pending: Pending[] = [];
  private readonly spare: Pending[] = [];

  constructor(
    private readonly events: readonly LevelEvent[],
    /** Seconds between the WARNING banner and the boss. */
    private readonly bossWarning: number,
  ) {
    for (let i = 1; i < events.length; i++) {
      if (events[i].t < events[i - 1].t) throw new Error(`timeline not sorted at index ${i}`);
    }
  }

  /** Mission clock, seconds. */
  get time(): number {
    return this.clock;
  }

  get holding(): HoldKind {
    return this.hold;
  }

  /** All events fired, nothing pending or holding. The mission is over once the field is clear too. */
  get exhausted(): boolean {
    return this.cursor >= this.events.length && this.pending.length === 0 && this.hold === 'none';
  }

  reset(): void {
    this.clock = 0;
    this.realTime = 0;
    this.cursor = 0;
    this.hold = 'none';
    this.holdTime = 0;
    this.boss = null;
    while (this.pending.length > 0) this.spare.push(this.pending.pop() as Pending);
  }

  /** Jumps to `t` without firing the skipped events (debug `?t=`). */
  seek(t: number): void {
    this.reset();
    this.clock = Math.max(0, t);
    while (this.cursor < this.events.length && this.events[this.cursor].t < this.clock) this.cursor++;
  }

  tick(dt: number, host: LevelHost): void {
    this.realTime += dt;
    this.releasePending(host);

    if (this.hold !== 'none') {
      this.holdTime += dt;
      if (this.hold === 'clear') {
        const timedOut = this.holdTimeout > 0 && this.holdTime >= this.holdTimeout;
        if (!timedOut && (this.pending.length > 0 || !host.isClear())) return;
      } else if (this.hold === 'warning') {
        if (this.holdTime < this.bossWarning) return;
        host.spawnBoss(this.boss as BossEvent);
        this.hold = 'boss';
        return;
      } else if (host.isBossAlive()) {
        return;
      }
      this.hold = 'none';
    }

    this.clock += dt;
    while (this.cursor < this.events.length && this.events[this.cursor].t <= this.clock) {
      const e = this.events[this.cursor++];
      switch (e.type) {
        case 'spawn':
          this.startSpawn(e, host);
          break;
        case 'setPiece':
          host.spawnSetPiece(e);
          break;
        case 'decor':
          host.startDecor(e);
          break;
        case 'waitClear':
          this.beginHold('clear', e.t);
          this.holdTimeout = e.timeout ?? 0;
          return;
        case 'boss':
          this.beginHold('warning', e.t);
          this.boss = e;
          host.warnBoss(e);
          return;
      }
    }
  }

  private beginHold(kind: HoldKind, t: number): void {
    this.hold = kind;
    this.holdTime = 0;
    this.clock = t;
  }

  private startSpawn(e: SpawnEvent, host: LevelHost): void {
    if (!host.accepts(e)) return;
    const group = host.openGroup(e);
    const count = formationSize(e.formation);
    const stagger = e.stagger ?? 0;
    for (let m = 0; m < count; m++) {
      if (m === 0 || stagger <= 0) {
        host.spawnMember(e, m, group);
        continue;
      }
      const p = this.spare.pop() ?? { event: e, member: 0, group: 0, at: 0 };
      p.event = e;
      p.member = m;
      p.group = group;
      p.at = this.realTime + m * stagger;
      this.pending.push(p);
    }
  }

  private releasePending(host: LevelHost): void {
    for (let i = 0; i < this.pending.length; ) {
      const p = this.pending[i];
      if (p.at > this.realTime) {
        i++;
        continue;
      }
      // Keep spawn order: shift the tail down instead of swap-remove (a handful of entries;
      // splice would allocate the removed-items array).
      for (let j = i; j < this.pending.length - 1; j++) this.pending[j] = this.pending[j + 1];
      this.pending.length--;
      this.spare.push(p);
      host.spawnMember(p.event, p.member, p.group);
    }
  }
}
