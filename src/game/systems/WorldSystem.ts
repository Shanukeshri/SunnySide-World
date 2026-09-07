/**
 * WorldSystem.ts - Authoritative Chunk & Village Manager
 * 
 * Implements Section 20 & 22 of authoritative_server.txt:
 * Generates chunks around active players, triggers procedural villages,
 * and maintains canonical world terrain.
 */

import { GameState } from "../core/GameState";
import { AnimalEntityState } from "../core/Entity";

export class WorldSystem {
  private gameState: GameState;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  public update(_dt: number): void {
    for (const player of this.gameState.players.values()) {
      if (player.isDead) continue;

      // 1. Generate/load chunks and trigger villages around this player
      this.gameState.worldManager.updatePlayerLocation(player.x, player.y);

      // 2. Ingest wild animals spawned in newly loaded chunks
      const pcx = Math.floor(player.x / 16);
      const pcy = Math.floor(player.y / 16);

      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const chunk = this.gameState.worldManager.chunks.get(`${pcx + dx},${pcy + dy}`);
          if (chunk && chunk.spawnedWildlife && chunk.spawnedWildlife.length > 0) {
            for (const wild of chunk.spawnedWildlife) {
              const animal: AnimalEntityState = {
                id: this.gameState.getNextId(),
                kind: "animal",
                species: wild.species,
                x: wild.x,
                y: wild.y,
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
                species: wild.species,
                x: wild.x,
                y: wild.y,
              });
            }
            chunk.spawnedWildlife = [];
          }
        }
      }
    }
  }
}
