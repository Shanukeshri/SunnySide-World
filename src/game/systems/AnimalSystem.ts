/**
 * AnimalSystem.ts - Authoritative Wildlife Simulation System
 * 
 * Implements Sections 6, 9, 10 of authoritative_server.txt:
 * Controls animal AI state machines, server-owned generateRandom(id),
 * hunger progression, petting, feeding, and fleeing on the server.
 */

import { GameState } from "../core/GameState";
import { AnimalEntityState } from "../core/Entity";
import { generateRandom, randomRange, randomChoice } from "../core/Random";

export class AnimalSystem {
  private gameState: GameState;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  /**
   * Checks whether a position is traversable for the given animal species.
   * Uses a bounding-box check (4 corners) to prevent any visual overlap with invalid tiles.
   */
  private isPositionValidForAnimal(x: number, y: number, species: AnimalEntityState["species"]): boolean {
    const isAmphibious = species === "duck" || species === "cow" || species === "pig";
    const radius = 0.4; // animal visual half-width

    // Check all 4 corners of the bounding box
    const corners = [
      { cx: x - radius, cy: y - radius },
      { cx: x + radius, cy: y - radius },
      { cx: x - radius, cy: y + radius },
      { cx: x + radius, cy: y + radius },
    ];

    for (const corner of corners) {
      const tile = this.gameState.worldManager.getTile(Math.floor(corner.cx), Math.floor(corner.cy));
      if (isAmphibious) {
        if (tile.isBlocked && !tile.isWater) return false;
      } else {
        if (tile.isWater || tile.isBlocked) return false;
      }
    }

    // Land animals also check tree trunk collision at center
    if (!isAmphibious) {
      if (this.gameState.worldManager.isBlockedByTreeTrunk(x + 0.5, y + 0.5)) return false;
    }

    return true;
  }

  /**
   * Relocates a misplaced animal to the nearest valid tile.
   * Land animals in water → moved to nearest land. Ducks on land → moved to nearest water.
   */
  private relocateAnimalToValidTile(animal: AnimalEntityState): void {
    // Search in expanding rings around the animal's current position
    for (let radius = 1; radius <= 12; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue; // Only check ring edge
          const testX = animal.x + dx;
          const testY = animal.y + dy;
          if (this.isPositionValidForAnimal(testX, testY, animal.species)) {
            animal.x = testX;
            animal.y = testY;
            animal.targetX = null;
            animal.targetY = null;
            animal.behaviorState = "IDLE";
            return;
          }
        }
      }
    }

    // If no valid tile found in 12-tile radius, remove the animal
    animal.behaviorState = "DEAD";
  }

  public update(dt: number): void {
    // Find active player positions for chunk culling
    const playerPositions: { x: number; y: number }[] = [];
    for (const p of this.gameState.players.values()) {
      if (!p.isDead) playerPositions.push({ x: p.x, y: p.y });
    }

    for (let i = this.gameState.animals.length - 1; i >= 0; i--) {
      const animal = this.gameState.animals[i];

      // Remove dead animals
      if (animal.behaviorState === "DEAD") {
        this.gameState.animals.splice(i, 1);
        continue;
      }

      // Chunk distance culling (> 4 chunks ~ 64 tiles from any player)
      let isNearPlayer = playerPositions.length === 0; // If no players, still simulate or freeze
      for (const pos of playerPositions) {
        if (Math.hypot(animal.x - pos.x, animal.y - pos.y) <= 64) {
          isNearPlayer = true;
          break;
        }
      }
      if (!isNearPlayer) continue;

      // Fix misplaced animals: land animals on water get relocated, ducks on land get relocated
      if (!this.isPositionValidForAnimal(animal.x, animal.y, animal.species)) {
        this.relocateAnimalToValidTile(animal);
      }

      this.updateAnimalAI(animal, dt);
      this.updateAnimalMovement(animal, dt);
    }
  }

  private updateAnimalAI(animal: AnimalEntityState, dt: number): void {
    // 1. FLEE State (highest priority when struck)
    if (animal.behaviorState === "FLEE") {
      animal.fleeTimer -= dt;
      if (animal.fleeTimer <= 0) {
        animal.speed = 1.5;
        animal.behaviorState = "IDLE";
        animal.targetX = null;
        animal.targetY = null;
      }
      return;
    }

    // 2. Petting Cooldown & PETTED State
    if (animal.pettingCooldown > 0) {
      animal.pettingCooldown = Math.max(0, animal.pettingCooldown - dt);
    }

    if (animal.isPetted) {
      animal.pettedTimer -= dt;
      if (animal.pettedTimer <= 0) {
        animal.isPetted = false;
        animal.behaviorState = "IDLE";
      }
      animal.targetX = null;
      animal.targetY = null;
      return;
    }

    // 3. Hunger progression
    animal.hunger = Math.min(100, animal.hunger + dt * 1.5);

    // 4. EATING State
    if (animal.behaviorState === "EATING") {
      // Calculate visual eating bob offset (Section 10)
      animal.eatingBobOffset = Math.sin(Date.now() * 0.008) * 2.0;

      if (generateRandom(animal.id) < 0.02) {
        // Finished eating, return to IDLE
        animal.eatingBobOffset = 0;
        animal.hunger = Math.max(0, animal.hunger - 50);
        animal.behaviorState = "IDLE";
      }
      return;
    }

    // 5. Normal AI Decision Tick via server-owned generateRandom(animal.id)
    if (animal.behaviorState === "IDLE") {
      if (generateRandom(animal.id) < 0.03) {
        // Decide next behavior: Eat or Wander
        if (animal.hunger > 30 && generateRandom(animal.id) < 0.5) {
          animal.behaviorState = "EATING";
        } else {
          // Pick wander destination within 8 tiles
          const angle = generateRandom(animal.id) * Math.PI * 2;
          const dist = randomRange(animal.id, 2, 7);
          const targetX = animal.x + Math.cos(angle) * dist;
          const targetY = animal.y + Math.sin(angle) * dist;

          if (this.isPositionValidForAnimal(targetX, targetY, animal.species)) {
            animal.targetX = targetX;
            animal.targetY = targetY;
            animal.behaviorState = "WANDER";
          }
        }
      }
    }
  }

  private updateAnimalMovement(animal: AnimalEntityState, dt: number): void {
    if (animal.targetX === null || animal.targetY === null) return;
    if (animal.behaviorState !== "WANDER" && animal.behaviorState !== "FLEE") return;

    const dx = animal.targetX - animal.x;
    const dy = animal.targetY - animal.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 0.2) {
      animal.targetX = null;
      animal.targetY = null;
      animal.behaviorState = "IDLE";
      return;
    }

    const step = Math.min(dist, animal.speed * dt);
    const nextX = animal.x + (dx / dist) * step;
    const nextY = animal.y + (dy / dist) * step;

    if (this.isPositionValidForAnimal(nextX, nextY, animal.species)) {
      animal.x = nextX;
      animal.y = nextY;
      animal.direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "RIGHT" : "LEFT") : (dy > 0 ? "DOWN" : "UP");
    } else {
      // Can't move to target — abort and go idle
      animal.targetX = null;
      animal.targetY = null;
      animal.behaviorState = "IDLE";
    }
  }

  public petAnimal(animal: AnimalEntityState, playerX: number, playerY: number): boolean {
    if (animal.pettingCooldown > 0 || animal.behaviorState === "DEAD") return false;

    animal.isPetted = true;
    animal.pettedTimer = 2.5;
    animal.pettingCooldown = 6.0;
    animal.behaviorState = "PETTED";

    this.gameState.eventBus.emit("ANIMAL_PETTED", {
      animalId: animal.id,
      species: animal.species,
      x: animal.x,
      y: animal.y,
    });
    this.gameState.eventBus.emit("FLOATING_TEXT", {
      text: "♥ Loved!",
      x: animal.x,
      y: animal.y - 0.8,
      color: "#f43f5e",
    });
    this.gameState.eventBus.emit("AUDIO_TRIGGER", { sound: "heart" });
    this.gameState.updateQuestProgress("pet_animal", 1, playerX, playerY);

    return true;
  }

  public feedAnimal(animal: AnimalEntityState, playerX: number, playerY: number): boolean {
    if (animal.behaviorState === "DEAD") return false;

    animal.hunger = Math.max(0, animal.hunger - 40);
    animal.health = Math.min(animal.maxHealth, animal.health + 10);
    animal.behaviorState = "EATING";

    this.gameState.eventBus.emit("ANIMAL_FED", {
      animalId: animal.id,
      species: animal.species,
      x: animal.x,
      y: animal.y,
    });
    this.gameState.eventBus.emit("FLOATING_TEXT", {
      text: "Fed +♥",
      x: animal.x,
      y: animal.y - 0.8,
      color: "#10b981",
    });
    this.gameState.eventBus.emit("AUDIO_TRIGGER", { sound: "heart" });

    return true;
  }

  public scareAnimal(animal: AnimalEntityState, sourceX: number, sourceY: number): void {
    animal.behaviorState = "FLEE";
    animal.fleeTimer = 4.0;
    animal.speed = 3.2; // sprint speed

    const isAquatic = animal.species === "duck";
    const fleeAngle = Math.atan2(animal.y - sourceY, animal.x - sourceX);

    // Validate flee target — try multiple distances/angles to find valid terrain
    let bestX = animal.x;
    let bestY = animal.y;
    let found = false;
    for (let attempt = 0; attempt < 8; attempt++) {
      // Jitter the angle slightly on retries to find passable terrain
      const angle = fleeAngle + (attempt > 0 ? (Math.random() - 0.5) * Math.PI * 0.5 : 0);
      const dist = 12 - attempt; // Reduce distance on retries
      const testX = animal.x + Math.cos(angle) * dist;
      const testY = animal.y + Math.sin(angle) * dist;
      if (this.isPositionValidForAnimal(testX, testY, animal.species)) {
        bestX = testX;
        bestY = testY;
        found = true;
        break;
      }
    }

    if (found) {
      animal.targetX = bestX;
      animal.targetY = bestY;
    } else {
      // No valid flee target found — just stay put
      animal.targetX = null;
      animal.targetY = null;
      animal.behaviorState = "IDLE";
      animal.speed = 1.5;
    }

    this.gameState.eventBus.emit("ANIMAL_HURT", {
      animalId: animal.id,
      x: animal.x,
      y: animal.y,
    });
  }
}
