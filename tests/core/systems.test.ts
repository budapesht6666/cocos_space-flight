import { describe, expect, it } from 'vitest';
import { Combo } from '../../game/assets/scripts/core/Combo';
import { aimAngle, createEmitterState, resetEmitter, stepEmitter, type ShotSink } from '../../game/assets/scripts/core/emitter';
import { LevelTimeline, type LevelHost } from '../../game/assets/scripts/core/LevelTimeline';
import { Vitals, type VitalsSpec } from '../../game/assets/scripts/core/vitals';
import { PATTERNS } from '../../game/assets/scripts/data/patterns';
import type { EmitterSpec, LevelEvent, SpawnEvent } from '../../game/assets/scripts/data/types';

const DT = 1 / 60;

// ------------------------------------------------------------------------------------------------

class Recorder implements ShotSink {
  readonly shots: { angle: number; speed: number }[] = [];
  shot(_spec: EmitterSpec, angle: number, speed: number): void {
    this.shots.push({ angle, speed });
  }
}

const NORMAL = { speedScale: 1, rateScale: 1, density: 0 };

function run(spec: EmitterSpec, seconds: number, aim = Math.PI, tuning = NORMAL): Recorder {
  const sink = new Recorder();
  const state = createEmitterState();
  resetEmitter(state, spec);
  for (let t = 0; t < seconds; t += DT) stepEmitter(spec, state, DT, aim, tuning, sink);
  return sink;
}

describe('emitter', () => {
  it('aimAngle: straight down is π, to the right is π/2', () => {
    expect(aimAngle(0, 0, 0, 5)).toBeCloseTo(Math.PI, 6);
    expect(aimAngle(0, 0, 5, 0)).toBeCloseTo(Math.PI / 2, 6);
    expect(aimAngle(0, 0, 0, -5)).toBeCloseTo(0, 6);
  });

  it('aimed single shot waits for its delay, then repeats every cooldown', () => {
    const spec = PATTERNS.turretShot; // delay 0.4, cooldown 1.7
    expect(run(spec, 0.35).shots).toHaveLength(0);
    expect(run(spec, 0.45).shots).toHaveLength(1);
    expect(run(spec, 0.4 + 1.7 * 2 + 0.05).shots).toHaveLength(3);
    expect(run(spec, 0.5, 1.0).shots[0].angle).toBeCloseTo(1.0, 6);
  });

  it('a burst fires its volleys close together', () => {
    const sink = run(PATTERNS.gunshipBurst, 0.5 + 0.14 * 2 + 0.01);
    expect(sink.shots).toHaveLength(3);
  });

  it('a spread fans symmetrically around the aim', () => {
    const spec: EmitterSpec = { ...PATTERNS.turretFan, delay: 0 };
    const sink = run(spec, DT, Math.PI);
    expect(sink.shots).toHaveLength(3);
    const angles = sink.shots.map((s) => s.angle).sort();
    expect(angles[1]).toBeCloseTo(Math.PI, 6);
    expect(angles[2] - angles[1]).toBeCloseTo((14 * Math.PI) / 180, 6);
    expect(angles[1] - angles[0]).toBeCloseTo((14 * Math.PI) / 180, 6);
  });

  it('a ring spreads evenly over the full circle; density adds bullets', () => {
    const spec: EmitterSpec = { ...PATTERNS.marauderRing, delay: 0, volleys: 1 };
    const sink = run(spec, DT);
    expect(sink.shots).toHaveLength(14);
    const step = sink.shots[1].angle - sink.shots[0].angle;
    expect(step).toBeCloseTo((Math.PI * 2) / 14, 6);
    expect(run(spec, DT, Math.PI, { speedScale: 1, rateScale: 1, density: 2 }).shots).toHaveLength(14 + 8);
  });

  it('a spiral turns a little every volley', () => {
    const spec: EmitterSpec = { ...PATTERNS.marauderSpiral, delay: 0 };
    const sink = run(spec, 0.2);
    const first = sink.shots[0].angle;
    const second = sink.shots[spec.count].angle;
    expect(second - first).toBeCloseTo((spec.spinDeg * Math.PI) / 180, 6);
  });

  it('difficulty speeds bullets up and fires more often', () => {
    const spec = PATTERNS.turretShot;
    const hard = { speedScale: 1.5, rateScale: 2, density: 0 };
    expect(run(spec, 5, Math.PI, hard).shots.length).toBeGreaterThan(run(spec, 5).shots.length);
    expect(run(spec, 1, Math.PI, hard).shots[0].speed).toBeCloseTo(spec.speed * 1.5, 6);
  });
});

// ------------------------------------------------------------------------------------------------

const spec: VitalsSpec = {
  hull: 3,
  shield: 2,
  shieldDelay: 2,
  shieldRate: 1,
  hullInvulnerable: 1.5,
  shieldInvulnerable: 0.3,
  startCharges: 1,
  maxCharges: 3,
  energyGain: 1,
};

function wait(v: Vitals, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) v.tick(DT);
}

describe('Vitals', () => {
  it('shield soaks hits before the hull, with short then long invulnerability', () => {
    const v = new Vitals(spec);
    expect(v.hit()).toBe('shield');
    expect(v.hit()).toBe('none'); // still invulnerable
    wait(v, 0.35);
    expect(v.hit()).toBe('shield');
    wait(v, 0.35);
    expect(v.hit()).toBe('hull');
    expect(v.hull).toBe(2);
    expect(v.hullLost).toBe(1);
    wait(v, 1.0);
    expect(v.hit()).toBe('none');
    wait(v, 0.6);
    expect(v.hit()).toBe('hull');
    wait(v, 1.6);
    expect(v.hit()).toBe('dead');
    expect(v.alive).toBe(false);
  });

  it('shield regenerates after the delay, unit by unit', () => {
    const v = new Vitals(spec);
    v.hit();
    wait(v, 0.4);
    v.hit();
    expect(v.shield).toBe(0);
    wait(v, 1.9);
    expect(v.shield).toBe(0); // delay not over yet
    wait(v, 1.2);
    expect(v.shield).toBe(1);
    wait(v, 1.0);
    expect(v.shield).toBe(2);
    expect(v.shieldFill).toBe(0);
  });

  it('a hit restarts the regeneration delay', () => {
    const v = new Vitals(spec);
    v.hit();
    wait(v, 1.5);
    v.hit();
    wait(v, 1.5);
    expect(v.shield).toBe(0);
  });

  it('a full Energy bar becomes a charge; at max the bar waits full', () => {
    const v = new Vitals(spec);
    expect(v.charges).toBe(1);
    expect(v.addEnergy(0.6)).toBe(false);
    expect(v.addEnergy(0.6)).toBe(true);
    expect(v.charges).toBe(2);
    expect(v.energy).toBeCloseTo(0.2, 6);
    v.addCharge();
    expect(v.charges).toBe(3);
    v.addEnergy(5);
    expect(v.energy).toBe(1);
    expect(v.useCharge()).toBe(true);
    // The waiting full bar refills the freed slot.
    expect(v.charges).toBe(3);
    expect(v.energy).toBe(0);
  });

  it('repair and shield cells report when wasted', () => {
    const v = new Vitals(spec);
    expect(v.repair(1)).toBe(false);
    expect(v.addShield(2)).toBe(false);
    wait(v, 0.5);
    v.hit();
    expect(v.addShield(2)).toBe(true);
    expect(v.shield).toBe(2);
  });
});

// ------------------------------------------------------------------------------------------------

describe('Combo', () => {
  const combo = (): Combo => new Combo({ window: 2, killsPerStep: 4, maxMultiplier: 8 });

  it('steps up every few kills within the window and caps', () => {
    const c = combo();
    const m: number[] = [];
    for (let i = 0; i < 40; i++) m.push(c.kill());
    expect(m.slice(0, 4)).toEqual([1, 1, 1, 2]);
    expect(m[7]).toBe(3);
    expect(Math.max(...m)).toBe(8);
    expect(c.bestMultiplier).toBe(8);
  });

  it('lapses after the window and breaks on demand, keeping the best', () => {
    const c = combo();
    for (let i = 0; i < 8; i++) c.kill();
    expect(c.multiplier).toBe(3);
    for (let t = 0; t < 2.1; t += DT) c.tick(DT);
    expect(c.multiplier).toBe(1);
    for (let i = 0; i < 4; i++) c.kill();
    c.break();
    expect(c.multiplier).toBe(1);
    expect(c.bestMultiplier).toBe(3);
  });
});

// ------------------------------------------------------------------------------------------------

class Host implements LevelHost {
  enemies = 0;
  bossAlive = false;
  readonly log: string[] = [];
  private groups = 0;
  accepts(e: SpawnEvent): boolean {
    return e.minDifficulty === undefined;
  }
  openGroup(): number {
    return this.groups++;
  }
  spawnMember(e: SpawnEvent, member: number, group: number): void {
    this.enemies++;
    this.log.push(`${e.enemy}#${member}@g${group}`);
  }
  spawnSetPiece(): void {
    this.log.push('piece');
  }
  warnBoss(): void {
    this.log.push('warning');
  }
  spawnBoss(): void {
    this.bossAlive = true;
    this.log.push('boss');
  }
  isClear(): boolean {
    return this.enemies === 0;
  }
  isBossAlive(): boolean {
    return this.bossAlive;
  }
}

const single = { kind: 'single' as const, count: 1, spacing: 0 };

function advance(tl: LevelTimeline, host: Host, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) tl.tick(DT, host);
}

describe('LevelTimeline', () => {
  it('fires events in order as the clock passes them', () => {
    const events: LevelEvent[] = [
      { t: 1, type: 'spawn', enemy: 'scout', formation: { kind: 'line', count: 3, spacing: 1 }, x: 0 },
      { t: 2, type: 'setPiece', piece: 'outpost', x: 0 },
      { t: 3, type: 'spawn', enemy: 'dart', formation: single, x: 0 },
    ];
    const host = new Host();
    const tl = new LevelTimeline(events, 2);
    advance(tl, host, 2.5);
    expect(host.log).toEqual(['scout#0@g0', 'scout#1@g0', 'scout#2@g0', 'piece']);
    advance(tl, host, 1);
    expect(host.log[4]).toBe('dart#0@g1');
    expect(tl.exhausted).toBe(true);
  });

  it('staggers trail members on real time, even while the clock holds', () => {
    const events: LevelEvent[] = [
      { t: 0.5, type: 'spawn', enemy: 'scout', formation: { kind: 'trail', count: 3, spacing: 0 }, x: 0, stagger: 0.5 },
      { t: 0.6, type: 'waitClear' },
    ];
    const host = new Host();
    const tl = new LevelTimeline(events, 2);
    advance(tl, host, 0.7);
    expect(host.enemies).toBe(1);
    expect(tl.holding).toBe('clear');
    advance(tl, host, 1.0);
    expect(host.enemies).toBe(3);
    expect(tl.exhausted).toBe(false);
  });

  it('waitClear stops the clock until the field is empty', () => {
    const events: LevelEvent[] = [
      { t: 1, type: 'spawn', enemy: 'scout', formation: single, x: 0 },
      { t: 2, type: 'waitClear' },
      { t: 3, type: 'spawn', enemy: 'dart', formation: single, x: 0 },
    ];
    const host = new Host();
    const tl = new LevelTimeline(events, 2);
    advance(tl, host, 10);
    expect(tl.time).toBeCloseTo(2, 5);
    expect(host.log).toEqual(['scout#0@g0']);
    host.enemies = 0;
    advance(tl, host, 0.9);
    expect(host.log).toHaveLength(1);
    advance(tl, host, 0.2);
    expect(host.log[1]).toBe('dart#0@g1');
  });

  it('waitClear gives up after its timeout', () => {
    const events: LevelEvent[] = [
      { t: 1, type: 'spawn', enemy: 'scout', formation: single, x: 0 },
      { t: 1.5, type: 'waitClear', timeout: 2 },
      { t: 2, type: 'spawn', enemy: 'dart', formation: single, x: 0 },
    ];
    const host = new Host();
    const tl = new LevelTimeline(events, 2);
    advance(tl, host, 3.4);
    expect(host.log).toHaveLength(1);
    advance(tl, host, 0.7);
    expect(host.log).toHaveLength(2);
  });

  it('boss: warning, spawn after the warning time, hold until it dies', () => {
    const events: LevelEvent[] = [
      { t: 1, type: 'boss', enemy: 'marauder', x: 0 },
      { t: 1.5, type: 'spawn', enemy: 'scout', formation: single, x: 0 },
    ];
    const host = new Host();
    const tl = new LevelTimeline(events, 2);
    advance(tl, host, 2);
    expect(host.log).toEqual(['warning']);
    advance(tl, host, 1.1);
    expect(host.log).toEqual(['warning', 'boss']);
    expect(tl.holding).toBe('boss');
    advance(tl, host, 5);
    expect(host.log).toHaveLength(2);
    host.bossAlive = false;
    advance(tl, host, 0.6);
    expect(host.log[2]).toBe('scout#0@g0');
  });

  it('seek skips earlier events, including holds, without firing them', () => {
    const events: LevelEvent[] = [
      { t: 1, type: 'spawn', enemy: 'scout', formation: single, x: 0 },
      { t: 2, type: 'waitClear' },
      { t: 5, type: 'spawn', enemy: 'dart', formation: single, x: 0 },
    ];
    const host = new Host();
    const tl = new LevelTimeline(events, 2);
    tl.seek(4);
    advance(tl, host, 1.1);
    expect(host.log).toEqual(['dart#0@g0']);
  });

  it('skips spawns the host rejects (difficulty gate)', () => {
    const events: LevelEvent[] = [{ t: 0.1, type: 'spawn', enemy: 'scout', formation: single, x: 0, minDifficulty: 'hard' }];
    const host = new Host();
    const tl = new LevelTimeline(events, 2);
    advance(tl, host, 1);
    expect(host.log).toEqual([]);
  });

  it('rejects an unsorted timeline', () => {
    expect(
      () =>
        new LevelTimeline(
          [
            { t: 2, type: 'waitClear' },
            { t: 1, type: 'waitClear' },
          ],
          2,
        ),
    ).toThrow();
  });
});
