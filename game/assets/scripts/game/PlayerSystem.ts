// The player's ship: relative-drag movement, banking, auto-fire, hull and shield, Energy and the
// Nova Bomb, plus the scripted fly-in and fly-out at the start and end of a mission.

import { Material, MeshRenderer, Node, Prefab, Vec2, instantiate, view } from 'cc';
import { clamp, damp, lerp } from '../core/math';
import { Vitals, type VitalsSpec } from '../core/vitals';
import { DIFFICULTIES } from '../data/difficulty';
import { SHIELD_CELL, WASTED_PICKUP_SCORE } from '../data/pickups';
import { ENERGY, GENERATOR_LEVELS, MAGNET_RADIUS, NOVA_BOMB, SHIP_FLIGHT } from '../data/player';
import type { Loadout, PickupKind, PlayerShipDef, WeaponDef } from '../data/types';
import { COLORS } from '../data/visuals';
import { toColor } from '../fx/RenderKit';
import type { InputService } from '../services/InputService';
import type { BulletSystem } from './BulletSystem';
import type { GameContext } from './GameContext';

const DEG = Math.PI / 180;
/** Engine nozzle positions on the normalised Spitfire model (x across, z towards the tail). */
const ENGINE_OFFSETS = [
  [-0.42, 0.18],
  [0.42, 0.18],
] as const;
const MAX_POWER = 4;

/** intro: flying in; control: player-driven; outro: leaving the screen; dead. */
export type ShipMode = 'intro' | 'control' | 'outro' | 'dead';

export class PlayerSystem {
  x = 0;
  z = 0;
  power = 1;
  mode: ShipMode = 'dead';
  readonly vitals: Vitals;
  private targetX = 0;
  private targetZ = 0;
  private vx = 0;
  private bank = 0;
  private fireCooldown = 0;
  private time = 0;
  private modeTime = 0;
  private modeDuration = 1;
  private fromZ = 0;
  private toZ = 0;
  private shieldFlash = 0;
  /** Blinking after a hull hit. */
  private blink = 0;
  private readonly spec: VitalsSpec;
  private readonly ship: Node;
  private readonly model: Node;
  private readonly engines: Node[] = [];
  private readonly bubble: Node;
  private readonly bubbleMaterial: Material;
  private readonly bubbleColor = toColor(COLORS.shield);
  private readonly drag = new Vec2();
  private readonly axis = new Vec2();
  private readonly hitEvent = { x: 0, z: 0, hull: 0 };
  private readonly shieldEvent = { x: 0, z: 0, shield: 0 };
  private readonly bonusEvent = { amount: 0 };

  constructor(
    private readonly ctx: GameContext,
    private readonly def: PlayerShipDef,
    private readonly loadout: Loadout,
    private readonly weapon: WeaponDef,
    private readonly bullets: BulletSystem,
    private readonly input: InputService,
    prefab: Prefab,
  ) {
    const generator = GENERATOR_LEVELS[clamp(loadout.generator, 1, GENERATOR_LEVELS.length) - 1];
    const maxHull = DIFFICULTIES[ctx.difficulty].maxHull;
    this.spec = {
      hull: maxHull !== undefined ? Math.min(maxHull, loadout.hull) : loadout.hull,
      shield: loadout.shield,
      shieldDelay: generator.delay,
      shieldRate: generator.rate,
      hullInvulnerable: def.invulnerableTime,
      shieldInvulnerable: def.shieldInvulnerableTime,
      startCharges: loadout.specialCharges,
      maxCharges: ENERGY.maxCharges,
      energyGain: ENERGY.gainLevels[clamp(loadout.energyGain, 1, ENERGY.gainLevels.length) - 1],
    };
    this.vitals = new Vitals(this.spec);

    this.ship = new Node('Player');
    this.ship.layer = ctx.worldRoot.layer;
    ctx.worldRoot.addChild(this.ship);
    this.model = instantiate(prefab);
    this.model.setScale(def.size, def.size, def.size);
    this.ship.addChild(this.model);
    const glow = ctx.kit.glow(COLORS.engineGlow, 2.4);
    for (const [ex, ez] of ENGINE_OFFSETS) {
      const engine = ctx.kit.meshNode('engine', this.ship, ctx.kit.plane, glow);
      engine.setPosition(ex * def.size, 0, ez * def.size + 0.25);
      this.engines.push(engine);
    }
    // Glowing core marks the real (small) hitbox.
    const core = ctx.kit.meshNode('hitbox', this.ship, ctx.kit.plane, ctx.kit.glow(COLORS.hitbox, 2.6));
    core.setPosition(0, 0.32, 0);
    core.setScale(def.hitboxRadius * 2.6, 1, def.hitboxRadius * 2.6);
    // Shield bubble: its own material instance so it can fade with the shield level.
    this.bubbleMaterial = ctx.kit.ringInstance(COLORS.shield, 1.6);
    this.bubble = new Node('shield');
    this.bubble.layer = this.ship.layer;
    this.ship.addChild(this.bubble);
    const renderer = this.bubble.addComponent(MeshRenderer);
    renderer.mesh = ctx.kit.plane;
    renderer.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF;
    renderer.setSharedMaterial(this.bubbleMaterial, 0);
    this.bubble.setPosition(0, 0.2, 0);
    this.bubble.setScale(def.size * 1.45, 1, def.size * 1.45);

    ctx.bus.on('enemyKilled', () => {
      if (this.alive) this.vitals.addEnergy(ENERGY.perKill);
    });
    ctx.bus.on('graze', () => {
      if (this.alive) this.vitals.addEnergy(ENERGY.perGraze);
    });
    ctx.bus.on('pickupCollected', (e) => this.applyPickup(e.kind));
  }

  /** Puts the ship below the screen, ready to fly in (or straight into position with `skipIntro`). */
  reset(startPower: number, skipIntro: boolean): void {
    const field = this.ctx.playfield;
    this.vitals.reset(this.spec);
    this.power = clamp(startPower, 1, MAX_POWER);
    this.x = this.targetX = 0;
    this.targetZ = field.zAt(this.def.startHeight);
    this.vx = 0;
    this.bank = 0;
    this.fireCooldown = 0;
    this.shieldFlash = 0;
    this.blink = 0;
    this.ship.active = true;
    this.input.consumeDrag(this.drag); // drop drags made on the results screen
    if (skipIntro) {
      this.z = this.targetZ;
      this.setMode('control', 0);
    } else {
      this.fromZ = this.z = field.bottomZ + 2.5;
      this.toZ = this.targetZ;
      this.setMode('intro', SHIP_FLIGHT.introTime);
    }
  }

  beginOutro(duration: number): void {
    this.fromZ = this.z;
    this.toZ = this.ctx.playfield.topZ - 4;
    this.setMode('outro', duration);
  }

  get alive(): boolean {
    return this.mode !== 'dead';
  }

  /** Can be hit and collide (not flying in/out, not invulnerable, not god mode). */
  get vulnerable(): boolean {
    return this.mode === 'control' && this.vitals.invulnerable <= 0 && !this.ctx.debug.god;
  }

  get canCollect(): boolean {
    return this.mode === 'control' || this.mode === 'outro';
  }

  get bodyRadius(): number {
    return this.def.bodyRadius;
  }

  get hitboxRadius(): number {
    return this.def.hitboxRadius;
  }

  get grazeRadius(): number {
    return this.def.grazeRadius;
  }

  get pickupRadius(): number {
    return this.def.pickupRadius;
  }

  get magnetRadius(): number {
    return MAGNET_RADIUS[clamp(this.loadout.magnet, 1, MAGNET_RADIUS.length) - 1];
  }

  tick(dt: number, specialPressed: boolean): void {
    this.time += dt;
    this.modeTime += dt;
    if (this.shieldFlash > 0) this.shieldFlash -= dt;
    if (this.blink > 0) this.blink -= dt;
    if (this.mode === 'dead') return;
    this.vitals.tick(dt);

    const prevX = this.x;
    if (this.mode === 'control') {
      this.steer(dt);
      if (specialPressed) this.novaBomb();
      this.fireCooldown -= dt;
      while (this.fireCooldown <= 0) {
        this.fire();
        this.fireCooldown += this.weapon.fireInterval;
      }
    } else {
      this.input.consumeDrag(this.drag); // no steering during scripted flight
      const k = clamp(this.modeTime / this.modeDuration, 0, 1);
      if (this.mode === 'intro') {
        this.z = lerp(this.fromZ, this.toZ, 1 - (1 - k) * (1 - k) * (1 - k));
        if (k >= 1) this.setMode('control', 0);
      } else {
        this.z = lerp(this.fromZ, this.toZ, k * k * k);
        this.x = damp(this.x, 0, 2, dt);
      }
    }
    this.vx = (this.x - prevX) / dt;
    const bankTarget = -clamp(this.vx / this.def.bankFullSpeed, -1, 1) * this.def.bankMaxDeg;
    this.bank = damp(this.bank, bankTarget, 12, dt);
  }

  /** One hit from a bullet or a ram. Returns true if it landed. */
  hit(): boolean {
    if (!this.vulnerable) return false;
    const result = this.vitals.hit();
    if (result === 'none') return false;
    if (result === 'shield') {
      this.shieldFlash = 0.35;
      const e = this.shieldEvent;
      e.x = this.x;
      e.z = this.z;
      e.shield = this.vitals.shield;
      this.ctx.bus.emit('shieldHit', e);
      return true;
    }
    this.power = Math.max(1, this.power - 1);
    this.blink = this.def.invulnerableTime;
    const e = this.hitEvent;
    e.x = this.x;
    e.z = this.z;
    e.hull = this.vitals.hull;
    this.ctx.bus.emit('playerHit', e);
    if (result === 'dead') {
      this.mode = 'dead';
      this.ship.active = false;
      this.ctx.bus.emit('playerDied', { x: this.x, z: this.z });
    }
    return true;
  }

  render(): void {
    if (!this.alive) return;
    this.ship.setPosition(this.x, 0, this.z);
    this.ship.setRotationFromEuler(0, 0, this.bank);
    // Blink while invulnerable after a hull hit (not in god mode, where it would blink forever).
    const v = this.vitals;
    const blinking = this.blink > 0 && Math.floor(this.blink * 14) % 2 === 0;
    if (this.model.active === blinking) this.model.active = !blinking;
    const flicker = 0.75 + 0.25 * Math.sin(this.time * 47) * Math.sin(this.time * 31);
    const thrust = this.mode === 'outro' ? 1.8 : this.mode === 'intro' ? 1.3 : 1;
    for (let i = 0; i < this.engines.length; i++) this.engines[i].setScale(0.42 * flicker, 1, 0.75 * flicker * thrust);

    // Bubble: faint with full shield, bright for a moment after it soaks a hit, gone when empty.
    const level = v.maxShield > 0 ? v.shield / v.maxShield : 0;
    const alpha = v.shield > 0 ? 0.18 + 0.22 * level + (this.shieldFlash > 0 ? this.shieldFlash * 2 : 0) : this.shieldFlash * 1.5;
    this.bubbleColor.a = Math.round(clamp(alpha, 0, 1) * 255);
    this.bubbleMaterial.setProperty('mainColor', this.bubbleColor);
  }

  private steer(dt: number): void {
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
    this.x = damp(this.x, this.targetX, this.def.followSharpness, dt);
    this.z = damp(this.z, this.targetZ, this.def.followSharpness, dt);
  }

  private setMode(mode: ShipMode, duration: number): void {
    this.mode = mode;
    this.modeTime = 0;
    this.modeDuration = Math.max(1e-3, duration);
    if (mode === 'control') {
      this.targetX = this.x;
      this.targetZ = this.z;
    }
  }

  private novaBomb(): void {
    if (!this.vitals.useCharge()) return;
    this.vitals.makeInvulnerable(NOVA_BOMB.invulnerableTime);
    this.ctx.bus.emit('novaBomb', { x: this.x, z: this.z });
  }

  private applyPickup(kind: PickupKind): void {
    if (!this.alive) return;
    let used = true;
    switch (kind) {
      case 'power':
        used = this.power < MAX_POWER;
        this.power = Math.min(MAX_POWER, this.power + 1);
        break;
      case 'repair':
        used = this.vitals.repair(1);
        break;
      case 'shield':
        used = this.vitals.addShield(SHIELD_CELL);
        break;
      case 'energy':
        used = this.vitals.addCharge();
        break;
      default:
        return; // credits are counted by the score system
    }
    if (!used) {
      this.bonusEvent.amount = WASTED_PICKUP_SCORE;
      this.ctx.bus.emit('scoreBonus', this.bonusEvent);
    }
  }

  private fire(): void {
    const form = this.weapon.powerForms[clamp(this.power, 1, this.weapon.powerForms.length) - 1];
    const w = this.weapon;
    const noseZ = this.z - 0.45 * this.def.size;
    for (let i = 0; i < form.length; i++) {
      const s = form[i];
      this.bullets.spawn(0, this.x + s.x, noseZ, s.angleDeg * DEG, w.bulletSpeed, w.damage, w.bulletRadius);
    }
  }
}
