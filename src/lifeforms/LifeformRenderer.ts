import { Animal } from './Animal';
import { HeartParticle } from './types';
import { LivingEntity } from './LivingEntity';
import { SPECIES_CONFIGS } from './speciesConfig';

export class LifeformRenderer {
  private imageCache: Map<string, HTMLImageElement> = new Map();
  private loadedImages: Set<string> = new Set();

  constructor() {
    // Preload species sprites
    Object.values(SPECIES_CONFIGS).forEach((cfg) => {
      this.preloadImage(cfg.spriteAsset.sheetPath);
    });

    // Preload all human hairstyle overlays
    const hairstyles = ['bowlhair', 'curlyhair', 'longhair', 'mophair', 'shorthair', 'spikeyhair'];
    hairstyles.forEach((h) => {
      this.preloadImage(
        `/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Human/WALKING/${h}_walk_strip8.png`
      );
    });
  }

  public preloadImage(src: string): void {
    if (this.imageCache.has(src)) return;
    const img = new Image();
    img.src = src;
    img.onload = () => this.loadedImages.add(src);
    this.imageCache.set(src, img);
  }

  public getImage(src: string): HTMLImageElement | null {
    const img = this.imageCache.get(src);
    if (img && img.complete && img.naturalWidth > 0) {
      return img;
    }
    if (!img) {
      this.preloadImage(src);
    }
    return null;
  }

  /**
   * Renders relative scaling shadow under entity based on species size and cellSize
   */
  public renderShadow(
    ctx: CanvasRenderingContext2D,
    screenX: number,
    screenY: number,
    radiusX: number,
    radiusY: number
  ): void {
    ctx.save();
    ctx.fillStyle = 'rgba(10, 20, 15, 0.32)';
    ctx.beginPath();
    ctx.ellipse(screenX, screenY, Math.max(2, radiusX), Math.max(1.5, radiusY), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Renders subtle water ripples under swimming creatures (e.g. ducks in pond)
   */
  public renderWaterWake(
    ctx: CanvasRenderingContext2D,
    screenX: number,
    screenY: number,
    radiusX: number,
    radiusY: number
  ): void {
    ctx.save();
    // Soft cyan-white water wake
    ctx.fillStyle = 'rgba(186, 230, 253, 0.4)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(screenX, screenY, radiusX * 1.1, radiusY * 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Renders an individual living entity (Animal, NPC, or Player)
   */
  public renderEntity(
    ctx: CanvasRenderingContext2D,
    entity: LivingEntity,
    cellSize: number,
    isTargeted: boolean = false,
    overrideScreenX?: number,
    overrideScreenY?: number,
    scaleMultiplier: number = 1.0
  ): void {
    if (!entity.isActive) return;

    const config = SPECIES_CONFIGS[entity.species];
    if (!config) return;

    const screenX = overrideScreenX !== undefined ? overrideScreenX : entity.position.x * cellSize;
    const screenY = overrideScreenY !== undefined ? overrideScreenY : entity.position.y * cellSize;

    // Relative scaling shadow based on species config & current zoom level
    const zoomScale = (cellSize / 24) * scaleMultiplier;
    const jumpOffset = (entity.anim.jumpOffset || 0) + (entity.anim.playerHopOffset || 0);

    // Ground shadow remains at foot level and scales softly as entity ascends
    const jumpRatio = Math.min(1.0, Math.max(0, jumpOffset / 16));
    const shadowScale = Math.max(0.7, 1.0 - jumpRatio * 0.25);
    const shadowRadiusX = (config.shadowRadiusX || 10) * zoomScale * shadowScale;
    const shadowRadiusY = (config.shadowRadiusY || 4) * zoomScale * shadowScale;

    if (entity.species === 'duck') {
      this.renderWaterWake(ctx, screenX, screenY, shadowRadiusX, shadowRadiusY);
    } else {
      this.renderShadow(ctx, screenX, screenY, shadowRadiusX, shadowRadiusY);
    }

    // Compute visual Y-offset (eating bobbing or jump/hop elevation)
    const visualOffsetY =
      (entity.anim.eatingBobOffset || 0) * zoomScale -
      jumpOffset * zoomScale;

    const img = this.getImage(config.spriteAsset.sheetPath);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (entity.behaviorState === 'DEAD') {
      ctx.globalAlpha = Math.max(0, Math.min(1, entity.anim.deathAlpha ?? 1.0));
    }

    // Translate to entity base
    ctx.translate(screenX, screenY + visualOffsetY);

    // Flip horizontally if facing left
    if (entity.anim.flipX) {
      ctx.scale(-1, 1);
    }

    const drawW = config.spriteAsset.drawWidth * zoomScale;
    const drawH = config.spriteAsset.drawHeight * zoomScale;
    const originYOffset = (config.spriteAsset.originYOffset || 0) * zoomScale;

    if (img) {
      const frameW = config.spriteAsset.frameWidth;
      const frameH = config.spriteAsset.frameHeight;
      const strideX = config.spriteAsset.strideX || frameW;
      const sourceCropX = config.spriteAsset.sourceCropX || 0;
      const sourceCropY = config.spriteAsset.sourceCropY || 0;

      const frameX =
        (entity.anim.currentFrame % config.spriteAsset.totalFrames) * strideX +
        sourceCropX;
      const frameY = sourceCropY;

      // Draw base body sprite
      ctx.drawImage(
        img,
        frameX,
        frameY,
        frameW,
        frameH,
        -drawW / 2,
        -drawH + originYOffset,
        drawW,
        drawH
      );

      // Draw layered hairstyle overlay for human characters (NPCs and Player)
      if (entity.hairstyle) {
        const hairPath = `/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Human/WALKING/${entity.hairstyle}_walk_strip8.png`;
        const hairImg = this.getImage(hairPath);
        if (hairImg) {
          ctx.drawImage(
            hairImg,
            frameX,
            frameY,
            frameW,
            frameH,
            -drawW / 2,
            -drawH + originYOffset,
            drawW,
            drawH
          );
        }
      }
    } else {
      // Fallback creature avatar while assets load
      ctx.fillStyle = entity.type === 'PLAYER' ? '#60a5fa' : entity.type === 'NPC' ? '#f59e0b' : '#34d399';
      ctx.beginPath();
      ctx.arc(0, -drawH / 2, drawW / 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Targeted highlight ring if in player interaction reach
    if (isTargeted) {
      ctx.save();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.ellipse(screenX, screenY, shadowRadiusX + 4, shadowRadiusY + 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * Renders floating reddish heart particles streaming upwards
   */
  public renderParticles(
    ctx: CanvasRenderingContext2D,
    particles: readonly HeartParticle[],
    cellSize: number
  ): void {
    if (particles.length === 0) return;

    ctx.save();
    for (const p of particles) {
      const wobble = Math.sin(p.life * (p.wobbleSpeed || 5)) * (p.wobbleAmp || 0.04);
      const px = (p.x + wobble) * cellSize;
      const py = p.y * cellSize;

      // Slightly bigger, beautifully defined heart (9-14px)
      const heartSize = Math.max(9, Math.min(14, Math.round(13 * p.scale * Math.sqrt(cellSize / 24))));
      ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
      ctx.font = `bold ${heartSize}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = p.color || '#dc2626';
      ctx.shadowColor = '#881337';
      ctx.shadowBlur = 2;
      ctx.fillText('♥', px, py);
    }
    ctx.restore();
  }

  /**
   * Interaction prompt HUD overlay (e.g. "[E] Pet  [F] Feed")
   */
  public renderInteractionPrompt(
    ctx: CanvasRenderingContext2D,
    animal: Animal,
    cellSize: number
  ): void {
    const sx = animal.position.x * cellSize;
    const sy = animal.position.y * cellSize - 42;

    ctx.save();
    ctx.font = '600 11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const text = animal.interaction.canPet && animal.interaction.pettingCooldown <= 0
      ? '[E] Pet   [F] Feed'
      : '[F] Feed';

    const metrics = ctx.measureText(text);
    const boxW = metrics.width + 16;
    const boxH = 20;

    // Glassmorphic pill
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.roundRect(sx - boxW / 2, sy - boxH / 2, boxW, boxH, 10);
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.fillStyle = '#fef08a';
    ctx.fillText(text, sx, sy);
    ctx.restore();
  }
}
