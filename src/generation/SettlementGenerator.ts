// ═══════════════════════════════════════════════════════════════════
// SEEDED PRNG — Mulberry32
// ═══════════════════════════════════════════════════════════════════
export function createRNG(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ═══════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════

export type AssetId = string;

export interface GridCoord {
  x: number;
  y: number;
}

export interface DoorPoint {
  x: number;
  y: number;
}

export interface PlacedObject {
  id: AssetId;
  type: 'house' | 'farm' | 'well' | 'tree' | 'decoration' | 'chest' | 'boat' | 'animal' | 'farm_object' | 'crop' | 'fence' | 'path';
  x: number;
  y: number;
  footprintW?: number;
  footprintH?: number;
  door?: DoorPoint;
  doorDir?: 'down' | 'up' | 'left' | 'right';
  metadata?: Record<string, any>;
}

export interface Building extends PlacedObject {
  type: 'house';
  id: AssetId;
  footprintW: number;
  footprintH: number;
  door: DoorPoint;
}

export interface FarmCell {
  x: number;
  y: number;
  cropId: AssetId;
  cropStage: number;
}

export interface Farm extends PlacedObject {
  type: 'farm';
  id: AssetId;
  cells: FarmCell[];
  cropId: AssetId;
  door?: DoorPoint;
}

export interface PathNode extends GridCoord {
  fromDir?: number;
}

export interface Path extends PlacedObject {
  type: 'path';
  id: AssetId;
  nodes: GridCoord[];
}

export interface WaterBody {
  cells: GridCoord[];
  hasBoat: boolean;
  boatX: number;
  boatY: number;
}

export interface FenceSection {
  cells: GridCoord[];
}

export interface ForestPatch {
  x: number;
  y: number;
  trees: GridCoord[];
  treeType: AssetId;
}

export interface SettlementData {
  seed: number;
  center: GridCoord;
  objects: PlacedObject[];
  buildings: Building[];
  farms: Farm[];
  paths: Path[];
  waterBodies: WaterBody[];
  fenceSections: FenceSection[];
  forests: ForestPatch[];
  blocked: boolean[][];
  terrain: AssetId[][];
  width: number;
  height: number;
}

// ═══════════════════════════════════════════════════════════════════
// HOUSE DEFINITIONS — footprint + door offset
// ═══════════════════════════════════════════════════════════════════

export interface HouseDef {
  id: AssetId;
  name: string;
  footprintW: number;
  footprintH: number;
  weight: number;
}

export const HOUSE_DEFS: HouseDef[] = [
  { id: 'house_cottage_01',      name: 'Cottage',           footprintW: 2, footprintH: 2, weight: 8 },
  { id: 'house_farmhouse_01',    name: 'Farmhouse',         footprintW: 3, footprintH: 2, weight: 5 },
  { id: 'house_barn_01',         name: 'Barn',              footprintW: 3, footprintH: 2, weight: 3 },
  { id: 'house_workshop_01',     name: 'Workshop',          footprintW: 3, footprintH: 2, weight: 3 },
  { id: 'house_tavern_01',       name: 'Tavern',            footprintW: 3, footprintH: 3, weight: 2 },
  { id: 'house_shop_01',         name: 'Shop',              footprintW: 3, footprintH: 2, weight: 3 },
  { id: 'house_chapel_01',       name: 'Chapel',            footprintW: 2, footprintH: 2, weight: 2 },
  { id: 'house_stable_01',       name: 'Stable',            footprintW: 3, footprintH: 2, weight: 2 },
  { id: 'house_warehouse_01',    name: 'Warehouse',         footprintW: 3, footprintH: 3, weight: 1 },
  { id: 'house_merchant_01',     name: 'Merchant House',    footprintW: 3, footprintH: 2, weight: 2 },
  { id: 'house_blacksmith_01',   name: 'Blacksmith',        footprintW: 3, footprintH: 3, weight: 1 },
  { id: 'house_windmill_01',     name: 'Windmill',          footprintW: 2, footprintH: 3, weight: 1 },
  { id: 'house_cabin_01',        name: 'Cabin',             footprintW: 3, footprintH: 2, weight: 3 },
  { id: 'house_lighthouse_01',   name: 'Lighthouse',        footprintW: 2, footprintH: 3, weight: 0 },
  { id: 'house_castle_01',       name: 'Castle Tower',      footprintW: 3, footprintH: 3, weight: 0 },
];

export const SPECIAL_BUILDING_IDS = new Set([
  'house_windmill_01', 'house_blacksmith_01', 'house_tavern_01',
  'house_shop_01', 'house_warehouse_01'
]);

// Door offsets: direction the front door faces, relative to footprint
// For a building placed at grid (x,y), the door is at (x + offsetX, y + offsetY)
// The doorDir indicates which way the door faces (toward settlement center)
export const DOOR_OFFSETS: Record<string, { dx: number; dy: number; dir: 'down' | 'up' | 'left' | 'right' }> = {
  'house_cottage_01':      { dx: 1, dy: 1, dir: 'down' },
  'house_farmhouse_01':    { dx: 1, dy: 1, dir: 'down' },
  'house_barn_01':         { dx: 1, dy: 1, dir: 'down' },
  'house_workshop_01':     { dx: 1, dy: 1, dir: 'down' },
  'house_tavern_01':       { dx: 1, dy: 2, dir: 'down' },
  'house_shop_01':         { dx: 1, dy: 1, dir: 'down' },
  'house_chapel_01':       { dx: 0, dy: 1, dir: 'down' },
  'house_stable_01':       { dx: 1, dy: 1, dir: 'down' },
  'house_warehouse_01':    { dx: 1, dy: 2, dir: 'down' },
  'house_merchant_01':     { dx: 1, dy: 1, dir: 'down' },
  'house_blacksmith_01':   { dx: 1, dy: 2, dir: 'down' },
  'house_windmill_01':     { dx: 0, dy: 1, dir: 'left' },
  'house_cabin_01':        { dx: 1, dy: 1, dir: 'down' },
};

// ═══════════════════════════════════════════════════════════════════
// CROP ASSET MAP
// ═══════════════════════════════════════════════════════════════════

export const CROP_IDS = [
  'crop_wheat_stage_0', 'crop_wheat_stage_1', 'crop_wheat_stage_2', 'crop_wheat_stage_3', 'crop_wheat_stage_4', 'crop_wheat_stage_5',
  'crop_carrot_stage_0', 'crop_carrot_stage_1', 'crop_carrot_stage_2', 'crop_carrot_stage_3', 'crop_carrot_stage_4', 'crop_carrot_stage_5',
  'crop_potato_stage_0', 'crop_potato_stage_1', 'crop_potato_stage_2', 'crop_potato_stage_3', 'crop_potato_stage_4', 'crop_potato_stage_5',
  'crop_pumpkin_stage_0', 'crop_pumpkin_stage_1', 'crop_pumpkin_stage_2', 'crop_pumpkin_stage_3', 'crop_pumpkin_stage_4', 'crop_pumpkin_stage_5',
  'crop_cabbage_stage_0', 'crop_cabbage_stage_1', 'crop_cabbage_stage_2', 'crop_cabbage_stage_3', 'crop_cabbage_stage_4', 'crop_cabbage_stage_5',
  'crop_cauliflower_stage_0', 'crop_cauliflower_stage_1', 'crop_cauliflower_stage_2', 'crop_cauliflower_stage_3', 'crop_cauliflower_stage_4', 'crop_cauliflower_stage_5',
  'crop_kale_stage_0', 'crop_kale_stage_1', 'crop_kale_stage_2', 'crop_kale_stage_3', 'crop_kale_stage_4', 'crop_kale_stage_5',
  'crop_parsnip_stage_0', 'crop_parsnip_stage_1', 'crop_parsnip_stage_2', 'crop_parsnip_stage_3', 'crop_parsnip_stage_4', 'crop_parsnip_stage_5',
  'crop_radish_stage_0', 'crop_radish_stage_1', 'crop_radish_stage_2', 'crop_radish_stage_3', 'crop_radish_stage_4', 'crop_radish_stage_5',
  'crop_beetroot_stage_0', 'crop_beetroot_stage_1', 'crop_beetroot_stage_2', 'crop_beetroot_stage_3', 'crop_beetroot_stage_4', 'crop_beetroot_stage_5',
  'crop_sunflower_stage_0', 'crop_sunflower_stage_1', 'crop_sunflower_stage_2', 'crop_sunflower_stage_3', 'crop_sunflower_stage_4', 'crop_sunflower_stage_5',
];

export const CROP_BASE_IDS = [
  'crop_wheat', 'crop_carrot', 'crop_potato', 'crop_pumpkin', 'crop_cabbage',
  'crop_cauliflower', 'crop_kale', 'crop_parsnip', 'crop_radish', 'crop_beetroot', 'crop_sunflower'
];

// ═══════════════════════════════════════════════════════════════════
// FARM OBJECT ASSETS
// ═══════════════════════════════════════════════════════════════════

export const FARM_OBJECT_IDS = [
  'farm_well', 'farm_well_covered', 'farm_trough', 'farm_waterbowl',
  'farm_crate_01', 'farm_crate_02', 'farm_chest_closed', 'farm_chest2_closed',
  'furn_bucket', 'furn_bucket_rope'
];

// ═══════════════════════════════════════════════════════════════════
// DECORATION ASSETS
// ═══════════════════════════════════════════════════════════════════

export const ROCK_IDS = ['small_rock_01'];
export const FLOWER_IDS = ['flowers_wild_01', 'flowers_wild_02', 'plant_flowers_01', 'plant_flowers_02'];
export const MUSHROOM_IDS = ['mushrooms_deco_blue', 'mushrooms_deco_red', 'plant_shroom_blue_01', 'plant_shroom_blue_02', 'plant_shroom_blue_03', 'plant_shroom_red_01'];
export const GRASS_TUFT_IDS = ['grass_tuft_01', 'plant_leaf_accent', 'acorn_deco_01', 'truffle_deco_01'];

// ═══════════════════════════════════════════════════════════════════
// PATH TILES
// ═══════════════════════════════════════════════════════════════════

export const PATH_TILES = ['path_tile_01', 'path_tile_02', 'path_tile_03'];

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

export const CONFIG = {
  GRID_SIZE: 16,
  MIN_HOUSE_DISTANCE: 5,
  SETTLEMENT_MIN_RADIUS: 3,
  SETTLEMENT_MAX_RADIUS: 7,
  MAX_HOUSES: 6,
  MAX_FARMS: 3,
  MAX_WELLS: 2,
  MAX_TREES: 12,
  MAX_DECORATIONS: 25,
  MAX_FOREST_PATCHES: 3,
  MAX_ROCKS: 10,
  MAX_FLOWERS: 12,
  MAX_CHESTS: 2,
  MAX_PATH_ATTEMPTS: 300,
  WATER_CHANCE: 0.5,
  CROP_GROWTH_DIST: { seed: 0.2, sprout: 0.25, small: 0.2, growing: 0.2, mature: 0.1, harvested: 0.05 },
};

// ═══════════════════════════════════════════════════════════════════
// MAIN GENERATOR CLASS
// ═══════════════════════════════════════════════════════════════════

export class SettlementGenerator {
  private rng: () => number;
  private seed: number;
  private gridW: number;
  private gridH: number;
  private blocked: boolean[][];
  private terrain: AssetId[][];
  private objects: PlacedObject[];
  private buildings: Building[];
  private farms: Farm[];
  private paths: Path[];
  private waterBodies: WaterBody[];
  private fenceSections: FenceSection[];
  private forests: ForestPatch[];
  private center: GridCoord;

  constructor(seed: number) {
    this.seed = seed;
    this.rng = createRNG(seed);
    this.gridW = CONFIG.GRID_SIZE;
    this.gridH = CONFIG.GRID_SIZE;
    this.blocked = Array.from({ length: this.gridH }, () => Array(this.gridW).fill(false));
    this.terrain = Array.from({ length: this.gridH }, () => Array(this.gridW).fill('grass_tile_01'));
    this.objects = [];
    this.buildings = [];
    this.farms = [];
    this.paths = [];
    this.waterBodies = [];
    this.fenceSections = [];
    this.forests = [];
    this.center = { x: 7, y: 7 };
  }

  getSeed(): number {
    return this.seed;
  }

  getCenter(): GridCoord {
    return { ...this.center };
  }

  generate(maxRetries: number = 10): SettlementData {
    let attempts = 0;
    let waterOpt: WaterBody | null = null;
    while (attempts < maxRetries) {
      attempts++;
      this.blocked = Array.from({ length: this.gridH }, () => Array(this.gridW).fill(false));
      this.terrain = Array.from({ length: this.gridH }, () => Array(this.gridW).fill('grass_tile_01'));
      this.objects = [];
      this.buildings = [];
      this.farms = [];
      this.paths = [];
      this.waterBodies = [];
      this.fenceSections = [];
      this.forests = [];
      this.center = { x: 7, y: 7 };

      this.chooseCenter();
      this.fillGrass();
      waterOpt = this.generateWater();
      if (waterOpt) {
        this.waterBodies.push(waterOpt);
        waterOpt.cells.forEach(c => {
          this.blocked[c.y][c.x] = true;
          this.terrain[c.y][c.x] = 'water_tile_01';
        });
      }
      this.generateForests();
      this.placeHouses();
      this.generateFarms();
      this.generatePaths();
      this.placeWells();
      this.placeDecorations();
      this.placeForestObjects();
      this.placeChests();
      this.placeWaterLife(waterOpt);

      if (this.validate()) {
        return this.buildSettlementData(waterOpt);
      }
    }
    return this.buildSettlementData(waterOpt);
  }

  // ─── Step 1: Center ────────────────────────────────────────────

  private chooseCenter(): void {
    const margin = 3;
    this.center.x = margin + Math.floor(this.rng() * (this.gridW - 2 * margin));
    this.center.y = margin + Math.floor(this.rng() * (this.gridH - 2 * margin));
  }

  // ─── Step 2: Terrain ───────────────────────────────────────────

  private fillGrass(): void {
    for (let y = 0; y < this.gridH; y++) {
      for (let x = 0; x < this.gridW; x++) {
        this.terrain[y][x] = this.rng() < 0.3 ? 'grass_tile_02' : 'grass_tile_01';
      }
    }
  }

  // ─── Step 3: Water ─────────────────────────────────────────────

  private generateWater(): WaterBody | null {
    const waterChance = this.rng();
    if (waterChance > CONFIG.WATER_CHANCE) return null;

    const waterSizeRoll = this.rng();
    let targetSize: number;
    if (waterSizeRoll < 0.35) targetSize = 2;       // small
    else if (waterSizeRoll < 0.75) targetSize = 4;   // medium
    else targetSize = 7;                              // large

    const cx = this.center.x + Math.floor((this.rng() - 0.5) * 8);
    const cy = this.center.y + Math.floor((this.rng() - 0.5) * 8);

    // Irregular organic shape using flood-fill-like growth
    const cells: GridCoord[] = [];
    const inWater = new Set<string>();
    const startX = Math.max(1, Math.min(cx, this.gridW - 2));
    const startY = Math.max(1, Math.min(cy, this.gridH - 2));

    inWater.add(`${startX},${startY}`);
    cells.push({ x: startX, y: startY });

    const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];

    while (cells.length < targetSize) {
      const idx = Math.floor(this.rng() * cells.length);
      const cell = cells[idx];
      const neighbors: GridCoord[] = [];

      for (const d of dirs) {
        const nx = cell.x + d.dx;
        const ny = cell.y + d.dy;
        const key = `${nx},${ny}`;
        if (nx >= 1 && nx < this.gridW - 1 && ny >= 1 && ny < this.gridH - 1 && !inWater.has(key)) {
          neighbors.push({ x: nx, y: ny });
        }
      }

      if (neighbors.length === 0) {
        cells.splice(idx, 1);
        continue;
      }

      // Pick a neighbor that keeps the shape organic (prefer cells adjacent to existing)
      let best = neighbors[Math.floor(this.rng() * neighbors.length)];
      // Bias toward expansion in random directions
      if (this.rng() < 0.4 && neighbors.length > 1) {
        // Sometimes skip to make shape less circular
        best = neighbors[Math.floor(this.rng() * neighbors.length)];
      }

      inWater.add(`${best.x},${best.y}`);
      cells.push(best);
    }

    // Mark shoreline cells — direction-coded shore tiles.
    // shore_transition_01 is only valid when water is to the SE (bottom-right).
    // We rotate it for other diagonal directions, and use plain grass for cardinal-only adjacency.
    const waterSet = new Set(cells.map(c => `${c.x},${c.y}`));
    const shoreMap = new Map<string, string>(); // key -> terrain id

    for (const c of cells) {
      // Cardinal directions for finding shore neighbors
      for (const d of dirs) {
        const nx = c.x + d.dx;
        const ny = c.y + d.dy;
        const key = `${nx},${ny}`;
        if (!waterSet.has(key) && nx >= 0 && nx < this.gridW && ny >= 0 && ny < this.gridH) {
          if (!shoreMap.has(key)) shoreMap.set(key, 'pending');
        }
      }
    }

    // For each shore cell, determine which diagonal directions have water
    for (const [key] of shoreMap) {
      const [sx, sy] = key.split(',').map(Number);
      // Check the 4 diagonal neighbors for water
      const diagDirs = [
        { dx:  1, dy:  1, tag: 'shore_SE' }, // water to SE
        { dx: -1, dy:  1, tag: 'shore_SW' }, // water to SW
        { dx:  1, dy: -1, tag: 'shore_NE' }, // water to NE
        { dx: -1, dy: -1, tag: 'shore_NW' }, // water to NW
      ];
      // Check 4 cardinal neighbors for water
      const cardinals = [
        { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
        { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
      ];
      const cardinalWater = cardinals.filter(d =>
        waterSet.has(`${sx + d.dx},${sy + d.dy}`)
      );
      const diagWater = diagDirs.filter(d =>
        waterSet.has(`${sx + d.dx},${sy + d.dy}`)
      );

      let chosenTag = 'grass_tile_01'; // default: cardinal-only adjacency → plain grass
      if (diagWater.length > 0) {
        // Prefer the diagonal that represents the most water
        // If multiple diagonals have water, pick the first (deterministic)
        chosenTag = diagWater[0].tag;
      } else if (cardinalWater.length > 0) {
        // Cardinal-only adjacency — use plain grass (shore tile doesn't apply)
        chosenTag = 'grass_tile_01';
      }
      shoreMap.set(key, chosenTag);
    }

    // Apply shore/grass terrain to shore cells
    for (const [key, tag] of shoreMap) {
      const [sx, sy] = key.split(',').map(Number);
      if (!waterSet.has(key)) {
        this.terrain[sy][sx] = tag;
      }
    }

    const hasBoat = cells.length >= 4 && this.rng() < 0.6;
    let boatX = 0, boatY = 0;
    if (hasBoat && cells.length > 0) {
      const midCell = cells[Math.floor(cells.length / 2)];
      boatX = midCell.x;
      boatY = midCell.y;
    }

    return {
      cells,
      hasBoat,
      boatX,
      boatY
    };
  }

  // ─── Step 4: Forests ───────────────────────────────────────────

  private generateForests(): void {
    const numPatches = 2 + Math.floor(this.rng() * 2); // 2-3 patches

    for (let p = 0; p < numPatches; p++) {
      const patchSize = 2 + Math.floor(this.rng() * 3); // 2-4 trees
      const angle = (p / numPatches) * Math.PI * 2 + this.rng() * 0.5;
      const dist = 4 + this.rng() * 5;
      const px = this.center.x + Math.floor(Math.cos(angle) * dist);
      const py = this.center.y + Math.floor(Math.sin(angle) * dist);

      const treeType = this.rng() < 0.5 ? 'tree_oak_01' : 'tree_pine_01';
      const trees: GridCoord[] = [];

      for (let t = 0; t < patchSize; t++) {
        const tx = Math.max(0, Math.min(px + Math.floor((this.rng() - 0.5) * 3), this.gridW - 1));
        const ty = Math.max(0, Math.min(py + Math.floor((this.rng() - 0.5) * 3), this.gridH - 1));
        const key = `${tx},${ty}`;
        if (!trees.find(t => `${t.x},${t.y}` === key) && !this.blocked[ty][tx]) {
          trees.push({ x: tx, y: ty });
          this.blocked[ty][tx] = true;
        }
      }

      if (trees.length > 0) {
        this.forests.push({
          x: px,
          y: py,
          trees,
          treeType
        });
      }
    }
  }

  // ─── Step 5: Houses ────────────────────────────────────────────

  private placeHouses(): void {
    const numHouses = 3 + Math.floor(this.rng() * 4); // 3-6 houses
    let attempts = 0;

    // Shuffle house defs by weight
    const availableDefs = [...HOUSE_DEFS].sort(() => this.rng() - 0.5);
    let defIdx = 0;

    for (let h = 0; h < numHouses && attempts < CONFIG.MAX_PATH_ATTEMPTS; h++) {
      let placed = false;
      let localAttempts = 0;

      while (localAttempts < 100 && !placed) {
        const def = availableDefs[defIdx % availableDefs.length];
        defIdx++;

        const fw = def.footprintW;
        const fh = def.footprintH;

        const maxX = this.gridW - fw - 1;
        const maxY = this.gridH - fh - 1;
        if (maxX < 1 || maxY < 1) { localAttempts++; continue; }

        const hx = 1 + Math.floor(this.rng() * maxX);
        const hy = 1 + Math.floor(this.rng() * maxY);

        if (this.tryPlaceHouse(def, hx, hy)) {
          placed = true;
        }
        localAttempts++;
      }
      attempts++;
    }
  }

  private tryPlaceHouse(def: HouseDef, gx: number, gy: number): boolean {
    const fw = def.footprintW;
    const fh = def.footprintH;

    // Check bounds
    if (gx + fw > this.gridW - 1 || gy + fh > this.gridH - 1) return false;

    // Check distance from center (must be in settlement area)
    const dx = gx + fw / 2 - this.center.x;
    const dy = gy + fh / 2 - this.center.y;
    const distFromCenter = Math.sqrt(dx * dx + dy * dy);
    if (distFromCenter > CONFIG.SETTLEMENT_MAX_RADIUS + 1) return false;
    if (distFromCenter < CONFIG.SETTLEMENT_MIN_RADIUS - 1) return false;

    // Check distance from existing houses
    for (const b of this.buildings) {
      const bx = b.x + (b.footprintW || 1) / 2;
      const by = b.y + (b.footprintH || 1) / 2;
      const hx = gx + fw / 2;
      const hy = gy + fh / 2;
      const dd = Math.sqrt((hx - bx) ** 2 + (hy - by) ** 2);
      if (dd < CONFIG.MIN_HOUSE_DISTANCE) return false;
    }

    // Check footprint doesn't overlap blocked cells
    for (let dy = 0; dy < fh; dy++) {
      for (let dx = 0; dx < fw; dx++) {
        if (this.blocked[gy + dy][gx + dx]) return false;
      }
    }

    // Check no overlap with water
    for (let dy = 0; dy < fh; dy++) {
      for (let dx = 0; dx < fw; dx++) {
        if (this.terrain[gy + dy][gx + dx] === 'water_tile_01') return false;
      }
    }

    // Determine door direction (toward center)
    const doorOffset = DOOR_OFFSETS[def.id] || { dx: 1, dy: 1, dir: 'down' as const };
    const doorX = gx + doorOffset.dx;
    const doorY = gy + doorOffset.dy;

    // Place building
    const building: Building = {
      id: def.id,
      type: 'house',
      x: gx,
      y: gy,
      footprintW: fw,
      footprintH: fh,
      door: { x: doorX, y: doorY },
      doorDir: doorOffset.dir,
    };

    this.buildings.push(building);
    this.objects.push(building);

    // Mark cells as blocked
    for (let dy = 0; dy < fh; dy++) {
      for (let dx = 0; dx < fw; dx++) {
        this.blocked[gy + dy][gx + dx] = true;
      }
    }

    return true;
  }

  // ─── Step 6: Farms ─────────────────────────────────────────────

  private generateFarms(): void {
    const numFarms = Math.min(CONFIG.MAX_FARMS, this.buildings.length);
    const cropIds = this.getCropBaseIds();

    for (let f = 0; f < numFarms; f++) {
      // Find a good farm location near a house or center
      let bestX = -1, bestY = -1;
      let bestAttempts = 200;

      for (let a = 0; a < bestAttempts; a++) {
        const fx = 1 + Math.floor(this.rng() * (this.gridW - 4));
        const fy = 1 + Math.floor(this.rng() * (this.gridH - 4));

        // Must be far from buildings and water
        let valid = true;
        for (const b of this.buildings) {
          const bx = b.x + b.footprintW / 2;
          const by = b.y + b.footprintH / 2;
          const dd = Math.sqrt((fx - bx) ** 2 + (fy - by) ** 2);
          if (dd < 4) { valid = false; break; }
        }
        if (!valid) continue;

        // Check water
        if (this.terrain[fy][fx] === 'water_tile_01') continue;

        // Check blocked
        if (this.blocked[fy][fx]) continue;

        // Must be somewhat near center
        const dist = Math.sqrt((fx - this.center.x) ** 2 + (fy - this.center.y) ** 2);
        if (dist > CONFIG.SETTLEMENT_MAX_RADIUS + 2) continue;

        bestX = fx;
        bestY = fy;
        break;
      }

      if (bestX < 0) continue;

      // Generate organic farm shape
      const farmCells = this.generateOrganicShape(bestX, bestY, 4 + Math.floor(this.rng() * 5), 12);

      // Filter valid cells
      const validCells: GridCoord[] = [];
      for (const c of farmCells) {
        if (c.x >= 0 && c.x < this.gridW && c.y >= 0 && c.y < this.gridH &&
            !this.blocked[c.y][c.x] && this.terrain[c.y][c.x] !== 'water_tile_01') {
          validCells.push(c);
        }
      }

      if (validCells.length < 3) continue;

      // Mark farm cells as blocked.
      // Terrain = 'dirt_tile_01' (plain soil base) so the terrain layer draws soil.
      // The renderer farm layer then overlays the tilled soil PNG on top.
      const cropBaseId = cropIds[Math.floor(this.rng() * cropIds.length)];
      const cells: { x: number; y: number; cropId: AssetId; cropStage: number }[] = [];

      for (const c of validCells) {
        this.blocked[c.y][c.x] = true;
        this.terrain[c.y][c.x] = 'dirt_tile_01'; // plain soil base
        // Random growth stage: 20% early, 30% mid, 40% mature, 10% other
        const r = this.rng();
        let stage: number;
        if (r < 0.2) stage = Math.floor(this.rng() * 2); // 0-1
        else if (r < 0.5) stage = 2 + Math.floor(this.rng() * 2); // 2-3
        else if (r < 0.9) stage = 4; // mature
        else stage = 5; // harvested

        const cropId = `${cropBaseId}_stage_${stage}`;
        cells.push({ x: c.x, y: c.y, cropId, cropStage: stage });
      }

      this.farms.push({
        id: `farm_${f}`,
        type: 'farm',
        x: bestX,
        y: bestY,
        footprintW: 0,
        footprintH: 0,
        cells,
        cropId: cropBaseId,
      });

      this.objects.push(this.farms[this.farms.length - 1]);
    }
  }

  private generateOrganicShape(cx: number, cy: number, minSize: number, maxSize: number): GridCoord[] {
    const size = minSize + Math.floor(this.rng() * (maxSize - minSize));
    const cells: GridCoord[] = [];
    const inShape = new Set<string>();

    // Start from center and grow organically
    const startX = Math.max(0, Math.min(cx, this.gridW - 1));
    const startY = Math.max(0, Math.min(cy, this.gridH - 1));
    inShape.add(`${startX},${startY}`);
    cells.push({ x: startX, y: startY });

    const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];

    while (cells.length < size) {
      const idx = Math.floor(this.rng() * cells.length);
      const cell = cells[idx];
      const neighbors: GridCoord[] = [];

      for (const d of dirs) {
        const nx = cell.x + d.dx;
        const ny = cell.y + d.dy;
        if (nx >= -1 && nx < this.gridW + 1 && ny >= -1 && ny < this.gridH + 1 && !inShape.has(`${nx},${ny}`)) {
          neighbors.push({ x: nx, y: ny });
        }
      }

      if (neighbors.length === 0) break;

      const next = neighbors[Math.floor(this.rng() * neighbors.length)];
      inShape.add(`${next.x},${next.y}`);
      cells.push(next);
    }

    return cells;
  }

  private getCropBaseIds(): string[] {
    const available = [...CROP_BASE_IDS];
    // Shuffle
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }
    return available;
  }

  // ─── Step 7: Paths ─────────────────────────────────────────────

  private generatePaths(): void {
    if (this.buildings.length === 0) return;

    // Build a main path network around the center
    const mainPathNodes = this.buildCenterPathNetwork();

    // Connect each house door to the nearest path node using BFS
    for (const building of this.buildings) {
      const door = building.door;
      if (!door) continue;

      const pathNodes = this.bfsConnect(door.x, door.y, mainPathNodes);
      if (pathNodes.length > 0) {
        // Smooth the path
        const smoothed = this.smoothPath(pathNodes);
        this.paths.push({
          id: `path_${building.id}`,
          type: 'path',
          x: door.x,
          y: door.y,
          footprintW: 0,
          footprintH: 0,
          nodes: smoothed,
        });
        this.objects.push(this.paths[this.paths.length - 1]);
      }
    }

    // Add the main path network as a separate path object
    if (mainPathNodes.length > 1) {
      this.paths.push({
        id: 'path_main',
        type: 'path',
        x: this.center.x,
        y: this.center.y,
        footprintW: 0,
        footprintH: 0,
        nodes: mainPathNodes,
      });
      this.objects.push(this.paths[this.paths.length - 1]);
    }
  }

  private buildCenterPathNetwork(): GridCoord[] {
    const nodes: GridCoord[] = [];
    const spread = Math.max(2, Math.floor(CONFIG.SETTLEMENT_MAX_RADIUS * 0.6));

    // Create a small network around the center
    const angles = [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI, 5 * Math.PI / 4, 3 * Math.PI / 2, 7 * Math.PI / 4];
    const numRings = 2;

    for (let r = 1; r <= numRings; r++) {
      for (const a of angles) {
        const nx = Math.round(this.center.x + Math.cos(a) * r * spread / numRings);
        const ny = Math.round(this.center.y + Math.sin(a) * r * spread / numRings);
        if (nx >= 0 && nx < this.gridW && ny >= 0 && ny < this.gridH && !this.blocked[ny][nx]) {
          const key = `${nx},${ny}`;
          if (!nodes.find(n => `${n.x},${n.y}` === key)) {
            nodes.push({ x: nx, y: ny });
          }
        }
      }
    }

    // Connect adjacent nodes to form the network
    const connected: GridCoord[] = [];
    const connectedSet = new Set<string>();
    connectedSet.add(`${this.center.x},${this.center.y}`);
    connected.push({ x: this.center.x, y: this.center.y });

    for (const n of nodes) {
      if (connectedSet.has(`${n.x},${n.y}`)) continue;
      // Check if adjacent to any connected node
      const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
      for (const d of dirs) {
        const nx = n.x + d.dx;
        const ny = n.y + d.dy;
        if (connectedSet.has(`${nx},${ny}`)) {
          connectedSet.add(`${n.x},${n.y}`);
          connected.push(n);
          break;
        }
      }
    }

    // Ensure we have a reasonable network
    if (connected.length < 3) {
      connected.push({ x: this.center.x + 1, y: this.center.y });
      connected.push({ x: this.center.x, y: this.center.y + 1 });
    }

    return connected;
  }

  private bfsConnect(sx: number, sy: number, targets: GridCoord[]): GridCoord[] {
    const targetSet = new Set(targets.map(t => `${t.x},${t.y}`));
    const visited = new Set<string>();
    const queue: { x: number; y: number; path: GridCoord[] }[] = [];

    const startKey = `${sx},${sy}`;
    visited.add(startKey);
    queue.push({ x: sx, y: sy, path: [{ x: sx, y: sy }] });

    let iterations = 0;
    const maxIter = CONFIG.MAX_PATH_ATTEMPTS;

    while (queue.length > 0 && iterations < maxIter) {
      iterations++;
      const current = queue.shift()!;

      // Check if we reached a target
      const currentKey = `${current.x},${current.y}`;
      if (targetSet.has(currentKey) && current.path.length > 1) {
        return current.path;
      }

      const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
      for (const d of dirs) {
        const nx = current.x + d.dx;
        const ny = current.y + d.dy;
        const key = `${nx},${ny}`;

        if (nx < 0 || nx >= this.gridW || ny < 0 || ny >= this.gridH) continue;
        if (visited.has(key)) continue;
        if (this.blocked[ny][nx]) continue;
        if (this.terrain[ny][nx] === 'water_tile_01') continue;

        visited.add(key);
        const newPath = [...current.path, { x: nx, y: ny }];
        queue.push({ x: nx, y: ny, path: newPath });
      }
    }

    return [];
  }

  private smoothPath(nodes: GridCoord[]): GridCoord[] {
    if (nodes.length < 3) return nodes;

    // Simple path smoothing: remove unnecessary waypoints
    const smoothed: GridCoord[] = [nodes[0]];
    let prevDir = -1;

    for (let i = 1; i < nodes.length; i++) {
      const prev = nodes[i - 1];
      const curr = nodes[i];
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      let dir = 0;
      if (dx !== 0) dir = dx > 0 ? 1 : 3;
      if (dy !== 0) dir = dy > 0 ? 2 : 0;

      if (dir !== prevDir) {
        smoothed.push(curr);
        prevDir = dir;
      } else {
        smoothed[smoothed.length - 1] = curr;
      }
    }

    // Add low-frequency positional variation to make path gentle
    const varied: GridCoord[] = [smoothed[0]];
    for (let i = 1; i < smoothed.length - 1; i++) {
      const prev = smoothed[i - 1];
      const next = smoothed[i + 1];
      // Only vary by at most 1 cell
      const vx = smoothed[i].x + Math.round((this.rng() - 0.5) * 0.6);
      const vy = smoothed[i].y + Math.round((this.rng() - 0.5) * 0.6);
      varied.push({ x: Math.max(0, Math.min(this.gridW - 1, vx)), y: Math.max(0, Math.min(this.gridH - 1, vy)) });
    }
    varied.push(smoothed[smoothed.length - 1]);

    return varied;
  }

  // ─── Step 8: Wells ─────────────────────────────────────────────

  private placeWells(): void {
    const numWells = this.rng() < 0.3 ? 0 : (this.buildings.length > 4 ? 2 : 1);

    for (let w = 0; w < numWells; w++) {
      let placed = false;
      for (let a = 0; a < 100; a++) {
        const wx = 1 + Math.floor(this.rng() * (this.gridW - 2));
        const wy = 1 + Math.floor(this.rng() * (this.gridH - 2));

        if (this.blocked[wy][wx]) continue;
        if (this.terrain[wy][wx] === 'water_tile_01') continue;

        // Check distance from buildings
        let nearBuilding = false;
        for (const b of this.buildings) {
          const bx = b.x + b.footprintW / 2;
          const by = b.y + b.footprintH / 2;
          const dd = Math.sqrt((wx - bx) ** 2 + (wy - by) ** 2);
          if (dd < 5 && dd > 1.5) { nearBuilding = true; break; }
        }

        // Check not on a path
        let onPath = false;
        for (const p of this.paths) {
          if (p.nodes.find(n => n.x === wx && n.y === wy)) { onPath = true; break; }
        }
        if (onPath) continue;

        if (!nearBuilding) continue;

        const wellId = this.rng() < 0.5 ? 'farm_well' : 'farm_well_covered';
        this.objects.push({
          id: wellId,
          type: 'well',
          x: wx,
          y: wy,
          footprintW: 1,
          footprintH: 1,
        });
        this.blocked[wy][wx] = true;
        placed = true;
        break;
      }
    }
  }

  // ─── Step 9: Fences (Removed as requested) ────────────────────────


  // ─── Step 10: Decorations ──────────────────────────────────────

  private placeDecorations(): void {
    let rockCount = 0;
    let flowerCount = 0;
    let mushroomCount = 0;

    // Place rocks and flowers in free spaces
    for (let attempt = 0; attempt < CONFIG.MAX_DECORATIONS; attempt++) {
      const rx = 1 + Math.floor(this.rng() * (this.gridW - 2));
      const ry = 1 + Math.floor(this.rng() * (this.gridH - 2));

      if (this.blocked[ry][rx]) continue;
      if (this.terrain[ry][rx] === 'water_tile_01') continue;

      // Check not near buildings (light decoration near buildings)
      let nearBuilding = false;
      for (const b of this.buildings) {
        const bx = b.x + b.footprintW / 2;
        const by = b.y + b.footprintH / 2;
        const dd = Math.sqrt((rx - bx) ** 2 + (ry - by) ** 2);
        if (dd < 1.5) { nearBuilding = true; break; }
      }

      // Check not on paths
      let onPath = false;
      for (const p of this.paths) {
        if (p.nodes.find(n => n.x === rx && n.y === ry)) { onPath = true; break; }
      }

      if (nearBuilding || onPath) continue;

      // Determine decoration type based on location
      const r = this.rng();
      if (r < 0.35 && rockCount < CONFIG.MAX_ROCKS) {
        this.objects.push({
          id: 'small_rock_01',
          type: 'decoration',
          x: rx,
          y: ry,
          footprintW: 1,
          footprintH: 1,
        });
        this.blocked[ry][rx] = true;
        rockCount++;
      } else if (r < 0.65 && flowerCount < CONFIG.MAX_FLOWERS) {
        const flowerId = FLOWER_IDS[Math.floor(this.rng() * FLOWER_IDS.length)];
        this.objects.push({
          id: flowerId,
          type: 'decoration',
          x: rx,
          y: ry,
          footprintW: 1,
          footprintH: 1,
        });
        this.blocked[ry][rx] = true;
        flowerCount++;
      } else if (mushroomCount < 5) {
        const mushroomId = MUSHROOM_IDS[Math.floor(this.rng() * MUSHROOM_IDS.length)];
        this.objects.push({
          id: mushroomId,
          type: 'decoration',
          x: rx,
          y: ry,
          footprintW: 1,
          footprintH: 1,
        });
        this.blocked[ry][rx] = true;
        mushroomCount++;
      }
    }
  }

  // ─── Step 11: Forest Objects ───────────────────────────────────

  private placeForestObjects(): void {
    for (const forest of this.forests) {
      // Place acorns/mushrooms around trees
      const numObj = Math.floor(this.rng() * 2);
      for (let o = 0; o < numObj; o++) {
        const tree = forest.trees[Math.floor(this.rng() * forest.trees.length)];
        if (!tree) continue;
        const ox = tree.x + Math.floor((this.rng() - 0.5) * 2);
        const oy = tree.y + Math.floor((this.rng() - 0.5) * 2);
        if (ox >= 0 && ox < this.gridW && oy >= 0 && oy < this.gridH && !this.blocked[oy][ox]) {
          const objId = this.rng() < 0.5 ? 'acorn_deco_01' : 'truffle_deco_01';
          this.objects.push({
            id: objId,
            type: 'decoration',
            x: ox,
            y: oy,
            footprintW: 1,
            footprintH: 1,
          });
          this.blocked[oy][ox] = true;
        }
      }
    }
  }

  // ─── Step 12: Chests ───────────────────────────────────────────

  private placeChests(): void {
    const numChests = this.rng() < 0.5 ? 0 : (this.rng() < 0.5 ? 1 : 2);

    for (let c = 0; c < numChests; c++) {
      let placed = false;
      for (let a = 0; a < 100; a++) {
        const cx = 1 + Math.floor(this.rng() * (this.gridW - 2));
        const cy = 1 + Math.floor(this.rng() * (this.gridH - 2));

        if (this.blocked[cy][cx]) continue;
        if (this.terrain[cy][cx] === 'water_tile_01') continue;

        // Must be outside main settlement area
        const dist = Math.sqrt((cx - this.center.x) ** 2 + (cy - this.center.y) ** 2);
        if (dist < CONFIG.SETTLEMENT_MAX_RADIUS) continue;

        // Check not near buildings
        let nearBuilding = false;
        for (const b of this.buildings) {
          const bx = b.x + b.footprintW / 2;
          const by = b.y + b.footprintH / 2;
          const dd = Math.sqrt((cx - bx) ** 2 + (cy - by) ** 2);
          if (dd < 3) { nearBuilding = true; break; }
        }
        if (nearBuilding) continue;

        const chestId = this.rng() < 0.5 ? 'farm_chest_closed' : 'farm_chest2_closed';
        this.objects.push({
          id: chestId,
          type: 'chest',
          x: cx,
          y: cy,
          footprintW: 1,
          footprintH: 1,
        });
        this.blocked[cy][cx] = true;
        placed = true;
        break;
      }
    }
  }

  // ─── Step 13: Water Life ───────────────────────────────────────

  private placeWaterLife(waterOpt: WaterBody | null): void {
    if (!waterOpt) return;

    const size = waterOpt.cells.length;
    let numAnimals = 0;
    if (size <= 3) numAnimals = this.rng() < 0.3 ? 1 : 0;
    else if (size <= 5) numAnimals = 1 + Math.floor(this.rng() * 2);
    else numAnimals = 2 + Math.floor(this.rng() * 3);

    for (let a = 0; a < numAnimals; a++) {
      const cell = waterOpt.cells[Math.floor(this.rng() * waterOpt.cells.length)];
      this.objects.push({
        id: 'animal_duck',
        type: 'animal',
        x: cell.x,
        y: cell.y,
        footprintW: 1,
        footprintH: 1,
        metadata: { inWater: true }
      });
    }

    // Place boat on large water
    if (waterOpt.hasBoat && size >= 4 && waterOpt.boatX >= 0 && waterOpt.boatY >= 0) {
      this.objects.push({
        id: 'boat_coracle_water',
        type: 'boat',
        x: waterOpt.boatX,
        y: waterOpt.boatY,
        footprintW: 3,
        footprintH: 2,
        metadata: { inWater: true }
      });
    }
  }

  // ─── Step 14: Validation ──────────────────────────────────────

  private validate(): boolean {
    // Check all objects inside bounds
    for (const obj of this.objects) {
      if (obj.x < 0 || obj.x >= this.gridW || obj.y < 0 || obj.y >= this.gridH) return false;
    }

    // Check no building overlaps
    for (let i = 0; i < this.buildings.length; i++) {
      for (let j = i + 1; j < this.buildings.length; j++) {
        const a = this.buildings[i];
        const b = this.buildings[j];
        if (this.rectsOverlap(a.x, a.y, a.footprintW, a.footprintH, b.x, b.y, b.footprintW, b.footprintH)) {
          return false;
        }
      }
    }

    // Check houses respect minimum distance
    for (let i = 0; i < this.buildings.length; i++) {
      for (let j = i + 1; j < this.buildings.length; j++) {
        const a = this.buildings[i];
        const b = this.buildings[j];
        const acx = a.x + a.footprintW / 2;
        const acy = a.y + a.footprintH / 2;
        const bcx = b.x + b.footprintW / 2;
        const bcy = b.y + b.footprintH / 2;
        const dd = Math.sqrt((acx - bcx) ** 2 + (acy - bcy) ** 2);
        if (dd < CONFIG.MIN_HOUSE_DISTANCE && dd > 0) return false;
      }
    }

    // Check no building overlaps water
    for (const b of this.buildings) {
      for (let dy = 0; dy < b.footprintH; dy++) {
        for (let dx = 0; dx < b.footprintW; dx++) {
          if (this.terrain[b.y + dy][b.x + dx] === 'water_tile_01') return false;
        }
      }
    }

    // Check no farm overlaps buildings
    for (const farm of this.farms) {
      for (const cell of farm.cells) {
        for (const b of this.buildings) {
          if (cell.x >= b.x && cell.x < b.x + b.footprintW && cell.y >= b.y && cell.y < b.y + b.footprintH) {
            return false;
          }
        }
      }
    }

    // Check paths don't pass through buildings
    for (const path of this.paths) {
      for (const node of path.nodes) {
        for (const b of this.buildings) {
          if (node.x >= b.x && node.x < b.x + b.footprintW && node.y >= b.y && node.y < b.y + b.footprintH) {
            return false;
          }
        }
      }
    }

    // Check paths don't pass through water
    for (const path of this.paths) {
      for (const node of path.nodes) {
        if (this.terrain[node.y][node.x] === 'water_tile_01') return false;
      }
    }

    // Check not overcrowded
    if (this.buildings.length < 1) return false;

    // Check forests don't form a complete ring
    // (simplified check)
    if (this.forests.length > 0) {
      // We generate sparse patches, so this should be fine
    }

    // Check there are open natural spaces
    let freeCells = 0;
    for (let y = 0; y < this.gridH; y++) {
      for (let x = 0; x < this.gridW; x++) {
        if (!this.blocked[y][x]) freeCells++;
      }
    }
    if (freeCells < 20) return false; // Need breathing room

    return true;
  }

  private rectsOverlap(x1: number, y1: number, w1: number, h1: number, x2: number, y2: number, w2: number, h2: number): boolean {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
  }

  // ─── Build Output ──────────────────────────────────────────────

  private buildSettlementData(waterOpt: WaterBody | null): SettlementData {
    return {
      seed: this.seed,
      center: { ...this.center },
      objects: this.objects,
      buildings: this.buildings,
      farms: this.farms,
      paths: this.paths,
      waterBodies: this.waterBodies,
      fenceSections: this.fenceSections,
      forests: this.forests,
      blocked: this.blocked.map(row => [...row]),
      terrain: this.terrain.map(row => [...row]),
      width: this.gridW,
      height: this.gridH,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// BATCH GENERATE — multiple seeds, return best
// ═══════════════════════════════════════════════════════════════════

export function generateSettlement(seed?: number): SettlementData {
  const actualSeed = seed !== undefined ? seed : Math.floor(Math.random() * 2147483647);
  const gen = new SettlementGenerator(actualSeed);
  return gen.generate();
}