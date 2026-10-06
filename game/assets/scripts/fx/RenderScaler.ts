// Graphics quality: the 3D resolution and multisampling of the tier picked on the Settings page
// (GRAPHICS; QUALITY in data/visuals.ts). It never changes by itself, least of all mid-mission:
// a change rebuilds the render targets. The UI keeps full resolution.

import { Camera, rendering } from 'cc';
import type { QualityTier } from '../data/types';
import { QUALITY } from '../data/visuals';
import type { DebugFlags } from '../debug/DebugFlags';
import { SettingsService } from '../services/SettingsService';

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

function findTier(id: string): QualityTier | null {
  for (const tier of QUALITY.tiers) if (tier.id === id) return tier;
  return null;
}

/**
 * Applies the tier to a camera. URL flags (`?quality=`, `?scale=`, `?msaa=`) override the setting
 * for comparisons on a device.
 */
export class RenderScaler {
  /** For the debug overlay, e.g. "medium 3D×0.7". */
  label = '';

  constructor(private readonly settings: PipelineSettings, private readonly debug: DebugFlags) {
    this.apply();
  }

  /** The GRAPHICS setting changed (the menu applies it at once). */
  refresh(): void {
    this.apply();
  }

  private apply(): void {
    const debug = this.debug;
    const tier = findTier(debug.quality ?? SettingsService.current.quality) ?? QUALITY.tiers[0];
    const scale = debug.scale ?? tier.scale;
    const msaa = debug.msaa ?? tier.msaa;
    const s = this.settings;
    this.label = `${tier.id} 3D×${scale}${msaa ? ' MSAA' : ''}`;
    // Render targets are rebuilt only when something actually changes.
    if (Math.abs(s.shadingScale - scale) < 1e-3 && s.MsaaEnable === msaa) return;
    s.shadingScale = scale;
    s.MsaaEnable = msaa;
    rendering.forceResizeAllWindows();
  }
}
