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

          const tile = this.gameState.worldManager.getTile(Math.floor(targetX), Math.floor(targetY));
          if (!tile.isWater && !tile.isBlocked) {
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

    const tile = this.gameState.worldManager.getTile(Math.floor(nextX), Math.floor(nextY));
    if (!tile.isWater && !tile.isBlocked) {
      animal.x = nextX;
      animal.y = nextY;
      animal.direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "RIGHT" : "LEFT") : (dy > 0 ? "DOWN" : "UP");
    } else {
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

    const angle = Math.atan2(animal.y - sourceY, animal.x - sourceX);
    animal.targetX = animal.x + Math.cos(angle) * 12;
    animal.targetY = animal.y + Math.sin(angle) * 12;

    this.gameState.eventBus.emit("ANIMAL_HURT", {
      animalId: animal.id,
      x: animal.x,
      y: animal.y,
    });
  }
}
