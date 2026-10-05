// Workaround for the Cocos Creator 3.8.8 render graph in release builds.
//
// At the start of every frame the executor releases each MANAGED render target whose name is not
// in `pipeline.resourceUses`. The editor preview fills that list; release builds leave it empty.
// So a release build destroyed all its render targets (scene colour and depth, bloom chain, LDR
// copy) every frame and recreated them in the next one together with their framebuffers — six of
// each per frame, each framebuffer with a gl.checkFramebufferStatus that stalls on the GPU. On
// iPhone Safari that was most of the frame (Renderer 13–19 ms at any resolution).
// `includes` is only used by that release check, so answering "in use" keeps the targets alive
// across frames, exactly as the preview does. Names carry the window id, so they are reused, not
// accumulated, across scenes and shading-scale changes. The pipeline can be rebuilt while the
// game starts up, so scene components call this every frame; once patched it is one lookup.

import { director } from 'cc';

export function keepRenderTargets(): void {
  const pipeline = director.root?.pipeline as unknown as { resourceUses?: string[] } | null | undefined;
  const uses = pipeline?.resourceUses;
  if (!uses || Object.prototype.hasOwnProperty.call(uses, 'includes')) return;
  Object.defineProperty(uses, 'includes', { value: (): boolean => true });
}
