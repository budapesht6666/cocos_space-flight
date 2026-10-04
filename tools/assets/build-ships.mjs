// Builds game-ready ship models from the Quaternius "Ultimate Spaceships" pack.
//
// For every entry in SHIPS it:
//   - swaps the embedded texture for the chosen colour variant, downscaled to TEXTURE_SIZE;
//   - bakes a transform into the vertices: pivot centred, nose turned from +Z to -Z
//     (our "up the screen"), largest horizontal extent normalised to 1 unit;
//   - writes a binary .glb into the Cocos project.
// In-game size comes from data (scripts/data), not from the model.
//
// Usage: node tools/assets/build-ships.mjs
// Sources: art-source/quaternius-ultimate-spaceships/<Ship>/{glTF,Textures} (see docs/ASSETS.md).

import { NodeIO, getBounds } from '@gltf-transform/core';
import { prune, dedup, transformMesh } from '@gltf-transform/functions';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SRC = path.join(ROOT, 'art-source/quaternius-ultimate-spaceships');
const OUT = path.join(ROOT, 'game/assets/resources/models/ships');
// A ship covers ~150 px on a phone screen, so 512² is plenty; JPEG keeps the web build small.
const TEXTURE_SIZE = 512;

/** ship: pack folder name, color: texture variant, out: output file name (no extension). */
const SHIPS = [
  { ship: 'Spitfire', color: 'Orange', out: 'spitfire_orange' },
  { ship: 'Bob', color: 'Red', out: 'bob_red' },
  { ship: 'Dispatcher', color: 'Red', out: 'dispatcher_red' },
];

async function buildShip({ ship, color, out }) {
  const io = new NodeIO();
  const doc = await io.read(path.join(SRC, ship, 'glTF', `${ship}.gltf`));
  const root = doc.getRoot();

  const image = await sharp(path.join(SRC, ship, 'Textures', `${ship}_${color}.png`))
    .resize(TEXTURE_SIZE, TEXTURE_SIZE)
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
  for (const texture of root.listTextures()) {
    texture.setImage(new Uint8Array(image)).setMimeType('image/jpeg').setName(`${out}_albedo`);
  }

  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const { min, max } = getBounds(scene);
  const center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const s = 1 / Math.max(max[0] - min[0], max[2] - min[2]);
  // v' = s * RotY(180°) * (v - center), column-major.
  const matrix = [
    -s, 0, 0, 0,
    0, s, 0, 0,
    0, 0, -s, 0,
    s * center[0], -s * center[1], s * center[2], 1,
  ];
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (mesh) transformMesh(mesh, matrix);
    node.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
    node.setName(out);
  }
  for (const material of root.listMaterials()) material.setName(`${out}_mat`);

  await doc.transform(dedup(), prune());
  await fs.mkdir(OUT, { recursive: true });
  const file = path.join(OUT, `${out}.glb`);
  await io.write(file, doc);

  const { min: nMin, max: nMax } = getBounds(doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0]);
  const size = nMax.map((v, i) => (v - nMin[i]).toFixed(2)).join(' × ');
  const kb = ((await fs.stat(file)).size / 1024).toFixed(0);
  console.log(`${out}.glb  ${kb} KB  size ${size}`);
}

for (const entry of SHIPS) await buildShip(entry);
