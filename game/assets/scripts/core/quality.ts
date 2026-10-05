// Graphics quality tiers: what kind of device this is, which tiers it may use and where it starts.
// Engine-free (fx/RenderScaler.ts measures the frames with core/AdaptiveLevel.ts and applies the
// tier to the camera).

import type { DeviceKind, DeviceQuality, QualityTier } from '../data/types';

/** Renderer strings of GPU-less WebGL: Chrome's SwiftShader, Mesa's llvmpipe/softpipe, Windows' WARP. */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render/i;

/**
 * Phones and tablets go by their OS: an iPad's Safari presents itself as a Mac. The GPU's name
 * tells little more: iOS Safari reports every model as "Apple GPU", and a desktop's name says
 * nothing reliable about its speed, so the frame times decide the rest. It does tell when there is
 * no GPU at all.
 */
export function deviceKind(mobileOs: boolean, renderer: string): DeviceKind {
  if (SOFTWARE_RENDERER.test(renderer)) return 'software';
  return mobileOs ? 'mobile' : 'desktop';
}

export interface QualityLadder {
  /** The tiers this device may use: from its best one down to the lowest. */
  tiers: readonly QualityTier[];
  /** Index in `tiers` to begin at. */
  start: number;
  /** Index in `tiers` a device of this kind begins at when it remembers nothing. */
  defaultStart: number;
}

function indexOf(tiers: readonly QualityTier[], id: string): number {
  for (let i = 0; i < tiers.length; i++) if (tiers[i].id === id) return i;
  return -1;
}

/**
 * The device's ladder. It starts at the tier it held last time (`remembered`) when that is better
 * than the default for its kind: a faster phone that climbed once begins up there.
 */
export function qualityLadder(all: readonly QualityTier[], device: DeviceQuality, remembered: string | null): QualityLadder {
  const tiers = all.slice(Math.max(0, indexOf(all, device.best)));
  const defaultStart = Math.max(0, indexOf(tiers, device.start));
  const held = remembered === null ? -1 : indexOf(tiers, remembered);
  return { tiers, start: held >= 0 && held < defaultStart ? held : defaultStart, defaultStart };
}

/**
 * The tier to remember after a mission, from the best step that held (`stable`). Never one below
 * the default start: a run in Low Power Mode (30 FPS whatever the resolution) or on a hot phone
 * must not drag the next session down; it adapts down again by itself if it has to.
 */
export function tierToRemember(ladder: QualityLadder, stable: number): QualityTier {
  return ladder.tiers[Math.max(0, Math.min(stable, ladder.defaultStart))];
}
