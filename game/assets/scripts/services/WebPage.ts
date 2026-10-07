// The HTML page around the game (build-templates/web-mobile/index.ejs).
// Its loading splash — the logo and a loading bar, drawn from the first paint while the engine
// downloads and starts — stays up until the first scene reveals itself (the engine's own splash,
// the Cocos logo, is off in the build config). And how the page was opened: in a browser tab or
// from the home screen, which decides the title screen's install tip.

import { sys } from 'cc';
import type { PageEnv } from '../core/install';

/** Matches the splash's opacity transition in style.css. */
const SPLASH_FADE_MS = 500;

let splashGone = false;

export const WebPage = {
  /** Fades the loading splash out (the first call; later scenes have nothing to hide). */
  hideSplash(): void {
    if (splashGone || !sys.isBrowser) return;
    splashGone = true;
    const splash = document.getElementById('splash');
    if (!splash) return;
    splash.classList.add('gone');
    setTimeout(() => splash.remove(), SPLASH_FADE_MS + 100);
  },

  /** Where the page runs, or null outside a browser. */
  env(): PageEnv | null {
    if (!sys.isBrowser) return null;
    const nav = navigator as Navigator & { standalone?: boolean };
    const installed = nav.standalone === true || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
    return { userAgent: nav.userAgent, standalone: installed, maxTouchPoints: nav.maxTouchPoints || 0 };
  },
};
