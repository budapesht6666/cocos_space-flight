// Big plane far below the playfield showing a nebula baked once at start-up (core/nebula.ts).
// Scrolling is a UV offset, so the per-pixel cost is a single texture fetch — cheap on phones.

import { Material, MeshRenderer, Node, Vec4 } from 'cc';
import { bakeNebula } from '../core/nebula';
import { NEBULA } from '../data/visuals';
import type { BackdropContext } from '../game/GameContext';

export class Nebula {
  private readonly node: Node;
  private readonly material: Material;
  private readonly tiling = new Vec4(1, 1, 0, 0);
  private offset = 0;

  constructor(private readonly ctx: BackdropContext) {
    const baked = bakeNebula({
      width: NEBULA.textureWidth,
      height: NEBULA.textureHeight,
      cellsX: NEBULA.cellsX,
      cellsY: NEBULA.cellsY,
      base: NEBULA.base,
      colorA: NEBULA.colorA,
      colorB: NEBULA.colorB,
      colorC: NEBULA.colorC,
      intensity: NEBULA.intensity,
      seed: NEBULA.seed,
    });
    const texture = ctx.kit.textureFromRgba(baked.data, baked.width, baked.height, true);
    this.material = ctx.kit.backdrop(texture, baked.scale);
    this.node = new Node('Nebula');
    this.node.layer = ctx.worldRoot.layer;
    ctx.worldRoot.addChild(this.node);
    const renderer = this.node.addComponent(MeshRenderer);
    renderer.mesh = ctx.kit.plane;
    renderer.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF;
    renderer.setSharedMaterial(this.material, 0);
    this.layout();
  }

  /** Sizes the plane to cover the whole view at its depth. */
  layout(): void {
    const f = this.ctx.playfield.framing;
    const k = (f.camY - NEBULA.depth) / f.camY;
    const minZ = f.camZ + (f.topZ - 4 - f.camZ) * k;
    const maxZ = f.camZ + (f.bottomZ + 4 - f.camZ) * k;
    const width = (this.ctx.playfield.halfWidth(f.topZ) * k + 6) * 2;
    this.node.setPosition(0, NEBULA.depth, (minZ + maxZ) / 2);
    this.node.setScale(width, 1, maxZ - minZ);
  }

  tick(dt: number): void {
    this.offset = (this.offset + NEBULA.scrollSpeed * dt) % 1;
  }

  render(): void {
    this.tiling.w = this.offset;
    this.material.setProperty('tilingOffset', this.tiling);
  }
}
