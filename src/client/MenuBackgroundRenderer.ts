import { SurvivalEngine } from "../game/SurvivalEngine";
import { SurvivalRenderer } from "../game/SurvivalRenderer";

/**
 * MenuBackgroundRenderer: Renders the starting screen using the EXACT same world rendering
 * as the game, focused on a procedural village settlement, and panning slowly with a smooth
 * cinematic camera trajectory.
 */
export class MenuBackgroundRenderer {
  private container: HTMLElement | null = null;
  private canvas: HTMLCanvasElement;
  private animId: number | null = null;
  private engine: SurvivalEngine;
  private renderer: SurvivalRenderer;
  private startTime: number = performance.now();
  private lastTime: number = performance.now();
  private villageCenterX: number = 55;
  private villageCenterY: number = 44;
  private onResize: () => void;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId);

    this.canvas = document.createElement("canvas");
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.display = "block";

    if (this.container) {
      this.container.innerHTML = "";
      this.container.appendChild(this.canvas);
    }

    // Generate procedural world with villages
    const randomSeed = Math.floor(Math.random() * 1000000) + 1;
    this.engine = new SurvivalEngine(randomSeed, false, 8);

    // Warm daytime lighting for starting screen
    this.engine.worldTime.timeOfDay = "Day";
    this.engine.worldTime.hour = 11;
    this.engine.worldTime.minute = 30;
    this.engine.worldTime.lightLevel = 1.0;

    // Use the exact same world renderer as the game
    this.renderer = new SurvivalRenderer();
    this.renderer.isMenuMode = true;
    this.renderer.zoom = 2.0;

    // Locate the primary village settlement center
    this.findVillageCenter();

    // Position camera initially at village center
    this.renderer.cameraX = this.villageCenterX;
    this.renderer.cameraY = this.villageCenterY;
    this.engine.player.x = this.villageCenterX;
    this.engine.player.y = this.villageCenterY;
    this.engine.worldManager.updatePlayerLocation(
      this.villageCenterX,
      this.villageCenterY,
    );

    this.onResize = () => this.handleResize();
    window.addEventListener("resize", this.onResize);
    this.handleResize();

    this.startLoop();
  }

  private findVillageCenter() {
    const wm = this.engine.worldManager;
    if (wm.villages && wm.villages.length > 0) {
      const v = wm.villages[0];
      if (v.data?.houses && v.data.houses.length > 0) {
        let sumX = 0;
        let sumY = 0;
        for (const h of v.data.houses) {
          sumX += v.gridX + h.x + (h.footprintW || 8) / 2;
          sumY += v.gridY + h.y + (h.footprintH || 8) / 2;
        }
        this.villageCenterX = sumX / v.data.houses.length;
        this.villageCenterY = sumY / v.data.houses.length;
        return;
      }
      this.villageCenterX = v.gridX + (v.width || 40) / 2;
      this.villageCenterY = v.gridY + (v.height || 40) / 2;
      return;
    }

    if (wm.villagePlannedSites && wm.villagePlannedSites.length > 0) {
      const s = wm.villagePlannedSites[0];
      this.villageCenterX = s.targetX;
      this.villageCenterY = s.targetY;
      return;
    }

    this.villageCenterX = 55;
    this.villageCenterY = 44;
  }

  private handleResize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || window.innerWidth;
    const h = rect.height || window.innerHeight;

    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
  }

  private startLoop() {
    const render = (now: number) => {
      this.renderFrame(now);
      this.animId = requestAnimationFrame(render);
    };
    this.animId = requestAnimationFrame(render);
  }

  private renderFrame(now: number) {
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;

    // Slow, serene, cinematic panning across the village
    const t = (now - this.startTime) * 0.00007; // Very slow and calm
    const spanRadiusX = 8.5; // in tiles
    const spanRadiusY = 5.5;

    const camX =
      this.villageCenterX +
      Math.sin(t * 0.9) * spanRadiusX +
      Math.cos(t * 0.3) * (spanRadiusX * 0.35);
    const camY =
      this.villageCenterY +
      Math.cos(t * 0.7) * spanRadiusY +
      Math.sin(t * 0.25) * (spanRadiusY * 0.3);

    this.renderer.cameraX = camX;
    this.renderer.cameraY = camY;
    this.engine.player.x = camX;
    this.engine.player.y = camY;
    this.engine.worldManager.updatePlayerLocation(camX, camY);

    // Keep pleasant daytime lighting
    this.engine.worldTime.timeOfDay = "Day";
    this.engine.worldTime.hour = 11;
    this.engine.worldTime.minute = 30;
    this.engine.worldTime.lightLevel = 1.0;

    // Update world simulation (smoke particles, birds, wind, ambient weather)
    this.engine.update(dt);

    // Render using the exact same world rendering engine
    this.renderer.render(this.canvas, this.engine, dt);

    // Soft cinematic radial vignette overlay for menu UI contrast
    const ctx = this.canvas.getContext("2d");
    if (ctx) {
      const halfW = this.canvas.width / 2;
      const halfH = this.canvas.height / 2;
      const gradient = ctx.createRadialGradient(
        halfW,
        halfH,
        Math.min(halfW, halfH) * 0.35,
        halfW,
        halfH,
        Math.max(halfW, halfH) * 1.05,
      );
      gradient.addColorStop(0, "rgba(255, 245, 210, 0.03)");
      gradient.addColorStop(0.7, "rgba(15, 23, 42, 0.35)");
      gradient.addColorStop(1, "rgba(10, 15, 30, 0.72)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  public destroy() {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    window.removeEventListener("resize", this.onResize);
    if (this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
  }
}
