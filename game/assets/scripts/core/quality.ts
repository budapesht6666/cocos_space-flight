// Graphics quality: what kind of device this is, which decides the tier it starts with until the
// player picks one in the settings (QUALITY.devices). Engine-free (fx/RenderScaler.ts applies the
// tier to the camera).

import type { DeviceKind } from '../data/types';

/** Renderer strings of GPU-less WebGL: Chrome's SwiftShader, Mesa's llvmpipe/softpipe, Windows' WARP. */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render/i;

/**
 * Phones and tablets go by their OS: an iPad's Safari presents itself as a Mac. The GPU's name
 * tells little more: iOS Safari reports every model as "Apple GPU", and a desktop's name says
 * nothing reliable about its speed. It does tell when there is no GPU at all.
 */
export function deviceKind(mobileOs: boolean, renderer: string, native = false): DeviceKind {
  if (SOFTWARE_RENDERER.test(renderer)) return 'software';
  if (mobileOs) return native ? 'nativePhone' : 'mobile';
  return 'desktop';
}
