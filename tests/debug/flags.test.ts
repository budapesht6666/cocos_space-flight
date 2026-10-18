import { describe, expect, it } from 'vitest';
import { demoFlags, isDevHost, parseDebugFlags } from '../../game/assets/scripts/debug/DebugFlags';
import { DEMO } from '../../game/assets/scripts/data/demo';

describe('parseDebugFlags', () => {
  it('needs no URL API without a query (the native app has none)', () => {
    const saved = globalThis.URLSearchParams;
    try {
      (globalThis as { URLSearchParams?: unknown }).URLSearchParams = undefined;
      expect(parseDebugFlags('')).toEqual(parseDebugFlags('', false));
      expect(parseDebugFlags('').mission).toBeNull();
    } finally {
      globalThis.URLSearchParams = saved;
    }
  });

  it('defaults to a normal game', () => {
    expect(parseDebugFlags('')).toEqual({
      overlay: false,
      god: false,
      power: null,
      t: 0,
      seed: null,
      slowmo: 1,
      mission: null,
      difficulty: null,
      elite: null,
      unlock: false,
      credits: null,
      reset: false,
      quality: null,
      scale: null,
      msaa: null,
      bloom: null,
      fxaa: null,
      loadout: { primary: null, secondary: null, drones: null, special: null, level: null },
      ship: null,
      demo: false,
    });
  });

  it('reads flags and numbers', () => {
    expect(parseDebugFlags('?debug=1&god=true&power=3&t=12.5&seed=42&mission=s1m1&difficulty=Hard&unlock=1&credits=5000.7&reset=1&quality=High&scale=0.55&msaa=1&bloom=0&fxaa=false')).toEqual({
      overlay: true,
      god: true,
      power: 3,
      t: 12.5,
      seed: 42,
      slowmo: 1,
      mission: 's1m1',
      difficulty: 'hard',
      elite: null,
      unlock: true,
      credits: 5000,
      reset: true,
      quality: 'high',
      scale: 0.55,
      msaa: true,
      bloom: false,
      fxaa: false,
      loadout: { primary: null, secondary: null, drones: null, special: null, level: null },
      ship: null,
      demo: false,
    });
  });

  it('clamps power and ignores garbage', () => {
    expect(parseDebugFlags('?power=9&t=abc&god=0').power).toBe(4);
    expect(parseDebugFlags('?power=9&t=abc&god=0').t).toBe(0);
    expect(parseDebugFlags('?god=0').god).toBe(false);
    expect(parseDebugFlags('?difficulty=extreme').difficulty).toBeNull();
    expect(parseDebugFlags('?credits=-5').credits).toBe(0);
    expect(parseDebugFlags('?credits=lots').credits).toBeNull();
    expect(parseDebugFlags('?scale=5').scale).toBe(1);
    expect(parseDebugFlags('?scale=0.1').scale).toBe(0.3);
    expect(parseDebugFlags('?bloom=1').bloom).toBe(true);
    expect(parseDebugFlags('?fxaa=yes').fxaa).toBe(true);
    expect(parseDebugFlags('?quality=max').quality).toBeNull();
    expect(parseDebugFlags('?msaa=0').msaa).toBe(false);
  });

  it('borrows a loadout: known ids only', () => {
    expect(parseDebugFlags('?primary=ion&secondary=rail&drones=gunDrone,toaster,guardian&special=warp&level=4.6').loadout).toEqual({
      primary: 'ion',
      secondary: 'rail',
      drones: ['gunDrone', 'guardian'],
      special: 'warp',
      level: 5,
    });
    expect(parseDebugFlags('?primary=laser&secondary=none').loadout.primary).toBeNull();
    expect(parseDebugFlags('?secondary=none').loadout.secondary).toBe('none');
    expect(parseDebugFlags('?drones=').loadout.drones).toEqual([]);
  });

  it('forces elites: a named one or random', () => {
    expect(parseDebugFlags('?elite=Volatile').elite).toBe('volatile');
    expect(parseDebugFlags('?elite=1').elite).toBe('random');
    expect(parseDebugFlags('?elite=0').elite).toBeNull();
  });

  it('picks a ship by id', () => {
    expect(parseDebugFlags('?ship=striker').ship).toBe('striker');
    expect(parseDebugFlags('?ship=falcon').ship).toBeNull();
  });
});

describe('flags that rewrite the save', () => {
  it('work on developer hosts and are ignored on the public site', () => {
    expect(parseDebugFlags('?reset=1&credits=500', true)).toMatchObject({ reset: true, credits: 500 });
    expect(parseDebugFlags('?reset=1&credits=500', false)).toMatchObject({ reset: false, credits: null });
    // The practice-run flags stay available everywhere.
    expect(parseDebugFlags('?god=1&unlock=1&mission=s1m1', false)).toMatchObject({ god: true, unlock: true, mission: 's1m1' });
  });

  it('knows a developer host from a public one', () => {
    for (const host of ['', 'localhost', 'LOCALHOST', '127.0.0.1', '127.1.2.3', '[::1]', '::1', '192.168.1.43', '10.0.0.5', '172.16.0.1', '172.31.255.1', '169.254.1.1', 'pc.local', 'game.localhost']) {
      expect(isDevHost(host), host).toBe(true);
    }
    for (const host of ['spaceflight.p1gog.duckdns.org', 'example.com', '8.8.8.8', '172.32.0.1', '172.15.0.1', '192.169.1.1', '11.0.0.1', 'localhost.evil.com', '127.0.0.1.evil.com', 'xlocal']) {
      expect(isDevHost(host), host).toBe(false);
    }
  });
});

describe('demoFlags', () => {
  it('plays the demo mission with its arsenal, and nothing else changes', () => {
    const d = demoFlags();
    expect(d.demo).toBe(true);
    expect(d.mission).toBe(DEMO.mission);
    expect(d.ship).toBe(DEMO.ship);
    expect(d.power).toBe(DEMO.power);
    expect(d.loadout).toEqual({ primary: DEMO.primary, secondary: DEMO.secondary, drones: DEMO.drones, special: DEMO.special, level: DEMO.level });
    expect(d.god).toBe(false);
    expect(d.t).toBe(0);
    expect(d.slowmo).toBe(1);
  });
});
