// Shared runtime render resources: procedural textures, primitive meshes and cached materials.
// Materials that share mesh + material are GPU-instanced (USE_INSTANCING), so hundreds of
// bullets or sparks cost one draw call per colour.

import { Color, EffectAsset, ImageAsset, Material, Mesh, MeshRenderer, Node, Texture2D, Vec3, primitives, utils } from 'cc';
import { bakeBadge } from '../core/glyphs';
import { buildRock } from '../core/rock';
import type { Rgb } from '../data/types';

/** Rock shapes: a few seeds and stretches so asteroids don't all look alike. */
const ROCK_VARIANTS = [
  { seed: 3, roughness: 0.22, stretch: [1.1, 0.8, 0.95] as const },
  { seed: 17, roughness: 0.26, stretch: [0.9, 0.75, 1.15] as const },
  { seed: 42, roughness: 0.2, stretch: [1.05, 0.9, 1.0] as const },
];

/** Technique indices inside builtin-unlit.effect. */
const UNLIT_OPAQUE = 0;
const UNLIT_TRANSPARENT = 1;
const UNLIT_ADD = 2;
/**
 * The scene uses HDR lighting (physical light units), where unlit colours come out roughly
 * an order of magnitude brighter and tone-map to white. Glow intensities in data are relative
 * (1 = normal glow, 2 = white-hot) and get multiplied by this to stay saturated.
 */
const HDR_UNLIT_SCALE = 0.4;

export class RenderKit {
  readonly glowTexture: Texture2D;
  readonly ringTexture: Texture2D;
  /** 1×1 plane lying on XZ, facing +Y. */
  readonly plane: Mesh;
  readonly cube: Mesh;
  /** Unit-diameter, unit-height cylinder along Y. */
  readonly cylinder: Mesh;
  /** Unit-radius low-poly rocks. */
  readonly rocks: readonly Mesh[];
  private readonly cache = new Map<string, Material>();

  constructor(
    private readonly unlitEffect: EffectAsset,
    private readonly standardEffect: EffectAsset,
  ) {
    this.glowTexture = makeRadialTexture(64, (d) => Math.pow(Math.max(0, 1 - d), 1.5));
    this.ringTexture = makeRadialTexture(128, (d) => Math.max(0, 1 - Math.abs(d - 0.82) / 0.14) ** 1.5);
    this.plane = utils.createMesh(primitives.plane({ width: 1, length: 1, widthSegments: 1, lengthSegments: 1 }));
    this.cube = utils.createMesh(primitives.box({ width: 1, height: 1, length: 1 }));
    this.cylinder = utils.createMesh(primitives.cylinder(0.5, 0.5, 1, { radialSegments: 12 }));
    this.rocks = ROCK_VARIANTS.map((spec) => utils.createMesh(buildRock(spec)));
  }

  /** Additive glow sprite material (shared, instanced). `intensity` > 1 pushes it into the bloom. */
  glow(rgb: Rgb, intensity = 1): Material {
    return this.cached(`glow:${rgb}:${intensity}`, () => this.additive(this.glowTexture, rgb, intensity));
  }

  /** Enemy bullet: white-hot core inside a coloured rim (shared, instanced, additive). */
  orb(rim: Rgb, intensity = 1): Material {
    return this.cached(`orb:${rim}:${intensity}`, () => {
      const texture = makeOrbTexture(64, rim);
      return this.additive(texture, [1, 1, 1], intensity);
    });
  }

  /** Lettered pickup badge, alpha-blended so it reads on top of glows (shared, instanced). */
  badge(letter: string, rgb: Rgb, intensity = 1): Material {
    return this.cached(`badge:${letter}:${rgb}:${intensity}`, () => {
      const size = 64;
      // Baked top row first; texture rows go bottom-up on our plane.
      const texture = rgbaTexture(flipRows(bakeBadge(letter, size, rgb), size, size), size, size, false);
      const material = new Material();
      material.initialize({
        effectAsset: this.unlitEffect,
        technique: UNLIT_TRANSPARENT,
        defines: { USE_TEXTURE: true, USE_INSTANCING: true },
      });
      material.setProperty('mainTexture', texture);
      material.setProperty('mainColor', new Color(255, 255, 255, 255));
      const scale = intensity * HDR_UNLIT_SCALE;
      material.setProperty('colorScale', new Vec3(scale, scale, scale));
      return material;
    });
  }

  /** Additive ring material — NOT shared: rings fade individually via mainColor alpha. */
  ringInstance(rgb: Rgb, intensity = 1): Material {
    const material = this.additive(this.ringTexture, rgb, intensity, false);
    return material;
  }

  /** Lit solid colour material (shared, instanced): debris, rocks, station blocks, credits. */
  solid(rgb: Rgb, metallic = 0.3, roughness = 0.7, emissive: Rgb | null = null): Material {
    return this.cached(`solid:${rgb}:${metallic}:${roughness}:${emissive}`, () => {
      const material = new Material();
      material.initialize({ effectAsset: this.standardEffect, technique: 0, defines: { USE_INSTANCING: true } });
      material.setProperty('mainColor', toColor(rgb));
      material.setProperty('roughness', roughness);
      material.setProperty('metallic', metallic);
      if (emissive) material.setProperty('emissive', toColor(emissive));
      return material;
    });
  }

  /** Unlit translucent colour (shared), for flat backdrops. */
  flat(rgb: Rgb, alpha: number): Material {
    return this.cached(`flat:${rgb}:${alpha}`, () => {
      const material = new Material();
      material.initialize({ effectAsset: this.unlitEffect, technique: UNLIT_TRANSPARENT });
      material.setProperty('mainColor', toColor(rgb, 1, alpha));
      material.setProperty('colorScale', new Vec3(HDR_UNLIT_SCALE, HDR_UNLIT_SCALE, HDR_UNLIT_SCALE));
      return material;
    });
  }

  /** Opaque unlit textured material for the backdrop; `scale` restores a normalised bake's brightness. */
  backdrop(texture: Texture2D, scale: number): Material {
    const material = new Material();
    material.initialize({ effectAsset: this.unlitEffect, technique: UNLIT_OPAQUE, defines: { USE_TEXTURE: true } });
    material.setProperty('mainTexture', texture);
    material.setProperty('mainColor', new Color(255, 255, 255, 255));
    material.setProperty('colorScale', new Vec3(scale, scale, scale));
    return material;
  }

  /** Wraps raw RGBA8 pixels in a texture. */
  textureFromRgba(data: Uint8Array, width: number, height: number, repeat: boolean): Texture2D {
    return rgbaTexture(data, width, height, repeat);
  }

  /** Creates a child node with a MeshRenderer using a shared material. */
  meshNode(name: string, parent: Node, mesh: Mesh, material: Material): Node {
    const node = new Node(name);
    node.layer = parent.layer;
    parent.addChild(node);
    const renderer = node.addComponent(MeshRenderer);
    renderer.mesh = mesh;
    renderer.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF;
    renderer.setSharedMaterial(material, 0);
    return node;
  }

  private additive(texture: Texture2D, rgb: Rgb, intensity: number, instanced = true): Material {
    const material = new Material();
    material.initialize({
      effectAsset: this.unlitEffect,
      technique: UNLIT_ADD,
      defines: { USE_TEXTURE: true, USE_INSTANCING: instanced },
    });
    material.setProperty('mainTexture', texture);
    material.setProperty('mainColor', toColor(rgb));
    const scale = intensity * HDR_UNLIT_SCALE;
    material.setProperty('colorScale', new Vec3(scale, scale, scale));
    return material;
  }

  private cached(key: string, make: () => Material): Material {
    let material = this.cache.get(key);
    if (!material) {
      material = make();
      this.cache.set(key, material);
    }
    return material;
  }
}

export function toColor(rgb: Rgb, scale = 1, alpha = 1): Color {
  const c = (v: number): number => Math.round(Math.min(1, Math.max(0, v * scale)) * 255);
  return new Color(c(rgb[0]), c(rgb[1]), c(rgb[2]), Math.round(alpha * 255));
}

function flipRows(data: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(data.length);
  const row = width * 4;
  for (let y = 0; y < height; y++) out.set(data.subarray(y * row, (y + 1) * row), (height - 1 - y) * row);
  return out;
}

function rgbaTexture(data: Uint8Array, width: number, height: number, repeat: boolean): Texture2D {
  const image = new ImageAsset({ _data: data, _compressed: false, width, height, format: Texture2D.PixelFormat.RGBA8888 });
  const texture = new Texture2D();
  texture.image = image;
  texture.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.LINEAR);
  const wrap = repeat ? Texture2D.WrapMode.REPEAT : Texture2D.WrapMode.CLAMP_TO_EDGE;
  texture.setWrapMode(wrap, wrap);
  return texture;
}

/** Round bullet: white core fading into the rim colour, alpha falling off towards the edge. */
function makeOrbTexture(size: number, rim: Rgb): Texture2D {
  const data = new Uint8Array(size * size * 4);
  const half = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - half, y - half) / half;
      // 0 inside the core, 1 at the rim.
      const k = Math.min(1, Math.max(0, (d - 0.22) / 0.3));
      const alpha = d >= 1 ? 0 : d < 0.55 ? 1 : Math.pow((1 - d) / 0.45, 1.6);
      const i = (y * size + x) * 4;
      data[i] = Math.round((1 + (rim[0] - 1) * k) * 255);
      data[i + 1] = Math.round((1 + (rim[1] - 1) * k) * 255);
      data[i + 2] = Math.round((1 + (rim[2] - 1) * k) * 255);
      data[i + 3] = Math.round(alpha * 255);
    }
  }
  return rgbaTexture(data, size, size, false);
}

/** White texture whose alpha follows `profile(d)`, d = distance from centre (0..1 at the edge). */
function makeRadialTexture(size: number, profile: (d: number) => number): Texture2D {
  const data = new Uint8Array(size * size * 4);
  const half = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - half, y - half) / half;
      const a = Math.round(Math.min(1, Math.max(0, profile(d))) * 255);
      const i = (y * size + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = a;
    }
  }
  return rgbaTexture(data, size, size, false);
}
