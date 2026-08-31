/**
 * SettlementRenderer.ts
 * Renders a SettlementData onto a 2D canvas using actual assets from map.txt.
 * All asset paths are sourced exclusively from map.txt.
 */

import { SettlementData } from './SettlementGenerator';

// ═══════════════════════════════════════════════════════════════════
// ASSET DESCRIPTORS  (from map.txt)
// ═══════════════════════════════════════════════════════════════════

const TILESET_PATH = '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Tileset/sprite_sheet_16x_transparent.png';
const HOUSES_PATH  = '/houses.png';

type TilesetCrop = { x: number; y: number; w: number; h: number };

// All tileset slices from spr_tileset_sunnysideworld_16px.png (from map.txt)
const TILESET_CROPS: Record<string, TilesetCrop> = {
  // ── Grass Variants (Row y=48) ──────────────────────────────────
  grass_tile_01:       { x: 16,  y: 48,  w: 16, h: 16 }, // Lush standard
  grass_tile_02:       { x: 32,  y: 48,  w: 16, h: 16 }, // Natural edge shading
  grass_tile_03:       { x: 0,   y: 48,  w: 16, h: 16 }, // Clean flat green
  grass_tile_04:       { x: 64,  y: 48,  w: 16, h: 16 }, // Dense grass texture
  grass_tile_05:       { x: 80,  y: 48,  w: 16, h: 16 }, // Clover / flower accent
  grass_tile_06:       { x: 96,  y: 48,  w: 16, h: 16 }, // Shaded/mossy grass
  grass_tile_07:       { x: 112, y: 48,  w: 16, h: 16 }, // Sunlit grass patch
  grass_tile_08:       { x: 128, y: 48,  w: 16, h: 16 }, // Pebble accent grass
  grass_tuft_01:       { x: 48,  y: 48,  w: 16, h: 16 }, // Wild grass tuft overlay
  grass_tuft_02:       { x: 160, y: 48,  w: 16, h: 16 }, // Tall grass blade overlay
  grass_flower_accent: { x: 176, y: 48,  w: 16, h: 16 }, // Tiny wild flower overlay

  // ── Soil & Paths ────────────────────────────────────────────────
  dirt_tile_01:        { x: 16,  y: 112, w: 16, h: 16 }, // Rich brown dirt soil base
  path_dirt_light:     { x: 32,  y: 112, w: 16, h: 16 }, // Light dirt trail
  path_dirt_pebbles:   { x: 48,  y: 112, w: 16, h: 16 }, // Dirt with small stones
  sand_tile_01:        { x: 208, y: 48,  w: 16, h: 16 }, // Beach/desert golden sand (map.txt [004])
  sand_tile_02:        { x: 224, y: 48,  w: 16, h: 16 }, // Fine warm sand detail
  path_tile_02:        { x: 16,  y: 256, w: 16, h: 16 }, // Cobblestone path
  stone_tile_01:       { x: 80,  y: 256, w: 16, h: 16 }, // Stone/flagstone
  path_tile_03:        { x: 544, y: 112, w: 16, h: 16 }, // Boardwalk

  // ── Water & Shorelines ──────────────────────────────────────────
  water_tile_01:       { x: 352, y: 112, w: 16, h: 16 }, // Crystal river blue
  water_ripple_01:     { x: 352, y: 80,  w: 16, h: 16 }, // Light wave sparkle
  water_ripple_02:     { x: 368, y: 80,  w: 16, h: 16 }, // Medium ripple
  water_ripple_03:     { x: 384, y: 80,  w: 16, h: 16 }, // Foam swirl detail
  water_deep_01:       { x: 400, y: 112, w: 16, h: 16 }, // Deep water shade
  shore_transition_01: { x: 368, y: 112, w: 16, h: 16 }, // Shoreline transition tile (water to SE)
};

// Direction tags for shore tiles stored in terrain grid
const SHORE_DIRECTIONS = new Set(['shore_SE', 'shore_SW', 'shore_NE', 'shore_NW']);

// Rotation angles for shore tile per direction tag
// shore_transition_01 has water pointing to SE, so:
const SHORE_ROTATION: Record<string, number> = {
  shore_SE: 0,              // original — water to bottom-right
  shore_SW: Math.PI / 2,    // 90° CW — water to bottom-left
  shore_NE: -Math.PI / 2,   // 90° CCW — water to top-right
  shore_NW: Math.PI,        // 180° — water to top-left
};

interface SpriteAsset {
  path: string;
  w: number;
  h: number;
  frames?: number;
}

const SPRITE_ASSETS: Record<string, SpriteAsset> = {
  tree_oak_01:  { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Plants/spr_deco_tree_01_strip4.png', w: 32, h: 34, frames: 4 },
  tree_pine_01: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Plants/spr_deco_tree_02_strip4.png', w: 28, h: 43, frames: 4 },
  tree_sway_strip: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Plants/spr_deco_tree_02_strip4.png', w: 28, h: 43, frames: 4 },
  animal_duck:    { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Animals/spr_deco_duck_01_strip4.png', w: 16, h: 16, frames: 4 },
  animal_chicken: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Animals/spr_deco_chicken_01_strip4.png', w: 32, h: 32, frames: 4 },
  animal_sheep:   { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Animals/spr_deco_sheep_01_strip4.png', w: 32, h: 32, frames: 4 },
  animal_pig:     { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Animals/spr_deco_pig_01_strip4.png', w: 32, h: 32, frames: 4 },
  animal_cow:     { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Animals/spr_deco_cow_strip4.png', w: 32, h: 32, frames: 4 },
  boat_coracle_water: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Other/spr_deco_coracle_strip4.png', w: 48, h: 37, frames: 4 },
  boat_coracle_land:  { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Other/spr_deco_coracle_land.png', w: 32, h: 30, frames: 1 },
  bld_windmill: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Other/spr_deco_windmill_withshadow_strip9.png', w: 112, h: 112, frames: 9 },
  plant_shroom_blue_01: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Plants/spr_deco_mushroom_blue_01_strip4.png', w: 16, h: 16, frames: 4 },
  plant_shroom_blue_02: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Plants/spr_deco_mushroom_blue_02_strip4.png', w: 16, h: 16, frames: 4 },
  plant_shroom_blue_03: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Plants/spr_deco_mushroom_blue_03_strip4.png', w: 16, h: 16, frames: 4 },
  plant_shroom_red_01:  { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Plants/spr_deco_mushroom_red_01_strip4.png', w: 16, h: 16, frames: 4 },
  flowers_wild_01:  { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_flowers_house_01/36388643-e82c-4037-97b4-3d1fa4cb65fb.png', w: 8, h: 18, frames: 1 },
  flowers_wild_02:  { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_flowers_house_02/93175c94-bed5-4a79-9562-232e8f9f075e.png', w: 12, h: 19, frames: 1 },
  plant_flowers_01: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_flowers_house_01/36388643-e82c-4037-97b4-3d1fa4cb65fb.png', w: 8, h: 18, frames: 1 },
  plant_flowers_02: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_flowers_house_02/93175c94-bed5-4a79-9562-232e8f9f075e.png', w: 12, h: 19, frames: 1 },
  farm_well:         { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_well/c3d011a3-e1d2-4f14-83d7-d21b9f689713.png', w: 20, h: 25, frames: 1 },
  farm_well_covered: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_well_covered/28ee3935-0d63-4141-b01a-2338fa50e040.png', w: 20, h: 40, frames: 1 },
  farm_trough:       { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_trough/e83dc18e-a89c-4aae-999e-4531c1c9bb02.png', w: 29, h: 16, frames: 1 },
  farm_waterbowl:    { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_waterbowl/fb5f5698-0641-4a29-aad1-d97504abe0d6.png', w: 8, h: 11, frames: 1 },
  farm_crate_01:      { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_crate_01/658157b4-7ff5-452e-9e1d-c4cad561928b.png', w: 16, h: 21, frames: 1 },
  farm_crate_02:      { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_crate_02/d9ac3d57-03c4-4730-98eb-600ee4457ee2.png', w: 16, h: 21, frames: 1 },
  farm_chest_closed:  { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_chest_01_closed/496b079e-4729-46a2-8b47-cff42b294c71.png', w: 16, h: 21, frames: 1 },
  farm_chest2_closed: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_chest_02_closed/791d5570-e16a-4994-afed-848c60f51ac2.png', w: 16, h: 21, frames: 1 },
  acorn_deco_01:   { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_acron/ada48c07-f133-4861-ac13-16e671ac36cd.png', w: 10, h: 9, frames: 1 },
  truffle_deco_01: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_truffle/e6dbb225-174c-41bd-ab66-36e9fff04f0a.png', w: 10, h: 10, frames: 1 },
  small_rock_01:   { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/rock.png', w: 10, h: 10, frames: 1 },
  piece_beam:      { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_beam/12bd53e7-32e4-4a56-9cbe-87d03fc99557.png', w: 16, h: 16, frames: 1 },
  mushrooms_deco_blue: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_mushroom_blue_01/28f072d2-4413-4dab-a4b7-7473337cd625.png', w: 16, h: 16, frames: 1 },
  mushrooms_deco_red:  { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_mushroom_red_01/32c3ffa9-6757-47f4-9800-5b7024450659.png', w: 16, h: 16, frames: 1 },
};

// Crop PNG paths — ALL 11 crop types × 6 stages (from map.txt)
const CROP_IMAGE_PATHS: Record<string, { path: string; w: number; h: number }> = {
  crop_wheat_stage_0: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/wheat_00.png', w: 6, h: 6 },
  crop_wheat_stage_1: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/wheat_01.png', w: 11, h: 7 },
  crop_wheat_stage_2: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/wheat_02.png', w: 11, h: 10 },
  crop_wheat_stage_3: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/wheat_03.png', w: 13, h: 14 },
  crop_wheat_stage_4: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/wheat_04.png', w: 13, h: 16 },
  crop_wheat_stage_5: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/wheat_05.png', w: 13, h: 13 },
  crop_carrot_stage_0: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/carrot_00.png', w: 7, h: 7 },
  crop_carrot_stage_1: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/carrot_01.png', w: 6, h: 7 },
  crop_carrot_stage_2: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/carrot_02.png', w: 6, h: 7 },
  crop_carrot_stage_3: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/carrot_03.png', w: 8, h: 10 },
  crop_carrot_stage_4: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/carrot_04.png', w: 10, h: 13 },
  crop_carrot_stage_5: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/carrot_05.png', w: 12, h: 12 },
  crop_potato_stage_0: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/potato_00.png', w: 6, h: 6 },
  crop_potato_stage_1: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/potato_01.png', w: 6, h: 6 },
  crop_potato_stage_2: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/potato_02.png', w: 8, h: 8 },
  crop_potato_stage_3: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/potato_03.png', w: 8, h: 11 },
  crop_potato_stage_4: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/potato_04.png', w: 11, h: 15 },
  crop_potato_stage_5: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/potato_05.png', w: 10, h: 10 },
  crop_pumpkin_stage_0: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/pumpkin_00.png', w: 7, h: 7 },
  crop_pumpkin_stage_1: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/pumpkin_01.png', w: 8, h: 7 },
  crop_pumpkin_stage_2: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/pumpkin_02.png', w: 9, h: 9 },
  crop_pumpkin_stage_3: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/pumpkin_03.png', w: 12, h: 11 },
  crop_pumpkin_stage_4: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/pumpkin_04.png', w: 12, h: 14 },
  crop_pumpkin_stage_5: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/pumpkin_05.png', w: 12, h: 14 },
  crop_cabbage_stage_0: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/cabbage_00.png', w: 5, h: 5 },
  crop_cabbage_stage_1: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/cabbage_01.png', w: 10, h: 7 },
  crop_cabbage_stage_2: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/cabbage_02.png', w: 8, h: 7 },
  crop_cabbage_stage_3: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/cabbage_03.png', w: 12, h: 10 },
  crop_cabbage_stage_4: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/cabbage_04.png', w: 16, h: 13 },
  crop_cabbage_stage_5: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/cabbage_05.png', w: 12, h: 11 },
  crop_cauliflower_stage_0: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/cauliflower_00.png', w: 5, h: 5 },
  crop_cauliflower_stage_1: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/cauliflower_01.png', w: 6, h: 7 },
  crop_cauliflower_stage_2: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/cauliflower_02.png', w: 8, h: 8 },
  crop_cauliflower_stage_3: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/cauliflower_03.png', w: 10, h: 11 },
  crop_cauliflower_stage_4: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/cauliflower_04.png', w: 12, h: 12 },
  crop_cauliflower_stage_5: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/cauliflower_05.png', w: 12, h: 12 },
  crop_kale_stage_0: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/kale_00.png', w: 5, h: 5 },
  crop_kale_stage_1: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/kale_01.png', w: 4, h: 7 },
  crop_kale_stage_2: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/kale_02.png', w: 6, h: 8 },
  crop_kale_stage_3: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/kale_03.png', w: 10, h: 9 },
  crop_kale_stage_4: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/kale_04.png', w: 14, h: 11 },
  crop_kale_stage_5: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/kale_05.png', w: 14, h: 11 },
  crop_parsnip_stage_0: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/parsnip_00.png', w: 6, h: 6 },
  crop_parsnip_stage_1: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/parsnip_01.png', w: 6, h: 6 },
  crop_parsnip_stage_2: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/parsnip_02.png', w: 8, h: 7 },
  crop_parsnip_stage_3: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/parsnip_03.png', w: 8, h: 8 },
  crop_parsnip_stage_4: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/parsnip_04.png', w: 10, h: 14 },
  crop_parsnip_stage_5: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/parsnip_05.png', w: 14, h: 14 },
  crop_radish_stage_0: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/radish_00.png', w: 6, h: 6 },
  crop_radish_stage_1: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/radish_01.png', w: 6, h: 6 },
  crop_radish_stage_2: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/radish_02.png', w: 8, h: 7 },
  crop_radish_stage_3: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/radish_03.png', w: 8, h: 10 },
  crop_radish_stage_4: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/radish_04.png', w: 12, h: 15 },
  crop_radish_stage_5: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/radish_05.png', w: 12, h: 15 },
  crop_beetroot_stage_0: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/beetroot_00.png', w: 5, h: 5 },
  crop_beetroot_stage_1: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/beetroot_01.png', w: 6, h: 5 },
  crop_beetroot_stage_2: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/beetroot_02.png', w: 8, h: 6 },
  crop_beetroot_stage_3: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/beetroot_03.png', w: 8, h: 11 },
  crop_beetroot_stage_4: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/beetroot_04.png', w: 12, h: 14 },
  crop_beetroot_stage_5: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/beetroot_05.png', w: 16, h: 16 },
  crop_sunflower_stage_0: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/sunflower_00.png', w: 7, h: 7 },
  crop_sunflower_stage_1: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/sunflower_01.png', w: 10, h: 7 },
  crop_sunflower_stage_2: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/sunflower_02.png', w: 11, h: 9 },
  crop_sunflower_stage_3: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/sunflower_03.png', w: 11, h: 13 },
  crop_sunflower_stage_4: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/sunflower_04.png', w: 13, h: 19 },
  crop_sunflower_stage_5: { path: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/sunflower_05.png', w: 13, h: 16 },
};

const SOIL_PATH = '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/soil_01.png';

const HOUSE_CROPS: Record<string, [number, number, number, number]> = {
  house_cottage_01:    [89,   50,  215, 204],
  house_farmhouse_01:  [435,  72,  292, 181],
  house_barn_01:       [873,  38,  179, 212],
  house_workshop_01:   [1186, 60,  274, 197],
  house_tavern_01:     [74,   270, 228, 210],
  house_shop_01:       [444,  307, 280, 174],
  house_chapel_01:     [854,  273, 227, 206],
  house_stable_01:     [1198, 303, 254, 180],
  house_warehouse_01:  [80,   490, 208, 212],
  house_merchant_01:   [445,  524, 283, 181],
  house_blacksmith_01: [877,  486, 182, 218],
  house_windmill_01:   [1198, 545, 258, 158],
  house_mansion_01:    [67,   734, 240, 227],
  house_cabin_01:      [457,  769, 262, 198],
  house_castle_01:     [841,  734, 231, 232],
  house_lighthouse_01: [1212, 787, 261, 181],
};

// ═══════════════════════════════════════════════════════════════════
// IMAGE CACHE
// ═══════════════════════════════════════════════════════════════════

const imageCache: Map<string, HTMLImageElement | null> = new Map();

function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (imageCache.has(src)) {
    return Promise.resolve(imageCache.get(src)!);
  }
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => { imageCache.set(src, img); resolve(img); };
    img.onerror = () => { imageCache.set(src, null); resolve(null); };
    img.src = src;
  });
}

// ═══════════════════════════════════════════════════════════════════
// TERRAIN NOISE
// ═══════════════════════════════════════════════════════════════════

function valueNoise(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.3) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x); const iy = Math.floor(y);
  const fx = x - ix; const fy = y - iy;
  const a = valueNoise(ix, iy, seed), b = valueNoise(ix + 1, iy, seed);
  const c = valueNoise(ix, iy + 1, seed), d = valueNoise(ix + 1, iy + 1, seed);
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fractalNoise(x: number, y: number, seed: number): number {
  return (
    smoothNoise(x * 0.3, y * 0.3, seed) * 0.571 +
    smoothNoise(x * 0.6, y * 0.6, seed + 100) * 0.286 +
    smoothNoise(x * 1.2, y * 1.2, seed + 200) * 0.143
  );
}

// ═══════════════════════════════════════════════════════════════════
// PATH STRENGTH GRID
// ═══════════════════════════════════════════════════════════════════

function buildPathGrid(data: SettlementData): number[][] {
  const grid: number[][] = Array.from({ length: data.height }, () => new Array(data.width).fill(0));

  for (const path of data.paths) {
    const nodes = path.nodes;
    if (nodes.length < 2) continue;
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i], b = nodes[i + 1];
      const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), 1) * 4;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const wx = a.x + (b.x - a.x) * t;
        const wy = a.y + (b.y - a.y) * t;
        // Paint soft blob
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const cx = Math.round(wx) + dx;
            const cy = Math.round(wy) + dy;
            if (cx < 0 || cx >= data.width || cy < 0 || cy >= data.height) continue;
            const dist = Math.sqrt((cx - wx) ** 2 + (cy - wy) ** 2);
            const str = Math.max(0, 1 - dist / 1.2);
            if (str > grid[cy][cx]) grid[cy][cx] = str;
          }
        }
      }
    }
  }
  return grid;
}

// ═══════════════════════════════════════════════════════════════════
// TILESET DRAW HELPERS
// ═══════════════════════════════════════════════════════════════════

function drawTile(
  ctx: CanvasRenderingContext2D,
  tileset: HTMLImageElement,
  crop: TilesetCrop,
  dx: number, dy: number, dw: number, dh: number
) {
  ctx.drawImage(tileset, crop.x, crop.y, crop.w, crop.h, dx, dy, dw, dh);
}

/**
 * Draw shore tile with rotation around the cell center.
 * angle = SHORE_ROTATION[tag] (radians).
 */
function drawShoreTile(
  ctx: CanvasRenderingContext2D,
  tileset: HTMLImageElement,
  dx: number, dy: number, dw: number, dh: number,
  angle: number
) {
  const cx = dx + dw / 2;
  const cy = dy + dh / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.drawImage(
    tileset,
    TILESET_CROPS.shore_transition_01.x, TILESET_CROPS.shore_transition_01.y,
    TILESET_CROPS.shore_transition_01.w, TILESET_CROPS.shore_transition_01.h,
    -dw / 2, -dh / 2, dw, dh
  );
  ctx.restore();
}

/**
 * Build a seeded hash noise for sand tile scatter (not fractalNoise to keep it independent).
 * Returns true if this cell should display a sandy path tile.
 * No two adjacent cells can both be sandy (manhattan adjacency).
 */
function buildSandScatterGrid(data: SettlementData, pathGrid: number[][]): boolean[][] {
  const grid: boolean[][] = Array.from({ length: data.height }, () => new Array(data.width).fill(false));
  // Seeded pass: mark candidates
  for (let y = 0; y < data.height; y++) {
    for (let x = 0; x < data.width; x++) {
      if (pathGrid[y][x] < 0.55) continue; // only strong path cells
      // deterministic hash based on seed + position
      const n = Math.sin(x * 53.7 + y * 91.3 + data.seed * 0.017) * 43758.5453;
      const v = n - Math.floor(n);
      if (v < 0.14) grid[y][x] = true; // ~14% raw chance
    }
  }
  // Enforce no-adjacent constraint: if a cell is marked and so is its left/up neighbor, remove this one
  for (let y = 0; y < data.height; y++) {
    for (let x = 0; x < data.width; x++) {
      if (!grid[y][x]) continue;
      // Check left and up (already-processed cells)
      if ((x > 0 && grid[y][x - 1]) || (y > 0 && grid[y - 1][x])) {
        grid[y][x] = false;
      }
    }
  }
  return grid;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════

export async function renderSettlement(
  canvas: HTMLCanvasElement,
  data: SettlementData,
  cellSize = 32
): Promise<void> {
  const W = data.width * cellSize;
  const H = data.height * cellSize;
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // Dark background
  ctx.fillStyle = '#101820';
  ctx.fillRect(0, 0, W, H);

  // Pre-load core images in parallel
  const [tilesetImg, housesImg, soilImg] = await Promise.all([
    loadImage(TILESET_PATH),
    loadImage(HOUSES_PATH),
    loadImage(SOIL_PATH),
  ]);

  // Also warm up sprite cache
  await Promise.all(
    Object.values(SPRITE_ASSETS).map(a => loadImage(a.path))
  );

  const pathGrid = buildPathGrid(data);
  const sandGrid = buildSandScatterGrid(data, pathGrid);

  // ── LAYER 0: TERRAIN ────────────────────────────────────────────────
  for (let y = 0; y < data.height; y++) {
    for (let x = 0; x < data.width; x++) {
      const px = x * cellSize, py = y * cellSize;
      const terrain = data.terrain[y][x];
      const pathStr = pathGrid[y][x];

      if (terrain === 'water_tile_01') {
        if (tilesetImg) {
          // Dynamic water textures: ripples and deep shades using value noise
          const wNoise = valueNoise(x * 1.5, y * 1.5, data.seed + 333);
          let wCrop: TilesetCrop;
          if (wNoise < 0.35) {
            wCrop = TILESET_CROPS.water_tile_01; // clear blue
          } else if (wNoise < 0.60) {
            wCrop = TILESET_CROPS.water_ripple_01; // sparkle ripple
          } else if (wNoise < 0.82) {
            wCrop = TILESET_CROPS.water_ripple_02; // medium ripple
          } else if (wNoise < 0.93) {
            wCrop = TILESET_CROPS.water_ripple_03; // foam swirl
          } else {
            wCrop = TILESET_CROPS.water_deep_01; // deep shade
          }
          drawTile(ctx, tilesetImg, wCrop, px, py, cellSize, cellSize);
        } else {
          ctx.fillStyle = '#1e4a80';
          ctx.fillRect(px, py, cellSize, cellSize);
        }
        continue;
      }

      // Shore tiles — direction-coded by generator
      if (SHORE_DIRECTIONS.has(terrain)) {
        const angle = SHORE_ROTATION[terrain] ?? 0;
        if (tilesetImg) {
          // Draw grass base first
          drawTile(ctx, tilesetImg, TILESET_CROPS.grass_tile_01, px, py, cellSize, cellSize);
          // Then draw rotated shore tile on top
          drawShoreTile(ctx, tilesetImg, px, py, cellSize, cellSize, angle);
        } else {
          ctx.fillStyle = '#3a6e50';
          ctx.fillRect(px, py, cellSize, cellSize);
        }
        continue;
      }

      // Dirt / Farm Soil base
      if (terrain === 'dirt_tile_01') {
        if (tilesetImg) {
          drawTile(ctx, tilesetImg, TILESET_CROPS.dirt_tile_01, px, py, cellSize, cellSize);
        } else {
          ctx.fillStyle = '#5a3e20';
          ctx.fillRect(px, py, cellSize, cellSize);
        }
        continue;
      }

      // Grass with fractal noise and rich palette variations
      if (tilesetImg) {
        const nv = fractalNoise(x, y, data.seed);
        let crop: TilesetCrop;
        if (nv < 0.15) crop = TILESET_CROPS.grass_tile_03;      // Clean flat green
        else if (nv < 0.30) crop = TILESET_CROPS.grass_tile_01; // Lush standard
        else if (nv < 0.45) crop = TILESET_CROPS.grass_tile_07; // Sunlit green
        else if (nv < 0.60) crop = TILESET_CROPS.grass_tile_02; // Edge/shaded
        else if (nv < 0.72) crop = TILESET_CROPS.grass_tile_04; // Dense blades
        else if (nv < 0.83) crop = TILESET_CROPS.grass_tile_06; // Mossy/shaded
        else if (nv < 0.92) crop = TILESET_CROPS.grass_tile_05; // Clover/flower
        else crop = TILESET_CROPS.grass_tile_08;                // Pebble grass

        drawTile(ctx, tilesetImg, crop, px, py, cellSize, cellSize);

        // Occasional tuft & wildflower accent overlays
        const tuftNv = valueNoise(x + 50, y + 50, data.seed + 999);
        if (tuftNv > 0.86 && pathStr < 0.1) {
          ctx.save();
          ctx.globalAlpha = 0.4;
          drawTile(ctx, tilesetImg, TILESET_CROPS.grass_tuft_01, px, py, cellSize, cellSize);
          ctx.restore();
        } else if (tuftNv > 0.76 && pathStr < 0.1) {
          ctx.save();
          ctx.globalAlpha = 0.35;
          drawTile(ctx, tilesetImg, TILESET_CROPS.grass_tuft_02, px, py, cellSize, cellSize);
          ctx.restore();
        } else if (tuftNv < 0.08 && pathStr < 0.1) {
          ctx.save();
          ctx.globalAlpha = 0.45;
          drawTile(ctx, tilesetImg, TILESET_CROPS.grass_flower_accent, px, py, cellSize, cellSize);
          ctx.restore();
        }

        // Blend paths (with sand tiles and textured dirt path variations)
        if (pathStr > 0.02) {
          if (sandGrid[y][x]) {
            // Sand tile from map.txt: random chance on path, strictly non-adjacent
            ctx.save();
            ctx.globalAlpha = Math.min(pathStr * 1.1, 1.0);
            const sandVariant = valueNoise(x, y, data.seed + 123) > 0.5 ? TILESET_CROPS.sand_tile_01 : TILESET_CROPS.sand_tile_02;
            drawTile(ctx, tilesetImg, sandVariant, px, py, cellSize, cellSize);
            ctx.restore();
          } else {
            // Varied dirt paths (smooth blends, pebbles, light trails)
            const pNoise = valueNoise(x * 2.1, y * 2.1, data.seed + 777);
            let pathCrop = TILESET_CROPS.dirt_tile_01;
            if (pNoise < 0.25) pathCrop = TILESET_CROPS.path_dirt_light;
            else if (pNoise > 0.75) pathCrop = TILESET_CROPS.path_dirt_pebbles;

            ctx.save();
            ctx.globalAlpha = pathStr * 0.92;
            drawTile(ctx, tilesetImg, pathCrop, px, py, cellSize, cellSize);
            ctx.restore();
          }
        }
      } else {
        const gv = Math.floor(72 + fractalNoise(x, y, data.seed) * 45);
        ctx.fillStyle = `rgb(28, ${gv}, 42)`;
        ctx.fillRect(px, py, cellSize, cellSize);
        if (pathStr > 0.02) {
          ctx.save();
          ctx.globalAlpha = pathStr;
          ctx.fillStyle = sandGrid[y][x] ? '#d4b46a' : '#7a5c18';
          ctx.fillRect(px, py, cellSize, cellSize);
          ctx.restore();
        }
      }
    }
  }

  // ── LAYER 1: FARMS ──────────────────────────────────────────────────
  for (const farm of data.farms) {
    for (const cell of farm.cells) {
      const { x, y } = cell;
      if (x < 0 || x >= data.width || y < 0 || y >= data.height) continue;
      const px = x * cellSize, py = y * cellSize;

      // Soil
      if (soilImg) {
        ctx.imageSmoothingEnabled = false;
        const sh = Math.round(cellSize * 0.75);
        const sy = py + Math.round((cellSize - sh) / 2);
        ctx.drawImage(soilImg, 0, 0, 16, 12, px, sy, cellSize, sh);
      } else {
        ctx.fillStyle = '#5a3e20'; ctx.fillRect(px, py, cellSize, cellSize);
      }

      // Crop sprite
      const cropId = (cell as any).cropId as string | undefined;
      if (cropId) {
        const cropDef = CROP_IMAGE_PATHS[cropId] ||
          // fallback: try to find a partial match
          Object.entries(CROP_IMAGE_PATHS).find(([k]) => cropId.startsWith(k.replace(/_\d+$/, '')))?.[1];
        if (cropDef) {
          const cropImg = await loadImage(cropDef.path);
          if (cropImg) {
            ctx.imageSmoothingEnabled = false;
            const maxSz = cellSize - 4;
            const sc = Math.min(maxSz / cropDef.w, maxSz / cropDef.h, 2.5);
            const dw = Math.round(cropDef.w * sc), dh = Math.round(cropDef.h * sc);
            ctx.drawImage(cropImg, 0, 0, cropDef.w, cropDef.h,
              px + (cellSize - dw) / 2, py + cellSize - dh - 2, dw, dh);
          }
        }
      }
    }
  }



  // ── LAYER 2–5: Y-SORTED SPRITES (south = drawn on top of north) ─────
  // All sprite entities are collected, sorted by "bottom Y" (footprint bottom row),
  // then drawn in that order so southerly objects always appear above northerly ones.

  interface RenderEntry {
    sortY: number;  // row of the object's bottom edge (for painter's sort)
    draw: () => Promise<void>;
  }

  const entries: RenderEntry[] = [];

  // Trees
  for (const forest of data.forests) {
    const assetDef = SPRITE_ASSETS[forest.treeType];
    if (!assetDef) continue;
    const treeImgRef = await loadImage(assetDef.path);
    for (const tree of forest.trees) {
      const { x, y } = tree;
      if (x < 0 || x >= data.width || y < 0 || y >= data.height) continue;
      entries.push({
        sortY: y, // single-cell, sort by its row
        draw: async () => {
          const px = x * cellSize, py = y * cellSize;
          if (treeImgRef) {
            ctx.imageSmoothingEnabled = false;
            const sc = (cellSize / Math.max(assetDef.w, 16)) * 1.6;
            const dw = Math.round(assetDef.w * sc), dh = Math.round(assetDef.h * sc);
            ctx.drawImage(treeImgRef, 0, 0, assetDef.w, assetDef.h,
              px + (cellSize - dw) / 2, py + cellSize - dh, dw, dh);
          } else {
            ctx.fillStyle = forest.treeType.includes('pine') ? '#166534' : '#15803d';
            ctx.beginPath();
            ctx.arc(px + cellSize / 2, py + cellSize / 2, cellSize / 2 - 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });
    }
  }

  // Buildings — sort by bottom edge of footprint
  for (const b of data.buildings) {
    const bCapture = { ...b };
    entries.push({
      sortY: b.y + (b.footprintH || 2) - 1,
      draw: async () => {
        const px = bCapture.x * cellSize, py = bCapture.y * cellSize;
        const bw = (bCapture.footprintW || 2) * cellSize, bh = (bCapture.footprintH || 2) * cellSize;
        const crop = HOUSE_CROPS[bCapture.id];
        if (crop && housesImg) {
          ctx.imageSmoothingEnabled = false;
          const [cx, cy, cw, ch] = crop;
          const sc = Math.max(bw / cw, bh / ch) * 1.05;
          const dw = Math.round(cw * sc), dh = Math.round(ch * sc);
          ctx.drawImage(housesImg, cx, cy, cw, ch,
            px + (bw - dw) / 2, py + bh - dh, dw, dh);
        } else {
          ctx.fillStyle = '#5d4037';
          ctx.fillRect(px + 1, py + 1, bw - 2, bh - 2);
          ctx.strokeStyle = '#8B7355'; ctx.lineWidth = 1.5;
          ctx.strokeRect(px + 1, py + 1, bw - 2, bh - 2);
        }
        // Door dot
        if (bCapture.door) {
          const dx = bCapture.door.x * cellSize + cellSize / 2;
          const dy = bCapture.door.y * cellSize + cellSize / 2;
          ctx.fillStyle = 'rgba(56,189,248,0.7)';
          ctx.beginPath(); ctx.arc(dx, dy, 2.5, 0, Math.PI * 2); ctx.fill();
        }
      }
    });
  }

  // Decorations, Wells, Chests, Animals, Boats — sort by their cell row
  const OBJECT_RENDER_TYPES = new Set(['decoration', 'well', 'chest', 'animal', 'boat', 'farm_object']);
  for (const obj of data.objects) {
    if (!OBJECT_RENDER_TYPES.has(obj.type)) continue;
    const { x, y } = obj;
    if (x < 0 || x >= data.width || y < 0 || y >= data.height) continue;
    const objCapture = { ...obj };
    entries.push({
      sortY: y,
      draw: async () => {
        const px = objCapture.x * cellSize, py = objCapture.y * cellSize;
        const assetDef = SPRITE_ASSETS[objCapture.id];
        if (!assetDef) {
          ctx.fillStyle = objCapture.type === 'well' ? '#6b7280' : objCapture.type === 'chest' ? '#92400e' : '#22c55e';
          ctx.fillRect(px + 4, py + 4, cellSize - 8, cellSize - 8);
          return;
        }
        const img = await loadImage(assetDef.path);
        if (!img) {
          ctx.fillStyle = '#555'; ctx.fillRect(px + 4, py + 4, cellSize - 8, cellSize - 8);
          return;
        }
        ctx.imageSmoothingEnabled = false;
        const aw = assetDef.w, ah = assetDef.h;
        const maxSz = (objCapture.type === 'well') ? cellSize * 1.5 : cellSize - 2;
        const sc = Math.min(maxSz / aw, maxSz / ah, 2.5);
        const dw = Math.round(aw * sc), dh = Math.round(ah * sc);
        const destX = px + (cellSize - dw) / 2;
        const destY = (objCapture.type === 'animal') ? py + (cellSize - dh) / 2 : py + cellSize - dh;
        ctx.drawImage(img, 0, 0, aw, ah, destX, destY, dw, dh);
      }
    });
  }

  // Sort: ascending by sortY so southernmost (largest Y) drawn last (on top)
  entries.sort((a, b) => a.sortY - b.sortY);
  for (const entry of entries) {
    await entry.draw();
  }

  // ── LAYER 6: CENTER MARKER ──────────────────────────────────────────
  {
    const cx = data.center.x * cellSize;
    const cy = data.center.y * cellSize;
    ctx.strokeStyle = 'rgba(56,189,248,0.3)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(cx + 5, cy + 5); ctx.lineTo(cx + cellSize - 5, cy + cellSize - 5);
    ctx.moveTo(cx + cellSize - 5, cy + 5); ctx.lineTo(cx + 5, cy + cellSize - 5);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
