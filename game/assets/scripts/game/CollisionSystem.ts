// Circle collisions on the XZ plane: player bullets vs enemies (via a spatial grid), enemy bullets
// vs the ship's hitbox and graze ring, and enemies ramming the ship. Entities are only marked dead
// here; their systems sweep them.

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
  private readonly hitEvent = { x: 0, z: 0 };
  private readonly grazeEvent = { x: 0, z: 0 };

  constructor(
    private readonly ctx: GameContext,
    private readonly player: PlayerSystem,
    private readonly playerBullets: BulletSystem,
    private readonly enemyBullets: BulletSystem,
    private readonly enemies: EnemySystem,
  ) {}

  tick(): void {
    this.playerBulletsVsEnemies();
    this.enemyBulletsVsShip();
    this.ramming();
    this.playerBullets.sweep();
    this.enemyBullets.sweep();
    this.enemies.sweep();
  }

  private playerBulletsVsEnemies(): void {
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
      if (!enemy) continue;
      b.dead = true;
      if (!this.enemies.damage(enemy, b.damage)) {
        this.hitEvent.x = b.x;
        this.hitEvent.z = enemy.z + enemy.def.radius * 0.6;
        this.ctx.bus.emit('enemyHit', this.hitEvent);
      }
    }
  }

  private enemyBulletsVsShip(): void {
    const p = this.player;
    if (!p.vulnerable) return;
    const bullets = this.enemyBullets.active;
    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      if (b.dead) continue;
      const dx = b.x - p.x;
      const dz = b.z - p.z;
      const d2 = dx * dx + dz * dz;
      const hit = p.hitboxRadius + b.radius;
      if (d2 <= hit * hit) {
        b.dead = true;
        p.hit();
        return; // invulnerable from here on
      }
      const graze = p.grazeRadius + b.radius;
      if (!b.grazed && d2 <= graze * graze) {
        b.grazed = true;
        this.grazeEvent.x = b.x;
        this.grazeEvent.z = b.z;
        this.ctx.bus.emit('graze', this.grazeEvent);
      }
    }
  }

  private ramming(): void {
    const p = this.player;
    if (!p.vulnerable) return;
    const list = this.enemies.active;
    const r = p.bodyRadius;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.dead || e.def.ground || !circlesOverlap(p.x, p.z, r, e.x, e.z, e.def.radius)) continue;
      this.enemies.ram(e);
      p.hit();
      return;
    }
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
