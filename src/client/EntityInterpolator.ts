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

export class EntityInterpolator {
  private entityBuffers = new Map<number, PositionSample[]>();
  private renderDelayMs: number;

  constructor(renderDelayMs = 100) {
    this.renderDelayMs = renderDelayMs;
  }

  public pushSample(entityId: number, x: number, y: number, timestamp: number = Date.now()): void {
    let buf = this.entityBuffers.get(entityId);
    if (!buf) {
      buf = [];
      this.entityBuffers.set(entityId, buf);
    }
    buf.push({ x, y, time: timestamp });

    // Keep only recent samples
    if (buf.length > 20) {
      buf.shift();
    }
  }

  public removeEntity(entityId: number): void {
    this.entityBuffers.delete(entityId);
  }

  /**
   * Returns smoothly interpolated position for entity at current client render time.
   */
  public getInterpolatedPosition(
    entityId: number,
    fallbackX: number,
    fallbackY: number
  ): { x: number; y: number } {
    const buf = this.entityBuffers.get(entityId);
    if (!buf || buf.length === 0) {
      return { x: fallbackX, y: fallbackY };
    }

    if (buf.length === 1) {
      return { x: buf[0].x, y: buf[0].y };
    }

    const renderTime = Date.now() - this.renderDelayMs;

    // Find the two surrounding samples
    for (let i = 0; i < buf.length - 1; i++) {
      const p0 = buf[i];
      const p1 = buf[i + 1];

      if (renderTime >= p0.time && renderTime <= p1.time) {
        const span = p1.time - p0.time;
        if (span <= 0) return { x: p1.x, y: p1.y };
        const t = (renderTime - p0.time) / span;
        return {
          x: p0.x + (p1.x - p0.x) * t,
          y: p0.y + (p1.y - p0.y) * t,
        };
      }
    }

    // Extrapolate to latest sample if behind
    const latest = buf[buf.length - 1];
    return { x: latest.x, y: latest.y };
  }
}
