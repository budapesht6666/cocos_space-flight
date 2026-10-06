// Settings page (GDD §17): defaults and ranges. Stored per device (services/SettingsService.ts).

import type { Settings } from './types';

export const SETTINGS = {
  /** Volume steps; the top one is full volume. */
  volumeSteps: 10,
  sensitivity: { min: 0.6, max: 1.6, step: 0.1 },
  defaults: {
    music: 7,
    sfx: 8,
    gunSounds: false,
    sensitivity: 1,
    handedness: 'right',
    /** Replaced by the device's tier (QUALITY.devices) in core/settings.ts. */
    quality: 'ultra',
    showFps: false,
  } as Settings,
};
