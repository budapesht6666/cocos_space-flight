// "Install the app" tip on the title screen. The game plays best installed on the home screen:
// full screen without the browser bars, and offline. iPhone and iPad install from Safari's Share
// menu, Android browsers from their own menu. Nothing on a computer, nor once installed.

/** What the page knows about where it runs (services/WebPage reads it off the browser). */
export interface PageEnv {
  userAgent: string;
  /** Launched from the home screen: navigator.standalone (iOS) or display-mode standalone/fullscreen. */
  standalone: boolean;
  /** navigator.maxTouchPoints: iPadOS Safari reports a Mac user agent, but a Mac has no touch. */
  maxTouchPoints: number;
}

export type InstallPlatform = 'ios' | 'android';

/** Two lines under TAP TO START: what installing gives, then where to find it. */
export const INSTALL_TIPS: Record<InstallPlatform, { title: string; steps: string }> = {
  ios: { title: 'PLAY FULL SCREEN', steps: 'SHARE  >  ADD TO HOME SCREEN' },
  android: { title: 'PLAY FULL SCREEN', steps: 'MENU  >  ADD TO HOME SCREEN' },
};

/** The platform whose tip to show, or null: a computer, or the game is already installed. */
export function installPlatform(env: PageEnv): InstallPlatform | null {
  if (env.standalone) return null;
  const ua = env.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && env.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return null;
}
