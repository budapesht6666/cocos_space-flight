import { describe, expect, it } from 'vitest';
import { AdaptiveLevel } from '../../game/assets/scripts/core/AdaptiveLevel';
import { deviceKind, qualityLadder, tierToRemember } from '../../game/assets/scripts/core/quality';
import { QUALITY } from '../../game/assets/scripts/data/visuals';

const spec = { steps: 3, window: 2, slowFrameMs: 18.5, retryAfter: 12 };

/** Feeds `seconds` of frames at `fps`; returns how many times the step changed. */
function run(a: AdaptiveLevel, seconds: number, fps: number): number {
  let changes = 0;
  for (let t = 0; t < seconds; t += 1 / fps) if (a.frame(1 / fps)) changes++;
  return changes;
}

describe('adaptive quality step', () => {
  it('stays on the best step at 60 FPS', () => {
    const a = new AdaptiveLevel(spec);
    expect(run(a, 60, 60)).toBe(0);
    expect(a.level).toBe(0);
  });

  it('steps down while slow, one step per warm-up and window, never past the last', () => {
    const a = new AdaptiveLevel(spec);
    run(a, 4.1, 45);
    expect(a.level).toBe(1);
    run(a, 4.1, 45);
    expect(a.level).toBe(2);
    run(a, 20, 45);
    expect(a.level).toBe(2);
  });

  it('ignores hitches and the warm-up after a change', () => {
    const a = new AdaptiveLevel(spec);
    for (let i = 0; i < 20; i++) a.frame(0.5);
    run(a, 3.9, 60);
    expect(a.level).toBe(0);
  });

  it('retries the step above after a while; a failed try doubles the wait, a good one resets it', () => {
    const a = new AdaptiveLevel(spec);
    run(a, 4.1, 45);
    expect(a.level).toBe(1);
    expect(run(a, 12.1, 60)).toBe(1);
    expect(a.level).toBe(0);
    // Too slow up there: back down, and the next try waits twice as long.
    run(a, 4.1, 45);
    expect(a.level).toBe(1);
    expect(a.retryDelay).toBe(24);
    run(a, 13, 60);
    expect(a.level).toBe(1);
    run(a, 12, 60);
    expect(a.level).toBe(0);
    // This time it holds: the wait is back to normal.
    run(a, 4.1, 60);
    expect(a.level).toBe(0);
    expect(a.retryDelay).toBe(12);
  });

  it('restart keeps the step but measures afresh', () => {
    const a = new AdaptiveLevel(spec);
    run(a, 4.1, 45);
    a.restart();
    expect(a.level).toBe(1);
    expect(run(a, 1.9, 30)).toBe(0);
  });

  it('starts at the given step, clamped to the ladder', () => {
    expect(new AdaptiveLevel(spec, 2).level).toBe(2);
    expect(new AdaptiveLevel(spec, 7).level).toBe(2);
    expect(new AdaptiveLevel(spec, -1).level).toBe(0);
  });

  it('stable is the step that held: during a try of the one above, the step it was tried from', () => {
    const a = new AdaptiveLevel(spec, 1);
    expect(a.stable).toBe(1);
    run(a, 12.1, 60);
    expect(a.level).toBe(0);
    expect(a.stable).toBe(1);
    run(a, 4.1, 60);
    expect(a.stable).toBe(0);
  });
});

describe('graphics quality tiers', () => {
  const ids = (tiers: readonly { id: string }[]): string[] => tiers.map((t) => t.id);

  it('tells phones, desktops and GPU-less WebGL apart', () => {
    expect(deviceKind(true, 'Apple GPU')).toBe('mobile');
    expect(deviceKind(false, 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe('desktop');
    expect(deviceKind(false, 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)')).toBe('software');
    expect(deviceKind(false, 'llvmpipe (LLVM 15.0.7, 256 bits)')).toBe('software');
  });

  // A device that starts in the middle with one tier to climb (what a phone gets once `high` is checked).
  const climber = { start: 'medium', best: 'high' } as const;

  it('a desktop starts at the best tier, with MSAA', () => {
    const desktop = qualityLadder(QUALITY.tiers, QUALITY.devices.desktop, null);
    expect(desktop.tiers[desktop.start].id).toBe('ultra');
    expect(desktop.tiers[desktop.start].msaa).toBe(true);
  });

  it('a phone stays where iPhone was tuned: 70% at most, no MSAA', () => {
    const phone = qualityLadder(QUALITY.tiers, QUALITY.devices.mobile, null);
    expect(phone.tiers[phone.start].scale).toBe(0.7);
    for (const tier of phone.tiers) {
      expect(tier.scale).toBeLessThanOrEqual(0.7);
      expect(tier.msaa).toBe(false);
    }
  });

  it('a ladder spans the best tier down to the lowest and starts at the default', () => {
    const l = qualityLadder(QUALITY.tiers, climber, null);
    expect(ids(l.tiers)).toEqual(['high', 'medium', 'low', 'lowest']);
    expect(l.tiers[l.start].id).toBe('medium');
  });

  it('starts where the device held last time, only if that is better than its default', () => {
    const climbed = qualityLadder(QUALITY.tiers, climber, 'high');
    expect(climbed.tiers[climbed.start].id).toBe('high');
    expect(qualityLadder(QUALITY.tiers, climber, 'lowest').start).toBe(1);
    // Beyond the device's best, or unknown: the default.
    expect(qualityLadder(QUALITY.tiers, climber, 'ultra').start).toBe(1);
    expect(qualityLadder(QUALITY.tiers, climber, 'potato').start).toBe(1);
  });

  it('remembers the tier that held, never one below the default start', () => {
    const l = qualityLadder(QUALITY.tiers, climber, null);
    expect(tierToRemember(l, 0).id).toBe('high');
    expect(tierToRemember(l, 1).id).toBe('medium');
    expect(tierToRemember(l, 3).id).toBe('medium');
  });

  it('tiers go from best to worst', () => {
    for (let i = 1; i < QUALITY.tiers.length; i++) expect(QUALITY.tiers[i].scale).toBeLessThan(QUALITY.tiers[i - 1].scale);
    for (const device of Object.values(QUALITY.devices)) {
      const l = qualityLadder(QUALITY.tiers, device, null);
      expect(l.tiers[0].id).toBe(device.best);
      expect(l.tiers[l.defaultStart].id).toBe(device.start);
    }
  });
});
