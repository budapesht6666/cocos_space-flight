// The game is portrait. On a phone it fills the screen (in a landscape browser the engine turns it
// upright). A desktop window wider than the design resolution (9:16) shows it in a portrait column
// in the middle instead of stretching it: the UI fits the width, and the camera keeps the
// playfield's width, so a wide canvas showed huge buttons and a thin band of the playfield. The
// page around the column is styled by build-templates/web-mobile/style.css (the `column` class on
// <body>). A frame at least as tall as 9:16 (a phone-sized window, a device in the editor preview)
// fills as on a phone. Measured on the game's frame, not the window: the editor preview puts the
// game in a frame of the chosen device's size.

import { ResolutionPolicy, screen, sys, view } from 'cc';

/** The frame must be this much wider than 9:16 for the column: no hairline bars on a near fit. */
const SLACK = 1.02;

/** The project starts full-frame (Fit Width); a phone never leaves it. */
let column = false;
let listening = false;

function wantsColumn(): boolean {
  if (!sys.isBrowser || sys.isMobile) return false;
  const frame = document.getElementById('GameDiv');
  const width = frame ? frame.clientWidth : window.innerWidth;
  const height = frame ? frame.clientHeight : window.innerHeight;
  const design = view.getDesignResolutionSize();
  return height > 0 && width * design.height > height * design.width * SLACK;
}

function fit(): void {
  const next = wantsColumn();
  if (next === column) return;
  column = next;
  const RP = ResolutionPolicy;
  // Either way the UI fits the width (the project's Fit Width). The column keeps the canvas at
  // the design's aspect inside the frame; the frame centres it.
  view.setResolutionPolicy(next ? new RP(RP.ContainerStrategy.PROPORTION_TO_FRAME, RP.ContentStrategy.FIXED_WIDTH) : RP.FIXED_WIDTH);
  document.body.classList.toggle('column', next);
}

export const ScreenFit = {
  /** Each scene's entry component calls this before laying out; the first call sets up the page. */
  init(): void {
    if (!sys.isBrowser) return;
    fit();
    if (listening) return;
    listening = true;
    screen.on('window-resize', fit);
  },
};
