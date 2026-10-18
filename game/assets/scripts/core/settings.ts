// Settings as a small JSON document: parsing with repair, and the steps the settings page takes.
// Engine-free (services/SettingsService.ts stores it).

import { SETTINGS } from '../data/settings';
import type { DeviceKind, QualityId, Settings } from '../data/types';
import { QUALITY } from '../data/visuals';
import { clamp } from './math';

export type SettingId = 'music' | 'sfx' | 'gunSounds' | 'sensitivity' | 'handedness' | 'quality' | 'showFps' | 'vibration';

/** Defaults for this kind of device: its graphics tier (QUALITY.devices), the rest the same everywhere. */
export function defaultSettings(device: DeviceKind = 'desktop'): Settings {
  const s = Object.assign({}, SETTINGS.defaults);
  s.quality = QUALITY.devices[device];
  return s;
}

/** Graphics choices in page order: the tiers from the best down. */
export function qualityChoices(): QualityId[] {
  return QUALITY.tiers.map((t) => t.id);
}

function roundStep(v: number): number {
  return Math.round(v * 10) / 10;
}

/**
 * Reads stored settings; anything missing or out of range falls back to its default for the device
 * (a stored 'auto' from before stage 6 dropped automatic graphics too).
 */
export function parseSettings(json: string | null, device: DeviceKind = 'desktop'): Settings {
  const s = defaultSettings(device);
  if (!json) return s;
  let raw: { [key: string]: unknown };
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return s;
    raw = parsed as { [key: string]: unknown };
  } catch (err) {
    return s;
  }
  const volume = (v: unknown, fallback: number): number =>
    typeof v === 'number' && isFinite(v) ? clamp(Math.round(v), 0, SETTINGS.volumeSteps) : fallback;
  s.music = volume(raw.music, s.music);
  s.sfx = volume(raw.sfx, s.sfx);
  const range = SETTINGS.sensitivity;
  if (typeof raw.sensitivity === 'number' && isFinite(raw.sensitivity)) s.sensitivity = roundStep(clamp(raw.sensitivity, range.min, range.max));
  if (raw.handedness === 'left' || raw.handedness === 'right') s.handedness = raw.handedness;
  if (typeof raw.quality === 'string' && qualityChoices().indexOf(raw.quality as QualityId) >= 0) s.quality = raw.quality as QualityId;
  if (typeof raw.showFps === 'boolean') s.showFps = raw.showFps;
  if (typeof raw.gunSounds === 'boolean') s.gunSounds = raw.gunSounds;
  if (typeof raw.vibration === 'boolean') s.vibration = raw.vibration;
  return s;
}

export function serializeSettings(s: Settings): string {
  return JSON.stringify(s);
}

/**
 * One step of a setting (◀ dir −1, ▶ dir 1): volumes and sensitivity stop at their ends, the
 * choices (gun sounds, hand, graphics, FPS, vibration) wrap around. Returns a new object.
 */
export function stepSetting(s: Settings, id: SettingId, dir: number): Settings {
  const next = Object.assign({}, s);
  const d = dir < 0 ? -1 : 1;
  switch (id) {
    case 'music':
    case 'sfx':
      next[id] = clamp(s[id] + d, 0, SETTINGS.volumeSteps);
      break;
    case 'sensitivity': {
      const r = SETTINGS.sensitivity;
      next.sensitivity = roundStep(clamp(s.sensitivity + d * r.step, r.min, r.max));
      break;
    }
    case 'handedness':
      next.handedness = s.handedness === 'right' ? 'left' : 'right';
      break;
    case 'quality': {
      const list = qualityChoices();
      const i = list.indexOf(s.quality);
      next.quality = list[(i + d + list.length) % list.length];
      break;
    }
    case 'showFps':
      next.showFps = !s.showFps;
      break;
    case 'gunSounds':
      next.gunSounds = !s.gunSounds;
      break;
    case 'vibration':
      next.vibration = !s.vibration;
      break;
  }
  return next;
}

/** A volume step as a gain, 0..1 (squared: the ear hears loudness roughly that way). */
export function volumeGain(step: number): number {
  const k = clamp(step, 0, SETTINGS.volumeSteps) / SETTINGS.volumeSteps;
  return k * k;
}
