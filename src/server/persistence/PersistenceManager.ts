/**
 * PersistenceManager.ts - Game State Persistence & Snapshot Manager
 * 
 * Implements Section 19 & 25 of authoritative_server.txt & implementation_spec.txt:
 * Decoupled persistence manager saving world time, placed structures,
 * and player profiles periodically to disk or localStorage without blocking tick execution.
 */

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

const isBrowser = typeof window !== "undefined";

function getNodeFs(): any {
  if (isBrowser) return null;
  try {
    const req = typeof require !== "undefined" ? require : new Function("return typeof require !== 'undefined' ? require : null")();
    return req ? req("fs") : null;
  } catch {
    return null;
  }
}

export class PersistenceManager {
  private saveFilePath: string;
  private autoSaveIntervalMs: number;
  private autoSaveTimer: any = null;
  private isDirty: boolean = false;
  private storageKey: string = "sunnyside_world_save";
  private nodeFs: any = null;

  constructor(
    saveDir = "./saves",
    fileName = "world_save.json",
    autoSaveIntervalMs = 60000 // default 60 seconds
  ) {
    this.saveFilePath = `${saveDir}/${fileName}`;
    this.autoSaveIntervalMs = autoSaveIntervalMs;
    this.nodeFs = getNodeFs();

    if (this.nodeFs) {
      try {
        if (!this.nodeFs.existsSync(saveDir)) {
          this.nodeFs.mkdirSync(saveDir, { recursive: true });
        }
      } catch {
        // ignore
      }
    }
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

      const jsonStr = JSON.stringify(snapshot, null, 2);

      if (isBrowser) {
        try {
          window.localStorage.setItem(this.storageKey, jsonStr);
          console.log(`[Persistence] World saved to browser localStorage (${snapshot.placedStructures.length} structures)`);
          return true;
        } catch (e) {
          console.warn("[Persistence] Browser localStorage save failed:", e);
          return false;
        }
      } else if (this.nodeFs) {
        this.nodeFs.writeFileSync(this.saveFilePath, jsonStr, "utf-8");
        console.log(`[Persistence] World saved successfully to ${this.saveFilePath} (${snapshot.placedStructures.length} structures)`);
        return true;
      }
      return false;
    } catch (err) {
      console.error("[Persistence] Error saving world snapshot:", err);
      return false;
    }
  }

  public loadSnapshot(gameState: GameState): boolean {
    try {
      let content: string | null = null;

      if (isBrowser) {
        content = window.localStorage.getItem(this.storageKey);
      } else if (this.nodeFs) {
        if (this.nodeFs.existsSync(this.saveFilePath)) {
          content = this.nodeFs.readFileSync(this.saveFilePath, "utf-8");
        }
      }

      if (!content) return false;

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

      console.log(`[Persistence] World loaded successfully (${gameState.placedStructures.length} structures)`);
      return true;
    } catch (err) {
      console.error("[Persistence] Error reading save file:", err);
      return false;
    }
  }
}
