// Cheat codes (data/cheats.ts): a text field and APPLY (or Return on the keyboard). A known code
// changes the save at once and says what it did; the codes already in effect are listed below.
// The field is the engine's EditBox: on the web it puts a real <input> over the canvas while
// editing, so the phone's keyboard comes up.

import { EditBox, Graphics, KeyCode, Label, Node, UITransform } from 'cc';
import { CHEATS } from '../data/cheats';
import type { CheatId } from '../data/types';
import { AudioService } from '../services/AudioService';
import { SaveService } from '../services/SaveService';
import { HEADER_TOP, pageHeader, pageRoot, type MenuHost, type MenuPage } from './MenuPage';
import { drawButton, drawCard, onTap, placeLabel, UI, uiLabel, uiNode } from './UiKit';

const FIELD_WIDTH = 600;
const FIELD_HEIGHT = 96;
const FIELD_TOP = HEADER_TOP + 180;
const MAX_LENGTH = 40;

export class CheatsPage implements MenuPage {
  readonly root: Node;
  readonly pose = null;
  readonly logo = false;
  private readonly field: EditBox;
  private readonly result: Label;
  private readonly active: Label;

  constructor(parent: Node, private readonly host: MenuHost) {
    const font = host.font;
    this.root = pageRoot(parent, 'CheatsPage');
    pageHeader(this.root, 'CHEATS', host);
    uiLabel(this.root, 'Prompt', 24, UI.dim, { top: HEADER_TOP + 120, centerX: true }, font).string = 'ENTER A CODE';

    const box = uiNode(this.root, 'Field', FIELD_WIDTH, FIELD_HEIGHT, { top: FIELD_TOP, centerX: true });
    drawCard(box.addComponent(Graphics), FIELD_WIDTH, FIELD_HEIGHT, UI.buttonEdge);
    // The EditBox keeps its own (empty) Sprite, so it sits on a child of the drawn box.
    const input = uiNode(box, 'Input', FIELD_WIDTH - 48, FIELD_HEIGHT - 20, {});
    const text = uiLabel(input, 'TEXT_LABEL', 32, UI.white, {}, font);
    const placeholder = uiLabel(input, 'PLACEHOLDER_LABEL', 32, UI.faint, {}, font);
    placeholder.enableOutline = false;
    // The EditBox sizes its labels to the field and pins them by the top left corner.
    for (const l of [text, placeholder]) {
      l.node.getComponent(UITransform)?.setAnchorPoint(0, 1);
      l.horizontalAlign = Label.HorizontalAlign.CENTER;
      l.verticalAlign = Label.VerticalAlign.CENTER;
      l.overflow = Label.Overflow.CLAMP;
    }
    const field = input.addComponent(EditBox);
    field.textLabel = text;
    field.placeholderLabel = placeholder;
    field.placeholder = 'CODE';
    field.maxLength = MAX_LENGTH;
    field.inputMode = EditBox.InputMode.SINGLE_LINE;
    field.inputFlag = EditBox.InputFlag.SENSITIVE;
    field.returnType = EditBox.KeyboardReturnType.DONE;
    input.on('editing-return', () => this.apply());
    this.field = field;

    const apply = uiNode(this.root, 'Apply', 320, 96, { top: FIELD_TOP + FIELD_HEIGHT + 40, centerX: true });
    drawButton(apply.addComponent(Graphics), 320, 96, true);
    const label = uiLabel(apply, 'Label', 30, UI.white, {}, font);
    label.string = 'APPLY';
    placeLabel(label, 0, 0);
    onTap(apply, () => this.apply(), null);

    this.result = uiLabel(this.root, 'Result', 28, UI.success, { top: FIELD_TOP + FIELD_HEIGHT + 176, centerX: true }, font);
    this.active = uiLabel(this.root, 'Active', 20, UI.dim, { top: FIELD_TOP + FIELD_HEIGHT + 260, centerX: true }, font);
    this.active.lineHeight = 30;
  }

  enter(): void {
    this.field.string = '';
    this.result.string = '';
    this.refresh();
  }

  key(code: KeyCode): boolean {
    if (code === KeyCode.ENTER) {
      this.apply();
      return true;
    }
    return false;
  }

  private apply(): void {
    const code = this.field.string;
    if (code.trim().length === 0) return;
    const def = SaveService.enterCheat(code);
    if (def) {
      AudioService.play('cheat');
      this.result.string = def.message;
      this.result.color = UI.success;
      this.field.string = '';
      this.host.walletChanged();
    } else {
      AudioService.play('uiDenied');
      this.result.string = 'UNKNOWN CODE';
      this.result.color = UI.danger;
    }
    this.refresh();
  }

  /** Lasting cheats in effect on this save. */
  private refresh(): void {
    const on = SaveService.data.cheats.map((id: CheatId) => CHEATS[id].message);
    this.active.string = on.length > 0 ? `IN EFFECT\n${on.join('\n')}` : '';
  }
}
