// The player's settings in local storage, under their own key: they describe this device and its
// player (volumes, hand, graphics), not the progress, so wiping progress keeps them. Parsing and
// steps live in core/settings.ts. Listeners hear every change (audio volumes, graphics tier).

import { director, sys } from 'cc';
import { deviceKind } from '../core/quality';
import { parseSettings, serializeSettings } from '../core/settings';
import type { Settings } from '../data/types';

const KEY = 'spaceflight.settings';
/** Where the automatic graphics tier was remembered until stage 6; cleared on first read. */
const LEGACY_QUALITY_KEY = 'spaceflight.quality';

let current: Settings | null = null;
const listeners: ((s: Settings) => void)[] = [];

function storage(): Storage | null {
  try {
    return sys.localStorage;
  } catch (err) {
    return null;
  }
}

function load(): Settings {
  if (current) return current;
  let json: string | null = null;
  try {
    const store = storage();
    json = store?.getItem(KEY) ?? null;
    store?.removeItem(LEGACY_QUALITY_KEY);
  } catch (err) {
    // Defaults.
  }
  // The device decides the default graphics tier. Phones and tablets go by their OS (an iPad's
  // Safari presents itself as a Mac); a GPU-less WebGL by its renderer string.
  const mobileOs = sys.isMobile || sys.os === sys.OS.IOS || sys.os === sys.OS.ANDROID;
  current = parseSettings(json, deviceKind(mobileOs, director.root?.device.renderer ?? ''));
  return current;
}

export const SettingsService = {
  get current(): Readonly<Settings> {
    return load();
  },

  set(next: Settings): void {
    current = next;
    try {
      storage()?.setItem(KEY, serializeSettings(next));
    } catch (err) {
      console.warn('[SettingsService] could not save settings', err);
    }
    for (const fn of listeners) fn(next);
  },

  /** Hears every change; returns the unsubscribe. */
  listen(fn: (s: Settings) => void): () => void {
    listeners.push(fn);
    return () => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  },
};
