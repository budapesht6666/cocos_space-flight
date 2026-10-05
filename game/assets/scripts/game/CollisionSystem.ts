// Circle collisions on the XZ plane: player bullets vs enemies (via a spatial grid), enemy bullets
// vs the ship's hitbox and graze ring, and enemies ramming the ship. Long hulls use several circles
// (EnemyDef.hull). Entities are only marked dead here; their systems sweep them.
// Player bolts may pierce (each enemy is hit once), lose damage with range and splash (Plasma
// Orbs). While the Phase Shield is up, the ship hurts what it touches and pops bullets on its
// bubble instead of being hit.

import { falloffScale } from '../core/arsenal';
import { SpatialGrid } from '../core/SpatialGrid';
import type { BulletSystem, Bullet } from './BulletSystem';
import { enemyTouches, type Enemy, type EnemySystem } from './EnemySystem';
import type { GameContext } from './GameContext';
import type { PlayerSystem } from './PlayerSystem';

export class CollisionSystem {
  private readonly grid = new SpatialGrid(2);
  private bullet: Bullet | null = null;
  private hitEnemy: Enemy | null = null;
  private readonly visitEnemy = (index: number): void => this.checkBulletAgainst(index);
  private readonly grazeEvent = { x: 0, z: 0 };
  private readonly blastEvent = { x: 0, z: 0, radius: 0 };
  private readonly blockEvent = { x: 0, z: 0 };
  /** Phase Shield ram sparks are throttled: it deals damage every step. */
  private phaseSparks = 0;

  constructor(
    private readonly ctx: GameContext,
    private readonly player: PlayerSystem,
    private readonly playerBullets: BulletSystem,
    private readonly enemyBullets: BulletSystem,
    private readonly enemies: EnemySystem,
  ) {}

  tick(dt: number): void {
    this.playerBulletsVsEnemies();
    if (this.player.phasing) this.phase(dt);
    else {
      this.enemyBulletsVsShip();
      this.ramming();
    }
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
      const damage = b.damage * falloffScale(b.life, b.maxLife, b.falloff);
      const z = enemy.def.hull ? b.z : enemy.z + enemy.def.radius * 0.6;
      this.enemies.hitAt(enemy, damage, b.x, z, b.armorPierce, true);
      if (b.splash > 0) this.splash(b, enemy, damage * b.splashDamage);
      if (--b.pierce <= 0) b.dead = true;
      else {
        if (b.hitCount < b.hits.length) b.hits[b.hitCount] = enemy.uid;
        else b.hits.push(enemy.uid);
        b.hitCount++;
      }
    }
  }

  /** Splash damage to everything else within the bolt's radius (no sparks: the blast ring shows it). */
  private splash(b: Bullet, struck: Enemy, damage: number): void {
    const list = this.enemies.active;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e === struck || e.dead || !enemyTouches(e, b.x, b.z, b.splash)) continue;
      this.enemies.hitAt(e, damage, e.x, e.z, b.armorPierce, false);
    }
    const blast = this.blastEvent;
    blast.x = b.x;
    blast.z = b.z;
    blast.radius = b.splash;
    this.ctx.bus.emit('blast', blast);
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
      if (e.dead || e.def.ground || !enemyTouches(e, p.x, p.z, r)) continue;
      this.enemies.ram(e);
      p.hit();
      return;
    }
  }

  /** Phase Shield: bullets touching the bubble pop, enemies touching it take damage over time. */
  private phase(dt: number): void {
    const p = this.player;
    const r = p.phaseRadius;
    const bullets = this.enemyBullets.active;
    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      if (b.dead) continue;
      const dx = b.x - p.x;
      const dz = b.z - p.z;
      const reach = r + b.radius;
      if (dx * dx + dz * dz > reach * reach) continue;
      b.dead = true;
      this.blockEvent.x = b.x;
      this.blockEvent.z = b.z;
      this.ctx.bus.emit('bulletBlocked', this.blockEvent);
    }
    const list = this.enemies.active;
    const damage = p.phaseRamDps * dt;
    this.phaseSparks -= dt;
    const sparks = this.phaseSparks <= 0;
    if (sparks) this.phaseSparks = 0.1;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.dead || e.def.ground || !enemyTouches(e, p.x, p.z, r)) continue;
      this.enemies.hitAt(e, damage, (e.x + p.x) / 2, (e.z + p.z) / 2, 0, sparks);
    }
  }

  /** First live enemy the bullet overlaps and hasn't hit yet, or null. */
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
    for (let i = 0; i < b.hitCount; i++) if (b.hits[i] === e.uid) return;
    if (enemyTouches(e, b.x, b.z, b.radius)) this.hitEnemy = e;
  }
}
