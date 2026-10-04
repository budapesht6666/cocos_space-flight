// The player's ship: relative-drag movement, banking, auto-fire, hull and invulnerability.

import { Node, Prefab, Vec2, instantiate, view } from 'cc';
import { clamp, damp } from '../core/math';
import type { PlayerShipDef, WeaponDef } from '../data/types';
import { COLORS } from '../data/visuals';
import type { InputService } from '../services/InputService';
import type { BulletSystem } from './BulletSystem';
import type { GameContext } from './GameContext';

const DEG = Math.PI / 180;
/** Engine nozzle positions on the normalised Spitfire model (x across, z towards the tail). */
const ENGINE_OFFSETS = [
  [-0.42, 0.18],
  [0.42, 0.18],
] as const;

export class PlayerSystem {
  x = 0;
  z = 0;
  hull = 0;
  alive = false;
  power = 1;
  private targetX = 0;
  private targetZ = 0;
  private vx = 0;
  private bank = 0;
  private invulnerable = 0;
  private fireCooldown = 0;
  private time = 0;
  private readonly ship: Node;
  private readonly engines: Node[] = [];
  private readonly drag = new Vec2();
  private readonly axis = new Vec2();

  constructor(
    private readonly ctx: GameContext,
    private readonly def: PlayerShipDef,
    private readonly weapon: WeaponDef,
    private readonly bullets: BulletSystem,
    private readonly input: InputService,
    prefab: Prefab,
  ) {
    this.ship = new Node('Player');
    this.ship.layer = ctx.worldRoot.layer;
    ctx.worldRoot.addChild(this.ship);
    const model = instantiate(prefab);
    model.setScale(def.size, def.size, def.size);
    this.ship.addChild(model);
    const glow = ctx.kit.glow(COLORS.engineGlow, 2.4);
    for (const [ex, ez] of ENGINE_OFFSETS) {
      const engine = ctx.kit.meshNode('engine', this.ship, ctx.kit.plane, glow);
      engine.setPosition(ex * def.size, 0, ez * def.size + 0.25);
      this.engines.push(engine);
    }
  }

  reset(startPower: number): void {
    const field = this.ctx.playfield;
    this.x = this.targetX = 0;
    this.z = this.targetZ = field.zAt(this.def.startHeight);
    this.hull = this.def.hull;
    this.alive = true;
    this.power = startPower;
    this.vx = 0;
    this.bank = 0;
    this.invulnerable = 0;
    this.fireCooldown = 0;
    this.ship.active = true;
    this.input.consumeDrag(this.drag); // drop drags made on the game-over screen
  }

  get isInvulnerable(): boolean {
    return this.invulnerable > 0 || this.ctx.debug.god;
  }

  get bodyRadius(): number {
    return this.def.bodyRadius;
  }

  tick(dt: number): void {
    this.time += dt;
    if (!this.alive) return;
    const field = this.ctx.playfield;

    // One UI unit of finger travel moves the ship by the same fraction of the screen width.
    this.input.consumeDrag(this.drag);
    const worldPerUi = (2 * field.halfWidth(this.z)) / view.getDesignResolutionSize().width;
    this.targetX += this.drag.x * worldPerUi;
    this.targetZ -= this.drag.y * worldPerUi;
    this.input.keyAxis(this.axis);
    this.targetX += this.axis.x * this.def.keyboardSpeed * dt;
    this.targetZ -= this.axis.y * this.def.keyboardSpeed * dt;
    this.targetZ = field.clampPlayerZ(this.targetZ);
    this.targetX = field.clampPlayerX(this.targetX, this.targetZ);

    const prevX = this.x;
    this.x = damp(this.x, this.targetX, this.def.followSharpness, dt);
    this.z = damp(this.z, this.targetZ, this.def.followSharpness, dt);
    this.vx = (this.x - prevX) / dt;
    const bankTarget = -clamp(this.vx / this.def.bankFullSpeed, -1, 1) * this.def.bankMaxDeg;
    this.bank = damp(this.bank, bankTarget, 12, dt);

    if (this.invulnerable > 0) this.invulnerable -= dt;

    this.fireCooldown -= dt;
    while (this.fireCooldown <= 0) {
      this.fire();
      this.fireCooldown += this.weapon.fireInterval;
    }
  }

  /** Applies hull damage unless invulnerable. Returns true if the hit landed. */
  damage(amount: number): boolean {
    if (!this.alive || this.isInvulnerable) return false;
    this.hull = Math.max(0, this.hull - amount);
    this.invulnerable = this.def.invulnerableTime;
    this.ctx.bus.emit('playerHit', { x: this.x, z: this.z, hull: this.hull });
    if (this.hull === 0) {
      this.alive = false;
      this.ship.active = false;
      this.ctx.bus.emit('playerDied', { x: this.x, z: this.z });
    }
    return true;
  }

  render(): void {
    if (!this.alive) return;
    this.ship.setPosition(this.x, 0, this.z);
    this.ship.setRotationFromEuler(0, 0, this.bank);
    // Blink while invulnerable (not in god mode, where it would blink forever).
    const blinking = this.invulnerable > 0 && Math.floor(this.invulnerable * 14) % 2 === 0;
    this.ship.children[0].active = !blinking;
    const flicker = 0.75 + 0.25 * Math.sin(this.time * 47) * Math.sin(this.time * 31);
    for (let i = 0; i < this.engines.length; i++) this.engines[i].setScale(0.42 * flicker, 1, 0.75 * flicker);
  }

  private fire(): void {
    const form = this.weapon.powerForms[clamp(this.power, 1, this.weapon.powerForms.length) - 1];
    const w = this.weapon;
    const noseZ = this.z - 0.45 * this.def.size;
    for (let i = 0; i < form.length; i++) {
      const s = form[i];
      this.bullets.spawn(this.x + s.x, noseZ, s.angleDeg * DEG, w.bulletSpeed, w.damage, w.bulletRadius, w.bulletWidth, w.bulletLength);
    }
  }
}
