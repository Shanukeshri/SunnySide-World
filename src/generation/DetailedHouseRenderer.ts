// ═══════════════════════════════════════════════════════════════════
// DETAILED HOUSE RENDERER — AUTHENTIC 2.5D CUTAWAY ENGINE
// High-fidelity 3D elevation, directional drop shadows, vertical wall facades,
// recessed floor ambient occlusion, and grounded furniture contact shadows
// Inspired by Necesse-style top-down 2.5D architectural pixel art
// ═══════════════════════════════════════════════════════════════════

import {
  ProceduralDetailedHouse,
  PlacedFurniture,
  HouseRoom,
  SPRITE_PROPS,
} from './HouseInteriorGenerator';

export class DetailedHouseRenderer {
  private cellSize: number = 48;
  private propsImages: Record<string, HTMLImageElement> = {};
  private soilImg: HTMLImageElement | null = null;
  private loaded: boolean = false;

  constructor(cellSize: number = 48) {
    this.cellSize = cellSize;
  }

  public async preloadAssets(): Promise<void> {
    if (this.loaded || typeof window === 'undefined') return;

    const promises = Object.entries(SPRITE_PROPS).map(([key, url]) => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          this.propsImages[key] = img;
          resolve();
        };
        img.onerror = () => resolve();
        img.src = url;
      });
    });

    const soilPromise = new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.soilImg = img;
        resolve();
      };
      img.onerror = () => resolve();
      img.src = '/tilled_soil.png';
    });

    await Promise.all([...promises, soilPromise]);
    this.loaded = true;
  }

  /**
   * Main 2.5D Cutaway House Render Pipeline
   */
  public renderHouse(
    ctx: CanvasRenderingContext2D,
    tilesetImg: CanvasImageSource,
    house: ProceduralDetailedHouse,
    originX: number = 0,
    originY: number = 0,
    options?: {
      cellSize?: number;
      showGrid?: boolean;
      showCollision?: boolean;
      showLights?: boolean;
      pixelOrigin?: { x: number; y: number };
    }
  ): void {
    const cs = options?.cellSize ?? this.cellSize;
    const px = options?.pixelOrigin ? options.pixelOrigin.x : originX * cs;
    const py = options?.pixelOrigin ? options.pixelOrigin.y : originY * cs;
    const opt = { ...options, cellSize: cs, pixelOrigin: { x: px, y: py } };

    // 1. Foundation, Floors, Rugs, and Back North Walls
    this.renderHouseBase(ctx, tilesetImg, house, opt);

    // 2. Y-Sorted Interior Furniture
    const depthList = [...house.furniture].sort((a, b) => a.relY + a.h - (b.relY + b.h));
    for (const furn of depthList) {
      if (furn.drawType === 'rug') continue;
      this.renderFurnitureItem(ctx, tilesetImg, furn, { x: px, y: py }, cs);
    }

    // 3. Front (South) Wall Facade, Doorstep, Yard Fences & Outdoor Campfire
    this.renderHouseFront(ctx, tilesetImg, house, opt);

    // Dynamic Night Lighting Radial Bloom (Spread radius set to 15% of original)
    if (options?.showLights ?? true) {
      ctx.save();
      for (const light of house.lights) {
        const lx = px + light.relX * cs;
        const ly = py + light.relY * cs;
        // Scaled to exactly 15% of original spread radius
        const radius = Math.max(2, cs * (light.radius ?? 2.8) * 0.15);

        const grad = ctx.createRadialGradient(lx, ly, 1, lx, ly, radius);
        grad.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
        grad.addColorStop(0.4, 'rgba(251, 191, 36, 0.18)');
        grad.addColorStop(1, 'rgba(245, 158, 11, 0.0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(lx, ly, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /**
   * Layer A: House Foundation, Interior Floors, Rugs, and Back North Walls.
   * Rendered at yOrder = wy (ground level), BEFORE any interior entity/player.
   */
  public renderHouseBase(
    ctx: CanvasRenderingContext2D,
    tilesetImg: CanvasImageSource,
    house: ProceduralDetailedHouse,
    options?: {
      cellSize?: number;
      showGrid?: boolean;
      showCollision?: boolean;
      showLights?: boolean;
      pixelOrigin?: { x: number; y: number };
    }
  ): void {
    const cs = options?.cellSize ?? this.cellSize;
    const px = options?.pixelOrigin ? options.pixelOrigin.x : 0;
    const py = options?.pixelOrigin ? options.pixelOrigin.y : 0;

    const hullW = house.hullBounds.w * cs;
    const hullH = house.hullBounds.h * cs;

    // PASS 1: DIRECTIONAL EXTERIOR DROP SHADOW (3D Building Volume)
    ctx.save();
    const southShadowH = cs * 0.65;
    const southShadowGrad = ctx.createLinearGradient(0, py + hullH, 0, py + hullH + southShadowH);
    southShadowGrad.addColorStop(0, 'rgba(8, 16, 12, 0.38)');
    southShadowGrad.addColorStop(0.5, 'rgba(8, 16, 12, 0.18)');
    southShadowGrad.addColorStop(1, 'rgba(8, 16, 12, 0.0)');

    ctx.fillStyle = southShadowGrad;
    ctx.fillRect(px, py + hullH, hullW, southShadowH);

    // Attached yard fence subtle ambient shadow
    if (house.yard) {
      const yb = house.yard.bounds;
      const yardShadowH = cs * 0.35;
      const yardShadowGrad = ctx.createLinearGradient(
        0,
        py + (yb.y + yb.h) * cs,
        0,
        py + (yb.y + yb.h) * cs + yardShadowH
      );
      yardShadowGrad.addColorStop(0, 'rgba(8, 16, 12, 0.22)');
      yardShadowGrad.addColorStop(1, 'rgba(8, 16, 12, 0.0)');
      ctx.fillStyle = yardShadowGrad;
      ctx.fillRect(
        px + yb.x * cs,
        py + (yb.y + yb.h) * cs,
        yb.w * cs,
        yardShadowH
      );
    }
    ctx.restore();

    // PASS 2: BASE TERRAIN & YARD GROUNDS
    if (house.yard) {
      this.renderYardGround(ctx, house.yard, px, py, cs);
    }

    // PASS 3: INTERIOR RECESSED FLOORS & THRESHOLDS (Procedural Pixel Art)
    this.renderRoomFloors(ctx, house, px, py, cs);

    // PASS 4: INTERIOR AMBIENT OCCLUSION & WALL RECESS SHADOWS
    for (const rm of house.rooms) {
      const rx = px + rm.bounds.x * cs;
      const ry = py + rm.bounds.y * cs;
      const rw = rm.bounds.w * cs;
      const rh = rm.bounds.h * cs;

      ctx.save();
      // North Wall Inner Shadow
      const northShadowGrad = ctx.createLinearGradient(rx, ry, rx, ry + cs * 0.75);
      northShadowGrad.addColorStop(0, 'rgba(15, 23, 42, 0.68)');
      northShadowGrad.addColorStop(0.5, 'rgba(15, 23, 42, 0.32)');
      northShadowGrad.addColorStop(1, 'rgba(15, 23, 42, 0.0)');
      ctx.fillStyle = northShadowGrad;
      ctx.fillRect(rx, ry, rw, cs * 0.75);

      // West Wall Inner Shadow
      const westShadowGrad = ctx.createLinearGradient(rx, ry, rx + cs * 0.5, ry);
      westShadowGrad.addColorStop(0, 'rgba(15, 23, 42, 0.50)');
      westShadowGrad.addColorStop(1, 'rgba(15, 23, 42, 0.0)');
      ctx.fillStyle = westShadowGrad;
      ctx.fillRect(rx, ry, cs * 0.5, rh);

      // East Wall Inner Shadow
      const eastShadowGrad = ctx.createLinearGradient(rx + rw, ry, rx + rw - cs * 0.35, ry);
      eastShadowGrad.addColorStop(0, 'rgba(15, 23, 42, 0.38)');
      eastShadowGrad.addColorStop(1, 'rgba(15, 23, 42, 0.0)');
      ctx.fillStyle = eastShadowGrad;
      ctx.fillRect(rx + rw - cs * 0.35, ry, cs * 0.35, rh);

      // 3D Corner Ambient Occlusion (NW & NE tight wall vertex shadows)
      const nwAO = ctx.createRadialGradient(rx, ry, 0, rx, ry, cs * 0.85);
      nwAO.addColorStop(0, 'rgba(15, 23, 42, 0.52)');
      nwAO.addColorStop(1, 'rgba(15, 23, 42, 0.0)');
      ctx.fillStyle = nwAO;
      ctx.fillRect(rx, ry, cs * 0.85, cs * 0.85);

      const neAO = ctx.createRadialGradient(rx + rw, ry, 0, rx + rw, ry, cs * 0.85);
      neAO.addColorStop(0, 'rgba(15, 23, 42, 0.42)');
      neAO.addColorStop(1, 'rgba(15, 23, 42, 0.0)');
      ctx.fillStyle = neAO;
      ctx.fillRect(rx + rw - cs * 0.85, ry, cs * 0.85, cs * 0.85);
      ctx.restore();
    }

    // PASS 5: AREA RUGS & RUNNERS
    this.renderRugs(ctx, house, px, py, cs);

    // PASS 6A: NORTH WALL, SIDE WALLS, AND INTERIOR PARTITION
    this.renderNorthWall(ctx, house, px, py, cs);
    this.renderSideWalls(ctx, house, px, py, cs);
    if (house.rooms.length >= 2) {
      this.renderPartitionWall(ctx, house, px, py, cs);
    }
  }

  /**
   * Layer B: Individual piece of furniture with contact shadow.
   * Y-sorted at its own physical world position: wy + furn.relY + furn.h.
   */
  public renderFurnitureItem(
    ctx: CanvasRenderingContext2D,
    tilesetImg: CanvasImageSource,
    furn: PlacedFurniture,
    originPx: { x: number; y: number },
    cellSize?: number
  ): void {
    const cs = cellSize ?? this.cellSize;
    const fx = originPx.x + furn.relX * cs;
    const fy = originPx.y + furn.relY * cs;
    const fw = furn.w * cs;
    const fh = furn.h * cs;

    // Soft contact shadow directly under object base
    ctx.save();
    ctx.fillStyle = 'rgba(12, 20, 16, 0.42)';
    ctx.beginPath();
    ctx.ellipse(
      fx + fw / 2,
      fy + fh - cs * 0.06,
      fw * 0.44,
      cs * 0.14,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();

    // Render custom 3D furniture
    if (furn.drawType === 'bed_single' || furn.drawType === 'bed_double') {
      this.render3DBed(ctx, fx, fy, fw, fh, furn.drawType === 'bed_double', furn.drawParams?.quiltColor);
    } else if (furn.drawType === 'stove') {
      this.render3DStove(ctx, fx, fy, fw, fh);
    } else if (furn.drawType === 'cellar_ladder') {
      this.render3DCellarLadder(ctx, fx, fy, cs);
    } else if (furn.drawType === 'table_wood') {
      this.render3DTable(ctx, fx, fy, fw, fh);
    } else if (furn.spriteUrl) {
      const propKey = Object.keys(SPRITE_PROPS).find(k => SPRITE_PROPS[k] === furn.spriteUrl);
      const cachedImg = propKey ? this.propsImages[propKey] : null;

      if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
        const scale = Math.min((fw * 1.15) / cachedImg.width, (fh * 1.15) / cachedImg.height);
        const dw = cachedImg.width * scale;
        const dh = cachedImg.height * scale;
        const dx = fx + (fw - dw) / 2;
        const dy = fy + fh - dh;

        ctx.drawImage(cachedImg, dx, dy, dw, dh);
      } else if (furn.type === 'chest') {
        this.render3DChest(ctx, fx, fy, fw, fh);
      } else if (furn.type === 'flower') {
        this.renderPottedFlower(ctx, fx, fy, fw, fh);
      } else if (furn.crop) {
        ctx.drawImage(tilesetImg, furn.crop.x, furn.crop.y, furn.crop.w, furn.crop.h, fx, fy, fw, fh);
      }
    } else if (furn.crop) {
      ctx.drawImage(tilesetImg, furn.crop.x, furn.crop.y, furn.crop.w, furn.crop.h, fx, fy, fw, fh);
    }
  }

  /**
   * Layer C: Front (South) Cutaway Wall, Doorway Portal, Step, and Yard Front.
   * Rendered at yOrder = wy + house.footprintH + 0.05.
   */
  public renderHouseFront(
    ctx: CanvasRenderingContext2D,
    tilesetImg: CanvasImageSource,
    house: ProceduralDetailedHouse,
    options?: {
      cellSize?: number;
      showGrid?: boolean;
      showCollision?: boolean;
      showLights?: boolean;
      pixelOrigin?: { x: number; y: number };
    }
  ): void {
    const cs = options?.cellSize ?? this.cellSize;
    const px = options?.pixelOrigin ? options.pixelOrigin.x : 0;
    const py = options?.pixelOrigin ? options.pixelOrigin.y : 0;

    // Doorstep cobblestone slab outside entrance (2-tile wide grand entrance)
    const doorStepX = px + house.door.x * cs;
    const doorStepY = py + (house.door.y + 1) * cs;
    const stepW = (house.door.w || 2) * cs;

    ctx.save();
    // Drop shadow under stone doorstep
    ctx.fillStyle = 'rgba(10, 18, 14, 0.28)';
    ctx.fillRect(doorStepX + 2, doorStepY + cs * 0.38, stepW - 4, cs * 0.16);

    // Double dressed flagstone doorstep slab
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.roundRect(doorStepX + 2, doorStepY, stepW - 4, cs * 0.42, 3);
    ctx.fill();

    // Top stone bevel highlight
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(doorStepX + 4, doorStepY + 1, stepW - 8, 2.5);

    // Center vertical stone mortar joint dividing the two step stones
    ctx.fillStyle = '#334155';
    ctx.fillRect(doorStepX + stepW * 0.5 - 1, doorStepY + 1, 2, cs * 0.4);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    // PASS 6B: South Wall Low Cutaway Palisade + 3D Front Facade + Portal
    this.renderSouthWallFacade(ctx, house, px, py, cs);

    // PASS 8: Attached Yard Fences, Gates, Crops, Sunflowers, Animals
    if (house.yard) {
      this.renderYardFences(ctx, house, px, py, cs);

      if (house.yard.crops) {
        for (const crop of house.yard.crops) {
          this.render3DCropStalk(ctx, px + crop.x * cs, py + crop.y * cs, cs, crop.cropType);
        }
      }

      const yb = house.yard.bounds;
      const sunY = py + (yb.y + yb.h) * cs;
      for (let sx = yb.x; sx < yb.x + yb.w; sx += 1.4) {
        this.renderSunflower(ctx, px + sx * cs, sunY, cs);
      }
    }

    // PASS 9: Outdoor Campfire
    if (house.campfire) {
      const cfx = px + house.campfire.relX * cs;
      const cfy = py + house.campfire.relY * cs;
      this.renderOutdoorCampfire(ctx, cfx, cfy, cs);
    }
  }

  private renderRugs(
    ctx: CanvasRenderingContext2D,
    house: ProceduralDetailedHouse,
    px: number,
    py: number,
    cs: number
  ): void {
    for (const furn of house.furniture) {
      if (furn.drawType === 'rug') {
        const rx = px + furn.relX * cs;
        const ry = py + furn.relY * cs;
        const rw = furn.w * cs;
        const rh = furn.h * cs;

        ctx.save();
        if (furn.drawParams?.style === 'runner') {
          // Blue diamond ornate runner rug
          ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
          ctx.beginPath();
          ctx.roundRect(rx + 2, ry + 2, rw - 4, rh - 4, 3);
          ctx.fill();

          ctx.fillStyle = '#1e3a8a';
          ctx.beginPath();
          ctx.roundRect(rx + 3, ry + 4, rw - 6, rh - 8, 3);
          ctx.fill();

          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = Math.max(1.5, cs * 0.04);
          ctx.stroke();

          ctx.fillStyle = '#60a5fa';
          const count = Math.max(2, Math.floor(rh / (cs * 0.6)));
          const stepY = (rh - 16) / count;
          for (let i = 0; i < count; i++) {
            const cy = ry + 8 + i * stepY + stepY / 2;
            const cx = rx + rw / 2;
            const size = cs * 0.16;
            ctx.beginPath();
            ctx.moveTo(cx, cy - size);
            ctx.lineTo(cx + size, cy);
            ctx.lineTo(cx, cy + size);
            ctx.lineTo(cx - size, cy);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
            ctx.fillStyle = '#60a5fa';
          }

          ctx.fillStyle = '#f8fafc';
          const fringeCount = Math.floor((rw - 8) / 4);
          for (let f = 0; f < fringeCount; f++) {
            const fx = rx + 5 + f * 4;
            ctx.fillRect(fx, ry + 2, 2, 3);
            ctx.fillRect(fx, ry + rh - 5, 2, 3);
          }
        } else {
          // Cozy Bedroom Hearth Rug
          ctx.fillStyle = 'rgba(15, 23, 42, 0.3)';
          ctx.beginPath();
          ctx.roundRect(rx + 3, ry + 3, rw - 6, rh - 6, cs * 0.35);
          ctx.fill();

          ctx.fillStyle = furn.drawParams?.color ?? '#be123c';
          ctx.beginPath();
          ctx.roundRect(rx + 4, ry + 4, rw - 8, rh - 8, cs * 0.35);
          ctx.fill();

          ctx.strokeStyle = '#fb7185';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  // ═════════════════════════════════════════════════════════════════
  // PROCEDURAL FLOOR RENDERING (Warm Oak Planks, Flagstones, Parquet)
  // ═════════════════════════════════════════════════════════════════
  private renderRoomFloors(
    ctx: CanvasRenderingContext2D,
    house: ProceduralDetailedHouse,
    px: number,
    py: number,
    cs: number
  ): void {
    ctx.save();

    for (const rm of house.rooms) {
      const isStone = rm.floorType === 'flagstone';
      const isParquet = rm.floorType === 'wood_parquet';

      for (let y = rm.bounds.y; y < rm.bounds.y + rm.bounds.h; y++) {
        for (let x = rm.bounds.x; x < rm.bounds.x + rm.bounds.w; x++) {
          const fx = px + x * cs;
          const fy = py + y * cs;

          if (isStone) {
            this.renderSingleFlagstoneCell(ctx, fx, fy, cs, x, y);
          } else if (isParquet) {
            this.renderSingleParquetCell(ctx, fx, fy, cs, x, y);
          } else {
            this.renderSingleWoodPlankCell(ctx, fx, fy, cs, x, y);
          }
        }
      }
    }

    // Interior Doorway Floor Threshold between rooms (2 tiles high)
    if (house.rooms.length >= 2) {
      const partX = house.rooms[0].bounds.x + house.rooms[0].bounds.w;
      const partDoorY = Math.max(3, Math.min(house.hullBounds.h - 4, Math.floor(house.hullBounds.h * 0.45)));
      const dx = px + partX * cs;
      const dy = py + partDoorY * cs;
      const dh = 2 * cs;

      // Heavy timber transition threshold curb separating wood from stone/parquet
      ctx.fillStyle = '#54260a';
      ctx.fillRect(dx, dy, cs, dh);

      // Horizontal wood grain highlights
      ctx.fillStyle = '#7a3b13';
      ctx.fillRect(dx, dy + 2, cs, dh * 0.35);
      ctx.fillStyle = '#3a1705';
      ctx.fillRect(dx, dy + dh - 3, cs, 3);

      // Recessed mortar seam on flagstone side
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(dx + cs - 2, dy, 2, dh);

      // Polished brass studs along the partition divider
      ctx.fillStyle = '#f59e0b';
      for (let s = 0; s < 4; s++) {
        const sy = dy + (s + 0.5) * (dh / 4);
        ctx.fillRect(dx + 3, sy - 1.5, 3, 3);
        ctx.fillRect(dx + cs - 6, sy - 1.5, 3, 3);
      }
    }

    // Main Entrance Door Sill / Welcome Threshold (2 tiles wide, Layer A ground)
    const doorW = (house.door.w || 2);
    const ex = px + house.door.x * cs;
    const ey = py + house.door.y * cs;
    const ew = doorW * cs;

    // Heavy timber sill foundation beam
    ctx.fillStyle = '#421d07';
    ctx.fillRect(ex, ey, ew, cs);

    // Warm polished wood bevel
    ctx.fillStyle = '#7a3814';
    ctx.fillRect(ex + 2, ey + 2, ew - 4, cs * 0.35);

    // Inlaid decorative woven coir welcome mat in the center
    const matX = ex + 4;
    const matY = ey + cs * 0.22;
    const matW = ew - 8;
    const matH = cs * 0.68;

    ctx.fillStyle = '#854d0e';
    ctx.fillRect(matX, matY, matW, matH);

    // Woven coir texture ribs
    ctx.fillStyle = '#a16207';
    for (let rx = matX + 4; rx < matX + matW - 4; rx += 6) {
      ctx.fillRect(rx, matY + 2, 2.5, matH - 4);
    }

    // Dark braided border around mat
    ctx.strokeStyle = '#3e1a05';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(matX, matY, matW, matH);

    // Polished brass threshold plate & corner studs
    ctx.fillStyle = '#f59e0b';
    for (let b = 0; b < 6; b++) {
      const bx = ex + 6 + (b * (ew - 12)) / 5;
      ctx.fillRect(bx, ey + 2, 2.5, 2.5);
    }

    ctx.restore();
  }

  /**
   * Warm Honey Oak Vertical Floorboards (Necesse Reference Images 1 & 2)
   */
  private renderSingleWoodPlankCell(
    ctx: CanvasRenderingContext2D,
    fx: number,
    fy: number,
    cs: number,
    x: number,
    y: number
  ): void {
    // 4 vertical planks per cell
    const planks = 4;
    const pw = cs / planks;

    const baseShades = ['#7c441b', '#8a4d20', '#955424', '#753e17'];

    for (let p = 0; p < planks; p++) {
      const plankX = fx + p * pw;
      const hash = Math.abs(Math.sin((x * planks + p) * 12.9898 + y * 78.233) * 43758.5453);
      const shadeIndex = Math.floor(hash * baseShades.length) % baseShades.length;

      // Plank body
      ctx.fillStyle = baseShades[shadeIndex];
      ctx.fillRect(plankX, fy, pw, cs);

      // Left highlight line (gives 3D bevel to each board)
      ctx.fillStyle = '#a8622c';
      ctx.fillRect(plankX, fy, 1.2, cs);

      // Right shadow groove (dark recessed seam)
      ctx.fillStyle = '#451d08';
      ctx.fillRect(plankX + pw - 1.2, fy, 1.2, cs);

      // Horizontal staggered butt seam every ~2 cells
      const hasHorizontalSeam = (y + p) % 2 === 0;
      if (hasHorizontalSeam) {
        const seamY = fy + Math.floor(hash * (cs - 8)) + 4;
        ctx.fillStyle = '#321405';
        ctx.fillRect(plankX, seamY, pw, 1.5);

        // Fine iron nailhead dots
        ctx.fillStyle = '#200b02';
        ctx.fillRect(plankX + pw * 0.25, seamY - 1, 2, 2);
        ctx.fillRect(plankX + pw * 0.75, seamY - 1, 2, 2);
      }
    }
  }

  /**
   * Chiseled Grey Stone Flagstones (Necesse Cellar & Manor)
   */
  private renderSingleFlagstoneCell(
    ctx: CanvasRenderingContext2D,
    fx: number,
    fy: number,
    cs: number,
    x: number,
    y: number
  ): void {
    // 2x2 rectangular stone pavers per cell
    const rows = 2;
    const cols = 2;
    const rw = cs / cols;
    const rh = cs / rows;

    const stoneColors = ['#475569', '#3f4c5e', '#505f75', '#384454'];

    // Dark mortar background
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(fx, fy, cs, cs);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const sx = fx + c * rw + 1;
        const sy = fy + r * rh + 1;
        const sw = rw - 2;
        const sh = rh - 2;

        const hash = Math.abs(Math.sin((x * cols + c) * 17.13 + (y * rows + r) * 31.5) * 43758.5453);
        const colIdx = Math.floor(hash * stoneColors.length) % stoneColors.length;

        // Paver stone body
        ctx.fillStyle = stoneColors[colIdx];
        ctx.fillRect(sx, sy, sw, sh);

        // Top/left bevel highlight
        ctx.fillStyle = '#64748b';
        ctx.fillRect(sx, sy, sw, 1.2);
        ctx.fillRect(sx, sy, 1.2, sh);

        // Bottom/right shadow
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(sx, sy + sh - 1.2, sw, 1.2);
        ctx.fillRect(sx + sw - 1.2, sy, 1.2, sh);
      }
    }
  }

  /**
   * Luxury Basketweave Parquet Floor (Master Bedroom)
   */
  private renderSingleParquetCell(
    ctx: CanvasRenderingContext2D,
    fx: number,
    fy: number,
    cs: number,
    x: number,
    y: number
  ): void {
    const half = cs / 2;
    // 4 tiles per cell with alternating grain
    const blocks = [
      { x: fx, y: fy, horiz: (x + y) % 2 === 0 },
      { x: fx + half, y: fy, horiz: (x + y) % 2 !== 0 },
      { x: fx, y: fy + half, horiz: (x + y) % 2 !== 0 },
      { x: fx + half, y: fy + half, horiz: (x + y) % 2 === 0 },
    ];

    for (const b of blocks) {
      ctx.fillStyle = '#5a2c11';
      ctx.fillRect(b.x, b.y, half, half);

      if (b.horiz) {
        // Horizontal planks
        const ph = half / 2;
        ctx.fillStyle = '#6e3616';
        ctx.fillRect(b.x + 1, b.y + 1, half - 2, ph - 1.5);
        ctx.fillRect(b.x + 1, b.y + ph + 0.5, half - 2, ph - 1.5);
        ctx.fillStyle = '#8a461e';
        ctx.fillRect(b.x + 1, b.y + 1, half - 2, 1);
      } else {
        // Vertical planks
        const pw = half / 2;
        ctx.fillStyle = '#6e3616';
        ctx.fillRect(b.x + 1, b.y + 1, pw - 1.5, half - 2);
        ctx.fillRect(b.x + pw + 0.5, b.y + 1, pw - 1.5, half - 2);
        ctx.fillStyle = '#8a461e';
        ctx.fillRect(b.x + 1, b.y + 1, 1, half - 2);
      }

      ctx.strokeStyle = '#381604';
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x, b.y, half, half);
    }
  }

  // ═════════════════════════════════════════════════════════════════
  // 2.5D CUTAWAY WALLS & 3D VERTICAL FACADES
  // ═════════════════════════════════════════════════════════════════

  /**
   * North Wall: Cutaway Top Cap (Row 0) and Vertical Interior Elevation (Row 1)
   */
  private renderNorthWall(
    ctx: CanvasRenderingContext2D,
    house: ProceduralDetailedHouse,
    px: number,
    py: number,
    cs: number
  ): void {
    const isTimber = house.theme === 'timber';
    const mainW = house.hullBounds.w;

    ctx.save();

    // ─────────────────────────────────────────────
    // ROW 0: TOP CUTAWAY CAP (Cut Surface of Wall)
    // ─────────────────────────────────────────────
    for (let x = 0; x < mainW; x++) {
      const wx = px + x * cs;
      const wy = py + 0;

      if (isTimber) {
        // Dark brown timber log cutaway rim
        ctx.fillStyle = '#421d07';
        ctx.fillRect(wx, wy, cs, cs);

        // Top edge bevel highlight
        ctx.fillStyle = '#854117';
        ctx.fillRect(wx, wy, cs, 3);

        // Vertical log end joints
        const logs = 4;
        const lw = cs / logs;
        for (let l = 0; l < logs; l++) {
          const lx = wx + l * lw;
          ctx.fillStyle = '#673010';
          ctx.fillRect(lx + 1, wy + 3, lw - 2, cs - 5);
          // Dark rounded log joint
          ctx.fillStyle = '#260e02';
          ctx.fillRect(lx, wy, 1.5, cs);
        }
      } else {
        // Ashlar slate capstones with light highlight
        ctx.fillStyle = '#334155';
        ctx.fillRect(wx, wy, cs, cs);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(wx, wy, cs, 3); // Chiseled slate top rim
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(wx, wy + cs - 2, cs, 2); // Bottom seam
        ctx.fillRect(wx + cs * 0.5, wy, 1.5, cs); // Mortar joint
      }
    }

    // ─────────────────────────────────────────────
    // ROW 1: INTERIOR VERTICAL ELEVATION WALL FACE
    // ─────────────────────────────────────────────
    for (let x = 0; x < mainW; x++) {
      const wx = px + x * cs;
      const wy = py + 1 * cs;

      if (isTimber) {
        // Vertical Log Palisade Elevation (Necesse Reference Images 1 & 2)
        ctx.fillStyle = '#54270d';
        ctx.fillRect(wx, wy, cs, cs);

        const logs = 4;
        const lw = cs / logs;
        for (let l = 0; l < logs; l++) {
          const lx = wx + l * lw;
          // Left highlight on log cylinder
          ctx.fillStyle = '#7a3814';
          ctx.fillRect(lx, wy, 2, cs);
          // Main log body
          ctx.fillStyle = '#612c0e';
          ctx.fillRect(lx + 2, wy, lw - 3, cs);
          // Right shadow groove
          ctx.fillStyle = '#2a1003';
          ctx.fillRect(lx + lw - 1.5, wy, 1.5, cs);
        }

        // Ambient darkening towards bottom
        const wallGrad = ctx.createLinearGradient(wx, wy, wx, wy + cs);
        wallGrad.addColorStop(0, 'rgba(0,0,0,0.0)');
        wallGrad.addColorStop(1, 'rgba(0,0,0,0.45)');
        ctx.fillStyle = wallGrad;
        ctx.fillRect(wx, wy, cs, cs);

        // Heavy dark wood baseboard moulding (sitting on top of floor)
        ctx.fillStyle = '#240d02';
        ctx.fillRect(wx, wy + cs - 3.5, cs, 3.5);
        ctx.fillStyle = '#612c0e';
        ctx.fillRect(wx, wy + cs - 3.5, cs, 1);

        // Window (place at columns 2 or mainW - 3 if room allows)
        const hasWindow = (x === 2 || (x === mainW - 3 && mainW >= 8));
        if (hasWindow) {
          this.renderWallWindow(ctx, wx + cs * 0.2, wy + cs * 0.15, cs * 0.6, cs * 0.65);
        }
      } else {
        // Ashlar Stone Masonry Wall Elevation (Necesse Reference Image 3 Right)
        ctx.fillStyle = '#475569';
        ctx.fillRect(wx, wy, cs, cs);

        // Staggered stone blocks in running bond
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(wx, wy + cs * 0.48, cs, 2); // Horizontal mortar
        ctx.fillRect(wx + cs * 0.5, wy, 2, cs * 0.48); // Vertical seam row 1
        ctx.fillRect(wx + cs * 0.25, wy + cs * 0.48, 2, cs * 0.52); // Vertical seam row 2
        ctx.fillRect(wx + cs * 0.75, wy + cs * 0.48, 2, cs * 0.52);

        // Ambient darkening
        const stoneGrad = ctx.createLinearGradient(wx, wy, wx, wy + cs);
        stoneGrad.addColorStop(0, 'rgba(0,0,0,0.0)');
        stoneGrad.addColorStop(1, 'rgba(0,0,0,0.4)');
        ctx.fillStyle = stoneGrad;
        ctx.fillRect(wx, wy, cs, cs);

        // Stone baseboard plinth
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(wx, wy + cs - 3.5, cs, 3.5);
      }

      // Mounted Wall Sconces with glowing candles (mounted on North wall at row 1)
      const hasSconce = (x === 1 || x === Math.floor(mainW / 2) || x === mainW - 2);
      if (hasSconce) {
        this.renderWallSconce(ctx, wx + cs * 0.5, wy + cs * 0.45, cs);
      }
    }

    ctx.restore();
  }

  /**
   * Side Walls (West & East Cutaway Profiles)
   */
  private renderSideWalls(
    ctx: CanvasRenderingContext2D,
    house: ProceduralDetailedHouse,
    px: number,
    py: number,
    cs: number
  ): void {
    const isTimber = house.theme === 'timber';
    const mainW = house.hullBounds.w;
    const mainH = house.hullBounds.h;

    ctx.save();

    for (let y = 1; y < mainH - 1; y++) {
      // West Side Wall (x = 0)
      const wxL = px + 0;
      const wyL = py + y * cs;

      // East Side Wall (x = mainW - 1)
      const wxR = px + (mainW - 1) * cs;
      const wyR = py + y * cs;

      if (isTimber) {
        // West Wall Cutaway (Vertical logs matching North & South walls)
        ctx.fillStyle = '#421d07';
        ctx.fillRect(wxL, wyL, cs, cs);
        const slats = 4;
        const slatW = cs / slats;
        for (let s = 0; s < slats; s++) {
          const sx = wxL + s * slatW;
          ctx.fillStyle = '#673010';
          ctx.fillRect(sx + 1, wyL, slatW - 2, cs);
          ctx.fillStyle = '#854117';
          ctx.fillRect(sx + 1, wyL, 1.5, cs);
          ctx.fillStyle = '#260e02';
          ctx.fillRect(sx + slatW - 1.5, wyL, 1.5, cs);
        }
        // Inner ambient shadow seam
        ctx.fillStyle = '#1e0a01';
        ctx.fillRect(wxL + cs - 2.5, wyL, 2.5, cs);

        // East Wall Cutaway (Vertical logs)
        ctx.fillStyle = '#421d07';
        ctx.fillRect(wxR, wyR, cs, cs);
        for (let s = 0; s < slats; s++) {
          const sx = wxR + s * slatW;
          ctx.fillStyle = '#673010';
          ctx.fillRect(sx + 1, wyR, slatW - 2, cs);
          ctx.fillStyle = '#854117';
          ctx.fillRect(sx + 1, wyR, 1.5, cs);
          ctx.fillStyle = '#260e02';
          ctx.fillRect(sx + slatW - 1.5, wyR, 1.5, cs);
        }
        // Inner ambient shadow seam
        ctx.fillStyle = '#1e0a01';
        ctx.fillRect(wxR, wyR, 2.5, cs);
      } else {
        // Stone West (Ashlar stone blocks in running bond)
        ctx.fillStyle = '#475569';
        ctx.fillRect(wxL, wyL, cs, cs);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(wxL, wyL + cs * 0.48, cs, 2);
        ctx.fillRect(wxL + cs * 0.5, wyL, 2, cs * 0.48);
        ctx.fillRect(wxL + (y % 2 === 0 ? cs * 0.25 : cs * 0.75), wyL + cs * 0.48, 2, cs * 0.52);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(wxL + 1, wyL, 2, cs);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(wxL + cs - 2, wyL, 2, cs);

        // Stone East
        ctx.fillStyle = '#475569';
        ctx.fillRect(wxR, wyR, cs, cs);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(wxR, wyR + cs * 0.48, cs, 2);
        ctx.fillRect(wxR + cs * 0.5, wyR, 2, cs * 0.48);
        ctx.fillRect(wxR + (y % 2 === 0 ? cs * 0.25 : cs * 0.75), wyR + cs * 0.48, 2, cs * 0.52);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(wxR, wyR, 2, cs);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(wxR + cs - 3, wyR, 2, cs);
      }
    }

    ctx.restore();
  }

  /**
   * Interior Partition Wall & Clean Doorway Cutout
   */
  private renderPartitionWall(
    ctx: CanvasRenderingContext2D,
    house: ProceduralDetailedHouse,
    px: number,
    py: number,
    cs: number
  ): void {
    const isTimber = house.theme === 'timber';
    const mainH = house.hullBounds.h;
    const partX = house.rooms[0].bounds.x + house.rooms[0].bounds.w;
    const partDoorY = Math.max(3, Math.min(mainH - 4, Math.floor(mainH * 0.45)));

    ctx.save();

    for (let y = 1; y < mainH - 1; y++) {
      const wx = px + partX * cs;
      const wy = py + y * cs;

      if (y === partDoorY || y === partDoorY + 1) {
        // Clean 2-Tile High Interior Doorway Portal
        // Doorframe jamb posts on left and right edges
        ctx.fillStyle = '#240d02';
        ctx.fillRect(wx, wy, 4, cs);
        ctx.fillRect(wx + cs - 4, wy, 4, cs);

        // Jamb highlights
        ctx.fillStyle = '#854117';
        ctx.fillRect(wx + 1, wy, 1.5, cs);
        ctx.fillRect(wx + cs - 2.5, wy, 1.5, cs);

        // Lintel bracket at the top of partDoorY
        if (y === partDoorY) {
          ctx.fillStyle = '#1e0a01';
          ctx.fillRect(wx, wy, cs, 3);
        }
      } else {
        // Solid vertical dividing wall
        if (isTimber) {
          ctx.fillStyle = '#421d07';
          ctx.fillRect(wx, wy, cs, cs);
          const slats = 4;
          const slatW = cs / slats;
          for (let s = 0; s < slats; s++) {
            const sx = wx + s * slatW;
            ctx.fillStyle = '#673010';
            ctx.fillRect(sx + 1, wy, slatW - 2, cs);
            ctx.fillStyle = '#854117';
            ctx.fillRect(sx + 1, wy, 1.5, cs);
            ctx.fillStyle = '#260e02';
            ctx.fillRect(sx + slatW - 1.5, wy, 1.5, cs);
          }
          // Ambient shadow lines on both sides
          ctx.fillStyle = '#1e0a01';
          ctx.fillRect(wx, wy, 2, cs);
          ctx.fillRect(wx + cs - 2, wy, 2, cs);
        } else {
          ctx.fillStyle = '#475569';
          ctx.fillRect(wx, wy, cs, cs);
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(wx, wy + cs * 0.48, cs, 2);
          ctx.fillRect(wx + cs * 0.5, wy, 2, cs * 0.48);
          ctx.fillRect(wx + (y % 2 === 0 ? cs * 0.25 : cs * 0.75), wy + cs * 0.48, 2, cs * 0.52);
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(wx + 2, wy, cs - 4, 2);
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(wx, wy, 2, cs);
          ctx.fillRect(wx + cs - 2, wy, 2, cs);
        }
      }
    }

    ctx.restore();
  }

  /**
   * 3D South Wall (Front Cutaway Palisade + 3D Facade + Entrance)
   */
  private renderSouthWallFacade(
    ctx: CanvasRenderingContext2D,
    house: ProceduralDetailedHouse,
    px: number,
    py: number,
    cs: number
  ): void {
    const mainW = house.hullBounds.w;
    const southY = py + (house.hullBounds.h - 1) * cs;
    const isTimber = house.theme === 'timber';
    const doorX = house.door.x;
    const doorW = house.door.w || 2;

    ctx.save();

    for (let x = 0; x < mainW; x++) {
      const wx = px + x * cs;
      const isDoorCol = x >= doorX && x < doorX + doorW;

      if (isDoorCol) {
        // 2-Tile Wide Grand Entrance Portal (Foreground Wall Frame)
        // CRITICAL: The walkable interior threshold floor was drawn in Layer A.
        // In this foreground pass, we ONLY render the outer jamb posts and overhead corbels,
        // leaving the entire central door passage (1.68 tiles wide) completely clear
        // so the player/NPC walking through is 100% visible and NEVER hidden!
        if (x === doorX) {
          // Left Door Jamb Post
          ctx.fillStyle = '#240d02';
          ctx.fillRect(wx, southY, cs * 0.16, cs);

          // Left Jamb Post Highlight & Iron Bolt
          ctx.fillStyle = '#673010';
          ctx.fillRect(wx, southY, cs * 0.16, 2.5);
          ctx.fillStyle = '#854117';
          ctx.fillRect(wx + 1, southY + 2.5, 1.5, cs - 3);

          // Upper Left Lintel Corbel Bracket
          ctx.fillStyle = '#3a1705';
          ctx.beginPath();
          ctx.moveTo(wx + cs * 0.16, southY);
          ctx.lineTo(wx + cs * 0.32, southY);
          ctx.lineTo(wx + cs * 0.16, southY + cs * 0.22);
          ctx.closePath();
          ctx.fill();
        } else if (x === doorX + doorW - 1) {
          // Right Door Jamb Post
          const rpx = wx + cs * 0.84;
          ctx.fillStyle = '#240d02';
          ctx.fillRect(rpx, southY, cs * 0.16, cs);

          // Right Jamb Post Highlight
          ctx.fillStyle = '#673010';
          ctx.fillRect(rpx, southY, cs * 0.16, 2.5);
          ctx.fillStyle = '#854117';
          ctx.fillRect(rpx + 1, southY + 2.5, 1.5, cs - 3);

          // Upper Right Lintel Corbel Bracket
          ctx.fillStyle = '#3a1705';
          ctx.beginPath();
          ctx.moveTo(wx + cs * 0.84, southY);
          ctx.lineTo(wx + cs * 0.68, southY);
          ctx.lineTo(wx + cs * 0.84, southY + cs * 0.22);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        // Vertical Log Palisade or Dressed Ashlar Stone Wall with 3D Cutaway Top Cap
        if (isTimber) {
          // 1. 3D Cutaway Top Cap (Horizontal cut log cross-section)
          ctx.fillStyle = '#421d07';
          ctx.fillRect(wx, southY, cs, cs * 0.35);
          ctx.fillStyle = '#854117';
          ctx.fillRect(wx, southY, cs, 2.5); // Top edge highlight
          ctx.fillStyle = '#260e02';
          ctx.fillRect(wx, southY + cs * 0.35 - 1.5, cs, 1.5); // Cap bottom seam

          // 2. Vertical Timber Wall Facade (Elevation facing South)
          ctx.fillStyle = '#612c0e';
          ctx.fillRect(wx, southY + cs * 0.35, cs, cs * 0.65);

          const slats = 4;
          const slatW = cs / slats;
          for (let s = 0; s < slats; s++) {
            const sx = wx + s * slatW;
            // Left highlight on log
            ctx.fillStyle = '#7a3814';
            ctx.fillRect(sx, southY + cs * 0.35, 1.8, cs * 0.65);
            // Right shadow groove on log
            ctx.fillStyle = '#2a1003';
            ctx.fillRect(sx + slatW - 1.6, southY + cs * 0.35, 1.6, cs * 0.65);
            // Log end grain oval on top cap
            ctx.fillStyle = '#673010';
            ctx.beginPath();
            ctx.ellipse(sx + slatW * 0.5, southY + cs * 0.18, slatW * 0.38, cs * 0.12, 0, 0, Math.PI * 2);
            ctx.fill();
          }

          // Ground contact shadow under south wall
          ctx.fillStyle = 'rgba(8, 16, 12, 0.35)';
          ctx.fillRect(wx, southY + cs - 2, cs, 2);
        } else {
          // Ashlar Grey Stone Masonry Blocks with 3D Cutaway Slate Cap
          ctx.fillStyle = '#334155';
          ctx.fillRect(wx, southY, cs, cs * 0.35);
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(wx, southY, cs, 2.5); // Slate top bevel

          // Vertical Stone Masonry Elevation Face
          ctx.fillStyle = '#475569';
          ctx.fillRect(wx, southY + cs * 0.35, cs, cs * 0.65);

          // Horizontal mortar joints
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(wx, southY + cs * 0.68, cs, 2);

          // Staggered stone seams
          ctx.fillRect(wx + cs * 0.5, southY + cs * 0.35, 2, cs * 0.33);
          ctx.fillRect(wx + cs * 0.25, southY + cs * 0.68, 2, cs * 0.32);
          ctx.fillRect(wx + cs * 0.75, southY + cs * 0.68, 2, cs * 0.32);

          // Ground contact shadow
          ctx.fillStyle = 'rgba(8, 16, 12, 0.4)';
          ctx.fillRect(wx, southY + cs - 2, cs, 2);
        }
      }
    }

    ctx.restore();
  }

  // ═════════════════════════════════════════════════════════════════
  // HIGH-DETAIL 3D FURNITURE & ACCENTS (Necesse Reference Standards)
  // ═════════════════════════════════════════════════════════════════

  /**
   * 3D Master Double Bed with Carved Headboard, Pillows, Bedposts & Folded Quilt
   */
  private render3DBed(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    isDouble: boolean,
    quiltColor: string = '#b91c1c'
  ): void {
    ctx.save();

    // 1. Heavy Wooden Bed Frame (Dark Walnut)
    ctx.fillStyle = '#4a2007';
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 3);
    ctx.fill();

    // 2. High 3D Carved Headboard (Flush against North Wall)
    ctx.fillStyle = '#331403';
    ctx.fillRect(x + 2, y + 2, w - 4, h * 0.26);

    // Headboard top rim highlight moulding
    ctx.fillStyle = '#783812';
    ctx.fillRect(x + 2, y + 2, w - 4, 3.5);

    // 3. Crisp White Bed Sheets & Pillows
    ctx.fillStyle = '#f8fafc';
    if (isDouble) {
      const pw = (w - 14) / 2;
      // Left pillow
      ctx.beginPath();
      ctx.roundRect(x + 4, y + h * 0.18, pw, h * 0.22, 3);
      ctx.fill();
      // Right pillow
      ctx.beginPath();
      ctx.roundRect(x + 8 + pw, y + h * 0.18, pw, h * 0.22, 3);
      ctx.fill();

      // Pillow crease shadows
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(x + 5, y + h * 0.36, pw - 2, 2);
      ctx.fillRect(x + 9 + pw, y + h * 0.36, pw - 2, 2);
    } else {
      ctx.beginPath();
      ctx.roundRect(x + 4, y + h * 0.18, w - 8, h * 0.22, 3);
      ctx.fill();
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(x + 5, y + h * 0.36, w - 10, 2);
    }

    // 4. Folded Quilt / Blanket with 3D Depth
    ctx.fillStyle = quiltColor;
    ctx.beginPath();
    ctx.roundRect(x + 3, y + h * 0.42, w - 6, h * 0.54, 2);
    ctx.fill();

    // Folded top white sheet cuff
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(x + 3, y + h * 0.42, w - 6, 3.5);

    // Quilt side shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(x + w - 6, y + h * 0.42, 3, h * 0.54);

    // 5. 3D Turned Bedposts standing upright with Finials
    ctx.fillStyle = '#240d02';
    ctx.fillRect(x, y + h - 7, 5, 7);
    ctx.fillRect(x + w - 5, y + h - 7, 5, 7);
    // Spherical Finial Cap
    ctx.fillStyle = '#854117';
    ctx.fillRect(x, y + h - 9, 5, 3);
    ctx.fillRect(x + w - 5, y + h - 9, 5, 3);

    ctx.restore();
  }

  /**
   * 3D Cast Iron Cook Stove with Firebox, Tea Kettle & Chimney Pipe
   */
  private render3DStove(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    ctx.save();

    // Heavy Cast Iron Stove Body
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(x + 3, y + 3, w - 6, h - 6, 3);
    ctx.fill();

    // Cooktop Bevel Highlight
    ctx.fillStyle = '#334155';
    ctx.fillRect(x + 4, y + 4, w - 8, 3);

    // Burner Rings
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(x + w * 0.35, y + h * 0.3, w * 0.16, 0, Math.PI * 2);
    ctx.arc(x + w * 0.65, y + h * 0.3, w * 0.16, 0, Math.PI * 2);
    ctx.fill();

    // Brass Tea Kettle sitting on burner
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.arc(x + w * 0.35, y + h * 0.28, w * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#78350f';
    ctx.fillRect(x + w * 0.32, y + h * 0.18, 3, 3); // Handle

    // Glowing Firebox Window (Radiant Orange Flame)
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.roundRect(x + 6, y + h * 0.55, w - 12, h * 0.32, 2);
    ctx.fill();

    ctx.fillStyle = '#fef08a';
    ctx.fillRect(x + 8, y + h * 0.65, w - 16, h * 0.14);

    // Stovepipe Exhaust Chimney rising up into North Wall ceiling
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x + w * 0.42, y - 6, w * 0.16, 10);
    ctx.fillStyle = '#334155';
    ctx.fillRect(x + w * 0.42, y - 6, 2, 10);

    ctx.restore();
  }

  /**
   * 3D Subterranean Cellar Ladder (Necesse Signature Feature)
   */
  private render3DCellarLadder(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    cs: number
  ): void {
    ctx.save();

    // Chiseled Stone Shaft Frame
    ctx.fillStyle = '#334155';
    ctx.fillRect(x, y, cs, cs);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(x + 1, y + 1, cs - 2, 2.5); // Top highlight

    // Pitch-black underground abyss opening
    ctx.fillStyle = '#050811';
    ctx.fillRect(x + 4, y + 4, cs - 8, cs - 8);

    // Inner shadow vignette inside shaft
    const vigGrad = ctx.createRadialGradient(
      x + cs * 0.5,
      y + cs * 0.5,
      cs * 0.15,
      x + cs * 0.5,
      y + cs * 0.5,
      cs * 0.45
    );
    vigGrad.addColorStop(0, 'rgba(0,0,0,0.0)');
    vigGrad.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = vigGrad;
    ctx.fillRect(x + 4, y + 4, cs - 8, cs - 8);

    // Sturdy Wooden Ladder descending into dungeon
    const rungs = 5;
    for (let i = 0; i < rungs; i++) {
      const ry = y + 6 + (i * (cs - 12)) / (rungs - 1);
      // Rung top highlight
      ctx.fillStyle = '#b45309';
      ctx.fillRect(x + 7, ry, cs - 14, 2.5);
      // Rung underside shadow
      ctx.fillStyle = '#351403';
      ctx.fillRect(x + 7, ry + 2, cs - 14, 1.5);
    }

    // Wooden Ladder Side Rails
    ctx.fillStyle = '#5c2a0d';
    ctx.fillRect(x + 6, y + 4, 3, cs - 8);
    ctx.fillRect(x + cs - 9, y + 4, 3, cs - 8);
    ctx.fillStyle = '#854117';
    ctx.fillRect(x + 6, y + 4, 1, cs - 8);
    ctx.fillRect(x + cs - 9, y + 4, 1, cs - 8);

    ctx.restore();
  }

  /**
   * 3D Wood Dining Table with Planks, Bevels & Sturdy Legs
   */
  private render3DTable(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    ctx.save();

    // Tabletop body
    ctx.fillStyle = '#82491e';
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 3);
    ctx.fill();

    // Tabletop horizontal plank grooves
    ctx.fillStyle = '#4a240c';
    ctx.fillRect(x + 3, y + h * 0.48, w - 6, 1.5);

    // Top Surface Highlight
    ctx.fillStyle = '#a05a27';
    ctx.fillRect(x + 3, y + 2, w - 6, 2.5);

    // Sturdy Table Legs with Shading
    ctx.fillStyle = '#3d1a07';
    ctx.fillRect(x + 3, y + h - 5, 4, 4);
    ctx.fillRect(x + w - 7, y + h - 5, 4, 4);

    ctx.restore();
  }

  /**
   * 3D Oak Storage Chest with Brass Straps & Latch
   */
  private render3DChest(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    ctx.save();
    // Chest Body
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.roundRect(x + 3, y + 4, w - 6, h - 7, 2);
    ctx.fill();

    // Lid Highlight
    ctx.fillStyle = '#a16207';
    ctx.fillRect(x + 3, y + 4, w - 6, 3);

    // Iron / Brass Corner Straps
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x + 4, y + 4, 3, h - 7);
    ctx.fillRect(x + w - 7, y + 4, 3, h - 7);

    // Keyhole Latch
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(x + w * 0.5 - 2, y + h * 0.45, 4, 4);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x + w * 0.5 - 1, y + h * 0.45 + 1, 2, 2);

    ctx.restore();
  }

  /**
   * Potted House Plant
   */
  private renderPottedFlower(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    ctx.save();
    // Terracotta Pot
    ctx.fillStyle = '#c2410c';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.25, y + h * 0.55);
    ctx.lineTo(x + w * 0.75, y + h * 0.55);
    ctx.lineTo(x + w * 0.65, y + h * 0.9);
    ctx.lineTo(x + w * 0.35, y + h * 0.9);
    ctx.closePath();
    ctx.fill();

    // Green Stems & Leaves
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.arc(x + w * 0.5, y + h * 0.4, w * 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Red Blossom
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(x + w * 0.5, y + h * 0.28, w * 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Yellow Center
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(x + w * 0.5 - 1.5, y + h * 0.28 - 1.5, 3, 3);

    ctx.restore();
  }

  /**
   * Authentic Pixel-Art Wall Sconce with Glowing Candle
   */
  private renderWallSconce(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    cs: number
  ): void {
    ctx.save();

    // Black Wrought Iron Wall Bracket
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(sx - 3, sy - 2, 6, 8);
    ctx.fillRect(sx - 1, sy + 6, 2, 4);

    // Brass Candle Cup
    ctx.fillStyle = '#d97706';
    ctx.fillRect(sx - 4, sy - 4, 8, 2.5);

    // White Wax Candle Stem
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(sx - 2, sy - 10, 4, 6);

    // Teardrop Golden Candle Flame
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.ellipse(sx, sy - 13, 2.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // White-Hot Flame Core
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(sx - 1, sy - 14, 2, 2);

    ctx.restore();
  }

  /**
   * Wooden Mullioned Window on North Wall
   */
  private renderWallWindow(
    ctx: CanvasRenderingContext2D,
    wx: number,
    wy: number,
    ww: number,
    wh: number
  ): void {
    ctx.save();
    // Wood Window Casing
    ctx.fillStyle = '#3a1805';
    ctx.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);

    // Sky-Blue Glass Pane
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(wx, wy, ww, wh);

    // Diagonal Glass Highlight Streak
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.moveTo(wx + 3, wy);
    ctx.lineTo(wx + ww * 0.5, wy);
    ctx.lineTo(wx, wy + wh * 0.5);
    ctx.closePath();
    ctx.fill();

    // Dark Wooden Crossbars
    ctx.fillStyle = '#3a1805';
    ctx.fillRect(wx, wy + wh * 0.5 - 1, ww, 2);
    ctx.fillRect(wx + ww * 0.5 - 1, wy, 2, wh);

    ctx.restore();
  }

  // ═════════════════════════════════════════════════════════════════
  // YARD GROUNDS, FENCES, CROPS & SUNFLOWERS
  // ═════════════════════════════════════════════════════════════════

  private renderYardGround(
    ctx: CanvasRenderingContext2D,
    yard: { bounds: { x: number; y: number; w: number; h: number }; type: string },
    px: number,
    py: number,
    cs: number
  ): void {
    const yb = yard.bounds;
    const isGarden = yard.type === 'crop_garden';

    ctx.save();

    for (let y = yb.y; y < yb.y + yb.h; y++) {
      for (let x = yb.x; x < yb.x + yb.w; x++) {
        const gx = px + x * cs;
        const gy = py + y * cs;

        if (isGarden) {
          // Dedicated tilled soil texture
          if (this.soilImg && this.soilImg.complete && this.soilImg.naturalWidth > 0) {
            ctx.drawImage(this.soilImg, gx, gy, cs, cs);
          } else {
            // Dark Rich Tilled Garden Soil fallback
            ctx.fillStyle = '#382010';
            ctx.fillRect(gx, gy, cs, cs);
            ctx.fillStyle = '#261408';
            ctx.fillRect(gx, gy + cs * 0.35, cs, 2);
            ctx.fillRect(gx, gy + cs * 0.7, cs, 2);
            ctx.fillStyle = '#4a2c17';
            ctx.fillRect(gx, gy + 2, cs, 2);
          }
        } else {
          // Vibrant Pasture Grass
          ctx.fillStyle = '#15803d';
          ctx.fillRect(gx, gy, cs, cs);
          // Soft grass tufts
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(gx + 4, gy + 6, 2, 4);
          ctx.fillRect(gx + cs - 8, gy + cs - 10, 2, 4);
        }
      }
    }

    ctx.restore();
  }

  private renderYardFences(
    ctx: CanvasRenderingContext2D,
    house: ProceduralDetailedHouse,
    px: number,
    py: number,
    cs: number
  ): void {
    if (!house.yard) return;
    const yb = house.yard.bounds;
    const gate = house.yard.gate;
    ctx.save();

    // Fence rails and posts color palette
    const railColor = '#783812';
    const postColor = '#54260a';
    const postCapColor = '#944b1c';

    // 1. NORTH FENCE: Runs horizontally from yb.x to yb.x + yb.w - 1
    const nY = py + yb.y * cs;
    for (let x = yb.x; x < yb.x + yb.w; x++) {
      const fx = px + x * cs;
      // Rails
      ctx.fillStyle = railColor;
      ctx.fillRect(fx, nY + cs * 0.3, cs, cs * 0.1);
      ctx.fillRect(fx, nY + cs * 0.6, cs, cs * 0.1);

      // Posts at start, end, and alternating tiles
      if (x === yb.x || x === yb.x + yb.w - 1 || (x - yb.x) % 2 === 0) {
        ctx.fillStyle = postColor;
        ctx.fillRect(fx + cs * 0.4, nY + cs * 0.18, cs * 0.2, cs * 0.7);
        ctx.fillStyle = postCapColor;
        ctx.fillRect(fx + cs * 0.4, nY + cs * 0.18, cs * 0.2, 2.5);
      }
    }

    // 2. SOUTH FENCE: Runs horizontally along yb.y + yb.h - 1
    const sY = py + (yb.y + yb.h - 1) * cs;
    for (let x = yb.x; x < yb.x + yb.w; x++) {
      const fx = px + x * cs;
      const isGate = x === gate.x && (yb.y + yb.h - 1) === gate.y;

      if (isGate) {
        // Clean Wooden Yard Gate with Latch
        ctx.fillStyle = '#854117';
        ctx.fillRect(fx + 2, sY + cs * 0.25, cs - 4, cs * 0.5);
        ctx.fillStyle = '#3a1705';
        ctx.fillRect(fx + 2, sY + cs * 0.25, cs - 4, 2.5);
        ctx.fillRect(fx + 2, sY + cs * 0.72, cs - 4, 2.5);
        // Diagonal crossbrace
        ctx.fillRect(fx + cs * 0.48, sY + cs * 0.25, 3, cs * 0.5);
        // Iron Latch
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(fx + cs * 0.75, sY + cs * 0.48, 4, 4);
      } else {
        // Rails
        ctx.fillStyle = railColor;
        ctx.fillRect(fx, sY + cs * 0.3, cs, cs * 0.1);
        ctx.fillRect(fx, sY + cs * 0.6, cs, cs * 0.1);

        // Posts
        if (x === yb.x || x === yb.x + yb.w - 1 || x === gate.x - 1 || x === gate.x + 1) {
          ctx.fillStyle = postColor;
          ctx.fillRect(fx + cs * 0.4, sY + cs * 0.18, cs * 0.2, cs * 0.7);
          ctx.fillStyle = postCapColor;
          ctx.fillRect(fx + cs * 0.4, sY + cs * 0.18, cs * 0.2, 2.5);
        }
      }
    }

    // 3. EAST FENCE: Runs vertically along yb.x + yb.w - 1
    const eX = px + (yb.x + yb.w - 1) * cs;
    for (let y = yb.y; y < yb.y + yb.h; y++) {
      const fy = py + y * cs;
      // Vertical rail connectors
      ctx.fillStyle = railColor;
      ctx.fillRect(eX + cs * 0.44, fy, cs * 0.12, cs);

      // Post
      ctx.fillStyle = postColor;
      ctx.fillRect(eX + cs * 0.38, fy + cs * 0.15, cs * 0.24, cs * 0.7);
      ctx.fillStyle = postCapColor;
      ctx.fillRect(eX + cs * 0.38, fy + cs * 0.15, cs * 0.24, 2.5);
    }

    ctx.restore();
  }

  /**
   * 3D Garden Crop Stalk (Carrots, Wheat, Corn)
   */
  private render3DCropStalk(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    cs: number,
    cropType: string
  ): void {
    ctx.save();
    // Shadow
    ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x + cs * 0.5, y + cs * 0.8, cs * 0.26, cs * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Green stalk
    ctx.fillStyle = '#15803d';
    ctx.fillRect(x + cs * 0.44, y + cs * 0.25, cs * 0.12, cs * 0.55);

    // Leaves
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(x + cs * 0.5, y + cs * 0.32, cs * 0.24, 0, Math.PI * 2);
    ctx.fill();

    // Crop head (Carrot orange or Wheat gold)
    ctx.fillStyle = cropType === 'carrot' ? '#ea580c' : '#f59e0b';
    ctx.beginPath();
    ctx.arc(x + cs * 0.5, y + cs * 0.45, cs * 0.14, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Radiant Sunflower (Necesse Reference Images 2 & 3)
   */
  private renderSunflower(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    cs: number
  ): void {
    ctx.save();
    // Shadow
    ctx.fillStyle = 'rgba(10, 20, 15, 0.4)';
    ctx.beginPath();
    ctx.ellipse(x + cs * 0.5, y + cs * 0.9, cs * 0.25, cs * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tall Green Stalk
    ctx.fillStyle = '#15803d';
    ctx.fillRect(x + cs * 0.45, y, cs * 0.1, cs * 0.9);

    // Golden Yellow Sunflower Petals
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(x + cs * 0.5, y + cs * 0.15, cs * 0.28, 0, Math.PI * 2);
    ctx.fill();

    // Dark Brown Center Seed Disc
    ctx.fillStyle = '#713f12';
    ctx.beginPath();
    ctx.arc(x + cs * 0.5, y + cs * 0.15, cs * 0.13, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Outdoor Campfire (Offset from Front Entrance)
   */
  private renderOutdoorCampfire(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    cs: number
  ): void {
    const campImg = this.propsImages['campfire'];
    if (campImg && campImg.complete && campImg.naturalWidth > 0) {
      ctx.drawImage(campImg, x, y, cs * 1.15, cs * 1.15);
    } else {
      ctx.save();
      // Shadow
      ctx.fillStyle = 'rgba(12, 20, 16, 0.45)';
      ctx.beginPath();
      ctx.ellipse(x + cs * 0.5, y + cs * 0.65, cs * 0.42, cs * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Ring of stones
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.arc(x + cs * 0.5, y + cs * 0.5, cs * 0.36, 0, Math.PI * 2);
      ctx.fill();

      // Glowing Fire
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(x + cs * 0.5, y + cs * 0.5, cs * 0.22, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(x + cs * 0.5, y + cs * 0.5, cs * 0.11, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
