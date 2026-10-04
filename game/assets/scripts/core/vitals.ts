// The player's survival stats: hull, regenerating shield, invulnerability, Energy and Special
// charges (GDD §6–7). Engine-free.

export interface VitalsSpec {
  hull: number;
  shield: number;
  /** Seconds after a hit before the shield regenerates, and units per second while it does. */
  shieldDelay: number;
  shieldRate: number;
  hullInvulnerable: number;
  shieldInvulnerable: number;
  startCharges: number;
  maxCharges: number;
  /** Energy gain multiplier. */
  energyGain: number;
}

/** none = ignored (invulnerable or already dead). */
export type HitResult = 'none' | 'shield' | 'hull' | 'dead';

export class Vitals {
  hull = 0;
  maxHull = 0;
  shield = 0;
  maxShield = 0;
  /** Progress of the next regenerating shield unit, 0..1. */
  shieldFill = 0;
  invulnerable = 0;
  /** Energy bar, 0..1; a full bar turns into a Special charge. */
  energy = 0;
  charges = 0;
  /** Hull segments lost this mission (Untouchable medal, no-damage bonus). */
  hullLost = 0;
  private regenDelay = 0;
  private spec: VitalsSpec;

  constructor(spec: VitalsSpec) {
    this.spec = spec;
    this.reset(spec);
  }

  reset(spec: VitalsSpec): void {
    this.spec = spec;
    this.hull = this.maxHull = spec.hull;
    this.shield = this.maxShield = spec.shield;
    this.shieldFill = 0;
    this.invulnerable = 0;
    this.energy = 0;
    this.charges = Math.min(spec.startCharges, spec.maxCharges);
    this.hullLost = 0;
    this.regenDelay = 0;
  }

  get alive(): boolean {
    return this.hull > 0;
  }

  tick(dt: number): void {
    if (this.invulnerable > 0) this.invulnerable = Math.max(0, this.invulnerable - dt);
    if (this.shield >= this.maxShield) {
      this.shieldFill = 0;
      return;
    }
    if (this.regenDelay > 0) {
      this.regenDelay -= dt;
      return;
    }
    this.shieldFill += this.spec.shieldRate * dt;
    while (this.shieldFill >= 1 && this.shield < this.maxShield) {
      this.shield++;
      this.shieldFill -= 1;
    }
    if (this.shield >= this.maxShield) this.shieldFill = 0;
  }

  /** One hit: the shield takes it if it can, otherwise a hull segment. */
  hit(): HitResult {
    if (this.hull <= 0 || this.invulnerable > 0) return 'none';
    this.regenDelay = this.spec.shieldDelay;
    this.shieldFill = 0;
    if (this.shield > 0) {
      this.shield--;
      this.invulnerable = this.spec.shieldInvulnerable;
      return 'shield';
    }
    this.hull--;
    this.hullLost++;
    this.invulnerable = this.spec.hullInvulnerable;
    return this.hull > 0 ? 'hull' : 'dead';
  }

  makeInvulnerable(seconds: number): void {
    this.invulnerable = Math.max(this.invulnerable, seconds);
  }

  /** Returns false if the hull was already full. */
  repair(segments: number): boolean {
    if (this.hull >= this.maxHull) return false;
    this.hull = Math.min(this.maxHull, this.hull + segments);
    return true;
  }

  /** Returns false if the shield was already full. */
  addShield(units: number): boolean {
    if (this.shield >= this.maxShield) return false;
    this.shield = Math.min(this.maxShield, this.shield + units);
    if (this.shield >= this.maxShield) this.shieldFill = 0;
    return true;
  }

  /** Fills the Energy bar; returns true when that earned a Special charge. */
  addEnergy(amount: number): boolean {
    if (this.charges >= this.spec.maxCharges) {
      this.energy = Math.min(1, this.energy + amount * this.spec.energyGain);
      return false;
    }
    this.energy += amount * this.spec.energyGain;
    if (this.energy < 1) return false;
    this.energy -= 1;
    this.charges++;
    if (this.charges >= this.spec.maxCharges) this.energy = Math.min(this.energy, 1);
    return true;
  }

  /** Returns false if the charges were already at the maximum. */
  addCharge(): boolean {
    if (this.charges >= this.spec.maxCharges) return false;
    this.charges++;
    return true;
  }

  useCharge(): boolean {
    if (this.charges <= 0 || this.hull <= 0) return false;
    this.charges--;
    // A full bar waiting for a free slot turns into the charge just freed.
    if (this.energy >= 1) {
      this.energy = 0;
      this.charges++;
    }
    return true;
  }
}
