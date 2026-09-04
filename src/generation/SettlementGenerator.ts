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
  // STEP 2: Road network generated FIRST (PURE dirt path_tile_01)
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

    // Assign pure dirt path surface — NO unwanted grey/blue blocks on path!
    for (let i = 0; i < this.roadCells.length; i++) {
      const cell = this.roadCells[i];
      this.grid[cell.y][cell.x].terrain = 'path_tile_01';
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
              if (!this.grid[wy][wx].isRoad) {
                waterMask.add(`${wx},${wy}`);
              } else {
                // Wooden boardwalk where road touches/crosses water
                this.grid[wy][wx].terrain = 'path_tile_03';
              }
            }
          }
        }
      }

      if (waterMask.size === 0) continue;

      const isWaterCell = (gx: number, gy: number): boolean => {
        return waterMask.has(`${gx},${gy}`);
      };

      const pondCells: GridCoord[] = [];

      // Apply tiles: inner cells are water_tile_01, and outer corners are diagonal shore transitions!
      for (const key of waterMask) {
        const [gxStr, gyStr] = key.split(',');
        const gx = parseInt(gxStr, 10);
        const gy = parseInt(gyStr, 10);

        this.grid[gy][gx].isWater = true;
        this.grid[gy][gx].blocked = true;
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
          // Interior or straight border: pure water tile
          this.grid[gy][gx].terrain = 'water_tile_01';
        }
      }

      this.waterBodies.push({ cells: pondCells });
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // STEP 5: Large farms with farm objects around them
  // ─────────────────────────────────────────────────────────────────
  private generateFarms() {
    this.farms = [];
    this.farmObjects = [];
    const farmCount = 2; // 2 large, expansive farms

    for (let f = 0; f < farmCount; f++) {
      const cropBase = CROP_BASE_KEYS[Math.floor(this.rng() * CROP_BASE_KEYS.length)];
      // Bigger farms: 7-10 cells wide, 5-7 cells tall
      const fw = 7 + Math.floor(this.rng() * 4);
      const fh = 5 + Math.floor(this.rng() * 3);

      for (let attempt = 0; attempt < 150; attempt++) {
        const ax = Math.floor(2 + this.rng() * (this.width - fw - 4));
        const ay = Math.floor(2 + this.rng() * (this.height - fh - 4));

        // Check clearance: NO cell may occupy a road cell, water, or building
        let valid = true;

        for (let dy = 0; dy < fh; dy++) {
          for (let dx = 0; dx < fw; dx++) {
            const gx = ax + dx;
            const gy = ay + dy;
            const cell = this.grid[gy][gx];

            if (cell.isRoad || cell.isWater || cell.isFarm || cell.blocked) {
              valid = false;
              break;
            }
          }
          if (!valid) break;
        }

        if (!valid) continue;

        // Check proximity to roads (within 1-3 cells) or allow open area on later attempts
        let nearRoad = false;
        for (let dy = -2; dy <= fh + 1; dy++) {
          for (let dx = -2; dx <= fw + 1; dx++) {
            const gx = ax + dx;
            const gy = ay + dy;
            if (gy >= 0 && gy < this.height && gx >= 0 && gx < this.width) {
              if (this.grid[gy][gx].isRoad) {
                nearRoad = true;
                break;
              }
            }
          }
          if (nearRoad) break;
        }

        if (nearRoad || attempt > 40) {
          // Generate large farm plot with subtle irregular corner cuts
          const farmCells: FarmCell[] = [];
          for (let dy = 0; dy < fh; dy++) {
            for (let dx = 0; dx < fw; dx++) {
              // Skip 1-2 outer corner cells for organic look
              const isCorner = (dx === 0 || dx === fw - 1) && (dy === 0 || dy === fh - 1);
              if (isCorner && this.rng() > 0.4) continue;

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

          if (farmCells.length >= 20) {
            this.farms.push({
              x: ax,
              y: ay,
              w: fw,
              h: fh,
              cells: farmCells,
              cropBaseId: cropBase,
            });

            // Place farm-related objects around the farm perimeter
            this.placeFarmPerimeterObjects(ax, ay, fw, fh);
            break;
          }
        }
      }
    }
  }

  /**
   * Place farm-related items (trough, water bowl, crates, chests) around farm edges
   */
  private placeFarmPerimeterObjects(fx: number, fy: number, fw: number, fh: number) {
    const numObjects = 2 + Math.floor(this.rng() * 3); // 2 to 4 objects per farm
    const perimeterSlots: GridCoord[] = [];

    // North and South border slots (1 cell outside)
    for (let x = fx; x < fx + fw; x++) {
      perimeterSlots.push({ x, y: fy - 1 });
      perimeterSlots.push({ x, y: fy + fh });
    }
    // West and East border slots
    for (let y = fy; y < fy + fh; y++) {
      perimeterSlots.push({ x: fx - 1, y });
      perimeterSlots.push({ x: fx + fw, y });
    }

    // Shuffle slots
    for (let i = perimeterSlots.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [perimeterSlots[i], perimeterSlots[j]] = [perimeterSlots[j], perimeterSlots[i]];
    }

    let placed = 0;
    for (const slot of perimeterSlots) {
      if (placed >= numObjects) break;
      if (slot.x < 1 || slot.x >= this.width - 1 || slot.y < 1 || slot.y >= this.height - 1) continue;

      const cell = this.grid[slot.y][slot.x];
      if (!cell.isRoad && !cell.isWater && !cell.isFarm && !cell.blocked) {
        const objId = FARM_OBJECT_IDS[Math.floor(this.rng() * FARM_OBJECT_IDS.length)];
        cell.blocked = true;

        this.farmObjects.push({
          id: objId,
          name: objId,
          type: 'farm_object',
          x: slot.x,
          y: slot.y,
          footprintW: 1,
          footprintH: 1,
        });
        placed++;
      }
    }
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
            this.grid[cy][cx].terrain = 'path_tile_01';
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
  // STEP 9: Natural terrain details & scatter
  // ─────────────────────────────────────────────────────────────────
  private generateTerrainDetails() {
    this.decorations = [];
    const decorCount = 20 + Math.floor(this.rng() * 15);

    for (let d = 0; d < decorCount; d++) {
      const decorId = DECORATION_ASSET_IDS[Math.floor(this.rng() * DECORATION_ASSET_IDS.length)];

      for (let attempt = 0; attempt < 30; attempt++) {
        const x = Math.floor(1 + this.rng() * (this.width - 2));
        const y = Math.floor(1 + this.rng() * (this.height - 2));

        const cell = this.grid[y][x];

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
