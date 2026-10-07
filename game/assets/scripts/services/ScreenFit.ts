// The game is portrait. On a phone it fills the screen (in a landscape browser the engine turns it
// upright). A desktop window wider than the design resolution (9:16) shows it in a portrait column
// in the middle instead of stretching it: the UI fits the width, and the camera keeps the
// playfield's width, so a wide canvas showed huge buttons and a thin band of the playfield. The
// page around the column is styled by build-templates/web-mobile/style.css (the `column` class on
// <body>). A frame at least as tall as 9:16 (a phone-sized window, a device in the editor preview)
// fills as on a phone. Measured on the game's frame, not the window: the editor preview puts the
// game in a frame of the chosen device's size.
// It also keeps the keyboard on the game: the engine hears keys only on its canvas, and it measures
// the safe area (status bar, notch, home indicator) that the UI stays clear of.

import { ResolutionPolicy, screen, sys, view, Widget } from 'cc';

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

/**
 * Cocos 3.8 listens for keys on #GameCanvas only, so the arrows did nothing while the page had the
 * focus: a link that starts a mission at once (`?mission=`, no tap before it) or a click on the
 * column's margins. Focus the canvas, and hand it keys that land elsewhere on the page (key-ups
 * too, or a key held while the focus left would stay pressed) — but not keys typed into a text
 * field (the CHEATS page's EditBox puts an <input> over the canvas while editing).
 */
function keepKeyboard(): void {
  const canvas = document.getElementById('GameCanvas');
  if (!canvas) return;
  canvas.focus({ preventScroll: true });
  const forward = (event: KeyboardEvent): void => {
    const active = document.activeElement;
    if (active === canvas) return;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
    canvas.focus({ preventScroll: true });
    canvas.dispatchEvent(new KeyboardEvent(event.type, { key: event.key, code: event.code, repeat: event.repeat }));
  };
  window.addEventListener('keydown', forward);
  window.addEventListener('keyup', forward);
}

/**
 * An EditBox puts its <input> in the game's container and places it from the container's corner,
 * but absolutely positioned elements follow the nearest positioned ancestor — the full-width frame
 * (#GameDiv). In the column the container sits in the middle, so the text being typed showed up
 * by the window's left edge. Positioning the container makes its corner the origin; with no
 * offsets it stays where it was.
 */
function anchorTextFields(): void {
  const container = document.getElementById('Cocos3dGameContainer');
  if (container) container.style.position = 'relative';
}

/** Safe-area margins in UI units. */
export interface SafeInsets {
  top: number;
  bottom: number;
}

const insets: SafeInsets = { top: 0, bottom: 0 };
let probe: HTMLElement | null = null;
/** The current scene's UI root (UiKit.safeRoot): its Widget keeps it inside the safe area. */
let safeWidget: Widget | null = null;

/**
 * The page's safe-area insets, read off a hidden element padded by env(safe-area-inset-*): the
 * engine's own reading parses the --safe-* properties, which browsers may leave as unresolved
 * env() text. Converted to UI units: the canvas is the design width wide (Fit Width).
 */
function measureInsets(): void {
  insets.top = 0;
  insets.bottom = 0;
  if (!sys.isBrowser) return;
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
    document.body.appendChild(probe);
  }
  const canvas = document.getElementById('GameCanvas');
  const width = canvas ? canvas.clientWidth : 0;
  if (width <= 0) return;
  const style = getComputedStyle(probe);
  const scale = view.getVisibleSize().width / width;
  insets.top = Math.round((parseFloat(style.paddingTop) || 0) * scale);
  insets.bottom = Math.round((parseFloat(style.paddingBottom) || 0) * scale);
}

/** Moves the safe root to the current insets; its widgets lay out again only if they changed. */
function applyInsets(): void {
  measureInsets();
  const widget = safeWidget;
  if (!widget || !widget.isValid) return;
  if (widget.top === insets.top && widget.bottom === insets.bottom) return;
  widget.top = insets.top;
  widget.bottom = insets.bottom;
  // Children align on window resize only: changing the root's margins does not reach them.
  const widgets = widget.node.getComponentsInChildren(Widget);
  for (let i = 0; i < widgets.length; i++) widgets[i].setDirty();
}

function onResize(): void {
  fit();
  applyInsets();
}

export const ScreenFit = {
  /** Each scene's entry component calls this before laying out; the first call sets up the page. */
  init(): void {
    if (!sys.isBrowser) return;
    fit();
    measureInsets();
    if (listening) return;
    listening = true;
    screen.on('window-resize', onResize);
    keepKeyboard();
    anchorTextFields();
  },

  /** Safe-area margins in UI units, as of the last init or resize (zero off a notched phone). */
  get insets(): Readonly<SafeInsets> {
    return insets;
  },

  /** Keeps this widget (the scene's UI root) inset by the safe area from now on. */
  trackSafeRoot(widget: Widget): void {
    safeWidget = widget;
    applyInsets();
  },
};
