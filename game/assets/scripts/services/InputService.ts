// Collects player input between simulation steps.
// Touch drags give relative movement in UI units (design resolution, y up); desktop mouse drags
// arrive as touches too (the engine simulates them). Arrow keys / WASD give a direction.

import { EventKeyboard, EventTouch, Input, KeyCode, Vec2, input } from 'cc';

export class InputService {
  /** Accumulated drag since the last `consumeDrag`, UI units. */
  private dragX = 0;
  private dragY = 0;
  private touching = false;
  private touchTravel = 0;
  private tapped = false;
  private readonly keys = new Set<KeyCode>();
  private readonly delta = new Vec2();

  attach(): void {
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

  /** True once after a short tap (or Space / Enter), then resets. */
  consumeTap(): boolean {
    const tapped = this.tapped;
    this.tapped = false;
    return tapped;
  }

  get isTouching(): boolean {
    return this.touching;
  }

  private onTouchStart(): void {
    this.touching = true;
    this.touchTravel = 0;
  }

  private onTouchMove(event: EventTouch): void {
    event.getUIDelta(this.delta);
    this.dragX += this.delta.x;
    this.dragY += this.delta.y;
    this.touchTravel += Math.abs(this.delta.x) + Math.abs(this.delta.y);
  }

  private onTouchEnd(): void {
    if (this.touching && this.touchTravel < 12) this.tapped = true;
    this.touching = false;
  }

  private onKeyDown(event: EventKeyboard): void {
    this.keys.add(event.keyCode);
    if (event.keyCode === KeyCode.SPACE || event.keyCode === KeyCode.ENTER) this.tapped = true;
  }

  private onKeyUp(event: EventKeyboard): void {
    this.keys.delete(event.keyCode);
  }
}
