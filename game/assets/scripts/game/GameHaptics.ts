// The mission's haptic feedback: taps for what happens on the event bus (data/haptics.ts). Like
// GameAudio, it only listens; services/HapticsService.ts decides whether the device can vibrate.

import { HAPTICS } from '../data/haptics';
import { HapticsService } from '../services/HapticsService';
import type { GameContext } from './GameContext';

export class GameHaptics {
  constructor(ctx: GameContext) {
    if (!HapticsService.available) return;
    const bus = ctx.bus;
    bus.on('playerHit', () => HapticsService.play(HAPTICS.playerHit));
    bus.on('shieldHit', (e) => HapticsService.play(e.shield === 0 ? HAPTICS.shieldDown : HAPTICS.shieldHit));
    bus.on('playerDied', () => HapticsService.play(HAPTICS.playerDied));
    bus.on('novaBomb', () => HapticsService.play(HAPTICS.novaBomb));
    bus.on('special', () => HapticsService.play(HAPTICS.special));
    bus.on('armorBroken', () => HapticsService.play(HAPTICS.armorBroken));
    bus.on('enemyKilled', (e) => {
      if (e.boss) HapticsService.play(HAPTICS.bossKilled);
      else if (e.part) HapticsService.play(HAPTICS.partKilled);
    });
    bus.on('pickupCollected', (e) => {
      const style = HAPTICS.pickups[e.kind];
      if (style) HapticsService.play(style);
    });
  }
}
