/**
 * BuildingSystem.ts - Authoritative Structure Placement & Container System
 *
 * Implements Section 4 & 5 of authoritative_server.txt:
 * Validates structure placement on the server, updates world collision maps,
 * manages chest inventories and door states.
 */

import { GameState } from "../core/GameState";
import { PlayerEntityState, StructureEntityState } from "../core/Entity";
import { ItemId } from "../GameTypes";
import { ITEM_CATALOG } from "../SurvivalEngine";

export class BuildingSystem {
  private gameState: GameState;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  public placeStructure(
    player: PlayerEntityState,
    pieceId: ItemId,
    wx: number,
    wy: number,
  ): boolean {
    if (player.isDead) return false;

    const tileX = Math.round(wx);
    const tileY = Math.round(wy);

    // 1. Proximity check (player must be within 5 tiles of build site)
    if (Math.hypot(player.x - tileX, player.y - tileY) > 5.0) {
      this.gameState.eventBus.emit("FLOATING_TEXT", {
        text: "Too far away to build!",
        x: tileX,
        y: tileY,
        color: "#ef4444",
      });
      return false;
    }

    // 2. Terrain tile collision check
    const tile = this.gameState.worldManager.getTile(tileX, tileY);
    if (tile.isWater || tile.isBlocked) {
      this.gameState.eventBus.emit("FLOATING_TEXT", {
        text: "Cannot build here!",
        x: tileX,
        y: tileY,
        color: "#ef4444",
      });
      return false;
    }

    // 3. Structure overlap check
    for (const struct of this.gameState.placedStructures) {
      if (
        Math.abs(struct.x - tileX) < 0.8 &&
        Math.abs(struct.y - tileY) < 0.8
      ) {
        this.gameState.eventBus.emit("FLOATING_TEXT", {
          text: "Space already occupied!",
          x: tileX,
          y: tileY,
          color: "#ef4444",
        });
        return false;
      }
    }

    // 4. Inventory cost check
    if (!this.playerHasItem(player, pieceId, 1)) {
      return false;
    }
    this.removePlayerItem(player, pieceId, 1);

    // 5. Create placed structure state
    const structType = pieceId as StructureEntityState["structureType"];
    const newStruct: StructureEntityState = {
      id: this.gameState.getNextId(),
      kind: "structure",
      structureType: structType,
      x: tileX,
      y: tileY,
      w: 1,
      h: 1,
      chestStorage:
        structType === "chest"
          ? Array.from({ length: 16 }, () => ({ item: null, count: 0 }))
          : undefined,
      isOpen: false,
    };

    this.gameState.placedStructures.push(newStruct);
    tile.isBlocked = structType === "wood_wall" || structType === "chest" || structType === "workbench";

    this.gameState.eventBus.emit("BUILDING_PLACED", {
      playerId: player.id,
      structureId: newStruct.id,
      structureType: structType,
      x: tileX,
      y: tileY,
    });
    this.gameState.eventBus.emit("AUDIO_TRIGGER", {
      sound: "build",
      playerId: player.id,
    });
    this.gameState.eventBus.emit("FLOATING_TEXT", {
      text: `Placed ${ITEM_CATALOG[pieceId]?.name || pieceId}`,
      x: tileX,
      y: tileY - 0.5,
      color: "#22c55e",
    });

    if (pieceId === "campfire") {
      this.gameState.updateQuestProgress(
        "build_campfire",
        1,
        player.x,
        player.y,
      );
    }

    return true;
  }

  public toggleDoor(struct: StructureEntityState): void {
    if (struct.structureType === "wood_door") {
      struct.isOpen = !struct.isOpen;
      const tile = this.gameState.worldManager.getTile(struct.x, struct.y);
      tile.isBlocked = !struct.isOpen;
      this.gameState.eventBus.emit("AUDIO_TRIGGER", { sound: "build" });
    }
  }

  private playerHasItem(
    player: PlayerEntityState,
    item: ItemId,
    count = 1,
  ): boolean {
    let total = 0;
    for (const s of [...player.hotbar, ...player.inventory]) {
      if (s.item === item) total += s.count;
    }
    return total >= count;
  }

  private removePlayerItem(
    player: PlayerEntityState,
    item: ItemId,
    count: number,
  ): void {
    let needed = count;
    for (const s of [...player.hotbar, ...player.inventory]) {
      if (s.item === item) {
        const take = Math.min(needed, s.count);
        s.count -= take;
        needed -= take;
        if (s.count <= 0) s.item = null;
        if (needed <= 0) return;
      }
    }
  }
}
