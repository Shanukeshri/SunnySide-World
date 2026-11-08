// ═══════════════════════════════════════════════════════════════════
// FARMLAND GENERATOR MODULE (Phase 4: Farmland zoning & fencing)
// Creates organic, non-square curved farmland plots using multi-oval
// merging, tilled furrow soil, farmyard props, & rustic fences.
// Crops are NOT placed here; they are handled in Phase 5 by CropGenerator.
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

export const FARM_OBJECT_IDS = [
  'farm_trough',
  'farm_waterbowl',
  'farm_crate_01',
  'farm_crate_02',
  'farm_chest_closed',
];

export interface FarmlandResult {
  farms: FarmPlot[];
  farmObjects: PlacedObject[];
}

export class FarmlandGenerator {
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
   * Generates organic, non-square curved farmland plots across the village.
   * Farm plots are created with empty cells; crops are planted later by CropGenerator.
   */
  public generate(): FarmlandResult {
    this.farms = [];
    this.farmObjects = [];

    // Target: 4 to 8 organic farm plots
    const farmCount = 4 + Math.floor(this.rng() * 5);

    // ── Primary Organic Farmland Placement Loop ─────────────────────
    for (let f = 0; f < farmCount; f++) {
      const targetHouse = this.houses.length > 0 ? this.houses[f % this.houses.length] : null;
      this.generateOrganicFarmPlot(targetHouse, f);
    }

    // ── Fallback Safety Loop (guarantee at least 4 organic farm plots) ──────
    let safetyFarms = 0;
    while (this.farms.length < 4 && safetyFarms++ < 25) {
      this.generateOrganicFarmPlot(null, this.farms.length + safetyFarms * 11);
    }

    return {
      farms: this.farms,
      farmObjects: this.farmObjects,
    };
  }

  /**
   * Generates a single organic farm plot using multi-oval/multi-lobe merging.
   * Eliminates straight borders, rectangular boxes, and 90-degree corners.
   */
  private generateOrganicFarmPlot(targetHouse: PlacedObject | null, plotIndex: number): boolean {
    const hasBorder = this.rng() < 0.35; // 35% chance of rustic fencing along one curved flank
    const farmSeed = this.rng() * 10000;

    // Organic farm dimensions: 18 to 28 cells wide, 10 to 16 cells tall
    const targetW = 18 + Math.floor(this.rng() * 11);
    const targetH = 10 + Math.floor(this.rng() * 7);

    for (let attempt = 0; attempt < 320; attempt++) {
      let cx: number;
      let cy: number;

      if (targetHouse && attempt < 120) {
        const angle = this.rng() * Math.PI * 2;
        const dist = 9 + this.rng() * 22;
        cx = Math.round(targetHouse.x + Math.cos(angle) * dist);
        cy = Math.round(targetHouse.y + Math.sin(angle) * dist);
      } else {
        cx = Math.floor(targetW / 2 + 4 + this.rng() * (this.width - targetW - 8));
        cy = Math.floor(targetH / 2 + 4 + this.rng() * (this.height - targetH - 8));
      }

      // Keep center safely within world bounds
      cx = Math.max(Math.floor(targetW / 2) + 2, Math.min(this.width - Math.ceil(targetW / 2) - 3, cx));
      cy = Math.max(Math.floor(targetH / 2) + 2, Math.min(this.height - Math.ceil(targetH / 2) - 3, cy));

      // Construct 2 to 4 overlapping organic lobes to form a naturally curvy field
      const numLobes = 2 + (this.rng() < 0.75 ? 1 : 0) + (this.rng() < 0.35 ? 1 : 0);
      const lobes: { cx: number; cy: number; rx: number; ry: number }[] = [];

      // Main central lobe
      const baseRx = (targetW * 0.40) * (0.88 + this.rng() * 0.24);
      const baseRy = (targetH * 0.38) * (0.88 + this.rng() * 0.24);
      lobes.push({
        cx: cx + (this.rng() - 0.5) * 2,
        cy: cy + (this.rng() - 0.5) * 1.5,
        rx: baseRx,
        ry: baseRy,
      });

      // Secondary and tertiary offset lobes (creates soft curvature, asymmetrical bulges, and terraced contours)
      const primaryAngle = this.rng() * Math.PI * 2;
      for (let l = 1; l < numLobes; l++) {
        const angle = primaryAngle + (l === 1 ? 0 : Math.PI * 0.75 + (this.rng() - 0.5) * 0.8);
        const dist = 3 + this.rng() * 4.5;
        const lobeRx = baseRx * (0.65 + this.rng() * 0.30);
        const lobeRy = baseRy * (0.65 + this.rng() * 0.30);
        lobes.push({
          cx: cx + Math.cos(angle) * dist,
          cy: cy + Math.sin(angle) * (dist * 0.65),
          rx: lobeRx,
          ry: lobeRy,
        });
      }

      // Sample all integer grid coordinates in the bounding vicinity
      const minX = Math.max(2, Math.floor(cx - targetW / 2 - 2));
      const maxX = Math.min(this.width - 3, Math.ceil(cx + targetW / 2 + 2));
      const minY = Math.max(2, Math.floor(cy - targetH / 2 - 2));
      const maxY = Math.min(this.height - 3, Math.ceil(cy + targetH / 2 + 2));

      const candidateCells: { x: number; y: number }[] = [];
      let collisionFailed = false;

      for (let gy = minY; gy <= maxY; gy++) {
        for (let gx = minX; gx <= maxX; gx++) {
          // Check if inside any of the organic lobes
          let inside = false;
          for (let li = 0; li < lobes.length; li++) {
            const lobe = lobes[li];
            const dx = gx - lobe.cx;
            const dy = gy - lobe.cy;
            const angle = Math.atan2(dy, dx);
            // Smooth harmonic edge wobble (eliminates sterile straight-line boundaries)
            const wobble = 1.0 + 0.16 * Math.sin(angle * 3 + farmSeed + li) + 0.08 * Math.cos(angle * 5 + 1.2);
            const distSq = (dx * dx) / (lobe.rx * lobe.rx) + (dy * dy) / (lobe.ry * lobe.ry);
            if (distSq <= wobble) {
              inside = true;
              break;
            }
          }

          if (!inside) continue;

          // Check if cell is occupied or forbidden
          const cell = this.grid[gy][gx];
          if (
            cell.isRoad ||
            cell.isRoadReserved ||
            cell.isWater ||
            cell.isFarm ||
            cell.blocked ||
            cell.terrain === 'sand_tile_01'
          ) {
            // If the center of the farm collides with road/water, this spot won't work
            const centerDist = Math.hypot(gx - cx, gy - cy);
            if (centerDist < 4) {
              collisionFailed = true;
              break;
            }
            continue; // Organic boundary adapts around natural obstacles
          }

          // 1-tile buffer clearance around roads, reserved roads, and water
          let nearObstacle = false;
          for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
              const nx = gx + ox;
              const ny = gy + oy;
              if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                const nc = this.grid[ny][nx];
                if (nc.isRoad || nc.isRoadReserved || nc.isWater) {
                  nearObstacle = true;
                  break;
                }
              }
            }
            if (nearObstacle) break;
          }

          if (!nearObstacle) {
            candidateCells.push({ x: gx, y: gy });
          }
        }
        if (collisionFailed) break;
      }

      if (collisionFailed) continue;

      // Filter out isolated stray single pixels (must have at least 2 adjacent neighbors in candidate set)
      const cellSet = new Set(candidateCells.map(c => `${c.x},${c.y}`));
      const organicCells = candidateCells.filter(c => {
        let neighborCount = 0;
        if (cellSet.has(`${c.x + 1},${c.y}`)) neighborCount++;
        if (cellSet.has(`${c.x - 1},${c.y}`)) neighborCount++;
        if (cellSet.has(`${c.x},${c.y + 1}`)) neighborCount++;
        if (cellSet.has(`${c.x},${c.y - 1}`)) neighborCount++;
        return neighborCount >= 2;
      });

      // Require a substantial plot size (at least 32 cells, up to ~160 cells)
      if (organicCells.length < 32) continue;

      // Till the soil across the organic curved footprint
      for (const c of organicCells) {
        this.grid[c.y][c.x].isFarm = true;
        this.grid[c.y][c.x].terrain = 'dirt_tile_01';
      }

      // Compute actual bounding box of this organic plot
      let pMinX = this.width;
      let pMaxX = 0;
      let pMinY = this.height;
      let pMaxY = 0;
      for (const c of organicCells) {
        if (c.x < pMinX) pMinX = c.x;
        if (c.x > pMaxX) pMaxX = c.x;
        if (c.y < pMinY) pMinY = c.y;
        if (c.y > pMaxY) pMaxY = c.y;
      }

      const tilledCells: FarmCell[] = organicCells.map(c => ({ x: c.x, y: c.y }));

      this.farms.push({
        x: pMinX,
        y: pMinY,
        w: pMaxX - pMinX + 1,
        h: pMaxY - pMinY + 1,
        cells: tilledCells,
        cropBaseId: '',
      });

      // Place rustic farm props (crates, barrels, troughs, hay bales) on grass cells bordering the tilled soil
      const borderGrassSlots: { x: number; y: number }[] = [];
      for (const c of tilledCells) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (Math.abs(dx) + Math.abs(dy) !== 1) continue;
            const bx = c.x + dx;
            const by = c.y + dy;
            if (bx >= 0 && bx < this.width && by >= 0 && by < this.height) {
              const bgCell = this.grid[by][bx];
              if (!bgCell.isFarm && !bgCell.isRoad && !bgCell.isWater && !bgCell.blocked) {
                borderGrassSlots.push({ x: bx, y: by });
              }
            }
          }
        }
      }

      // Shuffle slots
      for (let i = borderGrassSlots.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [borderGrassSlots[i], borderGrassSlots[j]] = [borderGrassSlots[j], borderGrassSlots[i]];
      }

      const numProps = Math.min(borderGrassSlots.length, 2 + Math.floor(this.rng() * 3));
      for (let i = 0; i < numProps; i++) {
        const slot = borderGrassSlots[i];
        if (!this.grid[slot.y][slot.x].blocked) {
          const objId = FARM_OBJECT_IDS[Math.floor(this.rng() * FARM_OBJECT_IDS.length)];
          this.grid[slot.y][slot.x].blocked = true;
          this.farmObjects.push({
            id: objId,
            name: objId,
            type: 'farm_object',
            x: slot.x,
            y: slot.y,
            footprintW: 1,
            footprintH: 1,
          });
        }
      }

      // Rustic fencing: placed along a single curved flank (or road-facing side), NOT a rigid rectangular box!
      if (hasBorder && borderGrassSlots.length > 0) {
        // Pick one flank: e.g. northernmost or southernmost border grass slots
        const flankY = this.rng() < 0.5 ? pMinY - 1 : pMaxY + 1;
        const flankSlots = borderGrassSlots.filter(s => Math.abs(s.y - flankY) <= 1 && !this.grid[s.y][s.x].blocked);
        const fenceCount = Math.min(flankSlots.length, 4 + Math.floor(this.rng() * 4));
        for (let i = 0; i < fenceCount; i++) {
          // Leave natural openings every 3-4 segments
          if (i % 4 === 3) continue;
          const s = flankSlots[i];
          if (!s || this.grid[s.y][s.x].blocked || this.grid[s.y][s.x].isRoad || this.grid[s.y][s.x].isWater) continue;
          this.grid[s.y][s.x].blocked = true;
          this.farmObjects.push({
            id: 'fence_wood_h',
            name: 'fence_wood_h',
            type: 'farm_object',
            x: s.x,
            y: s.y,
            footprintW: 1,
            footprintH: 1,
          });
        }
      }

      return true;
    }

    return false;
  }
}

/**
 * Top-level convenience runner for Phase 4: Farmland Layout
 */
export function generateFarmlands(
  settlement: SettlementData,
  seed?: number
): FarmlandResult {
  const farmlandGen = new FarmlandGenerator(settlement, seed);
  const result = farmlandGen.generate();
  settlement.farms = result.farms;
  settlement.farmObjects = result.farmObjects;
  return result;
}
