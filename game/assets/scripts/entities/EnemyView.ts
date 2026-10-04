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

export function createEnemyView(def: EnemyDef, prefab: Prefab | null, kit: RenderKit, parent: Node, variant: number): EnemyView {
  const look = def.look;
  const node = new Node(def.id);
  node.layer = parent.layer;
  parent.addChild(node);
  const flash: renderer.MaterialInstance[] = [];
  let head: Node | null = null;

  switch (look.kind) {
    case 'model':
    case 'prop': {
      if (!prefab) throw new Error(`no prefab loaded for enemy ${def.id}`);
      const model = instantiate(prefab);
      model.setScale(look.size, look.size, look.size);
      node.addChild(model);
      // Own material instance per enemy (and per part) so the hit flash doesn't light up the
      // whole squad. Props start from the shared vertex-colour material.
      for (const meshRenderer of model.getComponentsInChildren(MeshRenderer)) {
        if (look.kind === 'prop') meshRenderer.setSharedMaterial(kit.props(), 0);
        const material = meshRenderer.getMaterialInstance(0);
        if (material) flash.push(material);
      }
      if (look.kind === 'prop' && look.aim) {
        head = findNode(model, look.aim);
        if (!head) throw new Error(`enemy ${def.id}: prop ${look.prop} has no node '${look.aim}'`);
      }
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
  }
  return { node, head, flash };
}

function findNode(root: Node, name: string): Node | null {
  if (root.name === name) return root;
  for (const child of root.children) {
    const found = findNode(child, name);
    if (found) return found;
  }
  return null;
}
