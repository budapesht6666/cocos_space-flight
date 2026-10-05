// Building blocks for UI built in code (HUD, menu): nodes anchored with Widget, outlined labels,
// buttons, icons and medal badges drawn with Graphics. Colours are shared so screens match.

import { Color, Graphics, Label, Layers, Node, TTFFont, UITransform, Vec2, Widget } from 'cc';
import type { MedalId } from '../data/types';

export const UI = {
  white: new Color(235, 245, 255, 255),
  accent: new Color(255, 196, 90, 255),
  danger: new Color(255, 90, 80, 255),
  shield: new Color(90, 210, 255, 255),
  gold: new Color(255, 205, 80, 255),
  success: new Color(120, 255, 170, 255),
  rescue: new Color(110, 255, 150, 255),
  dim: new Color(90, 100, 120, 255),
  faint: new Color(50, 58, 78, 255),
  outline: new Color(0, 0, 0, 190),
  panel: new Color(4, 8, 20, 200),
  button: new Color(20, 40, 70, 230),
  buttonEdge: new Color(90, 200, 255, 255),
  buttonHot: new Color(30, 80, 120, 240),
  card: new Color(10, 20, 40, 215),
  cardEdge: new Color(60, 110, 160, 255),
  cardLocked: new Color(8, 12, 24, 200),
  ink: new Color(10, 14, 26, 255),
};

export interface Anchor {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  centerX?: boolean;
  centerY?: boolean;
  /** Offset from the horizontal centre, UI units (with centerX). */
  dx?: number;
  /** Offset from the vertical centre, UI units (with centerY). */
  dy?: number;
}

export function uiNode(parent: Node, name: string, width: number, height: number, anchor: Anchor): Node {
  const node = new Node(name);
  node.layer = Layers.Enum.UI_2D;
  parent.addChild(node);
  node.addComponent(UITransform).setContentSize(width, height);
  align(node, anchor);
  return node;
}

/** Bold outlined label. With a TTF font (already bold) the synthetic bold stays off. */
export function uiLabel(parent: Node, name: string, size: number, color: Color, anchor: Anchor, font: TTFFont | null = null): Label {
  const node = new Node(name);
  node.layer = Layers.Enum.UI_2D;
  parent.addChild(node);
  const transform = node.addComponent(UITransform);
  // Edge-anchored labels grow away from their edge when the text changes length or line count
  // (the Widget aligns only once, so the anchor point decides the direction of growth).
  const ax = anchor.left !== undefined ? 0 : anchor.right !== undefined ? 1 : 0.5;
  const ay = anchor.top !== undefined ? 1 : anchor.bottom !== undefined ? 0 : 0.5;
  transform.setAnchorPoint(ax, ay);
  const label = node.addComponent(Label);
  if (font) {
    label.useSystemFont = false;
    label.font = font;
  }
  label.fontSize = size;
  label.lineHeight = Math.round(size * 1.2);
  label.color = color;
  label.isBold = !font;
  label.horizontalAlign =
    anchor.left !== undefined ? Label.HorizontalAlign.LEFT : anchor.right !== undefined ? Label.HorizontalAlign.RIGHT : Label.HorizontalAlign.CENTER;
  label.enableOutline = true;
  label.outlineColor = UI.outline;
  label.outlineWidth = 3;
  align(node, anchor);
  return label;
}

/** Puts a label at (x, y) in its parent, growing rightwards ('left'), leftwards ('right') or both ways. */
export function placeLabel(label: Label, x: number, y: number, align: 'left' | 'center' | 'right' = 'center'): void {
  label.node.getComponent(UITransform)?.setAnchorPoint(align === 'left' ? 0 : align === 'right' ? 1 : 0.5, 0.5);
  label.horizontalAlign = align === 'left' ? Label.HorizontalAlign.LEFT : align === 'right' ? Label.HorizontalAlign.RIGHT : Label.HorizontalAlign.CENTER;
  label.node.setPosition(x, y);
}

/** Rounded button with a centred caption; returns the node to hit-test. */
export function uiButton(parent: Node, text: string, width: number, height: number, anchor: Anchor, font: TTFFont | null, size = 32): Node {
  const node = uiNode(parent, text, width, height, anchor);
  const g = node.addComponent(Graphics);
  drawButton(g, width, height, false);
  const label = uiLabel(node, `${text}Label`, size, UI.white, {}, font);
  label.string = text;
  label.node.setPosition(0, 0);
  return node;
}

export function drawButton(g: Graphics, width: number, height: number, hot: boolean): void {
  g.clear();
  g.fillColor = hot ? UI.buttonHot : UI.button;
  g.roundRect(-width / 2, -height / 2, width, height, 18);
  g.fill();
  g.lineWidth = 3;
  g.strokeColor = UI.buttonEdge;
  g.roundRect(-width / 2, -height / 2, width, height, 18);
  g.stroke();
}

/** Calls `fn` when a touch that started on the node ends on it; the node dips while held. */
export function onTap(node: Node, fn: () => void): void {
  node.on(Node.EventType.TOUCH_START, () => node.setScale(0.97, 0.97, 1));
  node.on(Node.EventType.TOUCH_CANCEL, () => node.setScale(1, 1, 1));
  node.on(Node.EventType.TOUCH_END, () => {
    node.setScale(1, 1, 1);
    fn();
  });
}

/** Rounded card; `edge` overrides the border colour (selection), `locked` dims it. */
export function drawCard(g: Graphics, width: number, height: number, edge: Color | null = null, locked = false): void {
  g.clear();
  g.fillColor = locked ? UI.cardLocked : UI.card;
  g.roundRect(-width / 2, -height / 2, width, height, 20);
  g.fill();
  g.lineWidth = edge ? 5 : 3;
  g.strokeColor = edge ?? (locked ? UI.faint : UI.cardEdge);
  g.roundRect(-width / 2, -height / 2, width, height, 20);
  g.stroke();
}

/** Credit coin: gold disc, inner ring and a diamond. `r` ~16 at HUD size. */
export function drawCoin(g: Graphics, x: number, y: number, r: number): void {
  g.fillColor = UI.gold;
  g.circle(x, y, r);
  g.fill();
  g.lineWidth = Math.max(1.5, r * 0.19);
  g.strokeColor = UI.ink;
  g.circle(x, y, r * 0.69);
  g.stroke();
  g.fillColor = UI.ink;
  const d = r * 0.4;
  g.moveTo(x, y + d);
  g.lineTo(x + d * 0.7, y);
  g.lineTo(x, y - d);
  g.lineTo(x - d * 0.7, y);
  g.close();
  g.fill();
}

/** Padlock, `size` ~ its height. */
export function drawLock(g: Graphics, x: number, y: number, size: number, color: Color): void {
  const w = size * 0.8;
  const h = size * 0.55;
  const top = y - size * 0.5 + h;
  const r = w * 0.3;
  // Shackle: straight legs out of the body, a half circle on top.
  g.lineWidth = Math.max(2, size * 0.12);
  g.strokeColor = color;
  g.moveTo(x - r, top);
  g.lineTo(x - r, top + size * 0.12);
  g.arc(x, top + size * 0.12, r, Math.PI, 0, false);
  g.lineTo(x + r, top);
  g.stroke();
  g.fillColor = color;
  g.roundRect(x - w / 2, y - size * 0.5, w, h, size * 0.08);
  g.fill();
}

/** Chevron pointing left (dir -1) or right (dir 1). */
export function drawChevron(g: Graphics, x: number, y: number, size: number, dir: number, color: Color): void {
  g.lineWidth = Math.max(3, size * 0.18);
  g.strokeColor = color;
  g.moveTo(x - dir * size * 0.25, y + size * 0.5);
  g.lineTo(x + dir * size * 0.25, y);
  g.lineTo(x - dir * size * 0.25, y - size * 0.5);
  g.stroke();
}

/** Full-screen dimming panel. */
export function uiPanel(parent: Node, name: string): Node {
  const node = uiNode(parent, name, 0, 0, { top: 0, bottom: 0, left: 0, right: 0 });
  const g = node.addComponent(Graphics);
  g.fillColor = UI.panel;
  // Oversized so it covers any screen shape without depending on the layout pass.
  g.rect(-3000, -3000, 6000, 6000);
  g.fill();
  return node;
}

const hitPoint = new Vec2();

/** True if a UI-space point lies inside the node's box. */
export function contains(node: Node, x: number, y: number): boolean {
  const t = node.getComponent(UITransform);
  hitPoint.set(x, y);
  return node.activeInHierarchy && t !== null && t.getBoundingBoxToWorld().contains(hitPoint);
}

export function align(node: Node, anchor: Anchor): void {
  if (Object.keys(anchor).length === 0) return;
  const widget = node.addComponent(Widget);
  if (anchor.top !== undefined) {
    widget.isAlignTop = true;
    widget.top = anchor.top;
  }
  if (anchor.bottom !== undefined) {
    widget.isAlignBottom = true;
    widget.bottom = anchor.bottom;
  }
  if (anchor.left !== undefined) {
    widget.isAlignLeft = true;
    widget.left = anchor.left;
  }
  if (anchor.right !== undefined) {
    widget.isAlignRight = true;
    widget.right = anchor.right;
  }
  if (anchor.centerX) {
    widget.isAlignHorizontalCenter = true;
    widget.horizontalCenter = anchor.dx ?? 0;
  }
  if (anchor.centerY) {
    widget.isAlignVerticalCenter = true;
    widget.verticalCenter = anchor.dy ?? 0;
  }
}

const MEDAL_COLORS: Record<MedalId, Color> = {
  hunter: new Color(255, 120, 80, 255),
  exterminator: new Color(255, 205, 80, 255),
  rescuer: new Color(110, 255, 150, 255),
  untouchable: new Color(90, 210, 255, 255),
};
const MEDAL_BACK_LIT = new Color(30, 26, 18, 240);
const MEDAL_BACK_DIM = new Color(14, 18, 30, 220);

/** A round medal badge with its symbol; unearned medals are drawn dim. */
export function drawMedal(g: Graphics, id: MedalId, x: number, y: number, r: number, lit: boolean): void {
  const color = lit ? MEDAL_COLORS[id] : UI.faint;
  g.fillColor = lit ? MEDAL_BACK_LIT : MEDAL_BACK_DIM;
  g.circle(x, y, r);
  g.fill();
  g.lineWidth = Math.max(2, r * 0.1);
  g.strokeColor = lit ? UI.gold : UI.faint;
  g.circle(x, y, r);
  g.stroke();
  const s = r * 0.55;
  g.strokeColor = color;
  g.fillColor = color;
  switch (id) {
    case 'hunter':
      // Crosshair.
      g.lineWidth = Math.max(2.5, r * 0.15);
      g.circle(x, y, s * 0.72);
      g.stroke();
      g.moveTo(x - s, y);
      g.lineTo(x - s * 0.35, y);
      g.moveTo(x + s * 0.35, y);
      g.lineTo(x + s, y);
      g.moveTo(x, y - s);
      g.lineTo(x, y - s * 0.35);
      g.moveTo(x, y + s * 0.35);
      g.lineTo(x, y + s);
      g.stroke();
      g.circle(x, y, s * 0.16);
      g.fill();
      break;
    case 'exterminator':
      // Eight-point burst.
      for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI) / 8;
        const d = i % 2 === 0 ? s : s * 0.42;
        if (i === 0) g.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
        else g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
      }
      g.close();
      g.fill();
      break;
    case 'rescuer':
      // Escape pod capsule with a beacon.
      g.roundRect(x - s, y - s * 0.38, s * 2, s * 0.76, s * 0.38);
      g.fill();
      g.fillColor = lit ? MEDAL_BACK_LIT : MEDAL_BACK_DIM;
      g.circle(x - s * 0.35, y, s * 0.16);
      g.circle(x + s * 0.15, y, s * 0.16);
      g.fill();
      g.fillColor = color;
      g.circle(x, y + s * 0.65, s * 0.18);
      g.fill();
      break;
    case 'untouchable':
      // Shield crest.
      g.moveTo(x - s * 0.8, y + s * 0.75);
      g.lineTo(x + s * 0.8, y + s * 0.75);
      g.lineTo(x + s * 0.8, y + s * 0.1);
      g.quadraticCurveTo(x + s * 0.75, y - s * 0.6, x, y - s * 0.95);
      g.quadraticCurveTo(x - s * 0.75, y - s * 0.6, x - s * 0.8, y + s * 0.1);
      g.close();
      g.fill();
      break;
  }
}
