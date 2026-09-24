/**
 * SurvivalRenderer.ts - High-Performance Canvas 2D World Renderer
 *
 * Fixes:
 * - Proper real sprite rendering for all 16 house types from houses.png.
 * - Complete tileset crops including rotated shore corners, sand, paths, and fences (no weird blocks).
 * - Real rock sprite from Elements/Crops/rock.png and aspect-scaled trees/bushes.
 * - Complete village rendering: fences, troughs, crates, wild flowers, mushrooms, tilled soil, and crops.
 * - Zero sub-pixel gaps: mathematically contiguous tile rendering with lush grass base.
 * - Character (Player) & Village NPCs sized equally to wildlife animals (cows/sheep) with animated walking & hairstyles.
 * - Dynamic night radial lighting and smooth pixel-art camera.
 */

import { SurvivalEngine, ITEM_CATALOG } from "./SurvivalEngine";
import {
  LifeformRenderer,
  HUMAN_ANIMATIONS,
} from "../lifeforms/LifeformRenderer";
import { CHUNK_SIZE } from "./WorldManager";
import { ResourceNode, PlacedStructure, EnemyEntity } from "./GameTypes";

const TILESET_PATH =
  "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Tileset/spr_tileset_sunnysideworld_16px.png";
const HOUSES_PATH = "/houses.png";
const SOIL_PATH = "/tilled_soil.png";
const TREES_AND_BUSHES_PATH = "/trees_and_bushes.png";
const ROCK_PATH =
  "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/rock.png";
const WHEAT_PATH =
  "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/wheat_02.png";

interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const TILE_CROPS: Record<string, CropRect> = {
  // Grass variants (row 2, y=32)
  grass_textured_01: { x: 16, y: 32, w: 16, h: 16 },
  grass_textured_02: { x: 32, y: 32, w: 16, h: 16 },
  grass_textured_03: { x: 48, y: 32, w: 16, h: 16 },
  grass_textured_04: { x: 64, y: 32, w: 16, h: 16 },
  grass_textured_05: { x: 80, y: 32, w: 16, h: 16 },
  grass_textured_06: { x: 96, y: 32, w: 16, h: 16 },

  // Dirt paths (row y=112)
  path_tile_01: { x: 16, y: 112, w: 16, h: 16 },
  path_tile_02: { x: 144, y: 112, w: 16, h: 16 },
  path_tile_04: { x: 160, y: 112, w: 16, h: 16 },
  path_tile_05: { x: 176, y: 112, w: 16, h: 16 },

  // Ground types
  dirt_tile_01: { x: 16, y: 112, w: 16, h: 16 },
  sand_tile_01: { x: 208, y: 48, w: 16, h: 16 },
  stone_tile_01: { x: 80, y: 256, w: 16, h: 16 },

  // Water & Shore transition
  water_tile_01: { x: 352, y: 112, w: 16, h: 16 },
  shore_transition_01: { x: 368, y: 112, w: 16, h: 16 },

  // Wooden Fences
  fence_wood_h: { x: 624, y: 32, w: 16, h: 16 },
  fence_wood_v: { x: 640, y: 48, w: 16, h: 16 },
  fence_wood_corner: { x: 640, y: 32, w: 16, h: 16 },
  fence_wood_corner_tl: { x: 640, y: 32, w: 16, h: 16 },
  fence_wood_corner_tr: { x: 640, y: 32, w: 16, h: 16 },
  fence_wood_corner_bl: { x: 640, y: 32, w: 16, h: 16 },
  fence_wood_corner_br: { x: 640, y: 32, w: 16, h: 16 },
  fence_wood_post: { x: 640, y: 32, w: 16, h: 16 },
  fence_wood_gate: { x: 624, y: 0, w: 16, h: 16 },
};

const TREE_BUSH_CROPS: Record<string, CropRect> = {
  tree_01: { x: 10, y: 10, w: 50, h: 57 },
  tree_02: { x: 73, y: 10, w: 48, h: 57 },
  tree_03: { x: 131, y: 11, w: 51, h: 56 },
  tree_04: { x: 10, y: 75, w: 49, h: 52 },
  tree_05: { x: 73, y: 75, w: 49, h: 52 },
  bush_01: { x: 133, y: 84, w: 46, h: 42 },
  bush_02: { x: 12, y: 139, w: 46, h: 42 },
  bush_03: { x: 72, y: 138, w: 48, h: 44 },
  bush_04: { x: 133, y: 135, w: 48, h: 46 },
};

// Standalone house crops from houses.png
const HOUSE_CROPS: Record<string, [number, number, number, number]> = {
  house_cottage_01: [89, 50, 215, 204],
  house_farmhouse_01: [435, 72, 292, 181],
  house_barn_01: [873, 38, 179, 212],
  house_workshop_01: [1186, 60, 274, 197],
  house_tavern_01: [74, 270, 228, 210],
  house_shop_01: [444, 307, 280, 174],
  house_windmill_01: [1198, 545, 258, 158],
  house_mansion_01: [67, 734, 240, 227],
  house_cabin_01: [457, 769, 262, 198],
  house_castle_01: [841, 734, 231, 232],
  house_chapel_01: [854, 273, 227, 206],
  house_stable_01: [1198, 303, 254, 180],
  house_warehouse_01: [80, 490, 208, 212],
  house_merchant_01: [445, 524, 283, 181],
  house_blacksmith_01: [877, 486, 182, 218],
  house_lighthouse_01: [1212, 787, 261, 181],
};

const SPRITE_DEFS: Record<string, { path: string; w: number; h: number }> = {
  farm_well: {
    path: "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_well/c3d011a3-e1d2-4f14-83d7-d21b9f689713.png",
    w: 20,
    h: 25,
  },
  farm_well_covered: {
    path: "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_well_covered/28ee3935-0d63-4141-b01a-2338fa50e040.png",
    w: 20,
    h: 40,
  },
  farm_trough: {
    path: "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_trough/e83dc18e-a89c-4aae-999e-4531c1c9bb02.png",
    w: 29,
    h: 16,
  },
  farm_waterbowl: {
    path: "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_waterbowl/fb5f5698-0641-4a29-aad1-d97504abe0d6.png",
    w: 8,
    h: 11,
  },
  farm_crate_01: {
    path: "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_crate_01/658157b4-7ff5-452e-9e1d-c4cad561928b.png",
    w: 16,
    h: 21,
  },
  farm_crate_02: {
    path: "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_crate_02/d9ac3d57-03c4-4730-98eb-600ee4457ee2.png",
    w: 16,
    h: 21,
  },
  farm_chest_closed: {
    path: "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_chest_01_closed/496b079e-4729-46a2-8b47-cff42b294c71.png",
    w: 16,
    h: 21,
  },
  small_rock_01: {
    path: "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/rock.png",
    w: 10,
    h: 10,
  },
  flowers_wild_01: {
    path: "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_flowers_house_01/36388643-e82c-4037-97b4-3d1fa4cb65fb.png",
    w: 8,
    h: 18,
  },
  flowers_wild_02: {
    path: "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_flowers_house_02/93175c94-bed5-4a79-9562-232e8f9f075e.png",
    w: 12,
    h: 19,
  },
  mushrooms_deco_blue: {
    path: "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_mushroom_blue_01/28f072d2-4413-4dab-a4b7-7473337cd625.png",
    w: 16,
    h: 16,
  },
  mushrooms_deco_red: {
    path: "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_mushroom_red_01/32c3ffa9-6757-47f4-9800-5b7024450659.png",
    w: 16,
    h: 16,
  },
  acorn_deco_01: {
    path: "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_acron/ada48c07-f133-4861-ac13-16e671ac36cd.png",
    w: 10,
    h: 9,
  },
  truffle_deco_01: {
    path: "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_truffle/e6dbb225-174c-41bd-ab66-36e9fff04f0a.png",
    w: 10,
    h: 10,
  },
  ui_expression_love: {
    path: "/assets/ui/expression_love.png",
    w: 16,
    h: 16,
  },
  ui_expression_chat: {
    path: "/assets/ui/expression_chat.png",
    w: 16,
    h: 16,
  },
  ui_expression_alerted: {
    path: "/assets/ui/expression_alerted.png",
    w: 16,
    h: 16,
  },
};

function getCropPath(cropId: string): string {
  const parts = cropId.replace("crop_", "").split("_stage_");
  if (parts.length === 2) {
    const name = parts[0];
    const stage = parts[1].padStart(2, "0");
    return `/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/${name}_${stage}.png`;
  }
  return `/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/wheat_02.png`;
}

export class SurvivalRenderer {
  private tilesetImg: HTMLImageElement | null = null;
  private housesImg: HTMLImageElement | null = null;
  private treeBushImg: HTMLImageElement | null = null;
  private rockImg: HTMLImageElement | null = null;
  private wheatImg: HTMLImageElement | null = null;
  private soilImg: HTMLImageElement | null = null;
  private spriteImages: Map<string, HTMLImageElement> = new Map();

  public lifeformRenderer: LifeformRenderer;
  public zoom = 2.2;
  public readonly baseTileSize = 16;
  public isWorldGenMode = false;

  // Smooth camera tracking
  public cameraX = 22;
  public cameraY = 18;

  constructor() {
    this.lifeformRenderer = new LifeformRenderer();
    this.loadImages();
  }

  private loadImages() {
    this.tilesetImg = this.loadImage(TILESET_PATH);
    this.housesImg = this.loadImage(HOUSES_PATH);
    this.treeBushImg = this.loadImage(TREES_AND_BUSHES_PATH);
    this.rockImg = this.loadImage(ROCK_PATH);
    this.wheatImg = this.loadImage(WHEAT_PATH);
    this.soilImg = this.loadImage(SOIL_PATH);

    // Preload prop sprites
    for (const [key, def] of Object.entries(SPRITE_DEFS)) {
      this.spriteImages.set(key, this.loadImage(def.path));
    }

    // Preload item sprites for hotbar & held items
    for (const [id, def] of Object.entries(ITEM_CATALOG)) {
      if ((def as any).spritePath) {
        this.getItemSprite(id);
      }
    }
  }

  private loadImage(src: string): HTMLImageElement {
    const img = new Image();
    img.src = src;
    return img;
  }

  private getSpriteImage(key: string): HTMLImageElement | null {
    const img = this.spriteImages.get(key);
    if (img && img.complete && img.naturalWidth > 0) return img;
    return null;
  }

  private getCropImage(cropId: string): HTMLImageElement | null {
    const path = getCropPath(cropId);
    let img = this.spriteImages.get(path);
    if (!img) {
      img = this.loadImage(path);
      this.spriteImages.set(path, img);
    }
    if (img.complete && img.naturalWidth > 0) return img;
    return null;
  }

  private itemSprites: Map<string, HTMLImageElement> = new Map();

  public getItemSprite(itemId: string): HTMLImageElement | null {
    if (this.itemSprites.has(itemId)) {
      return this.itemSprites.get(itemId)!;
    }
    const def = (ITEM_CATALOG as any)[itemId];
    const path = def?.spritePath;
    if (!path) return null;
    const img = this.loadImage(path);
    this.itemSprites.set(itemId, img);
    return img;
  }

  /**
   * Main render call invoked every animation frame (60 FPS).
   *
   * Fix 1: Accepts dt so camera smoothing is frame-rate independent (uses Math.exp).
   * Fix 2: Camera follows predictedX/predictedY (stable), not visual position,
   *         preventing server reconciliation from causing camera shudder.
   */
  public render(
    canvas: HTMLCanvasElement,
    engine: SurvivalEngine,
    dt: number = 0.016,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    // Fix 1 & 2: Camera follows the authoritative predicted position, NOT the visual
    // (error-offset) position, so server corrections never cause camera shudder.
    // Smoothing uses exponential decay so it's identical at all frame rates.
    const pred = (engine as any).networkPrediction;
    const targetCamX = pred ? pred.predictedX : engine.player.x;
    const targetCamY = pred ? pred.predictedY : engine.player.y;
    const smoothing = 1 - Math.exp(-1 * dt);
    this.cameraX += (targetCamX - this.cameraX) * smoothing;
    this.cameraY += (targetCamY - this.cameraY) * smoothing;

    const cellSize = this.baseTileSize * this.zoom;
    const halfWidth = canvas.width / 2;
    const halfHeight = canvas.height / 2;

    // Fix 8: Use Math.round (not Math.floor) to eliminate the one-pixel tile shimmer
    // that occurs when fractional cell sizes shift between adjacent integer values.
    const worldToScreen = (wx: number, wy: number) => ({
      sx: Math.round(halfWidth + (wx - this.cameraX) * cellSize),
      sy: Math.round(halfHeight + (wy - this.cameraY) * cellSize),
    });

    // Clear canvas with rich sunnyside grass green (prevents dark background leakage)
    ctx.fillStyle = "#568735";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Visible bounding box in world tiles
    const visibleTilesX = Math.ceil(canvas.width / cellSize) + 3;
    const visibleTilesY = Math.ceil(canvas.height / cellSize) + 3;
    const minTileX = Math.floor(this.cameraX - visibleTilesX / 2);
    const maxTileX = Math.ceil(this.cameraX + visibleTilesX / 2);
    const minTileY = Math.floor(this.cameraY - visibleTilesY / 2);
    const maxTileY = Math.ceil(this.cameraY + visibleTilesY / 2);

    // ── LAYER 1: GROUND TERRAIN TILES (Zero-gap pixel seamless) ──
    if (this.tilesetImg && this.tilesetImg.complete) {
      for (let ty = minTileY; ty <= maxTileY; ty++) {
        for (let tx = minTileX; tx <= maxTileX; tx++) {
          const screen = worldToScreen(tx, ty);
          const screenNext = worldToScreen(tx + 1, ty + 1);
          // +1px overlap guarantees zero pixel gap lines between adjacent tiles during movement
          const tileW = screenNext.sx - screen.sx + 1;
          const tileH = screenNext.sy - screen.sy + 1;

          const tile = engine.worldManager.getTile(tx, ty);

          // 1. Always draw lush grass base on every tile
          const grassCrop = TILE_CROPS["grass_textured_01"];
          ctx.drawImage(
            this.tilesetImg,
            grassCrop.x,
            grassCrop.y,
            grassCrop.w,
            grassCrop.h,
            screen.sx,
            screen.sy,
            tileW,
            tileH,
          );

          // 2. Draw specialized terrain overlay on top if not base grass
          if (tile.terrain !== "grass_textured_01") {
            const crop =
              TILE_CROPS[tile.terrain] || TILE_CROPS["grass_textured_01"];

            if (tile.rotation) {
              ctx.save();
              ctx.translate(screen.sx + tileW / 2, screen.sy + tileH / 2);
              ctx.rotate(tile.rotation);
              ctx.drawImage(
                this.tilesetImg,
                crop.x,
                crop.y,
                crop.w,
                crop.h,
                -tileW / 2,
                -tileH / 2,
                tileW,
                tileH,
              );
              ctx.restore();
            } else {
              ctx.drawImage(
                this.tilesetImg,
                crop.x,
                crop.y,
                crop.w,
                crop.h,
                screen.sx,
                screen.sy,
                tileW,
                tileH,
              );
            }
          }
        }
      }
    }

    // ── LAYER 2: VILLAGE FARMLAND SOIL ──────────────────────────
    for (const village of engine.worldManager.villages) {
      for (const farm of village.data.farms) {
        for (const cell of farm.cells) {
          const wx = village.gridX + cell.x;
          const wy = village.gridY + cell.y;
          if (
            wx < minTileX - 1 ||
            wx > maxTileX + 1 ||
            wy < minTileY - 1 ||
            wy > maxTileY + 1
          )
            continue;

          const screen = worldToScreen(wx, wy);
          const screenNext = worldToScreen(wx + 1, wy + 1);
          const tileW = screenNext.sx - screen.sx + 1;
          const tileH = screenNext.sy - screen.sy + 1;

          if (
            this.soilImg &&
            this.soilImg.complete &&
            this.soilImg.naturalWidth > 0
          ) {
            // tilled_soil.png is a 16×16 tile — draw full source into one tile cell
            ctx.drawImage(
              this.soilImg,
              0, 0, this.soilImg.naturalWidth, this.soilImg.naturalHeight,
              screen.sx, screen.sy, tileW, tileH
            );
          } else if (this.tilesetImg && this.tilesetImg.complete) {
            const dirtCrop = TILE_CROPS["dirt_tile_01"];
            ctx.drawImage(
              this.tilesetImg,
              dirtCrop.x,
              dirtCrop.y,
              dirtCrop.w,
              dirtCrop.h,
              screen.sx,
              screen.sy,
              tileW,
              tileH,
            );
          }
        }
      }
    }

    // ── LAYER 3: VILLAGE GROUND SCATTER & DECORATIONS ───────────
    for (const village of engine.worldManager.villages) {
      if (!village.data.decorations) continue;
      for (const deco of village.data.decorations) {
        const wx = village.gridX + deco.x;
        const wy = village.gridY + deco.y;
        if (
          wx < minTileX - 1 ||
          wx > maxTileX + 1 ||
          wy < minTileY - 1 ||
          wy > maxTileY + 1
        )
          continue;

        const screen = worldToScreen(wx, wy);
        if (
          deco.id in TILE_CROPS &&
          this.tilesetImg &&
          this.tilesetImg.complete
        ) {
          const crop = TILE_CROPS[deco.id];
          ctx.drawImage(
            this.tilesetImg,
            crop.x,
            crop.y,
            crop.w,
            crop.h,
            screen.sx,
            screen.sy,
            cellSize,
            cellSize,
          );
        } else if (deco.id in SPRITE_DEFS) {
          const def = SPRITE_DEFS[deco.id];
          const img = this.getSpriteImage(deco.id);
          if (img) {
            const isSmall =
              deco.id === "acorn_deco_01" || deco.id === "truffle_deco_01";
            const targetDim = isSmall ? cellSize * 0.45 : cellSize * 0.85;
            const scale = targetDim / Math.max(def.w, def.h);
            const dw = def.w * scale;
            const dh = def.h * scale;
            ctx.drawImage(
              img,
              screen.sx + (cellSize - dw) / 2,
              screen.sy + (cellSize - dh) / 2,
              dw,
              dh,
            );
          }
        }
      }
    }

    // ── LAYER 4: PLACED FLOORS & CARPETS ────────────────────────
    for (const struct of engine.placedStructures) {
      if (struct.type === "wood_floor") {
        const screen = worldToScreen(struct.x, struct.y);
        ctx.fillStyle = "#a16207";
        ctx.fillRect(screen.sx, screen.sy, cellSize, cellSize);
        ctx.strokeStyle = "#78350f";
        ctx.lineWidth = 1;
        ctx.strokeRect(
          screen.sx + 1,
          screen.sy + 1,
          cellSize - 2,
          cellSize - 2,
        );
      }
    }

    // ── LAYER 5: DROPPED ITEMS ON GROUND ────────────────────────
    for (const item of engine.droppedItems) {
      const screen = worldToScreen(item.x, item.y);
      const bobY = Math.sin(item.bobTimer) * 3;

      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(
        screen.sx + cellSize / 2,
        screen.sy + cellSize / 2 + 6,
        6 * (this.zoom / 2),
        3 * (this.zoom / 2),
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      const def = ITEM_CATALOG[item.item];
      ctx.font = `${14 * (this.zoom / 2)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        def?.icon || "📦",
        screen.sx + cellSize / 2,
        screen.sy + cellSize / 2 + bobY,
      );
    }

    // ── LAYER 6: Y-SORTED DEPTH ENTITIES & STRUCTURES ───────────
    interface Renderable {
      yOrder: number;
      draw: () => void;
    }
    const depthList: Renderable[] = [];

    // 6.1 Village Houses & Buildings (Authentic pixel crops)
    for (const village of engine.worldManager.villages) {
      for (const house of village.data.houses) {
        const wx = village.gridX + house.x;
        const wy = village.gridY + house.y;
        if (
          wx + house.footprintW < minTileX - 3 ||
          wx > maxTileX + 3 ||
          wy + house.footprintH < minTileY - 3 ||
          wy > maxTileY + 3
        ) {
          continue;
        }

        depthList.push({
          yOrder: wy + house.footprintH,
          draw: () => {
            const screen = worldToScreen(wx, wy);
            const crop =
              HOUSE_CROPS[house.id] || HOUSE_CROPS["house_cottage_01"];

            if (
              crop &&
              this.housesImg &&
              this.housesImg.complete &&
              this.housesImg.naturalWidth > 0
            ) {
              const [cx, cy, cw, ch] = crop;
              const footprintPixelW = house.footprintW * cellSize;
              const footprintPixelH = house.footprintH * cellSize;
              const scale = Math.min(
                (footprintPixelW * 1.15) / cw,
                (footprintPixelH * 1.35) / ch,
              );
              const dw = cw * scale;
              const dh = ch * scale;
              const dx = screen.sx + (footprintPixelW - dw) / 2;
              const dy = screen.sy + footprintPixelH - dh + 4;

              // Soft drop shadow
              ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
              ctx.beginPath();
              ctx.ellipse(
                dx + dw / 2,
                screen.sy + footprintPixelH - 2,
                dw * 0.46,
                8,
                0,
                0,
                Math.PI * 2,
              );
              ctx.fill();

              // Draw House Sprite
              ctx.drawImage(this.housesImg, cx, cy, cw, ch, dx, dy, dw, dh);
            }
          },
        });
      }

      // 6.1b Village Farm Objects (fences, troughs, crates, chests)
      if (village.data.farmObjects) {
        for (const obj of village.data.farmObjects) {
          const wx = village.gridX + obj.x;
          const wy = village.gridY + obj.y;
          if (
            wx < minTileX - 1 ||
            wx > maxTileX + 1 ||
            wy < minTileY - 1 ||
            wy > maxTileY + 1
          )
            continue;

          depthList.push({
            yOrder: wy + 1,
            draw: () => {
              const screen = worldToScreen(wx, wy);
              if (
                obj.id in TILE_CROPS &&
                this.tilesetImg &&
                this.tilesetImg.complete
              ) {
                const crop = TILE_CROPS[obj.id];
                ctx.drawImage(
                  this.tilesetImg,
                  crop.x,
                  crop.y,
                  crop.w,
                  crop.h,
                  screen.sx,
                  screen.sy,
                  cellSize,
                  cellSize,
                );
              } else if (obj.id in SPRITE_DEFS) {
                const def = SPRITE_DEFS[obj.id];
                const img = this.getSpriteImage(obj.id);
                if (img) {
                  const scale = cellSize / Math.max(def.w, def.h);
                  const dw = def.w * scale;
                  const dh = def.h * scale;
                  ctx.drawImage(
                    img,
                    screen.sx + (cellSize - dw) / 2,
                    screen.sy + cellSize - dh,
                    dw,
                    dh,
                  );
                }
              }
            },
          });
        }
      }

      // 6.1c Village Wells
      for (const well of village.data.wells) {
        const wx = village.gridX + well.x;
        const wy = village.gridY + well.y;
        depthList.push({
          yOrder: wy + 1,
          draw: () => {
            const screen = worldToScreen(wx, wy);
            const img =
              this.getSpriteImage(well.id) ||
              this.getSpriteImage("farm_well_covered");
            if (img) {
              const def =
                SPRITE_DEFS[well.id] || SPRITE_DEFS["farm_well_covered"];
              const scale = (cellSize * 1.5) / Math.max(def.w, def.h);
              const dw = def.w * scale;
              const dh = def.h * scale;
              ctx.drawImage(
                img,
                screen.sx + (cellSize - dw) / 2,
                screen.sy + cellSize - dh,
                dw,
                dh,
              );
            }
          },
        });
      }

      // 6.1d Village Growing Crops
      for (const farm of village.data.farms) {
        for (const cell of farm.cells) {
          const wx = village.gridX + cell.x;
          const wy = village.gridY + cell.y;
          if (
            wx < minTileX - 1 ||
            wx > maxTileX + 1 ||
            wy < minTileY - 1 ||
            wy > maxTileY + 1
          )
            continue;

          // Check if crop resource node exists and is depleted
          const cropRes = engine.worldManager.getResourceAt(
            wx + 0.5,
            wy + 0.5,
            0.6,
          );
          if (cropRes && cropRes.isDepleted) continue;

          // Render Crop if not depleted and crop is planted
          if (cell.cropId) {
            depthList.push({
              yOrder: wy + 0.95,
              draw: () => {
                const screen = worldToScreen(wx, wy);
                const cropImg = this.getCropImage(cell.cropId);
                
                if (cropImg) {
                  const cropW = cellSize * 0.9;
                  const cropH = cellSize * 1.1;
                  ctx.drawImage(
                    cropImg,
                    screen.sx + (cellSize - cropW) / 2,
                    screen.sy + cellSize - cropH,
                    cropW,
                    cropH,
                  );
                } else if (this.wheatImg && this.wheatImg.complete) {
                  // Fallback
                  const cropW = cellSize * 0.9;
                  const cropH = cellSize * 1.1;
                  ctx.drawImage(
                    this.wheatImg,
                    screen.sx + (cellSize - cropW) / 2,
                    screen.sy + cellSize - cropH,
                    cropW,
                    cropH,
                  );
                }
              },
            });
          }
        }
      }
    }

    // 6.2 Natural Trees, Rocks, Bushes from World Chunks
    const centerChunkX = Math.floor(this.cameraX / CHUNK_SIZE);
    const centerChunkY = Math.floor(this.cameraY / CHUNK_SIZE);

    for (let dcy = -2; dcy <= 2; dcy++) {
      for (let dcx = -2; dcx <= 2; dcx++) {
        const chunk = engine.worldManager.getOrCreateChunk(
          centerChunkX + dcx,
          centerChunkY + dcy,
        );
        for (const res of chunk.resources) {
          if (res.isDepleted) continue;
          if (
            res.x < minTileX - 3 ||
            res.x > maxTileX + 3 ||
            res.y < minTileY - 3 ||
            res.y > maxTileY + 3
          )
            continue;

          depthList.push({
            yOrder: res.y + res.h,
            draw: () => {
              const screen = worldToScreen(res.x, res.y);
              const shakeOffset =
                res.shakeTimer && res.shakeTimer > 0
                  ? Math.random() * 4 - 2
                  : 0;

              if (res.type === "tree") {
                // Ground shadow
                ctx.fillStyle = "rgba(0,0,0,0.35)";
                ctx.beginPath();
                ctx.ellipse(
                  screen.sx + cellSize,
                  screen.sy + cellSize * 1.6,
                  cellSize * 0.9,
                  cellSize * 0.4,
                  0,
                  0,
                  Math.PI * 2,
                );
                ctx.fill();

                if (this.treeBushImg && this.treeBushImg.complete) {
                  const crop = TREE_BUSH_CROPS.tree_01;
                  const treeW = cellSize * 3.0;
                  const aspect = crop.h / crop.w;
                  const treeH = treeW * aspect;
                  const dx = screen.sx + (cellSize * 2 - treeW) / 2;
                  const dy = screen.sy + cellSize * 2 - treeH;

                  ctx.drawImage(
                    this.treeBushImg,
                    crop.x,
                    crop.y,
                    crop.w,
                    crop.h,
                    dx + shakeOffset,
                    dy,
                    treeW,
                    treeH,
                  );
                }
              } else if (res.type === "rock" || res.type === "iron_rock") {
                // Ground shadow
                ctx.fillStyle = "rgba(0,0,0,0.32)";
                ctx.beginPath();
                ctx.ellipse(
                  screen.sx + cellSize / 2,
                  screen.sy + cellSize * 0.75,
                  cellSize * 0.45,
                  cellSize * 0.22,
                  0,
                  0,
                  Math.PI * 2,
                );
                ctx.fill();

                if (this.rockImg && this.rockImg.complete) {
                  const rockW = cellSize * 1.25;
                  const rockH = cellSize * 1.25;
                  const dx = screen.sx + (cellSize - rockW) / 2;
                  const dy = screen.sy + (cellSize - rockH) / 2;
                  ctx.drawImage(
                    this.rockImg,
                    dx + shakeOffset,
                    dy,
                    rockW,
                    rockH,
                  );

                  if (res.type === "iron_rock") {
                    ctx.fillStyle = "rgba(249, 115, 22, 0.8)";
                    ctx.fillRect(
                      screen.sx + cellSize * 0.4,
                      screen.sy + cellSize * 0.35,
                      3 * (this.zoom / 2),
                      3 * (this.zoom / 2),
                    );
                    ctx.fillStyle = "#fed7aa";
                    ctx.fillRect(
                      screen.sx + cellSize * 0.6,
                      screen.sy + cellSize * 0.5,
                      2 * (this.zoom / 2),
                      2 * (this.zoom / 2),
                    );
                  }
                }
              } else if (res.type === "bush") {
                if (this.treeBushImg && this.treeBushImg.complete) {
                  const crop = TREE_BUSH_CROPS.bush_01;
                  const bushW = cellSize * 1.3;
                  const aspect = crop.h / crop.w;
                  const bushH = bushW * aspect;
                  ctx.drawImage(
                    this.treeBushImg,
                    crop.x,
                    crop.y,
                    crop.w,
                    crop.h,
                    screen.sx,
                    screen.sy + cellSize - bushH,
                    bushW,
                    bushH,
                  );
                }
              } else if (res.type === "crop") {
                if (this.wheatImg && this.wheatImg.complete) {
                  const cropW = cellSize;
                  const cropH = cellSize * 1.2;
                  ctx.drawImage(
                    this.wheatImg,
                    screen.sx,
                    screen.sy - cropH * 0.2,
                    cropW,
                    cropH,
                  );
                }
              }

              // Resource Health Bar on hit
              if (res.health < res.maxHealth) {
                const barW = cellSize * 1.2;
                const barH = 4;
                const barX = screen.sx + cellSize / 2 - barW / 2;
                const barY = screen.sy - 8;
                ctx.fillStyle = "rgba(0,0,0,0.6)";
                ctx.fillRect(barX, barY, barW, barH);
                ctx.fillStyle = "#22c55e";
                ctx.fillRect(
                  barX,
                  barY,
                  barW * (res.health / res.maxHealth),
                  barH,
                );
              }
            },
          });
        }
      }
    }

    // 6.3 Placed Structures (Walls, Doors, Campfires, Chests, Workbenches)
    for (const struct of engine.placedStructures) {
      depthList.push({
        yOrder: struct.y + struct.h,
        draw: () => {
          const screen = worldToScreen(struct.x, struct.y);
          if (struct.type === "wood_wall") {
            ctx.fillStyle = "#78350f";
            ctx.fillRect(
              screen.sx,
              screen.sy - cellSize * 0.4,
              cellSize,
              cellSize * 1.4,
            );
            ctx.fillStyle = "#92400e";
            ctx.fillRect(
              screen.sx + 2,
              screen.sy - cellSize * 0.3,
              cellSize - 4,
              cellSize * 1.2,
            );
          } else if (struct.type === "wood_door") {
            ctx.fillStyle = struct.isOpen ? "rgba(120,53,15,0.4)" : "#78350f";
            ctx.fillRect(screen.sx, screen.sy, cellSize, cellSize);
            ctx.font = `${10 * (this.zoom / 2)}px sans-serif`;
            ctx.fillStyle = "#fde047";
            ctx.fillText(
              struct.isOpen ? "OPEN" : "DOOR",
              screen.sx + 2,
              screen.sy + cellSize / 2,
            );
          } else if (struct.type === "campfire") {
            ctx.fillStyle = "rgba(0,0,0,0.4)";
            ctx.beginPath();
            ctx.ellipse(
              screen.sx + cellSize / 2,
              screen.sy + cellSize * 0.8,
              cellSize * 0.4,
              cellSize * 0.2,
              0,
              0,
              Math.PI * 2,
            );
            ctx.fill();

            const flicker = Math.sin(Date.now() * 0.01) * 3;
            ctx.fillStyle = "#f97316";
            ctx.beginPath();
            ctx.arc(
              screen.sx + cellSize / 2,
              screen.sy + cellSize / 2 - 2,
              cellSize * 0.35 + flicker,
              0,
              Math.PI * 2,
            );
            ctx.fill();
            ctx.fillStyle = "#fef08a";
            ctx.beginPath();
            ctx.arc(
              screen.sx + cellSize / 2,
              screen.sy + cellSize / 2 - 4,
              cellSize * 0.18,
              0,
              Math.PI * 2,
            );
            ctx.fill();
          } else if (struct.type === "workbench") {
            ctx.fillStyle = "#9a3412";
            ctx.fillRect(
              screen.sx + 2,
              screen.sy + 2,
              cellSize - 4,
              cellSize - 4,
            );
            ctx.fillStyle = "#fbbf24";
            ctx.font = `${14 * (this.zoom / 2)}px sans-serif`;
            ctx.textAlign = "center";
            ctx.fillText(
              "🛠️",
              screen.sx + cellSize / 2,
              screen.sy + cellSize / 2,
            );
          } else if (struct.type === "chest") {
            ctx.fillStyle = "#854d0e";
            ctx.fillRect(
              screen.sx + 2,
              screen.sy + 4,
              cellSize - 4,
              cellSize - 8,
            );
            ctx.fillStyle = "#fef08a";
            ctx.fillRect(
              screen.sx + cellSize / 2 - 2,
              screen.sy + cellSize / 2 - 2,
              4,
              4,
            );
          }
        },
      });
    }

    // 6.4 Living Wildlife Animals (Cows, Sheep, Chickens, Rabbits)
    const pcx = Math.floor(engine.player.x / 16);
    const pcy = Math.floor(engine.player.y / 16);
    for (const animal of engine.animals) {
      if (!animal.isActive) continue;
      const acx = Math.floor(animal.position.x / 16);
      const acy = Math.floor(animal.position.y / 16);
      if (Math.abs(acx - pcx) > 4 || Math.abs(acy - pcy) > 4) continue;

      depthList.push({
        yOrder: animal.position.y + 0.5,
        draw: () => {
          const screen = worldToScreen(animal.position.x, animal.position.y);
          this.lifeformRenderer.renderEntity(
            ctx,
            animal,
            cellSize,
            false,
            screen.sx + cellSize / 2,
            screen.sy + cellSize / 2,
            1.0,
          );
        },
      });
    }

    // 6.5 Village NPCs (Frozen and hidden when outside 4-chunk active radius)
    for (const npc of engine.npcs) {
      if (!npc.isActive) continue;
      const ncx = Math.floor(npc.position.x / 16);
      const ncy = Math.floor(npc.position.y / 16);
      if (Math.abs(ncx - pcx) > 4 || Math.abs(ncy - pcy) > 4) continue;

      depthList.push({
        yOrder: npc.position.y + 0.5,
        draw: () => {
          const screen = worldToScreen(npc.position.x, npc.position.y);
          this.lifeformRenderer.renderEntity(
            ctx,
            npc,
            cellSize,
            false,
            screen.sx + cellSize / 2,
            screen.sy + cellSize / 2,
            1.0,
          );

          // Name Tag & Role (cleanly above head)
          const title = npc.customTitle || "Villager";
          ctx.font = "bold 9px sans-serif";
          const tw = ctx.measureText(title).width;
          const boxW = Math.max(48, tw + 10);
          ctx.fillStyle = "rgba(0,0,0,0.65)";
          ctx.fillRect(
            screen.sx + cellSize / 2 - boxW / 2,
            screen.sy - 38,
            boxW,
            14,
          );
          ctx.fillStyle = "#fef08a";
          ctx.textAlign = "center";
          ctx.fillText(title, screen.sx + cellSize / 2, screen.sy - 27);

          // Overhead chat bubble indicator when player is in speaking range
          const distToPlayer = Math.hypot(
            engine.player.x - npc.position.x,
            engine.player.y - npc.position.y,
          );
          if (distToPlayer <= 2.2) {
            const chatImg = this.getSpriteImage("ui_expression_chat");
            if (chatImg) {
              const bsz = 18 * (this.zoom / 2);
              const bob = Math.sin(Date.now() / 250) * 3;
              ctx.imageSmoothingEnabled = false;
              ctx.drawImage(
                chatImg,
                screen.sx + cellSize / 2 - bsz / 2,
                screen.sy - 58 + bob,
                bsz,
                bsz,
              );
            }
          }
        },
      });
    }

    // 6.6 Hostile Night Enemies (Animated Goblin & Skeleton sprites)
    for (const enemy of engine.enemies) {
      depthList.push({
        yOrder: enemy.y + 0.5,
        draw: () => {
          const screen = worldToScreen(enemy.x, enemy.y);
          this.lifeformRenderer.renderShadow(
            ctx,
            screen.sx + cellSize / 2,
            screen.sy + cellSize * 0.8,
            cellSize * 0.35,
            cellSize * 0.18,
          );
          this.lifeformRenderer.renderEnemy(
            ctx,
            enemy,
            cellSize,
            screen.sx + cellSize / 2,
            screen.sy + cellSize / 2,
          );

          // Enemy Health Bar
          if (enemy.health < enemy.maxHealth && enemy.health > 0) {
            const barW = cellSize * 0.9;
            const barH = 3;
            ctx.fillStyle = "rgba(0,0,0,0.6)";
            ctx.fillRect(
              screen.sx + cellSize / 2 - barW / 2,
              screen.sy - 8,
              barW,
              barH,
            );
            ctx.fillStyle = "#ef4444";
            ctx.fillRect(
              screen.sx + cellSize / 2 - barW / 2,
              screen.sy - 8,
              barW * (enemy.health / enemy.maxHealth),
              barH,
            );
          }
        },
      });
    }

    // 6.7 Player Character & Held Item
    if (!this.isWorldGenMode) {
      depthList.push({
        yOrder: engine.player.y + 0.5,
        draw: () => {
          const p = engine.player;
        const screen = worldToScreen(p.x, p.y);
        const hopY = p.hopOffset * cellSize;
        const isFacingLeft = p.facing === "LEFT";
        const activeSlot = engine.getActiveItemSlot();
        const activeItemDef = activeSlot?.item
          ? ITEM_CATALOG[activeSlot.item]
          : null;
        const isToolOrWeapon =
          activeItemDef?.category === "tool" ||
          activeItemDef?.category === "weapon";

        // Determine human animation action
        let action = "IDLE";
        let frameIndex = 0;

        if (p.isDead) {
          action = "DEATH";
          frameIndex = Math.min(12, Math.floor(Date.now() / 100) % 13);
        } else if (p.hurtTimer && p.hurtTimer > 0) {
          action = "HURT";
          frameIndex = Math.floor(Date.now() / 90) % 8;
        } else if (p.fishingState && p.fishingState !== "NONE") {
          if (p.fishingState === "CASTING") {
            action = "CASTING";
            frameIndex = Math.floor(Date.now() / 90) % 15;
          } else if (p.fishingState === "REELING") {
            action = "REELING";
            frameIndex = Math.floor(Date.now() / 90) % 13;
          } else if (p.fishingState === "CAUGHT") {
            action = "CAUGHT";
            frameIndex = Math.floor(Date.now() / 90) % 10;
          }
        } else if (p.doingTimer && p.doingTimer > 0) {
          action = "DOING";
          frameIndex = Math.floor(Date.now() / 110) % 8;
        } else if (p.swingTimer > 0) {
          const activeItem = activeSlot?.item || "";
          if (activeItem.includes("axe")) {
            action = "AXE";
          } else if (activeItem.includes("pickaxe")) {
            action = "MINING";
          } else if (
            activeItem.includes("hoe") ||
            activeItem.includes("shovel")
          ) {
            action = "DIG";
          } else if (activeItem.includes("water")) {
            action = "WATERING";
          } else if (activeItem.includes("hammer") || engine.buildPiece) {
            action = "HAMMERING";
          } else if (activeItem.includes("rod")) {
            action = "CASTING";
          } else {
            action = "ATTACK";
          }
          const progress = Math.min(1, Math.max(0, 1 - p.swingTimer / 0.25));
          const totalF = HUMAN_ANIMATIONS[action]?.totalFrames || 10;
          frameIndex = Math.min(totalF - 1, Math.floor(progress * totalF));
        } else if (p.isSwimming) {
          action = "SWIMMING";
          frameIndex = Math.floor(Date.now() / 100) % 12;
        } else if (p.hopTimer && p.hopTimer > 0) {
          action = "JUMP";
          const progress = Math.max(0, Math.min(1, 1 - p.hopTimer / 0.55));
          frameIndex = Math.min(8, Math.floor(progress * 9));
        } else if (activeSlot && activeSlot.item && !isToolOrWeapon) {
          action = "CARRY";
          frameIndex =
            p.vx !== 0 || p.vy !== 0 ? Math.floor(Date.now() / 110) % 8 : 0;
        } else if (p.isSprinting && (p.vx !== 0 || p.vy !== 0)) {
          action = "RUN";
          frameIndex = Math.floor(Date.now() / 90) % 8;
        } else if (p.vx !== 0 || p.vy !== 0) {
          action = "WALK";
          frameIndex = Math.floor(Date.now() / 110) % 8;
        } else if (p.isWaiting) {
          action = "WAITING";
          frameIndex = Math.floor(Date.now() / 140) % 9;
        } else {
          action = "IDLE";
          frameIndex = Math.floor(Date.now() / 140) % 9;
        }

        const isSwinging = p.swingTimer > 0;
        const playerCenterX = screen.sx + cellSize / 2;
        const groundY = screen.sy + cellSize / 2;

        // RENDER CHARACTER BODY WITH INTEGRATED TOOL ANIMATION
        const playerEntity: any = {
          position: { x: p.x, y: p.y },
          species: "player",
          type: "PLAYER",
          isActive: true,
          behaviorState: p.isDead ? "DEAD" : "WALK",
          hairstyle: "mophair",
          anim: {
            action,
            currentFrame: frameIndex,
            flipX: isFacingLeft,
            jumpOffset: p.hopOffset * 24,
            eatingBobOffset: 0,
            deathAlpha: p.isDead ? 1.0 : 1.0,
            hasTool: isToolOrWeapon,
            showTool:
              isToolOrWeapon ||
              [
                "AXE",
                "MINING",
                "ATTACK",
                "DIG",
                "WATERING",
                "HAMMERING",
                "CASTING",
                "REELING",
                "CAUGHT",
                "DOING",
                "JUMP",
                "SWIMMING",
                "WAITING",
              ].includes(action),
          },
        };

        this.lifeformRenderer.renderEntity(
          ctx,
          playerEntity,
          cellSize,
          false,
          playerCenterX,
          groundY,
          1.0,
          action,
        );
        },
      });
    }

    // 6.8 Other Connected Players (Multiplayer)
    if (engine.remotePlayers && engine.remotePlayers.length > 0) {
      for (const rp of engine.remotePlayers) {
        depthList.push({
          yOrder: rp.y + 0.5,
          draw: () => {
            const screen = worldToScreen(rp.x, rp.y);
            const playerCenterX = screen.sx + cellSize / 2;
            const groundY = screen.sy + cellSize / 2;
            const isFacingLeft =
              rp.facing === "LEFT" || rp.direction === "LEFT";
            const isTool = !!rp.activeHeldItem;

            let action = "IDLE";
            if (rp.isDead) action = "DEATH";
            else if (rp.hurtTimer > 0) action = "HURT";
            else if (rp.swingTimer > 0) action = "AXE";
            else if (rp.isSwimming) action = "SWIMMING";
            else if (rp.vx !== 0 || rp.vy !== 0)
              action = rp.isSprinting ? "RUN" : "WALK";

            const remoteEntity: any = {
              position: { x: rp.x, y: rp.y },
              species: "player",
              type: "PLAYER",
              isActive: true,
              behaviorState: rp.isDead ? "DEAD" : "WALK",
              hairstyle: rp.hairstyle || "curlyhair",
              anim: {
                action,
                currentFrame: Math.floor(Date.now() / 110) % 8,
                flipX: isFacingLeft,
                jumpOffset: (rp.hopOffset || 0) * 24,
                eatingBobOffset: 0,
                deathAlpha: 1.0,
                hasTool: isTool,
                showTool: isTool,
              },
            };

            this.lifeformRenderer.renderEntity(
              ctx,
              remoteEntity,
              cellSize,
              false,
              playerCenterX,
              groundY,
              1.0,
              action,
            );

            // Name Tag Badge
            ctx.save();
            ctx.font = "bold 11px 'Outfit', sans-serif";
            ctx.textAlign = "center";
            const tagText = rp.name || "Explorer";
            const tagW = ctx.measureText(tagText).width + 12;
            ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
            ctx.beginPath();
            ctx.roundRect(
              playerCenterX - tagW / 2,
              groundY - cellSize * 1.5,
              tagW,
              16,
              4,
            );
            ctx.fill();
            ctx.fillStyle = "#38bdf8";
            ctx.fillText(tagText, playerCenterX, groundY - cellSize * 1.5 + 12);
            ctx.restore();
          },
        });
      }
    }

    // Execute depth-sorted drawing
    depthList.sort((a, b) => a.yOrder - b.yOrder);
    depthList.forEach((item) => item.draw());

    // ── LAYER 7: PARTICLES & FLOATING DAMAGE TEXT ───────────────
    for (const heart of engine.particles) {
      const screen = worldToScreen(heart.x, heart.y);
      ctx.save();
      ctx.globalAlpha = heart.alpha;
      const loveImg = this.getSpriteImage("ui_expression_love");
      if (loveImg) {
        const sz = 16 * (this.zoom / 2);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(loveImg, screen.sx - sz / 2, screen.sy - sz / 2, sz, sz);
      } else {
        ctx.font = `${16 * (this.zoom / 2)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = "#f43f5e";
        ctx.fillText("♥", screen.sx, screen.sy);
      }
      ctx.restore();
    }

    for (const chip of engine.woodChips) {
      const screen = worldToScreen(chip.x, chip.y);
      ctx.fillStyle = chip.color;
      ctx.fillRect(screen.sx, screen.sy, chip.size, chip.size);
    }

    for (const text of engine.floatingTexts) {
      const screen = worldToScreen(text.x, text.y);
      ctx.save();
      ctx.globalAlpha = Math.min(1, text.life / 0.4);
      ctx.fillStyle = text.color;
      ctx.font = `bold ${12 * (this.zoom / 2)}px Outfit, sans-serif`;
      ctx.textAlign = "center";
      ctx.strokeStyle = "rgba(0,0,0,0.8)";
      ctx.lineWidth = 3;
      ctx.strokeText(text.text, screen.sx, screen.sy);
      ctx.fillText(text.text, screen.sx, screen.sy);
      ctx.restore();
    }

    // ── LAYER 8: DYNAMIC NIGHT LIGHTING CUTOUT ──────────────────
    if (engine.worldTime.lightLevel < 0.95) {
      ctx.save();
      const darkness = 1.0 - engine.worldTime.lightLevel;

      const lightCanvas = document.createElement("canvas");
      lightCanvas.width = canvas.width;
      lightCanvas.height = canvas.height;
      const lctx = lightCanvas.getContext("2d");

      if (lctx) {
        lctx.fillStyle = `rgba(10, 15, 28, ${Math.min(0.88, darkness)})`;
        lctx.fillRect(0, 0, lightCanvas.width, lightCanvas.height);
        lctx.globalCompositeOperation = "destination-out";

        // Cutout around Player
        const activeItem = engine.getActiveItemSlot()?.item;
        const isHoldingTorch = activeItem === "torch";
      if (!this.isWorldGenMode) {
        const playerScreen = worldToScreen(engine.player.x, engine.player.y);
        const playerRadius = (isHoldingTorch ? 170 : 85) * (this.zoom / 2);
        
        const playerGlow = lctx.createRadialGradient(
          playerScreen.sx + cellSize / 2,
          playerScreen.sy + cellSize / 2,
          10,
          playerScreen.sx + cellSize / 2,
          playerScreen.sy + cellSize / 2,
          playerRadius,
        );
        playerGlow.addColorStop(0, "rgba(0,0,0,1)");
        playerGlow.addColorStop(0.7, "rgba(0,0,0,0.8)");
        playerGlow.addColorStop(1, "rgba(0,0,0,0)");
        lctx.fillStyle = playerGlow;
        lctx.beginPath();
        lctx.arc(
          playerScreen.sx + cellSize / 2,
          playerScreen.sy + cellSize / 2,
          playerRadius,
          0,
          Math.PI * 2,
        );
        lctx.fill();
      }

        // Cutout around Campfires
        for (const struct of engine.placedStructures) {
          if (struct.type === "campfire") {
            const screen = worldToScreen(struct.x, struct.y);
            const campRadius = 140 * (this.zoom / 2);
            const campGlow = lctx.createRadialGradient(
              screen.sx + cellSize / 2,
              screen.sy + cellSize / 2,
              10,
              screen.sx + cellSize / 2,
              screen.sy + cellSize / 2,
              campRadius,
            );
            campGlow.addColorStop(0, "rgba(0,0,0,1)");
            campGlow.addColorStop(0.65, "rgba(0,0,0,0.75)");
            campGlow.addColorStop(1, "rgba(0,0,0,0)");
            lctx.fillStyle = campGlow;
            lctx.beginPath();
            lctx.arc(
              screen.sx + cellSize / 2,
              screen.sy + cellSize / 2,
              campRadius,
              0,
              Math.PI * 2,
            );
            lctx.fill();
          }
        }

        ctx.drawImage(lightCanvas, 0, 0);
      }
      ctx.restore();
    }

    // ── LAYER 9: BUILDING PREVIEW GHOST ─────────────────────────
    if (engine.isBuildMode && engine.buildPiece) {
      const screen = worldToScreen(engine.buildPreviewX, engine.buildPreviewY);

      ctx.save();
      ctx.fillStyle = engine.isBuildPreviewValid
        ? "rgba(34, 197, 94, 0.4)"
        : "rgba(239, 68, 68, 0.4)";
      ctx.fillRect(screen.sx, screen.sy, cellSize, cellSize);
      ctx.strokeStyle = engine.isBuildPreviewValid ? "#22c55e" : "#ef4444";
      ctx.lineWidth = 2;
      ctx.strokeRect(screen.sx, screen.sy, cellSize, cellSize);
      ctx.restore();
    }
  }
}
