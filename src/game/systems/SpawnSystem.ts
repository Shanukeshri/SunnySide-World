/**
 * SpawnSystem.ts - Authoritative Entity Spawner System
 * 
 * Implements Section 2 & 13 of authoritative_server.txt:
 * Controls night enemy spawns, wildlife replenishment, and caps on the server.
 */

import { GameState } from "../core/GameState";
import { EnemyEntityState, AnimalEntityState } from "../core/Entity";
import { generateRandom, randomChoice } from "../core/Random";

export class SpawnSystem {
  private gameState: GameState;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  public update(dt: number): void {
    this.handleEnemySpawns(dt);
    this.handleWildlifeSpawns(dt);
  }

  private handleEnemySpawns(dt: number): void {
    if (this.gameState.worldTime.timeOfDay !== "Night") return;
    if (this.gameState.enemies.length >= 8) return;

    this.gameState.enemySpawnTimer += dt;
    if (this.gameState.enemySpawnTimer >= 8.0) {
      this.gameState.enemySpawnTimer = 0;

      // Pick random active player to spawn around
      const players = Array.from(this.gameState.players.values()).filter((p) => !p.isDead);
      if (players.length === 0) return;

      const player = randomChoice(0, players);
      const angle = generateRandom(0) * Math.PI * 2;
      const dist = 14 + generateRandom(0) * 8;
      const spawnX = player.x + Math.cos(angle) * dist;
      const spawnY = player.y + Math.sin(angle) * dist;

      const tile = this.gameState.worldManager.getTile(Math.floor(spawnX), Math.floor(spawnY));
      if (!tile.isWater && !tile.isBlocked && tile.inVillageId === undefined) {
        this.spawnEnemy(spawnX, spawnY);
      }
    }
  }

  private spawnEnemy(x: number, y: number): void {
    const roll = generateRandom(0);
    let enemyType: "skeleton" | "goblin" | "slime" = "slime";
    let name = "Wild Slime";
    let health = 25;
    let damage = 8;
    let speed = 1.8;
    let action: string | undefined = undefined;

    if (roll < 0.45) {
      enemyType = "skeleton";
      name = "Dungeon Skeleton";
      health = 45;
      damage = 16;
      speed = 2.1;
    } else if (roll < 0.9) {
      enemyType = "goblin";
      name = "Forest Goblin";
      health = 40;
      damage = 14;
      speed = 2.3;
      if (generateRandom(0) < 0.25) action = "AXE";
      else if (generateRandom(0) < 0.25) action = "MINING";
    }

    const enemy: EnemyEntityState = {
      id: this.gameState.getNextId(),
      kind: "enemy",
      enemyType,
      name,
      x,
      y,
      vx: 0,
      vy: 0,
      direction: "DOWN",
      health,
      maxHealth: health,
      damage,
      speed,
      state: "PATROL",
      action,
      attackCooldown: 0,
      patrolTimer: 3,
      hurtTimer: 0,
      deathTimer: 0.6,
      isAlive: true,
    };

    this.gameState.enemies.push(enemy);
    this.gameState.eventBus.emit("ENTITY_SPAWNED", {
      entityId: enemy.id,
      kind: "enemy",
      enemyType,
      x,
      y,
    });
  }

  private handleWildlifeSpawns(dt: number): void {
    if (this.gameState.animals.length >= 20) return;

    this.gameState.wildlifeSpawnTimer += dt;
    if (this.gameState.wildlifeSpawnTimer >= 15.0) {
      this.gameState.wildlifeSpawnTimer = 0;

      const players = Array.from(this.gameState.players.values()).filter((p) => !p.isDead);
      if (players.length === 0) return;

      const player = randomChoice(0, players);
      const angle = generateRandom(0) * Math.PI * 2;
      const dist = 12 + generateRandom(0) * 10;
      const spawnX = player.x + Math.cos(angle) * dist;
      const spawnY = player.y + Math.sin(angle) * dist;

      const tile = this.gameState.worldManager.getTile(Math.floor(spawnX), Math.floor(spawnY));
      if (!tile.isWater && !tile.isBlocked) {
        const speciesList: AnimalEntityState["species"][] = ["cow", "sheep", "chicken", "rabbit", "deer"];
        const chosen = randomChoice(0, speciesList);

        const animal: AnimalEntityState = {
          id: this.gameState.getNextId(),
          kind: "animal",
          species: chosen,
          x: spawnX,
          y: spawnY,
          direction: "DOWN",
          behaviorState: "IDLE",
          health: 30,
          maxHealth: 30,
          hunger: 0,
          speed: 1.5,
          targetX: null,
          targetY: null,
          eatingBobOffset: 0,
          isPetted: false,
          pettedTimer: 0,
          pettingCooldown: 0,
          fleeTimer: 0,
        };

        this.gameState.animals.push(animal);
        this.gameState.eventBus.emit("ENTITY_SPAWNED", {
          entityId: animal.id,
          kind: "animal",
          species: chosen,
          x: spawnX,
          y: spawnY,
        });
      }
    }
  }
}
