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
  SettlementData,
  PlacedObject,
} from "../generation/SettlementGenerator";
import {
  ResourceNode,
  WorldRealmVillage,
  ItemId,
} from "./GameTypes";

export const CHUNK_SIZE = 16; // 16x16 tiles per chunk
export const VILLAGE_WIDTH = 44; // tiles
export const VILLAGE_HEIGHT = 36; // tiles
export const VILLAGE_EQUIVALENT = 40; // 1 village equivalent ~ 40 tiles
export const MIN_VILLAGE_GAP = 2 * VILLAGE_EQUIVALENT; // 80 tiles gap
export const MAX_VILLAGE_GAP = 4 * VILLAGE_EQUIVALENT; // 160 tiles gap
export const MAX_REALM_VILLAGES = 4;

export interface WorldTile {
  terrain: string;
  isWater: boolean;
  isRoad: boolean;
  isFarm: boolean;
  isBlocked: boolean;
  rotation?: number;
  inVillageId?: number;
}

export interface WorldChunk {
  chunkX: number;
  chunkY: number;
  key: string;
  tiles: WorldTile[][];
  resources: ResourceNode[];
  isGenerated: boolean;
  spawnedWildlife?: { species: 'cow' | 'sheep' | 'chicken' | 'rabbit' | 'deer' | 'pig' | 'duck'; x: number; y: number }[];
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
      lerp(u, grad(p[A + 1], xf, yf - 1), grad(p[B + 1], xf - 1, yf - 1))
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

  private nextResourceId = 1;

  constructor(seed: number = 42891) {
    this.seed = seed;
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
    // Village Equivalent V = 40 tiles.
    // 2 V gap = 80 tiles.
    // 4 V gap = 160 tiles.
    // Village 1: Oakvale (Center / Starting realm village) at [0, 0]
    // Village 2: Riverwood (East / Northeast) gap ~ 100 tiles (2.5 village equivalents)
    // Village 3: Sunhaven (South / Southeast) gap ~ 120 tiles (3 village equivalents)
    // Village 4: Pinecrest (West / Northwest) gap ~ 110 tiles (2.75 village equivalents)

    const v1X = 0;
    const v1Y = 0;

    // East / NE site: ~100 tiles away from Village 1
    const v2X = v1X + 96;
    const v2Y = v1Y - 48;

    // South / SE site: ~115 tiles away from Village 1, ~125 tiles from Village 2
    const v3X = v1X + 48;
    const v3Y = v1Y + 110;

    // West / NW site: ~110 tiles away from Village 1, ~130 tiles from Village 3
    const v4X = v1X - 112;
    const v4Y = v1Y + 24;

    this.villagePlannedSites = [
      { name: "Oakvale", targetX: v1X, targetY: v1Y, seed: this.seed, generated: false },
      { name: "Riverwood", targetX: v2X, targetY: v2Y, seed: this.seed + 1111, generated: false },
      { name: "Sunhaven", targetX: v3X, targetY: v3Y, seed: this.seed + 2222, generated: false },
      { name: "Pinecrest", targetX: v4X, targetY: v4Y, seed: this.seed + 3333, generated: false },
    ];
  }

  /**
   * Automatically checks and triggers village generation when the player explores towards it.
   */
  public updatePlayerLocation(playerTileX: number, playerTileY: number, loadRadiusChunks = 4) {
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
        playerTileY - (site.targetY + VILLAGE_HEIGHT / 2)
      );

      // Trigger automatic generation when player is within approaching range (90 tiles)
      // or if it's the starter village (Oakvale)
      if (dist < 90 || (site.name === "Oakvale" && dist < 120)) {
        this.generateVillageAtSite(site);
      }
    }

    // 2b. Infinite village generation (Minecraft-style): dynamically plan candidate sites across the infinite world
    const macroStep = 120; // 3 village equivalents
    const playerMx = Math.floor((playerTileX + macroStep / 2) / macroStep);
    const playerMy = Math.floor((playerTileY + macroStep / 2) / macroStep);

    for (let dmy = -1; dmy <= 1; dmy++) {
      for (let dmx = -1; dmx <= 1; dmx++) {
        const mx = playerMx + dmx;
        const my = playerMy + dmy;
        if (Math.abs(mx) <= 1 && Math.abs(my) <= 1) continue;

        const siteId = `site_${mx}_${my}`;
        if (!this.villagePlannedSites.some((s) => (s as any).siteId === siteId)) {
          const rng = createSeededRNG(this.seed + (mx * 73856093 ^ my * 19349663));
          const jitterX = Math.floor((rng() - 0.5) * 36);
          const jitterY = Math.floor((rng() - 0.5) * 36);
          const targetX = mx * macroStep + jitterX;
          const targetY = my * macroStep + jitterY;
          const villageNames = ["Millfield", "Elderglen", "Highgarden", "Silverstream", "Bramblebrook", "Dawnstar", "Amberfall", "Windshire", "Mosswood", "Falconridge"];
          const name = villageNames[Math.floor(rng() * villageNames.length)];
          const newSite = {
            name: `${name} ${mx > 0 ? '+' : ''}${mx},${my > 0 ? '+' : ''}${my}`,
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
          playerTileY - (v.gridY + v.height / 2)
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
    const settlementData = generateSettlement(site.seed, VILLAGE_WIDTH, VILLAGE_HEIGHT);

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
   * Stamps village terrain, roads, houses, farms, wells, and trees into existing or new chunks.
   */
  private stampVillageIntoChunks(v: WorldRealmVillage) {
    const startX = v.gridX;
    const startY = v.gridY;
    const data = v.data;

    for (let ly = 0; ly < v.height; ly++) {
      for (let lx = 0; lx < v.width; lx++) {
        const wx = startX + lx;
        const wy = startY + ly;
        const vCell = data.grid[ly]?.[lx];
        if (!vCell) continue;

        const tile = this.getTile(wx, wy);
        tile.inVillageId = v.id;
        tile.terrain = vCell.terrain;
        tile.isRoad = vCell.isRoad;
        tile.isFarm = vCell.isFarm;
        tile.isWater = vCell.isWater;
        // Roads, farms, and grass are ALWAYS walkable; only water is blocked by default
        tile.isBlocked = vCell.isWater;
        if (vCell.rotation !== undefined) {
          tile.rotation = vCell.rotation;
        }
      }
    }

    // Mark house footprints as blocked: rectangle equal to length of base and exactly half height (bottom half)
    for (const house of data.houses) {
      const baseStartY = Math.floor(house.footprintH / 2);
      for (let dy = baseStartY; dy < house.footprintH; dy++) {
        for (let dx = 0; dx < house.footprintW; dx++) {
          const wx = startX + house.x + dx;
          const wy = startY + house.y + dy;
          if (house.door && (startX + house.door.x) === wx && (startY + house.door.y) === wy) {
            continue; // Keep doorway walkable
          }
          this.getTile(wx, wy).isBlocked = true;
        }
      }
    }

    // Mark fences as blocked (openings / gates remain walkable)
    if (data.farmObjects) {
      for (const obj of data.farmObjects) {
        if (typeof obj.id === 'string' && obj.id.startsWith('fence') && obj.id !== 'fence_wood_gate') {
          this.getTile(startX + obj.x, startY + obj.y).isBlocked = true;
        }
      }
    }

    // Mark wells as blocked
    for (const well of data.wells) {
      this.getTile(startX + well.x, startY + well.y).isBlocked = true;
    }

    // Add village harvestable resources (trees, bushes, crops) into chunk resources
    data.trees.forEach((t) => {
      const wx = startX + t.x;
      const wy = startY + t.y;
      const w = t.footprintW || 2;
      const h = t.footprintH || 2;
      // Mark trunk base as blocked (bottom row), allowing player to walk behind canopy
      const trunkY = wy + h - 1;
      const trunkX = wx + Math.floor(w / 2);
      this.getTile(trunkX, trunkY).isBlocked = true;
      if (w > 2) {
        this.getTile(trunkX - 1, trunkY).isBlocked = true;
      }
      this.addResourceToWorld({
        id: this.nextResourceId++,
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
        id: this.nextResourceId++,
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
        const wx = startX + cell.x;
        const wy = startY + cell.y;
        this.addResourceToWorld({
          id: this.nextResourceId++,
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
  }

  private addResourceToWorld(res: ResourceNode) {
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
      const param = ((x - v1.x) * dx + (y - v1.y) * dy) / lenSq;
      if (param >= 0.08 && param <= 0.92) {
        const wobble = this.noiseTerrain(x * 0.04, y * 0.04) * 2.2;
        const projX = v1.x + param * dx;
        const projY = v1.y + param * dy;
        const dist = Math.hypot(x - projX, y - projY + wobble);
        if (dist <= 1.25) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Procedurally computes the natural wilderness terrain tile at world coordinate (x, y).
   */
  private generateWildernessTile(x: number, y: number): WorldTile {
    // 1. Organic connective highway roads between villages
    if (this.isPointOnHighway(x, y)) {
      return {
        terrain: "path_tile_01",
        isWater: false,
        isRoad: true,
        isFarm: false,
        isBlocked: false,
      };
    }

    const scale = 0.035;
    const waterVal = this.noiseWater(x * scale, y * scale);
    const forestVal = this.noiseForest(x * scale, y * scale);
    const terrainVal = this.noiseTerrain(x * scale * 2, y * scale * 2);

    // Natural large coherent lakes (only in deep water basins > 0.65)
    if (waterVal > 0.65) {
      return {
        terrain: "water_tile_01",
        isWater: true,
        isRoad: false,
        isFarm: false,
        isBlocked: true,
      };
    }

    // Sand shoreline bordering lake
    if (waterVal > 0.61) {
      return {
        terrain: "sand_tile_01",
        isWater: false,
        isRoad: false,
        isFarm: false,
        isBlocked: false,
      };
    }

    // Grassland texture variation (6 authentic grass variants)
    let grassIndex = 1;
    const variantNoise = (terrainVal + 1) * 0.5;
    if (variantNoise < 0.25) grassIndex = 1;
    else if (variantNoise < 0.45) grassIndex = 2;
    else if (variantNoise < 0.65) grassIndex = 3;
    else if (variantNoise < 0.8) grassIndex = 4;
    else if (variantNoise < 0.92) grassIndex = 5;
    else grassIndex = 6;

    // Jungle region has richer vegetation
    const isJungle = forestVal > 0.35;
    const terrain = isJungle ? `grass_textured_0${(grassIndex % 3) + 4}` : `grass_textured_0${grassIndex}`;

    return {
      terrain,
      isWater: false,
      isRoad: false,
      isFarm: false,
      isBlocked: false,
    };
  }

  /**
   * Spawns trees, rocks, and bushes into a wilderness chunk based on procedural density.
   */
  private populateChunkResources(chunk: WorldChunk) {
    const rng = createSeededRNG(this.seed + chunk.chunkX * 374761393 + chunk.chunkY * 668265263);

    for (let ty = 1; ty < CHUNK_SIZE - 1; ty += 2) {
      for (let tx = 1; tx < CHUNK_SIZE - 1; tx += 2) {
        const wx = chunk.chunkX * CHUNK_SIZE + tx;
        const wy = chunk.chunkY * CHUNK_SIZE + ty;
        const tile = chunk.tiles[ty][tx];

        // Do not spawn on water, roads, or occupied tiles
        if (tile.isWater || tile.isRoad || tile.isBlocked) continue;

        const forestNoise = this.noiseForest(wx * 0.04, wy * 0.04);
        const roll = rng();

        // 1. Trees: High density in forest/jungle regions, sparse in open plains
        const treeChance = forestNoise > 0.3 ? 0.45 : forestNoise > 0.05 ? 0.22 : 0.07;
        if (roll < treeChance) {
          chunk.resources.push({
            id: this.nextResourceId++,
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
          // Mark only tree trunk base (bottom row) as blocked so player can walk behind canopy
          if (ty + 1 < CHUNK_SIZE) {
            chunk.tiles[ty + 1][tx].isBlocked = true;
            if (tx + 1 < CHUNK_SIZE) {
              chunk.tiles[ty + 1][tx + 1].isBlocked = true;
            }
          } else {
            tile.isBlocked = true;
          }
          continue;
        }

        // 2. Rocks / Iron Rocks
        if (roll < treeChance + 0.05) {
          const isIron = rng() < 0.25;
          chunk.resources.push({
            id: this.nextResourceId++,
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
            id: this.nextResourceId++,
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
      }
    }

    // Spawn wild animals naturally as the chunk loads (Minecraft-style)
    chunk.spawnedWildlife = [];
    const animalChance = rng();
    if (animalChance < 0.65) {
      const count = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < count; i++) {
        const ax = chunk.chunkX * CHUNK_SIZE + 2 + Math.floor(rng() * (CHUNK_SIZE - 4));
        const ay = chunk.chunkY * CHUNK_SIZE + 2 + Math.floor(rng() * (CHUNK_SIZE - 4));
        const lx = ax - chunk.chunkX * CHUNK_SIZE;
        const ly = ay - chunk.chunkY * CHUNK_SIZE;
        const tile = chunk.tiles[ly]?.[lx];
        if (tile && !tile.isBlocked && tile.inVillageId === undefined) {
          let species: 'cow' | 'sheep' | 'chicken' | 'rabbit' | 'deer' | 'pig' | 'duck' = 'chicken';
          if (tile.isWater) {
            species = 'duck';
          } else {
            const forestNoise = this.noiseForest(ax * 0.04, ay * 0.04);
            if (forestNoise > 0.3) {
              species = rng() < 0.5 ? 'deer' : 'rabbit';
            } else {
              const r = rng();
              if (r < 0.25) species = 'cow';
              else if (r < 0.5) species = 'sheep';
              else if (r < 0.75) species = 'pig';
              else species = 'chicken';
            }
          }
          chunk.spawnedWildlife.push({ species, x: ax + 0.5, y: ay + 0.5 });
        }
      }
    }
  }

  /**
   * Checks if a chunk is within active simulation and render range (<= maxChunkDist chunks away).
   */
  public isChunkActive(chunkX: number, chunkY: number, playerTileX: number, playerTileY: number, maxChunkDist: number = 4): boolean {
    const pcx = Math.floor(playerTileX / CHUNK_SIZE);
    const pcy = Math.floor(playerTileY / CHUNK_SIZE);
    return Math.abs(chunkX - pcx) <= maxChunkDist && Math.abs(chunkY - pcy) <= maxChunkDist;
  }

  /**
   * Retrieves tile at world coordinate (wx, wy).
   */
  public getTile(wx: number, wy: number): WorldTile {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cy = Math.floor(wy / CHUNK_SIZE);
    const chunk = this.getOrCreateChunk(cx, cy);

    let lx = wx - cx * CHUNK_SIZE;
    let ly = wy - cy * CHUNK_SIZE;
    if (lx < 0) lx += CHUNK_SIZE;
    if (ly < 0) ly += CHUNK_SIZE;

    return chunk.tiles[ly][lx];
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
  public getResourceAt(wx: number, wy: number, radius = 1.3): ResourceNode | null {
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
          if (dist <= radius) {
            return res;
          }
        }
      }
    }
    return null;
  }

  /**
   * Gets nearest village to given world coordinates, with distance and heading angle.
   */
  public getNearestVillage(wx: number, wy: number): {
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
