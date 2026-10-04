import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../game/assets/scripts/core/EventBus';
import { FixedStep } from '../../game/assets/scripts/core/FixedStep';
import { Pool, swapRemove } from '../../game/assets/scripts/core/Pool';
import { Rng } from '../../game/assets/scripts/core/Rng';
import { SpatialGrid } from '../../game/assets/scripts/core/SpatialGrid';

describe('EventBus', () => {
  type Events = { hit: { damage: number }; died: undefined };

  it('delivers payloads to subscribers in order and supports unsubscribe', () => {
    const bus = new EventBus<Events>();
    const calls: string[] = [];
    const off = bus.on('hit', (p) => calls.push(`a${p.damage}`));
    bus.on('hit', (p) => calls.push(`b${p.damage}`));
    bus.emit('hit', { damage: 2 });
    off();
    bus.emit('hit', { damage: 3 });
    expect(calls).toEqual(['a2', 'b2', 'b3']);
  });

  it('ignores events without subscribers', () => {
    const bus = new EventBus<Events>();
    expect(() => bus.emit('died', undefined)).not.toThrow();
  });
});

describe('FixedStep', () => {
  it('runs whole steps and carries the remainder', () => {
    const fs = new FixedStep(1 / 60);
    expect(fs.advance(1 / 60)).toBe(1);
    expect(fs.advance(1 / 120)).toBe(0);
    expect(fs.advance(1 / 120)).toBe(1);
  });

  it('caps steps after a long hitch and drops the backlog', () => {
    const fs = new FixedStep(1 / 60, 5);
    expect(fs.advance(1)).toBe(5);
    expect(fs.advance(1 / 60)).toBe(1);
  });
});

describe('Pool', () => {
  it('reuses released items and counts creations', () => {
    const create = vi.fn(() => ({ v: 0 }));
    const pool = new Pool(create, (item) => (item.v = 0));
    pool.prewarm(2);
    const a = pool.acquire();
    a.v = 5;
    pool.release(a);
    const b = pool.acquire();
    expect(b.v).toBe(0);
    pool.acquire();
    pool.acquire();
    expect(pool.totalCreated).toBe(3);
  });

  it('swapRemove keeps the list dense', () => {
    const list = [1, 2, 3, 4];
    expect(swapRemove(list, 1)).toBe(2);
    expect(list).toEqual([1, 4, 3]);
    swapRemove(list, 2);
    expect(list).toEqual([1, 4]);
  });
});

describe('Rng', () => {
  it('is deterministic per seed and stays in range', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) {
      const x = a.next();
      expect(x).toBe(b.next());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    const r = new Rng(7);
    for (let i = 0; i < 100; i++) {
      const n = r.int(2, 4);
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(4);
    }
  });
});

describe('SpatialGrid', () => {
  it('finds nearby items and skips far ones', () => {
    const grid = new SpatialGrid(2);
    grid.insert(1, 0, 0, 0.5);
    grid.insert(2, 10, 10, 0.5);
    grid.insert(3, -1.5, 0.5, 0.5);
    const found = new Set<number>();
    grid.query(0, 0, 1, (id) => found.add(id));
    expect(found.has(1)).toBe(true);
    expect(found.has(3)).toBe(true);
    expect(found.has(2)).toBe(false);
  });

  it('is empty after clear and works with negative coordinates', () => {
    const grid = new SpatialGrid(2);
    grid.insert(1, -7, -9, 0.3);
    grid.clear();
    const found: number[] = [];
    grid.query(-7, -9, 1, (id) => found.push(id));
    expect(found).toEqual([]);
    grid.insert(5, -7, -9, 0.3);
    grid.query(-7, -9, 1, (id) => found.push(id));
    expect(found).toEqual([5]);
  });
});
