// Circle collisions on the XZ plane: player bullets vs enemies (via a spatial grid) and
// enemies vs the player's body. Entities are only marked dead here; their systems sweep them.

import { circlesOverlap } from '../core/math';
import { SpatialGrid } from '../core/SpatialGrid';
import type { BulletSystem, Bullet } from './BulletSystem';
import type { Enemy, EnemySystem } from './EnemySystem';
import type { GameContext } from './GameContext';
import type { PlayerSystem } from './PlayerSystem';

export class CollisionSystem {
  private readonly grid = new SpatialGrid(2);
  private bullet: Bullet | null = null;
  private hitEnemy: Enemy | null = null;
  private readonly visitEnemy = (index: number): void => this.checkBulletAgainst(index);

  constructor(
    private readonly ctx: GameContext,
    private readonly player: PlayerSystem,
    private readonly playerBullets: BulletSystem,
    private readonly enemies: EnemySystem,
  ) {}

  tick(): void {
    const list = this.enemies.active;
    this.grid.clear();
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.dead) this.grid.insert(i, e.x, e.z, e.def.radius);
    }

    const bullets = this.playerBullets.active;
    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      if (b.dead) continue;
      const enemy = this.findHit(b);
      if (enemy) {
        b.dead = true;
        if (!this.enemies.damage(enemy, b.damage)) this.ctx.bus.emit('enemyHit', { x: b.x, z: enemy.z + enemy.def.radius * 0.6 });
      }
    }

    if (this.player.alive && !this.player.isInvulnerable) {
      const r = this.player.bodyRadius;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e.dead || !circlesOverlap(this.player.x, this.player.z, r, e.x, e.z, e.def.radius)) continue;
        this.enemies.kill(e);
        this.player.damage(e.def.contactDamage);
        break; // invulnerability starts after the first hit
      }
    }

    this.playerBullets.sweep();
    this.enemies.sweep();
  }

  /** First live enemy the bullet overlaps, or null. */
  private findHit(b: Bullet): Enemy | null {
    this.bullet = b;
    this.hitEnemy = null;
    this.grid.query(b.x, b.z, b.radius, this.visitEnemy);
    this.bullet = null;
    return this.hitEnemy;
  }

  private checkBulletAgainst(index: number): void {
    if (this.hitEnemy || !this.bullet) return;
    const e = this.enemies.active[index];
    if (e.dead) return;
    const b = this.bullet;
    if (circlesOverlap(b.x, b.z, b.radius, e.x, e.z, e.def.radius)) this.hitEnemy = e;
  }
}
