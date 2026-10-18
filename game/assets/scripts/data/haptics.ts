// Haptic feedback (GDD §17, the VIBRATION setting): which events tap the player's hand, and how
// hard. Only the native iOS app plays them (services/HapticsService.ts); Safari can't vibrate.
// Frequent events (shots, grazes, credits, common kills) stay silent: a phone that buzzes all the
// time says nothing.

import type { HapticStyle, PickupKind } from './types';

export const HAPTICS = {
  /** A hull segment lost. */
  playerHit: 'heavy',
  /** The shield soaked a hit; `shieldDown` when that emptied it. */
  shieldHit: 'medium',
  shieldDown: 'warning',
  playerDied: 'error',
  novaBomb: 'heavy',
  /** A timed Special started. */
  special: 'medium',
  /** A boss part shot off, and the boss's core exposed. */
  partKilled: 'medium',
  armorBroken: 'medium',
  bossKilled: 'success',
  /** Pickups worth feeling; credits come in showers and stay silent. */
  pickups: { power: 'light', repair: 'light', shield: 'light', energy: 'light', pod: 'light' } as Partial<Record<PickupKind, HapticStyle>>,
  /**
   * The same style no sooner than this (seconds of real time): a shotgun spread hitting the shield
   * five times in a frame is one tap.
   */
  repeat: 0.1,
} as const;
