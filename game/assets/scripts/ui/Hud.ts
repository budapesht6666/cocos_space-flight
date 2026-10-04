// Minimal in-game HUD built in code under the scene Canvas: score, hull and the game-over card.

import { Color, Label, Layers, Node, UITransform, Widget } from 'cc';

const WHITE = new Color(235, 245, 255, 255);
const ACCENT = new Color(255, 196, 90, 255);
const DIM = new Color(90, 100, 120, 255);
const OUTLINE = new Color(0, 0, 0, 190);

interface Anchor {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  centerX?: boolean;
  centerY?: boolean;
}

export class Hud {
  private readonly score: Label;
  private readonly hull: Label;
  private readonly message: Label;
  private shownScore = -1;
  private shownHull = -1;
  private shownMax = -1;

  constructor(private readonly root: Node) {
    this.score = this.label('Score', 46, WHITE, { top: 70, centerX: true });
    // Top-left: the bottom of the screen is under the player's thumb.
    this.hull = this.label('Hull', 30, ACCENT, { top: 78, left: 28 });
    this.message = this.label('Message', 58, WHITE, { centerX: true, centerY: true });
    this.message.node.active = false;
  }

  setScore(score: number): void {
    if (score === this.shownScore) return;
    this.shownScore = score;
    this.score.string = score.toLocaleString('en-US');
  }

  setHull(hull: number, max: number): void {
    if (hull === this.shownHull && max === this.shownMax) return;
    this.shownHull = hull;
    this.shownMax = max;
    const cells: string[] = [];
    for (let i = 0; i < max; i++) cells.push(i < hull ? '■' : '□');
    this.hull.string = `HULL ${cells.join(' ')}`;
    this.hull.color = hull <= 1 ? new Color(255, 90, 80, 255) : ACCENT;
  }

  showGameOver(score: number, canRestart: boolean): void {
    this.message.node.active = true;
    this.message.string = `GAME OVER\n${score.toLocaleString('en-US')}${canRestart ? '\n\nTap to restart' : ''}`;
  }

  hideMessage(): void {
    this.message.node.active = false;
  }

  /** Small extra label for debug info, top-left. */
  debugLabel(): Label {
    const label = this.label('Debug', 22, DIM, { top: 140, left: 16 });
    label.color = new Color(160, 230, 160, 255);
    return label;
  }

  private label(name: string, size: number, color: Color, anchor: Anchor): Label {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    this.root.addChild(node);
    const transform = node.addComponent(UITransform);
    // Edge-anchored labels grow away from their edge when the text changes length.
    if (anchor.left !== undefined) transform.setAnchorPoint(0, 0.5);
    else if (anchor.right !== undefined) transform.setAnchorPoint(1, 0.5);
    const label = node.addComponent(Label);
    label.fontSize = size;
    label.lineHeight = Math.round(size * 1.2);
    label.color = color;
    label.isBold = true;
    label.horizontalAlign =
      anchor.left !== undefined ? Label.HorizontalAlign.LEFT : anchor.right !== undefined ? Label.HorizontalAlign.RIGHT : Label.HorizontalAlign.CENTER;
    label.enableOutline = true;
    label.outlineColor = OUTLINE;
    label.outlineWidth = 3;
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
    if (anchor.centerX) widget.isAlignHorizontalCenter = true;
    if (anchor.centerY) widget.isAlignVerticalCenter = true;
    return label;
  }
}
