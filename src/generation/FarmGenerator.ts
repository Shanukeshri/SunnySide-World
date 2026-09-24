// ═══════════════════════════════════════════════════════════════════
// FARM GENERATOR (Phase Coordinator: Farmlands then Crops)
// Sequentially coordinates:
// 1. Farmland Layout (FarmlandGenerator)
// 2. Crop Selection & Farmland Planting (CropGenerator)
// ═══════════════════════════════════════════════════════════════════

import {
  SettlementData,
  FarmPlot,
  PlacedObject,
} from './SettlementGenerator';

import {
  FarmlandGenerator,
  generateFarmlands,
  FARM_OBJECT_IDS,
} from './FarmlandGenerator';

import {
  CropGenerator,
  generateCropsForFarmlands,
  CROP_BASE_KEYS,
} from './CropGenerator';

export {
  FarmlandGenerator,
  generateFarmlands,
  FARM_OBJECT_IDS,
  CropGenerator,
  generateCropsForFarmlands,
  CROP_BASE_KEYS,
};

export class FarmGenerator {
  private settlement: SettlementData;
  private seed?: number;
  public farms: FarmPlot[] = [];
  public farmObjects: PlacedObject[] = [];

  constructor(settlement: SettlementData, seed?: number) {
    this.settlement = settlement;
    this.seed = seed;
  }

  /**
   * Executes the two distinct sub-phases strictly in order:
   * 1. Farmland Layout Phase: creates all tilled farm plots, perimeter fences, and props
   * 2. Crop Selection Phase: selects and plants crops across all spawned farmlands
   */
  public generate(): { farms: FarmPlot[]; farmObjects: PlacedObject[] } {
    // ── Sub-Phase 4: Farmland Layout ──
    console.log('[Sub-Phase: Farmland Layout] Spawning tilled soil plots, perimeter fences, and farmyard props...');
    const farmlandResult = generateFarmlands(this.settlement, this.seed);
    this.farms = farmlandResult.farms;
    this.farmObjects = farmlandResult.farmObjects;

    // ── Sub-Phase 5: Crop Selection & Cultivation ──
    // Runs ONLY after all farmland plots are spawned!
    console.log('[Sub-Phase: Crop Selection] Distributing 11 crop types across all spawned farmland plots...');
    generateCropsForFarmlands(this.settlement, this.seed);

    return {
      farms: this.settlement.farms,
      farmObjects: this.settlement.farmObjects,
    };
  }
}

/**
 * Top-level convenience runner for the agricultural pipeline
 */
export function generateFarmsForSettlement(
  settlement: SettlementData,
  seed?: number
): { farms: FarmPlot[]; farmObjects: PlacedObject[] } {
  const farmGen = new FarmGenerator(settlement, seed);
  return farmGen.generate();
}
