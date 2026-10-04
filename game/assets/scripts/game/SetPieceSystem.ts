// Ground structures that scroll beneath the flight plane; their turrets are ordinary enemies with
// 'ground' movement placed on top. Every piece a mission uses is built at load and parked.
// Modules share one vertex-colour material, so repeated modules draw as one instanced call.

import { MeshRenderer, Node, Prefab, instantiate } from 'cc';
import { swapRemove } from '../core/Pool';
import { ENEMIES } from '../data/enemies';
import { STATION_HEIGHT, STATION_TILE } from '../data/props';
import { SET_PIECES } from '../data/setPieces';
import type { PropId, SetPieceDef, SetPieceEvent, SetPieceId } from '../data/types';
import { WORLD } from '../data/world';
import type { EnemySystem } from './EnemySystem';
import type { GameContext } from './GameContext';

interface Piece {
  def: SetPieceDef;
  node: Node;
  x: number;
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
    /** How many of each piece the mission needs. */
    counts: ReadonlyMap<SetPieceId, number>,
    private readonly props: ReadonlyMap<PropId, Prefab>,
    private readonly scrollSpeed: number,
  ) {
    this.root = new Node('SetPieces');
    this.root.layer = ctx.worldRoot.layer;
    ctx.worldRoot.addChild(this.root);
    for (const [id, count] of counts) {
      const list: Piece[] = [];
      for (let i = 0; i < count; i++) list.push({ def: SET_PIECES[id], node: this.build(SET_PIECES[id]), x: 0, z: 0 });
      this.free.set(id, list);
    }
  }

  spawn(event: SetPieceEvent): void {
    const piece = this.free.get(event.piece)?.pop();
    if (!piece) throw new Error(`set piece ${event.piece} was not preloaded`);
    const field = this.ctx.playfield;
    piece.x = field.contentX(event.x);
    piece.z = field.spawnZ - piece.def.length / 2;
    piece.node.setPosition(piece.x, WORLD.heights.ground, piece.z);
    this.active.push(piece);
    for (const t of piece.def.turrets) {
      const def = ENEMIES[t.enemy];
      this.enemies.spawn(def, def.move, piece.x + t.x, piece.z + t.z, null, false, -1);
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
      p.node.setPosition(p.x, WORLD.heights.ground, p.z);
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
    const material = kit.props();
    for (const m of def.modules) {
      const prefab = this.props.get(m.prop);
      if (!prefab) throw new Error(`prop ${m.prop} was not loaded`);
      const part = instantiate(prefab);
      for (const r of part.getComponentsInChildren(MeshRenderer)) {
        r.setSharedMaterial(material, 0);
        r.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF;
      }
      part.setScale(STATION_TILE, STATION_TILE * STATION_HEIGHT, STATION_TILE);
      part.setPosition(m.x, 0, m.z);
      if (m.rot) part.setRotationFromEuler(0, m.rot, 0);
      node.addChild(part);
    }
    for (const light of def.lights) {
      const glow = kit.meshNode('light', node, kit.plane, kit.glow(light.color, 2.2));
      glow.setScale(light.size, 1, light.size);
      glow.setPosition(light.x, 0.12, light.z);
    }
    node.setPosition(0, PARK_Y, 0);
    return node;
  }
}
