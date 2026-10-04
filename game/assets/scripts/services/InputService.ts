// Collects player input between simulation steps.
// Touch drags give relative movement in UI units (design resolution, y up); desktop mouse drags
// arrive as touches too (the engine simulates them). Arrow keys / WASD give a direction.
// On-screen buttons are hit-tested here: a touch that starts on a button presses it and never
// moves the ship, so one thumb can steer while another taps Special. Keys: Space = Special,
// Esc/P = pause, Enter = tap (and Retry on the results screen).

import { EventKeyboard, EventTouch, Input, KeyCode, Vec2, input } from 'cc';

export type ButtonId = 'special' | 'pause' | 'resume' | 'restart' | 'menu' | 'retry' | 'next';

/** Returns the button under a UI-space point, or null. */
export type ButtonHitTest = (x: number, y: number) => ButtonId | null;

export class InputService {
  /** Accumulated drag since the last `consumeDrag`, UI units. */
  private dragX = 0;
  private dragY = 0;
  private touches = 0;
  /** Travel of the current steering touch, to tell taps from drags. */
  private touchTravel = 0;
  private tapped = false;
  private readonly pressed = new Set<ButtonId>();
  /** Touch ids that started on a button: their moves are ignored. */
  private readonly buttonTouches = new Set<number>();
  private readonly keys = new Set<KeyCode>();
  private readonly delta = new Vec2();
  private readonly location = new Vec2();
  private hitTest: ButtonHitTest = () => null;

  attach(hitTest: ButtonHitTest): void {
    this.hitTest = hitTest;
    input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
  }

  detach(): void {
    input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
  }

  /** Returns the drag accumulated since the last call (UI units, y up) and resets it. */
  consumeDrag(out: Vec2): Vec2 {
    out.set(this.dragX, this.dragY);
    this.dragX = 0;
    this.dragY = 0;
    return out;
  }

  /** Keyboard direction, each axis in -1..1 (y up). */
  keyAxis(out: Vec2): Vec2 {
    const left = this.keys.has(KeyCode.ARROW_LEFT) || this.keys.has(KeyCode.KEY_A);
    const right = this.keys.has(KeyCode.ARROW_RIGHT) || this.keys.has(KeyCode.KEY_D);
    const up = this.keys.has(KeyCode.ARROW_UP) || this.keys.has(KeyCode.KEY_W);
    const down = this.keys.has(KeyCode.ARROW_DOWN) || this.keys.has(KeyCode.KEY_S);
    out.set((right ? 1 : 0) - (left ? 1 : 0), (up ? 1 : 0) - (down ? 1 : 0));
    return out;
  }

  /** True once after a short tap away from buttons (or Enter), then resets. */
  consumeTap(): boolean {
    const tapped = this.tapped;
    this.tapped = false;
    return tapped;
  }

  /** True once after the button was pressed (touch or its key), then resets. */
  consumePress(button: ButtonId): boolean {
    if (!this.pressed.has(button)) return false;
    this.pressed.delete(button);
    return true;
  }

  /** Drops queued presses, taps and drags (e.g. when the game state changes under them). */
  flush(): void {
    this.pressed.clear();
    this.tapped = false;
    this.dragX = 0;
    this.dragY = 0;
  }

  get isTouching(): boolean {
    return this.touches > 0;
  }

  private onTouchStart(event: EventTouch): void {
    event.getUILocation(this.location);
    const button = this.hitTest(this.location.x, this.location.y);
    const id = event.getID() ?? 0;
    if (button) {
      this.pressed.add(button);
      this.buttonTouches.add(id);
      return;
    }
    this.touches++;
    this.touchTravel = 0;
  }

  private onTouchMove(event: EventTouch): void {
    if (this.buttonTouches.has(event.getID() ?? 0)) return;
    event.getUIDelta(this.delta);
    this.dragX += this.delta.x;
    this.dragY += this.delta.y;
    this.touchTravel += Math.abs(this.delta.x) + Math.abs(this.delta.y);
  }

  private onTouchEnd(event: EventTouch): void {
    const id = event.getID() ?? 0;
    if (this.buttonTouches.delete(id)) return;
    if (this.touches > 0) {
      if (this.touchTravel < 12) this.tapped = true;
      this.touches--;
    }
  }

  private onKeyDown(event: EventKeyboard): void {
    this.keys.add(event.keyCode);
    switch (event.keyCode) {
      case KeyCode.SPACE:
        this.pressed.add('special');
        break;
      case KeyCode.ESCAPE:
      case KeyCode.KEY_P:
        this.pressed.add('pause');
        break;
      case KeyCode.ENTER:
        this.tapped = true;
        this.pressed.add('retry');
        break;
    }
  }

  private onKeyUp(event: EventKeyboard): void {
    this.keys.delete(event.keyCode);
  }
}
