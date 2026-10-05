// Graphics quality: the 3D resolution and multisampling, by tier (QUALITY in data/visuals.ts). On
// a phone the GPU (fill rate) is the limit, and it heats up and throttles over a session; a
// desktop GPU has room for everything. Each kind of device starts at its own tier (core/quality.ts).
// When frames get slow, the next lower tier takes over; after a while the one above is tried again
// (core/AdaptiveLevel.ts) — that is how a faster device earns a better tier: the browser does not
// say how fast a GPU is. The UI keeps full resolution. The tier carries over to the next scene, and
// the one a device held through a mission is remembered for its next page load.

import { Camera, director, rendering, sys } from 'cc';
import { AdaptiveLevel } from '../core/AdaptiveLevel';
import { deviceKind, qualityLadder, tierToRemember, type QualityLadder } from '../core/quality';
import type { DeviceKind, QualityTier } from '../data/types';
import { QUALITY } from '../data/visuals';
import type { DebugFlags } from '../debug/DebugFlags';

/** Device-local, apart from the save: it describes this device, not the player's progress. */
const KEY = 'spaceflight.quality';

/** The camera's BuiltinPipelineSettings (an editor-internal script, so typed here by hand). */
export interface PipelineSettings {
  shadingScale: number;
  MsaaEnable: boolean;
  bloomEnable: boolean;
  fxaaEnable: boolean;
}

export function pipelineSettings(camera: Camera): PipelineSettings | null {
  return camera.node.getComponent('BuiltinPipelineSettings') as unknown as PipelineSettings | null;
}

interface DeviceQualityState {
  kind: DeviceKind;
  ladder: QualityLadder;
  adaptive: AdaptiveLevel;
  remembered: string | null;
}

function storage(): Storage | null {
  try {
    return sys.localStorage;
  } catch (err) {
    return null;
  }
}

/** One for the page load, built on first use (the GPU is known by then): the tier survives scene changes. */
let state: DeviceQualityState | null = null;

function deviceQuality(): DeviceQualityState {
  if (state) return state;
  const mobileOs = sys.isMobile || sys.os === sys.OS.IOS || sys.os === sys.OS.ANDROID;
  const kind = deviceKind(mobileOs, director.root?.device.renderer ?? '');
  let remembered: string | null = null;
  try {
    remembered = storage()?.getItem(KEY) ?? null;
  } catch (err) {
    // Nothing remembered.
  }
  const ladder = qualityLadder(QUALITY.tiers, QUALITY.devices[kind], remembered);
  const adaptive = new AdaptiveLevel(
    { steps: ladder.tiers.length, window: QUALITY.window, slowFrameMs: QUALITY.slowFrameMs, retryAfter: QUALITY.retryAfter },
    ladder.start,
  );
  state = { kind, ladder, adaptive, remembered };
  return state;
}

function findTier(id: string): QualityTier | null {
  for (const tier of QUALITY.tiers) if (tier.id === id) return tier;
  return null;
}

/**
 * Applies the tier to a camera: adapting to frame times in the game, as last settled in the menu.
 * URL flags (`?quality=`, `?scale=`, `?msaa=`) fix it for comparisons on a device.
 */
export class RenderScaler {
  /** For the debug overlay, e.g. "ultra 3D×1 MSAA" or "medium 3D×0.7 (mobile)". */
  label = '';
  private readonly fixed: boolean;

  constructor(private readonly settings: PipelineSettings, private readonly debug: DebugFlags) {
    this.fixed = debug.quality !== null || debug.scale !== null || debug.msaa !== null;
    deviceQuality().adaptive.restart();
    this.apply();
  }

  /** Call once per rendered frame of play (not while paused) with the real frame time. */
  tick(dt: number): void {
    if (!this.fixed && deviceQuality().adaptive.frame(dt)) this.apply();
  }

  /** End of a mission: the tier this device held becomes its next start. */
  remember(): void {
    if (this.fixed) return;
    const q = deviceQuality();
    const id = tierToRemember(q.ladder, q.adaptive.stable).id;
    if (id === q.remembered) return;
    try {
      storage()?.setItem(KEY, id);
      q.remembered = id;
    } catch (err) {
      // Not remembered; the device adapts again next time.
    }
  }

  private apply(): void {
    const q = deviceQuality();
    const debug = this.debug;
    const tier = (debug.quality !== null ? findTier(debug.quality) : null) ?? q.ladder.tiers[q.adaptive.level];
    const scale = debug.scale ?? tier.scale;
    const msaa = debug.msaa ?? tier.msaa;
    const s = this.settings;
    this.label = `${tier.id} 3D×${scale}${msaa ? ' MSAA' : ''}${q.kind !== 'desktop' ? ` (${q.kind})` : ''}`;
    // Render targets are rebuilt only when something actually changes.
    if (Math.abs(s.shadingScale - scale) < 1e-3 && s.MsaaEnable === msaa) return;
    s.shadingScale = scale;
    s.MsaaEnable = msaa;
    rendering.forceResizeAllWindows();
  }
}
