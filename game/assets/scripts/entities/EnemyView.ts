// Builds the node tree that represents an enemy, per EnemyLook. Created once per pooled enemy.

import { MeshRenderer, Node, Prefab, instantiate, renderer } from 'cc';
import type { EnemyDef, Rgb } from '../data/types';
import type { RenderKit } from '../fx/RenderKit';

export interface EnemyView {
  node: Node;
  /** Part that turns to aim (turret head), or null. */
  head: Node | null;
  /** Materials lit white on a hit. */
  flash: renderer.MaterialInstance[];
}

const ROCK: Rgb = [0.34, 0.3, 0.28];
const TURRET_BASE: Rgb = [0.14, 0.15, 0.2];
const TURRET_HEAD: Rgb = [0.55, 0.12, 0.16];

export function createEnemyView(def: EnemyDef, prefab: Prefab | null, kit: RenderKit, parent: Node, variant: number): EnemyView {
  const look = def.look;
  const node = new Node(def.id);
  node.layer = parent.layer;
  parent.addChild(node);
  const flash: renderer.MaterialInstance[] = [];
  let head: Node | null = null;

  switch (look.kind) {
    case 'model': {
      if (!prefab) throw new Error(`no prefab loaded for enemy ${def.id}`);
      const model = instantiate(prefab);
      model.setScale(look.size, look.size, look.size);
      node.addChild(model);
      // Own material instance per enemy so the hit flash doesn't light up the whole squad.
      const meshRenderer = model.getComponentInChildren(MeshRenderer);
      const material = meshRenderer ? meshRenderer.getMaterialInstance(0) : null;
      if (material) flash.push(material);
      break;
    }
    case 'rock': {
      const rock = kit.meshNode('rock', node, kit.rocks[variant % kit.rocks.length], kit.solid(ROCK, 0.05, 0.95));
      const radius = look.size / 2;
      rock.setScale(radius, radius, radius);
      const material = rock.getComponent(MeshRenderer)?.getMaterialInstance(0);
      if (material) flash.push(material);
      break;
    }
    case 'turret': {
      const s = look.size;
      // Bases share an instanced material (one draw call for all); the head parts get their own
      // instances so they can flash.
      const base = kit.meshNode('base', node, kit.cylinder, kit.solid(TURRET_BASE, 0.6, 0.5));
      base.setScale(1.0 * s, 0.35 * s, 1.0 * s);
      base.setPosition(0, 0.17 * s, 0);
      head = new Node('head');
      head.layer = node.layer;
      node.addChild(head);
      head.setPosition(0, 0.45 * s, 0);
      const headMaterial = kit.solid(TURRET_HEAD, 0.5, 0.45);
      const dome = kit.meshNode('dome', head, kit.cube, headMaterial);
      dome.setScale(0.62 * s, 0.32 * s, 0.62 * s);
      const barrel = kit.meshNode('barrel', head, kit.cube, headMaterial);
      barrel.setScale(0.16 * s, 0.14 * s, 0.75 * s);
      barrel.setPosition(0, 0.04 * s, -0.5 * s);
      for (const part of [dome, barrel]) {
        const material = part.getComponent(MeshRenderer)?.getMaterialInstance(0);
        if (material) flash.push(material);
      }
      break;
    }
  }
  return { node, head, flash };
}
