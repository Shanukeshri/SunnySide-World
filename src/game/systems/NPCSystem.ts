/**
 * NPCSystem.ts - Authoritative Village NPC Simulation System
 * 
 * Implements Section 2 & 9 of authoritative_server.txt:
 * Controls NPC AI wandering within villages, freeze/cull outside active chunk range,
 * and handles dialogue states authoritatively.
 */

import { GameState } from "../core/GameState";
import { NPCEntityState } from "../core/Entity";
import { generateRandom, randomRange } from "../core/Random";

export class NPCSystem {
  private gameState: GameState;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  public update(dt: number): void {
    const playerPositions: { x: number; y: number }[] = [];
    for (const p of this.gameState.players.values()) {
      if (!p.isDead) playerPositions.push({ x: p.x, y: p.y });
    }

    for (const npc of this.gameState.npcs) {
      // Chunk distance check (> 4 chunks ~ 64 tiles from any player)
      let isNearPlayer = playerPositions.length === 0;
      for (const pos of playerPositions) {
        if (Math.hypot(npc.x - pos.x, npc.y - pos.y) <= 64) {
          isNearPlayer = true;
          break;
        }
      }

      if (!isNearPlayer) {
        npc.isFrozen = true;
        continue;
      }

      npc.isFrozen = false;
      this.updateNPCAI(npc, dt);
      this.updateNPCMovement(npc, dt);
    }
  }

  private updateNPCAI(npc: NPCEntityState, _dt: number): void {
    if (npc.behaviorState === "TALKING") return;

    if (npc.behaviorState === "IDLE") {
      if (generateRandom(npc.id) < 0.02) {
        // Pick new wander target within 6 tiles
        const angle = generateRandom(npc.id) * Math.PI * 2;
        const dist = randomRange(npc.id, 2, 6);
        const tx = npc.x + Math.cos(angle) * dist;
        const ty = npc.y + Math.sin(angle) * dist;

        const tile = this.gameState.worldManager.getTile(Math.floor(tx), Math.floor(ty));
        if (!tile.isWater && !tile.isBlocked) {
          npc.targetX = tx;
          npc.targetY = ty;
          npc.behaviorState = "WANDER";
        }
      }
    }
  }

  private updateNPCMovement(npc: NPCEntityState, dt: number): void {
    if (npc.targetX === null || npc.targetY === null) return;
    if (npc.behaviorState !== "WANDER") return;

    const dx = npc.targetX - npc.x;
    const dy = npc.targetY - npc.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 0.2) {
      npc.targetX = null;
      npc.targetY = null;
      npc.behaviorState = "IDLE";
      return;
    }

    const speed = 1.4;
    const step = Math.min(dist, speed * dt);
    const nextX = npc.x + (dx / dist) * step;
    const nextY = npc.y + (dy / dist) * step;

    const tile = this.gameState.worldManager.getTile(Math.floor(nextX), Math.floor(nextY));
    if (!tile.isWater && !tile.isBlocked) {
      npc.x = nextX;
      npc.y = nextY;
      npc.direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "RIGHT" : "LEFT") : (dy > 0 ? "DOWN" : "UP");
    } else {
      npc.targetX = null;
      npc.targetY = null;
      npc.behaviorState = "IDLE";
    }
  }

  public interactWithNPC(npc: NPCEntityState, playerId: number): void {
    npc.behaviorState = "TALKING";
    this.gameState.eventBus.emit("NPC_DIALOGUE", {
      npcId: npc.id,
      npcName: npc.name,
      role: npc.role,
      playerId,
      x: npc.x,
      y: npc.y,
    });
    this.gameState.eventBus.emit("AUDIO_TRIGGER", { sound: "heart" });
  }

  public endDialogue(npc: NPCEntityState): void {
    npc.behaviorState = "IDLE";
  }
}
