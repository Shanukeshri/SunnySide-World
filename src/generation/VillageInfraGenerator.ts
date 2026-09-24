// ═══════════════════════════════════════════════════════════════════
// VILLAGE INFRASTRUCTURE GENERATOR MODULE (Phase 3: Civic Infra)
// ═══════════════════════════════════════════════════════════════════

import {
  AssetId,
  GridCoord,
  PlacedObject,
  SettlementCell,
} from './SettlementGenerator';

export interface VillageInfraResult {
  wells: PlacedObject[];
  roadCells: GridCoord[];
}

export class VillageInfraGenerator {
  private grid: SettlementCell[][];
  private houses: PlacedObject[];
  private roadCells: GridCoord[];
  private width: number;
  private height: number;
  private rng: () => number;
  private wells: PlacedObject[] = [];

  constructor(
    grid: SettlementCell[][],
    houses: PlacedObject[],
    roadCells: GridCoord[],
    width: number,
    height: number,
    rng: () => number
  ) {
    this.grid = grid;
    this.houses = houses;
    this.roadCells = roadCells;
    this.width = width;
    this.height = height;
    this.rng = rng;
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

  /**
   * Connects each house door to the nearest road located strictly south of it.
   */
  public connectHousesToRoads(): GridCoord[] {
    for (const house of this.houses) {
      if (!house.door) continue;
      const startX = house.door.x;
      const startY = house.door.y;

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

      let cx = startX;
      let cy = startY + 1;

      while (cy < this.height) {
        if (this.grid[cy][cx].isRoad) {
          break;
        }

        if (cy >= 0 && cy < this.height && cx >= 0 && cx < this.width) {
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

        if (cy < closestRoad.y) {
          cy++;
        } else if (cx !== closestRoad.x) {
          cx += Math.sign(closestRoad.x - cx);
        } else {
          break;
        }
      }
    }

    return this.roadCells;
  }

  /**
   * Reserves a 1-tile clearance buffer along roads so structures don't choke thoroughfares.
   */
  public reserveRoadClearance(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[y][x].isRoad) {
          this.grid[y][x].isRoadReserved = true;
          continue;
        }

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

  /**
   * Spawns civic wells (stone or roofed) beside roads and town houses.
   */
  public generateWells(): PlacedObject[] {
    this.wells = [];
    const wellCount = this.rng() > 0.3 ? (this.rng() > 0.5 ? 2 : 1) : 0;

    for (let w = 0; w < wellCount; w++) {
      const wellId = this.rng() > 0.5 ? 'farm_well' : 'farm_well_covered';

      for (let attempt = 0; attempt < 80; attempt++) {
        let targetX = 0;
        let targetY = 0;

        if (this.houses.length > 0) {
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

    return this.wells;
  }

  /**
   * Runs the complete village infrastructure phase sequentially.
   */
  public generate(): VillageInfraResult {
    this.connectHousesToRoads();
    this.reserveRoadClearance();
    const wells = this.generateWells();

    return {
      wells,
      roadCells: this.roadCells,
    };
  }
}

/**
 * Top-level convenience runner for Phase 3: Village Infrastructure
 */
export function generateVillageInfrastructure(
  grid: SettlementCell[][],
  houses: PlacedObject[],
  roadCells: GridCoord[],
  width: number,
  height: number,
  rng: () => number
): VillageInfraResult {
  const infraGen = new VillageInfraGenerator(grid, houses, roadCells, width, height, rng);
  return infraGen.generate();
}
