// Credits: who made the models, music, sounds and font (data/credits.ts).

import { Color, KeyCode, Node } from 'cc';
import { CREDITS } from '../data/credits';
import { HEADER_TOP, pageHeader, pageRoot, type MenuHost, type MenuPage } from './MenuPage';
import { UI, uiLabel } from './UiKit';

const LINES_TOP = HEADER_TOP + 130;
const ENTRY_HEIGHT = 132;
const SOURCE = new Color(140, 160, 190, 255);

export class CreditsPage implements MenuPage {
  readonly root: Node;
  readonly pose = null;
  readonly logo = false;

  constructor(parent: Node, host: MenuHost) {
    const font = host.font;
    this.root = pageRoot(parent, 'CreditsPage');
    pageHeader(this.root, 'CREDITS', host);
    CREDITS.forEach((c, i) => {
      const top = LINES_TOP + i * ENTRY_HEIGHT;
      uiLabel(this.root, `What${i}`, 24, UI.accent, { top, centerX: true }, font).string = c.what;
      uiLabel(this.root, `Author${i}`, 22, UI.white, { top: top + 38, centerX: true }, font).string = c.author;
      const source = uiLabel(this.root, `Source${i}`, 18, SOURCE, { top: top + 74, centerX: true }, font);
      source.outlineWidth = 2;
      source.string = c.license ? `${c.source}  ·  ${c.license}` : c.source;
    });
    uiLabel(this.root, 'Thanks', 20, UI.dim, { bottom: 60, centerX: true }, font).string = 'THANK YOU FOR PLAYING';
  }

  enter(): void {}

  key(_code: KeyCode): boolean {
    return false;
  }
}
