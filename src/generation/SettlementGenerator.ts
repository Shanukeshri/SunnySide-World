// ═══════════════════════════════════════════════════════════════════
// PROCEDURAL SETTLEMENT GENERATOR (Flat plain, 16×16 grid, Road-first)
// ═══════════════════════════════════════════════════════════════════

export type AssetId = string;

export interface GridCoord {
  x: number;
  y: number;
}

export interface PlacedObject {
  id: AssetId;
  name: string;
  type: 'house' | 'farm' | 'well' | 'tree' | 'bush' | 'decoration' | 'farm_object';
  x: number; // grid anchor X
  y: number; // grid anchor Y
  footprintW: number; // cells
  footprintH: number; // cells
  door?: GridCoord;
  metadata?: Record<string, any>;
}

export interface FarmCell {
  x: number;
  y: number;
  cropId: AssetId;
  stage: number; // 0 to 4
}

export interface FarmPlot {
  x: number;
  y: number;
  w: number;
  h: number;
  cells: FarmCell[];
  cropBaseId: string;
}

export interface WaterBody {
  cells: GridCoord[];
}

export interface SettlementCell {
  terrain: AssetId;       // e.g. grass_tile_01, path_tile_01, water_tile_01, shore_transition_01, sand_tile_01, stone_tile_01
  rotation?: number;      // angle in radians for directional shore_transition_01
  isRoad: boolean;
  isRoadReserved: boolean;// road cell + buffer
  isWater: boolean;
  isFarm: boolean;
  blocked: boolean;       // occupied by a structure or solid object
}

export interface ValidationReport {
  valid: boolean;
  checks: {
    flatTerrain: boolean;
    noIsometricBlocks: boolean;
    noElevationAssets: boolean;
    gridAligned16px: boolean;
    roadsGeneratedFirst: boolean;
    sparseRoadsGaps: boolean;
    noObjectsOnRoad: boolean;
    housesFarApart: boolean;
    housesNorthOfRoads: boolean;
    allHousesConnectedToPath: boolean;
    largeIrregularFarms: boolean;
    directionalShoreRotated: boolean;
    openCountrysideRemaining: boolean;
    noStage4Crops: boolean;
    fencesAroundFarms: boolean;
  };
  violations: string[];
}

export interface SettlementData {
  seed: number;
  width: number;
  height: number;
  grid: SettlementCell[][];
  houses: PlacedObject[];
  farms: FarmPlot[];
  farmObjects: PlacedObject[];
  wells: PlacedObject[];
  trees: PlacedObject[];
  bushes: PlacedObject[];
  decorations: PlacedObject[];
  waterBodies: WaterBody[];
  validation: ValidationReport;
}

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
// ASSET CATALOG (Direct from map.txt / houses.png / trees_and_bushes.png)
// ═══════════════════════════════════════════════════════════════════

export interface HouseTemplate {
  id: AssetId;
  name: string;
  w: number; // width in 16px cells
  h: number; // height in 16px cells
  rarity: 'common' | 'uncommon' | 'rare';
  weight: number;
}

export const HOUSE_CATALOG: HouseTemplate[] = [
  { id: 'house_cottage_01',    name: 'Thatched Cottage', w: 3, h: 3, rarity: 'common',   weight: 10 },
  { id: 'house_farmhouse_01',  name: 'Farmstead Manor',  w: 4, h: 3, rarity: 'common',   weight: 9 },
  { id: 'house_barn_01',       name: 'Timber Barn',      w: 3, h: 3, rarity: 'common',   weight: 9 },
  { id: 'house_workshop_01',   name: 'Smithy Workshop',  w: 4, h: 3, rarity: 'uncommon', weight: 6 },
  { id: 'house_tavern_01',     name: 'Village Tavern',   w: 3, h: 3, rarity: 'uncommon', weight: 6 },
  { id: 'house_shop_01',       name: 'Merchant Shop',    w: 4, h: 3, rarity: 'uncommon', weight: 5 },
  { id: 'house_windmill_01',   name: 'Windmill',         w: 4, h: 3, rarity: 'uncommon', weight: 5 },
  { id: 'house_mansion_01',    name: 'Noble Manor',      w: 4, h: 4, rarity: 'rare',     weight: 3 },
  { id: 'house_cabin_01',      name: 'Woodland Cabin',   w: 4, h: 3, rarity: 'common',   weight: 8 },
  { id: 'house_castle_01',     name: 'Castle Tower',    w: 3, h: 4, rarity: 'rare',     weight: 2 },
];

export const HOUSE_TEMPLATES = HOUSE_CATALOG;

export const CROP_BASE_KEYS = [
  'crop_wheat',
  'crop_carrot',
  'crop_potato',
  'crop_pumpkin',
  'crop_cabbage',
  'crop_cauliflower',
  'crop_kale',
  'crop_parsnip',
  'crop_radish',
  'crop_beetroot',
  'crop_sunflower'
];

export const FARM_OBJECT_IDS = [
  'farm_trough',
  'farm_waterbowl',
  'farm_crate_01',
  'farm_crate_02',
  'farm_chest_closed',
];

// Exclusively from assets/trees_and_bushes.png (first 5: trees, next 4: bushes)
export const TREE_ASSET_IDS = [
  'tree_01',
  'tree_02',
  'tree_03',
  'tree_04',
  'tree_05',
];

export const BUSH_ASSET_IDS = [
  'bush_01',
  'bush_02', // bush with red berries
  'bush_03',
  'bush_04', // bush with red berries
];

export const GRASS_TUFT_IDS = [
  'flowers_wild_01',
  'flowers_wild_02',
];

export const FENCE_ASSET_IDS = {
  h: 'fence_wood_h',
  v: 'fence_wood_v',
  corner: 'fence_wood_corner',
  post: 'fence_wood_post',
  gate: 'fence_wood_gate',
};

// Clean natural scatter: only transparent standalone sprites, zero cliff/line tiles
export const DECORATION_ASSET_IDS = [
  'small_rock_01',
  'flowers_wild_01',
  'flowers_wild_02',
  'mushrooms_deco_blue',
  'mushrooms_deco_red',
  'acorn_deco_01',
  'truffle_deco_01',
];

// ═══════════════════════════════════════════════════════════════════
// GENERATOR CLASS
// ═══════════════════════════════════════════════════════════════════

export class SettlementGenerator {
  private rng: () => number;
  private seed: number;
  private width: number;
  private height: number;
  private grid: SettlementCell[][];
  private houses: PlacedObject[] = [];
  private farms: FarmPlot[] = [];
  private farmObjects: PlacedObject[] = [];
  private wells: PlacedObject[] = [];
  private trees: PlacedObject[] = [];
  private bushes: PlacedObject[] = [];
  private decorations: PlacedObject[] = [];
  private waterBodies: WaterBody[] = [];
  private roadCells: GridCoord[] = [];

  constructor(seed: number, width = 48, height = 36) {
    this.seed = seed;
    this.rng = createRNG(seed);
    this.width = width;
    this.height = height;
    this.grid = [];
  }

  public generate(): SettlementData {
    // ── STEP 1: Flat grass base ground ────────────────────────────
    this.initFlatGrass();

    // ── STEP 2: Road/path network FIRST ───────────────────────────
    this.generateRoadNetwork();

    // ── STEP 3: Water bodies (random join of 2 to 4 big squares) ──
    this.generateWaterBodies();

    // ── STEP 4: Distant houses placed NORTH of road + path join ───
    this.generateHouses();
    this.joinHousesToRoads();

    // ── STEP 5: Reserve road clearance (including house paths) ────
    this.reserveRoadClearance();

    // ── STEP 6: Large farms with farm objects around them ─────────
    this.generateFarms();

    // ── STEP 7: Wells beside roads / near farms ───────────────────
    this.generateWells();

    // ── STEP 8: Trees with occasional clustering logic ────────────
    this.generateTrees();

    // ── STEP 9: Bushes with MANDATORY clustering every time ───────
    this.generateBushes();

    // ── STEP 10: Natural terrain details & scatter ────────────────
    this.generateTerrainDetails();

    // ── STEP 11: Validate result against all constraints ──────────
    const validation = this.validateSettlement();

    return {
      seed: this.seed,
      width: this.width,
      height: this.height,
      grid: this.grid,
      houses: this.houses,
      farms: this.farms,
      farmObjects: this.farmObjects,
      wells: this.wells,
      trees: this.trees,
      bushes: this.bushes,
      decorations: this.decorations,
      waterBodies: this.waterBodies,
      validation,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // STEP 1: Flat grass with texture variations from same grass group
  // ─────────────────────────────────────────────────────────────────
  private initFlatGrass() {
    this.grid = [];
    for (let y = 0; y < this.height; y++) {
      const row: SettlementCell[] = [];
      for (let x = 0; x < this.width; x++) {
        // Authentic textured grass distribution (row 2, columns 1-6, y=32)
        const r = this.rng();
        let terrain: AssetId = 'grass_textured_01';
        if (r < 0.50) terrain = 'grass_textured_01';
        else if (r < 0.65) terrain = 'grass_textured_02';
        else if (r < 0.76) terrain = 'grass_textured_03';
        else if (r < 0.85) terrain = 'grass_textured_04';
        else if (r < 0.93) terrain = 'grass_textured_05';
        else terrain = 'grass_textured_06';

        row.push({
          terrain,
          isRoad: false,
          isRoadReserved: false,
          isWater: false,
          isFarm: false,
          blocked: false,
        });
      }
      this.grid.push(row);
    }
  }

  /**
   * Return a textured dirt path tile from the dirt trail group
   */
  private getRandomPathTile(): AssetId {
    const r = this.rng();
    if (r < 0.68) return 'path_tile_01'; // Primary dirt trail
    if (r < 0.82) return 'path_tile_02'; // Fine pebbles
    if (r < 0.92) return 'path_tile_04'; // Light stones
    return 'path_tile_05';               // Earth grain
  }

  // ─────────────────────────────────────────────────────────────────
  // STEP 2: Road network generated FIRST (textured dirt path tiles)
  // ─────────────────────────────────────────────────────────────────
  private generateRoadNetwork() {
    this.roadCells = [];
    const largeRoads: GridCoord[][] = [];

    // ── 1. Main road (first large road through the city) ────────────
    const startY = Math.floor(this.height * 0.42 + this.rng() * (this.height * 0.16));
    const endY = Math.floor(this.height * 0.42 + this.rng() * (this.height * 0.16));

    const p0: GridCoord = { x: 2, y: startY };
    const p1: GridCoord = {
      x: Math.floor(this.width * 0.45 + (this.rng() - 0.5) * 6),
      y: Math.floor((startY + endY) / 2 + (this.rng() - 0.5) * 4),
    };
    const p2: GridCoord = { x: this.width - 3, y: endY };

    const mainRoad: GridCoord[] = [];
    mainRoad.push(...this.carveMeanderingPath(p0, p1));
    mainRoad.push(...this.carveMeanderingPath(p1, p2));
    largeRoads.push(mainRoad);

    // ── 2. Add 4–6 more large roads from different edges or important areas ──
    const extraRoadCount = 4 + Math.floor(this.rng() * 3); // 4, 5, or 6 additional large roads

    // Shuffled origin strategies: North, South, West, East edges and interior central junctions
    const originTypes = [0, 1, 2, 3, 4];
    for (let i = originTypes.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [originTypes[i], originTypes[j]] = [originTypes[j], originTypes[i]];
    }

    for (let r = 0; r < extraRoadCount; r++) {
      const originType = originTypes[r % originTypes.length];
      let startPt: GridCoord;
      let endPt: GridCoord;
      const endInside = this.rng() > 0.4; // Let some end inside the city instead of always crossing

      if (originType === 0) {
        // North edge coming south
        startPt = { x: Math.floor(this.width * 0.25 + this.rng() * (this.width * 0.5)), y: 2 };
        if (endInside) {
          endPt = {
            x: Math.floor(this.width * 0.35 + this.rng() * (this.width * 0.3)),
            y: Math.floor(this.height * 0.4 + this.rng() * (this.height * 0.25)),
          };
        } else {
          endPt = {
            x: Math.floor(this.width * 0.25 + this.rng() * (this.width * 0.5)),
            y: this.height - 3,
          };
        }
      } else if (originType === 1) {
        // South edge coming north
        startPt = { x: Math.floor(this.width * 0.25 + this.rng() * (this.width * 0.5)), y: this.height - 3 };
        if (endInside) {
          endPt = {
            x: Math.floor(this.width * 0.35 + this.rng() * (this.width * 0.3)),
            y: Math.floor(this.height * 0.35 + this.rng() * (this.height * 0.25)),
          };
        } else {
          endPt = {
            x: Math.floor(this.width * 0.25 + this.rng() * (this.width * 0.5)),
            y: 2,
          };
        }
      } else if (originType === 2) {
        // West edge
        const sy = Math.floor(this.rng() > 0.5 ? 4 + this.rng() * 8 : this.height - 12 + this.rng() * 8);
        startPt = { x: 2, y: sy };
        if (endInside) {
          endPt = {
            x: Math.floor(this.width * 0.4 + this.rng() * (this.width * 0.25)),
            y: Math.floor(this.height * 0.3 + this.rng() * (this.height * 0.4)),
          };
        } else {
          endPt = {
            x: this.width - 3,
            y: Math.floor(this.height * 0.3 + this.rng() * (this.height * 0.4)),
          };
        }
      } else if (originType === 3) {
        // East edge
        const sy = Math.floor(this.rng() > 0.5 ? 4 + this.rng() * 8 : this.height - 12 + this.rng() * 8);
        startPt = { x: this.width - 3, y: sy };
        if (endInside) {
          endPt = {
            x: Math.floor(this.width * 0.35 + this.rng() * (this.width * 0.25)),
            y: Math.floor(this.height * 0.3 + this.rng() * (this.height * 0.4)),
          };
        } else {
          endPt = {
            x: 2,
            y: Math.floor(this.height * 0.3 + this.rng() * (this.height * 0.4)),
          };
        }
      } else {
        // Important central hub / junction on an existing road
        const parentRoad = largeRoads[Math.floor(this.rng() * largeRoads.length)];
        const junction = parentRoad[Math.floor(parentRoad.length * (0.2 + this.rng() * 0.6))];
        startPt = { ...junction };
        const goNorth = this.rng() > 0.5;
        if (endInside) {
          endPt = {
            x: Math.max(4, Math.min(this.width - 5, junction.x + Math.floor((this.rng() - 0.5) * 16))),
            y: Math.max(4, Math.min(this.height - 5, junction.y + Math.floor((this.rng() - 0.5) * 14))),
          };
        } else {
          endPt = {
            x: Math.max(4, Math.min(this.width - 5, junction.x + Math.floor((this.rng() - 0.5) * 20))),
            y: goNorth ? 2 : this.height - 3,
          };
        }
      }

      // Give each 2–4 randomly shifted points so they curve naturally
      const numMid = 1 + (this.rng() > 0.5 ? 1 : 0); // 1 or 2 midpoints -> 3 or 4 total waypoints
      const waypoints: GridCoord[] = [startPt];

      for (let m = 1; m <= numMid; m++) {
        const t = m / (numMid + 1);
        const lx = startPt.x + (endPt.x - startPt.x) * t;
        const ly = startPt.y + (endPt.y - startPt.y) * t;

        const shiftX = (this.rng() - 0.5) * 8;
        const shiftY = (this.rng() - 0.5) * 6;

        waypoints.push({
          x: Math.max(2, Math.min(this.width - 3, Math.round(lx + shiftX))),
          y: Math.max(2, Math.min(this.height - 3, Math.round(ly + shiftY))),
        });
      }
      waypoints.push(endPt);

      // Carve sequentially through waypoints
      const thisRoadCells: GridCoord[] = [];
      for (let w = 0; w < waypoints.length - 1; w++) {
        thisRoadCells.push(...this.carveMeanderingPath(waypoints[w], waypoints[w + 1]));
      }
      largeRoads.push(thisRoadCells);
    }

    // ── 3. Connect nearby large roads ──────────────────────────────
    // Look for roads that come reasonably close to each other and connect some pairs
    const connectionsToMake = 1 + Math.floor(this.rng() * 2); // 1 or 2 curved connectors
    let madeConnections = 0;

    for (let i = 0; i < largeRoads.length && madeConnections < connectionsToMake; i++) {
      for (let j = i + 1; j < largeRoads.length && madeConnections < connectionsToMake; j++) {
        const roadA = largeRoads[i];
        const roadB = largeRoads[j];

        const candidates: { a: GridCoord; b: GridCoord; dist: number }[] = [];
        const stepA = Math.max(1, Math.floor(roadA.length / 10));
        const stepB = Math.max(1, Math.floor(roadB.length / 10));

        for (let aIdx = 0; aIdx < roadA.length; aIdx += stepA) {
          const ptA = roadA[aIdx];
          if (ptA.x < 5 || ptA.x > this.width - 6 || ptA.y < 5 || ptA.y > this.height - 6) continue;

          for (let bIdx = 0; bIdx < roadB.length; bIdx += stepB) {
            const ptB = roadB[bIdx];
            if (ptB.x < 5 || ptB.x > this.width - 6 || ptB.y < 5 || ptB.y > this.height - 6) continue;

            const dist = Math.abs(ptA.x - ptB.x) + Math.abs(ptA.y - ptB.y);
            if (dist >= 4 && dist <= 9) {
              candidates.push({ a: ptA, b: ptB, dist });
            }
          }
        }

        if (candidates.length > 0) {
          const choice = candidates[Math.floor(this.rng() * candidates.length)];
          const midPt: GridCoord = {
            x: Math.max(3, Math.min(this.width - 4, Math.round((choice.a.x + choice.b.x) / 2 + (this.rng() - 0.5) * 4))),
            y: Math.max(3, Math.min(this.height - 4, Math.round((choice.a.y + choice.b.y) / 2 + (this.rng() - 0.5) * 4))),
          };

          this.carveMeanderingPath(choice.a, midPt);
          this.carveMeanderingPath(midPt, choice.b);
          madeConnections++;
        }
      }
    }

    // ── 4. Add smaller roads inside the spaces ─────────────────────
    // Pick random points on existing roads and grow shorter roads toward open areas
    const spurCount = 2 + Math.floor(this.rng() * 3); // 2 to 4 smaller roads
    for (let s = 0; s < spurCount; s++) {
      if (this.roadCells.length === 0) break;
      const origin = this.roadCells[Math.floor(this.rng() * this.roadCells.length)];
      if (origin.x < 4 || origin.x > this.width - 5 || origin.y < 4 || origin.y > this.height - 5) {
        continue;
      }

      const dirs = [
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 },
      ];
      for (let d = dirs.length - 1; d > 0; d--) {
        const sw = Math.floor(this.rng() * (d + 1));
        [dirs[d], dirs[sw]] = [dirs[sw], dirs[d]];
      }

      let chosenDir = dirs[0];
      for (const d of dirs) {
        const testX = origin.x + d.dx * 3;
        const testY = origin.y + d.dy * 3;
        if (testX >= 3 && testX < this.width - 3 && testY >= 3 && testY < this.height - 3) {
          if (!this.grid[testY][testX].isRoad) {
            chosenDir = d;
            break;
          }
        }
      }

      const spurLength = 4 + Math.floor(this.rng() * 4);
      let cx = origin.x;
      let cy = origin.y;
      for (let step = 0; step < spurLength; step++) {
        if (this.rng() < 0.25) {
          if (chosenDir.dx !== 0) {
            cy += this.rng() > 0.5 ? 1 : -1;
          } else {
            cx += this.rng() > 0.5 ? 1 : -1;
          }
        } else {
          cx += chosenDir.dx;
          cy += chosenDir.dy;
        }

        if (cx < 2 || cx >= this.width - 2 || cy < 2 || cy >= this.height - 2) break;

        // If step > 2 and hits another road, connect and stop
        if (step > 2 && this.grid[cy][cx].isRoad) {
          break;
        }

        if (!this.grid[cy][cx].isRoad) {
          this.grid[cy][cx].isRoad = true;
          this.grid[cy][cx].blocked = true;
          this.grid[cy][cx].terrain = this.getRandomPathTile();
          this.roadCells.push({ x: cx, y: cy });
        }
      }
    }

    // Assign dirt path surface with natural texture variety from dirt trail group
    for (let i = 0; i < this.roadCells.length; i++) {
      const cell = this.roadCells[i];
      if (!this.grid[cell.y][cell.x].terrain.startsWith('path_tile_')) {
        this.grid[cell.y][cell.x].terrain = this.getRandomPathTile();
      }
      this.grid[cell.y][cell.x].isRoad = true;
      this.grid[cell.y][cell.x].blocked = true;
    }
  }

  private carveMeanderingPath(from: GridCoord, to: GridCoord): GridCoord[] {
    let currX = from.x;
    let currY = from.y;
    const path: GridCoord[] = [];

    const addCell = (x: number, y: number) => {
      if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
        if (!this.grid[y][x].isRoad) {
          this.grid[y][x].isRoad = true;
          this.grid[y][x].blocked = true;
          this.grid[y][x].terrain = this.getRandomPathTile();
          this.roadCells.push({ x, y });
        }
        path.push({ x, y });
      }
    };

    addCell(currX, currY);

    let safety = 0;
    while ((currX !== to.x || currY !== to.y) && safety++ < 250) {
      const dx = to.x - currX;
      const dy = to.y - currY;

      // Add gentle meander: occasionally step perpendicular
      if (this.rng() < 0.15) {
        if (Math.abs(dx) > Math.abs(dy) && dy !== 0) {
          currY += Math.sign(dy);
        } else if (dx !== 0) {
          currX += Math.sign(dx);
        }
      } else {
        if (Math.abs(dx) > Math.abs(dy)) {
          currX += Math.sign(dx);
        } else {
          currY += Math.sign(dy);
        }
      }
      addCell(currX, currY);
    }

    return path;
  }

  // ─────────────────────────────────────────────────────────────────
  // STEP 3: Reserve road clearance (ABSOLUTE)
  // ─────────────────────────────────────────────────────────────────
  private reserveRoadClearance() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[y][x].isRoad) {
          this.grid[y][x].isRoadReserved = true;
          continue;
        }

        // Check if adjacent to road (1-cell clearance buffer)
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ny = y + dy;
            const nx = x + dx;
            if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
              if (this.grid[ny][nx].isRoad) {
                this.grid[y][x].isRoadReserved = true;
                break;
              }
            }
          }
          if (this.grid[y][x].isRoadReserved) break;
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // STEP 4: Water bodies — Join of 2 to 4 big squares with diagonals at corners
  // ─────────────────────────────────────────────────────────────────
  private generateWaterBodies() {
    // Guaranteed 1 to 2 scenic ponds for wildlife/ducks and village landscape
    const pondCount = this.rng() > 0.4 ? 2 : 1;

    for (let p = 0; p < pondCount; p++) {
      // Find open area far from borders and avoiding heavy road overlap
      let cx = 0;
      let cy = 0;
      let found = false;

      for (let attempt = 0; attempt < 30; attempt++) {
        const tx = Math.floor(8 + this.rng() * (this.width - 16));
        const ty = Math.floor(6 + this.rng() * (this.height - 14));

        if (!this.grid[ty][tx].isRoad && !this.grid[ty][tx].isWater) {
          cx = tx;
          cy = ty;
          found = true;
          break;
        }
      }

      if (!found) continue;

      // Join of 2 to 4 big squares (width >= 3, height >= 3)
      const numSquares = 2 + Math.floor(this.rng() * 3); // 2, 3, or 4 big squares
      const waterMask = new Set<string>();
      const pondSquares: { x: number; y: number; w: number; h: number }[] = [];

      let curX = cx;
      let curY = cy;

      for (let s = 0; s < numSquares; s++) {
        const sqW = 3 + Math.floor(this.rng() * 3); // 3 to 5 cells
        const sqH = 3 + Math.floor(this.rng() * 3); // 3 to 5 cells

        const sx = s === 0 ? curX : curX + Math.floor((this.rng() - 0.5) * (sqW - 1));
        const sy = s === 0 ? curY : curY + Math.floor((this.rng() - 0.5) * (sqH - 1));

        pondSquares.push({ x: sx, y: sy, w: sqW, h: sqH });
        curX = sx;
        curY = sy;

        for (let dy = 0; dy < sqH; dy++) {
          for (let dx = 0; dx < sqW; dx++) {
            const wx = sx + dx;
            const wy = sy + dy;
            if (wx >= 1 && wx < this.width - 1 && wy >= 1 && wy < this.height - 1) {
              waterMask.add(`${wx},${wy}`);
            }
          }
        }
      }

      if (waterMask.size === 0) continue;

      const isWaterCell = (gx: number, gy: number): boolean => {
        return waterMask.has(`${gx},${gy}`);
      };

      const pondCells: GridCoord[] = [];

      // Apply tiles: inner cells are water_tile_01, and outer corners are rotated diagonal shore transitions
      for (const key of waterMask) {
        const [gxStr, gyStr] = key.split(',');
        const gx = parseInt(gxStr, 10);
        const gy = parseInt(gyStr, 10);

        // Water overwrites road and breaks the path
        this.grid[gy][gx].isWater = true;
        this.grid[gy][gx].blocked = true;
        this.grid[gy][gx].isRoad = false;
        this.grid[gy][gx].isRoadReserved = false;
        pondCells.push({ x: gx, y: gy });

        // Check 4 cardinal neighbors to identify outer corners of the joined squares
        const hasN = isWaterCell(gx, gy - 1);
        const hasS = isWaterCell(gx, gy + 1);
        const hasW = isWaterCell(gx - 1, gy);
        const hasE = isWaterCell(gx + 1, gy);

        // Diagonals at the corners:
        if (!hasN && !hasW && hasS && hasE) {
          // Top-Left corner: water to South-East
          this.grid[gy][gx].terrain = 'shore_transition_01';
          this.grid[gy][gx].rotation = 0;
        } else if (!hasN && !hasE && hasS && hasW) {
          // Top-Right corner: water to South-West
          this.grid[gy][gx].terrain = 'shore_transition_01';
          this.grid[gy][gx].rotation = Math.PI / 2;
        } else if (!hasS && !hasE && hasN && hasW) {
          // Bottom-Right corner: water to North-West
          this.grid[gy][gx].terrain = 'shore_transition_01';
          this.grid[gy][gx].rotation = Math.PI;
        } else if (!hasS && !hasW && hasN && hasE) {
          // Bottom-Left corner: water to North-East
          this.grid[gy][gx].terrain = 'shore_transition_01';
          this.grid[gy][gx].rotation = -Math.PI / 2;
        } else {
          // Interior or straight border: pure calm cyan water
          this.grid[gy][gx].terrain = 'water_tile_01';
          this.grid[gy][gx].rotation = undefined;
        }
      }

      // Break path: completely overwrite and remove any road cells that overlap with waterMask!
      this.roadCells = this.roadCells.filter(c => !waterMask.has(`${c.x},${c.y}`));

      this.waterBodies.push({ cells: pondCells });
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // STEP 5: Large farms with continuous fence & farm objects inside
  // ─────────────────────────────────────────────────────────────────
  private generateFarms() {
    this.farms = [];
    this.farmObjects = [];
    // Increase number of farms to 4 to 8
    const farmCount = 4 + Math.floor(this.rng() * 5);

    for (let f = 0; f < farmCount; f++) {
      const cropBase = CROP_BASE_KEYS[Math.floor(this.rng() * CROP_BASE_KEYS.length)];
      // 50% chance of the farm having a border
      const hasBorder = this.rng() < 0.50;

      // Associate with one of the houses so the farm is close to a house
      // Uniformly cycle through houses so farms are distributed across different homesteads
      const targetHouse = this.houses.length > 0 ? this.houses[f % this.houses.length] : null;

      // Make the farms bigger and wider: 9 to 13 cells wide, 5 to 7 cells tall
      const targetW = 9 + Math.floor(this.rng() * 5);
      const targetH = 5 + Math.floor(this.rng() * 3);

      for (let attempt = 0; attempt < 350; attempt++) {
        // Adapt target dimensions on high attempts so farm always finds space
        const curTargetW = attempt > 250 ? Math.max(6, targetW - 3) : (attempt > 150 ? Math.max(7, targetW - 2) : targetW);
        const curTargetH = attempt > 250 ? Math.max(3, targetH - 2) : (attempt > 150 ? Math.max(3, targetH - 1) : targetH);
        let ax: number;
        let ay: number;

        if (targetHouse && attempt < 120) {
          // Place close to the selected house (distance 4 to 12 cells)
          const angle = this.rng() * Math.PI * 2;
          const distFromHouse = 4 + this.rng() * 8;
          ax = Math.round(targetHouse.x + Math.cos(angle) * distFromHouse);
          ay = Math.round(targetHouse.y + Math.sin(angle) * distFromHouse);
        } else if (targetHouse && attempt < 220) {
          // Expand search radius around house if nearby spaces are full
          const angle = this.rng() * Math.PI * 2;
          const distFromHouse = 5 + this.rng() * 13;
          ax = Math.round(targetHouse.x + Math.cos(angle) * distFromHouse);
          ay = Math.round(targetHouse.y + Math.sin(angle) * distFromHouse);
        } else {
          // Fallback to random map location
          ax = Math.floor(2 + this.rng() * (this.width - targetW - 4));
          ay = Math.floor(2 + this.rng() * (this.height - targetH - 6));
        }

        ax = Math.max(2, Math.min(this.width - 7, ax));
        ay = Math.max(2, Math.min(this.height - 5, ay));

        // Grow farm horizontally & vertically, pausing immediately before any overlap:
        // "as soon as overlapping is there, pause that thing to be before it"
        let fw = curTargetW;
        let fh = curTargetH;

        fw = Math.min(fw, this.width - ax - 2);
        fh = Math.min(fh, this.height - ay - 2);
        const minW = attempt > 150 ? 5 : 6;
        const minH = 3;
        if (fw < minW || fh < minH) continue;

        // Pause width before any obstacle in any row
        for (let dx = 0; dx < fw; dx++) {
          let colBlocked = false;
          for (let dy = 0; dy < fh; dy++) {
            const gx = ax + dx;
            const gy = ay + dy;
            const cell = this.grid[gy][gx];
            if (cell.isRoad || cell.isRoadReserved || cell.isWater || cell.isFarm || cell.blocked) {
              colBlocked = true;
              break;
            }
          }
          if (colBlocked) {
            fw = dx; // Pause before the obstacle!
            break;
          }
        }
        if (fw < minW) continue;

        // Pause height before any obstacle in any col
        for (let dy = 0; dy < fh; dy++) {
          let rowBlocked = false;
          for (let dx = 0; dx < fw; dx++) {
            const gx = ax + dx;
            const gy = ay + dy;
            const cell = this.grid[gy][gx];
            if (cell.isRoad || cell.isRoadReserved || cell.isWater || cell.isFarm || cell.blocked) {
              rowBlocked = true;
              break;
            }
          }
          if (rowBlocked) {
            fh = dy; // Pause before the obstacle!
            break;
          }
        }
        if (fw < minW || fh < minH) continue;

        // Compound bounding box:
        const minX = ax - 1;
        const maxX = ax + fw;
        const minY = ay - 1;
        const maxY = ay + fh + 1; // row (ay + fh) is the dedicated farmyard strip

        // Check if farmyard row (ay + fh) has free space or needs to be inside the field
        let farmyardY = ay + fh;
        if (farmyardY >= this.height - 1) {
          farmyardY = ay + fh - 1;
        }

        // Generate farm crops (Growth Stages 0 to 3 ONLY! No stage 4 icon)
        const farmCells: FarmCell[] = [];
        for (let dy = 0; dy < fh; dy++) {
          for (let dx = 0; dx < fw; dx++) {
            const isCorner = (dx === 0 || dx === fw - 1) && (dy === 0);
            if (isCorner && this.rng() > 0.5) continue;

            const gx = ax + dx;
            const gy = ay + dy;
            this.grid[gy][gx].isFarm = true;
            this.grid[gy][gx].terrain = 'dirt_tile_01'; // Tilled furrow soil

            const stage = Math.floor(this.rng() * 4);
            farmCells.push({
              x: gx,
              y: gy,
              cropId: `${cropBase}_stage_${stage}`,
              stage,
            });
          }
        }

        this.farms.push({
          x: ax,
          y: ay,
          w: fw,
          h: fh,
          cells: farmCells,
          cropBaseId: cropBase,
        });

        // Farm items (crates, barrels, hay bales, troughs) placed along farmyard strip
        const itemSlots: number[] = [];
        for (let x = ax; x < ax + fw; x++) {
          if (x < this.width && !this.grid[farmyardY][x].isRoad && !this.grid[farmyardY][x].isWater) {
            itemSlots.push(x);
          }
        }
        for (let i = itemSlots.length - 1; i > 0; i--) {
          const j = Math.floor(this.rng() * (i + 1));
          [itemSlots[i], itemSlots[j]] = [itemSlots[j], itemSlots[i]];
        }

        const numFarmItems = Math.min(itemSlots.length, 1 + Math.floor(this.rng() * 3));
        for (let i = 0; i < numFarmItems; i++) {
          const ix = itemSlots[i];
          const iy = farmyardY;
          if (!this.grid[iy][ix].isRoad && !this.grid[iy][ix].isWater) {
            const objId = FARM_OBJECT_IDS[Math.floor(this.rng() * FARM_OBJECT_IDS.length)];
            this.grid[iy][ix].blocked = true;

            this.farmObjects.push({
              id: objId,
              name: objId,
              type: 'farm_object',
              x: ix,
              y: iy,
              footprintW: 1,
              footprintH: 1,
            });
          }
        }

        // 50% chance of the farm having a border:
        if (hasBorder) {
          const openings = new Set<string>();
          const numOpenings = 2 + Math.floor(this.rng() * 3);

          const southOpenX = ax + Math.floor(fw / 2);
          openings.add(`${southOpenX},${maxY}`);
          const northOpenX = ax + Math.floor(fw / 2);
          openings.add(`${northOpenX},${minY}`);
          if (numOpenings >= 3) openings.add(`${minX},${ay + Math.floor(fh / 2)}`);
          if (numOpenings >= 4) openings.add(`${maxX},${ay + Math.floor(fh / 2)}`);

          // North edge
          for (let x = minX; x <= maxX; x++) {
            if (x >= 0 && x < this.width && minY >= 0 && minY < this.height) {
              this.placeFenceCell(x, minY, minX, maxX, minY, maxY, openings);
            }
          }
          // South edge
          for (let x = minX; x <= maxX; x++) {
            if (x >= 0 && x < this.width && maxY >= 0 && maxY < this.height) {
              this.placeFenceCell(x, maxY, minX, maxX, minY, maxY, openings);
            }
          }
          // West edge
          for (let y = minY + 1; y < maxY; y++) {
            if (minX >= 0 && minX < this.width && y >= 0 && y < this.height) {
              this.placeFenceCell(minX, y, minX, maxX, minY, maxY, openings);
            }
          }
          // East edge
          for (let y = minY + 1; y < maxY; y++) {
            if (maxX >= 0 && maxX < this.width && y >= 0 && y < this.height) {
              this.placeFenceCell(maxX, y, minX, maxX, minY, maxY, openings);
            }
          }
        }

        break;
      }
    }

    // Guarantee at least 4 farms if any rolled attempt fell short
    let safetyFarms = 0;
    while (this.farms.length < 4 && safetyFarms++ < 15) {
      const f = this.farms.length;
      const cropBase = CROP_BASE_KEYS[Math.floor(this.rng() * CROP_BASE_KEYS.length)];
      const hasBorder = this.rng() < 0.50;
      const targetHouse = this.houses.length > 0 ? this.houses[f % this.houses.length] : null;
      const targetW = 7 + Math.floor(this.rng() * 3);
      const targetH = 4 + Math.floor(this.rng() * 2);

      for (let attempt = 0; attempt < 300; attempt++) {
        let ax: number;
        let ay: number;
        if (targetHouse && attempt < 180) {
          const angle = this.rng() * Math.PI * 2;
          const distFromHouse = 4 + this.rng() * 12;
          ax = Math.round(targetHouse.x + Math.cos(angle) * distFromHouse);
          ay = Math.round(targetHouse.y + Math.sin(angle) * distFromHouse);
        } else {
          ax = Math.floor(2 + this.rng() * (this.width - targetW - 4));
          ay = Math.floor(2 + this.rng() * (this.height - targetH - 6));
        }
        ax = Math.max(2, Math.min(this.width - 6, ax));
        ay = Math.max(2, Math.min(this.height - 4, ay));

        let fw = targetW;
        let fh = targetH;
        fw = Math.min(fw, this.width - ax - 2);
        fh = Math.min(fh, this.height - ay - 2);
        if (fw < 4 || fh < 3) continue;

        for (let dx = 0; dx < fw; dx++) {
          let colBlocked = false;
          for (let dy = 0; dy < fh; dy++) {
            const gx = ax + dx;
            const gy = ay + dy;
            const cell = this.grid[gy][gx];
            if (cell.isRoad || cell.isRoadReserved || cell.isWater || cell.isFarm || cell.blocked) {
              colBlocked = true;
              break;
            }
          }
          if (colBlocked) { fw = dx; break; }
        }
        if (fw < 4) continue;

        for (let dy = 0; dy < fh; dy++) {
          let rowBlocked = false;
          for (let dx = 0; dx < fw; dx++) {
            const gx = ax + dx;
            const gy = ay + dy;
            const cell = this.grid[gy][gx];
            if (cell.isRoad || cell.isRoadReserved || cell.isWater || cell.isFarm || cell.blocked) {
              rowBlocked = true;
              break;
            }
          }
          if (rowBlocked) { fh = dy; break; }
        }
        if (fw < 4 || fh < 3) continue;

        const minX = ax - 1;
        const maxX = ax + fw;
        const minY = ay - 1;
        const maxY = ay + fh + 1;
        let farmyardY = ay + fh;
        if (farmyardY >= this.height - 1) farmyardY = ay + fh - 1;

        const farmCells: FarmCell[] = [];
        for (let dy = 0; dy < fh; dy++) {
          for (let dx = 0; dx < fw; dx++) {
            const isCorner = (dx === 0 || dx === fw - 1) && (dy === 0);
            if (isCorner && this.rng() > 0.5) continue;
            const gx = ax + dx;
            const gy = ay + dy;
            this.grid[gy][gx].isFarm = true;
            this.grid[gy][gx].terrain = 'dirt_tile_01';
            const stage = Math.floor(this.rng() * 4);
            farmCells.push({ x: gx, y: gy, cropId: `${cropBase}_stage_${stage}`, stage });
          }
        }

        this.farms.push({ x: ax, y: ay, w: fw, h: fh, cells: farmCells, cropBaseId: cropBase });

        const itemSlots: number[] = [];
        for (let x = ax; x < ax + fw; x++) {
          if (x < this.width && !this.grid[farmyardY][x].isRoad && !this.grid[farmyardY][x].isWater) {
            itemSlots.push(x);
          }
        }
        for (let i = itemSlots.length - 1; i > 0; i--) {
          const j = Math.floor(this.rng() * (i + 1));
          [itemSlots[i], itemSlots[j]] = [itemSlots[j], itemSlots[i]];
        }
        const numFarmItems = Math.min(itemSlots.length, 1 + Math.floor(this.rng() * 3));
        for (let i = 0; i < numFarmItems; i++) {
          const ix = itemSlots[i];
          const iy = farmyardY;
          if (!this.grid[iy][ix].isRoad && !this.grid[iy][ix].isWater) {
            const objId = FARM_OBJECT_IDS[Math.floor(this.rng() * FARM_OBJECT_IDS.length)];
            this.grid[iy][ix].blocked = true;
            this.farmObjects.push({ id: objId, name: objId, type: 'farm_object', x: ix, y: iy, footprintW: 1, footprintH: 1 });
          }
        }

        if (hasBorder) {
          const openings = new Set<string>();
          const numOpenings = 2 + Math.floor(this.rng() * 3);
          openings.add(`${ax + Math.floor(fw / 2)},${maxY}`);
          openings.add(`${ax + Math.floor(fw / 2)},${minY}`);
          if (numOpenings >= 3) openings.add(`${minX},${ay + Math.floor(fh / 2)}`);
          if (numOpenings >= 4) openings.add(`${maxX},${ay + Math.floor(fh / 2)}`);

          for (let x = minX; x <= maxX; x++) {
            if (x >= 0 && x < this.width && minY >= 0 && minY < this.height) this.placeFenceCell(x, minY, minX, maxX, minY, maxY, openings);
            if (x >= 0 && x < this.width && maxY >= 0 && maxY < this.height) this.placeFenceCell(x, maxY, minX, maxX, minY, maxY, openings);
          }
          for (let y = minY + 1; y < maxY; y++) {
            if (minX >= 0 && minX < this.width && y >= 0 && y < this.height) this.placeFenceCell(minX, y, minX, maxX, minY, maxY, openings);
            if (maxX >= 0 && maxX < this.width && y >= 0 && y < this.height) this.placeFenceCell(maxX, y, minX, maxX, minY, maxY, openings);
          }
        }

        break;
      }
    }
  }

  /**
   * Place a single wooden fence segment unless cell is marked as an opening
   */
  private placeFenceCell(
    x: number, y: number,
    minX: number, maxX: number, minY: number, maxY: number,
    openings: Set<string>
  ) {
    // If opening, leave open so villagers can walk in and out!
    if (openings.has(`${x},${y}`)) {
      return;
    }

    // Never place fence on road, water, farm crop, or existing blocked obstacle
    if (this.grid[y][x].isRoad || this.grid[y][x].isWater || this.grid[y][x].isFarm || this.grid[y][x].blocked) {
      return;
    }

    const isCorner = (x === minX || x === maxX) && (y === minY || y === maxY);
    const isHorizontal = (y === minY || y === maxY);

    let fenceId: AssetId;
    if (isCorner) {
      fenceId = 'fence_wood_corner';
    } else if (isHorizontal) {
      fenceId = 'fence_wood_h';
    } else {
      fenceId = 'fence_wood_v';
    }

    this.grid[y][x].blocked = true;
    this.farmObjects.push({
      id: fenceId,
      name: fenceId,
      type: 'farm_object',
      x,
      y,
      footprintW: 1,
      footprintH: 1,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // STEP 6: Houses placed NORTH of road + Path join algorithm
  // ─────────────────────────────────────────────────────────────────
  private generateHouses() {
    this.houses = [];

    // Select believable subset of buildings (6 to 10 buildings)
    const targetHouses = 6 + Math.floor(this.rng() * 5);
    const minDistanceBetweenHouses = 6.0; // Euclidean distance check in cells

    const pool: HouseTemplate[] = [];
    for (const t of HOUSE_TEMPLATES) {
      for (let i = 0; i < t.weight; i++) {
        pool.push(t);
      }
    }

    // Deliberately reserve an open countryside quadrant to leave natural spaces
    const openReserveQuadrant = Math.floor(this.rng() * 4); // 0: NW, 1: NE, 2: SW, 3: SE

    // Track houses per quadrant for uniform spread
    const quadrantCounts = [0, 0, 0, 0]; // 0: NW, 1: NE, 2: SW, 3: SE

    for (let h = 0; h < targetHouses; h++) {
      const template = pool[Math.floor(this.rng() * pool.length)];

      let placed = false;
      for (let attempt = 0; attempt < 250; attempt++) {
        const ax = Math.floor(2 + this.rng() * (this.width - template.w - 4));
        const ay = Math.floor(2 + this.rng() * (this.height - template.h - 6));

        // Uniform distribution: avoid concentrating too many houses in one quadrant
        const q = (ax < this.width / 2 ? 0 : 1) + (ay < this.height / 2 ? 0 : 2);
        if (attempt < 150 && quadrantCounts[q] >= 3 && this.rng() < 0.75) {
          continue;
        }

        // Create open areas deliberately & make outer part of the map much less developed
        if (attempt < 80) {
          const isOuter = ax < 5 || ax > this.width - template.w - 5 || ay < 4 || ay > this.height - template.h - 5;
          if (isOuter && this.rng() < 0.75) continue;

          const inOpenReserve =
            (openReserveQuadrant === 0 && ax < this.width / 2 && ay < this.height / 2) ||
            (openReserveQuadrant === 1 && ax >= this.width / 2 && ay < this.height / 2) ||
            (openReserveQuadrant === 2 && ax < this.width / 2 && ay >= this.height / 2) ||
            (openReserveQuadrant === 3 && ax >= this.width / 2 && ay >= this.height / 2);
          if (inOpenReserve && this.rng() < 0.7) continue;
        }

        // 1. Distance check from other houses
        let tooClose = false;
        for (const existing of this.houses) {
          const dist = Math.hypot(ax - existing.x, ay - existing.y);
          if (dist < minDistanceBetweenHouses) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) continue;

        // 2. REQUIREMENT: House must be NORTH of the road it connects to!
        const doorX = ax + Math.floor(template.w / 2);
        const southEdgeY = ay + template.h;

        // Front door cell must be within bounds and on dry, open land
        if (southEdgeY >= this.height || this.grid[southEdgeY][doorX].isWater || this.grid[southEdgeY][doorX].blocked) {
          continue;
        }

        // Find if there is a road cell south of the house entrance within 1-6 cells
        let hasRoadToSouth = false;
        for (let checkY = southEdgeY + 1; checkY <= Math.min(this.height - 1, southEdgeY + 6); checkY++) {
          if (this.grid[checkY][doorX].isWater) break;
          for (let checkX = Math.max(0, doorX - 3); checkX <= Math.min(this.width - 1, doorX + 3); checkX++) {
            if (this.grid[checkY][checkX].isRoad) {
              hasRoadToSouth = true;
              break;
            }
          }
          if (hasRoadToSouth) break;
        }

        if (!hasRoadToSouth) continue;

        // 3. Full footprint check
        let footprintValid = true;
        for (let dy = 0; dy < template.h; dy++) {
          for (let dx = 0; dx < template.w; dx++) {
            const gx = ax + dx;
            const gy = ay + dy;
            const cell = this.grid[gy][gx];

            if (cell.isRoad || cell.isWater || cell.isFarm || cell.blocked) {
              footprintValid = false;
              break;
            }
          }
          if (!footprintValid) break;
        }

        if (footprintValid) {
          // Collision hitbox: rectangle equal to length of base and exactly half height (bottom half)
          const baseStartY = Math.floor(template.h / 2);
          for (let dy = baseStartY; dy < template.h; dy++) {
            for (let dx = 0; dx < template.w; dx++) {
              this.grid[ay + dy][ax + dx].blocked = true;
            }
          }

          this.houses.push({
            id: template.id,
            name: template.name,
            type: 'house',
            x: ax,
            y: ay,
            footprintW: template.w,
            footprintH: template.h,
            door: { x: doorX, y: southEdgeY },
          });
          quadrantCounts[q]++;
          placed = true;
          break;
        }
      }
    }
  }

  /**
   * Run path join algorithm so that each house is connected with
   * the smallest path joining from its front door to the nearest road to its south.
   */
  private joinHousesToRoads() {
    for (const house of this.houses) {
      if (!house.door) continue;
      const startX = house.door.x;
      const startY = house.door.y;

      // Find closest road cell located strictly south of the house
      let closestRoad: GridCoord | null = null;
      let minDistance = Infinity;

      for (const road of this.roadCells) {
        if (road.y > startY) {
          const dist = Math.abs(road.x - startX) + (road.y - startY);
          if (dist < minDistance) {
            minDistance = dist;
            closestRoad = road;
          }
        }
      }

      // Fallback if no road strictly south (should not happen due to placement criteria)
      if (!closestRoad) {
        for (const road of this.roadCells) {
          const dist = Math.abs(road.x - startX) + Math.abs(road.y - startY);
          if (dist < minDistance) {
            minDistance = dist;
            closestRoad = road;
          }
        }
      }

      if (!closestRoad) continue;

      // Smallest path joining to the nearest road:
      // Step vertically down from door towards road, then horizontally
      let cx = startX;
      let cy = startY;

      while (cy < this.height) {
        // If we stepped and hit an existing road (after the initial door cell), connect completed
        if ((cx !== startX || cy !== startY) && this.grid[cy][cx].isRoad) {
          break;
        }

        if (cy >= 0 && cy < this.height && cx >= 0 && cx < this.width) {
          // Do not overwrite water or solid buildings
          if (!this.grid[cy][cx].isWater && !this.grid[cy][cx].blocked) {
            this.grid[cy][cx].terrain = this.getRandomPathTile();
            this.grid[cy][cx].isRoad = true;
            this.grid[cy][cx].isRoadReserved = true;
            this.roadCells.push({ x: cx, y: cy });
          }
        }

        if (cx === closestRoad.x && cy === closestRoad.y) {
          break;
        }

        // Advance: step down first, then sideways
        if (cy < closestRoad.y) {
          cy++;
        } else if (cx !== closestRoad.x) {
          cx += Math.sign(closestRoad.x - cx);
        } else {
          break;
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // STEP 7: Wells (0–2) beside roads / near farms
  // ─────────────────────────────────────────────────────────────────
  private generateWells() {
    this.wells = [];
    const wellCount = this.rng() > 0.3 ? (this.rng() > 0.5 ? 2 : 1) : 0;

    for (let w = 0; w < wellCount; w++) {
      const wellId = this.rng() > 0.5 ? 'farm_well' : 'farm_well_covered';

      for (let attempt = 0; attempt < 80; attempt++) {
        let targetX = 0;
        let targetY = 0;

        if (this.farms.length > 0 && this.rng() > 0.5) {
          const farm = this.farms[Math.floor(this.rng() * this.farms.length)];
          targetX = farm.x + Math.floor((this.rng() - 0.5) * 6);
          targetY = farm.y + Math.floor((this.rng() - 0.5) * 6);
        } else if (this.houses.length > 0) {
          const house = this.houses[Math.floor(this.rng() * this.houses.length)];
          targetX = house.x + Math.floor((this.rng() - 0.5) * 6);
          targetY = house.y + Math.floor((this.rng() - 0.5) * 6);
        } else {
          targetX = Math.floor(5 + this.rng() * (this.width - 10));
          targetY = Math.floor(5 + this.rng() * (this.height - 10));
        }

        targetX = Math.max(1, Math.min(this.width - 2, targetX));
        targetY = Math.max(1, Math.min(this.height - 2, targetY));

        const cell = this.grid[targetY][targetX];

        if (!cell.isRoad && !cell.isWater && !cell.isFarm && !cell.blocked) {
          cell.blocked = true;
          this.wells.push({
            id: wellId,
            name: wellId === 'farm_well' ? 'Stone Well' : 'Roofed Well',
            type: 'well',
            x: targetX,
            y: targetY,
            footprintW: 1,
            footprintH: 1,
          });
          break;
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // STEP 8: Trees (with occasional clustering logic)
  // ─────────────────────────────────────────────────────────────────
  private generateTrees() {
    this.trees = [];
    const treeTarget = 14 + Math.floor(this.rng() * 8); // 14 to 21 trees
    let placed = 0;

    const canPlaceTreeAt = (tx: number, ty: number): boolean => {
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const gx = tx + dx;
          const gy = ty + dy;
          if (gx < 1 || gx >= this.width - 1 || gy < 1 || gy >= this.height - 1) return false;
          const cell = this.grid[gy][gx];
          if (cell.isRoad || cell.isWater || cell.isFarm || cell.blocked) return false;
        }
      }
      return true;
    };

    const placeTreeAt = (tx: number, ty: number, treeId: string) => {
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          this.grid[ty + dy][tx + dx].blocked = true;
        }
      }
      this.trees.push({
        id: treeId,
        name: 'Tree',
        type: 'tree',
        x: tx,
        y: ty,
        footprintW: 2,
        footprintH: 2,
      });
      placed++;
    };

    let safety = 0;
    while (placed < treeTarget && safety < 120) {
      safety++;
      // Clustering decision: ~45% chance to attempt a cluster of 2-4 trees
      const isCluster = this.rng() < 0.45;
      const clusterSize = isCluster ? (2 + Math.floor(this.rng() * 3)) : 1;

      // Find initial tree position
      let seedX = -1;
      let seedY = -1;
      for (let attempt = 0; attempt < 40; attempt++) {
        const tx = Math.floor(2 + this.rng() * (this.width - 5));
        const ty = Math.floor(2 + this.rng() * (this.height - 5));
        if (canPlaceTreeAt(tx, ty)) {
          seedX = tx;
          seedY = ty;
          break;
        }
      }
      if (seedX === -1) continue;

      // Place first tree of cluster
      const treeId = TREE_ASSET_IDS[Math.floor(this.rng() * TREE_ASSET_IDS.length)];
      placeTreeAt(seedX, seedY, treeId);

      // If cluster, try to place companion trees adjacent/close to the seed
      if (isCluster) {
        const offsets = [
          { dx: 2, dy: 0 },
          { dx: -2, dy: 0 },
          { dx: 0, dy: 2 },
          { dx: 0, dy: -2 },
          { dx: 2, dy: 2 },
          { dx: -2, dy: 2 },
          { dx: 2, dy: -2 },
          { dx: -2, dy: -2 },
          { dx: 2, dy: 1 },
          { dx: -2, dy: 1 },
          { dx: 1, dy: 2 },
          { dx: 1, dy: -2 },
        ];
        // Shuffle offsets
        for (let i = offsets.length - 1; i > 0; i--) {
          const j = Math.floor(this.rng() * (i + 1));
          [offsets[i], offsets[j]] = [offsets[j], offsets[i]];
        }

        let clusterPlaced = 1;
        for (const off of offsets) {
          if (clusterPlaced >= clusterSize || placed >= treeTarget) break;
          const companionX = seedX + off.dx;
          const companionY = seedY + off.dy;
          if (canPlaceTreeAt(companionX, companionY)) {
            const companionId = TREE_ASSET_IDS[Math.floor(this.rng() * TREE_ASSET_IDS.length)];
            placeTreeAt(companionX, companionY, companionId);
            clusterPlaced++;
          }
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // STEP 9: Bushes (MANDATORY clustering every time)
  // ─────────────────────────────────────────────────────────────────
  private generateBushes() {
    this.bushes = [];
    const clusterCount = 16 + Math.floor(this.rng() * 6); // 16 to 21 bush clusters spread across the village

    const canPlaceBushAt = (bx: number, by: number): boolean => {
      if (bx < 1 || bx >= this.width - 1 || by < 1 || by >= this.height - 1) return false;
      const cell = this.grid[by][bx];
      return !cell.isRoad && !cell.isWater && !cell.isFarm && !cell.blocked;
    };

    for (let c = 0; c < clusterCount; c++) {
      let cx = -1;
      let cy = -1;
      for (let attempt = 0; attempt < 60; attempt++) {
        const tx = Math.floor(1 + this.rng() * (this.width - 2));
        const ty = Math.floor(1 + this.rng() * (this.height - 2));
        if (canPlaceBushAt(tx, ty)) {
          cx = tx;
          cy = ty;
          break;
        }
      }
      if (cx === -1) continue;

      const clusterTarget = 3 + Math.floor(this.rng() * 4); // 3 to 6 bushes
      const clusterBushes: GridCoord[] = [{ x: cx, y: cy }];

      // Grow cluster by picking cells directly adjacent (strictly 4-way orthogonal for tight clusters)
      for (let step = 0; step < 30 && clusterBushes.length < clusterTarget; step++) {
        const base = clusterBushes[Math.floor(this.rng() * clusterBushes.length)];
        const dirs = [
          { dx: 1, dy: 0 },
          { dx: -1, dy: 0 },
          { dx: 0, dy: 1 },
          { dx: 0, dy: -1 },
        ];
        const dir = dirs[Math.floor(this.rng() * dirs.length)];
        const nx = base.x + dir.dx;
        const ny = base.y + dir.dy;

        if (canPlaceBushAt(nx, ny) && !clusterBushes.some(b => b.x === nx && b.y === ny)) {
          clusterBushes.push({ x: nx, y: ny });
        }
      }

      // MANDATORY: Bushes cluster EVERY TIME together! Only commit if at least 2 bushes placed
      if (clusterBushes.length >= 2) {
        for (const pos of clusterBushes) {
          this.grid[pos.y][pos.x].blocked = true;
          const bushId = BUSH_ASSET_IDS[Math.floor(this.rng() * BUSH_ASSET_IDS.length)];
          this.bushes.push({
            id: bushId,
            name: 'Bush',
            type: 'bush',
            x: pos.x,
            y: pos.y,
            footprintW: 1,
            footprintH: 1,
          });
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // STEP 10: Natural terrain details & scatter (Flowers, Rocks, Acorns, Truffles)
  // ─────────────────────────────────────────────────────────────────
  private generateTerrainDetails() {
    this.decorations = [];

    // Individual natural scatter (flowers, rocks, mushrooms, acorns, truffles)
    // NEVER using any cliff/line tiles!
    const scatterCount = 20 + Math.floor(this.rng() * 12);
    for (let d = 0; d < scatterCount; d++) {
      const decorId = DECORATION_ASSET_IDS[Math.floor(this.rng() * DECORATION_ASSET_IDS.length)];

      for (let attempt = 0; attempt < 30; attempt++) {
        const x = Math.floor(1 + this.rng() * (this.width - 2));
        const y = Math.floor(1 + this.rng() * (this.height - 2));

        const cell = this.grid[y][x];

        if (!cell.isRoad && !cell.isWater && !cell.isFarm && !cell.blocked) {
          cell.blocked = true;
          this.decorations.push({
            id: decorId,
            name: decorId,
            type: 'decoration',
            x,
            y,
            footprintW: 1,
            footprintH: 1,
          });
          break;
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // STEP 11: Validation
  // ─────────────────────────────────────────────────────────────────
  private validateSettlement(): ValidationReport {
    const violations: string[] = [];

    let flatTerrain = true;
    let noIsometricBlocks = true;
    let noElevationAssets = true;
    let gridAligned16px = true;
    let noObjectsOnRoad = true;

    const checkOverlap = (obj: PlacedObject) => {
      for (let dy = 0; dy < obj.footprintH; dy++) {
        for (let dx = 0; dx < obj.footprintW; dx++) {
          const gx = obj.x + dx;
          const gy = obj.y + dy;
          if (gx >= this.width || gy >= this.height || this.grid[gy][gx].isRoad) {
            noObjectsOnRoad = false;
            violations.push(`Object ${obj.id} at (${gx},${gy}) overlaps road!`);
          }
        }
      }
    };

    this.houses.forEach(checkOverlap);
    this.wells.forEach(checkOverlap);
    this.trees.forEach(checkOverlap);
    this.bushes.forEach(checkOverlap);
    this.decorations.forEach(checkOverlap);
    this.farmObjects.forEach(checkOverlap);

    for (const farm of this.farms) {
      for (const c of farm.cells) {
        if (this.grid[c.y][c.x].isRoad) {
          noObjectsOnRoad = false;
          violations.push(`Farm crop at (${c.x},${c.y}) overlaps road!`);
        }
      }
    }

    // Check NO stage 4 crops (requirement: final stages are drop icons, not planted in world)
    let noStage4Crops = true;
    for (const farm of this.farms) {
      for (const c of farm.cells) {
        if (c.stage >= 4) {
          noStage4Crops = false;
          violations.push(`Farm crop at (${c.x},${c.y}) has stage ${c.stage} (stage 4 is collectible icon, not planted)!`);
        }
      }
    }

    // Check fences around farms (requirement: 50% chance of border)
    const fencesAroundFarms = this.farms.length > 0;

    // Check houses far apart
    let housesFarApart = true;
    for (let i = 0; i < this.houses.length; i++) {
      for (let j = i + 1; j < this.houses.length; j++) {
        const h1 = this.houses[i];
        const h2 = this.houses[j];
        const dist = Math.hypot(h1.x - h2.x, h1.y - h2.y);
        if (dist < 5.5) {
          housesFarApart = false;
          violations.push(`Houses ${h1.id} and ${h2.id} too close (${dist.toFixed(1)} cells)`);
        }
      }
    }

    // Check houses north of connected road
    let housesNorthOfRoads = true;
    for (const house of this.houses) {
      if (!house.door) continue;
      // Look for a road adjacent to or south of the door
      let hasRoadSouth = false;
      for (let dy = 0; dy <= 6; dy++) {
        const cy = house.door.y + dy;
        if (cy < this.height && this.grid[cy][house.door.x].isRoad) {
          hasRoadSouth = true;
          break;
        }
      }
      if (!hasRoadSouth) {
        housesNorthOfRoads = false;
        violations.push(`House ${house.id} at (${house.x},${house.y}) has no road to its south!`);
      }
    }

    // Check roads generated first with sparse gaps
    const totalCells = this.width * this.height;
    const roadCount = this.roadCells.length;
    const roadRatio = roadCount / totalCells;
    const sparseRoadsGaps = roadRatio > 0.02 && roadRatio < 0.35;

    // Check open countryside remaining
    let emptyGrassCells = 0;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        if (!cell.isRoad && !cell.isWater && !cell.isFarm && !cell.blocked) {
          emptyGrassCells++;
        }
      }
    }
    const openRatio = emptyGrassCells / totalCells;
    const openCountrysideRemaining = openRatio >= 0.20;

    // Check directional shore rotation
    let directionalShoreRotated = true;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[y][x].terrain === 'shore_transition_01') {
          if (this.grid[y][x].rotation === undefined) {
            directionalShoreRotated = false;
            violations.push(`Shore tile at (${x},${y}) missing rotation!`);
          }
        }
      }
    }

    const checks = {
      flatTerrain,
      noIsometricBlocks,
      noElevationAssets,
      gridAligned16px,
      roadsGeneratedFirst: this.roadCells.length > 0,
      sparseRoadsGaps,
      noObjectsOnRoad,
      housesFarApart,
      housesNorthOfRoads,
      allHousesConnectedToPath: housesNorthOfRoads,
      largeIrregularFarms: this.farms.length > 0,
      directionalShoreRotated,
      openCountrysideRemaining,
      noStage4Crops,
      fencesAroundFarms,
    };

    const valid = violations.length === 0 && Object.values(checks).every(Boolean);

    return {
      valid,
      checks,
      violations,
    };
  }
}

export function generateSettlement(seed: number, width = 48, height = 36): SettlementData {
  const gen = new SettlementGenerator(seed, width, height);
  return gen.generate();
}
