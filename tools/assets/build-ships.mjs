// Builds game-ready ship models from the Quaternius "Ultimate Spaceships" pack.
//
// For every entry in SHIPS it:
//   - swaps the embedded texture for the chosen colour variant, downscaled to TEXTURE_SIZE
//     (optionally recoloured when the pack has no such variant, see RECOLORS);
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

/**
 * Recolours for variants we don't have: per pixel in HSV. Imperial ships only in Blue, Green and
 * Orange here; `red` turns the orange paint enemy red and darkens it like the pack's Red variants.
 */
const RECOLORS = {
  red: (h, s, v) => {
    const orange = s > 0.25 && h >= 12 && h <= 55;
    if (orange) return [356, Math.min(1, s * 1.15), v * 0.68];
    return [h, s, v * 0.62];
  },
};

/** ship: pack folder name, color: texture variant, out: output file name (no extension). */
const SHIPS = [
  { ship: 'Spitfire', color: 'Orange', out: 'spitfire_orange' },
  { ship: 'Bob', color: 'Red', out: 'bob_red' },
  { ship: 'Dispatcher', color: 'Red', out: 'dispatcher_red' },
  { ship: 'Challenger', color: 'Purple', out: 'challenger_purple' },
  { ship: 'Challenger', color: 'Red', out: 'challenger_red' },
  { ship: 'Imperial', color: 'Orange', recolor: 'red', out: 'imperial_red' },
];

async function buildShip({ ship, color, recolor, out }) {
  const io = new NodeIO();
  const doc = await io.read(path.join(SRC, ship, 'glTF', `${ship}.gltf`));
  const root = doc.getRoot();

  let texture = sharp(path.join(SRC, ship, 'Textures', `${ship}_${color}.png`)).resize(TEXTURE_SIZE, TEXTURE_SIZE).removeAlpha();
  if (recolor) {
    const { data, info } = await texture.raw().toBuffer({ resolveWithObject: true });
    recolorPixels(data, RECOLORS[recolor]);
    texture = sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } });
  }
  const image = await texture.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
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

/** Applies `fn(hueDeg, sat, val) => [h, s, v]` to packed RGB bytes in place. */
function recolorPixels(data, fn) {
  for (let i = 0; i < data.length; i += 3) {
    const [h, s, v] = rgbToHsv(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255);
    const [r, g, b] = hsvToRgb(...fn(h, s, v));
    data[i] = Math.round(r * 255);
    data[i + 1] = Math.round(g * 255);
    data[i + 2] = Math.round(b * 255);
  }
}

function rgbToHsv(r, g, b) {
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return [(h * 60 + 360) % 360, max > 0 ? d / max : 0, max];
}

function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m];
}

const only = process.argv[2];
for (const entry of SHIPS) if (!only || entry.out === only) await buildShip(entry);
