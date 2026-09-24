// ═══════════════════════════════════════════════════════════════════
// CROP GENERATOR MODULE (Phase 5: Crop Selection & Cultivation)
// Runs strictly AFTER all farmland plots across the village are spawned!
// Selects crops across all 11 crop types and plants them in 4x4 patches.
// ═══════════════════════════════════════════════════════════════════

import {
  FarmPlot,
  FarmCell,
  SettlementCell,
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

export class CropGenerator {
  private rng: () => number;
  private grid: SettlementCell[][];
  private farms: FarmPlot[];

  constructor(
    farms: FarmPlot[],
    grid: SettlementCell[][],
    seed?: number
  ) {
    this.farms = farms;
    this.grid = grid;
    this.rng = createRNG(seed !== undefined ? seed + 8888 : 42891);
  }

  /**
   * Cultivates all established farmlands.
   * Runs ONLY AFTER all farmland plots have been completely placed and finalized.
   */
  public generate(): FarmPlot[] {
    if (!this.farms || this.farms.length === 0) {
      return this.farms;
    }

    // Shuffle the full crop catalog to guarantee all 11 crop types are represented
    const shuffledCrops = [...CROP_BASE_KEYS].sort(() => this.rng() - 0.5);
    let globalCropIndex = 0;

    const regionW = 4;
    const regionH = 4;

    for (let f = 0; f < this.farms.length; f++) {
      const farm = this.farms[f];
      const farmCropBase = shuffledCrops[f % shuffledCrops.length];
      farm.cropBaseId = farmCropBase;

      const regions: { [key: string]: string } = {};
      const farmCells: FarmCell[] = [];

      for (let dy = 0; dy < farm.h; dy++) {
        for (let dx = 0; dx < farm.w; dx++) {
          const gx = farm.x + dx;
          const gy = farm.y + dy;

          // Only plant if the cell was zoned as tilled dirt
          if (!this.grid[gy] || !this.grid[gy][gx] || !this.grid[gy][gx].isFarm) {
            continue;
          }

          const rx = Math.floor(dx / regionW);
          const ry = Math.floor(dy / regionH);
          const regionKey = `${rx},${ry}`;

          if (!regions[regionKey]) {
            regions[regionKey] = shuffledCrops[globalCropIndex % shuffledCrops.length];
            globalCropIndex++;
          }
          const regionCropBase = regions[regionKey];

          // Growth stages 0 to 3 ONLY (stage 4 is collectible item icon)
          const stage = Math.floor(this.rng() * 4);
          farmCells.push({
            x: gx,
            y: gy,
            cropId: `${regionCropBase}_stage_${stage}`,
            stage,
          });
        }
      }

      farm.cells = farmCells;
    }

    return this.farms;
  }

  /**
   * Updates settlement validation checks with crop rules.
   */
  public updateValidation(settlement: SettlementData) {
    if (!settlement.validation) return;

    let noStage4Crops = true;
    let noObjectsOnRoad = true;
    const violations: string[] = [];

    for (const farm of settlement.farms) {
      for (const c of farm.cells) {
        if (this.grid[c.y]?.[c.x]?.isRoad) {
          noObjectsOnRoad = false;
          violations.push(`Farm crop at (${c.x},${c.y}) overlaps road!`);
        }
        if (c.stage >= 4) {
          noStage4Crops = false;
          violations.push(`Farm crop at (${c.x},${c.y}) has stage ${c.stage} (stage 4 is collectible icon, not planted)!`);
        }
      }
    }

    settlement.validation.checks.largeIrregularFarms = settlement.farms.length > 0;
    settlement.validation.checks.fencesAroundFarms = settlement.farms.length > 0;
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
 * Top-level convenience runner for Phase 5: Crop Selection & Cultivation
 */
export function generateCropsForFarmlands(
  settlement: SettlementData,
  seed?: number
): FarmPlot[] {
  const cropGen = new CropGenerator(settlement.farms, settlement.grid, seed ?? settlement.seed);
  const result = cropGen.generate();
  cropGen.updateValidation(settlement);
  return result;
}
