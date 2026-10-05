// Weapon visuals that aren't projectiles: Ion Laser beams (a strip from the nose to the top of the
// screen with a flare at the muzzle) and Tesla Arc lightning (jagged segments that flash for a few
// frames). Each look is one shared instanced material; unused strips are parked below the view.

import { Node, Quat, Vec3 } from 'cc';
import type { Rng } from '../core/Rng';
import type { Rgb } from '../data/types';
import { WORLD } from '../data/world';
import type { GameContext } from '../game/GameContext';

const PARK_Y = -1000;
const UP = new Vec3(0, 1, 0);
const tmpQuat = new Quat();
/** Beam strips: the main beam and two side beams. */
const BEAMS = 3;
/** Lightning segments, reused round-robin (6 links of up to 5 segments, plus fizzles). */
const ARC_SEGMENTS = 40;
const ARC_LIFE = 0.08;
const ARC_WIDTH = 0.26;
/** The beam's glow is wider than the strip that deals damage. */
const BEAM_GLOW = 1.8;

interface ArcSegment {
  node: Node;
  life: number;
}

export class WeaponFx {
  private readonly root: Node;
  private readonly y = WORLD.heights.playerBullets;
  private readonly beams: Node[] = [];
  private readonly beamShown: boolean[] = [];
  private readonly flare: Node | null = null;
  private readonly arcs: ArcSegment[] = [];
  private arcCursor = 0;
  private time = 0;

  constructor(
    ctx: GameContext,
    beamColor: Rgb | null,
    arcColor: Rgb | null,
    private readonly rng: Rng,
  ) {
    const kit = ctx.kit;
    this.root = new Node('WeaponFx');
    this.root.layer = ctx.worldRoot.layer;
    ctx.worldRoot.addChild(this.root);
    if (beamColor) {
      const material = kit.beam(beamColor, 1.7);
      for (let i = 0; i < BEAMS; i++) {
        const node = kit.meshNode('beam', this.root, kit.plane, material);
        node.setPosition(0, PARK_Y, 0);
        this.beams.push(node);
        this.beamShown.push(false);
      }
      this.flare = kit.meshNode('flare', this.root, kit.plane, kit.glow(beamColor, 2.2));
      this.flare.setPosition(0, PARK_Y, 0);
    }
    if (arcColor) {
      const material = kit.beam(arcColor, 2.8);
      for (let i = 0; i < ARC_SEGMENTS; i++) {
        const node = kit.meshNode('arc', this.root, kit.plane, material);
        node.setPosition(0, PARK_Y, 0);
        this.arcs.push({ node, life: 0 });
      }
    }
  }

  tick(dt: number): void {
    this.time += dt;
    for (let i = 0; i < this.arcs.length; i++) {
      const a = this.arcs[i];
      if (a.life <= 0) continue;
      a.life -= dt;
      if (a.life <= 0) a.node.setPosition(0, PARK_Y, 0);
    }
  }

  /** Shows beam `i` from (x0, z0) to (x1, z1) with a damage strip `width` wide; call every step it fires. */
  beam(i: number, x0: number, z0: number, x1: number, z1: number, width: number): void {
    const node = this.beams[i];
    if (!node) return;
    const flicker = 0.85 + 0.15 * Math.sin(this.time * 70 + i * 2.1);
    this.strip(node, x0, z0, x1, z1, width * BEAM_GLOW * flicker);
    this.beamShown[i] = true;
    if (i === 0 && this.flare) {
      const s = width * 3.2 * flicker;
      this.flare.setPosition(x0, this.y + 0.05, z0);
      this.flare.setScale(s, 1, s);
    }
  }

  hideBeam(i: number): void {
    if (!this.beamShown[i]) return;
    this.beamShown[i] = false;
    this.beams[i].setPosition(0, PARK_Y, 0);
    if (i === 0 && this.flare) this.flare.setPosition(0, PARK_Y, 0);
  }

  hideBeams(): void {
    for (let i = 0; i < this.beams.length; i++) this.hideBeam(i);
  }

  /** A jagged lightning bolt from (x0, z0) to (x1, z1) that flashes for a moment. */
  arc(x0: number, z0: number, x1: number, z1: number): void {
    if (this.arcs.length === 0) return;
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    if (len < 1e-3) return;
    // Unit perpendicular for the zig-zag.
    const px = -dz / len;
    const pz = dx / len;
    const count = Math.max(2, Math.min(5, Math.round(len / 0.8)));
    let fromX = x0;
    let fromZ = z0;
    for (let k = 1; k <= count; k++) {
      const t = k / count;
      const off = k < count ? this.rng.range(-0.32, 0.32) : 0;
      const toX = x0 + dx * t + px * off;
      const toZ = z0 + dz * t + pz * off;
      const seg = this.arcs[this.arcCursor];
      this.arcCursor = (this.arcCursor + 1) % this.arcs.length;
      this.strip(seg.node, fromX, fromZ, toX, toZ, ARC_WIDTH * this.rng.range(0.8, 1.3));
      seg.life = ARC_LIFE;
      fromX = toX;
      fromZ = toZ;
    }
  }

  clear(): void {
    this.hideBeams();
    for (const a of this.arcs) {
      a.life = 0;
      a.node.setPosition(0, PARK_Y, 0);
    }
  }

  /** Lays a unit plane along (x0, z0)–(x1, z1). */
  private strip(node: Node, x0: number, z0: number, x1: number, z1: number, width: number): void {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    node.setPosition((x0 + x1) / 2, this.y, (z0 + z1) / 2);
    Quat.fromAxisAngle(tmpQuat, UP, -Math.atan2(dx, -dz));
    node.setRotation(tmpQuat);
    node.setScale(width, 1, len);
  }
}
