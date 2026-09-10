/**
 * ClientPrediction.ts - Client-Side Movement Prediction & Reconciliation
 *
 * Implements Section 15 of authoritative_server.txt:
 * Immediately predicts local player movement for instantaneous responsive controls (0ms feel),
 * stores pending inputs, and reconciles position against authoritative server updates.
 *
 * Fix 3: Uses shared MovementConstants so client and server always use identical speed values,
 * preventing continuous prediction/reconciliation divergence.
 */

import { WALK_SPEED, SPRINT_SPEED, SWIM_MULTIPLIER } from "../game/MovementConstants";

export interface PendingInput {
  seq: number;
  vx: number;
  vy: number;
  isSprinting: boolean;
  dt: number;
}

export class ClientPrediction {
  private pendingInputs: PendingInput[] = [];
  public currentSeq = 0;

  // Authoritative predicted coordinates
  public predictedX = 22;
  public predictedY = 18;

  // Visual error offset for smooth reconciliation (decays to 0)
  public errorOffsetX = 0;
  public errorOffsetY = 0;

  public initPosition(x: number, y: number): void {
    this.predictedX = x;
    this.predictedY = y;
    this.errorOffsetX = 0;
    this.errorOffsetY = 0;
    this.pendingInputs = [];
  }

  /**
   * Applies immediate client-side movement and queues input with a sequence number.
   */
  public predictMovement(
    vx: number,
    vy: number,
    isSprinting: boolean,
    isSwimming: boolean,
    dt: number,
    canMoveTo: (x: number, y: number) => boolean
  ): PendingInput {
    this.currentSeq++;

    let normVx = vx;
    let normVy = vy;
    const len = Math.hypot(vx, vy);
    if (len > 1.0) {
      normVx /= len;
      normVy /= len;
    }

    let speed = isSprinting ? SPRINT_SPEED : WALK_SPEED;
    if (isSwimming) speed *= SWIM_MULTIPLIER;

    const nextX = this.predictedX + normVx * speed * dt;
    const nextY = this.predictedY + normVy * speed * dt;

    if (canMoveTo(nextX, nextY)) {
      this.predictedX = nextX;
      this.predictedY = nextY;
    } else {
      const canX = canMoveTo(nextX, this.predictedY);
      const canY = canMoveTo(this.predictedX, nextY);
      if (canX) this.predictedX = nextX;
      if (canY) this.predictedY = nextY;
    }

    const input: PendingInput = {
      seq: this.currentSeq,
      vx: normVx,
      vy: normVy,
      isSprinting,
      dt,
    };

    this.pendingInputs.push(input);

    // Limit pending input history to last 120 inputs
    if (this.pendingInputs.length > 120) {
      this.pendingInputs.shift();
    }

    return input;
  }

  /**
   * Reconciles predicted position against authoritative server position.
   * Discards inputs <= lastProcessedSeq, replays newer pending inputs,
   * and smoothly absorbs any discrepancy into errorOffset without visual jerk.
   */
  public reconcile(
    serverX: number,
    serverY: number,
    lastProcessedSeq: number,
    isSwimming: boolean,
    canMoveTo: (x: number, y: number) => boolean
  ): void {
    // 1. Discard acknowledged inputs
    this.pendingInputs = this.pendingInputs.filter((i) => i.seq > lastProcessedSeq);

    // 2. Start from server authoritative baseline
    let replayedX = serverX;
    let replayedY = serverY;

    // 3. Re-simulate pending inputs from server authoritative baseline
    for (const input of this.pendingInputs) {
      let speed = input.isSprinting ? SPRINT_SPEED : WALK_SPEED;
      if (isSwimming) speed *= SWIM_MULTIPLIER;

      const nextX = replayedX + input.vx * speed * input.dt;
      const nextY = replayedY + input.vy * speed * input.dt;

      if (canMoveTo(nextX, nextY)) {
        replayedX = nextX;
        replayedY = nextY;
      } else {
        const canX = canMoveTo(nextX, replayedY);
        const canY = canMoveTo(replayedX, nextY);
        if (canX) replayedX = nextX;
        if (canY) replayedY = nextY;
      }
    }

    // 4. Determine discrepancy between previous prediction and replayed truth
    const errorX = this.predictedX - replayedX;
    const errorY = this.predictedY - replayedY;
    const errorDist = Math.hypot(errorX, errorY);

    if (errorDist > 2.0) {
      // Large discrepancy (teleport, respawn, knockback) -> snap immediately
      this.predictedX = replayedX;
      this.predictedY = replayedY;
      this.errorOffsetX = 0;
      this.errorOffsetY = 0;
    } else if (errorDist > 0.035) {
      // Small discrepancy -> adjust prediction to replayed truth,
      // and preserve visual continuity through smoothly decaying error offset without compounding
      this.predictedX = replayedX;
      this.predictedY = replayedY;
      this.errorOffsetX = errorX;
      this.errorOffsetY = errorY;
    }
  }

  /**
   * Decays the visual error offset smoothly toward zero.
   * Call once per client render frame.
   */
  public updateSmoothing(dt: number): void {
    if (this.errorOffsetX !== 0 || this.errorOffsetY !== 0) {
      // Exponential decay: reduces error offset smoothly over ~100ms
      const factor = Math.exp(-18 * dt);
      this.errorOffsetX *= factor;
      this.errorOffsetY *= factor;

      if (Math.abs(this.errorOffsetX) < 0.002) this.errorOffsetX = 0;
      if (Math.abs(this.errorOffsetY) < 0.002) this.errorOffsetY = 0;
    }
  }

  /**
   * Returns smoothly interpolated visual coordinates for rendering (predicted + visual error offset).
   */
  public getVisualPosition(): { x: number; y: number } {
    return {
      x: this.predictedX + this.errorOffsetX,
      y: this.predictedY + this.errorOffsetY,
    };
  }
}
