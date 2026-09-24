// ═══════════════════════════════════════════════════════════════════
// SETTLEMENT RENDERER (Canvas 2D, Pixel-perfect, Strict map.txt assets)
// ═══════════════════════════════════════════════════════════════════

import { SettlementData } from './SettlementGenerator';
import { Animal } from '../lifeforms/Animal';
import { NPC } from '../lifeforms/NPC';
import { Player } from '../lifeforms/Player';
import { HeartParticle } from '../lifeforms/types';
import { LifeformRenderer } from '../lifeforms/LifeformRenderer';

export interface RenderOptions {
  cellSize?: number;        // default 24px
  showGrid?: boolean;       // show 16x16 grid lines
  showClearance?: boolean;  // show road clearance buffer
  showFootprints?: boolean; // show object collision footprints
}

export interface DynamicLifeforms {
  animals: readonly Animal[];
  npcs: readonly NPC[];
  player: Player | null;
  particles: readonly HeartParticle[];
}

export interface PreparedSettlementScene {
  data: SettlementData;
  cellSize: number;
  backgroundCanvas: HTMLCanvasElement;
  renderFrame: (
    targetCanvas: HTMLCanvasElement,
    lifeforms?: DynamicLifeforms,
    lifeformRenderer?: LifeformRenderer,
    options?: RenderOptions
  ) => void;
}

// ═══════════════════════════════════════════════════════════════════
// ASSET PATHS & CROPS DIRECT FROM map.txt
// ═══════════════════════════════════════════════════════════════════

const TILESET_PATH = '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Tileset/spr_tileset_sunnysideworld_16px.png';
const HOUSES_PATH = '/houses.png';
const SOIL_PATH = '/assets/tilled_soil.png';
const TREES_AND_BUSHES_PATH = '/trees_and_bushes.png';

interface TilesetCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Pixel-perfect sprite boundaries from assets/trees_and_bushes.png (192x192 image, 3x3 grid with padding)
// Trees: row 0 (indices 0-2), row 1 (indices 3-4)
// Bushes: row 1 col 2 (index 5), row 2 (indices 6-8)
const TREE_BUSH_CROPS: Record<string, TilesetCrop> = {
  // Trees (first 5 sprites from assets/trees_and_bushes.png)
  tree_01: { x: 10,  y: 10,  w: 50, h: 57 }, // Round Deciduous Tree (canopy + trunk + shadow)
  tree_02: { x: 73,  y: 10,  w: 48, h: 57 }, // Pointed-Leaf Oak / Maple Tree (canopy + trunk + shadow)
  tree_03: { x: 131, y: 11,  w: 51, h: 56 }, // Weeping Willow Tree with trailing vines + shadow
  tree_04: { x: 10,  y: 75,  w: 49, h: 52 }, // Flowering Tree with vibrant red blossoms + shadow
  tree_05: { x: 73,  y: 75,  w: 49, h: 52 }, // Tiered Cloud / Pine Canopy Tree + shadow
  // Bushes (last 4 sprites from assets/trees_and_bushes.png)
  bush_01: { x: 133, y: 84,  w: 46, h: 42 }, // White Blossom Bush + shadow
  bush_02: { x: 12,  y: 139, w: 46, h: 42 }, // Red Flower / Berry Bush + shadow
  bush_03: { x: 72,  y: 138, w: 48, h: 44 }, // Fern / Broadleaf Green Bush + shadow
  bush_04: { x: 133, y: 135, w: 48, h: 46 }, // Tropical Croton / Red Spike Bush + shadow
};

const TILESET_CROPS: Record<string, TilesetCrop> = {
  // Authentic textured grass variants (row 2, columns 1-6, y=32)
  grass_textured_01:   { x: 16,  y: 32,  w: 16, h: 16 }, // Textured grass with circle patterns (2,1)
  grass_textured_02:   { x: 32,  y: 32,  w: 16, h: 16 }, // Textured grass with cross speckles (2,2)
  grass_textured_03:   { x: 48,  y: 32,  w: 16, h: 16 }, // Textured grass with round motif (2,3)
  grass_textured_04:   { x: 64,  y: 32,  w: 16, h: 16 }, // Textured grass with dark circular patch (2,4)
  grass_textured_05:   { x: 80,  y: 32,  w: 16, h: 16 }, // Textured grass with clover accent (2,5)
  grass_textured_06:   { x: 96,  y: 32,  w: 16, h: 16 }, // Textured grass with blossom accent (2,6)

  // Path variants (same dirt trail group row y=112)
  path_tile_01:        { x: 16,  y: 112, w: 16, h: 16 }, // Primary dirt trail
  path_tile_02:        { x: 144, y: 112, w: 16, h: 16 }, // Dirt trail with fine pebbles
  path_tile_04:        { x: 160, y: 112, w: 16, h: 16 }, // Dirt trail with light stones
  path_tile_05:        { x: 176, y: 112, w: 16, h: 16 }, // Dirt trail with earth grain

  // Ground types
  dirt_tile_01:        { x: 16,  y: 112, w: 16, h: 16 }, // Rich brown soil
  sand_tile_01:        { x: 208, y: 48,  w: 16, h: 16 }, // Water-side beach sand
  stone_tile_01:       { x: 80,  y: 256, w: 16, h: 16 }, // Paved building apron stone

  // Clean Water (pure calm cyan water & diagonal shore corner transition)
  water_tile_01:       { x: 352, y: 112, w: 16, h: 16 }, // Calm cyan water
  shore_transition_01: { x: 368, y: 112, w: 16, h: 16 }, // Unidirectional diagonal shore corner transition

  // Wooden Fences (from tileset block 0,38 to 4,42)
  fence_wood_h:         { x: 624, y: 32,  w: 16, h: 16 }, // Horizontal scaling wooden fence rail (2,39)
  fence_wood_v:         { x: 640, y: 48,  w: 16, h: 16 }, // Vertical wooden fence rail (North-South, 3,40)
  fence_wood_corner:    { x: 640, y: 32,  w: 16, h: 16 }, // Wooden fence corner tile (2,40)
  fence_wood_corner_tl: { x: 640, y: 32,  w: 16, h: 16 }, // Top-Left corner (2,40)
  fence_wood_corner_tr: { x: 640, y: 32,  w: 16, h: 16 }, // Top-Right corner (2,40)
  fence_wood_corner_bl: { x: 640, y: 32,  w: 16, h: 16 }, // Bottom-Left corner (2,40)
  fence_wood_corner_br: { x: 640, y: 32,  w: 16, h: 16 }, // Bottom-Right corner (2,40)
  fence_wood_post:      { x: 640, y: 32,  w: 16, h: 16 }, // Wooden fence corner post (2,40)
  fence_wood_gate:      { x: 624, y: 0,   w: 16, h: 16 }, // Wooden fence gate / top rail (0,39)
};

// Standalone house sprite crops from houses.png (native dimensions from map.txt / main.ts)
const HOUSE_CROPS: Record<string, [number, number, number, number]> = {
  house_cottage_01:    [89,   50,  215, 204],
  house_farmhouse_01:  [435,  72,  292, 181],
  house_barn_01:       [873,  38,  179, 212],
  house_workshop_01:   [1186, 60,  274, 197],
  house_tavern_01:     [74,   270, 228, 210],
  house_shop_01:       [444,  307, 280, 174],
  house_windmill_01:   [1198, 545, 258, 158],
  house_mansion_01:    [67,   734, 240, 227],
  house_cabin_01:      [457,  769, 262, 198],
  house_castle_01:     [841,  734, 231, 232],
};

// Standalone sprites from Sunnyside asset pack
interface SpriteDef {
  path: string;
  w: number;
  h: number;
  cropW?: number;
  cropH?: number;
}

const SPRITE_DEFS: Record<string, SpriteDef> = {
  farm_well: {
    path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_well/c3d011a3-e1d2-4f14-83d7-d21b9f689713.png',
    w: 20, h: 25,
  },
  farm_well_covered: {
    path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_well_covered/28ee3935-0d63-4141-b01a-2338fa50e040.png',
    w: 20, h: 40,
  },
  farm_trough: {
    path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_trough/e83dc18e-a89c-4aae-999e-4531c1c9bb02.png',
    w: 29, h: 16,
  },
  farm_waterbowl: {
    path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_waterbowl/fb5f5698-0641-4a29-aad1-d97504abe0d6.png',
    w: 8, h: 11,
  },
  farm_crate_01: {
    path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_crate_01/658157b4-7ff5-452e-9e1d-c4cad561928b.png',
    w: 16, h: 21,
  },
  farm_crate_02: {
    path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_crate_02/d9ac3d57-03c4-4730-98eb-600ee4457ee2.png',
    w: 16, h: 21,
  },
  farm_chest_closed: {
    path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_chest_01_closed/496b079e-4729-46a2-8b47-cff42b294c71.png',
    w: 16, h: 21,
  },
  small_rock_01: {
    path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/rock.png',
    w: 10, h: 10,
  },
  flowers_wild_01: {
    path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_flowers_house_01/36388643-e82c-4037-97b4-3d1fa4cb65fb.png',
    w: 8, h: 18,
  },
  flowers_wild_02: {
    path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_flowers_house_02/93175c94-bed5-4a79-9562-232e8f9f075e.png',
    w: 12, h: 19,
  },
  mushrooms_deco_blue: {
    path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_mushroom_blue_01/28f072d2-4413-4dab-a4b7-7473337cd625.png',
    w: 16, h: 16,
  },
  mushrooms_deco_red: {
    path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_mushroom_red_01/32c3ffa9-6757-47f4-9800-5b7024450659.png',
    w: 16, h: 16,
  },
  acorn_deco_01: {
    path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_acron/ada48c07-f133-4861-ac13-16e671ac36cd.png',
    w: 10, h: 9,
  },
  truffle_deco_01: {
    path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_truffle/e6dbb225-174c-41bd-ab66-36e9fff04f0a.png',
    w: 10, h: 10,
  },
};

// ═══════════════════════════════════════════════════════════════════
// IMAGE CACHE
// ═══════════════════════════════════════════════════════════════════

const imageCache: Map<string, HTMLImageElement> = new Map();

function loadImage(src: string): Promise<HTMLImageElement> {
  if (imageCache.has(src)) {
    return Promise.resolve(imageCache.get(src)!);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => {
      const fallback = new Image();
      imageCache.set(src, fallback);
      resolve(fallback);
    };
    img.src = src;
  });
}

function getCropPath(cropId: string): string {
  const parts = cropId.replace('crop_', '').split('_stage_');
  if (parts.length === 2) {
    const name = parts[0];
    const stage = parts[1].padStart(2, '0');
    return `/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/${name}_${stage}.png`;
  }
  return `/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/wheat_00.png`;
}

// ═══════════════════════════════════════════════════════════════════
// PREPARE SETTLEMENT SCENE & RENDER PIPELINE
// ═══════════════════════════════════════════════════════════════════

export async function prepareSettlementScene(
  data: SettlementData,
  options: RenderOptions = {}
): Promise<PreparedSettlementScene> {
  const cellSize = options.cellSize || 24;

  // Preload primary assets
  const [tilesetImg, housesImg, soilImg, treeBushImg] = await Promise.all([
    loadImage(TILESET_PATH),
    loadImage(HOUSES_PATH),
    loadImage(SOIL_PATH),
    loadImage(TREES_AND_BUSHES_PATH),
  ]);

  // Preload props, trees, and farm objects
  const spritePromises: Promise<HTMLImageElement>[] = [];
  for (const key of Object.keys(SPRITE_DEFS)) {
    spritePromises.push(loadImage(SPRITE_DEFS[key].path));
  }
  // Preload crops
  for (const farm of data.farms) {
    for (const cell of farm.cells) {
      spritePromises.push(loadImage(getCropPath(cell.cropId)));
    }
  }
  await Promise.all(spritePromises);

  // ── PRE-RENDER STATIC GROUND TO OFFSCREEN CANVAS (Layers 1-5) ──
  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = data.width * cellSize;
  bgCanvas.height = data.height * cellSize;
  const bgCtx = bgCanvas.getContext('2d');

  if (bgCtx) {
    bgCtx.imageSmoothingEnabled = false;

    // ── LAYER 1: Base flat ground (Grass, Sand, Stone) ─────────────
    for (let y = 0; y < data.height; y++) {
      for (let x = 0; x < data.width; x++) {
        const cell = data.grid[y][x];
        const dx = x * cellSize;
        const dy = y * cellSize;

        const grassCropKey =
          cell.terrain in TILESET_CROPS &&
          (cell.terrain.startsWith('grass_textured_') || cell.terrain.startsWith('grass_tile_'))
            ? cell.terrain
            : 'grass_textured_01';
        const grassCrop = TILESET_CROPS[grassCropKey] || TILESET_CROPS['grass_textured_01'];
        bgCtx.drawImage(tilesetImg, grassCrop.x, grassCrop.y, grassCrop.w, grassCrop.h, dx, dy, cellSize, cellSize);

        if (cell.terrain === 'sand_tile_01') {
          const sandCrop = TILESET_CROPS['sand_tile_01'];
          bgCtx.drawImage(tilesetImg, sandCrop.x, sandCrop.y, sandCrop.w, sandCrop.h, dx, dy, cellSize, cellSize);
        }

        if (cell.terrain === 'stone_tile_01') {
          const stoneCrop = TILESET_CROPS['stone_tile_01'];
          bgCtx.drawImage(tilesetImg, stoneCrop.x, stoneCrop.y, stoneCrop.w, stoneCrop.h, dx, dy, cellSize, cellSize);
        }
      }
    }

    // ── LAYER 2: Water Bodies & Rotated Diagonal Corner Transitions ──
    for (let y = 0; y < data.height; y++) {
      for (let x = 0; x < data.width; x++) {
        const cell = data.grid[y][x];
        if (!cell.isWater && !cell.terrain.startsWith('water_tile_') && cell.terrain !== 'shore_transition_01') continue;

        const dx = x * cellSize;
        const dy = y * cellSize;

        if (cell.terrain === 'shore_transition_01') {
          const shoreCrop = TILESET_CROPS['shore_transition_01'];
          const rot = cell.rotation || 0;

          bgCtx.save();
          bgCtx.translate(dx + cellSize / 2, dy + cellSize / 2);
          bgCtx.rotate(rot);
          bgCtx.drawImage(
            tilesetImg,
            shoreCrop.x, shoreCrop.y, shoreCrop.w, shoreCrop.h,
            -cellSize / 2, -cellSize / 2, cellSize, cellSize
          );
          bgCtx.restore();
        } else {
          const waterCrop = TILESET_CROPS['water_tile_01'];
          bgCtx.drawImage(tilesetImg, waterCrop.x, waterCrop.y, waterCrop.w, waterCrop.h, dx, dy, cellSize, cellSize);
        }
      }
    }

    // ── LAYER 3: Road & Paths ───────────────────────────────────────
    for (let y = 0; y < data.height; y++) {
      for (let x = 0; x < data.width; x++) {
        const cell = data.grid[y][x];
        if (!cell.isRoad || cell.isWater) continue;

        const dx = x * cellSize;
        const dy = y * cellSize;

        const pathCropKey =
          cell.terrain in TILESET_CROPS && cell.terrain.startsWith('path_tile_')
            ? cell.terrain
            : 'path_tile_01';
        const pathCrop = TILESET_CROPS[pathCropKey] || TILESET_CROPS['path_tile_01'];

        bgCtx.drawImage(tilesetImg, pathCrop.x, pathCrop.y, pathCrop.w, pathCrop.h, dx, dy, cellSize, cellSize);
      }
    }

    // ── LAYER 4: Farmland Tilled Soil Ground ───────────────────────
    for (const farm of data.farms) {
      for (const c of farm.cells) {
        const dx = c.x * cellSize;
        const dy = c.y * cellSize;

        if (soilImg.width > 0) {
          bgCtx.drawImage(soilImg, dx, dy, cellSize, cellSize);
        } else {
          const dirtCrop = TILESET_CROPS['dirt_tile_01'];
          bgCtx.drawImage(tilesetImg, dirtCrop.x, dirtCrop.y, dirtCrop.w, dirtCrop.h, dx, dy, cellSize, cellSize);
        }
      }
    }

    // ── LAYER 5: Ground Scatter & Natural Decorations ──────────────
    for (const deco of data.decorations) {
      const dx = deco.x * cellSize;
      const dy = deco.y * cellSize;

      if (deco.id in TILESET_CROPS) {
        const crop = TILESET_CROPS[deco.id];
        bgCtx.drawImage(tilesetImg, crop.x, crop.y, crop.w, crop.h, dx, dy, cellSize, cellSize);
      } else if (deco.id in SPRITE_DEFS) {
        const def = SPRITE_DEFS[deco.id];
        const img = imageCache.get(def.path);
        if (img && img.width > 0) {
          const isLyingSmall = deco.id === 'acorn_deco_01' || deco.id === 'truffle_deco_01' || deco.id.includes('berry');
          const targetDim = isLyingSmall ? cellSize * 0.45 : cellSize * 0.85;
          const scale = targetDim / Math.max(def.w, def.h);
          const dw = def.w * scale;
          const dh = def.h * scale;
          const sx = dx + (cellSize - dw) / 2;
          const sy = dy + (cellSize - dh) / 2;
          bgCtx.drawImage(img, sx, sy, dw, dh);
        }
      }
    }
  }

  // Define render frame callback
  const renderFrame = (
    targetCanvas: HTMLCanvasElement,
    lifeforms?: DynamicLifeforms,
    lifeformRenderer?: LifeformRenderer,
    frameOptions: RenderOptions = {}
  ): void => {
    const showGrid = frameOptions.showGrid ?? options.showGrid ?? false;
    const showClearance = frameOptions.showClearance ?? options.showClearance ?? false;
    const showFootprints = frameOptions.showFootprints ?? options.showFootprints ?? false;

    if (targetCanvas.width !== bgCanvas.width) targetCanvas.width = bgCanvas.width;
    if (targetCanvas.height !== bgCanvas.height) targetCanvas.height = bgCanvas.height;

    const ctx = targetCanvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    // Blit pre-rendered background
    ctx.drawImage(bgCanvas, 0, 0);

    // ── LAYER 6: Y-Sorted Structures & Lifeforms ──────────────────
    interface DrawableEntity {
      ySort: number;
      draw: () => void;
    }

    const entities: DrawableEntity[] = [];

    // Farm Crops (Sown on top of tilled soil, Y-sorted so character/animals walking behind hide behind them)
    for (const farm of data.farms) {
      for (const c of farm.cells) {
        entities.push({
          ySort: c.y + 0.999, // Rooted in tilled soil cell (occludes entities walking behind or through furrow)
          draw: () => {
            const cropImg = imageCache.get(getCropPath(c.cropId));
            if (cropImg && cropImg.width > 0) {
              const scale = cellSize / 16;
              const cw = Math.round(cropImg.width * scale);
              const ch = Math.round(cropImg.height * scale);
              const cx = Math.round(c.x * cellSize + (cellSize - cw) / 2);
              const cy = Math.round((c.y + 0.88) * cellSize - ch);
              ctx.drawImage(cropImg, cx, cy, cw, ch);
            }
          },
        });
      }
    }

    // Farm Objects & Continuous Fences
    if (data.farmObjects) {
      for (const obj of data.farmObjects) {
        entities.push({
          ySort: obj.y + 1,
          draw: () => {
            if (obj.id in TILESET_CROPS) {
              const crop = TILESET_CROPS[obj.id];
              ctx.drawImage(
                tilesetImg,
                crop.x, crop.y, crop.w, crop.h,
                obj.x * cellSize, obj.y * cellSize, cellSize, cellSize
              );
            } else if (obj.id in SPRITE_DEFS) {
              const def = SPRITE_DEFS[obj.id];
              const img = imageCache.get(def.path);
              if (img && img.width > 0) {
                const scale = cellSize / Math.max(def.w, def.h);
                const dw = def.w * scale;
                const dh = def.h * scale;
                const ddx = obj.x * cellSize + (cellSize - dw) / 2;
                const ddy = (obj.y + 1) * cellSize - dh;
                ctx.drawImage(img, ddx, ddy, dw, dh);
              }
            }
          },
        });
      }
    }

    // Wells
    for (const well of data.wells) {
      entities.push({
        ySort: well.y + 1,
        draw: () => {
          const def = SPRITE_DEFS[well.id];
          const img = imageCache.get(def.path);
          if (img && img.width > 0) {
            const scale = cellSize / Math.max(def.w, def.h);
            const dw = def.w * scale;
            const dh = def.h * scale;
            const dx = well.x * cellSize + (cellSize - dw) / 2;
            const dy = (well.y + 1) * cellSize - dh;
            ctx.drawImage(img, dx, dy, dw, dh);
          }
        },
      });
    }

    // Trees
    for (const tree of data.trees) {
      entities.push({
        ySort: tree.y + 2,
        draw: () => {
          const crop = TREE_BUSH_CROPS[tree.id] || TREE_BUSH_CROPS['tree_01'];
          if (treeBushImg && treeBushImg.width > 0) {
            const targetW = cellSize * 3;
            const aspect = crop.h / crop.w;
            const targetH = targetW * aspect;
            const dx = tree.x * cellSize - (targetW - cellSize * 2) / 2;
            const dy = (tree.y + 2) * cellSize - targetH;
            ctx.drawImage(treeBushImg, crop.x, crop.y, crop.w, crop.h, dx, dy, targetW, targetH);
          }
        },
      });
    }

    // Bushes
    if (data.bushes) {
      for (const bush of data.bushes) {
        entities.push({
          ySort: bush.y + 1,
          draw: () => {
            const crop = TREE_BUSH_CROPS[bush.id] || TREE_BUSH_CROPS['bush_01'];
            if (treeBushImg && treeBushImg.width > 0) {
              const bushW = cellSize;
              const aspect = crop.h / crop.w;
              const bushH = bushW * aspect;
              const dx = bush.x * cellSize + (cellSize - bushW) / 2;
              const dy = (bush.y + 1) * cellSize - bushH;
              ctx.drawImage(treeBushImg, crop.x, crop.y, crop.w, crop.h, dx, dy, bushW, bushH);
            }
          },
        });
      }
    }

    // Houses
    for (const house of data.houses) {
      entities.push({
        ySort: house.y + house.footprintH,
        draw: () => {
          const crop = HOUSE_CROPS[house.id];
          if (crop && housesImg.width > 0) {
            const [cx, cy, cw, ch] = crop;
            const footprintPixelW = house.footprintW * cellSize;
            const footprintPixelH = house.footprintH * cellSize;
            const scale = Math.min((footprintPixelW * 1.15) / cw, (footprintPixelH * 1.35) / ch);
            const dw = cw * scale;
            const dh = ch * scale;
            const dx = house.x * cellSize + (footprintPixelW - dw) / 2;
            const dy = (house.y + house.footprintH) * cellSize - dh + 4;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.beginPath();
            ctx.ellipse(dx + dw / 2, (house.y + house.footprintH) * cellSize - 2, dw * 0.46, 8, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.drawImage(housesImg, cx, cy, cw, ch, dx, dy, dw, dh);
          }
        },
      });
    }

    // Dynamic Lifeforms (Animals, Villagers, Player)
    let targetedAnimal: Animal | null = null;
    if (lifeforms && lifeformRenderer) {
      // if (lifeforms.player) {
      //   targetedAnimal = lifeforms.player.findNearbyInteractable(lifeforms.animals as Animal[], 2.0);
      // }

      // Animals
      for (const animal of lifeforms.animals) {
        if (!animal.isActive) continue;
        entities.push({
          ySort: animal.position.y,
          draw: () => {
            lifeformRenderer.renderEntity(ctx, animal, cellSize, animal === targetedAnimal);
          },
        });
      }

      // NPCs
      for (const npc of lifeforms.npcs) {
        if (!npc.isActive) continue;
        entities.push({
          ySort: npc.position.y,
          draw: () => {
            lifeformRenderer.renderEntity(ctx, npc, cellSize);
          },
        });
      }

      // Player removed from generator view
      // if (lifeforms?.player && lifeforms.player.isActive) {
      //   const player = lifeforms.player;
      //   entities.push({
      //     ySort: player.position.y,
      //     draw: () => {
      //       lifeformRenderer.renderEntity(ctx, player, cellSize);
      //     },
      //   });
      // }
    }

    // Sort and draw entities back-to-front
    entities.sort((a, b) => a.ySort - b.ySort);
    for (const ent of entities) {
      ent.draw();
    }

    // Dynamic particles & HUD prompt overlays
    if (lifeforms && lifeformRenderer) {
      lifeformRenderer.renderParticles(ctx, lifeforms.particles, cellSize);
      if (targetedAnimal) {
        lifeformRenderer.renderInteractionPrompt(ctx, targetedAnimal, cellSize);
      }
    }

    // ── LAYER 7: Debug Overlays ────────────────────────────────────
    if (showClearance) {
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
      ctx.lineWidth = 1;
      for (let y = 0; y < data.height; y++) {
        for (let x = 0; x < data.width; x++) {
          if (data.grid[y][x].isRoadReserved && !data.grid[y][x].isRoad) {
            ctx.strokeRect(x * cellSize + 0.5, y * cellSize + 0.5, cellSize - 1, cellSize - 1);
          }
        }
      }
    }

    if (showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= data.width; x++) {
        ctx.beginPath();
        ctx.moveTo(x * cellSize, 0);
        ctx.lineTo(x * cellSize, data.height * cellSize);
        ctx.stroke();
      }
      for (let y = 0; y <= data.height; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * cellSize);
        ctx.lineTo(data.width * cellSize, y * cellSize);
        ctx.stroke();
      }
    }

    if (showFootprints) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      for (const h of data.houses) {
        ctx.strokeRect(
          h.x * cellSize + 1,
          h.y * cellSize + 1,
          h.footprintW * cellSize - 2,
          h.footprintH * cellSize - 2
        );
      }

      ctx.strokeStyle = '#10b981';
      for (const f of data.farms) {
        ctx.strokeRect(
          f.x * cellSize + 1,
          f.y * cellSize + 1,
          f.w * cellSize - 2,
          f.h * cellSize - 2
        );
      }
    }
  };

  return {
    data,
    cellSize,
    backgroundCanvas: bgCanvas,
    renderFrame,
  };
}

export async function renderSettlement(
  canvas: HTMLCanvasElement,
  data: SettlementData,
  options: RenderOptions = {}
): Promise<void> {
  const scene = await prepareSettlementScene(data, options);
  scene.renderFrame(canvas, undefined, undefined, options);
}

