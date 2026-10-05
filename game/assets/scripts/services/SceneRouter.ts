// Scene changes with their parameters: which mission and difficulty the Game scene plays, and
// which page the Menu scene opens on. The state is static, so it survives the scene switch.

import { director } from 'cc';
import type { Difficulty, MissionId } from '../data/types';
import { SaveService } from './SaveService';

export interface LaunchRequest {
  mission: MissionId;
  difficulty: Difficulty;
}

/** Menu pages a scene change can open directly. */
export type MenuEntry = 'main' | 'hangar';

export const SCENES = { menu: 'Menu', game: 'Game' } as const;

let launch: LaunchRequest | null = null;
let menuEntry: MenuEntry | null = null;
let autoStarted = false;

export const SceneRouter = {
  /** What the Game scene should play; null when it was opened directly (editor preview). */
  get launch(): LaunchRequest | null {
    return launch;
  },

  /** Loads (or reloads) the Game scene with a mission; `remember` makes it CONTINUE's target. */
  play(mission: MissionId, difficulty: Difficulty, remember = true): void {
    launch = { mission, difficulty };
    if (remember) SaveService.setLast(mission, difficulty);
    director.loadScene(SCENES.game);
  },

  toMenu(entry: MenuEntry = 'main'): void {
    menuEntry = entry;
    director.loadScene(SCENES.menu);
  },

  /** The page the menu was asked to open, once; null on the first load (title screen). */
  takeMenuEntry(): MenuEntry | null {
    const entry = menuEntry;
    menuEntry = null;
    return entry;
  },

  /** True only the first time it's asked: lets `?mission=` skip the menu once per page load. */
  claimAutoStart(): boolean {
    if (autoStarted) return false;
    autoStarted = true;
    return true;
  },
};
