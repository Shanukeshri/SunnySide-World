import { Animal } from './Animal';
import { HeartParticle } from './types';
import { LivingEntity } from './LivingEntity';
import { SPECIES_CONFIGS } from './speciesConfig';

export interface HumanAnimDef {
  folder: string;
  prefix: string;
  totalFrames: number;
  speed: number;
}

export const HUMAN_ANIMATIONS: Record<string, HumanAnimDef> = {
  IDLE:      { folder: 'IDLE',      prefix: 'idle',     totalFrames: 9,  speed: 0.15 },
  WALK:      { folder: 'WALKING',   prefix: 'walk',     totalFrames: 8,  speed: 0.10 },
  WALKING:   { folder: 'WALKING',   prefix: 'walk',     totalFrames: 8,  speed: 0.10 },
  RUN:       { folder: 'RUN',       prefix: 'run',      totalFrames: 8,  speed: 0.08 },
  ATTACK:    { folder: 'ATTACK',    prefix: 'attack',   totalFrames: 10, speed: 0.05 },
  AXE:       { folder: 'AXE',       prefix: 'axe',      totalFrames: 10, speed: 0.05 },
  MINING:    { folder: 'MINING',    prefix: 'mining',   totalFrames: 10, speed: 0.05 },
  DIG:       { folder: 'DIG',       prefix: 'dig',      totalFrames: 13, speed: 0.05 },
  WATERING:  { folder: 'WATERING',  prefix: 'watering', totalFrames: 5,  speed: 0.08 },
  HAMMERING: { folder: 'HAMMERING', prefix: 'hamering', totalFrames: 23, speed: 0.05 },
  CARRY:     { folder: 'CARRY',     prefix: 'carry',    totalFrames: 8,  speed: 0.10 },
  HURT:      { folder: 'HURT',      prefix: 'hurt',     totalFrames: 8,  speed: 0.08 },
  DEATH:     { folder: 'DEATH',     prefix: 'death',    totalFrames: 13, speed: 0.10 },
  JUMP:      { folder: 'JUMP',      prefix: 'jump',     totalFrames: 9,  speed: 0.07 },
  CASTING:   { folder: 'CASTING',   prefix: 'casting',  totalFrames: 15, speed: 0.06 },
  REELING:   { folder: 'REELING',   prefix: 'reeling',  totalFrames: 13, speed: 0.06 },
  CAUGHT:    { folder: 'CAUGHT',    prefix: 'caught',   totalFrames: 10, speed: 0.08 },
  DOING:     { folder: 'DOING',     prefix: 'doing',    totalFrames: 8,  speed: 0.08 },
  ROLL:      { folder: 'ROLL',      prefix: 'roll',     totalFrames: 10, speed: 0.06 },
  SWIMMING:  { folder: 'SWIMMING',  prefix: 'swimming', totalFrames: 12, speed: 0.08 },
  WAITING:   { folder: 'WAITING',   prefix: 'waiting',  totalFrames: 9,  speed: 0.12 },
};

export class LifeformRenderer {
  private imageCache: Map<string, HTMLImageElement> = new Map();
  private loadedImages: Set<string> = new Set();

  constructor() {
    // 1. Preload species sprites (animals)
    Object.values(SPECIES_CONFIGS).forEach((cfg) => {
      this.preloadImage(cfg.spriteAsset.sheetPath);
    });

    // 2. Preload all human animation base sheets and paired tool movement sheets
    Object.values(HUMAN_ANIMATIONS).forEach((anim) => {
      this.preloadImage(
        `/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Human/${anim.folder}/base_${anim.prefix}_strip${anim.totalFrames}.png`
      );
      this.preloadImage(
        `/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Human/${anim.folder}/tools_${anim.prefix}_strip${anim.totalFrames}.png`
      );
    });

    // 3. Preload all human hairstyles across common animations
    const hairstyles = ['mophair', 'bowlhair', 'curlyhair', 'longhair', 'shorthair', 'spikeyhair'];
    const commonActions = ['WALKING', 'WALK', 'IDLE', 'RUN', 'CARRY', 'ATTACK', 'AXE', 'MINING', 'DIG', 'WATERING', 'HAMMERING', 'JUMP'];
    for (const h of hairstyles) {
      for (const actKey of commonActions) {
        const anim = HUMAN_ANIMATIONS[actKey];
        if (anim) {
          this.preloadImage(
            `/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Human/${anim.folder}/${h}_${anim.prefix}_strip${anim.totalFrames}.png`
          );
        }
      }
    }

    // 4. Preload all Composites (village NPCs & characters)
    const compositeSheets = [
      'blacksmith_spikeyhair_hammering_strip23.png',
      'builder_mophair_axe_strip10.png',
      'child_bowlhair_jump_strip9.png',
      'farmer_curlyhair_watering_strip5.png',
      'fisher_bowlhair_reeling_strip13.png',
      'guide_longhair_attack_strip10.png',
      'merchant_longhair_waiting_strip9.png',
      'villager_shorthair_walk_strip8.png',
      'player_bowlhair_idle_strip9.png',
      'player_curlyhair_idle_strip9.png',
      'player_longhair_idle_strip9.png',
      'player_mophair_idle_strip9.png',
      'player_shorthair_idle_strip9.png',
      'player_spikeyhair_idle_strip9.png',
    ];
    for (const c of compositeSheets) {
      this.preloadImage(
        `/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Composites/${c}`
      );
    }

    // 5. Preload Goblin animations
    const goblinStrips = [
      'spr_walk_strip8.png',
      'spr_run_strip8.png',
      'spr_idle_strip9.png',
      'spr_attack_strip10.png',
      'spr_axe_strip10.png',
      'spr_mining_strip10.png',
      'spr_dig_strip13.png',
      'spr_hammering_strip23.png',
      'spr_watering_strip5.png',
      'spr_carry_strip8.png',
      'spr_swimming_strip12.png',
      'spr_jump_strip9.png',
      'spr_roll_strip10.png',
      'spr_waiting_strip9.png',
      'spr_hurt_strip8.png',
      'spr_death_strip13.png',
    ];
    for (const s of goblinStrips) {
      this.preloadImage(
        `/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Goblin/PNG/${s}`
      );
    }

    // 6. Preload Skeleton animations
    const skeletonStrips = [
      'skeleton_idle_strip6.png',
      'skeleton_walk_strip8.png',
      'skeleton_attack_strip7.png',
      'skeleton_hurt_strip7.png',
      'skeleton_death_strip10.png',
      'skeleton_jump_strip10.png',
    ];
    for (const s of skeletonStrips) {
      this.preloadImage(
        `/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Skeleton/PNG/${s}`
      );
    }
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
    entity: any,
    cellSize: number,
    isTargeted: boolean = false,
    overrideScreenX?: number,
    overrideScreenY?: number,
    scaleMultiplier: number = 1.0,
    forcedAction?: string
  ): void {
    if (!entity.isActive && entity.behaviorState !== 'DEAD') return;

    const config = SPECIES_CONFIGS[entity.species as keyof typeof SPECIES_CONFIGS];
    if (!config) return;

    const screenX = overrideScreenX !== undefined ? overrideScreenX : entity.position.x * cellSize;
    const screenY = overrideScreenY !== undefined ? overrideScreenY : entity.position.y * cellSize;

    const zoomScale = (cellSize / 24) * scaleMultiplier;
    const jumpOffset = (entity.anim?.jumpOffset || 0) + (entity.anim?.playerHopOffset || 0);

    const jumpRatio = Math.min(1.0, Math.max(0, jumpOffset / 16));
    const shadowScale = Math.max(0.7, 1.0 - jumpRatio * 0.25);
    const shadowRadiusX = (config.shadowRadiusX || 10) * zoomScale * shadowScale;
    const shadowRadiusY = (config.shadowRadiusY || 4) * zoomScale * shadowScale;

    if (entity.species === 'duck') {
      this.renderWaterWake(ctx, screenX, screenY, shadowRadiusX, shadowRadiusY);
    } else {
      this.renderShadow(ctx, screenX, screenY, shadowRadiusX, shadowRadiusY);
    }

    const visualOffsetY =
      (entity.anim?.eatingBobOffset || 0) * zoomScale -
      jumpOffset * zoomScale;

    // Check if entity is human character (Player or NPC) with specialized animation state
    const isHuman = entity.type === 'PLAYER' || entity.type === 'NPC' || entity.species === 'player' || entity.species === 'villager';
    const actionKey = forcedAction || entity.anim?.action || (entity.behaviorState === 'DEAD' ? 'DEATH' : 'WALK');
    const animDef = isHuman ? HUMAN_ANIMATIONS[actionKey] || HUMAN_ANIMATIONS['WALK'] : null;

    let sheetPath = config.spriteAsset.sheetPath;
    let totalFrames = config.spriteAsset.totalFrames;

    if (isHuman && animDef) {
      sheetPath = `/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Human/${animDef.folder}/base_${animDef.prefix}_strip${animDef.totalFrames}.png`;
      totalFrames = animDef.totalFrames;
    }

    const img = this.getImage(sheetPath);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (entity.behaviorState === 'DEAD') {
      ctx.globalAlpha = Math.max(0, Math.min(1, entity.anim?.deathAlpha ?? 1.0));
    }

    ctx.translate(screenX, screenY + visualOffsetY);

    if (entity.anim?.flipX) {
      ctx.scale(-1, 1);
    }

    const drawW = config.spriteAsset.drawWidth * zoomScale;
    const drawH = config.spriteAsset.drawHeight * zoomScale;
    const originYOffset = (config.spriteAsset.originYOffset || 0) * zoomScale;

    if (entity.compositeSheet) {
      const compImg = this.getImage(entity.compositeSheet);
      const totalF = entity.compositeFrames || 8;
      const currentFrame = entity.anim?.currentFrame ?? Math.floor(Date.now() / 110);
      const fIndex = currentFrame % totalF;
      const frameX = fIndex * 96;
      const frameY = 0;
      const frameW = 96;
      const frameH = 64;

      const humanScale = 1.7 * zoomScale;
      const destW = 96 * humanScale;
      const destH = 64 * humanScale;
      const destX = -48 * humanScale;
      const destY = -40 * humanScale;

      if (compImg) {
        ctx.drawImage(
          compImg,
          frameX,
          frameY,
          frameW,
          frameH,
          destX,
          destY,
          destW,
          destH
        );
      }
    } else if (isHuman && animDef) {
      const currentFrame = entity.anim?.currentFrame ?? 0;
      const fIndex = currentFrame % animDef.totalFrames;
      const frameX = fIndex * 96;
      const frameY = 0;
      const frameW = 96;
      const frameH = 64;

      const humanScale = 1.7 * zoomScale;
      const destW = 96 * humanScale;
      const destH = 64 * humanScale;
      const destX = -48 * humanScale;
      const destY = -40 * humanScale;

      // 1. Draw Base Body
      if (img) {
        ctx.drawImage(
          img,
          frameX,
          frameY,
          frameW,
          frameH,
          destX,
          destY,
          destW,
          destH
        );
      } else {
        ctx.fillStyle = entity.type === 'PLAYER' ? '#60a5fa' : '#f59e0b';
        ctx.beginPath();
        ctx.arc(0, -drawH / 2, drawW / 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Layered hairstyle overlay
      if (entity.hairstyle) {
        let hairPath = `/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Human/WALKING/${entity.hairstyle}_walk_strip8.png`;
        const tryHairPath = `/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Human/${animDef.folder}/${entity.hairstyle}_${animDef.prefix}_strip${animDef.totalFrames}.png`;
        const testImg = this.getImage(tryHairPath);
        if (testImg) hairPath = tryHairPath;

        const hairImg = this.getImage(hairPath);
        if (hairImg) {
          ctx.drawImage(
            hairImg,
            frameX,
            frameY,
            frameW,
            frameH,
            destX,
            destY,
            destW,
            destH
          );
        }
      }

      // 3. Layered Tool Movement Overlay (paired with base across all 20 actions)
      const toolActionSet = new Set([
        'AXE', 'MINING', 'ATTACK', 'DIG', 'WATERING', 'HAMMERING',
        'CASTING', 'REELING', 'CAUGHT', 'DOING', 'CARRY', 'ROLL',
        'SWIMMING', 'WAITING', 'IDLE', 'WALK', 'WALKING', 'RUN', 'JUMP', 'HURT', 'DEATH'
      ]);
      const shouldDrawTool = entity.anim?.showTool ?? (entity.anim?.hasTool && toolActionSet.has(actionKey));

      if (shouldDrawTool) {
        const toolPath = `/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Human/${animDef.folder}/tools_${animDef.prefix}_strip${animDef.totalFrames}.png`;
        const toolImg = this.getImage(toolPath);
        if (toolImg) {
          ctx.drawImage(
            toolImg,
            frameX,
            frameY,
            frameW,
            frameH,
            destX,
            destY,
            destW,
            destH
          );
        }
      }
    } else if (img) {
      const frameW = config.spriteAsset.frameWidth;
      const frameH = config.spriteAsset.frameHeight;
      const strideX = config.spriteAsset.strideX || frameW;
      const sourceCropX = config.spriteAsset.sourceCropX || 0;
      const sourceCropY = config.spriteAsset.sourceCropY || 0;

      const currentFrame = entity.anim?.currentFrame ?? 0;
      const frameX = (currentFrame % totalFrames) * strideX + sourceCropX;
      const frameY = sourceCropY;

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
    } else {
      ctx.fillStyle = entity.type === 'PLAYER' ? '#60a5fa' : entity.type === 'NPC' ? '#f59e0b' : '#34d399';
      ctx.beginPath();
      ctx.arc(0, -drawH / 2, drawW / 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

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
   * Renders an animated Goblin or Skeleton enemy using Sunnyside character spritesheets!
   */
  public renderEnemy(
    ctx: CanvasRenderingContext2D,
    enemy: any,
    cellSize: number,
    screenX: number,
    screenY: number
  ): void {
    const isGoblin = enemy.type === 'goblin';
    const isSkeleton = enemy.type === 'skeleton';
    const zoomScale = cellSize / 24;

    if (isSkeleton) {
      let stripName = 'skeleton_idle_strip6.png';
      let totalFrames = 6;
      let frameDuration = 140;

      if (enemy.health <= 0) {
        stripName = 'skeleton_death_strip10.png';
        totalFrames = 10;
        frameDuration = 100;
      } else if (enemy.hurtTimer > 0) {
        stripName = 'skeleton_hurt_strip7.png';
        totalFrames = 7;
        frameDuration = 80;
      } else if (enemy.state === 'ATTACK') {
        stripName = 'skeleton_attack_strip7.png';
        totalFrames = 7;
        frameDuration = 70;
      } else if (enemy.vx !== 0 || enemy.vy !== 0) {
        stripName = 'skeleton_walk_strip8.png';
        totalFrames = 8;
        frameDuration = 100;
      }

      const path = `/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Skeleton/PNG/${stripName}`;
      const img = this.getImage(path);

      const monsterScale = 1.7 * zoomScale;
      const destW = 96 * monsterScale;
      const destH = 64 * monsterScale;
      const destX = -48 * monsterScale;
      const destY = -40 * monsterScale;

      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.translate(screenX, screenY);
      if (enemy.vx < 0 || enemy.direction === 'LEFT') {
        ctx.scale(-1, 1);
      }

      if (img) {
        const frameIdx = Math.floor(Date.now() / frameDuration) % totalFrames;
        const frameX = frameIdx * 96;
        const frameY = 0;
        const frameW = 96;
        const frameH = 64;

        if (enemy.hurtTimer > 0) {
          ctx.filter = 'brightness(2.2) drop-shadow(0 0 4px #ef4444)';
        }

        ctx.drawImage(img, frameX, frameY, frameW, frameH, destX, destY, destW, destH);
      } else {
        ctx.font = `${20 * zoomScale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💀', 0, -20 * zoomScale);
      }
      ctx.restore();
      return;
    }

    if (isGoblin) {
      let stripName = 'spr_idle_strip9.png';
      let totalFrames = 8;
      let frameDuration = 120;
      let cols = 8;

      if (enemy.health <= 0) {
        stripName = 'spr_death_strip13.png';
        totalFrames = 9;
        cols = 9;
        frameDuration = 90;
      } else if (enemy.hurtTimer > 0) {
        stripName = 'spr_hurt_strip8.png';
        totalFrames = 8;
        cols = 8;
        frameDuration = 80;
      } else if (enemy.state === 'ATTACK') {
        stripName = 'spr_attack_strip10.png';
        totalFrames = 9;
        cols = 9;
        frameDuration = 70;
      } else if (enemy.action === 'AXE') {
        stripName = 'spr_axe_strip10.png';
        totalFrames = 10;
        cols = 10;
        frameDuration = 80;
      } else if (enemy.action === 'MINING') {
        stripName = 'spr_mining_strip10.png';
        totalFrames = 10;
        cols = 10;
        frameDuration = 80;
      } else if (enemy.state === 'CHASE') {
        stripName = 'spr_run_strip8.png';
        totalFrames = 8;
        cols = 8;
        frameDuration = 80;
      } else if (enemy.vx !== 0 || enemy.vy !== 0) {
        stripName = 'spr_walk_strip8.png';
        totalFrames = 8;
        cols = 8;
        frameDuration = 100;
      }

      const path = `/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Goblin/PNG/${stripName}`;
      const img = this.getImage(path);

      const monsterScale = 1.7 * zoomScale;
      const destW = 96 * monsterScale;
      const destH = 64 * monsterScale;
      const destX = -48 * monsterScale;
      const destY = -40 * monsterScale;

      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.translate(screenX, screenY);
      if (enemy.vx < 0 || enemy.direction === 'LEFT') {
        ctx.scale(-1, 1);
      }

      if (img) {
        const frameIdx = Math.floor(Date.now() / frameDuration) % totalFrames;
        const col = frameIdx % cols;
        const row = Math.floor(frameIdx / cols);
        const frameX = col * 96;
        const frameY = row * 64;
        const frameW = 96;
        const frameH = 64;

        if (enemy.hurtTimer > 0) {
          ctx.filter = 'brightness(2.2) drop-shadow(0 0 4px #ef4444)';
        }

        ctx.drawImage(img, frameX, frameY, frameW, frameH, destX, destY, destW, destH);
      } else {
        ctx.font = `${20 * zoomScale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('👺', 0, -20 * zoomScale);
      }
      ctx.restore();
      return;
    }

    // Slime fallback
    ctx.save();
    ctx.font = `${20 * zoomScale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🟢', screenX, screenY - 4);
    ctx.restore();
  }

  /**
   * Renders floating heart particles
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
   * Interaction prompt HUD overlay
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

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.roundRect(sx - boxW / 2, sy - boxH / 2, boxW, boxH, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fef08a';
    ctx.fillText(text, sx, sy);
    ctx.restore();
  }
}
