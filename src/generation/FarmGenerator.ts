// ═══════════════════════════════════════════════════════════════════
// FARM GENERATOR MODULE (Phase 2: Agricultural zoning & crop variety)
// ═══════════════════════════════════════════════════════════════════

import {
  AssetId,
  SettlementCell,
  FarmPlot,
  FarmCell,
  PlacedObject,
  SettlementData,
  createRNG,
} from './SettlementGenerator';

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
  'crop_sunflower',
];

export const FARM_OBJECT_IDS = [
  'farm_trough',
  'farm_waterbowl',
  'farm_crate_01',
  'farm_crate_02',
  'farm_chest_closed',
];

export class FarmGenerator {
  private rng: () => number;
  private width: number;
  private height: number;
  private grid: SettlementCell[][];
  private houses: PlacedObject[];
  public farms: FarmPlot[] = [];
  public farmObjects: PlacedObject[] = [];

  constructor(settlement: SettlementData, seed?: number) {
    this.width = settlement.width;
    this.height = settlement.height;
    this.grid = settlement.grid;
    this.houses = settlement.houses || [];
    const farmSeed = seed !== undefined ? seed + 5555 : settlement.seed + 5555;
    this.rng = createRNG(farmSeed);
    this.farms = [];
    this.farmObjects = [];
  }

  /**
   * Generates all farms, multi-crop regions (4x4 patches cycling 11 crops),
   * farmyard props along strips, and perimeter fences with villager openings.
   */
  public generate(): { farms: FarmPlot[]; farmObjects: PlacedObject[] } {
    this.farms = [];
    this.farmObjects = [];

    // Target: 4 to 8 farms
    const farmCount = 4 + Math.floor(this.rng() * 5);

    // Create a shuffled list of all crops to ensure every type is used across patches
    const shuffledCrops = [...CROP_BASE_KEYS].sort(() => this.rng() - 0.5);
    let globalCropIndex = 0;

    // ── Primary Placement Loop ─────────────────────────────────────
    for (let f = 0; f < farmCount; f++) {
      const cropBase = shuffledCrops[f % shuffledCrops.length];
      const hasBorder = this.rng() < 0.50; // 50% chance of border fence

      // Cluster near existing homestead houses
      const targetHouse = this.houses.length > 0 ? this.houses[f % this.houses.length] : null;

      // Target farm dimensions: 9 to 13 cells wide, 5 to 7 cells tall
      const targetW = 9 + Math.floor(this.rng() * 5);
      const targetH = 5 + Math.floor(this.rng() * 3);

      for (let attempt = 0; attempt < 350; attempt++) {
        const curTargetW = attempt > 250 ? Math.max(6, targetW - 3) : (attempt > 150 ? Math.max(7, targetW - 2) : targetW);
        const curTargetH = attempt > 250 ? Math.max(3, targetH - 2) : (attempt > 150 ? Math.max(3, targetH - 1) : targetH);
        let ax: number;
        let ay: number;

        if (targetHouse && attempt < 120) {
          const angle = this.rng() * Math.PI * 2;
          const distFromHouse = 4 + this.rng() * 8;
          ax = Math.round(targetHouse.x + Math.cos(angle) * distFromHouse);
          ay = Math.round(targetHouse.y + Math.sin(angle) * distFromHouse);
        } else if (targetHouse && attempt < 220) {
          const angle = this.rng() * Math.PI * 2;
          const distFromHouse = 5 + this.rng() * 13;
          ax = Math.round(targetHouse.x + Math.cos(angle) * distFromHouse);
          ay = Math.round(targetHouse.y + Math.sin(angle) * distFromHouse);
        } else {
          ax = Math.floor(2 + this.rng() * (this.width - targetW - 4));
          ay = Math.floor(2 + this.rng() * (this.height - targetH - 6));
        }

        ax = Math.max(2, Math.min(this.width - 7, ax));
        ay = Math.max(2, Math.min(this.height - 5, ay));

        let fw = curTargetW;
        let fh = curTargetH;

        fw = Math.min(fw, this.width - ax - 2);
        fh = Math.min(fh, this.height - ay - 2);
        const minW = attempt > 150 ? 5 : 6;
        const minH = 3;
        if (fw < minW || fh < minH) continue;

        // Pause width before any obstacle
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
            fw = dx;
            break;
          }
        }
        if (fw < minW) continue;

        // Pause height before any obstacle
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
            fh = dy;
            break;
          }
        }
        if (fw < minW || fh < minH) continue;

        const minX = ax - 1;
        const maxX = ax + fw;
        const minY = ay - 1;
        const maxY = ay + fh + 1;

        let farmyardY = ay + fh;
        if (farmyardY >= this.height - 1) {
          farmyardY = ay + fh - 1;
        }

        // Divide farm into 4x4 regions, assigning a unique crop per region
        const regionW = 4;
        const regionH = 4;
        const regions: { [key: string]: string } = {};

        const farmCells: FarmCell[] = [];
        for (let dy = 0; dy < fh; dy++) {
          for (let dx = 0; dx < fw; dx++) {
            const isCorner = (dx === 0 || dx === fw - 1) && (dy === 0);
            if (isCorner && this.rng() > 0.5) continue;

            const rx = Math.floor(dx / regionW);
            const ry = Math.floor(dy / regionH);
            const regionKey = `${rx},${ry}`;
            if (!regions[regionKey]) {
              regions[regionKey] = shuffledCrops[globalCropIndex % shuffledCrops.length];
              globalCropIndex++;
            }
            const regionCropBase = regions[regionKey];

            const gx = ax + dx;
            const gy = ay + dy;
            this.grid[gy][gx].isFarm = true;
            this.grid[gy][gx].terrain = 'dirt_tile_01'; // Tilled furrow soil

            const stage = Math.floor(this.rng() * 4); // Stages 0 to 3
            farmCells.push({
              x: gx,
              y: gy,
              cropId: `${regionCropBase}_stage_${stage}`,
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

        // Fencing with openings
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

    // ── Fallback Safety Loop (guarantee at least 4 farms) ───────────
    let safetyFarms = 0;
    while (this.farms.length < 4 && safetyFarms++ < 15) {
      const f = this.farms.length;
      const cropBase = shuffledCrops[globalCropIndex % shuffledCrops.length];
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

        const regionW = 4;
        const regionH = 4;
        const regions: { [key: string]: string } = {};

        const farmCells: FarmCell[] = [];
        for (let dy = 0; dy < fh; dy++) {
          for (let dx = 0; dx < fw; dx++) {
            const isCorner = (dx === 0 || dx === fw - 1) && (dy === 0);
            if (isCorner && this.rng() > 0.5) continue;
            
            const rx = Math.floor(dx / regionW);
            const ry = Math.floor(dy / regionH);
            const regionKey = `${rx},${ry}`;
            if (!regions[regionKey]) {
              regions[regionKey] = shuffledCrops[globalCropIndex % shuffledCrops.length];
              globalCropIndex++;
            }
            const regionCropBase = regions[regionKey];

            const gx = ax + dx;
            const gy = ay + dy;
            this.grid[gy][gx].isFarm = true;
            this.grid[gy][gx].terrain = 'dirt_tile_01';

            const stage = Math.floor(this.rng() * 4);
            farmCells.push({
              x: gx,
              y: gy,
              cropId: `${regionCropBase}_stage_${stage}`,
              stage,
            });
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

    return {
      farms: this.farms,
      farmObjects: this.farmObjects,
    };
  }

  /**
   * Place a single wooden fence segment unless cell is marked as an opening
   */
  private placeFenceCell(
    x: number,
    y: number,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    openings: Set<string>
  ) {
    if (openings.has(`${x},${y}`)) return;

    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;

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

  /**
   * Updates settlement validation checks with farm results.
   */
  public updateSettlementValidation(settlement: SettlementData) {
    if (!settlement.validation) return;

    let noStage4Crops = true;
    let noObjectsOnRoad = true;
    const violations: string[] = [];

    for (const farm of this.farms) {
      for (const c of farm.cells) {
        if (this.grid[c.y][c.x].isRoad) {
          noObjectsOnRoad = false;
          violations.push(`Farm crop at (${c.x},${c.y}) overlaps road!`);
        }
        if (c.stage >= 4) {
          noStage4Crops = false;
          violations.push(`Farm crop at (${c.x},${c.y}) has stage ${c.stage} (stage 4 is collectible icon, not planted)!`);
        }
      }
    }

    settlement.validation.checks.largeIrregularFarms = this.farms.length > 0;
    settlement.validation.checks.fencesAroundFarms = this.farms.length > 0;
    settlement.validation.checks.noStage4Crops = noStage4Crops;
    if (!noObjectsOnRoad) {
      settlement.validation.checks.noObjectsOnRoad = false;
    }
    settlement.validation.violations.push(...violations);
    settlement.validation.valid =
      settlement.validation.violations.length === 0 &&
      Object.values(settlement.validation.checks).every(Boolean);
  }
}

/**
 * Top-level convenience runner for Phase 2: Farm Generation
 */
export function generateFarmsForSettlement(
  settlement: SettlementData,
  seed?: number
): { farms: FarmPlot[]; farmObjects: PlacedObject[] } {
  const farmGen = new FarmGenerator(settlement, seed);
  const result = farmGen.generate();
  settlement.farms = result.farms;
  settlement.farmObjects = result.farmObjects;
  farmGen.updateSettlementValidation(settlement);
  return result;
}
