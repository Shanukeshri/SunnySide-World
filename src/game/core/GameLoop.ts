/**
 * GameLoop.ts - Server Fixed-Frequency Simulation Loop
 * 
 * Implements Section 13 & 14 of authoritative_server.txt:
 * Runs fixed-frequency ticks (e.g. 20 Hz, dt = 0.05s) decoupled from client rendering.
 * Tracks performance, ticks, and delta timing accurately with drift compensation.
 */

export class GameLoop {
  private tickRate: number; // ticks per second
  private intervalMs: number;
  private timerId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastTime: number = 0;
  private currentTick: number = 0;
  private updateFn: (dt: number, tick: number) => void;

  // Telemetry
  public averageTickDurationMs: number = 0;
  public totalTicks: number = 0;

  constructor(tickRate: number = 20, updateFn: (dt: number, tick: number) => void) {
    this.tickRate = tickRate;
    this.intervalMs = 1000 / tickRate;
    this.updateFn = updateFn;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = Date.now();

    const loop = () => {
      if (!this.isRunning) return;

      const now = Date.now();
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;

      // Cap delta time to prevent spiral of death during CPU spikes
      const dt = Math.min(rawDt, 0.1);

      const startTime = performance.now();
      this.currentTick++;
      this.totalTicks++;

      try {
        this.updateFn(dt, this.currentTick);
      } catch (err) {
        console.error(`[GameLoop] Error on tick #${this.currentTick}:`, err);
      }

      const elapsed = performance.now() - startTime;
      this.averageTickDurationMs = this.averageTickDurationMs * 0.95 + elapsed * 0.05;

      // Compensate for tick execution time
      const delay = Math.max(1, Math.round(this.intervalMs - elapsed));
      this.timerId = setTimeout(loop, delay);
    };

    this.timerId = setTimeout(loop, this.intervalMs);
    console.log(`[GameLoop] Started at ${this.tickRate} Hz (tick interval: ${this.intervalMs}ms)`);
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    console.log(`[GameLoop] Stopped after ${this.totalTicks} ticks`);
  }

  public getTick(): number {
    return this.currentTick;
  }

  public getTickRate(): number {
    return this.tickRate;
  }
}
