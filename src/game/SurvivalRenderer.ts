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

  // Authentic Water River, Pond & Lake Autotiling (columns 22..32, rows 7..8)
  water_tile_01: { x: 352, y: 112, w: 16, h: 16 }, // Calm cyan water (tid 470)
  water_pond_center_01: { x: 352, y: 112, w: 16, h: 16 },
  water_depth_01: { x: 480, y: 128, w: 16, h: 16 }, // Water ripple variant (tid 542)
  water_depth_02: { x: 512, y: 128, w: 16, h: 16 }, // Water bubble variant (tid 544)

  // Diagonal water corner transitions (when water turns around a land corner):
  water_diag_nw: { x: 368, y: 112, w: 16, h: 16 }, // tid 471: Land NW, Water SE
  water_diag_ne: { x: 384, y: 112, w: 16, h: 16 }, // tid 472: Land NE, Water SW
  water_diag_sw: { x: 416, y: 112, w: 16, h: 16 }, // tid 474: Land SW, Water NE
  water_diag_se: { x: 352, y: 128, w: 16, h: 16 }, // tid 534: Land SE, Water NW

  // River & Pond Banks (placed on LAND bordering water):
  water_bank_n: { x: 400, y: 112, w: 16, h: 16 }, // tid 473: Land N, scallops face S into water
  water_bank_s: { x: 416, y: 128, w: 16, h: 16 }, // tid 538: Land S, scallops face N into water
  water_bank_w: { x: 432, y: 112, w: 16, h: 16 }, // tid 475: Land W, scallops face E into water
  water_bank_e: { x: 384, y: 128, w: 16, h: 16 }, // tid 536: Land E, scallops face W into water

  // Outer corners on LAND bordering water:
  water_corner_nw: { x: 464, y: 112, w: 16, h: 16 }, // tid 477: Land NW, water SE
  water_corner_ne: { x: 400, y: 128, w: 16, h: 16 }, // tid 537: Land NE, water SW
  water_corner_sw: { x: 432, y: 128, w: 16, h: 16 }, // tid 539: Land SW, water NE
  water_corner_se: { x: 448, y: 128, w: 16, h: 16 }, // tid 540: Land SE, water NW
  water_inner_nw: { x: 384, y: 112, w: 16, h: 16 },
  water_inner_ne: { x: 416, y: 112, w: 16, h: 16 },
  water_inner_sw: { x: 464, y: 128, w: 16, h: 16 },
  water_inner_se: { x: 368, y: 128, w: 16, h: 16 },

  // Water Wave Foam animation frames (y=304)
  water_foam_01: { x: 896, y: 304, w: 16, h: 16 },
  water_foam_02: { x: 912, y: 304, w: 16, h: 16 },
  water_foam_03: { x: 928, y: 304, w: 16, h: 16 },
  water_foam_04: { x: 944, y: 304, w: 16, h: 16 },
  water_foam_05: { x: 960, y: 304, w: 16, h: 16 },
  water_foam_06: { x: 976, y: 304, w: 16, h: 16 },

  // Authentic Dirt Path Autotiling (columns 1..11, rows 7..8)
  path_center: { x: 16, y: 112, w: 16, h: 16 },
  path_tile_01: { x: 16, y: 112, w: 16, h: 16 },
  dirt_tile_01: { x: 16, y: 112, w: 16, h: 16 },
  sand_tile_01: { x: 80, y: 16, w: 16, h: 16 }, // tid 69: Pure sand
  sand_foam_h: { x: 320, y: 80, w: 16, h: 16 }, // tid 340: Sand shoreline wave foam
  sand_foam_c1: { x: 304, y: 80, w: 16, h: 16 }, // tid 339: Sand corner foam 1
  sand_foam_c2: { x: 304, y: 96, w: 16, h: 16 }, // tid 403: Sand corner foam 2
  stone_tile_01: { x: 720, y: 32, w: 16, h: 16 },

  // Authentic Native Dual-Grid Water <-> Sand Coastlines (zero rotation distortion)
  coast_sand_n: { x: 96, y: 512, w: 16, h: 16 }, // Sand North, Water South
  coast_sand_s: { x: 96, y: 448, w: 16, h: 16 }, // Sand South, Water North
  coast_sand_w: { x: 128, y: 480, w: 16, h: 16 }, // Sand West, Water East
  coast_sand_e: { x: 64, y: 480, w: 16, h: 16 }, // Sand East, Water West
  coast_corner_nw: { x: 112, y: 496, w: 16, h: 16 }, // Sand N & W, Water S & E
  coast_corner_ne: { x: 80, y: 496, w: 16, h: 16 }, // Sand N & E, Water S & W
  coast_corner_sw: { x: 112, y: 464, w: 16, h: 16 }, // Sand S & W, Water N & E
  coast_corner_se: { x: 80, y: 464, w: 16, h: 16 }, // Sand S & E, Water N & W
  coast_inner_nw: { x: 112, y: 512, w: 16, h: 16 }, // Land at NW diagonal
  coast_inner_ne: { x: 80, y: 512, w: 16, h: 16 }, // Land at NE diagonal
  coast_inner_sw: { x: 112, y: 448, w: 16, h: 16 }, // Land at SW diagonal
  coast_inner_se: { x: 80, y: 448, w: 16, h: 16 }, // Land at SE diagonal

  // Outer turn corners (where dirt road curves smoothly):
  path_corner_tl: { x: 32, y: 112, w: 16, h: 16 }, // tid 450: outer NW curve (Dirt goes S & E)
  path_corner_tr: { x: 48, y: 112, w: 16, h: 16 }, // tid 451: outer NE curve (Dirt goes S & W)
  path_corner_bl: { x: 80, y: 112, w: 16, h: 16 }, // tid 453: outer SW curve (Dirt goes N & E)
  path_corner_br: { x: 16, y: 128, w: 16, h: 16 }, // tid 513: outer SE curve (Dirt goes N & W)

  // Border fringes and dead-end caps:
  path_top: { x: 80, y: 128, w: 16, h: 16 }, // tid 517: North border (green at y=0..2)
  path_bottom: { x: 64, y: 112, w: 16, h: 16 }, // tid 452: South border (green at y=13..15)
  path_left: { x: 48, y: 128, w: 16, h: 16 }, // tid 515: West border (green at x=0..2)
  path_right: { x: 96, y: 112, w: 16, h: 16 }, // tid 454: East border (green at x=13..15)

  // Inner corner notches (when dirt is on multiple sides):
  path_notch_nw: { x: 112, y: 128, w: 16, h: 16 }, // tid 519: NW notch (green at x=0..2, y=0..1)
  path_notch_ne: { x: 96, y: 128, w: 16, h: 16 }, // tid 518: NE notch (green at x=13..15, y=0..1)
  path_notch_sw: { x: 64, y: 128, w: 16, h: 16 }, // tid 516: SW notch (green at x=0..2, y=14..15)
  path_notch_se: { x: 128, y: 112, w: 16, h: 16 }, // tid 456: SE notch (green at x=13..15, y=14..15)
  path_straight_h: { x: 48, y: 112, w: 16, h: 16 },
  path_straight_v: { x: 32, y: 128, w: 16, h: 16 },

  // Path pebble scatter variations (columns 9..11, rows 7..8)
  path_pebble_01: { x: 144, y: 112, w: 16, h: 16 },
  path_pebble_02: { x: 160, y: 112, w: 16, h: 16 },
  path_pebble_03: { x: 176, y: 112, w: 16, h: 16 },
  path_pebble_04: { x: 144, y: 128, w: 16, h: 16 },
  path_pebble_05: { x: 160, y: 128, w: 16, h: 16 },

  // Cobblestone 3x3 autotile (x: 704..736, y: 16..48)
  cobble_tl: { x: 704, y: 16, w: 16, h: 16 },
  cobble_t: { x: 720, y: 16, w: 16, h: 16 },
  cobble_tr: { x: 736, y: 16, w: 16, h: 16 },
  cobble_l: { x: 704, y: 32, w: 16, h: 16 },
  cobble_c: { x: 720, y: 32, w: 16, h: 16 },
  cobble_r: { x: 736, y: 32, w: 16, h: 16 },
  cobble_bl: { x: 704, y: 48, w: 16, h: 16 },
  cobble_b: { x: 720, y: 48, w: 16, h: 16 },
  cobble_br: { x: 736, y: 48, w: 16, h: 16 },

  // Authentic Wooden Bridges (over water)
  bridge_wood_h: { x: 608, y: 80, w: 16, h: 16 },
  bridge_wood_v: { x: 640, y: 80, w: 16, h: 16 },
  bridge_deck_h: { x: 608, y: 80, w: 16, h: 16 },
  bridge_deck_v: { x: 640, y: 80, w: 16, h: 16 },
  bridge_wood_h_ramp_l: { x: 592, y: 80, w: 16, h: 16 },
  bridge_wood_h_ramp_r: { x: 624, y: 80, w: 16, h: 16 },
  bridge_wood_v_ramp_n: { x: 640, y: 64, w: 16, h: 16 },
  bridge_wood_v_ramp_s: { x: 640, y: 96, w: 16, h: 16 },

  // Wooden Fences & Bridges
  fence_wood_h: { x: 624, y: 32, w: 16, h: 16 },
  fence_wood_v: { x: 640, y: 48, w: 16, h: 16 },
  fence_wood_corner: { x: 640, y: 32, w: 16, h: 16 },
  fence_wood_corner_tl: { x: 640, y: 32, w: 16, h: 16 },
  fence_wood_corner_tr: { x: 640, y: 32, w: 16, h: 16 },
  fence_wood_corner_bl: { x: 640, y: 32, w: 16, h: 16 },
  fence_wood_corner_br: { x: 640, y: 32, w: 16, h: 16 },
  fence_wood_post: { x: 640, y: 32, w: 16, h: 16 },
  fence_wood_gate: { x: 624, y: 0, w: 16, h: 16 },

  bridge_rail_top: { x: 336, y: 160, w: 16, h: 16 },
  bridge_rail_bottom: { x: 336, y: 192, w: 16, h: 16 },

  // Cliff Elevation Faces
  cliff_top: { x: 32, y: 64, w: 16, h: 16 },
  cliff_face: { x: 48, y: 64, w: 16, h: 16 },
  cliff_corner_l: { x: 16, y: 64, w: 16, h: 16 },
  cliff_corner_r: { x: 64, y: 64, w: 16, h: 16 },
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
  ui_expression_working: {
    path: "/assets/ui/expression_working.png",
    w: 16,
    h: 16,
  },
  ui_expression_stress: {
    path: "/assets/ui/expression_stress.png",
    w: 16,
    h: 16,
  },
  ui_happiness_01: {
    path: "/assets/ui/happiness_01.png",
    w: 16,
    h: 16,
  },
  ui_happiness_02: {
    path: "/assets/ui/happiness_02.png",
    w: 16,
    h: 16,
  },
  ui_happiness_03: {
    path: "/assets/ui/happiness_03.png",
    w: 16,
    h: 16,
  },
  ui_happiness_04: {
    path: "/assets/ui/happiness_04.png",
    w: 16,
    h: 16,
  },
  windmill: {
    path: "/assets/other/spr_deco_windmill_strip9.png",
    w: 112,
    h: 112,
  },
  windmill_shadow: {
    path: "/assets/other/spr_deco_windmillshadow_strip9.png",
    w: 112,
    h: 112,
  },
  coracle: {
    path: "/assets/other/spr_deco_coracle_strip4.png",
    w: 48,
    h: 37,
  },
  coracle_land: {
    path: "/assets/other/spr_deco_coracle_land.png",
    w: 48,
    h: 37,
  },
  fire_vfx: {
    path: "/assets/vfx/spr_deco_fire_01_strip4.png",
    w: 5,
    h: 10,
  },
  chimney_smoke: {
    path: "/assets/vfx/chimneysmoke_01_strip30.png",
    w: 15,
    h: 37,
  },
  mushroom_blue_strip: {
    path: "/assets/plants/spr_deco_mushroom_blue_01_strip4.png",
    w: 16,
    h: 16,
  },
  mushroom_red_strip: {
    path: "/assets/plants/spr_deco_mushroom_red_01_strip4.png",
    w: 16,
    h: 16,
  },
  goblin_idle: {
    path: "/assets/characters/goblin/spr_idle_strip9.png",
    w: 96,
    h: 64,
  },
  goblin_walk: {
    path: "/assets/characters/goblin/spr_walk_strip8.png",
    w: 96,
    h: 64,
  },
  goblin_axe: {
    path: "/assets/characters/goblin/spr_axe_strip10.png",
    w: 96,
    h: 64,
  },
  goblin_attack: {
    path: "/assets/characters/goblin/spr_attack_strip10.png",
    w: 96,
    h: 64,
  },
  skeleton_idle: {
    path: "/assets/characters/skeleton/skeleton_idle_strip6.png",
    w: 96,
    h: 64,
  },
  skeleton_walk: {
    path: "/assets/characters/skeleton/skeleton_walk_strip8.png",
    w: 96,
    h: 64,
  },
  skeleton_attack: {
    path: "/assets/characters/skeleton/skeleton_attack_strip7.png",
    w: 96,
    h: 64,
  },
  ui_journal_detail: {
    path: "/assets/diary/UI_Panel_DetailView.png",
    w: 300,
    h: 400,
  },
  ui_journal_item: {
    path: "/assets/diary/UI_Panel_ItemArea.png",
    w: 300,
    h: 400,
  },
};

function getCropPath(cropId: string): string | null {
  if (!cropId) return null;
  if (cropId.includes("_stage_")) {
    const parts = cropId.replace("crop_", "").split("_stage_");
    const name = parts[0];
    const stage = parts[1].padStart(2, "0");
    return `/assets/crops/${name}_${stage}.png`;
  }
  if (cropId.match(/_[0-9]{2}$/)) {
    return `/assets/crops/${cropId.replace("crop_", "")}.png`;
  }
  return `/assets/crops/${cropId}_05.png`;
}

export class SurvivalRenderer {
  private tilesetImg: HTMLImageElement | null = null;
  private housesImg: HTMLImageElement | null = null;
  private treeBushImg: HTMLImageElement | null = null;
  private rockImg: HTMLImageElement | null = null;
  private wheatImg: HTMLImageElement | null = null;
  private soilImg: HTMLImageElement | null = null;
  private spriteImages: Map<string, HTMLImageElement> = new Map();
  private nightCanvas: HTMLCanvasElement | null = null;

  public lifeformRenderer: LifeformRenderer;
  public zoom = 2.2;
  public readonly baseTileSize = 16;
  public isWorldGenMode = false;

  // Smooth camera tracking
  public cameraX = 22;
  public cameraY = 18;

  public snapCameraTo(x: number, y: number) {
    this.cameraX = x;
    this.cameraY = y;
  }

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
    if (!path) return null;
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

    // Fix 8: Camera micro-shake impulse on impact + sub-pixel rounding
    const shakeX = engine.screenShakeX || 0;
    const shakeY = engine.screenShakeY || 0;
    const worldToScreen = (wx: number, wy: number) => ({
      sx: Math.round(halfWidth + (wx - this.cameraX) * cellSize + shakeX),
      sy: Math.round(halfHeight + (wy - this.cameraY) * cellSize + shakeY),
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

    // ── LAYER 1: GROUND TERRAIN TILES (Seamless Autotiling & Organic Scatter) ──
    if (this.tilesetImg && this.tilesetImg.complete) {
      for (let ty = minTileY; ty <= maxTileY; ty++) {
        for (let tx = minTileX; tx <= maxTileX; tx++) {
          const screen = worldToScreen(tx, ty);
          const screenNext = worldToScreen(tx + 1, ty + 1);
          // +1px overlap guarantees zero pixel gap lines between adjacent tiles during movement
          const tileW = screenNext.sx - screen.sx + 1;
          const tileH = screenNext.sy - screen.sy + 1;

          const tile = engine.worldManager.getTile(tx, ty);

          // 1. Organic Procedural Base Grass Scatter (eliminates grid monotony)
          const grassVariantKey = engine.worldManager.getGrassScatterVariant(tx, ty);
          const grassCrop = TILE_CROPS[grassVariantKey] || TILE_CROPS["grass_textured_01"];
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

          // 2. Pure Calm Cyan Water & River/Pond Autotiling with Wave Foam Overlay
          if (tile.isWater) {
            const shore = engine.worldManager.getWaterShoreBitmask(tx, ty);
            const n = shore.hasWaterN;
            const e = shore.hasWaterE;
            const s = shore.hasWaterS;
            const w = shore.hasWaterW;

            // Base calm cyan water tile
            let waterCrop = TILE_CROPS["water_tile_01"];
            const rippleHash = Math.abs(Math.sin(tx * 31.17 + ty * 97.53) * 43758.5453);
            if (rippleHash > 0.88) {
              waterCrop = TILE_CROPS["water_depth_01"];
            } else if (rippleHash > 0.76) {
              waterCrop = TILE_CROPS["water_depth_02"];
            }

            ctx.drawImage(
              this.tilesetImg,
              waterCrop.x,
              waterCrop.y,
              waterCrop.w,
              waterCrop.h,
              screen.sx,
              screen.sy,
              tileW,
              tileH,
            );

            // Shoreline autotiling overlay directly on the water tile (Pixel-perfect Sunnyside autotiling)
            if (shore.isShore) {
              const nwTile = engine.worldManager.getTile(tx - 1, ty - 1);
              const neTile = engine.worldManager.getTile(tx + 1, ty - 1);
              const swTile = engine.worldManager.getTile(tx - 1, ty + 1);
              const seTile = engine.worldManager.getTile(tx + 1, ty + 1);

              // 1. Outer corners (where two adjacent cardinal directions are land)
              const isCornerNW = !n && !w && (s || e);
              const isCornerNE = !n && !e && (s || w);
              const isCornerSW = !s && !w && (n || e);
              const isCornerSE = !s && !e && (n || w);

              if (isCornerNW) {
                // NW Outer: Land is North & West, Water is South & East
                const c = TILE_CROPS["coast_corner_nw"];
                ctx.drawImage(this.tilesetImg, c.x, c.y, c.w, c.h, screen.sx, screen.sy, tileW, tileH);
              } else if (isCornerNE) {
                // NE Outer: Land is North & East, Water is South & West
                const c = TILE_CROPS["coast_corner_ne"];
                ctx.drawImage(this.tilesetImg, c.x, c.y, c.w, c.h, screen.sx, screen.sy, tileW, tileH);
              } else if (isCornerSW) {
                // SW Outer: Land is South & West, Water is North & East
                const c = TILE_CROPS["coast_corner_sw"];
                ctx.drawImage(this.tilesetImg, c.x, c.y, c.w, c.h, screen.sx, screen.sy, tileW, tileH);
              } else if (isCornerSE) {
                // SE Outer: Land is South & East, Water is North & West
                const c = TILE_CROPS["coast_corner_se"];
                ctx.drawImage(this.tilesetImg, c.x, c.y, c.w, c.h, screen.sx, screen.sy, tileW, tileH);
              } else {
                // Straight edges:
                if (!n) {
                  const c = TILE_CROPS["coast_sand_n"];
                  ctx.drawImage(this.tilesetImg, c.x, c.y, c.w, c.h, screen.sx, screen.sy, tileW, tileH);
                }
                if (!s) {
                  const c = TILE_CROPS["coast_sand_s"];
                  ctx.drawImage(this.tilesetImg, c.x, c.y, c.w, c.h, screen.sx, screen.sy, tileW, tileH);
                }
                if (!w) {
                  const c = TILE_CROPS["coast_sand_w"];
                  ctx.drawImage(this.tilesetImg, c.x, c.y, c.w, c.h, screen.sx, screen.sy, tileW, tileH);
                }
                if (!e) {
                  const c = TILE_CROPS["coast_sand_e"];
                  ctx.drawImage(this.tilesetImg, c.x, c.y, c.w, c.h, screen.sx, screen.sy, tileW, tileH);
                }
              }

              // 2. Inner diagonal corner wave foam (cardinal sides are water, but diagonal neighbor is land):
              const isLand = (t: any) => !t || !t.isWater;
              if (n && w && isLand(nwTile)) {
                const c = TILE_CROPS["coast_inner_nw"];
                ctx.drawImage(this.tilesetImg, c.x, c.y, c.w, c.h, screen.sx, screen.sy, tileW, tileH);
              }
              if (n && e && isLand(neTile)) {
                const c = TILE_CROPS["coast_inner_ne"];
                ctx.drawImage(this.tilesetImg, c.x, c.y, c.w, c.h, screen.sx, screen.sy, tileW, tileH);
              }
              if (s && w && isLand(swTile)) {
                const c = TILE_CROPS["coast_inner_sw"];
                ctx.drawImage(this.tilesetImg, c.x, c.y, c.w, c.h, screen.sx, screen.sy, tileW, tileH);
              }
              if (s && e && isLand(seTile)) {
                const c = TILE_CROPS["coast_inner_se"];
                ctx.drawImage(this.tilesetImg, c.x, c.y, c.w, c.h, screen.sx, screen.sy, tileW, tileH);
              }
            }
          }
          // 2.5 Multi-Layer Bridges (Water flows underneath, wooden deck & rails on top)
          else if (tile.isBridge || tile.terrain === "bridge_wood") {
            // First: render calm water underneath
            const waterUnder = TILE_CROPS["water_tile_01"];
            ctx.drawImage(
              this.tilesetImg,
              waterUnder.x,
              waterUnder.y,
              waterUnder.w,
              waterUnder.h,
              screen.sx,
              screen.sy,
              tileW,
              tileH,
            );

            // Second: render wooden bridge deck based on road connectivity
            const roadMask = engine.worldManager.getRoadBitmask(tx, ty);
            const isVerticalBridge = (roadMask & 5) && !(roadMask & 10);
            const bridgeCrop = isVerticalBridge
              ? TILE_CROPS["bridge_wood_v"]
              : TILE_CROPS["bridge_wood_h"];
            if (bridgeCrop) {
              ctx.drawImage(
                this.tilesetImg,
                bridgeCrop.x,
                bridgeCrop.y,
                bridgeCrop.w,
                bridgeCrop.h,
                screen.sx,
                screen.sy,
                tileW,
                tileH,
              );
            }
          }
          // 3. Connected Dirt Pathways & Cobblestone Highways (Orthogonal Bitmask Autotiling)
          else if (
            tile.isRoad ||
            tile.terrain.startsWith("path_") ||
            tile.terrain.startsWith("dirt_") ||
            tile.terrain.startsWith("stone_cobble")
          ) {
            const roadInfo = engine.worldManager.getRoadNeighbors(tx, ty);
            const roadMask = roadInfo.bitmask;

            if (tile.terrain.startsWith("stone_cobble")) {
              // Cobblestone 3x3 autotile
              let cobbleCrop = TILE_CROPS["cobble_c"];
              if (roadMask === 3) cobbleCrop = TILE_CROPS["cobble_tr"];
              else if (roadMask === 6) cobbleCrop = TILE_CROPS["cobble_br"];
              else if (roadMask === 12) cobbleCrop = TILE_CROPS["cobble_bl"];
              else if (roadMask === 9) cobbleCrop = TILE_CROPS["cobble_tl"];
              else cobbleCrop = TILE_CROPS["cobble_c"];

              ctx.drawImage(
                this.tilesetImg,
                cobbleCrop.x,
                cobbleCrop.y,
                cobbleCrop.w,
                cobbleCrop.h,
                screen.sx,
                screen.sy,
                tileW,
                tileH,
              );
            } else {
              // Primary textured dirt trail surface with deterministic pebble scatter
              const hash = Math.abs(Math.sin(tx * 31.17 + ty * 97.53) * 43758.5453);
              let dirtCrop = TILE_CROPS["path_center"];
              const v = Math.floor(hash * 10);
              if (v === 1) dirtCrop = TILE_CROPS["path_pebble_01"];
              else if (v === 2) dirtCrop = TILE_CROPS["path_pebble_02"];
              else if (v === 3) dirtCrop = TILE_CROPS["path_pebble_03"];
              else if (v === 4) dirtCrop = TILE_CROPS["path_pebble_04"];
              else if (v === 5) dirtCrop = TILE_CROPS["path_pebble_05"];

              const n = roadInfo.n;
              const s = roadInfo.s;
              const w = roadInfo.w;
              const e = roadInfo.e;
              const ne = roadInfo.ne;
              const nw = roadInfo.nw;
              const se = roadInfo.se;
              const sw = roadInfo.sw;

              // Check outer turn corners first (including diagonal stair-step highway connections):
              const is_corner_tl = !n && !w && (s || sw) && (e || ne);
              const is_corner_tr = !n && !e && (s || se) && (w || nw);
              const is_corner_bl = !s && !w && (n || nw) && (e || se);
              const is_corner_br = !s && !e && (n || ne) && (w || sw);

              if (is_corner_tl) {
                // Dirt curves from S to E (NW outer corner)
                const c = TILE_CROPS["path_corner_tl"];
                ctx.drawImage(this.tilesetImg, c.x, c.y, c.w, c.h, screen.sx, screen.sy, tileW, tileH);
              } else if (is_corner_tr) {
                // Dirt curves from S to W (NE outer corner)
                const c = TILE_CROPS["path_corner_tr"];
                ctx.drawImage(this.tilesetImg, c.x, c.y, c.w, c.h, screen.sx, screen.sy, tileW, tileH);
              } else if (is_corner_bl) {
                // Dirt curves from N to E (SW outer corner)
                const c = TILE_CROPS["path_corner_bl"];
                ctx.drawImage(this.tilesetImg, c.x, c.y, c.w, c.h, screen.sx, screen.sy, tileW, tileH);
              } else if (is_corner_br) {
                // Dirt curves from N to W (SE outer corner)
                const c = TILE_CROPS["path_corner_br"];
                ctx.drawImage(this.tilesetImg, c.x, c.y, c.w, c.h, screen.sx, screen.sy, tileW, tileH);
              } else {
                // Base dirt fill for straight paths, junctions, crossroads, and dead ends
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

                // Overlay organic scalloped edges on closed sides
                if (!n) {
                  const c = TILE_CROPS["path_top"];
                  ctx.drawImage(this.tilesetImg, c.x, c.y, c.w, c.h, screen.sx, screen.sy, tileW, tileH);
                }
                if (!s) {
                  const c = TILE_CROPS["path_bottom"];
                  ctx.drawImage(this.tilesetImg, c.x, c.y, c.w, c.h, screen.sx, screen.sy, tileW, tileH);
                }
                if (!w) {
                  const c = TILE_CROPS["path_left"];
                  ctx.drawImage(this.tilesetImg, c.x, c.y, c.w, c.h, screen.sx, screen.sy, tileW, tileH);
                }
                if (!e) {
                  const c = TILE_CROPS["path_right"];
                  ctx.drawImage(this.tilesetImg, c.x, c.y, c.w, c.h, screen.sx, screen.sy, tileW, tileH);
                }

                // Inner corner notches (when path turns around an inner corner)
                if (n && e && !roadInfo.ne) {
                  const c = TILE_CROPS["path_notch_ne"];
                  ctx.drawImage(this.tilesetImg, c.x, c.y, c.w, c.h, screen.sx, screen.sy, tileW, tileH);
                }
                if (n && w && !roadInfo.nw) {
                  const c = TILE_CROPS["path_notch_nw"];
                  ctx.drawImage(this.tilesetImg, c.x, c.y, c.w, c.h, screen.sx, screen.sy, tileW, tileH);
                }
                if (s && e && !roadInfo.se) {
                  const c = TILE_CROPS["path_notch_se"];
                  ctx.drawImage(this.tilesetImg, c.x, c.y, c.w, c.h, screen.sx, screen.sy, tileW, tileH);
                }
                if (s && w && !roadInfo.sw) {
                  const c = TILE_CROPS["path_notch_sw"];
                  ctx.drawImage(this.tilesetImg, c.x, c.y, c.w, c.h, screen.sx, screen.sy, tileW, tileH);
                }
              }
            }
          }
          // 4. Sand Shorelines & Beaches with Seamless Grass Fringe Autotiling
          else if (tile.terrain === "sand_tile_01") {
            const crop = TILE_CROPS["sand_tile_01"];
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

            // Overlay soft scalloped grass fringes where sand meets grass
            const nTile = engine.worldManager.getTile(tx, ty - 1);
            const sTile = engine.worldManager.getTile(tx, ty + 1);
            const wTile = engine.worldManager.getTile(tx - 1, ty);
            const eTile = engine.worldManager.getTile(tx + 1, ty);

            const isGrass = (t: any) => t && !t.isWater && t.terrain !== "sand_tile_01";

            if (isGrass(nTile)) {
              const c = TILE_CROPS["path_top"];
              ctx.drawImage(this.tilesetImg, c.x, c.y, c.w, c.h, screen.sx, screen.sy, tileW, tileH);
            }
            if (isGrass(sTile)) {
              const c = TILE_CROPS["path_bottom"];
              ctx.drawImage(this.tilesetImg, c.x, c.y, c.w, c.h, screen.sx, screen.sy, tileW, tileH);
            }
            if (isGrass(wTile)) {
              const c = TILE_CROPS["path_left"];
              ctx.drawImage(this.tilesetImg, c.x, c.y, c.w, c.h, screen.sx, screen.sy, tileW, tileH);
            }
            if (isGrass(eTile)) {
              const c = TILE_CROPS["path_right"];
              ctx.drawImage(this.tilesetImg, c.x, c.y, c.w, c.h, screen.sx, screen.sy, tileW, tileH);
            }
          }
          // 5. Land Grassland bordering Water (Seamless River & Pond Banks)
          else {
            const shore = engine.worldManager.getWaterShoreBitmask(tx, ty);
            if (shore.isShore) {
              // Outer corners on land:
              if (shore.hasWaterS && shore.hasWaterE) {
                const bc = TILE_CROPS["water_corner_nw"];
                ctx.drawImage(this.tilesetImg, bc.x, bc.y, bc.w, bc.h, screen.sx, screen.sy, tileW, tileH);
              } else if (shore.hasWaterS && shore.hasWaterW) {
                const bc = TILE_CROPS["water_corner_ne"];
                ctx.drawImage(this.tilesetImg, bc.x, bc.y, bc.w, bc.h, screen.sx, screen.sy, tileW, tileH);
              } else if (shore.hasWaterN && shore.hasWaterE) {
                const bc = TILE_CROPS["water_corner_sw"];
                ctx.drawImage(this.tilesetImg, bc.x, bc.y, bc.w, bc.h, screen.sx, screen.sy, tileW, tileH);
              } else if (shore.hasWaterN && shore.hasWaterW) {
                const bc = TILE_CROPS["water_corner_se"];
                ctx.drawImage(this.tilesetImg, bc.x, bc.y, bc.w, bc.h, screen.sx, screen.sy, tileW, tileH);
              } else if (shore.hasWaterS) {
                const bc = TILE_CROPS["water_bank_n"];
                ctx.drawImage(this.tilesetImg, bc.x, bc.y, bc.w, bc.h, screen.sx, screen.sy, tileW, tileH);
              } else if (shore.hasWaterN) {
                const bc = TILE_CROPS["water_bank_s"];
                ctx.drawImage(this.tilesetImg, bc.x, bc.y, bc.w, bc.h, screen.sx, screen.sy, tileW, tileH);
              } else if (shore.hasWaterE) {
                const bc = TILE_CROPS["water_bank_w"];
                ctx.drawImage(this.tilesetImg, bc.x, bc.y, bc.w, bc.h, screen.sx, screen.sy, tileW, tileH);
              } else if (shore.hasWaterW) {
                const bc = TILE_CROPS["water_bank_e"];
                ctx.drawImage(this.tilesetImg, bc.x, bc.y, bc.w, bc.h, screen.sx, screen.sy, tileW, tileH);
              }
            }
          }
        }
      }
    }

    // ── LAYER 2: VILLAGE FARMLAND SOIL & FURROW FRAMING ─────────
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
            ctx.drawImage(
              this.soilImg,
              0,
              0,
              this.soilImg.naturalWidth,
              this.soilImg.naturalHeight,
              screen.sx,
              screen.sy,
              tileW,
              tileH,
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

    // ── LAYER 5b: FOOTSTEP GROUND VFX & EXPANDING WATER RIPPLES ─
    for (const p of engine.footstepParticles) {
      const s = worldToScreen(p.x, p.y);
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      if (p.type === "ripple") {
        ctx.strokeStyle = p.color || "rgba(186, 230, 253, 0.75)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(
          s.sx,
          s.sy,
          p.radius * (this.zoom / 2),
          p.radius * 0.45 * (this.zoom / 2),
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color || "#4ade80";
        ctx.beginPath();
        ctx.arc(s.sx, s.sy, p.radius * (this.zoom / 2), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // ── LAYER 6: Y-SORTED DEPTH ENTITIES & STRUCTURES ───────────
    interface Renderable {
      yOrder: number;
      draw: () => void;
    }
    const depthList: Renderable[] = [];

    // 6.0 Ambient Perched & Flying Birds
    for (const bird of engine.ambientBirds) {
      depthList.push({
        yOrder: bird.y + (bird.isFlying ? 2.5 : 0.4),
        draw: () => {
          const s = worldToScreen(bird.x, bird.y);
          ctx.save();
          ctx.fillStyle = bird.color;
          if (bird.isFlying) {
            const wingY = Math.sin(Date.now() / 65) * 4;
            ctx.beginPath();
            ctx.ellipse(s.sx, s.sy, 4, 3, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = bird.color;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(s.sx - 6, s.sy - wingY);
            ctx.lineTo(s.sx, s.sy);
            ctx.lineTo(s.sx + 6, s.sy - wingY);
            ctx.stroke();
          } else {
            // Perched bird
            ctx.beginPath();
            ctx.ellipse(s.sx, s.sy - 2, 3.5, 3, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#f59e0b"; // beak
            ctx.fillRect(s.sx + 3, s.sy - 3, 2, 2);
          }
          ctx.restore();
        },
      });
    }

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
              ctx.fillStyle = "rgba(15, 23, 42, 0.35)";
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

              // Rotating Windmill Blade Shadow
              if (house.id === "house_windmill_01") {
                const bladeAngle = (Date.now() / 900) % (Math.PI * 2);
                ctx.save();
                ctx.fillStyle = "rgba(15, 23, 42, 0.28)";
                ctx.translate(dx + dw * 0.5, screen.sy + footprintPixelH * 0.82);
                for (let b = 0; b < 4; b++) {
                  ctx.rotate(Math.PI / 2);
                  ctx.beginPath();
                  ctx.ellipse(
                    Math.cos(bladeAngle) * cellSize * 0.7,
                    Math.sin(bladeAngle) * cellSize * 0.25,
                    cellSize * 0.65,
                    cellSize * 0.16,
                    bladeAngle,
                    0,
                    Math.PI * 2,
                  );
                  ctx.fill();
                }
                ctx.restore();
              }

              // Roof overhang transparency when player steps inside doorway / under eaves
              const isPlayerUnderEaves =
                engine.player.x >= wx - 0.2 &&
                engine.player.x <= wx + house.footprintW + 0.2 &&
                engine.player.y >= wy - 0.3 &&
                engine.player.y <= wy + house.footprintH - 0.2;

              ctx.save();
              if (isPlayerUnderEaves) {
                ctx.globalAlpha = 0.72;
              }
              ctx.drawImage(this.housesImg, cx, cy, cw, ch, dx, dy, dw, dh);
              ctx.restore();
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
                const cropImg = this.getCropImage(cell.cropId!);
                
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
                // Ground directional shadow offset by sun
                const sunHour = engine.worldTime.hour + engine.worldTime.minute / 60;
                const sunAngle = ((sunHour - 12) / 12) * Math.PI;
                const shadowOffsetX = Math.sin(sunAngle) * cellSize * 0.42;
                const shadowOffsetY = Math.abs(Math.cos(sunAngle)) * cellSize * 0.12;

                ctx.fillStyle = "rgba(15, 23, 42, 0.35)";
                ctx.beginPath();
                ctx.ellipse(
                  screen.sx + cellSize + shadowOffsetX,
                  screen.sy + cellSize * 1.6 + shadowOffsetY,
                  cellSize * 0.95,
                  cellSize * 0.42,
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

                  // Periodic sinusoidal wind sway on foliage
                  const windSway = Math.sin(Date.now() / 650 + res.x * 1.4 + res.y * 0.8) * 2.2;
                  const rustleWobble = res.shakeTimer && res.shakeTimer > 0 ? Math.sin(res.shakeTimer * 30) * 3 : 0;

                  // Dynamic canopy walk-behind transparency (sub-tile walk-behind)
                  const isPlayerBehind =
                    (engine.player.x >= res.x - 0.6 &&
                     engine.player.x <= res.x + res.w + 0.6 &&
                     engine.player.y >= res.y - 1.4 &&
                     engine.player.y <= res.y + res.h - 0.2) ||
                    (engine.remotePlayers && engine.remotePlayers.some((rp: any) =>
                       rp.x >= res.x - 0.6 &&
                       rp.x <= res.x + res.w + 0.6 &&
                       rp.y >= res.y - 1.4 &&
                       rp.y <= res.y + res.h - 0.2
                    ));

                  ctx.save();
                  if (isPlayerBehind) {
                    ctx.globalAlpha = 0.45;
                  }
                  ctx.drawImage(
                    this.treeBushImg,
                    crop.x,
                    crop.y,
                    crop.w,
                    crop.h,
                    dx + shakeOffset + windSway + rustleWobble,
                    dy,
                    treeW,
                    treeH,
                  );
                  ctx.restore();
                }
              } else if (res.type === "rock" || res.type === "iron_rock") {
                // Ground shadow
                ctx.fillStyle = "rgba(15, 23, 42, 0.32)";
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
                  const rustleAngle = res.shakeTimer && res.shakeTimer > 0
                    ? Math.sin(res.shakeTimer * 32) * 0.20
                    : 0;

                  ctx.save();
                  ctx.translate(screen.sx + cellSize / 2, screen.sy + cellSize);
                  ctx.rotate(rustleAngle);
                  ctx.drawImage(
                    this.treeBushImg,
                    crop.x,
                    crop.y,
                    crop.w,
                    crop.h,
                    -bushW / 2 + shakeOffset,
                    -bushH,
                    bushW,
                    bushH,
                  );
                  ctx.restore();
                }
              } else if (res.type === "crop") {
                // Only render if we can resolve the actual crop image
                // (crop resource nodes are only created for cells with cropId)
                let farmCropId = '';
                for (const v of engine.worldManager.villages) {
                  for (const farm of v.data.farms) {
                    for (const c of farm.cells) {
                      if (v.gridX + c.x === res.x && v.gridY + c.y === res.y && c.cropId) {
                        farmCropId = c.cropId;
                        break;
                      }
                    }
                    if (farmCropId) break;
                  }
                  if (farmCropId) break;
                }
                if (farmCropId) {
                  const cropImg = this.getCropImage(farmCropId);
                  if (cropImg) {
                    const cropW = cellSize;
                    const cropH = cellSize * 1.2;
                    ctx.drawImage(
                      cropImg,
                      screen.sx,
                      screen.sy - cropH * 0.2,
                      cropW,
                      cropH,
                    );
                  }
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
          const rawScreen = worldToScreen(struct.x, struct.y);
          const shakeOffset =
            struct.shakeTimer && struct.shakeTimer > 0
              ? Math.random() * 4 - 2
              : 0;
          const screen = { sx: rawScreen.sx + shakeOffset, sy: rawScreen.sy };
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
          } else if (struct.type === "windmill") {
            // Windmill (3x3 tiles): Authentic Tower Structure + Rotating Blades on Top
            const wmImg = this.getSpriteImage("windmill");
            const wmShadowImg = this.getSpriteImage("windmill_shadow");

            const towerW = cellSize * 2.8;
            const towerH = cellSize * 2.7;
            const towerX = screen.sx + (cellSize * struct.w - towerW) / 2;
            const towerY = screen.sy + cellSize * struct.h - towerH;

            // 1. Render the Windmill Tower Base from houses.png (Crop: 800, 12, 256, 247)
            if (this.housesImg && this.housesImg.complete && this.housesImg.naturalWidth > 0) {
              ctx.drawImage(
                this.housesImg,
                800,
                12,
                256,
                247,
                towerX,
                towerY,
                towerW,
                towerH,
              );
            }

            // 2. Windmill Ground Shadow
            const fanSize = cellSize * 2.6;
            const fanCenterX = towerX + towerW * 0.53;
            const fanCenterY = towerY + towerH * 0.38;
            const fanX = fanCenterX - fanSize / 2;
            const fanY = fanCenterY - fanSize / 2;

            const frameIdx = struct.isOperating ? Math.floor(Date.now() / 90) % 9 : 0;

            if (wmShadowImg) {
              ctx.drawImage(
                wmShadowImg,
                frameIdx * 112,
                0,
                112,
                112,
                fanX + cellSize * 0.25,
                fanY + cellSize * 0.25,
                fanSize,
                fanSize,
              );
            }

            // 3. Windmill Rotating Fan Blades mounted directly on top of the tower
            if (wmImg) {
              ctx.drawImage(
                wmImg,
                frameIdx * 112,
                0,
                112,
                112,
                fanX,
                fanY,
                fanSize,
                fanSize,
              );
            }

            const dist = Math.hypot(engine.player.x - (struct.x + struct.w / 2), engine.player.y - (struct.y + struct.h / 2));
            if (dist < 2.5) {
              ctx.font = `bold ${9 * (this.zoom / 2)}px sans-serif`;
              ctx.fillStyle = "rgba(0,0,0,0.7)";
              ctx.fillRect(screen.sx + cellSize * 0.8, screen.sy - 22, 90, 16);
              ctx.fillStyle = struct.isOperating ? "#fef08a" : "#cbd5e1";
              ctx.textAlign = "center";
              ctx.fillText(struct.isOperating ? "Milling Wheat..." : "[E] Insert Wheat", screen.sx + cellSize * 0.8 + 45, screen.sy - 10);
            }
          } else if (struct.type === "stone_oven") {
            // Stone Oven with animated baking fire VFX
            const ovenW = cellSize * 1.6;
            const ovenH = cellSize * 1.6;
            const ovenX = screen.sx + (cellSize * struct.w - ovenW) / 2;
            const ovenY = screen.sy + cellSize * struct.h - ovenH;

            ctx.fillStyle = "#475569";
            ctx.fillRect(ovenX + 4, ovenY + 6, ovenW - 8, ovenH - 8);
            ctx.fillStyle = "#334155";
            ctx.fillRect(ovenX + 8, ovenY + 12, ovenW - 16, ovenH - 16);
            ctx.strokeStyle = "#1e293b";
            ctx.lineWidth = 2;
            ctx.strokeRect(ovenX + 4, ovenY + 6, ovenW - 8, ovenH - 8);

            if (struct.isOperating || (struct.fuelTimer && struct.fuelTimer > 0)) {
              const fireImg = this.getSpriteImage("fire_vfx");
              if (fireImg) {
                const fIdx = Math.floor(Date.now() / 100) % 4;
                ctx.drawImage(
                  fireImg,
                  fIdx * 5,
                  0,
                  5,
                  10,
                  ovenX + ovenW / 2 - 8,
                  ovenY + ovenH / 2 - 4,
                  16,
                  20,
                );
              }
            }

            const dist = Math.hypot(engine.player.x - (struct.x + struct.w / 2), engine.player.y - (struct.y + struct.h / 2));
            if (dist < 2.5) {
              ctx.font = `bold ${9 * (this.zoom / 2)}px sans-serif`;
              ctx.fillStyle = "rgba(0,0,0,0.7)";
              ctx.fillRect(screen.sx + 4, screen.sy - 20, 96, 16);
              ctx.fillStyle = struct.isOperating ? "#fbbf24" : "#f8fafc";
              ctx.textAlign = "center";
              ctx.fillText(struct.isOperating ? "Baking Bread..." : "[E] Bake Bread", screen.sx + 52, screen.sy - 8);
            }
          } else if (struct.type === "chimney") {
            // Brick chimney with rising animated smoke
            ctx.fillStyle = "#b91c1c";
            ctx.fillRect(screen.sx + 4, screen.sy + 2, cellSize - 8, cellSize - 4);
            ctx.strokeStyle = "#7f1d1d";
            ctx.lineWidth = 1;
            ctx.strokeRect(screen.sx + 4, screen.sy + 2, cellSize - 8, cellSize - 4);

            const smokeImg = this.getSpriteImage("chimney_smoke");
            if (smokeImg) {
              const sIdx = Math.floor(Date.now() / 70) % 30;
              const smokeW = cellSize * 0.9;
              const smokeH = cellSize * 2.2;
              ctx.drawImage(
                smokeImg,
                sIdx * 15,
                0,
                15,
                37,
                screen.sx + cellSize / 2 - smokeW / 2,
                screen.sy - smokeH + 4,
                smokeW,
                smokeH,
              );
            }
          } else if (struct.type === "coracle") {
            // Coracle boat floating on water
            const boatImg = this.getSpriteImage("coracle");
            if (boatImg) {
              const bob = Math.sin(Date.now() / 350 + struct.x) * 2;
              const frameIdx = Math.floor(Date.now() / 250) % 4;
              const bw = cellSize * 1.8;
              const bh = cellSize * 1.4;
              ctx.drawImage(
                boatImg,
                frameIdx * 48,
                0,
                48,
                37,
                screen.sx + (cellSize - bw) / 2,
                screen.sy + (cellSize - bh) / 2 + bob,
                bw,
                bh,
              );

              const dist = Math.hypot(engine.player.x - (struct.x + 0.5), engine.player.y - (struct.y + 0.5));
              if (dist < 2.0 && !engine.player.isMountedBoat) {
                ctx.font = `bold ${9 * (this.zoom / 2)}px sans-serif`;
                ctx.fillStyle = "rgba(0,0,0,0.7)";
                ctx.fillRect(screen.sx - 10, screen.sy - 22, 80, 16);
                ctx.fillStyle = "#38bdf8";
                ctx.textAlign = "center";
                ctx.fillText("[E] Board Boat", screen.sx + 30, screen.sy - 10);
              }
            }
          } else if (struct.type === "bed") {
            ctx.fillStyle = "#78350f";
            ctx.fillRect(screen.sx + 2, screen.sy + 2, cellSize - 4, cellSize - 4);
            ctx.fillStyle = "#38bdf8";
            ctx.fillRect(screen.sx + 4, screen.sy + 8, cellSize - 8, cellSize - 10);
            ctx.fillStyle = "#f8fafc";
            ctx.fillRect(screen.sx + 5, screen.sy + 4, cellSize - 10, 6);

            const dist = Math.hypot(engine.player.x - (struct.x + 0.5), engine.player.y - (struct.y + 0.5));
            if (dist < 2.0) {
              ctx.font = `bold ${9 * (this.zoom / 2)}px sans-serif`;
              ctx.fillStyle = "rgba(0,0,0,0.7)";
              ctx.fillRect(screen.sx - 4, screen.sy - 20, 72, 16);
              ctx.fillStyle = "#fef08a";
              ctx.textAlign = "center";
              ctx.fillText("[E] Sleep", screen.sx + 32, screen.sy - 8);
            }
          } else if (struct.type === "wall_window") {
            ctx.fillStyle = "#78350f";
            ctx.fillRect(screen.sx, screen.sy - cellSize * 0.4, cellSize, cellSize * 1.4);
            ctx.fillStyle = "#bae6fd";
            ctx.fillRect(screen.sx + 4, screen.sy - cellSize * 0.1, cellSize - 8, cellSize * 0.5);
            ctx.strokeStyle = "#475569";
            ctx.lineWidth = 1;
            ctx.strokeRect(screen.sx + 4, screen.sy - cellSize * 0.1, cellSize - 8, cellSize * 0.5);
          } else if (struct.type === "stone_wall") {
            ctx.fillStyle = "#475569";
            ctx.fillRect(screen.sx, screen.sy - cellSize * 0.4, cellSize, cellSize * 1.4);
            ctx.strokeStyle = "#334155";
            ctx.lineWidth = 1;
            ctx.strokeRect(screen.sx + 1, screen.sy - cellSize * 0.4 + 1, cellSize - 2, cellSize * 1.4 - 2);
          } else if (struct.type === "roof_wood") {
            ctx.fillStyle = "#b45309";
            ctx.beginPath();
            ctx.moveTo(screen.sx, screen.sy + cellSize);
            ctx.lineTo(screen.sx + cellSize / 2, screen.sy - cellSize * 0.4);
            ctx.lineTo(screen.sx + cellSize, screen.sy + cellSize);
            ctx.closePath();
            ctx.fill();
          } else if (struct.type === "brewing_stand") {
            ctx.fillStyle = "#334155";
            ctx.fillRect(screen.sx + 4, screen.sy + cellSize * 0.4, cellSize - 8, cellSize * 0.6);
            ctx.fillStyle = "#a855f7";
            ctx.beginPath();
            ctx.arc(screen.sx + cellSize * 0.35, screen.sy + cellSize * 0.3, 4, 0, Math.PI * 2);
            ctx.arc(screen.sx + cellSize * 0.65, screen.sy + cellSize * 0.3, 4, 0, Math.PI * 2);
            ctx.fill();

            const dist = Math.hypot(engine.player.x - (struct.x + 0.5), engine.player.y - (struct.y + 0.5));
            if (dist < 2.0) {
              ctx.font = `bold ${9 * (this.zoom / 2)}px sans-serif`;
              ctx.fillStyle = "rgba(0,0,0,0.7)";
              ctx.fillRect(screen.sx - 6, screen.sy - 20, 80, 16);
              ctx.fillStyle = "#c084fc";
              ctx.textAlign = "center";
              ctx.fillText("[E] Brew Potion", screen.sx + 34, screen.sy - 8);
            }
          }

          if (
            struct.health !== undefined &&
            struct.maxHealth &&
            struct.health < struct.maxHealth
          ) {
            const barW = cellSize * 0.8;
            const barH = 4;
            const barX = screen.sx + (cellSize - barW) / 2;
            const barY = screen.sy - 8;
            ctx.fillStyle = "rgba(0,0,0,0.6)";
            ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
            ctx.fillStyle = "#ef4444";
            ctx.fillRect(barX, barY, barW, barH);
            ctx.fillStyle = "#22c55e";
            ctx.fillRect(
              barX,
              barY,
              barW * Math.max(0, struct.health / struct.maxHealth),
              barH,
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
          const animScale = (animal as any).isBaby ? 0.6 : 1.0;
          this.lifeformRenderer.renderEntity(
            ctx,
            animal,
            cellSize,
            false,
            screen.sx + cellSize / 2,
            screen.sy + cellSize / 2,
            animScale,
          );

          // Breeding love hearts
          if ((animal as any).loveTimer && (animal as any).loveTimer > 0) {
            const heartImg = this.getSpriteImage("ui_expression_love");
            if (heartImg) {
              const bsz = 16 * (this.zoom / 2);
              const bob = Math.sin(Date.now() / 200) * 3;
              ctx.drawImage(
                heartImg,
                screen.sx + cellSize / 2 - bsz / 2,
                screen.sy - 18 + bob,
                bsz,
                bsz,
              );
            }
          }
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
          const boxW = Math.max(48, tw + 12);
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

          // Sleeping "Zzz" animation
          if ((npc as any).scheduleState === "SLEEP") {
            ctx.font = "bold 11px sans-serif";
            ctx.fillStyle = "#93c5fd";
            const zBob = (Date.now() / 300) % 3;
            ctx.fillText("Zzz".slice(0, Math.floor(zBob) + 1), screen.sx + cellSize / 2, screen.sy - 46);
          } else {
            // Overhead active expression bubble (love, chat, etc. - no sweat/water droplets)
            const expr = (npc as any).currentExpression;
            const exprKey = expr && expr !== "working" ? `ui_expression_${expr}` : null;
            const distToPlayer = Math.hypot(
              engine.player.x - npc.position.x,
              engine.player.y - npc.position.y,
            );
            const activeExpr = exprKey || (distToPlayer <= 2.2 ? "ui_expression_chat" : null);

            if (activeExpr) {
              const exprImg = this.getSpriteImage(activeExpr);
              if (exprImg) {
                const bsz = 16 * (this.zoom / 2);
                const bob = Math.sin(Date.now() / 250) * 3;
                const bx = screen.sx + cellSize / 2 - bsz / 2;
                const by = screen.sy - 58 + bob;

                // Speech bubble backdrop pill
                ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
                ctx.strokeStyle = "#334155";
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                if (typeof (ctx as any).roundRect === "function") {
                  (ctx as any).roundRect(bx - 3, by - 3, bsz + 6, bsz + 6, 4);
                } else {
                  ctx.rect(bx - 3, by - 3, bsz + 6, bsz + 6);
                }
                ctx.fill();
                ctx.stroke();

                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(exprImg, bx, by, bsz, bsz);
              }
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

          // Enemy Health Bar or Neutral Trader Label
          if (enemy.subType === "TRADER" || enemy.subType === "neutral_trader") {
            ctx.font = "bold 9px sans-serif";
            ctx.fillStyle = "rgba(0,0,0,0.7)";
            ctx.fillRect(screen.sx + cellSize / 2 - 45, screen.sy - 22, 90, 14);
            ctx.fillStyle = "#38bdf8";
            ctx.textAlign = "center";
            ctx.fillText("[E] Goblin Trader", screen.sx + cellSize / 2, screen.sy - 12);
          } else if (enemy.health < enemy.maxHealth && enemy.health > 0) {
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
          let dur = (p as any).swingDuration || 0.25;
          if (activeItem.includes("pickaxe")) {
            action = "MINING";
          } else if (activeItem.includes("axe")) {
            action = "AXE";
          } else if (
            activeItem.includes("hoe") ||
            activeItem.includes("shovel")
          ) {
            action = "DIG";
            dur = 0.35;
          } else if (activeItem.includes("water")) {
            action = "WATERING";
            dur = 0.35;
          } else if (activeItem.includes("hammer") || engine.buildPiece) {
            action = "HAMMERING";
            dur = 0.35;
          } else if (activeItem.includes("rod")) {
            action = "CASTING";
            dur = 0.35;
          } else {
            action = "ATTACK";
          }
          const progress = Math.min(1, Math.max(0, 1 - p.swingTimer / dur));
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
          hurtTimer: p.hurtTimer || 0,
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

              ].includes(action),
          },
        };

        if ((p as any).isMountedBoat) {
          const boatImg = this.getSpriteImage("coracle");
          if (boatImg) {
            const bob = Math.sin(Date.now() / 350) * 2;
            const bw = cellSize * 2.0;
            const bh = cellSize * 1.5;
            ctx.drawImage(
              boatImg,
              0,
              0,
              48,
              37,
              playerCenterX - bw / 2,
              groundY - bh / 2 + bob + cellSize * 0.15,
              bw,
              bh,
            );
          }
        }

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

        if (p.isBlocking) {
          ctx.save();
          ctx.font = `${14 * (this.zoom / 2)}px sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText("🛡️", playerCenterX + 14, groundY - cellSize * 0.7);
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(playerCenterX, groundY - cellSize * 0.4, cellSize * 0.45, -Math.PI * 0.7, Math.PI * 0.7);
          ctx.stroke();
          ctx.restore();
        }
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

            // Determine active held tool/item
            const rpItem = rp.activeHeldItem || (rp.hotbar ? rp.hotbar[rp.activeHotbarIndex || 0]?.item : null);
            const rpItemDef = rpItem ? (ITEM_CATALOG as Record<string, any>)[rpItem] : null;
            const isToolOrWeapon = rpItemDef?.category === "tool" || rpItemDef?.category === "weapon" || (!!rpItem && (rpItem.includes("axe") || rpItem.includes("pickaxe") || rpItem.includes("sword") || rpItem.includes("shovel") || rpItem.includes("water") || rpItem.includes("hammer") || rpItem.includes("rod")));

            let action = "IDLE";
            let frameIndex = 0;

            if (rp.isDead) {
              action = "DEATH";
              frameIndex = Math.min(12, Math.floor(Date.now() / 100) % 13);
            } else if (rp.hurtTimer > 0) {
              action = "HURT";
              frameIndex = Math.floor(Date.now() / 90) % 8;
            } else if (rp.fishingState && rp.fishingState !== "NONE") {
              if (rp.fishingState === "CASTING") {
                action = "CASTING";
                frameIndex = Math.floor(Date.now() / 90) % 15;
              } else if (rp.fishingState === "REELING") {
                action = "REELING";
                frameIndex = Math.floor(Date.now() / 90) % 13;
              } else if (rp.fishingState === "CAUGHT") {
                action = "CAUGHT";
                frameIndex = Math.floor(Date.now() / 90) % 10;
              }
            } else if (rp.doingTimer > 0) {
              action = "DOING";
              frameIndex = Math.floor(Date.now() / 110) % 8;
            } else if (rp.rollTimer > 0) {
              action = "ROLL";
              frameIndex = Math.floor(Date.now() / 80) % 10;
            } else if (rp.swingTimer > 0) {
              const activeItem = rpItem || "";
              let dur = (rp as any).swingDuration || 0.25;
              if (rp.activeAction) {
                action = rp.activeAction;
              } else if (activeItem.includes("pickaxe")) {
                action = "MINING";
              } else if (activeItem.includes("axe")) {
                action = "AXE";
              } else if (activeItem.includes("hoe") || activeItem.includes("shovel")) {
                action = "DIG";
                dur = 0.35;
              } else if (activeItem.includes("water")) {
                action = "WATERING";
                dur = 0.35;
              } else if (activeItem.includes("hammer")) {
                action = "HAMMERING";
                dur = 0.35;
              } else if (activeItem.includes("rod")) {
                action = "CASTING";
                dur = 0.35;
              } else {
                action = "ATTACK";
              }
              const progress = Math.min(1, Math.max(0, 1 - rp.swingTimer / dur));
              const totalF = HUMAN_ANIMATIONS[action]?.totalFrames || 10;
              frameIndex = Math.min(totalF - 1, Math.floor(progress * totalF));
            } else if (rp.isSwimming) {
              action = "SWIMMING";
              frameIndex = Math.floor(Date.now() / 100) % 12;
            } else if (rp.hopTimer > 0) {
              action = "JUMP";
              const progress = Math.max(0, Math.min(1, 1 - rp.hopTimer / 0.55));
              frameIndex = Math.min(8, Math.floor(progress * 9));
            } else if (rp.isSprinting && (rp.vx !== 0 || rp.vy !== 0)) {
              action = "RUN";
              frameIndex = Math.floor(Date.now() / 90) % 8;
            } else if (rp.vx !== 0 || rp.vy !== 0) {
              action = "WALK";
              frameIndex = Math.floor(Date.now() / 110) % 8;
            } else {
              action = "IDLE";
              frameIndex = Math.floor(Date.now() / 140) % 9;
            }

            const remoteEntity: any = {
              position: { x: rp.x, y: rp.y },
              species: "player",
              type: "PLAYER",
              isActive: true,
              behaviorState: rp.isDead ? "DEAD" : "WALK",
              hairstyle: rp.hairstyle || "curlyhair",
              hurtTimer: rp.hurtTimer || 0,
              anim: {
                action,
                currentFrame: frameIndex,
                flipX: isFacingLeft,
                jumpOffset: (rp.hopOffset || 0) * 24,
                eatingBobOffset: 0,
                deathAlpha: 1.0,
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
                  ].includes(action),
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

            if (rp.isBlocking) {
              ctx.save();
              ctx.font = `${14 * (this.zoom / 2)}px sans-serif`;
              ctx.textAlign = "center";
              ctx.fillText("🛡️", playerCenterX + 14, groundY - cellSize * 0.7);
              ctx.strokeStyle = "#38bdf8";
              ctx.lineWidth = 2.5;
              ctx.beginPath();
              ctx.arc(playerCenterX, groundY - cellSize * 0.4, cellSize * 0.45, -Math.PI * 0.7, Math.PI * 0.7);
              ctx.stroke();
              ctx.restore();
            }

            // Health bar if damaged (< 100)
            if (rp.health !== undefined && rp.health < 100) {
              ctx.save();
              const hpW = 34;
              const hpH = 4;
              const hpX = playerCenterX - hpW / 2;
              const hpY = groundY - cellSize * 1.5 - 7;
              const hpPct = Math.max(0, Math.min(1, rp.health / 100));
              ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
              ctx.fillRect(hpX - 1, hpY - 1, hpW + 2, hpH + 2);
              ctx.fillStyle = hpPct > 0.5 ? "#22c55e" : hpPct > 0.25 ? "#eab308" : "#ef4444";
              ctx.fillRect(hpX, hpY, hpW * hpPct, hpH);
              ctx.restore();
            }

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

    // ── LAYER 7b: DRIFTING ATMOSPHERIC PARTICLES (Leaves, Petals, Pollen) ──
    const nowSec = Date.now() / 1000;
    for (let i = 0; i < 24; i++) {
      const seed = i * 137.49;
      const px = ((seed * 43 + nowSec * 35) % (canvas.width + 120)) - 60;
      const py = ((seed * 67 + Math.sin(nowSec * 1.2 + seed) * 30) % (canvas.height + 120)) - 60;
      const isLeaf = i % 3 === 0;
      ctx.save();
      ctx.fillStyle = isLeaf ? "rgba(74, 222, 128, 0.45)" : "rgba(254, 240, 138, 0.4)";
      ctx.beginPath();
      ctx.arc(px, py, isLeaf ? 2.0 : 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── LAYER 7c: CINEMATIC COLOR TEMPERATURE (Golden Hour Dawn/Dusk) ──
    const hour = engine.worldTime.hour + engine.worldTime.minute / 60;
    let goldenHourIntensity = 0;
    if (hour >= 5.0 && hour <= 7.5) {
      goldenHourIntensity = 1 - Math.abs(hour - 6.25) / 1.25;
    } else if (hour >= 17.5 && hour <= 20.0) {
      goldenHourIntensity = 1 - Math.abs(hour - 18.75) / 1.25;
    }
    if (goldenHourIntensity > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(251, 146, 60, ${0.12 * goldenHourIntensity})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    // ── LAYER 8: DYNAMIC NIGHT LIGHTING CUTOUT ──────────────────
    if (engine.worldTime.lightLevel < 0.65) {
      ctx.save();
      const darkness = (0.65 - engine.worldTime.lightLevel) / 0.65;

      if (!this.nightCanvas) {
        this.nightCanvas = document.createElement("canvas");
      }
      if (
        this.nightCanvas.width !== canvas.width ||
        this.nightCanvas.height !== canvas.height
      ) {
        this.nightCanvas.width = canvas.width;
        this.nightCanvas.height = canvas.height;
      }
      const lctx = this.nightCanvas.getContext("2d");

      if (lctx) {
        lctx.clearRect(0, 0, this.nightCanvas.width, this.nightCanvas.height);
        lctx.fillStyle = `rgba(10, 15, 28, ${Math.min(0.90, darkness * 0.95)})`;
        lctx.fillRect(0, 0, this.nightCanvas.width, this.nightCanvas.height);
        lctx.globalCompositeOperation = "destination-out";

        // Cutout around Player
        const activeItem = engine.getActiveItemSlot()?.item;
        const isHoldingTorch = activeItem === "torch";
        if (!this.isWorldGenMode) {
          const playerScreen = worldToScreen(engine.player.x, engine.player.y);
          const playerRadius = (isHoldingTorch ? 170 : 95) * (this.zoom / 2);

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

        // Cutouts for remote players
        if (engine.remotePlayers && Array.isArray(engine.remotePlayers)) {
          for (const rp of engine.remotePlayers) {
            if (!rp || typeof rp.x !== "number" || typeof rp.y !== "number") continue;
            const rScreen = worldToScreen(rp.x, rp.y);
            const rRadius = 90 * (this.zoom / 2);
            const rGlow = lctx.createRadialGradient(
              rScreen.sx + cellSize / 2,
              rScreen.sy + cellSize / 2,
              10,
              rScreen.sx + cellSize / 2,
              rScreen.sy + cellSize / 2,
              rRadius,
            );
            rGlow.addColorStop(0, "rgba(0,0,0,1)");
            rGlow.addColorStop(0.7, "rgba(0,0,0,0.8)");
            rGlow.addColorStop(1, "rgba(0,0,0,0)");
            lctx.fillStyle = rGlow;
            lctx.beginPath();
            lctx.arc(
              rScreen.sx + cellSize / 2,
              rScreen.sy + cellSize / 2,
              rRadius,
              0,
              Math.PI * 2,
            );
            lctx.fill();
          }
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

        lctx.globalCompositeOperation = "source-over";
        ctx.drawImage(this.nightCanvas, 0, 0);
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

    // ── LAYER 9b: MIDNIGHT INVASION ROLLING FOG ─────────────────
    if (engine.worldTime.hour === 0 || engine.worldTime.hour === 23) {
      ctx.save();
      const fogSec = Date.now() / 1000;
      for (let fi = 0; fi < 5; fi++) {
        const fogX = ((fi * 220 + fogSec * 18) % (canvas.width + 300)) - 150;
        const fogY = (fi * 110 + Math.sin(fogSec * 0.8 + fi) * 40) % canvas.height;
        const fogGrad = ctx.createRadialGradient(fogX, fogY, 20, fogX, fogY, 180);
        fogGrad.addColorStop(0, "rgba(99, 102, 241, 0.14)");
        fogGrad.addColorStop(0.6, "rgba(59, 130, 246, 0.08)");
        fogGrad.addColorStop(1, "rgba(30, 27, 75, 0)");
        ctx.fillStyle = fogGrad;
        ctx.beginPath();
        ctx.arc(fogX, fogY, 180, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // ── LAYER 10: QUEST & ADVENTURE JOURNAL MODAL ([J] Key) ─────
    if ((engine as any).showJournal) {
      ctx.save();
      // Dark backdrop
      ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const modalW = Math.min(680, canvas.width - 40);
      const modalH = Math.min(460, canvas.height - 40);
      const mx = (canvas.width - modalW) / 2;
      const my = (canvas.height - modalH) / 2;

      // Outer diary panel frame
      ctx.fillStyle = "#fffbeb";
      ctx.strokeStyle = "#78350f";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(mx, my, modalW, modalH, 12);
      ctx.fill();
      ctx.stroke();

      // Inner ornate header banner
      ctx.fillStyle = "#78350f";
      ctx.beginPath();
      ctx.roundRect(mx + 8, my + 8, modalW - 16, 44, 8);
      ctx.fill();

      ctx.font = "bold 18px 'Outfit', sans-serif";
      ctx.fillStyle = "#fef08a";
      ctx.textAlign = "center";
      ctx.fillText("📖 ADVENTURE JOURNAL & GUILD LOG", mx + modalW / 2, my + 36);

      // Tab bar
      const activeTab = (engine as any).activeJournalTab || "ALMANAC";
      const tabs = [
        { id: "ALMANAC", label: "🌱 Farmer's Almanac" },
        { id: "ANGLER", label: "🎣 Angler's Log" },
        { id: "QUESTS", label: "📜 Village Quests" },
      ];

      const tabW = (modalW - 32) / tabs.length;
      tabs.forEach((tab, ti) => {
        const tx = mx + 16 + ti * tabW;
        const ty = my + 60;
        const isSelected = activeTab === tab.id;
        ctx.fillStyle = isSelected ? "#fef3c7" : "#e2e8f0";
        ctx.strokeStyle = isSelected ? "#b45309" : "#94a3b8";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(tx + 2, ty, tabW - 4, 30, 6);
        ctx.fill();
        ctx.stroke();

        ctx.font = isSelected ? "bold 13px sans-serif" : "12px sans-serif";
        ctx.fillStyle = isSelected ? "#78350f" : "#475569";
        ctx.textAlign = "center";
        ctx.fillText(tab.label, tx + tabW / 2, ty + 20);
      });

      // Tab Content Area
      const contentY = my + 104;
      if (activeTab === "ALMANAC") {
        // Full 11 crops list with seasonal badge & discovery
        ctx.font = "bold 13px sans-serif";
        ctx.fillStyle = "#78350f";
        ctx.textAlign = "left";
        ctx.fillText(`Current Season: ${(engine.worldTime as any).season || "Spring"} (Day ${engine.worldTime.dayNumber})`, mx + 24, contentY + 14);

        const CROPS_LIST = [
          { name: "Cabbage", season: "Spring", icon: "cabbage_05" },
          { name: "Carrot", season: "Spring", icon: "carrot_05" },
          { name: "Parsnip", season: "Spring", icon: "parsnip_05" },
          { name: "Radish", season: "Spring", icon: "radish_05" },
          { name: "Wheat", season: "Summer", icon: "wheat_05" },
          { name: "Sunflower", season: "Summer", icon: "sunflower_05" },
          { name: "Cauliflower", season: "Summer", icon: "cauliflower_05" },
          { name: "Pumpkin", season: "Autumn", icon: "pumpkin_05" },
          { name: "Beetroot", season: "Autumn", icon: "beetroot_05" },
          { name: "Kale", season: "Autumn", icon: "kale_05" },
          { name: "Potato", season: "Autumn", icon: "potato_05" },
        ];

        CROPS_LIST.forEach((c, idx) => {
          const col = idx % 4;
          const row = Math.floor(idx / 4);
          const cx = mx + 24 + col * ((modalW - 48) / 4);
          const cy = contentY + 30 + row * 90;

          ctx.fillStyle = "#ffffff";
          ctx.strokeStyle = "#cbd5e1";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(cx, cy, (modalW - 72) / 4, 80, 8);
          ctx.fill();
          ctx.stroke();

          // Crop icon
          const cropImg = this.getCropImage(c.icon);
          if (cropImg) {
            ctx.drawImage(cropImg, cx + 8, cy + 12, 32, 32);
          }

          ctx.font = "bold 12px sans-serif";
          ctx.fillStyle = "#0f172a";
          ctx.textAlign = "left";
          ctx.fillText(c.name, cx + 46, cy + 24);

          ctx.font = "10px sans-serif";
          ctx.fillStyle = c.season === "Spring" ? "#16a34a" : c.season === "Summer" ? "#d97706" : "#b45309";
          ctx.fillText(c.season, cx + 46, cy + 40);

          ctx.fillStyle = "#64748b";
          ctx.fillText("✓ Recorded", cx + 46, cy + 56);
        });
      } else if (activeTab === "ANGLER") {
        ctx.font = "bold 13px sans-serif";
        ctx.fillStyle = "#78350f";
        ctx.textAlign = "left";
        ctx.fillText("Freshwater & Deep Ocean Species Log", mx + 24, contentY + 14);

        const FISH_LIST = [
          { name: "Sunnyside Bass", rarity: "Common", weight: "2.4 kg", habitat: "Village Pond" },
          { name: "River Salmon", rarity: "Uncommon", weight: "4.1 kg", habitat: "Swift Rivers" },
          { name: "Rainbow Trout", rarity: "Uncommon", weight: "3.2 kg", habitat: "Clear Lakes" },
          { name: "Golden Carp", rarity: "Rare", weight: "5.8 kg", habitat: "Deep Lakes" },
          { name: "Midnight Catfish", rarity: "Rare", weight: "7.0 kg", habitat: "Night Waters" },
          { name: "Great Reef Shark", rarity: "Legendary", weight: "42.5 kg", habitat: "Deep Ocean" },
        ];

        FISH_LIST.forEach((f, idx) => {
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          const fx = mx + 24 + col * ((modalW - 48) / 2);
          const fy = contentY + 30 + row * 95;

          ctx.fillStyle = "#ffffff";
          ctx.strokeStyle = "#cbd5e1";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(fx, fy, (modalW - 64) / 2, 85, 8);
          ctx.fill();
          ctx.stroke();

          ctx.font = "bold 24px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("🐟", fx + 32, fy + 48);

          ctx.font = "bold 13px sans-serif";
          ctx.fillStyle = "#0f172a";
          ctx.textAlign = "left";
          ctx.fillText(f.name, fx + 60, fy + 26);

          ctx.font = "11px sans-serif";
          ctx.fillStyle = f.rarity === "Legendary" ? "#e11d48" : f.rarity === "Rare" ? "#9333ea" : "#2563eb";
          ctx.fillText(`${f.rarity} • Max: ${f.weight}`, fx + 60, fy + 46);

          ctx.fillStyle = "#64748b";
          ctx.fillText(`Habitat: ${f.habitat}`, fx + 60, fy + 64);
        });
      } else {
        // Quests tab
        ctx.font = "bold 13px sans-serif";
        ctx.fillStyle = "#78350f";
        ctx.textAlign = "left";
        ctx.fillText("Village Notice Board Tasks (Rewards Gold Coins)", mx + 24, contentY + 14);

        const QUESTS_LIST = [
          { title: "Milling for the Outpost", desc: "Deliver 10 Wheat to the Windmill to grind into flour.", reward: "25 Coins", status: "Active" },
          { title: "Bakery Warmth", desc: "Bake 2 Fresh Loaves of Bread in the Stone Oven.", reward: "30 Coins", status: "Active" },
          { title: "Midnight Vanguard", desc: "Defend the settlement against 3 midnight invading skeletons.", reward: "50 Coins", status: "Active" },
          { title: "Ocean Wayfarer", desc: "Board a Coracle Boat and explore an offshore island.", reward: "40 Coins", status: "Completed" },
        ];

        QUESTS_LIST.forEach((q, idx) => {
          const qy = contentY + 30 + idx * 72;
          ctx.fillStyle = "#ffffff";
          ctx.strokeStyle = "#cbd5e1";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(mx + 24, qy, modalW - 48, 64, 8);
          ctx.fill();
          ctx.stroke();

          ctx.font = "bold 13px sans-serif";
          ctx.fillStyle = "#0f172a";
          ctx.textAlign = "left";
          ctx.fillText(q.title, mx + 40, qy + 24);

          ctx.font = "11px sans-serif";
          ctx.fillStyle = "#64748b";
          ctx.fillText(q.desc, mx + 40, qy + 44);

          // Reward & status badge
          ctx.fillStyle = q.status === "Completed" ? "#dcfce7" : "#fef3c7";
          ctx.beginPath();
          ctx.roundRect(mx + modalW - 160, qy + 16, 120, 32, 6);
          ctx.fill();

          ctx.font = "bold 11px sans-serif";
          ctx.fillStyle = q.status === "Completed" ? "#16a34a" : "#b45309";
          ctx.textAlign = "center";
          ctx.fillText(`🪙 ${q.reward} [${q.status}]`, mx + modalW - 100, qy + 36);
        });
      }

      // Footer
      ctx.font = "11px sans-serif";
      ctx.fillStyle = "#78350f";
      ctx.textAlign = "center";
      ctx.fillText("Press [J] or [ESC] to close journal • Click tabs 1-3 to switch categories", mx + modalW / 2, my + modalH - 14);

      ctx.restore();
    }
  }
}
