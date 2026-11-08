// ═══════════════════════════════════════════════════════════════════
// PROCEDURAL DETAILED HOUSE GENERATOR
// Open-interior 2.5D walkable buildings with authentic cutaway walls,
// multi-room layouts, cellar ladders, furniture, rugs, and attached yards
// ═══════════════════════════════════════════════════════════════════

export interface TileCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type WallTheme = 'stone' | 'timber' | 'hybrid';
export type AnnexType = 'none' | 'crop_garden' | 'patio';
export type RoomType = 'living' | 'bedroom' | 'cellar' | 'kitchen' | 'studio';

export interface HouseTile {
  relX: number;
  relY: number;
  layer: 'ground' | 'floor' | 'rug' | 'wall_cap' | 'wall_face' | 'wall_side' | 'door' | 'fence' | 'gate';
  crop: TileCrop;
  isBlocked: boolean;
  isDoor?: boolean;
  isGate?: boolean;
  shadow?: boolean;
}

export interface PlacedFurniture {
  id: string;
  type: string;
  name: string;
  relX: number;
  relY: number;
  w: number;
  h: number;
  crop?: TileCrop;
  spriteUrl?: string;
  spriteCrop?: TileCrop;
  isBlocked: boolean;
  interactive?: boolean;
  action?: 'sleep' | 'cook' | 'storage' | 'cellar_descend' | 'wash' | 'sit';
  light?: { radius: number; color: string; intensity: number };
  drawType?: 'bed_single' | 'bed_double' | 'table_wood' | 'chair' | 'stove' | 'cellar_ladder' | 'rug' | 'custom';
  drawParams?: Record<string, any>;
}

export interface HouseRoom {
  id: string;
  name: string;
  type: RoomType;
  bounds: { x: number; y: number; w: number; h: number }; // interior coordinates
  floorType: 'wood_plank' | 'wood_parquet' | 'flagstone';
}

export interface YardAnnexData {
  type: 'crop_garden' | 'patio';
  bounds: { x: number; y: number; w: number; h: number };
  gate: { x: number; y: number };
  crops?: Array<{ x: number; y: number; cropType: string; stage: number }>;
  props?: Array<{ x: number; y: number; type: string }>;
}

export interface LightNode {
  relX: number;
  relY: number;
  radius: number;
  color: string;
  intensity: number;
}

export interface ProceduralDetailedHouse {
  w: number;
  h: number;
  seed: number;
  theme: WallTheme;
  hullBounds: { x: number; y: number; w: number; h: number };
  door: { x: number; y: number; w?: number };
  rooms: HouseRoom[];
  tiles: HouseTile[];
  furniture: PlacedFurniture[];
  yard?: YardAnnexData;
  lights: LightNode[];
  chimney?: { relX: number; relY: number };
  campfire?: { relX: number; relY: number };
  cellarEntrance?: { relX: number; relY: number };
  walkableGrid: boolean[][]; // [y][x]
}

export interface HouseGeneratorOptions {
  theme?: WallTheme;
  annex?: AnnexType | 'auto';
  includeCellar?: boolean;
  forceLShaped?: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// AUTHENTIC TILESET CROPS (spr_tileset_sunnysideworld_16px.png)
// ═══════════════════════════════════════════════════════════════════

export const CROPS = {
  // Flooring
  floor_stone:       { x: 160, y: 48,  w: 16, h: 16 }, // Cool grey flagstone
  floor_stone_alt:   { x: 720, y: 32,  w: 16, h: 16 }, // Chiseled stone pavers
  floor_wood:        { x: 160, y: 80,  w: 16, h: 16 }, // Vertical amber timber planks
  floor_parquet:     { x: 16,  y: 96,  w: 16, h: 16 }, // Geometric wood parquet
  door_mat:          { x: 272, y: 272, w: 16, h: 16 }, // Wooden door threshold mat
  dirt_path:         { x: 16,  y: 112, w: 16, h: 16 }, // Dirt trail
  grass:             { x: 16,  y: 32,  w: 16, h: 16 }, // Meadow grass

  // Stone Masonry Walls (Building 01)
  stone_lip_nw:      { x: 16,  y: 144, w: 16, h: 16 },
  stone_lip_n:       { x: 32,  y: 144, w: 16, h: 16 },
  stone_lip_ne:      { x: 80,  y: 144, w: 16, h: 16 },
  stone_facade_w:    { x: 16,  y: 160, w: 16, h: 16 },
  stone_facade_solid:{ x: 80,  y: 160, w: 16, h: 16 },
  stone_facade_win:  { x: 32,  y: 160, w: 16, h: 16 },
  stone_facade_e:    { x: 48,  y: 160, w: 16, h: 16 },
  stone_wall_west:   { x: 112, y: 160, w: 16, h: 16 },
  stone_wall_east:   { x: 96,  y: 160, w: 16, h: 16 },
  stone_wall_south:  { x: 80,  y: 160, w: 16, h: 16 },
  stone_corner_sw:   { x: 16,  y: 160, w: 16, h: 16 },
  stone_corner_se:   { x: 48,  y: 160, w: 16, h: 16 },

  // Timber Log Walls (Building 02)
  timber_lip_nw:     { x: 16,  y: 240, w: 16, h: 16 },
  timber_lip_n:      { x: 32,  y: 240, w: 16, h: 16 },
  timber_lip_ne:     { x: 80,  y: 240, w: 16, h: 16 },
  timber_facade_w:   { x: 16,  y: 256, w: 16, h: 16 },
  timber_facade_solid:{ x: 80, y: 256, w: 16, h: 16 },
  timber_facade_win: { x: 32,  y: 256, w: 16, h: 16 },
  timber_facade_e:   { x: 48,  y: 256, w: 16, h: 16 },
  timber_wall_west:  { x: 112, y: 256, w: 16, h: 16 },
  timber_wall_east:  { x: 96,  y: 256, w: 16, h: 16 },
  timber_wall_south: { x: 80,  y: 256, w: 16, h: 16 },
  timber_corner_sw:  { x: 16,  y: 256, w: 16, h: 16 },
  timber_corner_se:  { x: 48,  y: 256, w: 16, h: 16 },

  // Interior Thin Partition Walls
  part_vert:         { x: 64,  y: 160, w: 16, h: 16 },
  part_horiz:        { x: 80,  y: 144, w: 16, h: 16 },
  part_t_north:      { x: 48,  y: 144, w: 16, h: 16 },
  part_t_south:      { x: 48,  y: 160, w: 16, h: 16 },
  part_door_left:    { x: 16,  y: 160, w: 16, h: 16 },
  part_door_right:   { x: 48,  y: 160, w: 16, h: 16 },

  // Fences & Gates
  fence_wood_h:      { x: 624, y: 32,  w: 16, h: 16 },
  fence_wood_v:      { x: 640, y: 48,  w: 16, h: 16 },
  fence_wood_corner: { x: 640, y: 32,  w: 16, h: 16 },
  fence_gate:        { x: 624, y: 0,   w: 16, h: 16 },

  // Cellar Dungeon Props
  ladder_step:       { x: 640, y: 288, w: 16, h: 16 },
  wall_torch:        { x: 96,  y: 256, w: 16, h: 16 },
  wall_sconce:       { x: 672, y: 400, w: 16, h: 16 },
};

// Standalone Gamemaker Props
export const SPRITE_PROPS: Record<string, string> = {
  chair: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_chair_01/feef7d7c-b629-41cb-8196-d20519255aba.png',
  sidetable: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_sidetable_01/e6e599b0-3edb-47fe-95cc-6aa5a7510470.png',
  rug: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_rug_01/027742b0-79ce-4754-88e8-5ccb994a91a3.png',
  picture: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_picture_01/7958b214-effa-4c97-b329-91addd38ef5c.png',
  anvil: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_anvil/57ceffeb-4f94-4e27-bb37-7b4d7f393dbf.png',
  campfire: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_campfire/d292d1cc-d3d3-4222-9506-b1c7072c523c.png',
  firepit: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_firepit/31ab948f-42c9-47ce-9cb7-456406ed0139.png',
  barrel_closed: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_barrel_closed/b4310058-6dec-4d35-8a31-9e73bf28de81.png',
  barrel_open: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_barrel_open/4df50da4-b052-491d-b5d3-64c3b8907e75.png',
  chest_closed: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_chest_01_closed/496b079e-4729-46a2-8b47-cff42b294c71.png',
  chest_ornate: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_chest_02_closed/791d5570-e16a-4994-afed-848c60f51ac2.png',
  trough: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_trough/e83dc18e-a89c-4aae-999e-4531c1c9bb02.png',
  flowers_1: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_flowers_house_01/36388643-e82c-4037-97b4-3d1fa4cb65fb.png',
  flowers_2: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_flowers_house_02/93175c94-bed5-4a79-9562-232e8f9f075e.png',
  cow: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_cow/6653a06e-c334-4734-837d-c040a340b59c.png',
  sheep: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_sheep_01/27f1704c-07ec-423f-9cad-9b546bd1477a.png',
  crate: '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/spr_deco_crate_01/658157b4-7ff5-452e-9e1d-c4cad561928b.png',
};

// ═══════════════════════════════════════════════════════════════════
// SEEDED RANDOM GENERATOR (Mulberry32)
// ═══════════════════════════════════════════════════════════════════

function createMulberry32(seed: number) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ═══════════════════════════════════════════════════════════════════
// PROCEDURAL DETAILED HOUSE GENERATOR
// ═══════════════════════════════════════════════════════════════════

export function generateProceduralDetailedHouse(
  targetW: number,
  targetH: number,
  seed: number,
  options?: HouseGeneratorOptions
): ProceduralDetailedHouse {
  const rng = createMulberry32(seed);

  // Clamp bounds: min 6x6, max 16x16
  const w = Math.max(6, Math.min(16, Math.floor(targetW)));
  const h = Math.max(6, Math.min(16, Math.floor(targetH)));

  // Determine Wall Theme
  const theme: WallTheme =
    options?.theme ?? (rng() < 0.5 ? 'timber' : 'stone');

  // Determine Layout Morphology & Attached Annex
  const isLarge = w >= 11 && h >= 8;
  const wantL =
    options?.forceLShaped ||
    (isLarge && (options?.annex === 'crop_garden' || options?.annex === 'patio' || (options?.annex === 'auto' && rng() < 0.65)));

  let hullW = w;
  let hullH = h;
  let yardData: YardAnnexData | undefined = undefined;

  if (wantL && w >= 10 && h >= 8) {
    // Carve out a yard in the bottom-right or top-right (crop garden or floral patio, NO animals in houses)
    const yardW = Math.min(5, Math.max(3, Math.floor(w * 0.42)));
    const yardH = Math.min(5, Math.max(3, Math.floor(h * 0.45)));
    const yardType: 'crop_garden' | 'patio' =
      options?.annex === 'patio' || rng() < 0.35 ? 'patio' : 'crop_garden';

    const yBounds = { x: w - yardW, y: h - yardH, w: yardW, h: yardH };
    hullW = w;
    hullH = h; // House will wrap around or occupy top and left

    yardData = {
      type: yardType,
      bounds: yBounds,
      gate: { x: yBounds.x + 1, y: yBounds.y + yBounds.h - 1 },
      crops: yardType === 'crop_garden' ? [] : undefined,
    };

    if (yardType === 'crop_garden') {
      const cropTypes = ['wheat', 'corn', 'carrot', 'cabbage'];
      for (let cy = yBounds.y + 1; cy < yBounds.y + yBounds.h - 1; cy++) {
        for (let cx = yBounds.x + 1; cx < yBounds.x + yBounds.w - 1; cx++) {
          yardData.crops!.push({
            x: cx,
            y: cy,
            cropType: cropTypes[Math.floor(rng() * cropTypes.length)],
            stage: 2 + Math.floor(rng() * 2),
          });
        }
      }
    }
  }

  // Interior bounds of main house structure
  const houseMainW = yardData ? w - yardData.bounds.w : w;
  const houseMainH = h;

  // Space Partitioning: Subdivide Interior into Rooms
  // Row 0 = North Wall Cap, Row 1 = North Wall Facade Face
  // Interior Floor runs from Row 2 to Row houseMainH - 2
  // Row houseMainH - 1 = South Wall Facade & Doorway
  const rooms: HouseRoom[] = [];
  const innerW = houseMainW - 2;
  const innerH = houseMainH - 3; // From y=2 to y=h-2 inclusive (height = h - 3)

  const hasCellar =
    options?.includeCellar ?? (innerW >= 6 && innerH >= 4 && (options?.annex === 'patio' || rng() < 0.65));

  let cellarEntranceCoord: { relX: number; relY: number } | undefined = undefined;

  let splitX = -1;

  if (innerW < 6 || innerH < 4) {
    // Studio Cottage
    rooms.push({
      id: 'room_main',
      name: 'Studio Cottage',
      type: 'studio',
      bounds: { x: 1, y: 2, w: innerW, h: innerH },
      floorType: 'wood_plank',
    });
  } else if (hasCellar && innerW >= 6) {
    // Two Rooms: Living Hall + Stone Cellar Room
    splitX = Math.floor(innerW * 0.55) + 1;
    rooms.push({
      id: 'room_living',
      name: 'Great Living Hall',
      type: 'living',
      bounds: { x: 1, y: 2, w: splitX - 1, h: innerH },
      floorType: 'wood_plank',
    });
    rooms.push({
      id: 'room_cellar',
      name: 'Stone Cellar & Vault',
      type: 'cellar',
      bounds: { x: splitX + 1, y: 2, w: houseMainW - splitX - 2, h: innerH },
      floorType: 'flagstone',
    });
  } else if (innerW >= 8 && innerH >= 5) {
    // Two Rooms: Living Room + Master Bedroom
    splitX = Math.floor(innerW * 0.52) + 1;
    rooms.push({
      id: 'room_living',
      name: 'Living & Hearth Hall',
      type: 'living',
      bounds: { x: 1, y: 2, w: splitX - 1, h: innerH },
      floorType: 'wood_plank',
    });
    rooms.push({
      id: 'room_bedroom',
      name: 'Master Bedroom',
      type: 'bedroom',
      bounds: { x: splitX + 1, y: 2, w: houseMainW - splitX - 2, h: innerH },
      floorType: 'wood_parquet',
    });
  } else {
    // Open Great Hall
    rooms.push({
      id: 'room_great_hall',
      name: 'Great Hall',
      type: 'living',
      bounds: { x: 1, y: 2, w: innerW, h: innerH },
      floorType: 'wood_plank',
    });
  }

  // Doorway position (South wall of main house, enters into the main living room)
  // Guaranteed 2 tiles wide (doorX and doorX + 1) for snag-free navigation
  const livingRoomMaxX = splitX > 0 ? splitX - 1 : houseMainW - 2;
  const maxDoorX = Math.max(1, livingRoomMaxX - 1); // ensures doorX + 1 <= livingRoomMaxX
  const doorX = Math.max(1, Math.min(maxDoorX, Math.floor((livingRoomMaxX - 1) / 2) + 1));
  const doorY = h - 1;

  // Generate Tiles Grid
  const tiles: HouseTile[] = [];
  const walkableGrid: boolean[][] = Array.from({ length: h }, () =>
    Array(w).fill(true)
  );

  // 1. Base Terrain / Yard Fill
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (yardData && x >= yardData.bounds.x && y >= yardData.bounds.y) {
        // Inside yard
        if (yardData.type === 'crop_garden') {
          tiles.push({
            relX: x,
            relY: y,
            layer: 'ground',
            crop: CROPS.dirt_path,
            isBlocked: false,
          });
        } else {
          tiles.push({
            relX: x,
            relY: y,
            layer: 'ground',
            crop: CROPS.grass,
            isBlocked: false,
          });
        }
      }
    }
  }

  // 2. Interior Floors
  for (const rm of rooms) {
    const floorCrop =
      rm.floorType === 'flagstone'
        ? CROPS.floor_stone
        : rm.floorType === 'wood_parquet'
        ? CROPS.floor_parquet
        : CROPS.floor_wood;

    for (let fy = rm.bounds.y; fy < rm.bounds.y + rm.bounds.h; fy++) {
      for (let fx = rm.bounds.x; fx < rm.bounds.x + rm.bounds.w; fx++) {
        tiles.push({
          relX: fx,
          relY: fy,
          layer: 'floor',
          crop: floorCrop,
          isBlocked: false,
        });
      }
    }
  }

  // 3. Walls & Doorways (2.5D Cutaway Model)
  // North Wall Top Cap (Row 0)
  const lipNW = theme === 'stone' ? CROPS.stone_lip_nw : CROPS.timber_lip_nw;
  const lipN  = theme === 'stone' ? CROPS.stone_lip_n  : CROPS.timber_lip_n;
  const lipNE = theme === 'stone' ? CROPS.stone_lip_ne : CROPS.timber_lip_ne;

  for (let x = 0; x < houseMainW; x++) {
    const crop = x === 0 ? lipNW : x === houseMainW - 1 ? lipNE : lipN;
    tiles.push({
      relX: x,
      relY: 0,
      layer: 'wall_cap',
      crop,
      isBlocked: true,
    });
    walkableGrid[0][x] = false;
  }

  // North Wall Vertical Facade Face (Row 1)
  const facW     = theme === 'stone' ? CROPS.stone_facade_w     : CROPS.timber_facade_w;
  const facSolid = theme === 'stone' ? CROPS.stone_facade_solid : CROPS.timber_facade_solid;
  const facWin   = theme === 'stone' ? CROPS.stone_facade_win   : CROPS.timber_facade_win;
  const facE     = theme === 'stone' ? CROPS.stone_facade_e     : CROPS.timber_facade_e;

  for (let x = 0; x < houseMainW; x++) {
    const isWin = (x % 3 === 2) && x > 0 && x < houseMainW - 1;
    const crop =
      x === 0
        ? facW
        : x === houseMainW - 1
        ? facE
        : isWin
        ? facWin
        : facSolid;

    tiles.push({
      relX: x,
      relY: 1,
      layer: 'wall_face',
      crop,
      isBlocked: true,
    });
    walkableGrid[1][x] = false;
  }

  // West & East Side Walls
  const wallW = theme === 'stone' ? CROPS.stone_wall_west : CROPS.timber_wall_west;
  const wallE = theme === 'stone' ? CROPS.stone_wall_east : CROPS.timber_wall_east;

  for (let y = 2; y < houseMainH - 1; y++) {
    // West
    tiles.push({
      relX: 0,
      relY: y,
      layer: 'wall_side',
      crop: wallW,
      isBlocked: true,
      shadow: true,
    });
    walkableGrid[y][0] = false;

    // East (of main house)
    tiles.push({
      relX: houseMainW - 1,
      relY: y,
      layer: 'wall_side',
      crop: wallE,
      isBlocked: true,
    });
    walkableGrid[y][houseMainW - 1] = false;
  }

  // South Wall (Row houseMainH - 1)
  const cornSW = theme === 'stone' ? CROPS.stone_corner_sw  : CROPS.timber_corner_sw;
  const cornSE = theme === 'stone' ? CROPS.stone_corner_se  : CROPS.timber_corner_se;
  const wallS  = theme === 'stone' ? CROPS.stone_wall_south : CROPS.timber_wall_south;

  for (let x = 0; x < houseMainW; x++) {
    if (x === doorX || x === doorX + 1) {
      // Walkable Door Threshold Mat (2 tiles wide for smooth, snag-free movement)
      tiles.push({
        relX: x,
        relY: doorY,
        layer: 'door',
        crop: CROPS.door_mat,
        isBlocked: false,
        isDoor: true,
      });
      walkableGrid[doorY][x] = true;
    } else {
      const crop = x === 0 ? cornSW : x === houseMainW - 1 ? cornSE : wallS;
      tiles.push({
        relX: x,
        relY: doorY,
        layer: 'wall_side',
        crop,
        isBlocked: true,
      });
      walkableGrid[doorY][x] = false;
    }
  }

  // Interior Partition Wall between Rooms (if multiple rooms)
  if (rooms.length >= 2) {
    const partX = rooms[0].bounds.x + rooms[0].bounds.w;
    const partDoorY = Math.max(3, Math.min(houseMainH - 4, Math.floor(houseMainH * 0.45)));

    for (let y = 1; y < houseMainH - 1; y++) {
      if (y === partDoorY || y === partDoorY + 1) {
        // Interior Doorway (2 tiles high for seamless navigation between rooms)
        tiles.push({
          relX: partX,
          relY: y,
          layer: 'floor',
          crop: CROPS.floor_wood,
          isBlocked: false,
          isDoor: true,
        });
        walkableGrid[y][partX] = true;
      } else {
        tiles.push({
          relX: partX,
          relY: y,
          layer: 'wall_side',
          crop: CROPS.part_vert,
          isBlocked: true,
        });
        walkableGrid[y][partX] = false;
      }
    }
  }

  // Yard Perimeter Fencing & Gate
  if (yardData) {
    const yb = yardData.bounds;
    for (let x = yb.x; x < yb.x + yb.w; x++) {
      for (let y = yb.y; y < yb.y + yb.h; y++) {
        const isNorthEdge = y === yb.y;
        const isSouthEdge = y === yb.y + yb.h - 1;
        const isEastEdge  = x === yb.x + yb.w - 1;
        const isWestEdge  = x === yb.x;

        if (isNorthEdge || isSouthEdge || isEastEdge || isWestEdge) {
          // If gate
          if (x === yardData.gate.x && y === yardData.gate.y) {
            tiles.push({
              relX: x,
              relY: y,
              layer: 'gate',
              crop: CROPS.fence_gate,
              isBlocked: false,
              isGate: true,
            });
            walkableGrid[y][x] = true;
          } else {
            tiles.push({
              relX: x,
              relY: y,
              layer: 'fence',
              crop: isNorthEdge || isSouthEdge ? CROPS.fence_wood_h : CROPS.fence_wood_v,
              isBlocked: true,
            });
            walkableGrid[y][x] = false;
          }
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // FURNITURE & PROPS PLACEMENT
  // ═══════════════════════════════════════════════════════════════════
  const furniture: PlacedFurniture[] = [];
  const lights: LightNode[] = [];

  // Wall Lighting (Mounted at row 1 behind characters)
  for (let x = 1; x < houseMainW - 1; x += 3) {
    lights.push({
      relX: x,
      relY: 1.2,
      radius: 4.5,
      color: '#ffaa44',
      intensity: 0.85,
    });
  }

  // Process Each Room's Furniture
  for (const rm of rooms) {
    if (rm.type === 'cellar') {
      // Cellar Room: Central Subterranean Ladder, Barrels, Anvil
      const midX = rm.bounds.x + Math.floor(rm.bounds.w / 2);
      const midY = rm.bounds.y + Math.floor(rm.bounds.h / 2);

      cellarEntranceCoord = { relX: midX, relY: midY };

      furniture.push({
        id: `ladder_${seed}`,
        type: 'cellar_ladder',
        name: 'Dungeon Cellar Ladder',
        relX: midX,
        relY: midY,
        w: 1,
        h: 1,
        crop: CROPS.ladder_step,
        isBlocked: false, // Walkable descend trigger
        interactive: true,
        action: 'cellar_descend',
        drawType: 'cellar_ladder',
      });

      // Barrels in top corners
      furniture.push({
        id: `barrel_1_${seed}`,
        type: 'barrel',
        name: 'Storage Barrel (Sealed)',
        relX: rm.bounds.x,
        relY: rm.bounds.y,
        w: 1,
        h: 1,
        spriteUrl: SPRITE_PROPS.barrel_closed,
        isBlocked: true,
        interactive: true,
        action: 'storage',
      });
      walkableGrid[rm.bounds.y][rm.bounds.x] = false;

      furniture.push({
        id: `barrel_2_${seed}`,
        type: 'barrel',
        name: 'Open Storage Barrel',
        relX: rm.bounds.x + rm.bounds.w - 1,
        relY: rm.bounds.y,
        w: 1,
        h: 1,
        spriteUrl: SPRITE_PROPS.barrel_open,
        isBlocked: true,
        interactive: true,
        action: 'storage',
      });
      walkableGrid[rm.bounds.y][rm.bounds.x + rm.bounds.w - 1] = false;

      // Anvil against side wall
      if (rm.bounds.h >= 4) {
        furniture.push({
          id: `anvil_${seed}`,
          type: 'anvil',
          name: 'Blacksmith Anvil',
          relX: rm.bounds.x + rm.bounds.w - 1,
          relY: rm.bounds.y + rm.bounds.h - 1,
          w: 1,
          h: 1,
          spriteUrl: SPRITE_PROPS.anvil,
          isBlocked: true,
          interactive: true,
          action: 'cook', // Crafting UI
        });
        walkableGrid[rm.bounds.y + rm.bounds.h - 1][rm.bounds.x + rm.bounds.w - 1] = false;
      }

      // Cellar Torch
      lights.push({
        relX: midX,
        relY: rm.bounds.y + 0.5,
        radius: 4.0,
        color: '#ff9933',
        intensity: 0.8,
      });
    } else if (rm.type === 'bedroom') {
      // Master Bedroom: Double Bed, Nightstand with Candle, Wardrobe, Rug
      const bedX = rm.bounds.x;
      const bedY = rm.bounds.y; // Flush against North wall at row 2

      furniture.push({
        id: `bed_master_${seed}`,
        type: 'bed',
        name: 'Master Double Bed',
        relX: bedX,
        relY: bedY,
        w: 2,
        h: 2,
        isBlocked: false,
        interactive: true,
        action: 'sleep',
        drawType: 'bed_double',
        drawParams: { quiltColor: '#b91c1c' }, // Luxury red quilt
      });
      walkableGrid[bedY][bedX] = false;
      walkableGrid[bedY][bedX + 1] = false;
      walkableGrid[bedY + 1][bedX] = false;
      walkableGrid[bedY + 1][bedX + 1] = false;

      // Nightstand with Candle beside bed
      const standX = bedX + 2;
      if (standX < rm.bounds.x + rm.bounds.w) {
        furniture.push({
          id: `nightstand_${seed}`,
          type: 'sidetable',
          name: 'Bedside Nightstand',
          relX: standX,
          relY: bedY,
          w: 1,
          h: 1,
          spriteUrl: SPRITE_PROPS.sidetable,
          isBlocked: true,
        });
        walkableGrid[bedY][standX] = false;

        lights.push({
          relX: standX + 0.5,
          relY: bedY + 0.5,
          radius: 3.5,
          color: '#ffcc66',
          intensity: 0.9,
        });
      }

      // Storage Chest along back or corner
      const chestX = rm.bounds.x + rm.bounds.w - 1;
      const chestY = rm.bounds.y + rm.bounds.h - 1;
      furniture.push({
        id: `chest_${seed}`,
        type: 'chest',
        name: 'Wooden Storage Chest',
        relX: chestX,
        relY: chestY,
        w: 1,
        h: 1,
        spriteUrl: SPRITE_PROPS.chest_closed,
        isBlocked: true,
        interactive: true,
        action: 'storage',
      });
      walkableGrid[chestY][chestX] = false;

      // Decorative Bedroom Hearth Rug
      if (rm.bounds.h >= 4) {
        furniture.push({
          id: `rug_bedroom_${seed}`,
          type: 'rug',
          name: 'Cozy Bedroom Rug',
          relX: rm.bounds.x,
          relY: bedY + 2,
          w: Math.min(2, rm.bounds.w),
          h: 2,
          isBlocked: false,
          drawType: 'rug',
          drawParams: { color: '#be123c', style: 'heart' },
        });
      }
    } else {
      // Living Hall or Studio: Cook Stove, Dining Table, Chairs, Rug, Bed
      const stoveX = rm.bounds.x;
      const stoveY = rm.bounds.y; // Flush against North wall at row 2

      furniture.push({
        id: `stove_${seed}`,
        type: 'stove',
        name: 'Cast Iron Cook Stove',
        relX: stoveX,
        relY: stoveY,
        w: 1,
        h: 1,
        isBlocked: true,
        interactive: true,
        action: 'cook',
        drawType: 'stove',
      });
      walkableGrid[stoveY][stoveX] = false;

      lights.push({
        relX: stoveX + 0.5,
        relY: stoveY + 0.5,
        radius: 5.0,
        color: '#ff7722',
        intensity: 0.95,
      });

      // Bed (for Studio Cottage or large open Great Hall)
      const hasSeparateBedroom = rooms.some(r => r.type === 'bedroom');
      const hasCellarVault = rooms.some(r => r.type === 'cellar');

      if (rm.type === 'studio' || (!hasSeparateBedroom && !hasCellarVault && rm.bounds.w >= 6)) {
        const isDouble = rm.bounds.w >= 7;
        const bedW = isDouble ? 2 : 1;
        const bedX = rm.bounds.x + rm.bounds.w - bedW;
        const bedY = rm.bounds.y;

        furniture.push({
          id: `bed_living_${seed}`,
          type: 'bed',
          name: isDouble ? 'Master Double Bed' : 'Single Wooden Bed',
          relX: bedX,
          relY: bedY,
          w: bedW,
          h: 2,
          isBlocked: false,
          interactive: true,
          action: 'sleep',
          drawType: isDouble ? 'bed_double' : 'bed_single',
          drawParams: { quiltColor: '#b91c1c' },
        });
        walkableGrid[bedY][bedX] = false;
        walkableGrid[bedY + 1][bedX] = false;
        if (isDouble) {
          walkableGrid[bedY][bedX + 1] = false;
          walkableGrid[bedY + 1][bedX + 1] = false;
        }
      }

      // Dining Table and Chairs (Centered, distinct from stove)
      const tableX = rm.bounds.x + Math.max(1, Math.floor((rm.bounds.w - 3) / 2));
      const tableY = rm.bounds.y + (rm.bounds.h >= 5 ? 2 : 1);

      if (tableX > 0 && tableX + 1 < houseMainW - 1 && tableY < doorY - 1) {
        furniture.push({
          id: `dining_table_${seed}`,
          type: 'table',
          name: 'Carved Wood Dining Table',
          relX: tableX,
          relY: tableY,
          w: 2,
          h: 1,
          isBlocked: true,
          drawType: 'table_wood',
        });
        walkableGrid[tableY][tableX] = false;
        walkableGrid[tableY][tableX + 1] = false;

        // Chair facing table
        if (tableY + 1 < doorY) {
          furniture.push({
            id: `chair_1_${seed}`,
            type: 'chair',
            name: 'Wooden Dining Chair',
            relX: tableX,
            relY: tableY + 1,
            w: 1,
            h: 1,
            spriteUrl: SPRITE_PROPS.chair,
            isBlocked: false,
            interactive: true,
            action: 'sit',
          });
        }

        // Runner Rug placed neatly under table
        const rugY = Math.max(rm.bounds.y, tableY - 1);
        const rugH = Math.min(3, rm.bounds.h - (rugY - rm.bounds.y));
        furniture.push({
          id: `runner_rug_${seed}`,
          type: 'rug',
          name: 'Blue Runner Rug',
          relX: tableX,
          relY: rugY,
          w: 2,
          h: rugH,
          isBlocked: false,
          drawType: 'rug',
          drawParams: { color: '#1e40af', style: 'runner' },
        });
      }

      // Storage Chest along wall
      const chestX = rm.bounds.x;
      const chestY = rm.bounds.y + rm.bounds.h - 1;
      if (chestY < doorY && (chestX !== doorX || chestY !== doorY)) {
        furniture.push({
          id: `chest_living_${seed}`,
          type: 'chest',
          name: 'Household Chest',
          relX: chestX,
          relY: chestY,
          w: 1,
          h: 1,
          spriteUrl: SPRITE_PROPS.chest_closed,
          isBlocked: true,
          interactive: true,
          action: 'storage',
        });
        walkableGrid[chestY][chestX] = false;
      }

      // Potted flower
      if (rm.bounds.h >= 4) {
        const flowerY = chestY - 1;
        if (flowerY > stoveY) {
          furniture.push({
            id: `flower_${seed}`,
            type: 'flower',
            name: 'Potted House Plant',
            relX: chestX,
            relY: flowerY,
            w: 1,
            h: 1,
            spriteUrl: SPRITE_PROPS.flowers_1,
            isBlocked: true,
          });
          walkableGrid[flowerY][chestX] = false;
        }
      }
    }
  }

  // Outdoor Campfire placed safely away from the doorway
  let campfireCoord: { relX: number; relY: number } | undefined = undefined;
  if (doorX >= 3) {
    campfireCoord = { relX: doorX - 3, relY: doorY + 2 };
  } else if (houseMainW - doorX >= 4) {
    campfireCoord = { relX: doorX + 3, relY: doorY + 2 };
  }

  // Chimney coordinates for roof smoke
  const chimneyCoord = { relX: 2, relY: 0 };

  // ═══════════════════════════════════════════════════════════════════
  // REACHABILITY SOLVER (BFS Flood Fill from 2-tile Front Door)
  // ═══════════════════════════════════════════════════════════════════
  const visited: boolean[][] = Array.from({ length: h }, () =>
    Array(w).fill(false)
  );
  const queue: Array<{ x: number; y: number }> = [
    { x: doorX, y: doorY },
    { x: doorX + 1, y: doorY },
  ];
  visited[doorY][doorX] = true;
  visited[doorY][doorX + 1] = true;

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const neighbors = [
      { x: cur.x + 1, y: cur.y },
      { x: cur.x - 1, y: cur.y },
      { x: cur.x, y: cur.y + 1 },
      { x: cur.x, y: cur.y - 1 },
    ];

    for (const n of neighbors) {
      if (
        n.x >= 0 &&
        n.x < w &&
        n.y >= 0 &&
        n.y < h &&
        !visited[n.y][n.x] &&
        walkableGrid[n.y][n.x]
      ) {
        visited[n.y][n.x] = true;
        queue.push(n);
      }
    }
  }

  // Verify that all rooms have at least 1 reachable floor tile
  for (const rm of rooms) {
    let reachedCount = 0;
    for (let fy = rm.bounds.y; fy < rm.bounds.y + rm.bounds.h; fy++) {
      for (let fx = rm.bounds.x; fx < rm.bounds.x + rm.bounds.w; fx++) {
        if (visited[fy][fx]) reachedCount++;
      }
    }
    // If room is completely cut off, unblock doorway path
    if (reachedCount === 0) {
      const midY = rm.bounds.y + Math.floor(rm.bounds.h / 2);
      for (let x = doorX; x <= rm.bounds.x; x++) {
        walkableGrid[midY][x] = true;
      }
    }
  }

  return {
    w,
    h,
    seed,
    theme,
    hullBounds: { x: 0, y: 0, w: houseMainW, h: houseMainH },
    door: { x: doorX, y: doorY, w: 2 },
    rooms,
    tiles,
    furniture,
    yard: yardData,
    lights,
    chimney: chimneyCoord,
    campfire: campfireCoord,
    cellarEntrance: cellarEntranceCoord,
    walkableGrid,
  };
}

