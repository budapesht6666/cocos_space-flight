// Which mission the Game scene plays: set by the start screen before it loads the scene, kept
// across retries. A Game scene opened directly (editor preview) falls back to the URL flags.

import type { Difficulty, MissionId } from '../data/types';

export interface LaunchRequest {
  mission: MissionId;
  difficulty: Difficulty;
}

let current: LaunchRequest | null = null;
let autoStarted = false;

export const Launch = {
  get current(): LaunchRequest | null {
    return current;
  },

  set(mission: MissionId, difficulty: Difficulty): void {
    current = { mission, difficulty };
  },

  /** True only the first time it's asked: lets `?mission=` skip the menu once per page load. */
  claimAutoStart(): boolean {
    if (autoStarted) return false;
    autoStarted = true;
    return true;
  },
};

export const SCENES = { menu: 'Menu', game: 'Game' } as const;
