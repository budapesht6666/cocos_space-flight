// Sound: music tracks and effects with their levels (GDD §18). Files are built by
// `npm run build:audio` (tools/assets/build-audio.mjs) into resources/audio/{music,sfx}.
// Effects are peak-normalised there, so the balance between them is set here.

import type { DroneId, MusicDef, MusicId, PickupKind, SfxDef, SfxId, SpecialId, WeaponId } from './types';

export const MUSIC: Record<MusicId, MusicDef> = {
  menu: { volume: 0.55, loop: true },
  mercury: { volume: 0.5, loop: true },
  venus: { volume: 0.5, loop: true },
  mars: { volume: 0.5, loop: true },
  bossIntro: { volume: 0.55, loop: false, next: 'boss' },
  boss: { volume: 0.55, loop: true },
  jingleStart: { volume: 0.55, loop: false },
  jingleWin: { volume: 0.6, loop: false, next: 'menu' },
};

export const MUSIC_FX = {
  /** Seconds to cross from one track to the next. */
  crossfade: 1.2,
  /** Seconds to fade out when the music stops (defeat). */
  fadeOut: 1.5,
};

const sfx = (variants: number, volume: number, gap = 0): SfxDef => ({ variants, volume, gap });

export const SFX: Record<SfxId, SfxDef> = {
  // Guns are quiet and rate-limited: they fire all the time.
  pulse: sfx(4, 0.22, 0.07),
  scatter: sfx(3, 0.22, 0.09),
  seeker: sfx(3, 0.2, 0.1),
  ion: sfx(1, 0.22),
  plasma: sfx(3, 0.28, 0.12),
  tesla: sfx(4, 0.2, 0.07),
  swarm: sfx(2, 0.28, 0.15),
  wing: sfx(3, 0.16, 0.1),
  rail: sfx(2, 0.4, 0.3),
  rear: sfx(3, 0.16, 0.1),
  drone: sfx(2, 0.1, 0.12),
  // Hits tick at most ~11 times a second: the Tesla Arc and beams hit several enemies every step.
  hit: sfx(4, 0.15, 0.09),
  hitArmored: sfx(3, 0.2, 0.12),
  explodeSmall: sfx(2, 0.45, 0.05),
  explodeMedium: sfx(2, 0.65, 0.08),
  explodeLarge: sfx(1, 0.9, 0.15),
  blast: sfx(1, 0.35, 0.1),
  playerDied: sfx(1, 1),
  playerHit: sfx(2, 0.85, 0.1),
  shieldHit: sfx(3, 0.6, 0.1),
  shieldDown: sfx(1, 0.6, 0.2),
  graze: sfx(2, 0.25, 0.08),
  blocked: sfx(2, 0.35, 0.06),
  credit: sfx(2, 0.22, 0.04),
  power: sfx(1, 0.6),
  repair: sfx(1, 0.6),
  shieldUp: sfx(1, 0.6),
  energy: sfx(1, 0.6),
  podRescued: sfx(1, 0.6),
  podsLaunched: sfx(1, 0.5),
  podLost: sfx(1, 0.5),
  enemyShieldBroken: sfx(1, 0.5, 0.1),
  armorBroken: sfx(1, 0.7),
  nova: sfx(1, 1),
  overdrive: sfx(1, 0.8),
  phase: sfx(1, 0.8),
  warp: sfx(1, 0.8),
  warning: sfx(1, 0.55),
  laserCharge: sfx(1, 0.45, 0.3),
  laserFire: sfx(1, 0.6, 0.2),
  mineArmed: sfx(1, 0.5, 0.15),
  broodLaunch: sfx(1, 0.55, 0.5),
  uiTap: sfx(1, 0.5, 0.03),
  uiBack: sfx(1, 0.5, 0.03),
  uiTab: sfx(1, 0.45, 0.03),
  uiEquip: sfx(1, 0.5),
  uiBuy: sfx(1, 0.6),
  uiDenied: sfx(1, 0.5, 0.1),
  launch: sfx(1, 0.7),
  cheat: sfx(1, 0.7),
};

/** Effects as file paths under resources (`audio/sfx/pulse_0`). */
export function sfxPath(id: SfxId, variant: number): string {
  return `audio/sfx/${id}_${variant}`;
}

export function musicPath(id: MusicId): string {
  return `audio/music/${id}`;
}

/** Each gun's shot. The Ion Laser is a beam: its sound loops while it fires. */
export const WEAPON_SFX: Record<WeaponId, SfxId> = {
  pulse: 'pulse',
  scatter: 'scatter',
  seeker: 'seeker',
  ion: 'ion',
  plasma: 'plasma',
  tesla: 'tesla',
  swarm: 'swarm',
  wing: 'wing',
  rail: 'rail',
  rear: 'rear',
};

/** Drones that fire make this sound; the others are silent. */
export const DRONE_SFX: Partial<Record<DroneId, SfxId>> = {
  gunDrone: 'drone',
};

export const SPECIAL_SFX: Record<SpecialId, SfxId> = {
  nova: 'nova',
  overdrive: 'overdrive',
  phase: 'phase',
  warp: 'warp',
};

export const PICKUP_SFX: Record<PickupKind, SfxId> = {
  credit: 'credit',
  bigCredit: 'credit',
  power: 'power',
  repair: 'repair',
  shield: 'shieldUp',
  energy: 'energy',
  pod: 'podRescued',
};
