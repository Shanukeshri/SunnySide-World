// ═══════════════════════════════════════════════════════════════════
// SETTLEMENT RENDERER (Canvas 2D, Pixel-perfect, Strict map.txt assets)
// ═══════════════════════════════════════════════════════════════════

import { SettlementData, PlacedObject, FarmPlot } from './SettlementGenerator';

export interface RenderOptions {
  cellSize?: number;        // default 24px
  showGrid?: boolean;       // show 16x16 grid lines
  showClearance?: boolean;  // show road clearance buffer
  showFootprints?: boolean; // show object collision footprints
}

// ═══════════════════════════════════════════════════════════════════
// ASSET PATHS & CROPS DIRECT FROM map.txt
// ═══════════════════════════════════════════════════════════════════

const TILESET_PATH = '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Tileset/spr_tileset_sunnysideworld_16px.png';
const HOUSES_PATH = '/houses.png';
const SOIL_PATH = '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/soil_01.png';

interface TilesetCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}

const TILESET_CROPS: Record<string, TilesetCrop> = {
  // Base grass
  grass_tile_01:       { x: 16,  y: 48,  w: 16, h: 16 }, // Primary flat grass
  grass_tile_02:       { x: 32,  y: 48,  w: 16, h: 16 }, // Subtle natural grass edge
  grass_tuft_01:       { x: 48,  y: 48,  w: 16, h: 16 }, // Wild grass tuft overlay
  stump_deco_01:       { x: 32,  y: 448, w: 16, h: 16 }, // Wild flora / tree root stump

  // Paths
  path_tile_01:        { x: 16,  y: 112, w: 16, h: 16 }, // Default dirt trail
  path_tile_02:        { x: 16,  y: 256, w: 16, h: 16 }, // Village cobblestone path
  path_tile_03:        { x: 544, y: 112, w: 16, h: 16 }, // Wooden boardwalk over water

  // Ground types
  dirt_tile_01:        { x: 16,  y: 112, w: 16, h: 16 }, // Rich brown soil
  sand_tile_01:        { x: 208, y: 48,  w: 16, h: 16 }, // Water-side beach sand
  stone_tile_01:       { x: 80,  y: 256, w: 16, h: 16 }, // Paved building apron stone

  // Water & Shoreline (directional)
  water_tile_01:       { x: 352, y: 112, w: 16, h: 16 }, // Blue water
  shore_transition_01: { x: 368, y: 112, w: 16, h: 16 }, // Directional shore transition (water to SE)
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
  tree_oak_01: {
    path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Plants/spr_deco_tree_01_strip4.png',
    w: 32, h: 34, cropW: 32, cropH: 34,
  },
  tree_pine_01: {
    path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Plants/spr_deco_tree_02_strip4.png',
    w: 28, h: 43, cropW: 28, cropH: 43,
  },
  farm_well: {
    path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_well/c3d011a3-e1d2-4f14-83d7-d21b9f689713.png',
    w: 20, h: 25,
  },
  farm_well_covered: {
    path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_well_covered/28ee3935-0d63-4141-b01a-2338fa50e040.png',
    w: 20, h: 40,
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
      // Fallback empty transparent image
      const fallback = new Image();
      imageCache.set(src, fallback);
      resolve(fallback);
    };
    img.src = src;
  });
}

function getCropPath(cropId: string): string {
  // e.g. crop_wheat_stage_2 -> /Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/wheat_02.png
  const parts = cropId.replace('crop_', '').split('_stage_');
  if (parts.length === 2) {
    const name = parts[0];
    const stage = parts[1].padStart(2, '0');
    return `/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/${name}_${stage}.png`;
  }
  return `/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/wheat_00.png`;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN RENDER FUNCTION
// ═══════════════════════════════════════════════════════════════════

export async function renderSettlement(
  canvas: HTMLCanvasElement,
  data: SettlementData,
  options: RenderOptions = {}
): Promise<void> {
  const cellSize = options.cellSize || 24;
  const showGrid = options.showGrid ?? false;
  const showClearance = options.showClearance ?? false;
  const showFootprints = options.showFootprints ?? false;

  canvas.width = data.width * cellSize;
  canvas.height = data.height * cellSize;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Pixel art rendering (no blur)
  ctx.imageSmoothingEnabled = false;

  // Preload primary assets
  const [tilesetImg, housesImg, soilImg] = await Promise.all([
    loadImage(TILESET_PATH),
    loadImage(HOUSES_PATH),
    loadImage(SOIL_PATH),
  ]);

  // Preload props and trees
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

  // ── LAYER 1: Base flat ground (Grass, Sand, Stone) ─────────────
  for (let y = 0; y < data.height; y++) {
    for (let x = 0; x < data.width; x++) {
      const cell = data.grid[y][x];
      const dx = x * cellSize;
      const dy = y * cellSize;

      // Draw primary grass base
      const grassCrop = TILESET_CROPS[cell.terrain === 'grass_tile_02' ? 'grass_tile_02' : 'grass_tile_01'];
      ctx.drawImage(tilesetImg, grassCrop.x, grassCrop.y, grassCrop.w, grassCrop.h, dx, dy, cellSize, cellSize);

      // Sand bank around water
      if (cell.terrain === 'sand_tile_01') {
        const sandCrop = TILESET_CROPS['sand_tile_01'];
        ctx.drawImage(tilesetImg, sandCrop.x, sandCrop.y, sandCrop.w, sandCrop.h, dx, dy, cellSize, cellSize);
      }

      // Stone paving near buildings
      if (cell.terrain === 'stone_tile_01') {
        const stoneCrop = TILESET_CROPS['stone_tile_01'];
        ctx.drawImage(tilesetImg, stoneCrop.x, stoneCrop.y, stoneCrop.w, stoneCrop.h, dx, dy, cellSize, cellSize);
      }
    }
  }

  // ── LAYER 2: Water & Rotated Shore Transitions ──────────────────
  for (let y = 0; y < data.height; y++) {
    for (let x = 0; x < data.width; x++) {
      const cell = data.grid[y][x];
      const dx = x * cellSize;
      const dy = y * cellSize;

      if (cell.isWater) {
        const waterCrop = TILESET_CROPS['water_tile_01'];
        ctx.drawImage(tilesetImg, waterCrop.x, waterCrop.y, waterCrop.w, waterCrop.h, dx, dy, cellSize, cellSize);
      } else if (cell.terrain === 'shore_transition_01') {
        const shoreCrop = TILESET_CROPS['shore_transition_01'];
        const rot = cell.rotation || 0;

        ctx.save();
        ctx.translate(dx + cellSize / 2, dy + cellSize / 2);
        ctx.rotate(rot);
        ctx.drawImage(
          tilesetImg,
          shoreCrop.x, shoreCrop.y, shoreCrop.w, shoreCrop.h,
          -cellSize / 2, -cellSize / 2, cellSize, cellSize
        );
        ctx.restore();
      }
    }
  }

  // ── LAYER 3: Road & Paths ───────────────────────────────────────
  for (let y = 0; y < data.height; y++) {
    for (let x = 0; x < data.width; x++) {
      const cell = data.grid[y][x];
      if (!cell.isRoad) continue;

      const dx = x * cellSize;
      const dy = y * cellSize;

      const pathCropKey = cell.terrain in TILESET_CROPS ? cell.terrain : 'path_tile_01';
      const pathCrop = TILESET_CROPS[pathCropKey];

      // Soft dirt road blend
      ctx.drawImage(tilesetImg, pathCrop.x, pathCrop.y, pathCrop.w, pathCrop.h, dx, dy, cellSize, cellSize);
    }
  }

  // ── LAYER 4: Farmland & Crops ───────────────────────────────────
  for (const farm of data.farms) {
    for (const c of farm.cells) {
      const dx = c.x * cellSize;
      const dy = c.y * cellSize;

      // Draw tilled furrow soil
      if (soilImg.width > 0) {
        ctx.drawImage(soilImg, dx, dy, cellSize, cellSize);
      } else {
        const dirtCrop = TILESET_CROPS['dirt_tile_01'];
        ctx.drawImage(tilesetImg, dirtCrop.x, dirtCrop.y, dirtCrop.w, dirtCrop.h, dx, dy, cellSize, cellSize);
      }

      // Draw growing crop
      const cropImg = imageCache.get(getCropPath(c.cropId));
      if (cropImg && cropImg.width > 0) {
        const scale = (cellSize * 0.75) / Math.max(cropImg.width, cropImg.height);
        const cw = cropImg.width * scale;
        const ch = cropImg.height * scale;
        const cx = dx + (cellSize - cw) / 2;
        const cy = dy + (cellSize - ch) / 2;
        ctx.drawImage(cropImg, cx, cy, cw, ch);
      }
    }
  }

  // ── LAYER 5: Ground Scatter & Natural Decorations ──────────────
  for (const deco of data.decorations) {
    const dx = deco.x * cellSize;
    const dy = deco.y * cellSize;

    if (deco.id === 'grass_tuft_01' || deco.id === 'stump_deco_01') {
      const crop = TILESET_CROPS[deco.id];
      ctx.drawImage(tilesetImg, crop.x, crop.y, crop.w, crop.h, dx, dy, cellSize, cellSize);
    } else if (deco.id in SPRITE_DEFS) {
      const def = SPRITE_DEFS[deco.id];
      const img = imageCache.get(def.path);
      if (img && img.width > 0) {
        const sx = dx + (cellSize - def.w) / 2;
        const sy = dy + (cellSize - def.h) / 2;
        ctx.drawImage(img, sx, sy, def.w, def.h);
      }
    }
  }

  // ── LAYER 6: Y-Sorted Structures (Houses, Wells, Trees) ────────
  interface DrawableEntity {
    ySort: number;
    draw: () => void;
  }

  const entities: DrawableEntity[] = [];

  // Wells
  for (const well of data.wells) {
    entities.push({
      ySort: well.y + 1,
      draw: () => {
        const def = SPRITE_DEFS[well.id];
        const img = imageCache.get(def.path);
        if (img && img.width > 0) {
          const dx = well.x * cellSize + (cellSize - def.w) / 2;
          const dy = (well.y + 1) * cellSize - def.h;

          // Shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
          ctx.beginPath();
          ctx.ellipse(dx + def.w / 2, (well.y + 1) * cellSize - 2, def.w * 0.45, 4, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.drawImage(img, dx, dy, def.w, def.h);
        }
      },
    });
  }

  // Trees
  for (const tree of data.trees) {
    entities.push({
      ySort: tree.y + 2,
      draw: () => {
        const def = SPRITE_DEFS[tree.id];
        const img = imageCache.get(def.path);
        if (img && img.width > 0) {
          // Scale tree slightly to match 2x2 grid cell footprint
          const targetW = cellSize * 2;
          const aspect = def.h / def.w;
          const targetH = targetW * aspect;

          const dx = tree.x * cellSize;
          const dy = (tree.y + 2) * cellSize - targetH;

          // Tree trunk shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
          ctx.beginPath();
          ctx.ellipse(dx + targetW / 2, (tree.y + 2) * cellSize - 3, targetW * 0.35, 6, 0, 0, Math.PI * 2);
          ctx.fill();

          // Draw first frame from animated strip
          const cropW = def.cropW || def.w;
          const cropH = def.cropH || def.h;
          ctx.drawImage(img, 0, 0, cropW, cropH, dx, dy, targetW, targetH);
        }
      },
    });
  }

  // Houses
  for (const house of data.houses) {
    entities.push({
      ySort: house.y + house.footprintH,
      draw: () => {
        const crop = HOUSE_CROPS[house.id];
        if (crop && housesImg.width > 0) {
          const [cx, cy, cw, ch] = crop;

          // Fit house sprite proportionally over its footprint
          const footprintPixelW = house.footprintW * cellSize;
          const footprintPixelH = house.footprintH * cellSize;

          const scale = Math.min(
            (footprintPixelW * 1.15) / cw,
            (footprintPixelH * 1.35) / ch
          );
          const dw = cw * scale;
          const dh = ch * scale;

          const dx = house.x * cellSize + (footprintPixelW - dw) / 2;
          const dy = (house.y + house.footprintH) * cellSize - dh + 4;

          // Soft ambient drop shadow under house base
          ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          ctx.beginPath();
          ctx.ellipse(
            dx + dw / 2,
            (house.y + house.footprintH) * cellSize - 2,
            dw * 0.46,
            8,
            0,
            0,
            Math.PI * 2
          );
          ctx.fill();

          ctx.drawImage(housesImg, cx, cy, cw, ch, dx, dy, dw, dh);
        }
      },
    });
  }

  // Sort and draw entities back-to-front
  entities.sort((a, b) => a.ySort - b.ySort);
  for (const ent of entities) {
    ent.draw();
  }

  // ── LAYER 7: Debug Overlays (Optional) ──────────────────────────
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
    // Highlight house footprints
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

    // Highlight farm bounds
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
}
