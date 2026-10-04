// Frames the gameplay camera from the playfield and applies trauma-based shake.

import { Camera, Node } from 'cc';
import { damp } from '../core/math';
import { CAMERA_SHAKE } from '../data/visuals';
import type { Playfield } from '../game/Playfield';

/** How far the camera drifts sideways with the player, as a fraction of the player's X. */
const FOLLOW_X = 0.06;

export class CameraRig {
  private trauma = 0;
  private time = 0;
  private followX = 0;
  private readonly node: Node;

  constructor(
    private readonly camera: Camera,
    private readonly playfield: Playfield,
  ) {
    this.node = camera.node;
    camera.fovAxis = Camera.FOVAxis.HORIZONTAL;
    this.apply();
  }

  /** Call after the playfield framing changes. */
  apply(): void {
    const spec = this.playfield.framing.spec;
    this.camera.fov = spec.hFovDeg;
    this.node.setRotationFromEuler(-spec.pitchDeg, 0, 0);
  }

  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  tick(dt: number, playerX: number): void {
    this.time += dt;
    this.trauma = Math.max(0, this.trauma - CAMERA_SHAKE.decay * dt);
    this.followX = damp(this.followX, playerX * FOLLOW_X, 4, dt);
  }

  render(): void {
    const f = this.playfield.framing;
    const shake = this.trauma * this.trauma * CAMERA_SHAKE.maxOffset;
    const t = this.time * CAMERA_SHAKE.frequency;
    // Sum of incommensurate sines: cheap, smooth, non-repeating enough for shake.
    const ox = shake * (Math.sin(t * 1.0) * 0.6 + Math.sin(t * 2.3 + 1.7) * 0.4);
    const oz = shake * (Math.sin(t * 1.3 + 4.1) * 0.6 + Math.sin(t * 2.9 + 0.3) * 0.4);
    this.node.setPosition(this.followX + ox, f.camY, f.camZ + oz);
  }
}
