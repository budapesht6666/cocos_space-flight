// Parallax star layers below the gameplay plane. Perspective already makes deeper layers
// look slower; speedScale exaggerates the effect. Each layer is one instanced draw call.

import { Node } from 'cc';
import { wrap } from '../core/math';
import { COLORS, STARFIELD } from '../data/visuals';
import type { BackdropContext } from '../game/GameContext';

interface Star {
  node: Node;
  x: number;
  z: number;
}

interface Layer {
  y: number;
  speedScale: number;
  size: number;
  stars: Star[];
  minZ: number;
  maxZ: number;
  halfWidth: number;
}

export class Starfield {
  private readonly root: Node;
  private readonly layers: Layer[] = [];

  constructor(
    private readonly ctx: BackdropContext,
    private readonly scrollSpeed: number,
  ) {
    this.root = new Node('Starfield');
    this.root.layer = ctx.worldRoot.layer;
    ctx.worldRoot.addChild(this.root);
    const near = ctx.kit.glow(COLORS.starNear, 2.0);
    const far = ctx.kit.glow(COLORS.starFar, 1.6);
    STARFIELD.layers.forEach((spec, index) => {
      const material = index === 0 ? near : far;
      const layer: Layer = { y: spec.y, speedScale: spec.speedScale, size: spec.size, stars: [], minZ: 0, maxZ: 0, halfWidth: 0 };
      for (let i = 0; i < spec.count; i++) {
        const node = ctx.kit.meshNode('star', this.root, ctx.kit.plane, material);
        layer.stars.push({ node, x: 0, z: 0 });
      }
      this.layers.push(layer);
    });
    this.layout();
  }

  /** Recomputes layer bounds for the current framing and scatters the stars. */
  layout(): void {
    const f = this.ctx.playfield.framing;
    const rng = this.ctx.rng;
    for (const layer of this.layers) {
      // What the camera sees at depth y is the y = 0 view scaled about the camera's foot point.
      const k = (f.camY - layer.y) / f.camY;
      layer.minZ = f.camZ + (f.topZ - 2 - f.camZ) * k;
      layer.maxZ = f.camZ + (f.bottomZ + 2 - f.camZ) * k;
      layer.halfWidth = this.ctx.playfield.halfWidth(f.topZ) * k + 1;
      for (const star of layer.stars) {
        star.x = rng.range(-layer.halfWidth, layer.halfWidth);
        star.z = rng.range(layer.minZ, layer.maxZ);
        const s = layer.size * rng.range(0.6, 1.4);
        star.node.setScale(s, 1, s);
      }
    }
  }

  tick(dt: number): void {
    const rng = this.ctx.rng;
    for (const layer of this.layers) {
      const dz = this.scrollSpeed * layer.speedScale * dt;
      for (const star of layer.stars) {
        star.z += dz;
        if (star.z > layer.maxZ) {
          star.z = wrap(star.z, layer.minZ, layer.maxZ);
          star.x = rng.range(-layer.halfWidth, layer.halfWidth);
        }
      }
    }
  }

  render(): void {
    for (const layer of this.layers) {
      for (const star of layer.stars) star.node.setPosition(star.x, layer.y, star.z);
    }
  }
}
