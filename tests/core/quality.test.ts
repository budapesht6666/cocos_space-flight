import { describe, expect, it } from 'vitest';
import { deviceKind } from '../../game/assets/scripts/core/quality';
import { defaultSettings } from '../../game/assets/scripts/core/settings';
import { QUALITY } from '../../game/assets/scripts/data/visuals';

function tier(id: string) {
  const t = QUALITY.tiers.find((x) => x.id === id);
  if (!t) throw new Error(`no tier ${id}`);
  return t;
}

describe('graphics quality tiers', () => {
  it('tells phones, desktops and GPU-less WebGL apart', () => {
    expect(deviceKind(true, 'Apple GPU')).toBe('mobile');
    expect(deviceKind(false, 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe('desktop');
    expect(deviceKind(false, 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)')).toBe('software');
    expect(deviceKind(false, 'llvmpipe (LLVM 15.0.7, 256 bits)')).toBe('software');
    expect(deviceKind(true, 'Apple A16 GPU', true)).toBe('nativePhone');
    expect(deviceKind(false, 'Apple M2', true)).toBe('desktop');
  });

  it('tiers go from best to worst; only the best has MSAA', () => {
    for (let i = 1; i < QUALITY.tiers.length; i++) {
      expect(QUALITY.tiers[i].scale).toBeLessThan(QUALITY.tiers[i - 1].scale);
      expect(QUALITY.tiers[i].msaa).toBe(false);
    }
    expect(QUALITY.tiers[0].msaa).toBe(true);
  });

  it('each kind of device starts on its tier until the player picks: desktop ultra, phone medium (70%, as iPhone was tuned), no GPU lowest', () => {
    expect(defaultSettings('desktop').quality).toBe('ultra');
    expect(tier(defaultSettings('mobile').quality).scale).toBe(0.7);
    expect(tier(defaultSettings('mobile').quality).msaa).toBe(false);
    expect(defaultSettings('software').quality).toBe('lowest');
  });

  it('the native iOS app starts on ultra: Metal held 60 FPS there on iPhone 15 Plus', () => {
    expect(defaultSettings('nativePhone').quality).toBe('ultra');
  });
});
