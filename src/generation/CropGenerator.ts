// ═══════════════════════════════════════════════════════════════════
// CROP GENERATOR MODULE (Phase 5: Crop Selection & Cultivation)
// Runs strictly AFTER all farmland plots are spawned (Phase 4).
// Each farm gets 1-2 crop regions, each with a random crop type.
// Crops are OVERLAID on top of tilled soil — they do NOT replace it.
// ═══════════════════════════════════════════════════════════════════

import {
  FarmPlot,
  FarmCell,
  SettlementData,
  createRNG,
} from './SettlementGenerator';

// All available crop types from the asset pack
export const CROP_TYPES = [
  'wheat',
  'carrot',
  'potato',
  'pumpkin',
  'cabbage',
  'cauliflower',
  'kale',
  'parsnip',
  'radish',
  'beetroot',
  'sunflower',
];

export class CropGenerator {
  private rng: () => number;
  private farms: FarmPlot[];

  constructor(farms: FarmPlot[], seed?: number) {
    this.farms = farms;
    this.rng = createRNG(seed !== undefined ? seed + 8888 : 42891);
  }

  /**
   * Plants crops on all established farmlands.
   * Each farm gets 1-2 regions, each with a different random crop type.
   * Crops are overlaid on top of tilled soil (soil stays underneath).
   */
  public generate(): void {
    if (!this.farms || this.farms.length === 0) return;

    for (const farm of this.farms) {
      if (farm.cells.length === 0) continue;

      // Decide 1 or 2 regions for this farm
      const numRegions = 1 + Math.floor(this.rng() * 2); // 1 or 2

      // Pick random crop types for each region (no duplicates within same farm)
      const shuffled = [...CROP_TYPES].sort(() => this.rng() - 0.5);
      const regionCrops = shuffled.slice(0, numRegions);

      // Split the farm into regions by dividing along the longer axis
      const splitVertically = farm.w >= farm.h;

      for (const cell of farm.cells) {
        // Determine which region this cell belongs to
        let regionIndex: number;
        if (numRegions === 1) {
          regionIndex = 0;
        } else {
          // Split into 2 halves
          if (splitVertically) {
            const midX = farm.x + Math.floor(farm.w / 2);
            regionIndex = cell.x < midX ? 0 : 1;
          } else {
            const midY = farm.y + Math.floor(farm.h / 2);
            regionIndex = cell.y < midY ? 0 : 1;
          }
        }

        const cropType = regionCrops[regionIndex];
        // Growth stages 0-3 (stage 4-5 are harvest/item icons)
        const stage = Math.floor(this.rng() * 4);

        cell.cropId = `crop_${cropType}_stage_${stage}`;
        cell.stage = stage;
      }

      farm.cropBaseId = regionCrops[0];
    }
  }
}

/**
 * Top-level convenience runner for Phase 5: Crop Cultivation
 * Runs ONLY AFTER Phase 4 (Farmland Layout) is complete.
 */
export function generateCropsForFarmlands(
  settlement: SettlementData,
  seed?: number
): void {
  const cropGen = new CropGenerator(settlement.farms, seed ?? settlement.seed);
  cropGen.generate();
}
