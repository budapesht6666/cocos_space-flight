// Mission 1-1's hints (data/onboarding.ts, GDD §19), each once and when its moment comes: move as
// soon as the ship is under control, the guns right after; P when a power-up is on screen (it cuts
// the gun hint short — a P falls off the screen if nobody goes for it), and the Special when there
// is a charge and bullets fill the screen. Shown until the mission is cleared once.

import { ONBOARDING, type HintId } from '../data/onboarding';
import type { Hud } from '../ui/Hud';
import type { BulletSystem } from './BulletSystem';
import type { GameContext } from './GameContext';
import type { PickupSystem } from './PickupSystem';
import type { PlayerSystem } from './PlayerSystem';

/** move and fire come first, in this order; power and special whenever their moment comes. */
const ORDER: readonly HintId[] = ['move', 'fire', 'power', 'special'];

export class Onboarding {
  private readonly done = new Set<HintId>();
  /** The hint on screen and the seconds it has left. */
  private current: HintId | null = null;
  private showing = 0;
  private wait = 0;
  private travelled = 0;
  private lastX = 0;
  private lastZ = 0;
  private specialUsed = false;
  private poweredUp = false;

  constructor(
    ctx: GameContext,
    private readonly player: PlayerSystem,
    private readonly pickups: PickupSystem,
    private readonly enemyBullets: BulletSystem,
    private readonly hud: Hud,
    /** Keyboard wording on a computer, touch wording on a phone. */
    private readonly keys: boolean,
  ) {
    const used = (): void => {
      this.specialUsed = true;
    };
    ctx.bus.on('novaBomb', used);
    ctx.bus.on('special', used);
    ctx.bus.on('pickupCollected', (e) => {
      if (e.kind === 'power') this.poweredUp = true;
    });
  }

  reset(): void {
    this.done.clear();
    this.current = null;
    this.showing = 0;
    this.poweredUp = false;
    this.wait = 0;
    this.travelled = 0;
    this.specialUsed = false;
    this.hud.showHint(null);
  }

  tick(dt: number): void {
    const p = this.player;
    if (this.done.size >= ORDER.length || p.mode !== 'control') {
      if (this.current && !p.alive) this.hide();
      return;
    }
    this.travelled += Math.abs(p.x - this.lastX) + Math.abs(p.z - this.lastZ);
    this.lastX = p.x;
    this.lastZ = p.z;
    const id = this.current;
    if (id) {
      this.showing -= dt;
      const finished =
        this.showing <= 0 ||
        (id === 'move' && this.travelled >= ONBOARDING.moveDistance) ||
        (id === 'power' && this.poweredUp) ||
        (id === 'special' && this.specialUsed);
      const cut = id === 'fire' && !this.done.has('power') && this.ready('power');
      if (finished || cut) this.hide();
      return;
    }
    if (this.wait > 0) {
      this.wait -= dt;
      return;
    }
    for (let i = 0; i < ORDER.length; i++) {
      const next = ORDER[i];
      if (this.done.has(next)) continue;
      if (this.ready(next)) {
        this.show(next);
        return;
      }
      // The first two wait for each other; the rest for their moment.
      if (next === 'move' || next === 'fire') return;
    }
  }

  private ready(id: HintId): boolean {
    switch (id) {
      case 'move':
      case 'fire':
        return true;
      case 'power': {
        const list = this.pickups.active;
        for (let i = 0; i < list.length; i++) if (list[i].def.kind === 'power') return true;
        return false;
      }
      case 'special':
        return this.specialUsed || (this.player.vitals.charges > 0 && this.enemyBullets.count >= ONBOARDING.specialBullets);
    }
  }

  private show(id: HintId): void {
    // Already used the Special before its hint came up: nothing to teach.
    if ((id === 'special' && this.specialUsed) || (id === 'power' && this.poweredUp)) {
      this.done.add(id);
      return;
    }
    if (id === 'move') this.travelled = 0;
    this.current = id;
    const words = ONBOARDING.hints[id];
    const text = (this.keys ? words.keys : words.touch).replace('{special}', this.player.special.label);
    this.hud.showHint(text);
    this.showing = id === 'move' ? ONBOARDING.moveTimeout : ONBOARDING.hintTime;
  }

  private hide(): void {
    this.hud.showHint(null);
    if (this.current) this.done.add(this.current);
    this.current = null;
    this.showing = 0;
    this.wait = ONBOARDING.gap;
  }
}
