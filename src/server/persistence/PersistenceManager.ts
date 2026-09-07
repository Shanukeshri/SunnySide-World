/**
 * PersistenceManager.ts - Game State Persistence & Snapshot Manager
 * 
 * Implements Section 19 of authoritative_server.txt:
 * Decoupled persistence manager saving world time, placed structures,
 * and player profiles periodically to disk without blocking tick execution.
 */

import fs from "fs";
import path from "path";
import { GameState } from "../../game/core/GameState";

export interface WorldSnapshot {
  version: number;
  timestamp: number;
  seed: number;
  worldTime: GameState["worldTime"];
  placedStructures: GameState["placedStructures"];
  players: {
    sessionId: string;
    name: string;
    x: number;
    y: number;
    health: number;
    hunger: number;
    stamina: number;
    inventory: any[];
    hotbar: any[];
  }[];
}

export class PersistenceManager {
  private saveFilePath: string;
  private autoSaveIntervalMs: number;
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private isDirty: boolean = false;

  constructor(
    saveDir = "./saves",
    fileName = "world_save.json",
    autoSaveIntervalMs = 60000 // default 60 seconds
  ) {
    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir, { recursive: true });
    }
    this.saveFilePath = path.join(saveDir, fileName);
    this.autoSaveIntervalMs = autoSaveIntervalMs;
  }

  public markDirty(): void {
    this.isDirty = true;
  }

  public startAutoSave(gameState: GameState): void {
    this.autoSaveTimer = setInterval(() => {
      if (this.isDirty) {
        this.saveSnapshot(gameState);
        this.isDirty = false;
      }
    }, this.autoSaveIntervalMs);
  }

  public stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  public saveSnapshot(gameState: GameState): boolean {
    try {
      const snapshot: WorldSnapshot = {
        version: 1,
        timestamp: Date.now(),
        seed: gameState.seed,
        worldTime: gameState.worldTime,
        placedStructures: gameState.placedStructures,
        players: Array.from(gameState.players.values()).map((p) => ({
          sessionId: p.sessionId,
          name: p.name,
          x: p.x,
          y: p.y,
          health: p.health,
          hunger: p.hunger,
          stamina: p.stamina,
          inventory: p.inventory,
          hotbar: p.hotbar,
        })),
      };

      fs.writeFileSync(this.saveFilePath, JSON.stringify(snapshot, null, 2), "utf-8");
      console.log(`[Persistence] World saved successfully (${snapshot.placedStructures.length} structures)`);
      return true;
    } catch (err) {
      console.error("[Persistence] Error saving world snapshot:", err);
      return false;
    }
  }

  public loadSnapshot(gameState: GameState): boolean {
    if (!fs.existsSync(this.saveFilePath)) return false;

    try {
      const content = fs.readFileSync(this.saveFilePath, "utf-8");
      const snapshot: WorldSnapshot = JSON.parse(content);

      if (snapshot.worldTime) {
        gameState.worldTime = { ...snapshot.worldTime };
      }
      if (Array.isArray(snapshot.placedStructures)) {
        gameState.placedStructures = snapshot.placedStructures;
        // Re-apply collision blocks
        for (const s of gameState.placedStructures) {
          if (s.structureType === "wood_wall") {
            const tile = gameState.worldManager.getTile(s.x, s.y);
            tile.isBlocked = true;
          }
        }
      }

      console.log(`[Persistence] World loaded successfully from ${this.saveFilePath}`);
      return true;
    } catch (err) {
      console.error("[Persistence] Error reading save file:", err);
      return false;
    }
  }
}
