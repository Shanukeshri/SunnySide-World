import { SettlementData } from '../generation/SettlementGenerator';
import { EnvironmentDetector } from './EnvironmentDetector';
import { Animal } from './Animal';
import { NPC } from './NPC';
import { Player } from './Player';
import { SPECIES_CONFIGS } from './speciesConfig';
import { HeartParticle, SpeciesType, EnvironmentType } from './types';
import { generateRandom, randomInt, randomRange, removeEntitySeed, setGlobalRngSeed } from './rng';

export class LifeformManager {
  private nextEntityId: number = 1;
  private detector: EnvironmentDetector;
  private animals: Animal[] = [];
  private npcs: NPC[] = [];
  public player: Player | null = null;
  private particles: HeartParticle[] = [];
  private nextParticleId: number = 1;

  // Section 32 & 33: Throttled AI tick timer (5-10 Hz)
  private aiTickInterval: number = 0.15; // ~6.6 Hz
  private aiTickTimer: number = 0;

  // Section 7: Spawn/Despawn Management
  public simulationRadius: number = 32; // Active simulation radius around player
  public despawnRadius: number = 45;    // Animals further than this are despawned
  private popCheckTimer: number = 0;
  private popCheckInterval: number = 2.0; // Run despawn/spawn check occasionally (0.5 Hz)

  // Population Limits
  public maxWildlife: number = 28;
  public desiredWildlife: number = 24;
  public maxNPCs: number = 8;

  constructor(settlementData: SettlementData) {
    setGlobalRngSeed(settlementData.seed || 12345);
    this.detector = new EnvironmentDetector(settlementData);
    this.initializeLifeforms(settlementData);
  }

  /**
   * Resets and populates the world with wildlife, villagers, and player.
   */
  public initializeLifeforms(settlementData: SettlementData): void {
    // Clear existing
    for (const a of this.animals) removeEntitySeed(a.id);
    for (const n of this.npcs) removeEntitySeed(n.id);
    this.animals = [];
    this.npcs = [];
    this.particles = [];
    this.nextEntityId = 1;

    setGlobalRngSeed(settlementData.seed || 12345);
    this.detector.updateSettlementData(settlementData);

    // 1. Spawn Player in Village Center or near first house (centered on walkable tile)
    const baseSpawnX = settlementData.houses[0]?.door?.x ?? Math.floor(settlementData.width / 2);
    const baseSpawnY = settlementData.houses[0]?.door?.y ? settlementData.houses[0].door.y + 1 : Math.floor(settlementData.height / 2);
    const spawnX = baseSpawnX + 0.5;
    const spawnY = baseSpawnY + 0.5;

    const validPlayerSpot = this.detector.isAreaWalkable(spawnX, spawnY)
      ? { x: spawnX, y: spawnY }
      : this.findWalkableOffset(spawnX, spawnY, 4.0) ||
        this.detector.findSpawnLocation(['VILLAGE', 'GRASSLAND'], 30, () => generateRandom(0)) || { x: 10, y: 10 };

    this.player = new Player(this.nextEntityId++, SPECIES_CONFIGS.player, validPlayerSpot.x, validPlayerSpot.y);

    // 2. Spawn Villager NPCs near houses (Section 29 & 30)
    const houses = settlementData.houses;
    const numVillagers = Math.min(this.maxNPCs, Math.max(4, houses.length));
    for (let i = 0; i < numVillagers; i++) {
      const house = houses[i % houses.length];
      const hx = house?.door?.x ?? house?.x ?? 12;
      const hy = house?.door?.y ? house.door.y + 1 : (house?.y ? house.y + 2 : 12);

      const vSpot = this.findWalkableOffset(hx, hy, 2.5);
      if (vSpot) {
        const npc = new NPC(
          this.nextEntityId++,
          SPECIES_CONFIGS.villager,
          vSpot.x,
          vSpot.y,
          hx,
          hy
        );
        this.npcs.push(npc);
      }
    }

    // 3. Section 5 & 6: Spawn Initial Wildlife Herds/Groups around centers
    this.spawnAnimalHerd('cow', 3, ['GRASSLAND', 'VILLAGE']);
    this.spawnAnimalHerd('sheep', 4, ['GRASSLAND']);
    this.spawnAnimalHerd('pig', 3, ['VILLAGE', 'GRASSLAND']);
    this.spawnAnimalHerd('chicken', 4, ['VILLAGE', 'GRASSLAND']);
    this.spawnAnimalHerd('duck', 3, ['WATER', 'GRASSLAND']);
    this.spawnAnimalHerd('rabbit', 3, ['GRASSLAND', 'JUNGLE']);
    this.spawnAnimalHerd('deer', 2, ['JUNGLE', 'GRASSLAND']);
  }

  /**
   * Section 5 & 6: Spawns an animal group around a center point.
   * 1. Choose a group center.
   * 2. Generate group size with generateRandom(0).
   * 3. Find nearby valid positions.
   * 4. Spawn animals around center.
   */
  public spawnAnimalHerd(
    species: SpeciesType,
    targetCount: number,
    preferredEnv: EnvironmentType[],
    customCenter?: { x: number; y: number }
  ): void {
    const config = SPECIES_CONFIGS[species];
    if (!config) return;

    // Center point for the herd
    const center = customCenter ?? this.detector.findSpawnLocation(preferredEnv, 40, () => generateRandom(0));
    if (!center) return;

    const count = Math.min(
      targetCount,
      randomInt(0, config.groupSizeMin, config.groupSizeMax)
    );

    for (let i = 0; i < count; i++) {
      if (this.animals.length >= this.maxWildlife) break;

      const pos = this.findWalkableOffset(center.x, center.y, 3.0, Boolean(config.isAquatic));
      if (pos) {
        const animal = new Animal(this.nextEntityId++, config, pos.x, pos.y);
        animal.movement.wanderOriginX = center.x;
        animal.movement.wanderOriginY = center.y;
        this.animals.push(animal);
      }
    }
  }

  /**
   * Section 6: Finds a walkable spot within a loose radius of a center.
   */
  private findWalkableOffset(
    cx: number,
    cy: number,
    radius: number,
    isAquatic: boolean = false
  ): { x: number; y: number } | null {
    for (let attempt = 0; attempt < 16; attempt++) {
      const angle = generateRandom(0) * Math.PI * 2;
      const dist = randomRange(0, 0.2, radius);
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;
      if (this.detector.isWalkable(x, y, isAquatic, isAquatic)) {
        return { x, y };
      }
    }
    return this.detector.isWalkable(cx, cy, isAquatic, isAquatic) ? { x: cx, y: cy } : null;
  }

  /**
   * Section 7 & 32 & 33: Multi-tier Update Loop
   * - 60 FPS: movement, collisions, visual jump/eating animations, particle physics.
   * - 5–10 Hz: behavior decisions (throttled AI ticks).
   * - ~0.5 Hz: spawn / despawn population management around the player.
   */
  public update(dt: number): void {
    // 1. Throttled AI Decision Tick (5–10 Hz)
    this.aiTickTimer += dt;
    if (this.aiTickTimer >= this.aiTickInterval) {
      const aiDt = this.aiTickTimer;
      this.aiTickTimer = 0;

      for (const animal of this.animals) {
        if (animal.isActive) {
          animal.updateAI(aiDt, this.detector);
        }
      }

      for (const npc of this.npcs) {
        if (npc.isActive) {
          npc.updateAI(aiDt, this.detector);
        }
      }
    }

    // 2. Section 7 & Section 34 (#28): Population & Despawn Management (~0.5 Hz)
    this.popCheckTimer += dt;
    if (this.popCheckTimer >= this.popCheckInterval) {
      this.popCheckTimer = 0;
      this.managePopulation();
    }

    // 3. High-Frequency Movement & Visuals (60 FPS)
    for (let i = this.animals.length - 1; i >= 0; i--) {
      const animal = this.animals[i];
      if (!animal.isActive) {
        removeEntitySeed(animal.id);
        this.animals.splice(i, 1);
        continue;
      }

      // Check heart emissions (Section 23)
      if (animal.interaction.heartsEmitted) {
        animal.interaction.heartsEmitted = false;
        this.spawnHeartEffect(animal);
      }

      animal.updateMovement(dt, this.detector);
    }

    for (let i = this.npcs.length - 1; i >= 0; i--) {
      const npc = this.npcs[i];
      if (!npc.isActive) {
        removeEntitySeed(npc.id);
        this.npcs.splice(i, 1);
        continue;
      }
      npc.updateMovement(dt, this.detector);
    }

    // Update Player (Section 24: visual hop animation, input-based movement)
    if (this.player && this.player.isActive) {
      this.player.updatePlayer(dt, this.detector);
    }

    // 4. Update Floating Heart Particles
    this.updateParticles(dt);
  }

  /**
   * Section 7: Spawn/despawn management
   * Maintain active wildlife population around the player.
   * Despawn animals sufficiently far away and dynamically spawn new groups near the player.
   */
  private managePopulation(): void {
    if (!this.player) return;

    const px = this.player.position.x;
    const py = this.player.position.y;

    // Despawn animals that moved outside despawn radius
    for (let i = this.animals.length - 1; i >= 0; i--) {
      const animal = this.animals[i];
      const dist = Math.hypot(animal.position.x - px, animal.position.y - py);
      if (dist > this.despawnRadius) {
        animal.isActive = false;
        removeEntitySeed(animal.id);
        this.animals.splice(i, 1);
      }
    }

    // If population is below desired level, replenish herds in the active simulation radius
    let spawnAttempts = 0;
    while (this.animals.length < this.desiredWildlife && spawnAttempts < 5) {
      spawnAttempts++;
      const beforeCount = this.animals.length;
      this.spawnWildlifeNearPlayer(px, py);
      if (this.animals.length <= beforeCount) {
        break;
      }
    }
  }

  /**
   * Finds a valid spawn area in the active simulation ring (14–26 tiles from player)
   * and spawns a suitable animal group based on local environment.
   */
  private spawnWildlifeNearPlayer(px: number, py: number): void {
    const candidateSpecies: SpeciesType[] = ['cow', 'sheep', 'rabbit', 'chicken', 'deer', 'pig', 'duck'];
    const selectedSpecies = candidateSpecies[Math.floor(generateRandom(0) * candidateSpecies.length)];
    const config = SPECIES_CONFIGS[selectedSpecies];
    if (!config) return;

    // Search for a valid spawn point in the active ring around player
    for (let attempt = 0; attempt < 20; attempt++) {
      const angle = generateRandom(0) * Math.PI * 2;
      const dist = randomRange(0, 14, 26);
      const cx = px + Math.cos(angle) * dist;
      const cy = py + Math.sin(angle) * dist;

      if (!this.detector.isWalkable(cx, cy, Boolean(config.isAquatic), Boolean(config.isAquatic))) {
        continue;
      }

      const env = this.detector.getEnvironmentAt(cx, cy);
      if (config.preferredEnvironment.includes(env.type) || attempt > 15) {
        this.spawnAnimalHerd(selectedSpecies, 3, config.preferredEnvironment, { x: cx, y: cy });
        break;
      }
    }
  }

  /**
   * Section 23: spawnHeartEffect(animal)
   * Visual particles: spawn above animal, float upward, fade out, disappear.
   */
  public spawnHeartEffect(animal: Animal, count: number = 2): void {
    this.emitHeartParticles(animal.position.x, animal.position.y, count);
  }

  /**
   * Emits small, deep ruby red floating heart particles in a light, sparse stream.
   */
  public emitHeartParticles(tileX: number, tileY: number, count: number = 2): void {
    const PURE_DEEP_REDS = ['#dc2626', '#b91c1c', '#e11d48', '#be123c', '#991b1b'];
    const actualCount = Math.max(1, Math.min(count, 2));

    for (let i = 0; i < actualCount; i++) {
      const offsetX = (generateRandom(0) - 0.5) * 0.22;
      const offsetY = i * 0.2 + (generateRandom(0) - 0.5) * 0.08;
      const color = PURE_DEEP_REDS[Math.floor(generateRandom(0) * PURE_DEEP_REDS.length)];

      this.particles.push({
        id: this.nextParticleId++,
        x: tileX + offsetX,
        y: tileY - 0.55 - offsetY,
        vx: (generateRandom(0) - 0.5) * 0.15,
        vy: -0.85 - generateRandom(0) * 0.4,
        alpha: 1.0,
        scale: 0.75 + generateRandom(0) * 0.25,
        life: 1.0 + generateRandom(0) * 0.3,
        maxLife: 1.3,
        color,
        wobbleSpeed: 3.5 + generateRandom(0) * 2,
        wobbleAmp: 0.04 + generateRandom(0) * 0.04,
      });
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
    }
  }

  /**
   * Section 20, 21, 24: Action - Player pets closest animal within reach.
   */
  public petClosestAnimal(): boolean {
    if (!this.player) return false;
    const target = this.player.findNearbyInteractable(this.animals, 2.0);
    if (!target) return false;

    const accepted = target.pet();
    if (accepted) {
      // Section 24: Player performs small hop
      this.player.triggerHop();
      return true;
    }
    return false;
  }

  /**
   * Section 26: Action - Player feeds closest animal within reach.
   */
  public feedClosestAnimal(): boolean {
    if (!this.player) return false;
    const target = this.player.findNearbyInteractable(this.animals, 2.0);
    if (!target) return false;

    const accepted = target.feed();
    if (accepted) {
      // Small positive reaction
      this.player.triggerHop();
      return true;
    }
    return false;
  }

  /**
   * Finds entity at screen/tile coordinates (e.g. for mouse click/hover).
   */
  public findEntityAt(tileX: number, tileY: number, radius: number = 1.0): Animal | NPC | Player | null {
    if (this.player && Math.hypot(this.player.position.x - tileX, this.player.position.y - tileY) < radius) {
      return this.player;
    }
    for (const a of this.animals) {
      if (a.isActive && Math.hypot(a.position.x - tileX, a.position.y - tileY) < radius) {
        return a;
      }
    }
    for (const n of this.npcs) {
      if (n.isActive && Math.hypot(n.position.x - tileX, n.position.y - tileY) < radius) {
        return n;
      }
    }
    return null;
  }

  // Getters
  public getAnimals(): readonly Animal[] {
    return this.animals;
  }

  public getNPCs(): readonly NPC[] {
    return this.npcs;
  }

  public getParticles(): readonly HeartParticle[] {
    return this.particles;
  }

  public getDetector(): EnvironmentDetector {
    return this.detector;
  }
}
