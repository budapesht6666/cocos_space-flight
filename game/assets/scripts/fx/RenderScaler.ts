// Adaptive 3D resolution. On a phone the GPU (fill rate) is the limit, and it heats up and
// throttles over a session. When frames get slow, the 3D view renders at the next lower
// resolution step; after a while it tries the step above again (core/AdaptiveLevel.ts). The UI
// keeps full resolution. The step carries over to the next scene, so a new mission starts where
// the last one settled.

import { Camera, rendering } from 'cc';
import { AdaptiveLevel } from '../core/AdaptiveLevel';
import { RENDER_SCALE } from '../data/visuals';

/** The camera's BuiltinPipelineSettings (an editor-internal script, so typed here by hand). */
export interface PipelineSettings {
  shadingScale: number;
  bloomEnable: boolean;
  fxaaEnable: boolean;
}

export function pipelineSettings(camera: Camera): PipelineSettings | null {
  return camera.node.getComponent('BuiltinPipelineSettings') as unknown as PipelineSettings | null;
}

/** Sets the 3D resolution; render targets are rebuilt only when it actually changes. */
export function setShadingScale(settings: PipelineSettings, scale: number): void {
  if (Math.abs(settings.shadingScale - scale) < 1e-3) return;
  settings.shadingScale = scale;
  rendering.forceResizeAllWindows();
}

/** One for the page load: the step survives scene changes. */
const adaptive = new AdaptiveLevel({
  steps: RENDER_SCALE.levels.length,
  window: RENDER_SCALE.window,
  slowFrameMs: RENDER_SCALE.slowFrameMs,
  retryAfter: RENDER_SCALE.retryAfter,
});

export class RenderScaler {
  constructor(private readonly settings: PipelineSettings) {
    adaptive.restart();
    setShadingScale(settings, this.scale);
  }

  /** The 3D resolution in use. */
  get scale(): number {
    return RENDER_SCALE.levels[adaptive.level];
  }

  /** Call once per rendered frame of play (not while paused) with the real frame time. */
  tick(dt: number): void {
    if (adaptive.frame(dt)) setShadingScale(this.settings, this.scale);
  }

  /** The step the page has settled on, for scenes that don't adapt (the menu). */
  static get currentScale(): number {
    return RENDER_SCALE.levels[adaptive.level];
  }
}
