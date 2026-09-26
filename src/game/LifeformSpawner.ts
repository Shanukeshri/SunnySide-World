import { WorldManager, WorldChunk } from "./WorldManager";
import { SPECIES_CONFIGS } from "../lifeforms/speciesConfig";
import { Animal } from "../lifeforms/Animal";
import { NPC } from "../lifeforms/NPC";

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

  function fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(t: number, a: number, b: number) { return a + t * (b - a); }
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

export class LifeformSpawner {
  private worldManager: WorldManager;
  private noiseForest: (x: number, y: number) => number;
  private nextEntityId: number = 10000;
  private seed: number;
  private processedChunks: Set<string> = new Set();
  private enemySpawnTimer: number = 0;
  private wildlifeSpawnTimer: number = 0;

  constructor(worldManager: WorldManager, seed: number) {
    this.worldManager = worldManager;
    this.seed = seed;
    this.noiseForest = createNoise2D(seed + 101);
  }
  
  public setNextEntityId(id: number) {
    this.nextEntityId = id;
  }

  public getNextEntityId(): number {
    return this.nextEntityId;
  }

  /**
   * Spawns wildlife for chunks around the player that haven't been processed yet.
   */
  public processChunksAroundPlayer(playerX: number, playerY: number, outAnimals: Animal[]) {
    const pcx = Math.floor(playerX / 16);
    const pcy = Math.floor(playerY / 16);
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const cx = pcx + dx;
        const cy = pcy + dy;
        const key = `${cx},${cy}`;
        
        const chunk = this.worldManager.chunks.get(key);
        if (chunk && chunk.isGenerated && !this.processedChunks.has(key)) {
          this.processedChunks.add(key);
          const spawned = this.spawnWildlifeForChunk(chunk, this.seed);
          outAnimals.push(...spawned);
        }
      }
    }
  }

  /**
   * Spawns wildlife for a specific chunk.
   */
  private spawnWildlifeForChunk(chunk: WorldChunk, seed: number): Animal[] {
    const CHUNK_SIZE = 16;
    const rng = createSeededRNG(seed + chunk.chunkX * 374761393 + chunk.chunkY * 668265263 + 12345);
    const spawnedAnimals: Animal[] = [];

    const animalChance = rng();
    if (animalChance < 0.65) {
      const count = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < count; i++) {
        const ax = chunk.chunkX * CHUNK_SIZE + 2 + Math.floor(rng() * (CHUNK_SIZE - 4));
        const ay = chunk.chunkY * CHUNK_SIZE + 2 + Math.floor(rng() * (CHUNK_SIZE - 4));
        const lx = ax - chunk.chunkX * CHUNK_SIZE;
        const ly = ay - chunk.chunkY * CHUNK_SIZE;
        const tile = chunk.tiles[ly]?.[lx];
        
        if (tile && !this.worldManager.isInsideAnyVillage(ax, ay)) {
          let species: "cow" | "sheep" | "chicken" | "rabbit" | "deer" | "pig" | "duck" = "chicken";
          
          if (tile.isWater) {
            species = "duck";
          } else if (!tile.isBlocked) {
            const adjUp = chunk.tiles[ly - 1]?.[lx];
            const adjDown = chunk.tiles[ly + 1]?.[lx];
            const adjLeft = chunk.tiles[ly]?.[lx - 1];
            const adjRight = chunk.tiles[ly]?.[lx + 1];
            const nearWater = adjUp?.isWater || adjDown?.isWater || adjLeft?.isWater || adjRight?.isWater;
            
            if (nearWater) continue;

            const forestNoise = this.noiseForest(ax * 0.04, ay * 0.04);
            if (forestNoise > 0.3) {
              species = rng() < 0.5 ? "deer" : "rabbit";
            } else {
              const r = rng();
              if (r < 0.25) species = "cow";
              else if (r < 0.5) species = "sheep";
              else if (r < 0.75) species = "pig";
              else species = "chicken";
            }
          } else {
            continue;
          }
          
          const config = SPECIES_CONFIGS[species];
          if (config) {
             const isAmphibious = species === "cow" || species === "pig" || species === "duck";
             const worldTile = this.worldManager.getTile(Math.floor(ax), Math.floor(ay));
             if (!isAmphibious && (worldTile.isWater || worldTile.isBlocked)) continue;
             
             const animal = new Animal(
               this.nextEntityId++,
               config,
               ax + 0.5,
               ay + 0.5
             );
             spawnedAnimals.push(animal);
          }
        }
      }
    }
    return spawnedAnimals;
  }

  /**
   * Spawns initial NPCs (villagers) for a new settlement.
   */
  public spawnInitialVillagers(
    starterVillage: any,
    playerX: number,
    playerY: number,
    outNpcs: any[]
  ) {
    if (starterVillage && starterVillage.data) {
      // See how many houses there are
      const numHouses = starterVillage.data.houses ? starterVillage.data.houses.length : 0;
      // Number of people around 2x number of houses
      const numPeople = numHouses * 2;
      const roles: string[] = [];

      // For each farm atleast one farmer
      const numFarms = starterVillage.data.farms ? starterVillage.data.farms.length : 0;
      for (let i = 0; i < numFarms; i++) roles.push("farmer");

      // For each water body atleast one fisher
      const numWater = starterVillage.data.waterBodies ? starterVillage.data.waterBodies.length : 0;
      for (let i = 0; i < numWater; i++) roles.push("fisher");

      // Rest roles randomly assigned
      const possibleRoles = ["blacksmith", "builder", "guide", "merchant", "villager", "child"];
      while (roles.length < Math.max(numPeople, roles.length)) {
        roles.push(possibleRoles[Math.floor(Math.random() * possibleRoles.length)]);
      }

      roles.forEach((role, i) => {
        const config = SPECIES_CONFIGS["villager"];
        const angle = (i / roles.length) * Math.PI * 2;
        const radius = 4.5 + (i % 2) * 2;
        // Near village center / player
        const sx = playerX + Math.cos(angle) * radius;
        const sy = playerY + Math.sin(angle) * radius;
        
        let homeX = sx;
        let homeY = sy;
        if (numHouses > 0) {
          const house = starterVillage.data.houses[i % numHouses];
          // use the door coordinate or fallback to center of footprint
          const hX = house.door ? house.door.x : house.x + (house.footprintW || 4) / 2;
          const hY = house.door ? house.door.y : house.y + (house.footprintH || 4);
          homeX = starterVillage.gridX + hX;
          homeY = starterVillage.gridY + hY + 1; // +1 to put them in front of the house
        }
        
        // Initial spawn is at their home
        const npc = new NPC(this.nextEntityId++, config, homeX, homeY, homeX, homeY, role);
        console.log(`[LifeformSpawner] Spawned NPC (${role}) at ${homeX}, ${homeY}`);
        outNpcs.push(npc);
      });
    }
  }

  /**
   * Spawns initial wildlife (ducks in water) for a new settlement/world spawn.
   */
  public spawnInitialWildlife(
    starterVillage: any,
    outAnimals: any[]
  ) {
    if (starterVillage && starterVillage.data) {
      // Ducks only spawn in water
      if (starterVillage.data.waterBodies) {
        for (const pond of starterVillage.data.waterBodies) {
          const duckCount = Math.max(1, Math.floor(pond.cells.length / 5));
          for (let i = 0; i < duckCount; i++) {
            const cellIndex = Math.floor(Math.random() * pond.cells.length);
            const cell = pond.cells[cellIndex];
            const duckConfig = SPECIES_CONFIGS["duck"];
            const duck = new Animal(
              this.nextEntityId++,
              duckConfig,
              starterVillage.gridX + cell.x + 0.5,
              starterVillage.gridY + cell.y + 0.5
            );
            outAnimals.push(duck);
          }
        }
      }
    }
  }

  public spawnInitialEnemies(playerX: number, playerY: number, outEnemies: any[]) {
    outEnemies.push({
      id: this.nextEntityId++,
      type: "goblin",
      name: "Forest Goblin",
      x: playerX + 15,
      y: playerY + 10,
      vx: 0, vy: 0,
      direction: "LEFT",
      health: 40, maxHealth: 40,
      damage: 14, speed: 2.2,
      state: "PATROL",
      attackCooldown: 0, patrolTimer: 3, hurtTimer: 0, deathTimer: 0.6,
      isAlive: true,
    });

    outEnemies.push({
      id: this.nextEntityId++,
      type: "skeleton",
      name: "Dungeon Skeleton",
      x: playerX - 15,
      y: playerY + 10,
      vx: 0, vy: 0,
      direction: "RIGHT",
      health: 45, maxHealth: 45,
      damage: 16, speed: 2.0,
      state: "PATROL",
      attackCooldown: 0, patrolTimer: 3, hurtTimer: 0, deathTimer: 0.6,
      isAlive: true,
    });
  }

  public handlePeriodicSpawns(
    dt: number,
    timeOfDay: string,
    playerX: number,
    playerY: number,
    currentAnimalsCount: number,
    currentEnemiesCount: number,
    outAnimals: any[],
    outEnemies: any[]
  ) {
    // Note: The timer state is kept in the spawner now.
    // However we'll need to add these timers as fields to LifeformSpawner.
    this.enemySpawnTimer += dt;
    this.wildlifeSpawnTimer += dt;
    
    // Night enemy spawn (only outside villages, maximum 6 active enemies)
    if (timeOfDay === "Night" && currentEnemiesCount < 6) {
      if (this.enemySpawnTimer >= 8.0) {
        this.enemySpawnTimer = 0;
        const angle = Math.random() * Math.PI * 2;
        const dist = 14 + Math.random() * 8;
        const spawnX = playerX + Math.cos(angle) * dist;
        const spawnY = playerY + Math.sin(angle) * dist;

        const tile = this.worldManager.getTile(
          Math.floor(spawnX),
          Math.floor(spawnY),
        );
        if (
          !tile.isWater &&
          !tile.isBlocked &&
          tile.inVillageId === undefined
        ) {
          this.spawnEnemy(spawnX, spawnY, outEnemies);
        }
      }
    }

    // Wildlife replenishment
    if (this.wildlifeSpawnTimer >= 15.0 && currentAnimalsCount < 16) {
      this.wildlifeSpawnTimer = 0;
      const angle = Math.random() * Math.PI * 2;
      const dist = 12 + Math.random() * 10;
      const spawnX = playerX + Math.cos(angle) * dist;
      const spawnY = playerY + Math.sin(angle) * dist;

      const tile = this.worldManager.getTile(
        Math.floor(spawnX),
        Math.floor(spawnY),
      );
      if (!tile.isWater && !tile.isBlocked) {
        const species: ("cow" | "sheep" | "chicken" | "rabbit" | "deer")[] = [
          "cow",
          "sheep",
          "chicken",
          "rabbit",
          "deer",
        ];
        const chosen = species[Math.floor(Math.random() * species.length)];
        const config = SPECIES_CONFIGS[chosen];
        outAnimals.push(
          new Animal(this.nextEntityId++, config, spawnX, spawnY),
        );
      }
    }
  }

  private spawnEnemy(x: number, y: number, outEnemies: any[]) {
    const roll = Math.random();
    let type: "skeleton" | "goblin" | "slime" = "slime";
    let name = "Wild Slime";
    let health = 25;
    let damage = 8;
    let speed = 1.8;
    let action: string | undefined = undefined;

    if (roll < 0.45) {
      type = "skeleton";
      name = "Dungeon Skeleton";
      health = 45;
      damage = 16;
      speed = 2.1;
    } else if (roll < 0.9) {
      type = "goblin";
      name = "Forest Goblin";
      health = 40;
      damage = 14;
      speed = 2.3;
      if (Math.random() < 0.25) action = "AXE";
      else if (Math.random() < 0.25) action = "MINING";
    }

    outEnemies.push({
      id: this.nextEntityId++,
      type,
      name,
      x,
      y,
      vx: 0,
      vy: 0,
      direction: roll > 0.5 ? "LEFT" : "RIGHT",
      health,
      maxHealth: health,
      damage,
      speed,
      state: "PATROL",
      attackCooldown: 0,
      patrolTimer: 3,
      hurtTimer: 0,
      deathTimer: 0.6,
      isAlive: true,
      currentAction: action,
    });
  }
}
