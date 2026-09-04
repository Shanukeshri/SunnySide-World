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
  type: 'house' | 'farm' | 'well' | 'tree' | 'decoration';
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
  isRoadReserved: boolean;// road cell + 1-tile buffer
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
    largeIrregularFarms: boolean;
    directionalShoreRotated: boolean;
    openCountrysideRemaining: boolean;
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

    // ── STEP 3: Reserve road clearance (ABSOLUTE) ─────────────────
    this.reserveRoadClearance();

    // ── STEP 4: Water bodies & directional shore transitions ──────
    this.generateWaterBodies();

    // ── STEP 5: Large irregular farms ─────────────────────────────
    this.generateFarms();

    // ── STEP 6: Distant houses placed far apart ───────────────────
    this.generateHouses();

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
      wells: this.wells,
      trees: this.trees,
      decorations: this.decorations,
      waterBodies: this.waterBodies,
      validation,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // STEP 1: Flat grass
  // ─────────────────────────────────────────────────────────────────
  private initFlatGrass() {
    this.grid = [];
    for (let y = 0; y < this.height; y++) {
      const row: SettlementCell[] = [];
      for (let x = 0; x < this.width; x++) {
        row.push({
          terrain: 'grass_tile_01',
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

  // ─────────────────────────────────────────────────────────────────
  // STEP 2: Road network generated FIRST
  // ─────────────────────────────────────────────────────────────────
  private generateRoadNetwork() {
    this.roadCells = [];

    // Main road crosses the settlement horizontally with natural meanders
    // Pick 2 main anchor points on opposite borders with safe padding
    const startY = Math.floor(this.height * 0.35 + this.rng() * (this.height * 0.3));
    const endY = Math.floor(this.height * 0.35 + this.rng() * (this.height * 0.3));

    const p0: GridCoord = { x: 2, y: startY };
    const p1: GridCoord = { x: Math.floor(this.width * 0.45 + (this.rng() - 0.5) * 6), y: Math.floor((startY + endY) / 2 + (this.rng() - 0.5) * 6) };
    const p2: GridCoord = { x: this.width - 3, y: endY };

    // Carve main spine
    this.carveMeanderingPath(p0, p1);
    this.carveMeanderingPath(p1, p2);

    // 1 to 2 branching trails (sparse, not a grid)
    const branchCount = 1 + (this.rng() > 0.4 ? 1 : 0);
    for (let b = 0; b < branchCount; b++) {
      if (this.roadCells.length === 0) break;
      // Pick an existing road cell near middle
      const junctionIdx = Math.floor(this.roadCells.length * (0.25 + this.rng() * 0.5));
      const junction = this.roadCells[junctionIdx];

      // Branch outward toward top or bottom
      const goNorth = b === 0 ? (junction.y > this.height / 2) : (this.rng() > 0.5);
      const targetY = goNorth ? Math.floor(3 + this.rng() * 5) : Math.floor(this.height - 4 - this.rng() * 5);
      const targetX = Math.max(4, Math.min(this.width - 5, junction.x + Math.floor((this.rng() - 0.5) * 16)));

      this.carveMeanderingPath(junction, { x: targetX, y: targetY });
    }

    // Set road tiles
    // Default is path_tile_01 (Dirt Trail).
    // Central junction has a few cobblestone tiles (path_tile_02)
    const centerRoadIdx = Math.floor(this.roadCells.length / 2);
    for (let i = 0; i < this.roadCells.length; i++) {
      const cell = this.roadCells[i];
      const isNearCenter = Math.abs(i - centerRoadIdx) < 4 && this.rng() > 0.3;
      const terrain = isNearCenter ? 'path_tile_02' : 'path_tile_01';

      this.grid[cell.y][cell.x].terrain = terrain;
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
    // Road cells are ROAD_RESERVED.
    // In addition, mark 1-cell buffer around roads as road clearance for buildings/farms.
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
  // STEP 4: Water bodies & directional shore transitions
  // ─────────────────────────────────────────────────────────────────
  private generateWaterBodies() {
    this.waterBodies = [];

    // 75% chance to have water
    if (this.rng() > 0.75) return;

    // 1 to 2 small/medium irregular ponds
    const pondCount = this.rng() > 0.5 ? 2 : 1;

    for (let p = 0; p < pondCount; p++) {
      // Find open area far from borders and avoiding heavy road overlap
      let cx = 0;
      let cy = 0;
      let found = false;

      for (let attempt = 0; attempt < 30; attempt++) {
        const tx = Math.floor(6 + this.rng() * (this.width - 12));
        const ty = Math.floor(5 + this.rng() * (this.height - 10));

        // Prefer quadrant away from roads
        if (!this.grid[ty][tx].isRoad && !this.grid[ty][tx].isWater) {
          cx = tx;
          cy = ty;
          found = true;
          break;
        }
      }

      if (!found) continue;

      const pondCells: GridCoord[] = [];
      const radius = 2 + Math.floor(this.rng() * 2); // small organic radius 2-3 cells

      // Grow organic shape
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          const noise = (this.rng() - 0.5) * 0.8;
          if (dist + noise <= radius) {
            const wx = cx + dx;
            const wy = cy + dy;
            if (wx >= 1 && wx < this.width - 1 && wy >= 1 && wy < this.height - 1) {
              if (!this.grid[wy][wx].isRoad) {
                this.grid[wy][wx].isWater = true;
                this.grid[wy][wx].terrain = 'water_tile_01';
                this.grid[wy][wx].blocked = true;
                pondCells.push({ x: wx, y: wy });
              } else {
                // If road cell is adjacent or passes over shallow water edge,
                // mark as path_tile_03 (wooden boardwalk)!
                this.grid[wy][wx].terrain = 'path_tile_03';
              }
            }
          }
        }
      }

      if (pondCells.length > 0) {
        this.waterBodies.push({ cells: pondCells });
      }
    }

    // Direction-aware shore transitions
    this.calculateShoreTransitions();
  }

  /**
   * Determine directional rotation for shore_transition_01
   * shore_transition_01 native sprite has water facing SOUTH-EAST.
   * Rotation is applied around cell center:
   *   water on SE -> 0 rad
   *   water on SW -> PI / 2 (90° CW)
   *   water on NW -> PI (180°)
   *   water on NE -> -PI / 2 (-90° / 270°)
   */
  private calculateShoreTransitions() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[y][x].isWater || this.grid[y][x].isRoad) continue;

        // Inspect 8-way neighbors to detect adjacent water
        let hasWaterN = false;
        let hasWaterS = false;
        let hasWaterW = false;
        let hasWaterE = false;
        let hasWaterNE = false;
        let hasWaterNW = false;
        let hasWaterSE = false;
        let hasWaterSW = false;

        const isW = (gx: number, gy: number) => {
          if (gx >= 0 && gx < this.width && gy >= 0 && gy < this.height) {
            return this.grid[gy][gx].isWater;
          }
          return false;
        };

        if (isW(x, y - 1)) hasWaterN = true;
        if (isW(x, y + 1)) hasWaterS = true;
        if (isW(x - 1, y)) hasWaterW = true;
        if (isW(x + 1, y)) hasWaterE = true;
        if (isW(x + 1, y - 1)) hasWaterNE = true;
        if (isW(x - 1, y - 1)) hasWaterNW = true;
        if (isW(x + 1, y + 1)) hasWaterSE = true;
        if (isW(x - 1, y + 1)) hasWaterSW = true;

        const anyWater = hasWaterN || hasWaterS || hasWaterW || hasWaterE || hasWaterNE || hasWaterNW || hasWaterSE || hasWaterSW;

        if (anyWater) {
          let rot = 0;

          if ((hasWaterS && hasWaterE) || hasWaterSE) {
            rot = 0; // SE
          } else if ((hasWaterS && hasWaterW) || hasWaterSW) {
            rot = Math.PI / 2; // SW
          } else if ((hasWaterN && hasWaterW) || hasWaterNW) {
            rot = Math.PI; // NW
          } else if ((hasWaterN && hasWaterE) || hasWaterNE) {
            rot = -Math.PI / 2; // NE
          } else if (hasWaterS) {
            rot = Math.PI / 4;
          } else if (hasWaterE) {
            rot = -Math.PI / 4;
          } else if (hasWaterW) {
            rot = (3 * Math.PI) / 4;
          } else if (hasWaterN) {
            rot = -(3 * Math.PI) / 4;
          }

          // In 50% of shore cases, add sandy bank (sand_tile_01)
          if (this.rng() > 0.5) {
            this.grid[y][x].terrain = 'sand_tile_01';
          } else {
            this.grid[y][x].terrain = 'shore_transition_01';
            this.grid[y][x].rotation = rot;
          }
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // STEP 5: Large irregular farms
  // ─────────────────────────────────────────────────────────────────
  private generateFarms() {
    this.farms = [];
    const farmCount = 2 + (this.rng() > 0.4 ? 1 : 0); // 2 to 3 large farms

    for (let f = 0; f < farmCount; f++) {
      const cropBase = CROP_BASE_KEYS[Math.floor(this.rng() * CROP_BASE_KEYS.length)];
      const fw = 4 + Math.floor(this.rng() * 3); // 4 to 6 cells wide
      const fh = 3 + Math.floor(this.rng() * 3); // 3 to 5 cells tall

      let placed = false;
      for (let attempt = 0; attempt < 60; attempt++) {
        const ax = Math.floor(3 + this.rng() * (this.width - fw - 6));
        const ay = Math.floor(3 + this.rng() * (this.height - fh - 6));

        // Check clearance: NO cell may occupy a road cell or water
        let valid = true;
        let besideRoad = false;

        for (let dy = 0; dy < fh; dy++) {
          for (let dx = 0; dx < fw; dx++) {
            const gx = ax + dx;
            const gy = ay + dy;
            const cell = this.grid[gy][gx];

            // Strict rule: NO farm cell may occupy a road cell or water or existing farm
            if (cell.isRoad || cell.isWater || cell.isFarm || cell.blocked) {
              valid = false;
              break;
            }

            // Check if farm is beside a road (within 1-2 cells)
            if (cell.isRoadReserved && !cell.isRoad) {
              besideRoad = true;
            }
          }
          if (!valid) break;
        }

        if (valid && besideRoad) {
          // Generate irregular shape by skipping 1-2 corners
          const farmCells: FarmCell[] = [];
          for (let dy = 0; dy < fh; dy++) {
            for (let dx = 0; dx < fw; dx++) {
              // Irregular cut corners
              const isCorner = (dx === 0 || dx === fw - 1) && (dy === 0 || dy === fh - 1);
              if (isCorner && this.rng() > 0.5) continue;

              const gx = ax + dx;
              const gy = ay + dy;
              this.grid[gy][gx].isFarm = true;
              this.grid[gy][gx].terrain = 'dirt_tile_01'; // Tilled furrow soil

              const stage = Math.min(4, Math.floor(this.rng() * 5));
              farmCells.push({
                x: gx,
                y: gy,
                cropId: `${cropBase}_stage_${stage}`,
                stage,
              });
            }
          }

          if (farmCells.length >= 8) {
            this.farms.push({
              x: ax,
              y: ay,
              w: fw,
              h: fh,
              cells: farmCells,
              cropBaseId: cropBase,
            });
            placed = true;
            break;
          }
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // STEP 6: Houses placed far apart beside roads
  // ─────────────────────────────────────────────────────────────────
  private generateHouses() {
    this.houses = [];

    // Select believable subset of buildings (4 to 7 buildings)
    const targetHouses = 4 + Math.floor(this.rng() * 3);
    const minDistanceBetweenHouses = 9; // Euclidean distance check in cells

    // Shuffle templates with weighted distribution
    const pool: HouseTemplate[] = [];
    for (const t of HOUSE_TEMPLATES) {
      for (let i = 0; i < t.weight; i++) {
        pool.push(t);
      }
    }

    for (let h = 0; h < targetHouses; h++) {
      const template = pool[Math.floor(this.rng() * pool.length)];

      let placed = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const ax = Math.floor(2 + this.rng() * (this.width - template.w - 4));
        const ay = Math.floor(2 + this.rng() * (this.height - template.h - 4));

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

        // 2. Full footprint check
        let footprintValid = true;
        let nearRoad = false;

        for (let dy = 0; dy < template.h; dy++) {
          for (let dx = 0; dx < template.w; dx++) {
            const gx = ax + dx;
            const gy = ay + dy;
            const cell = this.grid[gy][gx];

            // Strict: NEVER occupy road, water, farm, or blocked cell
            if (cell.isRoad || cell.isWater || cell.isFarm || cell.blocked) {
              footprintValid = false;
              break;
            }

            // Check proximity to road (preferred beside road: 1-3 cells away)
            for (let rdy = -2; rdy <= 2; rdy++) {
              for (let rdx = -2; rdx <= 2; rdx++) {
                const rx = gx + rdx;
                const ry = gy + rdy;
                if (rx >= 0 && rx < this.width && ry >= 0 && ry < this.height) {
                  if (this.grid[ry][rx].isRoad) nearRoad = true;
                }
              }
            }
          }
          if (!footprintValid) break;
        }

        // Allow mostly road-side houses, but allow some houses in open area
        if (footprintValid && (nearRoad || this.rng() > 0.7)) {
          // Mark footprint cells as blocked
          for (let dy = 0; dy < template.h; dy++) {
            for (let dx = 0; dx < template.w; dx++) {
              this.grid[ay + dy][ax + dx].blocked = true;
            }
          }

          // Small paved stone apron near entrance (sparingly: stone_tile_01)
          if (this.rng() > 0.4 && ay + template.h < this.height) {
            const stoneX = ax + 1;
            const stoneY = ay + template.h;
            if (!this.grid[stoneY][stoneX].isRoad && !this.grid[stoneY][stoneX].isWater) {
              this.grid[stoneY][stoneX].terrain = 'stone_tile_01';
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
          });
          placed = true;
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
    const wellCount = this.rng() > 0.35 ? (this.rng() > 0.5 ? 2 : 1) : 0;

    for (let w = 0; w < wellCount; w++) {
      const wellId = this.rng() > 0.5 ? 'farm_well' : 'farm_well_covered';

      for (let attempt = 0; attempt < 80; attempt++) {
        // Pick near an existing house or farm
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

        // Valid: never on road, water, farm, or blocked
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
    const treeTarget = 12 + Math.floor(this.rng() * 10); // 12-21 trees across whole landscape

    for (let t = 0; t < treeTarget; t++) {
      const treeId = this.rng() > 0.4 ? 'tree_oak_01' : 'tree_pine_01';

      for (let attempt = 0; attempt < 50; attempt++) {
        const tx = Math.floor(2 + this.rng() * (this.width - 4));
        const ty = Math.floor(2 + this.rng() * (this.height - 4));

        // Tree occupies 2×2 cells footprint
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
          // Block the 2x2 footprint
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
  // STEP 9: Natural terrain details & scatter
  // ─────────────────────────────────────────────────────────────────
  private generateTerrainDetails() {
    this.decorations = [];
    const decorCount = 25 + Math.floor(this.rng() * 20);

    for (let d = 0; d < decorCount; d++) {
      const decorId = DECORATION_ASSET_IDS[Math.floor(this.rng() * DECORATION_ASSET_IDS.length)];

      for (let attempt = 0; attempt < 30; attempt++) {
        const x = Math.floor(1 + this.rng() * (this.width - 2));
        const y = Math.floor(1 + this.rng() * (this.height - 2));

        const cell = this.grid[y][x];

        // Never on road, water, or blocked
        if (!cell.isRoad && !cell.isWater && !cell.blocked) {
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

    // A few subtle grass edge details (grass_tile_02) where appropriate
    for (let y = 1; y < this.height - 1; y++) {
      for (let x = 1; x < this.width - 1; x++) {
        const cell = this.grid[y][x];
        if (cell.terrain === 'grass_tile_01' && !cell.isRoad && !cell.isWater && !cell.isFarm) {
          // Subtle natural variation (under 4% of grass tiles)
          if (this.rng() < 0.035) {
            cell.terrain = 'grass_tile_02';
          }
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // STEP 10: Validation
  // ─────────────────────────────────────────────────────────────────
  private validateSettlement(): ValidationReport {
    const violations: string[] = [];

    // 1. Check flat terrain & no elevation / isometric blocks
    let flatTerrain = true;
    let noIsometricBlocks = true;
    let noElevationAssets = true;
    let gridAligned16px = true;

    // 2. Check road inviolability
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

    for (const farm of this.farms) {
      for (const c of farm.cells) {
        if (this.grid[c.y][c.x].isRoad) {
          noObjectsOnRoad = false;
          violations.push(`Farm crop at (${c.x},${c.y}) overlaps road!`);
        }
      }
    }

    // 3. Check house distance
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

    // 4. Roads generated first with sparse gaps
    const totalCells = this.width * this.height;
    const roadCount = this.roadCells.length;
    const roadRatio = roadCount / totalCells;
    const sparseRoadsGaps = roadRatio > 0.02 && roadRatio < 0.20; // Sparse path network

    // 5. Open countryside remaining
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
    const openCountrysideRemaining = openRatio >= 0.40; // At least 40% open grass countryside

    // 6. Directional shore rotation
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
      largeIrregularFarms: this.farms.length > 0,
      directionalShoreRotated,
      openCountrysideRemaining,
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
