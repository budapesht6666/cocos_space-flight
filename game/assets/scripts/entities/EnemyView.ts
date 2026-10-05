// Builds the node tree that represents an enemy, per EnemyLook. Created once per pooled enemy.

import { MeshRenderer, Node, Prefab, instantiate, renderer } from 'cc';
import { STATION_TILE } from '../data/props';
import type { EnemyDef, PropId, Rgb } from '../data/types';
import type { RenderKit } from '../fx/RenderKit';

export interface EnemyView {
  node: Node;
  /** Part that turns to aim (turret head), or null. */
  head: Node | null;
  /** Materials lit white on a hit. */
  flash: renderer.MaterialInstance[];
  /** Elite marker ring (parked below the view when unused). */
  marker: MeshRenderer;
}

const ROCK: Rgb = [0.34, 0.3, 0.28];
/** Default vertical squash of assembly modules: station props are tall for a flying hull. */
const ASSEMBLY_HEIGHT = 0.6;
export const MARKER_PARK_Y = -1000;

export function createEnemyView(
  def: EnemyDef,
  prefab: Prefab | null,
  props: ReadonlyMap<PropId, Prefab>,
  kit: RenderKit,
  parent: Node,
  variant: number,
): EnemyView {
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
        if (material) flash.push(kit.track(material));
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
      if (material) flash.push(kit.track(material));
      break;
    }
    case 'assembly': {
      // Built facing down the screen (+Z) while the enemy node is turned 180° to face +Z,
      // so modules are mirrored into the node's local frame.
      const k = look.size;
      for (const m of look.modules) {
        const modulePrefab = props.get(m.prop);
        if (!modulePrefab) throw new Error(`enemy ${def.id}: prop ${m.prop} was not loaded`);
        const part = instantiate(modulePrefab);
        const s = (m.scale ?? STATION_TILE) * k;
        part.setScale(s, s * (m.height ?? ASSEMBLY_HEIGHT), s);
        part.setPosition(-m.x * k, (m.y ?? 0) * k, -m.z * k);
        if (m.rot) part.setRotationFromEuler(0, m.rot, 0);
        node.addChild(part);
        for (const meshRenderer of part.getComponentsInChildren(MeshRenderer)) {
          meshRenderer.setSharedMaterial(kit.props(), 0);
          meshRenderer.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF;
          const material = meshRenderer.getMaterialInstance(0);
          if (material) flash.push(kit.track(material));
        }
      }
      for (const light of look.lights) {
        const glow = kit.meshNode('light', node, kit.plane, kit.glow(light.color, 2.2));
        glow.setScale(light.size * k, 1, light.size * k);
        glow.setPosition(-light.x * k, (light.y ?? 0.1) * k, -light.z * k);
      }
      break;
    }
  }

  const markerNode = kit.meshNode('elite', node, kit.plane, kit.ringGlow([1, 1, 1], 1.6));
  markerNode.setPosition(0, MARKER_PARK_Y, 0);
  const marker = markerNode.getComponent(MeshRenderer) as MeshRenderer;
  return { node, head, flash, marker };
}

function findNode(root: Node, name: string): Node | null {
  if (root.name === name) return root;
  for (const child of root.children) {
    const found = findNode(child, name);
    if (found) return found;
  }
  return null;
}
