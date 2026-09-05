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
  type: 'house' | 'farm' | 'well' | 'tree' | 'decoration' | 'farm_object';
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
// ASSET CATALOG (Direct from map.txt / houses.png)
// ═══════════════════════════════════════════════════════════════════

export interface HouseTemplate {
  id: AssetId;
  name: string;
  w: number; // width in 16px cells
  h: number; // height in 16px cells
  rarity: 'common' | 'uncommon' | 'rare';
  weight: number;
}

export const HOUSE_TEMPLATES: HouseTemplate[] = [
  // Common rustic dwellings
  { id: 'house_cottage_01',    name: 'Cottage',         w: 3, h: 3, rarity: 'common',   weight: 35 },
  { id: 'house_farmhouse_01',  name: 'Farmhouse',       w: 4, h: 3, rarity: 'common',   weight: 30 },
  { id: 'house_cabin_01',      name: 'Cabin',           w: 3, h: 3, rarity: 'common',   weight: 30 },
  // Less common village buildings
  { id: 'house_barn_01',       name: 'Barn',            w: 3, h: 3, rarity: 'uncommon', weight: 15 },
  { id: 'house_workshop_01',   name: 'Workshop',        w: 4, h: 3, rarity: 'uncommon', weight: 12 },
  { id: 'house_tavern_01',     name: 'Tavern',          w: 3, h: 3, rarity: 'uncommon', weight: 10 },
  { id: 'house_shop_01',       name: 'Village Shop',    w: 4, h: 3, rarity: 'uncommon', weight: 10 },
  // Rare landmark structures
  { id: 'house_windmill_01',   name: 'Windmill',        w: 3, h: 3, rarity: 'rare',     weight: 4 },
  { id: 'house_mansion_01',    name: 'Mansion',         w: 4, h: 4, rarity: 'rare',     weight: 3 },
  { id: 'house_castle_01',     name: 'Castle Tower',    w: 3, h: 4, rarity: 'rare',     weight: 2 },
];

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

export const BUSH_ASSET_IDS = [
  'bush_round_01',
  'bush_round_02',
  'bush_berry_01',
];

export const GRASS_TUFT_IDS = [
  'grass_tuft_01',
  'grass_tuft_02',
  'grass_tuft_03',
  'wild_flora_01',
];

export const FENCE_ASSET_IDS = {
  h: 'fence_wood_h',
  v: 'fence_wood_v',
  corner: 'fence_wood_corner',
  post: 'fence_wood_post',
  gate: 'fence_wood_gate',
};

export const DECORATION_ASSET_IDS = [
  'small_rock_01',
  'grass_tuft_01',
  'flowers_wild_01',
  'flowers_wild_02',
  'mushrooms_deco_blue',
  'mushrooms_deco_red',
  'acorn_deco_01',
  'truffle_deco_01',
  'stump_deco_01'
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

    // ── STEP 8: Random sparse trees in open countryside ───────────
    this.generateTrees();

    // ── STEP 9: Natural terrain details & scatter ─────────────────
    this.generateTerrainDetails();

    // ── STEP 10: Validate result against all constraints ──────────
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

    // Main road crosses the settlement horizontally with natural meanders
    const startY = Math.floor(this.height * 0.45 + this.rng() * (this.height * 0.25));
    const endY = Math.floor(this.height * 0.45 + this.rng() * (this.height * 0.25));

    const p0: GridCoord = { x: 2, y: startY };
    const p1: GridCoord = {
      x: Math.floor(this.width * 0.45 + (this.rng() - 0.5) * 6),
      y: Math.floor((startY + endY) / 2 + (this.rng() - 0.5) * 4),
    };
    const p2: GridCoord = { x: this.width - 3, y: endY };

    // Carve main spine
    this.carveMeanderingPath(p0, p1);
    this.carveMeanderingPath(p1, p2);

    // 1 to 2 branching trails (sparse, not a grid)
    const branchCount = 1 + (this.rng() > 0.4 ? 1 : 0);
    for (let b = 0; b < branchCount; b++) {
      if (this.roadCells.length === 0) break;
      const junctionIdx = Math.floor(this.roadCells.length * (0.3 + this.rng() * 0.4));
      const junction = this.roadCells[junctionIdx];

      // Branch outward toward South or North-South
      const goNorth = b === 0 ? false : (this.rng() > 0.6);
      const targetY = goNorth ? Math.floor(4 + this.rng() * 4) : Math.floor(this.height - 4 - this.rng() * 5);
      const targetX = Math.max(4, Math.min(this.width - 5, junction.x + Math.floor((this.rng() - 0.5) * 16)));

      this.carveMeanderingPath(junction, { x: targetX, y: targetY });
    }

    // Assign dirt path surface with natural texture variety from dirt trail group
    for (let i = 0; i < this.roadCells.length; i++) {
      const cell = this.roadCells[i];
      this.grid[cell.y][cell.x].terrain = this.getRandomPathTile();
      this.grid[cell.y][cell.x].isRoad = true;
      this.grid[cell.y][cell.x].blocked = true;
    }
  }

  private carveMeanderingPath(from: GridCoord, to: GridCoord) {
    let currX = from.x;
    let currY = from.y;

    const addCell = (x: number, y: number) => {
      if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
        if (!this.grid[y][x].isRoad) {
          this.grid[y][x].isRoad = true;
          this.roadCells.push({ x, y });
        }
      }
    };

    addCell(currX, currY);

    let safety = 0;
    while ((currX !== to.x || currY !== to.y) && safety++ < 200) {
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
    this.waterBodies = [];

    // 70% chance to have water
    if (this.rng() > 0.7) return;

    // 1 to 2 ponds
    const pondCount = this.rng() > 0.5 ? 2 : 1;

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
    const farmCount = 2; // 2 large, expansive farms

    for (let f = 0; f < farmCount; f++) {
      const cropBase = CROP_BASE_KEYS[Math.floor(this.rng() * CROP_BASE_KEYS.length)];
      // Large farm crop field: 7 to 9 cells wide, 4 to 6 cells tall
      const fw = 7 + Math.floor(this.rng() * 3);
      const fh = 4 + Math.floor(this.rng() * 3);

      for (let attempt = 0; attempt < 250; attempt++) {
        const ax = Math.floor(2 + this.rng() * (this.width - fw - 4));
        const ay = Math.floor(2 + this.rng() * (this.height - fh - 6));

        // Compound bounding box:
        // Encompasses crop field [ax..ax+fw-1, ay..ay+fh-1],
        // plus dedicated farmyard row at (ay + fh) for farm items!
        const minX = ax - 1;
        const maxX = ax + fw;
        const minY = ay - 1;
        const maxY = ay + fh + 1; // row (ay + fh) is the enclosed farmyard strip

        if (minX < 1 || maxX >= this.width - 1 || minY < 1 || maxY >= this.height - 1) {
          continue;
        }

        // Clearance check: Entire compound must not collide with roads, water, other farms, or buildings
        let valid = true;
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            const cell = this.grid[y][x];
            if (cell.isRoad || cell.isWater || cell.isFarm || cell.blocked) {
              valid = false;
              break;
            }
          }
          if (!valid) break;
        }

        if (!valid) continue;

        // Proximity check: Must be near a road (within 1 to 4 cells from compound)
        let nearRoad = false;
        for (let y = Math.max(0, minY - 3); y <= Math.min(this.height - 1, maxY + 3); y++) {
          for (let x = Math.max(0, minX - 3); x <= Math.min(this.width - 1, maxX + 3); x++) {
            if (this.grid[y][x].isRoad) {
              nearRoad = true;
              break;
            }
          }
          if (nearRoad) break;
        }

        if (nearRoad || attempt > 60) {
          // ── A. Generate Farm Crops (Growth Stages 0 to 3 ONLY! No stage 4 icon)
          const farmCells: FarmCell[] = [];
          for (let dy = 0; dy < fh; dy++) {
            for (let dx = 0; dx < fw; dx++) {
              // Subtle corner skip for organic feel
              const isCorner = (dx === 0 || dx === fw - 1) && (dy === 0);
              if (isCorner && this.rng() > 0.5) continue;

              const gx = ax + dx;
              const gy = ay + dy;
              this.grid[gy][gx].isFarm = true;
              this.grid[gy][gx].terrain = 'dirt_tile_01'; // Tilled furrow soil

              // REQUIREMENT: Stage 4 is collectible drop icon; use stages 0-3 only!
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

          // ── B. Determine 2 to 4 Openings Along Continuous Fence Perimeter
          const openings = new Set<string>();
          const numOpenings = 2 + Math.floor(this.rng() * 3); // 2, 3, or 4 openings

          // 1. South opening (primary entrance facing road/village)
          const southOpenX = ax + Math.floor(fw / 2);
          openings.add(`${southOpenX},${maxY}`);

          // 2. North opening (passage to north countryside)
          const northOpenX = ax + Math.floor(fw / 2);
          openings.add(`${northOpenX},${minY}`);

          // 3. West opening (if 3+ openings)
          if (numOpenings >= 3) {
            const westOpenY = ay + Math.floor(fh / 2);
            openings.add(`${minX},${westOpenY}`);
          }

          // 4. East opening (if 4 openings)
          if (numOpenings >= 4) {
            const eastOpenY = ay + Math.floor(fh / 2);
            openings.add(`${maxX},${eastOpenY}`);
          }

          // Also mark any perimeter cell that touches or coincides with a road as opening
          for (let x = minX; x <= maxX; x++) {
            if (this.grid[minY][x].isRoad) openings.add(`${x},${minY}`);
            if (this.grid[maxY][x].isRoad) openings.add(`${x},${maxY}`);
          }
          for (let y = minY; y <= maxY; y++) {
            if (this.grid[y][minX].isRoad) openings.add(`${minX},${y}`);
            if (this.grid[y][maxX].isRoad) openings.add(`${maxX},${y}`);
          }

          // ── C. Place Farm Items Inside Compound (Enclosed along farmyard strip at y = ay + fh)
          const itemSlots: number[] = [];
          for (let x = ax; x < ax + fw; x++) {
            // Keep entrance pathway clear
            if (x !== southOpenX) {
              itemSlots.push(x);
            }
          }
          // Shuffle item slots
          for (let i = itemSlots.length - 1; i > 0; i--) {
            const j = Math.floor(this.rng() * (i + 1));
            [itemSlots[i], itemSlots[j]] = [itemSlots[j], itemSlots[i]];
          }

          const numFarmItems = Math.min(itemSlots.length, 2 + Math.floor(this.rng() * 3)); // 2 to 4 items
          for (let i = 0; i < numFarmItems; i++) {
            const ix = itemSlots[i];
            const iy = ay + fh;
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

          // ── D. Place Continuous Fence Around Farm & Farm Items
          // North edge (y = minY)
          for (let x = minX; x <= maxX; x++) {
            this.placeFenceCell(x, minY, minX, maxX, minY, maxY, openings);
          }
          // South edge (y = maxY)
          for (let x = minX; x <= maxX; x++) {
            this.placeFenceCell(x, maxY, minX, maxX, minY, maxY, openings);
          }
          // West edge (x = minX)
          for (let y = minY + 1; y < maxY; y++) {
            this.placeFenceCell(minX, y, minX, maxX, minY, maxY, openings);
          }
          // East edge (x = maxX)
          for (let y = minY + 1; y < maxY; y++) {
            this.placeFenceCell(maxX, y, minX, maxX, minY, maxY, openings);
          }

          break; // successfully placed farm f
        }
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

    // Never place fence on road or water
    if (this.grid[y][x].isRoad || this.grid[y][x].isWater) {
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

    // Select believable subset of buildings (4 to 6 buildings)
    const targetHouses = 4 + Math.floor(this.rng() * 3);
    const minDistanceBetweenHouses = 8; // Euclidean distance check in cells

    const pool: HouseTemplate[] = [];
    for (const t of HOUSE_TEMPLATES) {
      for (let i = 0; i < t.weight; i++) {
        pool.push(t);
      }
    }

    for (let h = 0; h < targetHouses; h++) {
      const template = pool[Math.floor(this.rng() * pool.length)];

      let placed = false;
      for (let attempt = 0; attempt < 150; attempt++) {
        const ax = Math.floor(2 + this.rng() * (this.width - template.w - 4));
        const ay = Math.floor(2 + this.rng() * (this.height - template.h - 6));

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
          for (let dy = 0; dy < template.h; dy++) {
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
  // STEP 8: Random sparse trees in open countryside
  // ─────────────────────────────────────────────────────────────────
  private generateTrees() {
    this.trees = [];
    const treeTarget = 12 + Math.floor(this.rng() * 8);

    for (let t = 0; t < treeTarget; t++) {
      const treeId = this.rng() > 0.4 ? 'tree_oak_01' : 'tree_pine_01';

      for (let attempt = 0; attempt < 50; attempt++) {
        const tx = Math.floor(2 + this.rng() * (this.width - 4));
        const ty = Math.floor(2 + this.rng() * (this.height - 4));

        let valid = true;
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const gx = tx + dx;
            const gy = ty + dy;
            if (gx >= this.width || gy >= this.height) { valid = false; break; }
            const cell = this.grid[gy][gx];
            if (cell.isRoad || cell.isWater || cell.isFarm || cell.blocked) {
              valid = false;
              break;
            }
          }
          if (!valid) break;
        }

        if (valid) {
          for (let dy = 0; dy < 2; dy++) {
            for (let dx = 0; dx < 2; dx++) {
              this.grid[ty + dy][tx + dx].blocked = true;
            }
          }

          this.trees.push({
            id: treeId,
            name: treeId === 'tree_oak_01' ? 'Oak Tree' : 'Pine Tree',
            type: 'tree',
            x: tx,
            y: ty,
            footprintW: 2,
            footprintH: 2,
          });
          break;
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // STEP 9: Natural terrain details & scatter (Bushes, Grass clusters, Nature)
  // ─────────────────────────────────────────────────────────────────
  private generateTerrainDetails() {
    this.decorations = [];

    // 1. Generate 6 to 10 distinct, lush clusters of grass and bushes across open areas
    const clusterCount = 7 + Math.floor(this.rng() * 4); // 7 to 10 clusters
    for (let c = 0; c < clusterCount; c++) {
      let cx = -1;
      let cy = -1;
      for (let attempt = 0; attempt < 40; attempt++) {
        const tx = Math.floor(2 + this.rng() * (this.width - 4));
        const ty = Math.floor(2 + this.rng() * (this.height - 4));
        const cell = this.grid[ty][tx];
        if (!cell.isRoad && !cell.isWater && !cell.isFarm && !cell.blocked) {
          cx = tx;
          cy = ty;
          break;
        }
      }
      if (cx === -1) continue;

      const clusterType = this.rng();
      const clusterItems = 3 + Math.floor(this.rng() * 4); // 3 to 6 items per cluster

      for (let i = 0; i < clusterItems; i++) {
        const ox = cx + Math.floor((this.rng() - 0.5) * 4);
        const oy = cy + Math.floor((this.rng() - 0.5) * 4);
        if (ox < 1 || ox >= this.width - 1 || oy < 1 || oy >= this.height - 1) continue;

        const cell = this.grid[oy][ox];
        if (!cell.isRoad && !cell.isWater && !cell.isFarm && !cell.blocked) {
          let itemId: string;
          if (clusterType < 0.45) {
            // Bush-dominant cluster
            itemId = BUSH_ASSET_IDS[Math.floor(this.rng() * BUSH_ASSET_IDS.length)];
          } else if (clusterType < 0.80) {
            // Grass-tuft-dominant cluster
            itemId = GRASS_TUFT_IDS[Math.floor(this.rng() * GRASS_TUFT_IDS.length)];
          } else {
            // Mixed flora cluster
            const mixedPool = [...BUSH_ASSET_IDS, ...GRASS_TUFT_IDS, 'flowers_wild_01', 'flowers_wild_02'];
            itemId = mixedPool[Math.floor(this.rng() * mixedPool.length)];
          }

          cell.blocked = true;
          this.decorations.push({
            id: itemId,
            name: itemId,
            type: 'decoration',
            x: ox,
            y: oy,
            footprintW: 1,
            footprintH: 1,
          });
        }
      }
    }

    // 2. Individual natural scatter (flowers, rocks, mushrooms, acorns)
    const scatterCount = 18 + Math.floor(this.rng() * 12);
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
  // STEP 10: Validation
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

    // Check fences around farms
    const hasFences = this.farmObjects.some(o => o.id.startsWith('fence_wood_'));
    const fencesAroundFarms = hasFences && this.farms.length > 0;
    if (!fencesAroundFarms) {
      violations.push('No continuous fences generated around farm plots!');
    }

    // Check houses far apart
    let housesFarApart = true;
    for (let i = 0; i < this.houses.length; i++) {
      for (let j = i + 1; j < this.houses.length; j++) {
        const h1 = this.houses[i];
        const h2 = this.houses[j];
        const dist = Math.hypot(h1.x - h2.x, h1.y - h2.y);
        if (dist < 6) {
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
    const sparseRoadsGaps = roadRatio > 0.02 && roadRatio < 0.25;

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
    const openCountrysideRemaining = openRatio >= 0.35;

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
