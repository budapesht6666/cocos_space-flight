// Ground structures that scroll beneath the flight plane; their turrets are ordinary enemies with
// 'ground' movement placed on top. Every piece a mission uses is built at load and parked.

import { Node } from 'cc';
import { swapRemove } from '../core/Pool';
import { ENEMIES } from '../data/enemies';
import { SET_PIECE_DEPTH, SET_PIECE_TONES, SET_PIECES } from '../data/setPieces';
import type { SetPieceDef, SetPieceEvent, SetPieceId } from '../data/types';
import { WORLD } from '../data/world';
import type { EnemySystem } from './EnemySystem';
import type { GameContext } from './GameContext';

interface Piece {
  def: SetPieceDef;
  node: Node;
  z: number;
}

const PARK_Y = -1000;

export class SetPieceSystem {
  private readonly root: Node;
  private readonly free = new Map<SetPieceId, Piece[]>();
  private readonly active: Piece[] = [];

  constructor(
    private readonly ctx: GameContext,
    private readonly enemies: EnemySystem,
    /** How many of each piece the mission needs at once. */
    counts: ReadonlyMap<SetPieceId, number>,
    private readonly scrollSpeed: number,
  ) {
    this.root = new Node('SetPieces');
    this.root.layer = ctx.worldRoot.layer;
    ctx.worldRoot.addChild(this.root);
    for (const [id, count] of counts) {
      const list: Piece[] = [];
      for (let i = 0; i < count; i++) list.push({ def: SET_PIECES[id], node: this.build(SET_PIECES[id]), z: 0 });
      this.free.set(id, list);
    }
  }

  spawn(event: SetPieceEvent): void {
    const piece = this.free.get(event.piece)?.pop();
    if (!piece) throw new Error(`set piece ${event.piece} was not preloaded`);
    const field = this.ctx.playfield;
    const x = field.contentX(event.x);
    piece.z = field.spawnZ - piece.def.length / 2;
    piece.node.setPosition(x, WORLD.heights.ground, piece.z);
    this.active.push(piece);
    for (const t of piece.def.turrets) {
      const def = ENEMIES[t.enemy];
      this.enemies.spawn(def, def.move, x + t.x, piece.z + t.z, null, false, -1);
    }
  }

  tick(dt: number): void {
    const limit = this.ctx.playfield.despawnZ;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.z += this.scrollSpeed * dt;
      if (p.z - p.def.length / 2 > limit) this.release(swapRemove(this.active, i));
    }
  }

  render(): void {
    for (let i = 0; i < this.active.length; i++) {
      const p = this.active[i];
      const pos = p.node.position;
      p.node.setPosition(pos.x, WORLD.heights.ground, p.z);
    }
  }

  clear(): void {
    while (this.active.length > 0) this.release(this.active.pop() as Piece);
  }

  private release(p: Piece): void {
    p.node.setPosition(0, PARK_Y, 0);
    this.free.get(p.def.id)!.push(p);
  }

  private build(def: SetPieceDef): Node {
    const kit = this.ctx.kit;
    const node = new Node(def.id);
    node.layer = this.root.layer;
    this.root.addChild(node);
    for (const b of def.blocks) {
      const material = b.tone === 'trim' ? kit.solid(SET_PIECE_TONES.trim, 0.2, 0.5, [0.35, 0.16, 0.03]) : kit.solid(SET_PIECE_TONES[b.tone], 0.55, 0.6);
      const block = kit.meshNode('block', node, kit.cube, material);
      // Blocks hang from their top surface (h above the deck) down to SET_PIECE_DEPTH below it.
      const height = SET_PIECE_DEPTH + b.h;
      block.setScale(b.w, height, b.l);
      block.setPosition(b.x, b.h - height / 2, b.z);
    }
    for (const light of def.lights) {
      const glow = kit.meshNode('light', node, kit.plane, kit.glow(light.color, 2.2));
      glow.setScale(light.size, 1, light.size);
      glow.setPosition(light.x, 0.05 + maxHeightAt(def, light.x, light.z), light.z);
    }
    node.setPosition(0, PARK_Y, 0);
    return node;
  }
}

/** Top of the tallest block under a point, so lights sit on the surface. */
function maxHeightAt(def: SetPieceDef, x: number, z: number): number {
  let h = 0;
  for (const b of def.blocks) {
    if (Math.abs(x - b.x) <= b.w / 2 && Math.abs(z - b.z) <= b.l / 2) h = Math.max(h, b.h);
  }
  return h;
}
