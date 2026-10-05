// Contract between the menu screen (ui/StartScreen.ts) and its pages, plus the page header.

import { Graphics, KeyCode, Label, Node, TTFFont } from 'cc';
import type { MissionPick } from '../core/progress';
import type { PaintId, ShipId } from '../data/types';
import { drawButton, drawChevron, onTap, UI, uiLabel, uiNode } from './UiKit';

export type PageId = 'title' | 'main' | 'campaign' | 'mission' | 'hangar';

export interface ShipPose {
  /** Screen row of the ship's centre, as a fraction of the screen height from the top. */
  row: number;
  /** Size relative to the title screen. */
  scale: number;
}

export interface MenuHost {
  readonly font: TTFFont | null;
  /** Debug `?unlock=1`: every sector, mission, difficulty and ship is open. */
  readonly unlockAll: boolean;
  /** Mission and difficulty that LAUNCH plays; the main and mission pages set it. */
  pick: MissionPick;
  open(page: PageId): void;
  back(): void;
  launch(): void;
  /** Puts this ship in this paint on the turntable. */
  showShip(ship: ShipId, paint: PaintId): void;
  /** The wallet changed (a purchase), or a purchase was refused for lack of credits. */
  walletChanged(): void;
  walletDenied(): void;
}

export interface MenuPage {
  readonly root: Node;
  /** Where the ship floats while the page is open; null hides it. */
  readonly pose: ShipPose | null;
  /** The logo and the build label show on the title and main pages only. */
  readonly logo: boolean;
  /** Called every time the page opens (or comes back from a page above it). */
  enter(): void;
  /** Keyboard shortcut; true if the page handled it. */
  key(code: KeyCode): boolean;
}

export const HEADER_TOP = 44;
export const HEADER_HEIGHT = 72;

/** Full-screen page root, hidden until opened. */
export function pageRoot(parent: Node, name: string): Node {
  const root = uiNode(parent, name, 0, 0, { top: 0, bottom: 0, left: 0, right: 0 });
  root.active = false;
  return root;
}

/** BACK button (top left) and the page title; returns the title label. */
export function pageHeader(root: Node, title: string, host: MenuHost): Label {
  const back = uiNode(root, 'Back', 140, HEADER_HEIGHT, { top: HEADER_TOP, left: 20 });
  const g = back.addComponent(Graphics);
  drawButton(g, 140, HEADER_HEIGHT, false);
  drawChevron(g, -44, 0, 26, -1, UI.white);
  const label = uiLabel(back, 'Label', 24, UI.white, {}, host.font);
  label.string = 'BACK';
  label.node.setPosition(14, 0);
  onTap(back, () => host.back());
  const caption = uiLabel(root, 'Title', 34, UI.white, { top: HEADER_TOP + 14, centerX: true }, host.font);
  caption.string = title;
  return caption;
}
