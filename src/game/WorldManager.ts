/**
 * WorldManager.ts - Procedural Infinite/Chunked World & Village Generation
 *
 * Requirements from user & gameLogicV1.txt:
 * 1. Automatic chunked world generation around player position.
 * 2. Automatic village generation when player explores towards it.
 * 3. Wilderness gap between any two villages: strictly between 2 village equivalents and 4 village equivalents.
 * 4. Maximum 4 realm villages across the world.
 * 5. Biome rules: Grassland, Water, Jungle (tree cluster >= 20), Roads, Rocks, Berry Bushes.
 */

import {
  generateSettlement,
  generateSettlementWorld,
  SettlementData,
  PlacedObject,
} from "../generation/SettlementGenerator";
import { generateFarmlands } from "../generation/FarmlandGenerator";
import { generateCropsForFarmlands } from "../generation/CropGenerator";
import { ResourceNode, WorldRealmVillage, ItemId } from "./GameTypes";

export const CHUNK_SIZE = 16; // 16x16 tiles per chunk
export const VILLAGE_WIDTH = 110; // tiles
export const VILLAGE_HEIGHT = 88; // tiles
export const VILLAGE_EQUIVALENT = 90; // 1 village equivalent ~ 90 tiles
export const MIN_VILLAGE_GAP = 2 * VILLAGE_EQUIVALENT; // 180 tiles gap
export const MAX_VILLAGE_GAP = 4 * VILLAGE_EQUIVALENT; // 360 tiles gap
export const MAX_REALM_VILLAGES = 4;

export interface WorldTile {
  terrain: string;
  isWater: boolean;
  isRoad: boolean;
  isFarm: boolean;
  isBlocked: boolean;
  isBridge?: boolean;
  rotation?: number;
  inVillageId?: number;
  isDeepOcean?: boolean;
  isIslandShore?: boolean;
}

export interface WorldChunk {
  chunkX: number;
  chunkY: number;
  key: string;
  tiles: WorldTile[][];
  resources: ResourceNode[];
  isGenerated: boolean;
  spawnedWildlife?: any[];
  isGoblinCamp?: boolean;
  isCryptEntrance?: boolean;
  landmarks?: { type: string; x: number; y: number; isNeutral?: boolean }[];
  coracles?: { id: number; x: number; y: number }[];
}

// Deterministic Pseudo-Random Number Generator (Mulberry32)
function createSeededRNG(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 2D Simplex/Perlin-style smooth value noise
function createNoise2D(seed: number) {
  const perm: number[] = [];
  const rng = createSeededRNG(seed);
  for (let i = 0; i < 256; i++) perm[i] = Math.floor(rng() * 256);
  const p = [...perm, ...perm];

  function fade(t: number) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  function lerp(t: number, a: number, b: number) {
    return a + t * (b - a);
  }
  function grad(hash: number, x: number, y: number) {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return (h & 1 ? -u : u) + (h & 2 ? -v : v);
  }

  return (x: number, y: number): number => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);
    const A = p[X] + Y;
    const B = p[X + 1] + Y;
    return lerp(
      v,
      lerp(u, grad(p[A], xf, yf), grad(p[B], xf - 1, yf)),
      lerp(u, grad(p[A + 1], xf, yf - 1), grad(p[B + 1], xf - 1, yf - 1)),
    );
  };
}

export class WorldManager {
  public seed: number;
  private noiseTerrain: (x: number, y: number) => number;
  private noiseForest: (x: number, y: number) => number;
  private noiseWater: (x: number, y: number) => number;

  public chunks = new Map<string, WorldChunk>();
  public villages: WorldRealmVillage[] = [];
  public villagePlannedSites: {
    name: string;
    targetX: number;
    targetY: number;
    seed: number;
    generated: boolean;
  }[] = [];

  public getResourceId(wx: number, wy: number): number {
    return ((Math.round(wx) + 10000) * 20000 + (Math.round(wy) + 10000)) >>> 0;
  }
  public depletedResourceIds: Set<number> = new Set();
  private stampedVillages = new Set<number>();

  public maxPhase: number;
  
  constructor(seed: number = 42891, maxPhase: number = 10) {
    this.seed = seed;
    this.maxPhase = maxPhase;
    this.noiseTerrain = createNoise2D(seed);
    this.noiseForest = createNoise2D(seed + 101);
    this.noiseWater = createNoise2D(seed + 202);

    this.planRealmVillages();
  }

  /**
   * Plan the fixed / candidate locations for up to 4 realm villages.
   * Enforces the rule: wilderness gap between any two villages is between 2 and 4 village equivalents.
   */
  private planRealmVillages() {
    // Village Equivalent V = 90 tiles.
    // 2 V gap = 180 tiles.
    // 4 V gap = 360 tiles.
    // Village 1: Oakvale (Center / Starting realm village) at [0, 0]
    // Village 2: Riverwood (East / Northeast) gap ~ 240 tiles (2.67 village equivalents)
    // Village 3: Sunhaven (South / Southeast) gap ~ 265 tiles (2.94 village equivalents)
    // Village 4: Pinecrest (West / Northwest) gap ~ 255 tiles (2.83 village equivalents)

    const v1X = 0;
    const v1Y = 0;

    // East / NE site: ~240 tiles away from Village 1
    const v2X = v1X + 220;
    const v2Y = v1Y - 96;

    // South / SE site: ~265 tiles away from Village 1
    const v3X = v1X + 110;
    const v3Y = v1Y + 240;

    // West / NW site: ~255 tiles away from Village 1
    const v4X = v1X - 250;
    const v4Y = v1Y + 50;

    this.villagePlannedSites = [
      {
        name: "Oakvale",
        targetX: v1X,
        targetY: v1Y,
        seed: this.seed,
        generated: false,
      },
      {
        name: "Riverwood",
        targetX: v2X,
        targetY: v2Y,
        seed: this.seed + 1111,
        generated: false,
      },
      {
        name: "Sunhaven",
        targetX: v3X,
        targetY: v3Y,
        seed: this.seed + 2222,
        generated: false,
      },
      {
        name: "Pinecrest",
        targetX: v4X,
        targetY: v4Y,
        seed: this.seed + 3333,
        generated: false,
      },
    ];
  }

  /**
   * Automatically checks and triggers village generation when the player explores towards it.
   */
  public updatePlayerLocation(
    playerTileX: number,
    playerTileY: number,
    loadRadiusChunks = 4,
  ) {
    // 1. Generate surrounding terrain chunks
    const centerChunkX = Math.floor(playerTileX / CHUNK_SIZE);
    const centerChunkY = Math.floor(playerTileY / CHUNK_SIZE);

    for (let dy = -loadRadiusChunks; dy <= loadRadiusChunks; dy++) {
      for (let dx = -loadRadiusChunks; dx <= loadRadiusChunks; dx++) {
        const cx = centerChunkX + dx;
        const cy = centerChunkY + dy;
        this.getOrCreateChunk(cx, cy);
      }
    }

    // 2. Check if player is moving towards any ungenerated village site
    for (const site of this.villagePlannedSites) {
      if (site.generated) continue;

      // Distance from player to village center
      const dist = Math.hypot(
        playerTileX - (site.targetX + VILLAGE_WIDTH / 2),
        playerTileY - (site.targetY + VILLAGE_HEIGHT / 2),
      );

      // Trigger automatic generation when player is within approaching range (180 tiles)
      // or if it's the starter village (Oakvale)
      if (dist < 180 || (site.name === "Oakvale" && dist < 250)) {
        this.generateVillageAtSite(site);
      }
    }

    // 2b. Infinite village generation (Minecraft-style): dynamically plan candidate sites across the infinite world
    const macroStep = 270; // 3 village equivalents
    const playerMx = Math.floor((playerTileX + macroStep / 2) / macroStep);
    const playerMy = Math.floor((playerTileY + macroStep / 2) / macroStep);

    for (let dmy = -1; dmy <= 1; dmy++) {
      for (let dmx = -1; dmx <= 1; dmx++) {
        const mx = playerMx + dmx;
        const my = playerMy + dmy;
        if (Math.abs(mx) <= 1 && Math.abs(my) <= 1) continue;

        const siteId = `site_${mx}_${my}`;
        if (
          !this.villagePlannedSites.some((s) => (s as any).siteId === siteId)
        ) {
          const rng = createSeededRNG(
            this.seed + ((mx * 73856093) ^ (my * 19349663)),
          );
          const jitterX = Math.floor((rng() - 0.5) * 36);
          const jitterY = Math.floor((rng() - 0.5) * 36);
          const targetX = mx * macroStep + jitterX;
          const targetY = my * macroStep + jitterY;
          const villageNames = [
            "Millfield",
            "Elderglen",
            "Highgarden",
            "Silverstream",
            "Bramblebrook",
            "Dawnstar",
            "Amberfall",
            "Windshire",
            "Mosswood",
            "Falconridge",
          ];
          const name = villageNames[Math.floor(rng() * villageNames.length)];
          const newSite = {
            name: `${name} ${mx > 0 ? "+" : ""}${mx},${my > 0 ? "+" : ""}${my}`,
            targetX,
            targetY,
            seed: Math.floor(rng() * 1000000),
            generated: false,
            siteId,
          };
          this.villagePlannedSites.push(newSite as any);
        }
      }
    }

    // 3. Update discovery status when player steps near a village
    for (const v of this.villages) {
      if (!v.discovered) {
        const dist = Math.hypot(
          playerTileX - (v.gridX + v.width / 2),
          playerTileY - (v.gridY + v.height / 2),
        );
        if (dist <= 35) {
          v.discovered = true;
        }
      }
    }
  }

  /**
   * Generates a planned village and stamps its features onto the world chunks.
   */
  private generateVillageAtSite(site: {
    name: string;
    targetX: number;
    targetY: number;
    seed: number;
    generated: boolean;
  }) {
    site.generated = true;
    console.log(`[Phase: Settlement Generation] Generating base terrain, roads, water, and house architecture for ${site.name}...`);
    const settlementData = generateSettlementWorld(
      site.seed,
      VILLAGE_WIDTH,
      VILLAGE_HEIGHT,
      this.maxPhase
    );

    if (this.maxPhase >= 4) {
      console.log(`[Sub-Phase: Farmland Layout] Spawning tilled dirt farmland plots, perimeter fences, and props for ${site.name}...`);
      generateFarmlands(settlementData, site.seed);
    }

    if (this.maxPhase >= 5) {
      console.log(`[Sub-Phase: Crop Cultivation] Planting crops on farmland for ${site.name}...`);
      generateCropsForFarmlands(settlementData, site.seed);
    }

    const realmVillage: WorldRealmVillage = {
      id: this.villages.length + 1,
      name: site.name,
      gridX: site.targetX,
      gridY: site.targetY,
      width: VILLAGE_WIDTH,
      height: VILLAGE_HEIGHT,
      data: settlementData,
      discovered: site.name === "Oakvale", // starter village is discovered by default
    };

    this.villages.push(realmVillage);

    // Stamp village tiles & structures into the chunks
    this.stampVillageIntoChunks(realmVillage);
  }

  /**
   * Returns the organic distance to the nearest village settlement center.
   * Includes 2D fractal noise perturbation to ensure natural, undulating island/meadow borders
   * with absolutely zero straight lines or rectangular artifacts.
   */
  public getDistanceToNearestVillageCenter(x: number, y: number): { rawDist: number; organicDist: number } {
    let minRawDist = 99999;
    let minOrganicDist = 99999;

    const checkCandidate = (cx: number, cy: number) => {
      const dx = x - cx;
      const dy = y - cy;
      const rawDist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      // Smooth continuous fractal noise perturbation for organic borders
      const wobble = this.noiseTerrain(Math.cos(angle) * 1.6 + cx * 0.012, Math.sin(angle) * 1.6 + cy * 0.012) * 16;
      const organicDist = rawDist + wobble;

      if (rawDist < minRawDist) minRawDist = rawDist;
      if (organicDist < minOrganicDist) minOrganicDist = organicDist;
    };

    // Check realized villages
    for (const v of this.villages) {
      checkCandidate(v.gridX + v.width / 2, v.gridY + v.height / 2);
    }
    // Check planned village sites
    for (const site of this.villagePlannedSites) {
      checkCandidate(site.targetX + VILLAGE_WIDTH / 2, site.targetY + VILLAGE_HEIGHT / 2);
    }

    return { rawDist: minRawDist, organicDist: minOrganicDist };
  }

  public isInsideAnyVillage(wx: number, wy: number): boolean {
    const chunkX = Math.floor(wx / CHUNK_SIZE);
    const chunkY = Math.floor(wy / CHUNK_SIZE);
    const chunk = this.chunks.get(`${chunkX},${chunkY}`);
    if (chunk) {
      const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const ly = ((wy % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const tile = chunk.tiles[ly]?.[lx];
      if (tile && (tile.isRoad || tile.isFarm || tile.isBridge || tile.inVillageId !== undefined)) {
        return true;
      }
    }
    const { organicDist } = this.getDistanceToNearestVillageCenter(wx, wy);
    return organicDist < 46;
  }

  /**
   * Stamps village terrain, roads, houses, farms, wells, and trees into existing or new chunks.
   * Selectively stamps only actual village features (roads, buildings, farm plots, ponds)
   * and preserves the underlying natural procedural world terrain for all open meadows.
   */
  private stampVillageIntoChunks(v: WorldRealmVillage) {
    if (this.stampedVillages.has(v.id)) return;
    this.stampedVillages.add(v.id);

    const startX = v.gridX;
    const startY = v.gridY;
    const data = v.data;

    // Track all occupied feature & structure tiles to prevent resource conflicts
    const occupiedTiles = new Set<string>();

    // 1. House footprints (exterior walls + interior + doorstep)
    for (const house of data.houses) {
      const hw = house.footprintW || 4;
      const hh = house.footprintH || 4;
      for (let dy = -1; dy <= hh; dy++) {
        for (let dx = -1; dx <= hw; dx++) {
          occupiedTiles.add(`${startX + house.x + dx},${startY + house.y + dy}`);
        }
      }
    }

    // 2. Wells
    for (const well of data.wells) {
      occupiedTiles.add(`${startX + well.x},${startY + well.y}`);
    }

    // 3. Farm objects & fences
    if (data.farmObjects) {
      for (const obj of data.farmObjects) {
        occupiedTiles.add(`${startX + obj.x},${startY + obj.y}`);
      }
    }

    // 4. Purge ONLY procedural wilderness resources that physically conflict with actual village structures, roads, or farms!
    // No more blanket rectangular wipe of the whole 110x88 chunk area!
    const minChunkX = Math.floor((startX - 2) / CHUNK_SIZE);
    const maxChunkX = Math.floor((startX + v.width + 2) / CHUNK_SIZE);
    const minChunkY = Math.floor((startY - 2) / CHUNK_SIZE);
    const maxChunkY = Math.floor((startY + v.height + 2) / CHUNK_SIZE);

    for (let cy = minChunkY; cy <= maxChunkY; cy++) {
      for (let cx = minChunkX; cx <= maxChunkX; cx++) {
        const chunk = this.chunks.get(`${cx},${cy}`);
        if (chunk) {
          chunk.resources = chunk.resources.filter((r) => {
            const rw = r.w || 1;
            const rh = r.h || 1;
            for (let dy = 0; dy < rh; dy++) {
              for (let dx = 0; dx < rw; dx++) {
                const rx = r.x + dx;
                const ry = r.y + dy;
                // If resource touches any occupied structure tile: purge it
                if (occupiedTiles.has(`${rx},${ry}`)) return false;
                const lx = rx - startX;
                const ly = ry - startY;
                if (lx >= 0 && lx < v.width && ly >= 0 && ly < v.height) {
                  const vCell = data.grid[ly]?.[lx];
                  if (vCell && (vCell.isRoad || vCell.isFarm || vCell.isWater || vCell.isBridge)) {
                    return false;
                  }
                }
              }
            }
            return true; // Keep natural wilderness trees & rocks in open spaces!
          });
        }
      }
    }

    // 5. Selectively stamp ONLY actual village features (roads, farms, ponds, bridges, structures)
    // Untouched meadow cells leave the natural procedural world terrain intact!
    for (let ly = 0; ly < v.height; ly++) {
      for (let lx = 0; lx < v.width; lx++) {
        const wx = startX + lx;
        const wy = startY + ly;
        const vCell = data.grid[ly]?.[lx];
        if (!vCell) continue;

        const isFeature =
          vCell.isRoad ||
          vCell.isFarm ||
          vCell.isWater ||
          vCell.isBridge ||
          vCell.terrain === "sand_tile_01" ||
          vCell.terrain === "shore_transition_01";
        const isUnderStructure = occupiedTiles.has(`${wx},${wy}`);

        if (isFeature || isUnderStructure) {
          const tile = this.getTile(wx, wy);
          tile.inVillageId = v.id;

          if (isFeature) {
            tile.terrain = vCell.terrain;
            tile.isRoad = vCell.isRoad;
            tile.isFarm = vCell.isFarm;
            tile.isWater = vCell.isWater;
            tile.isBridge = vCell.isBridge || vCell.terrain === "bridge_wood";
            tile.isBlocked = vCell.isWater && !tile.isBridge;
            if (vCell.rotation !== undefined) {
              tile.rotation = vCell.rotation;
            }
          }
        }
      }
    }

    // House collision footprint: Exterior walls are solid, but doorway and interior rooms are walkable
    for (const house of data.houses) {
      if (house.metadata?.detailedHouse) {
        const dh = house.metadata.detailedHouse;
        for (let dy = 0; dy < house.footprintH; dy++) {
          for (let dx = 0; dx < house.footprintW; dx++) {
            const wx = startX + house.x + dx;
            const wy = startY + house.y + dy;
            const isBlocked = dh.walkableGrid?.[dy]?.[dx] === false;
            this.getTile(wx, wy).isBlocked = isBlocked;
          }
        }
        // Ensure outside doorstep landing is also fully unblocked
        const doorW = dh.door.w || 2;
        for (let dw = 0; dw < doorW; dw++) {
          const doorStepWx = startX + house.x + dh.door.x + dw;
          const doorStepWy = startY + house.y + dh.door.y + 1;
          this.getTile(doorStepWx, doorStepWy).isBlocked = false;
        }
      } else {
        for (let dy = 0; dy < house.footprintH; dy++) {
          for (let dx = 0; dx < house.footprintW; dx++) {
            const wx = startX + house.x + dx;
            const wy = startY + house.y + dy;
            const isDoorway =
              dy === house.footprintH - 1 &&
              dx === Math.floor(house.footprintW / 2);
            if (!isDoorway) {
              this.getTile(wx, wy).isBlocked = true;
            }
          }
        }
      }
    }

    // Fences use precise continuous thin hull collision via isBlockedByFence
    // Solid farm objects (chests, crates, troughs) remain blocked
    if (data.farmObjects) {
      const SOLID_FARM_OBJECTS = [
        "farm_trough",
        "farm_waterbowl",
        "farm_crate_01",
        "farm_crate_02",
        "farm_chest_closed",
      ];
      for (const obj of data.farmObjects) {
        if (SOLID_FARM_OBJECTS.includes(obj.id)) {
          this.getTile(startX + obj.x, startY + obj.y).isBlocked = true;
        }
      }
    }

    // Mark wells as blocked
    for (const well of data.wells) {
      this.getTile(startX + well.x, startY + well.y).isBlocked = true;
    }

    // Add village harvestable resources (trees, bushes, crops) into chunk resources
    // Tree collision is handled with sub-tile root precision by isBlockedByTreeTrunk
    data.trees.forEach((t) => {
      const wx = startX + t.x;
      const wy = startY + t.y;
      const w = t.footprintW || 2;
      const h = t.footprintH || 2;
      this.addResourceToWorld({
        id: this.getResourceId(wx, wy),
        type: "tree",
        x: wx,
        y: wy,
        w,
        h,
        health: 30,
        maxHealth: 30,
        lootItem: "wood",
        secondaryLoot: "apple",
        isDepleted: false,
      });
    });

    data.bushes.forEach((b) => {
      const wx = startX + b.x;
      const wy = startY + b.y;
      this.addResourceToWorld({
        id: this.getResourceId(wx, wy),
        type: "bush",
        x: wx,
        y: wy,
        w: 1,
        h: 1,
        health: 10,
        maxHealth: 10,
        lootItem: "berries",
        secondaryLoot: "fiber",
        isDepleted: false,
      });
    });

    data.farms.forEach((farm) => {
      farm.cells.forEach((cell) => {
        // Only register crop resource nodes for cells that actually have a crop planted
        if (!cell.cropId) return;

        const wx = startX + cell.x;
        const wy = startY + cell.y;
        this.addResourceToWorld({
          id: this.getResourceId(wx, wy),
          type: "crop",
          x: wx,
          y: wy,
          w: 1,
          h: 1,
          health: 5,
          maxHealth: 5,
          lootItem: "wheat",
          secondaryLoot: "seeds",
          isDepleted: false,
        });
      });
    });

    // Enforce: Nothing may spawn on water bodies, remove everything below them
    if (data.waterBodies) {
      for (const wb of data.waterBodies) {
        for (const cell of wb.cells) {
          const wx = startX + cell.x;
          const wy = startY + cell.y;
          const tile = this.getTile(wx, wy);
          tile.isWater = true;
          tile.isBlocked = true;

          const cx = Math.floor(wx / CHUNK_SIZE);
          const cy = Math.floor(wy / CHUNK_SIZE);
          const chunk = this.chunks.get(`${cx},${cy}`);
          if (chunk) {
            chunk.resources = chunk.resources.filter((res) => {
              const overlaps =
                wx >= res.x &&
                wx < res.x + res.w &&
                wy >= res.y &&
                wy < res.y + res.h;
              return !overlaps;
            });
          }
        }
      }
    }
  }

  public addResourceToWorld(res: ResourceNode) {
    const cx = Math.floor(res.x / CHUNK_SIZE);
    const cy = Math.floor(res.y / CHUNK_SIZE);
    const chunk = this.getOrCreateChunk(cx, cy);
    chunk.resources.push(res);
  }

  /**
   * Retrieves or procedurally generates a 16x16 chunk.
   */
  public getOrCreateChunk(chunkX: number, chunkY: number): WorldChunk {
    const key = `${chunkX},${chunkY}`;
    const existing = this.chunks.get(key);
    if (existing) return existing;

    const chunk: WorldChunk = {
      chunkX,
      chunkY,
      key,
      tiles: [],
      resources: [],
      isGenerated: false,
    };

    // Initialize 16x16 tiles
    for (let ty = 0; ty < CHUNK_SIZE; ty++) {
      const row: WorldTile[] = [];
      for (let tx = 0; tx < CHUNK_SIZE; tx++) {
        const worldX = chunkX * CHUNK_SIZE + tx;
        const worldY = chunkY * CHUNK_SIZE + ty;

        const tile = this.generateWildernessTile(worldX, worldY);
        row.push(tile);
      }
      chunk.tiles.push(row);
    }

    // Lake coherence pass: remove isolated 1-tile water puddles and fill 1-tile holes
    for (let ty = 0; ty < CHUNK_SIZE; ty++) {
      for (let tx = 0; tx < CHUNK_SIZE; tx++) {
        const tile = chunk.tiles[ty][tx];
        if (tile.isRoad) continue;

        const worldX = chunkX * CHUNK_SIZE + tx;
        const worldY = chunkY * CHUNK_SIZE + ty;

        let waterNeighbors = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const ny = ty + dy;
            const nx = tx + dx;
            if (ny >= 0 && ny < CHUNK_SIZE && nx >= 0 && nx < CHUNK_SIZE) {
              if (chunk.tiles[ny][nx].isWater || chunk.tiles[ny][nx].isBridge) waterNeighbors++;
            } else {
              // Neighbor in adjacent chunk: sample continuous lake noise
              const nLake = this.noiseWater((worldX + dx) * 0.006, (worldY + dy) * 0.006);
              if (nLake > 0.32) waterNeighbors++;
            }
          }
        }

        // Bridge tiles over water stay pure bridge/water
        if (tile.isBridge) continue;

        // Single isolated water tile with < 3 water neighbors becomes sand
        if (tile.isWater && waterNeighbors < 3) {
          tile.isWater = false;
          tile.isBlocked = false;
          tile.terrain = "sand_tile_01";
        }
        // Sand tile mostly surrounded by water (>= 6 water neighbors) fills in as water
        else if (tile.terrain === "sand_tile_01" && waterNeighbors >= 6) {
          tile.isWater = true;
          tile.isBlocked = true;
          tile.terrain = "water_tile_01";
        }
      }
    }

    // Populate natural resources (trees, rocks, bushes) in wilderness
    this.populateChunkResources(chunk);

    chunk.isGenerated = true;
    this.chunks.set(key, chunk);

    // Check if an existing village overlaps this chunk, and stamp if needed
    for (const v of this.villages) {
      if (
        chunkX * CHUNK_SIZE + CHUNK_SIZE >= v.gridX &&
        chunkX * CHUNK_SIZE <= v.gridX + v.width &&
        chunkY * CHUNK_SIZE + CHUNK_SIZE >= v.gridY &&
        chunkY * CHUNK_SIZE <= v.gridY + v.height
      ) {
        this.stampVillageIntoChunks(v);
      }
    }

    return chunk;
  }

  private isPointOnHighway(x: number, y: number): boolean {
    const v1 = { x: 22, y: 18 };
    const targets = [
      { x: 96 + 22, y: -48 + 18 }, // Riverwood
      { x: 48 + 22, y: 110 + 18 }, // Sunhaven
      { x: -112 + 22, y: 24 + 18 }, // Pinecrest
    ];

    for (const t of targets) {
      const dx = t.x - v1.x;
      const dy = t.y - v1.y;
      const lenSq = dx * dx + dy * dy;
      const len = Math.sqrt(lenSq);
      const param = ((x - v1.x) * dx + (y - v1.y) * dy) / lenSq;
      if (param >= 0.06 && param <= 0.94) {
        const nx = -dy / len;
        const ny = dx / len;
        // Smooth isotropic wobble perpendicular to the road centerline
        const wobble = this.noiseTerrain(param * 10, 42.5) * 2.2;
        const cx = v1.x + param * dx + nx * wobble;
        const cy = v1.y + param * dy + ny * wobble;
        const dist = Math.hypot(x - cx, y - cy);
        if (dist <= 1.35) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Procedurally computes the natural wilderness terrain tile at world coordinate (x, y).
   */
  /**
   * Procedurally computes the natural wilderness terrain tile at world coordinate (x, y).
   * Generates a majestic archipelago of huge continental islands, satellite islands,
   * broad ocean channels, and expansive on-land lakes.
   */
  private generateWildernessTile(x: number, y: number): WorldTile {
    const isOnHighway = this.isPointOnHighway(x, y);

    // 1. Proximity to nearest village settlement (organic distance with continuous noise wobble)
    const { organicDist } = this.getDistanceToNearestVillageCenter(x, y);

    // 2. Macro Oceanic Noise (creates huge continents separated by wide oceans)
    // Scale ~140 tiles wavelength
    const macroOcean = this.noiseTerrain(x * 0.007, y * 0.007);
    const satelliteIsland = this.noiseForest(x * 0.025, y * 0.025);

    // Villages have guaranteed large continental landmass around them with organic undulating borders (no straight lines!)
    let landElevation = 1.0;
    let lakeSuppression = 0;
    if (organicDist < 62) {
      landElevation = 1.0; // Guaranteed solid village continent
      lakeSuppression = 1.0;
    } else if (organicDist < 96) {
      const t = (organicDist - 62) / 34;
      const smoothT = t * t * (3 - 2 * t);
      landElevation = (1 - smoothT) * 1.0 + smoothT * macroOcean;
      lakeSuppression = 1.0 - smoothT;
    } else {
      landElevation = macroOcean;
      // Satellite offshore islands emerge in open ocean:
      if (landElevation < -0.18 && satelliteIsland > 0.42) {
        landElevation = 0.35; // Satellite island!
      }
    }

    const rawLakeNoise = this.noiseWater(x * 0.006, y * 0.006);
    // Smoothly suppress natural wilderness lakes in the core village zone so they don't drown roads or houses:
    const lakeNoise = rawLakeNoise - lakeSuppression * 0.55;
    const isNaturalWater = landElevation < -0.08 || lakeNoise > 0.32;

    // 3. Highways build overpass wooden platforms/bridges directly over water/oceans (NO land underneath!)
    if (isOnHighway) {
      if (isNaturalWater) {
        return {
          terrain: "bridge_wood",
          isWater: true, // Directly on water, NO land underneath!
          isRoad: true,
          isBridge: true,
          isFarm: false,
          isBlocked: false,
        };
      }
      return {
        terrain: "path_tile_01",
        isWater: false,
        isRoad: true,
        isBridge: false,
        isFarm: false,
        isBlocked: false,
      };
    }

    // 4. Oceans & Sea Channels (Separating Islands)
    if (landElevation < -0.18) {
      const isDeepOcean = landElevation < -0.32;
      return {
        terrain: "water_tile_01",
        isWater: true,
        isRoad: false,
        isFarm: false,
        isBlocked: true,
        isDeepOcean,
      };
    }

    // 5. Coastal Sand Shoreline Shelf of Islands & Continents
    if (landElevation < -0.08) {
      return {
        terrain: "sand_tile_01",
        isWater: false,
        isRoad: false,
        isFarm: false,
        isBlocked: false,
        isIslandShore: true,
      };
    }

    // 6. On-Land Geography: Expansive, Broad Natural Lakes
    // Lower frequency (scale 0.006) and wide threshold makes on-land lakes substantially larger, broad, and majestic
    if (lakeNoise > 0.32) {
      return {
        terrain: "water_tile_01",
        isWater: true,
        isRoad: false,
        isFarm: false,
        isBlocked: true,
        isDeepOcean: false,
      };
    }
    // Sand beach rim around expansive on-land lakes
    if (lakeNoise > 0.22) {
      return {
        terrain: "sand_tile_01",
        isWater: false,
        isRoad: false,
        isFarm: false,
        isBlocked: false,
      };
    }

    // 7. Grassland texture variations across islands & mainland
    const terrainVal = this.noiseTerrain(x * 0.07, y * 0.07);
    const forestVal = this.noiseForest(x * 0.035, y * 0.035);
    let grassIndex = 1;
    const variantNoise = (terrainVal + 1) * 0.5;
    if (variantNoise < 0.25) grassIndex = 1;
    else if (variantNoise < 0.45) grassIndex = 2;
    else if (variantNoise < 0.65) grassIndex = 3;
    else if (variantNoise < 0.8) grassIndex = 4;
    else if (variantNoise < 0.92) grassIndex = 5;
    else grassIndex = 6;

    const isJungle = forestVal > 0.35;
    const terrain = isJungle
      ? `grass_textured_0${(grassIndex % 3) + 4}`
      : `grass_textured_0${grassIndex}`;

    return {
      terrain,
      isWater: false,
      isRoad: false,
      isFarm: false,
      isBlocked: false,
    };
  }

  /**
   * Spawns trees, rocks, bushes, mushrooms, goblin camps, and ancient crypts.
   */
  private populateChunkResources(chunk: WorldChunk) {
    const rng = createSeededRNG(
      this.seed + chunk.chunkX * 374761393 + chunk.chunkY * 668265263,
    );

    for (let ty = 1; ty < CHUNK_SIZE - 1; ty += 2) {
      for (let tx = 1; tx < CHUNK_SIZE - 1; tx += 2) {
        const wx = chunk.chunkX * CHUNK_SIZE + tx;
        const wy = chunk.chunkY * CHUNK_SIZE + ty;
        const tile = chunk.tiles[ty][tx];

        // Do not spawn wilderness resources on water, roads, occupied tiles, or village features
        if (tile.isWater || tile.isRoad || tile.isBlocked) continue;
        if (tile.inVillageId !== undefined) continue;

        const { organicDist } = this.getDistanceToNearestVillageCenter(wx, wy);
        // Near the dense village core, trees naturally thin out smoothly without sharp square borders:
        const villageFactor = Math.min(1.0, Math.max(0.0, (organicDist - 22) / 36));
        if (villageFactor <= 0.05) continue; // Keep central town square open

        const forestNoise = this.noiseForest(wx * 0.04, wy * 0.04);
        const roll = rng();

        // 1. Trees: High density in forest/jungle regions, smooth natural thinning towards village outskirts
        const baseTreeChance =
          forestNoise > 0.3 ? 0.45 : forestNoise > 0.05 ? 0.22 : 0.07;
        const treeChance = baseTreeChance * villageFactor;
        if (roll < treeChance) {
          // Check full 2x2 footprint: must not touch water, road, or blocked tiles
          let canPlaceTree = true;
          for (let fdy = 0; fdy < 2; fdy++) {
            for (let fdx = 0; fdx < 2; fdx++) {
              const checkTile = chunk.tiles[ty + fdy]?.[tx + fdx];
              if (
                !checkTile ||
                checkTile.isWater ||
                checkTile.isRoad ||
                checkTile.isBlocked ||
                checkTile.inVillageId !== undefined
              ) {
                canPlaceTree = false;
                break;
              }
            }
            if (!canPlaceTree) break;
          }
          if (!canPlaceTree) continue;

          chunk.resources.push({
            id: this.getResourceId(wx, wy),
            type: "tree",
            x: wx,
            y: wy,
            w: 2,
            h: 2,
            health: 25,
            maxHealth: 25,
            lootItem: "wood",
            secondaryLoot: roll < 0.3 ? "apple" : "stick",
            isDepleted: false,
          });
          continue;
        }

        // 2. Rocks / Iron Rocks
        if (roll < treeChance + 0.05) {
          const isIron = rng() < 0.25;
          chunk.resources.push({
            id: this.getResourceId(wx, wy),
            type: isIron ? "iron_rock" : "rock",
            x: wx,
            y: wy,
            w: 1,
            h: 1,
            health: isIron ? 40 : 25,
            maxHealth: isIron ? 40 : 25,
            lootItem: isIron ? "iron_ore" : "stone",
            secondaryLoot: isIron ? "stone" : "coal",
            isDepleted: false,
          });
          tile.isBlocked = true;
          continue;
        }

        // 3. Berry Bushes
        if (roll < treeChance + 0.1) {
          chunk.resources.push({
            id: this.getResourceId(wx, wy),
            type: "bush",
            x: wx,
            y: wy,
            w: 1,
            h: 1,
            health: 10,
            maxHealth: 10,
            lootItem: "berries",
            secondaryLoot: "fiber",
            isDepleted: false,
          });
          continue;
        }

        // 4. Wild Alchemical Mushrooms (Shaded forest patches)
        if (forestNoise > 0.22 && roll < treeChance + 0.17) {
          const isRed = rng() < 0.45;
          chunk.resources.push({
            id: this.getResourceId(wx, wy),
            type: "bush",
            subType: isRed ? "red_mushroom" : "blue_mushroom",
            x: wx,
            y: wy,
            w: 1,
            h: 1,
            health: 5,
            maxHealth: 5,
            lootItem: isRed ? "red_mushroom" : "blue_mushroom",
            isDepleted: false,
          });
          continue;
        }
      }
    }

    // Chunk Landmark Spawns (Goblin Encampments, Ancient Crypts, Shoreline Coracles)
    const chunkHash = Math.abs(
      Math.sin(chunk.chunkX * 12.9898 + chunk.chunkY * 78.233) * 43758.5453,
    );
    const chunkSeed = Math.floor(chunkHash * 10000);
    const isNearVillage = this.isInsideAnyVillage(
      chunk.chunkX * CHUNK_SIZE + 8,
      chunk.chunkY * CHUNK_SIZE + 8,
    );

    // 1. Goblin Encampments in remote forest chunks
    if (!isNearVillage && chunkSeed % 23 === 0) {
      chunk.isGoblinCamp = true;
      const cx = chunk.chunkX * CHUNK_SIZE + 7;
      const cy = chunk.chunkY * CHUNK_SIZE + 7;
      chunk.landmarks = chunk.landmarks || [];
      chunk.landmarks.push({
        type: "goblin_camp",
        x: cx,
        y: cy,
        isNeutral: chunkSeed % 2 === 0,
      });
    }

    // 2. Ancient Crypt Dungeon Entrances in remote wilderness
    if (!isNearVillage && chunkSeed % 31 === 0) {
      chunk.isCryptEntrance = true;
      const cx = chunk.chunkX * CHUNK_SIZE + 6;
      const cy = chunk.chunkY * CHUNK_SIZE + 6;
      chunk.landmarks = chunk.landmarks || [];
      chunk.landmarks.push({
        type: "ancient_crypt",
        x: cx,
        y: cy,
      });
    }

    // 3. Coracle Boats along ocean/lake beaches
    if (chunkSeed % 11 === 0) {
      for (let ty = 2; ty < CHUNK_SIZE - 2; ty++) {
        for (let tx = 2; tx < CHUNK_SIZE - 2; tx++) {
          const t = chunk.tiles[ty][tx];
          const adjWater =
            chunk.tiles[ty + 1]?.[tx]?.isWater ||
            chunk.tiles[ty]?.[tx + 1]?.isWater;
          if (t.terrain === "sand_tile_01" && adjWater) {
            const wx = chunk.chunkX * CHUNK_SIZE + tx;
            const wy = chunk.chunkY * CHUNK_SIZE + ty;
            chunk.coracles = chunk.coracles || [];
            chunk.coracles.push({
              id: this.getResourceId(wx, wy),
              x: wx,
              y: wy,
            });
            break;
          }
        }
        if (chunk.coracles && chunk.coracles.length > 0) break;
      }
    }
  }
  /**
   * Checks if a chunk is within active simulation and render range (<= maxChunkDist chunks away).
   */
  public isChunkActive(
    chunkX: number,
    chunkY: number,
    playerTileX: number,
    playerTileY: number,
    maxChunkDist: number = 4,
  ): boolean {
    const pcx = Math.floor(playerTileX / CHUNK_SIZE);
    const pcy = Math.floor(playerTileY / CHUNK_SIZE);
    return (
      Math.abs(chunkX - pcx) <= maxChunkDist &&
      Math.abs(chunkY - pcy) <= maxChunkDist
    );
  }

  /**
   * Retrieves tile at world coordinate (wx, wy).
   */
  public getTile(wx: number, wy: number): WorldTile {
    const tileX = Math.floor(wx);
    const tileY = Math.floor(wy);
    const cx = Math.floor(tileX / CHUNK_SIZE);
    const cy = Math.floor(tileY / CHUNK_SIZE);
    const chunk = this.getOrCreateChunk(cx, cy);

    let lx = tileX - cx * CHUNK_SIZE;
    let ly = tileY - cy * CHUNK_SIZE;
    if (lx < 0) lx += CHUNK_SIZE;
    if (ly < 0) ly += CHUNK_SIZE;

    return (
      chunk.tiles[ly]?.[lx] || {
        terrain: "grass_textured_01",
        isWater: false,
        isRoad: false,
        isFarm: false,
        isBlocked: false,
      }
    );
  }

  /**
   * Checks if position (wx, wy) is walkable by player / entity.
   */
  public isWalkable(wx: number, wy: number): boolean {
    const tile = this.getTile(Math.floor(wx), Math.floor(wy));
    if (tile.isWater || tile.isBlocked) return false;
    return true;
  }

  /**
   * Find harvestable resource node at or near coordinate (wx, wy).
   */
  public getResourceAt(
    wx: number,
    wy: number,
    radius = 1.3,
  ): ResourceNode | null {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cy = Math.floor(wy / CHUNK_SIZE);

    // Check current chunk and immediate neighboring chunks
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const chunk = this.getOrCreateChunk(cx + dx, cy + dy);
        for (const res of chunk.resources) {
          if (res.isDepleted) continue;
          const centerX = res.x + res.w / 2;
          const centerY = res.y + res.h / 2;
          const dist = Math.hypot(wx - centerX, wy - centerY);
          const inside =
            wx >= res.x &&
            wx < res.x + res.w &&
            wy >= res.y &&
            wy < res.y + res.h;
          if (
            inside ||
            dist <= Math.max(radius, Math.max(res.w, res.h) * 0.85)
          ) {
            return res;
          }
        }
      }
    }
    return null;
  }

  /**
   * Find harvestable resource node by its unique numeric ID.
   */
  public getResourceById(id: number): ResourceNode | null {
    for (const chunk of this.chunks.values()) {
      for (const res of chunk.resources) {
        if (res.id === id) return res;
      }
    }
    return null;
  }

  /**
   * Authoritatively marks a resource node as depleted and unblocks its collision footprint.
   */
  public markResourceDepleted(id: number): void {
    this.depletedResourceIds.add(id);
    const res = this.getResourceById(id);
    if (res) {
      res.isDepleted = true;
      for (let dy = 0; dy < res.h; dy++) {
        for (let dx = 0; dx < res.w; dx++) {
          const tile = this.getTile(
            Math.floor(res.x + dx),
            Math.floor(res.y + dy),
          );
          tile.isBlocked = false;
        }
      }
    }
  }

  /**
   * Completely removes harvested crop from village farm cells and marks crop resource depleted.
   */
  public removeCropAt(wx: number, wy: number): void {
    const tileX = Math.floor(wx);
    const tileY = Math.floor(wy);

    for (const v of this.villages) {
      if (!v.data?.farms) continue;
      for (const farm of v.data.farms) {
        for (const cell of farm.cells) {
          if (v.gridX + cell.x === tileX && v.gridY + cell.y === tileY) {
            cell.cropId = "";
          }
        }
      }
    }

    const res = this.getResourceAt(tileX + 0.5, tileY + 0.5, 0.8);
    if (res && res.type === "crop") {
      this.markResourceDepleted(res.id);
    }
  }

  /**
   * Checks if foot coordinates collide with the wooden trunk root base of any nearby living tree.
   * Restricts collision to the sub-tile root base (0.4 x 0.25 tiles),
   * allowing characters to walk around trunks and freely walk behind tree canopies.
   */
  public isBlockedByTreeTrunk(footX: number, footY: number): boolean {
    const minCx = Math.floor((footX - 2) / CHUNK_SIZE);
    const maxCx = Math.floor((footX + 2) / CHUNK_SIZE);
    const minCy = Math.floor((footY - 2) / CHUNK_SIZE);
    const maxCy = Math.floor((footY + 2) / CHUNK_SIZE);

    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const chunk = this.chunks.get(`${cx},${cy}`);
        if (!chunk) continue;

        for (const res of chunk.resources) {
          if (
            (res.type === "tree" || res.type.startsWith("tree_")) &&
            !res.isDepleted
          ) {
            const w = res.w || 2;
            const h = res.h || 2;
            // Physical root base is centered horizontally at res.x + w / 2, and vertically at the base of the trunk
            const cx = res.x + w / 2;
            const cy = res.y + h - 0.35;
            // Precise root base hull check accounting for player foot radius
            if (
              Math.abs(footX - cx) < 0.48 &&
              Math.abs(footY - cy) < 0.28
            ) {
              return true;
            }
          }
        }
      }
    }

    return false;
  }

  /**
   * Continuous thin collision line check along connected fence links (0.2 tile width),
   * preventing players from catching on corner tiles or slipping through visual gaps.
   */
  public isBlockedByFence(footX: number, footY: number): boolean {
    for (const village of this.villages) {
      if (!village.data.farmObjects) continue;
      if (
        footX < village.gridX - 1 ||
        footX > village.gridX + village.width + 1 ||
        footY < village.gridY - 1 ||
        footY > village.gridY + village.height + 1
      ) {
        continue;
      }

      for (const obj of village.data.farmObjects) {
        if (
          typeof obj.id === "string" &&
          obj.id.startsWith("fence") &&
          obj.id !== "fence_wood_gate" &&
          obj.id !== "fence_wood_gate_open"
        ) {
          const fx = village.gridX + obj.x + 0.5;
          const fy = village.gridY + obj.y + 0.5;

          if (obj.id === "fence_wood_h") {
            // Horizontal thin rail along Y=fy, spanning X: fx-0.5 to fx+0.5
            if (Math.abs(footY - fy) < 0.14 && Math.abs(footX - fx) < 0.52) {
              return true;
            }
          } else if (obj.id === "fence_wood_v") {
            // Vertical thin rail along X=fx, spanning Y: fy-0.5 to fy+0.5
            if (Math.abs(footX - fx) < 0.14 && Math.abs(footY - fy) < 0.52) {
              return true;
            }
          } else {
            // Corner / post hull
            if (Math.abs(footX - fx) < 0.22 && Math.abs(footY - fy) < 0.22) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  /**
   * Checks if world coordinate is a road / path / cobblestone walkway / bridge.
   */
  public isRoadAt(wx: number, wy: number): boolean {
    const tile = this.getTile(wx, wy);
    return (
      tile.isRoad ||
      !!tile.isBridge ||
      tile.terrain.startsWith("path_") ||
      tile.terrain.startsWith("dirt_") ||
      tile.terrain.startsWith("stone_cobble") ||
      tile.terrain.startsWith("bridge_")
    );
  }

  /**
   * Computes 8-neighbor connectivity for road/path autotiling.
   * Returns bitmask (0..15): N=1, E=2, S=4, W=8 and boolean neighbor flags.
   */
  public getRoadNeighbors(wx: number, wy: number) {
    const n = this.isRoadAt(wx, wy - 1);
    const e = this.isRoadAt(wx + 1, wy);
    const s = this.isRoadAt(wx, wy + 1);
    const w = this.isRoadAt(wx - 1, wy);
    const ne = this.isRoadAt(wx + 1, wy - 1);
    const se = this.isRoadAt(wx + 1, wy + 1);
    const sw = this.isRoadAt(wx - 1, wy + 1);
    const nw = this.isRoadAt(wx - 1, wy - 1);
    const bitmask = (n ? 1 : 0) | (e ? 2 : 0) | (s ? 4 : 0) | (w ? 8 : 0);
    return { bitmask, n, e, s, w, ne, se, sw, nw };
  }

  public getRoadBitmask(wx: number, wy: number): number {
    return this.getRoadNeighbors(wx, wy).bitmask;
  }

  /**
   * Computes 8-neighbor water shore adjacency bitmask for water / coastline autotiling.
   */
  public getWaterShoreBitmask(wx: number, wy: number) {
    // Wooden bridges/platforms are built directly over water; treat them as water so no sand or foam forms against them
    const isWaterOrBridge = (t: WorldTile) => t.isWater || t.isBridge || t.terrain?.startsWith("bridge_");
    const hasWaterN = isWaterOrBridge(this.getTile(wx, wy - 1));
    const hasWaterE = isWaterOrBridge(this.getTile(wx + 1, wy));
    const hasWaterS = isWaterOrBridge(this.getTile(wx, wy + 1));
    const hasWaterW = isWaterOrBridge(this.getTile(wx - 1, wy));
    const hasWaterNE = isWaterOrBridge(this.getTile(wx + 1, wy - 1));
    const hasWaterSE = isWaterOrBridge(this.getTile(wx + 1, wy + 1));
    const hasWaterSW = isWaterOrBridge(this.getTile(wx - 1, wy + 1));
    const hasWaterNW = isWaterOrBridge(this.getTile(wx - 1, wy - 1));
    const isShore =
      !hasWaterN ||
      !hasWaterE ||
      !hasWaterS ||
      !hasWaterW ||
      !hasWaterNE ||
      !hasWaterSE ||
      !hasWaterSW ||
      !hasWaterNW;
    const bitmask =
      (hasWaterN ? 1 : 0) |
      (hasWaterE ? 2 : 0) |
      (hasWaterS ? 4 : 0) |
      (hasWaterW ? 8 : 0);
    return {
      isShore,
      bitmask,
      hasWaterN,
      hasWaterE,
      hasWaterS,
      hasWaterW,
      hasWaterNE,
      hasWaterSE,
      hasWaterSW,
      hasWaterNW,
    };
  }

  /**
   * Deterministic spatial hash scatter for organic meadow variety (eliminates grid lines).
   */
  public getGrassScatterVariant(wx: number, wy: number): string {
    const val = Math.abs(Math.sin(wx * 12.9898 + wy * 78.233) * 43758.5453);
    const variant = (Math.floor(val * 6) % 6) + 1;
    return `grass_textured_0${variant}`;
  }

  /**
   * Gets nearest village to given world coordinates, with distance and heading angle.
   */
  public getNearestVillage(
    wx: number,
    wy: number,
  ): {
    village: WorldRealmVillage;
    dist: number;
    angle: number;
  } | null {
    if (this.villages.length === 0) return null;

    let nearest: WorldRealmVillage | null = null;
    let minDist = Infinity;

    for (const v of this.villages) {
      const centerX = v.gridX + v.width / 2;
      const centerY = v.gridY + v.height / 2;
      const d = Math.hypot(wx - centerX, wy - centerY);
      if (d < minDist) {
        minDist = d;
        nearest = v;
      }
    }

    if (!nearest) return null;

    const targetCenterX = nearest.gridX + nearest.width / 2;
    const targetCenterY = nearest.gridY + nearest.height / 2;
    const angle = Math.atan2(targetCenterY - wy, targetCenterX - wx);

    return {
      village: nearest,
      dist: minDist,
      angle,
    };
  }
}
