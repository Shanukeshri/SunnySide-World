import { SettlementData } from '../generation/SettlementGenerator';
import { EnvironmentInfo, EnvironmentType } from './types';

export class EnvironmentDetector {
  private settlementData: SettlementData;
  private jungleZones: Array<{ x: number; y: number; radius: number }> = [];

  constructor(data: SettlementData) {
    this.settlementData = data;
    this.detectJungleClusters();
  }

  public updateSettlementData(data: SettlementData): void {
    this.settlementData = data;
    this.detectJungleClusters();
  }

  /**
   * Identifies dense tree clusters containing >= 20 trees as "Jungle" environments.
   */
  private detectJungleClusters(): void {
    this.jungleZones = [];
    const trees = this.settlementData.trees || [];
    if (trees.length === 0) return;

    // Spatial binning to find clusters of trees
    const visited = new Set<number>();
    const CLUSTER_DISTANCE = 4.0; // Distance within which trees belong to the same grove

    for (let i = 0; i < trees.length; i++) {
      if (visited.has(i)) continue;

      const cluster: Array<{ x: number; y: number }> = [];
      const queue: number[] = [i];
      visited.add(i);

      while (queue.length > 0) {
        const currentIdx = queue.shift()!;
        const currentTree = trees[currentIdx];
        cluster.push({ x: currentTree.x, y: currentTree.y });

        for (let j = 0; j < trees.length; j++) {
          if (visited.has(j)) continue;
          const otherTree = trees[j];
          const dist = Math.hypot(currentTree.x - otherTree.x, currentTree.y - otherTree.y);
          if (dist <= CLUSTER_DISTANCE) {
            visited.add(j);
            queue.push(j);
          }
        }
      }

      // Specification: Jungle (dense tree clusters >= 20 trees)
      if (cluster.length >= 20) {
        const avgX = cluster.reduce((sum, t) => sum + t.x, 0) / cluster.length;
        const avgY = cluster.reduce((sum, t) => sum + t.y, 0) / cluster.length;
        let maxRadius = 0;
        for (const t of cluster) {
          const d = Math.hypot(t.x - avgX, t.y - avgY);
          if (d > maxRadius) maxRadius = d;
        }
        this.jungleZones.push({
          x: avgX,
          y: avgY,
          radius: Math.max(maxRadius + 2, 5),
        });
      }
    }
  }

  /**
   * Checks if a logical tile coordinate is traversable for entities.
   */
  public isWalkable(x: number, y: number, allowWater: boolean = false, waterOnly: boolean = false): boolean {
    const margin = 0.6;
    if (
      x < margin ||
      x >= this.settlementData.width - margin ||
      y < margin ||
      y >= this.settlementData.height - margin
    ) {
      return false;
    }

    const tileX = Math.floor(x);
    const tileY = Math.floor(y);
    const row = this.settlementData.grid[tileY];
    if (!row) return false;
    const cell = row[tileX];
    if (!cell) return false;

    const isCellWater = cell.isWater || cell.terrain?.startsWith('water_');

    // If creature is swimming (e.g. ducks in pond)
    if (waterOnly) {
      return Boolean(isCellWater || cell.terrain === 'shore_transition_01');
    }

    // Land creature walking into water
    if (isCellWater && !allowWater) {
      return false;
    }

    // Buildings & solid structures (houses)
    for (const house of this.settlementData.houses) {
      if (
        x >= house.x - 0.2 &&
        x <= house.x + house.footprintW + 0.2 &&
        y >= house.y - 0.2 &&
        y <= house.y + house.footprintH + 0.2
      ) {
        return false;
      }
    }

    // Wells
    for (const well of this.settlementData.wells) {
      if (
        x >= well.x - 0.2 &&
        x <= well.x + well.footprintW + 0.2 &&
        y >= well.y - 0.2 &&
        y <= well.y + well.footprintH + 0.2
      ) {
        return false;
      }
    }

    // Solid tree trunks (small 0.6x0.6 radius around trunk center)
    for (const tree of this.settlementData.trees) {
      const trunkX = tree.x + (tree.footprintW || 1) / 2;
      const trunkY = tree.y + (tree.footprintH || 1) / 2;
      if (Math.hypot(x - trunkX, y - trunkY) < 0.5) {
        return false;
      }
    }

    return true;
  }

  /**
   * Computes the distance to the nearest village structure (houses, well, roads).
   */
  public getDistanceToVillageCenter(x: number, y: number): number {
    const houses = this.settlementData.houses;
    if (houses.length === 0) return 999;

    let minDist = 999;
    for (const h of houses) {
      const cx = h.x + h.footprintW / 2;
      const cy = h.y + h.footprintH / 2;
      const d = Math.hypot(x - cx, y - cy);
      if (d < minDist) minDist = d;
    }
    return minDist;
  }

  /**
   * Analyzes the environment at a specific coordinate.
   */
  public getEnvironmentAt(x: number, y: number): EnvironmentInfo {
    const tileX = Math.max(0, Math.min(this.settlementData.width - 1, Math.floor(x)));
    const tileY = Math.max(0, Math.min(this.settlementData.height - 1, Math.floor(y)));
    const cell = this.settlementData.grid[tileY]?.[tileX];

    const distToVillage = this.getDistanceToVillageCenter(x, y);

    // Tree density in 4-tile radius
    let nearbyTrees = 0;
    for (const tree of this.settlementData.trees) {
      if (Math.hypot(x - tree.x, y - tree.y) <= 4.0) {
        nearbyTrees++;
      }
    }

    // Check Jungle
    const inJungle = this.jungleZones.some(
      (j) => Math.hypot(x - j.x, y - j.y) <= j.radius
    ) || nearbyTrees >= 8;

    const isWater = Boolean(cell?.isWater || cell?.terrain?.startsWith('water_'));
    const isVillage = distToVillage <= 7.0 || Boolean(cell?.isRoad) || Boolean(cell?.isFarm);

    let type: EnvironmentType = 'GRASSLAND';

    if (isWater) {
      type = 'WATER';
    } else if (inJungle) {
      type = 'JUNGLE';
    } else if (isVillage) {
      type = 'VILLAGE';
    } else {
      type = 'GRASSLAND';
    }

    const hasGrass = Boolean(
      cell &&
      !cell.isWater &&
      !cell.isRoad &&
      !cell.blocked &&
      (cell.terrain.includes('grass') || cell.terrain.includes('plain'))
    );

    return {
      grass: hasGrass,
      water: isWater,
      village: isVillage,
      denseTrees: inJungle,
      type,
      isWalkable: this.isWalkable(x, y),
      hasGrass,
      treeDensity: nearbyTrees,
      distToVillageCenter: distToVillage,
    };
  }

  /**
   * Finds an edible grass patch near an entity position.
   */
  public findNearbyGrass(
    originX: number,
    originY: number,
    radius: number = 5.0
  ): { x: number; y: number } | null {
    const startX = Math.max(0, Math.floor(originX - radius));
    const endX = Math.min(this.settlementData.width - 1, Math.ceil(originX + radius));
    const startY = Math.max(0, Math.floor(originY - radius));
    const endY = Math.min(this.settlementData.height - 1, Math.ceil(originY + radius));

    const candidates: Array<{ x: number; y: number; dist: number }> = [];

    for (let py = startY; py <= endY; py++) {
      for (let px = startX; px <= endX; px++) {
        const d = Math.hypot(px + 0.5 - originX, py + 0.5 - originY);
        if (d <= radius && this.isWalkable(px + 0.5, py + 0.5)) {
          const cell = this.settlementData.grid[py]?.[px];
          if (
            cell &&
            !cell.isWater &&
            !cell.isRoad &&
            !cell.isFarm &&
            !cell.blocked &&
            cell.terrain.includes('grass')
          ) {
            candidates.push({ x: px + 0.5, y: py + 0.5, dist: d });
          }
        }
      }
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.dist - b.dist);
    // Return one of the nearest valid patches
    return { x: candidates[0].x, y: candidates[0].y };
  }

  /**
   * Finds a walkable spawn location matching preferred environments.
   */
  public findSpawnLocation(
    preferred: EnvironmentType[],
    maxAttempts: number = 30,
    rngGen: () => number
  ): { x: number; y: number } | null {
    // If WATER is preferred and water bodies exist, spawn directly inside pond!
    if (preferred.includes('WATER') && this.settlementData.waterBodies && this.settlementData.waterBodies.length > 0) {
      const validBodies = this.settlementData.waterBodies.filter((b) => b.cells.length > 0);
      if (validBodies.length > 0) {
        const body = validBodies[Math.floor(rngGen() * validBodies.length)];
        const cell = body.cells[Math.floor(rngGen() * body.cells.length)];
        return { x: cell.x + 0.5, y: cell.y + 0.5 };
      }
    }

    const w = this.settlementData.width;
    const h = this.settlementData.height;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const rx = 2 + rngGen() * (w - 4);
      const ry = 2 + rngGen() * (h - 4);

      if (!this.isWalkable(rx, ry)) continue;

      const env = this.getEnvironmentAt(rx, ry);
      if (preferred.includes(env.type)) {
        return { x: rx, y: ry };
      }
    }

    // Fallback: any walkable spot
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const rx = 2 + rngGen() * (w - 4);
      const ry = 2 + rngGen() * (h - 4);
      if (this.isWalkable(rx, ry)) {
        return { x: rx, y: ry };
      }
    }

    return null;
  }
}
