// Builds game-ready props (station modules, turrets, pickups) from CC0 packs.
//
// Every prop becomes ONE mesh with baked vertex colours and no texture, so the game draws all of
// them with a single shared, GPU-instanced material (builtin-standard + USE_VERTEX_COLOR):
//   - Kenney Space Kit: the pack's four flat materials (metal, metalDark, dark, metalRed) are
//     remapped to our dark palette. Light greys would blow out to white under the scene's HDR sun.
//     Turret palettes paint the accents enemy red (GDD: red/purple = enemy).
//   - Quaternius Ultimate Space Kit pickups: colours are sampled from the texture atlas per vertex.
// Turrets keep their rotating part as a separate child node `head` (pivot at its base) so the game
// can aim it; everything else is merged into `body`.
// Station modules keep the pack's tile units (1 tile = 1 unit), centred on X/Z, standing on y = 0;
// pickups are centred and normalised so the largest extent is 1. Sizes in game come from data.
//
// Usage: node tools/assets/build-props.mjs
// Sources: art-source/kenney-space-kit/*.glb, art-source/quaternius-ultimate-space-kit/*.glb
// (see docs/ASSETS.md).

import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const KENNEY = path.join(ROOT, 'art-source/kenney-space-kit');
const QUATERNIUS = path.join(ROOT, 'art-source/quaternius-ultimate-space-kit');
const OUT = path.join(ROOT, 'game/assets/resources/models/props');

/** sRGB colours (the shader linearises vertex colours). */
const STATION = {
  metal: [0.16, 0.18, 0.23],
  metalDark: [0.09, 0.1, 0.13],
  dark: [0.035, 0.04, 0.055],
  metalRed: [0.85, 0.42, 0.1],
  _defaultMat: [0.09, 0.1, 0.13],
  // Rocks and ore (mining set pieces).
  rock: [0.17, 0.14, 0.12],
  rockTrack: [0.11, 0.1, 0.09],
  crystal: [0.15, 0.85, 0.9],
};
const TURRET = {
  metal: [0.2, 0.2, 0.24],
  metalDark: [0.11, 0.11, 0.14],
  dark: [0.04, 0.04, 0.05],
  metalRed: [0.75, 0.08, 0.1],
  _defaultMat: [0.11, 0.11, 0.14],
};
/** The Shield pickup's sphere is red in the pack; red belongs to enemies, so it turns cyan. */
const RED_TO_CYAN = (c) => (c[0] > 0.45 && c[1] < 0.3 && c[2] < 0.3 ? [0.2, 0.8, 1.0] : c);

const PROPS = [
  // Station modules.
  { src: path.join(KENNEY, 'platform_large.glb'), out: 'station_platform', palette: STATION },
  { src: path.join(KENNEY, 'hangar_smallA.glb'), out: 'station_hangar', palette: STATION },
  { src: path.join(KENNEY, 'corridor_detailed.glb'), out: 'station_corridor', palette: STATION },
  { src: path.join(KENNEY, 'machine_generatorLarge.glb'), out: 'station_generator', palette: STATION },
  { src: path.join(KENNEY, 'satelliteDish_large.glb'), out: 'station_dish', palette: STATION },
  { src: path.join(KENNEY, 'structure_detailed.glb'), out: 'station_frame', palette: STATION },
  { src: path.join(KENNEY, 'hangar_roundGlass.glb'), out: 'station_dome', palette: STATION },
  { src: path.join(KENNEY, 'hangar_roundA.glb'), out: 'station_hub', palette: STATION },
  { src: path.join(KENNEY, 'hangar_largeA.glb'), out: 'station_hangarLarge', palette: STATION },
  { src: path.join(KENNEY, 'platform_high.glb'), out: 'station_pad', palette: STATION },
  { src: path.join(KENNEY, 'machine_barrelLarge.glb'), out: 'station_tank', palette: STATION },
  { src: path.join(KENNEY, 'pipe_ring.glb'), out: 'station_pipe', palette: STATION },
  { src: path.join(KENNEY, 'supports_high.glb'), out: 'station_lattice', palette: STATION },
  { src: path.join(KENNEY, 'rock_crystalsLargeA.glb'), out: 'station_ore', palette: STATION },
  { src: path.join(KENNEY, 'craft_cargoA.glb'), out: 'station_hauler', palette: STATION },
  // Turrets: the `turret` node (and its barrels) rotates.
  { src: path.join(KENNEY, 'turret_single.glb'), out: 'turret_single', palette: TURRET, head: 'turret' },
  { src: path.join(KENNEY, 'turret_double.glb'), out: 'turret_double', palette: TURRET, head: 'turret' },
  // Pickups.
  { src: path.join(QUATERNIUS, 'pickup_bullets.glb'), out: 'pickup_power', pickup: true },
  { src: path.join(QUATERNIUS, 'pickup_health.glb'), out: 'pickup_repair', pickup: true },
  { src: path.join(QUATERNIUS, 'pickup_sphere.glb'), out: 'pickup_shield', pickup: true, recolor: RED_TO_CYAN },
  { src: path.join(QUATERNIUS, 'pickup_thunder.glb'), out: 'pickup_energy', pickup: true },
];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

/** Collected triangles of one output part, in source world space. */
class Part {
  positions = [];
  normals = [];
  colors = [];
  indices = [];
}

async function buildProp(prop) {
  if (only && prop.out !== only) return;
  const doc = await io.read(prop.src);
  const root = doc.getRoot();
  const body = new Part();
  const head = new Part();
  let headPivot = null;
  const atlases = new Map();

  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (prop.head && node.getName() === prop.head) headPivot = node.getWorldTranslation();
    if (!mesh) continue;
    const part = prop.head && isUnder(node, prop.head) ? head : body;
    const world = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const color = await colorSource(prim, prop, atlases);
      appendPrimitive(part, prim, world, color);
    }
  }

  // Frame: centre X/Z; props stand on y = 0, pickups are centred and normalised.
  const all = body.positions.concat(head.positions);
  const [min, max] = bounds(all);
  const cx = (min[0] + max[0]) / 2;
  const cz = (min[2] + max[2]) / 2;
  const cy = prop.pickup ? (min[1] + max[1]) / 2 : min[1];
  const scale = prop.pickup ? 1 / Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) : 1;
  const pivot = headPivot ? [headPivot[0], headPivot[1], headPivot[2]] : [cx, cy, cz];
  shift(body.positions, cx, cy, cz, scale);
  shift(head.positions, pivot[0], pivot[1], pivot[2], scale);

  const out = new Document();
  const buffer = out.createBuffer();
  const material = out.createMaterial(`${prop.out}_vc`).setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.6).setMetallicFactor(0.4);
  const scene = out.createScene(prop.out);
  const rootNode = out.createNode(prop.out);
  scene.addChild(rootNode);
  rootNode.addChild(out.createNode('body').setMesh(writeMesh(out, buffer, material, 'body', body)));
  if (head.positions.length > 0) {
    const headNode = out.createNode('head').setMesh(writeMesh(out, buffer, material, 'head', head));
    headNode.setTranslation([(pivot[0] - cx) * scale, (pivot[1] - cy) * scale, (pivot[2] - cz) * scale]);
    rootNode.addChild(headNode);
  }
  out.getRoot().setDefaultScene(scene);

  await fs.mkdir(OUT, { recursive: true });
  const file = path.join(OUT, `${prop.out}.glb`);
  await io.write(file, out);
  const tris = (body.indices.length + head.indices.length) / 3;
  const size = [0, 1, 2].map((i) => ((max[i] - min[i]) * scale).toFixed(2)).join(' × ');
  const kb = ((await fs.stat(file)).size / 1024).toFixed(0);
  console.log(`${prop.out}.glb  ${kb} KB  ${tris} tris  size ${size}${head.positions.length ? '  + head' : ''}`);
}

function isUnder(node, name) {
  for (let n = node; n; n = n.getParentNode()) if (n.getName() === name) return true;
  return false;
}

/** Returns (u, v) => [r, g, b] in sRGB 0..1 for a primitive. */
async function colorSource(prim, prop, atlases) {
  const material = prim.getMaterial();
  const recolor = prop.recolor ?? ((c) => c);
  const texture = material?.getBaseColorTexture();
  if (texture) {
    let atlas = atlases.get(texture);
    if (!atlas) {
      const { data, info } = await sharp(Buffer.from(texture.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      atlas = { data, width: info.width, height: info.height };
      atlases.set(texture, atlas);
    }
    return (u, v) => {
      const x = Math.min(atlas.width - 1, Math.max(0, Math.floor(fract(u) * atlas.width)));
      const y = Math.min(atlas.height - 1, Math.max(0, Math.floor(fract(v) * atlas.height)));
      const i = (y * atlas.width + x) * 4;
      return recolor([atlas.data[i] / 255, atlas.data[i + 1] / 255, atlas.data[i + 2] / 255]);
    };
  }
  const name = material?.getName() ?? '_defaultMat';
  const fixed = prop.palette?.[name];
  if (!fixed) throw new Error(`${prop.out}: no palette colour for material '${name}'`);
  return () => recolor(fixed);
}

function appendPrimitive(part, prim, world, color) {
  const pos = prim.getAttribute('POSITION');
  const nrm = prim.getAttribute('NORMAL');
  const uv = prim.getAttribute('TEXCOORD_0');
  const base = part.positions.length / 3;
  const p = [0, 0, 0];
  const n = [0, 0, 0];
  const t = [0, 0];
  for (let i = 0; i < pos.getCount(); i++) {
    pos.getElement(i, p);
    part.positions.push(...transformPoint(world, p));
    if (nrm) nrm.getElement(i, n);
    part.normals.push(...transformNormal(world, nrm ? n : [0, 1, 0]));
    if (uv) uv.getElement(i, t);
    part.colors.push(...color(t[0], t[1]), 1);
  }
  const idx = prim.getIndices();
  if (idx) for (let i = 0; i < idx.getCount(); i++) part.indices.push(base + idx.getScalar(i));
  else for (let i = 0; i < pos.getCount(); i++) part.indices.push(base + i);
}

function writeMesh(doc, buffer, material, name, part) {
  const vertexCount = part.positions.length / 3;
  const indices = vertexCount < 65536 ? new Uint16Array(part.indices) : new Uint32Array(part.indices);
  const prim = doc
    .createPrimitive()
    .setMaterial(material)
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer))
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(part.positions)).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(part.normals)).setBuffer(buffer))
    .setAttribute('COLOR_0', doc.createAccessor().setType('VEC4').setArray(new Float32Array(part.colors)).setBuffer(buffer));
  return doc.createMesh(name).addPrimitive(prim);
}

// Column-major 4×4 helpers (glTF convention).
function transformPoint(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

function transformNormal(m, n) {
  // Source transforms are rotations, translations and uniform scales, so the upper 3×3 works.
  const x = m[0] * n[0] + m[4] * n[1] + m[8] * n[2];
  const y = m[1] * n[0] + m[5] * n[1] + m[9] * n[2];
  const z = m[2] * n[0] + m[6] * n[1] + m[10] * n[2];
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
}

function bounds(positions) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], positions[i + k]);
      max[k] = Math.max(max[k], positions[i + k]);
    }
  }
  return [min, max];
}

function shift(positions, x, y, z, scale) {
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = (positions[i] - x) * scale;
    positions[i + 1] = (positions[i + 1] - y) * scale;
    positions[i + 2] = (positions[i + 2] - z) * scale;
  }
}

function fract(v) {
  return v - Math.floor(v);
}

const only = process.argv[2];
for (const prop of PROPS) await buildProp(prop);
