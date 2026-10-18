// Haptic feedback through the iPhone's Taptic Engine. The native iOS app only: the script asks the
// app over the engine's JS-to-native bridge (`haptic`, style), and its AppDelegate
// (game/native/engine/ios/AppDelegate.mm) plays a UIImpactFeedbackGenerator or
// UINotificationFeedbackGenerator. The engine's own vibrate() does nothing on iOS. Elsewhere — the
// browser, the PWA — this is a no-op: Safari has no vibration API.

import { native, sys } from 'cc';
import { HAPTICS } from '../data/haptics';
import type { HapticStyle } from '../data/types';
import { SettingsService } from './SettingsService';

/** When each style last played, ms of real time. */
const last: Partial<Record<HapticStyle, number>> = {};

export const HapticsService = {
  /** Whether this build can vibrate at all (the VIBRATION setting shows only then). */
  get available(): boolean {
    return sys.isNative && sys.os === sys.OS.IOS;
  },

  play(style: HapticStyle): void {
    if (!HapticsService.available || !SettingsService.current.vibration) return;
    const now = Date.now();
    const prev = last[style];
    if (prev !== undefined && now - prev < HAPTICS.repeat * 1000) return;
    last[style] = now;
    native.bridge.sendToNative('haptic', style);
  },
};
