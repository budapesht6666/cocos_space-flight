// Score, combo multiplier, credits and run statistics, all driven by gameplay events.

import { Combo } from '../core/Combo';
import { PICKUPS } from '../data/pickups';
import { COMBO, SCORE } from '../data/scoring';
import type { GameContext } from './GameContext';

export interface RunStats {
  score: number;
  credits: number;
  /** Non-obstacle kills, for the kill rate. */
  kills: number;
  grazes: number;
  bestMultiplier: number;
}

export class ScoreSystem {
  readonly combo = new Combo(COMBO);
  readonly stats: RunStats = { score: 0, credits: 0, kills: 0, grazes: 0, bestMultiplier: 1 };

  constructor(ctx: GameContext) {
    ctx.bus.on('enemyKilled', (e) => {
      const multiplier = this.combo.kill();
      this.stats.score += e.def.score * multiplier;
      if (!e.def.obstacle) this.stats.kills++;
      this.stats.bestMultiplier = this.combo.bestMultiplier;
    });
    ctx.bus.on('graze', () => {
      this.stats.score += SCORE.graze;
      this.stats.grazes++;
    });
    ctx.bus.on('playerHit', () => this.combo.break());
    ctx.bus.on('scoreBonus', (e) => {
      this.stats.score += e.amount;
    });
    ctx.bus.on('pickupCollected', (e) => {
      this.stats.credits += PICKUPS[e.kind].credits;
    });
  }

  tick(dt: number): void {
    this.combo.tick(dt);
  }

  /** End-of-mission bonuses; returns the amounts for the results screen. */
  missionBonus(shieldLeft: number, hullLost: number): { shield: number; noDamage: number } {
    const shield = shieldLeft * SCORE.shieldBonus;
    const noDamage = hullLost === 0 ? SCORE.noDamageBonus : 0;
    this.stats.score += shield + noDamage;
    return { shield, noDamage };
  }

  reset(): void {
    this.combo.reset();
    const s = this.stats;
    s.score = s.credits = s.kills = s.grazes = 0;
    s.bestMultiplier = 1;
  }
}
