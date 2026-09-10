/**
 * EntityInterpolator.ts - High-Precision Network Entity Interpolator
 * 
 * Implements Section 14 of authoritative_server.txt:
 * Buffer server snapshots and smoothly interpolate positions of remote players,
 * wildlife, NPCs, and enemies at 60+ FPS between 20 Hz server ticks.
 */

export interface PositionSample {
  x: number;
  y: number;
  time: number;
}

export interface InterpolatedEntityResult {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isMoving: boolean;
}

export class EntityInterpolator {
  private entityBuffers = new Map<number, PositionSample[]>();
  private renderDelayMs: number;

  constructor(renderDelayMs = 90) {
    this.renderDelayMs = renderDelayMs;
  }

  public pushSample(entityId: number, x: number, y: number, timestamp: number = Date.now()): void {
    let buf = this.entityBuffers.get(entityId);
    if (!buf) {
      buf = [];
      this.entityBuffers.set(entityId, buf);
    }
    buf.push({ x, y, time: timestamp });

    // Retain sufficient samples for smooth interpolation window
    if (buf.length > 25) {
      buf.shift();
    }
  }

  public removeEntity(entityId: number): void {
    this.entityBuffers.delete(entityId);
  }

  /**
   * Returns smoothly interpolated position and velocity for entity at current client render time.
   * Includes dead-reckoning extrapolation during packet jitter so entities don't freeze/stutter.
   */
  public getInterpolatedEntity(
    entityId: number,
    fallbackX: number,
    fallbackY: number
  ): InterpolatedEntityResult {
    const buf = this.entityBuffers.get(entityId);
    if (!buf || buf.length === 0) {
      return { x: fallbackX, y: fallbackY, vx: 0, vy: 0, isMoving: false };
    }

    if (buf.length === 1) {
      return { x: buf[0].x, y: buf[0].y, vx: 0, vy: 0, isMoving: false };
    }

    const renderTime = Date.now() - this.renderDelayMs;

    // 1. If render time is within our sample window: perform smooth linear interpolation
    for (let i = 0; i < buf.length - 1; i++) {
      const p0 = buf[i];
      const p1 = buf[i + 1];

      if (renderTime >= p0.time && renderTime <= p1.time) {
        const span = p1.time - p0.time;
        if (span <= 0) {
          return { x: p1.x, y: p1.y, vx: 0, vy: 0, isMoving: false };
        }
        const t = (renderTime - p0.time) / span;
        const vx = (p1.x - p0.x) / (span / 1000);
        const vy = (p1.y - p0.y) / (span / 1000);
        const isMoving = Math.hypot(vx, vy) > 0.15;
        return {
          x: p0.x + (p1.x - p0.x) * t,
          y: p0.y + (p1.y - p0.y) * t,
          vx,
          vy,
          isMoving,
        };
      }
    }

    // 2. If behind oldest sample: clamp to oldest
    if (renderTime < buf[0].time) {
      return { x: buf[0].x, y: buf[0].y, vx: 0, vy: 0, isMoving: false };
    }

    // 3. If ahead of newest sample (network jitter/delay): extrapolate smoothly along velocity
    const last = buf[buf.length - 1];
    const prev = buf[buf.length - 2];
    const dtSeconds = Math.max(0.001, (last.time - prev.time) / 1000);
    const vx = (last.x - prev.x) / dtSeconds;
    const vy = (last.y - prev.y) / dtSeconds;
    const isMoving = Math.hypot(vx, vy) > 0.15;

    // Cap extrapolation to 120ms max to prevent runaway overshoot
    const timeAheadSeconds = Math.min(0.12, Math.max(0, (renderTime - last.time) / 1000));
    return {
      x: last.x + vx * timeAheadSeconds,
      y: last.y + vy * timeAheadSeconds,
      vx,
      vy,
      isMoving,
    };
  }

  /**
   * Legacy shorthand for position only.
   */
  public getInterpolatedPosition(
    entityId: number,
    fallbackX: number,
    fallbackY: number
  ): { x: number; y: number } {
    const res = this.getInterpolatedEntity(entityId, fallbackX, fallbackY);
    return { x: res.x, y: res.y };
  }
}
