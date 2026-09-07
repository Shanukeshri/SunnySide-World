/**
 * ClientPrediction.ts - Client-Side Movement Prediction & Reconciliation
 * 
 * Implements Section 15 of authoritative_server.txt:
 * Immediately predicts local player movement for instantaneous responsive controls (0ms feel),
 * stores pending inputs, and reconciles position against authoritative server updates.
 */

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

  // Predicted coordinates
  public predictedX = 22;
  public predictedY = 18;

  public initPosition(x: number, y: number): void {
    this.predictedX = x;
    this.predictedY = y;
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

    let speed = isSprinting ? 5.6 : 3.8;
    if (isSwimming) speed *= 0.65;

    const nextX = this.predictedX + normVx * speed * dt;
    const nextY = this.predictedY + normVy * speed * dt;

    if (canMoveTo(nextX, nextY)) {
      this.predictedX = nextX;
      this.predictedY = nextY;
    } else {
      if (canMoveTo(nextX, this.predictedY)) this.predictedX = nextX;
      if (canMoveTo(this.predictedX, nextY)) this.predictedY = nextY;
    }

    const input: PendingInput = {
      seq: this.currentSeq,
      vx: normVx,
      vy: normVy,
      isSprinting,
      dt,
    };

    this.pendingInputs.push(input);
    return input;
  }

  /**
   * Reconciles predicted position against authoritative server position.
   * Discards inputs <= lastProcessedSeq, and replays newer pending inputs.
   */
  public reconcile(
    serverX: number,
    serverY: number,
    lastProcessedSeq: number,
    isSwimming: boolean,
    canMoveTo: (x: number, y: number) => boolean
  ): void {
    // Discard acknowledged inputs
    this.pendingInputs = this.pendingInputs.filter((i) => i.seq > lastProcessedSeq);

    // If server position significantly differs (error threshold > 0.05 tiles), replay unacknowledged inputs
    const diff = Math.hypot(this.predictedX - serverX, this.predictedY - serverY);
    if (diff > 0.05) {
      this.predictedX = serverX;
      this.predictedY = serverY;

      // Re-simulate pending inputs from server authoritative baseline
      for (const input of this.pendingInputs) {
        let speed = input.isSprinting ? 5.6 : 3.8;
        if (isSwimming) speed *= 0.65;

        const nextX = this.predictedX + input.vx * speed * input.dt;
        const nextY = this.predictedY + input.vy * speed * input.dt;

        if (canMoveTo(nextX, nextY)) {
          this.predictedX = nextX;
          this.predictedY = nextY;
        } else {
          if (canMoveTo(nextX, this.predictedY)) this.predictedX = nextX;
          if (canMoveTo(this.predictedX, nextY)) this.predictedY = nextY;
        }
      }
    }
  }
}
