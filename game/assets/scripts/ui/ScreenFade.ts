// Scene transitions: a black cover with LOADING over everything. A scene starts covered (from its
// very first frame, so the switch is one continuous black) and reveals itself once it has loaded;
// leaving fades the cover in, then switches.

import { Graphics, Label, Node, TTFFont, UIOpacity } from 'cc';
import { approach } from '../core/math';
import { UI, uiLabel, uiNode } from './UiKit';

/** Seconds to fade out (reveal) and in (leave). */
const REVEAL_TIME = 0.3;
const LEAVE_TIME = 0.18;
/** Hold LOADING back this long: quick switches show just black. */
const LABEL_DELAY = 0.25;

export class ScreenFade {
  private readonly node: Node;
  private readonly opacity: UIOpacity;
  private readonly label: Label;
  private alpha = 1;
  private target = 1;
  private speed = 1;
  private shown = 0;
  private dots = -1;
  private then: (() => void) | null = null;

  constructor(parent: Node, font: TTFFont | null) {
    this.node = uiNode(parent, 'ScreenFade', 0, 0, { top: 0, bottom: 0, left: 0, right: 0 });
    const g = this.node.addComponent(Graphics);
    g.fillColor = UI.ink;
    // Oversized so it covers any screen shape without depending on the layout pass.
    g.rect(-3000, -3000, 6000, 6000);
    g.fill();
    this.opacity = this.node.addComponent(UIOpacity);
    this.label = uiLabel(this.node, 'Loading', 30, UI.dim, { centerX: true, centerY: true }, font);
    this.label.string = 'LOADING';
    this.label.node.active = false;
    this.apply();
  }

  /** True while the screen is (being) covered. */
  get covering(): boolean {
    return this.target > 0;
  }

  /** Fades the cover away: the scene is ready. */
  reveal(): void {
    this.target = 0;
    this.speed = 1 / REVEAL_TIME;
    this.then = null;
  }

  /** Fades the cover in, then calls `fn` (load the next scene). */
  leave(fn: () => void): void {
    this.target = 1;
    this.speed = 1 / LEAVE_TIME;
    this.then = fn;
    this.shown = 0;
    this.node.active = true;
    this.raise();
  }

  /** Keeps the cover above UI built after it. */
  raise(): void {
    const parent = this.node.parent;
    if (parent) this.node.setSiblingIndex(parent.children.length - 1);
  }

  tick(dt: number): void {
    if (!this.node.active) return;
    // Real frame times can spike while loading; a capped step keeps the fade visible.
    this.alpha = approach(this.alpha, this.target, this.speed * Math.min(dt, 1 / 30));
    this.shown += dt;
    this.label.node.active = this.alpha >= 1 && this.shown > LABEL_DELAY;
    const dots = Math.floor(this.shown * 3) % 4;
    if (this.label.node.active && dots !== this.dots) {
      this.dots = dots;
      this.label.string = `LOADING${'.'.repeat(dots)}`;
    }
    this.apply();
    if (this.alpha >= 1 && this.then) {
      const fn = this.then;
      this.then = null;
      fn();
    }
  }

  private apply(): void {
    this.opacity.opacity = Math.round(this.alpha * 255);
    if (this.alpha <= 0 && this.target <= 0) this.node.active = false;
  }
}
