/**
 * CraftingSystem.ts - Authoritative Crafting & Recipe System
 * 
 * Implements Section 4 & 5 of authoritative_server.txt:
 * Validates crafting recipes, verifies player station proximity (workbench, campfire),
 * deducts ingredients and adds crafted items on the server.
 */

import { GameState } from "../core/GameState";
import { PlayerEntityState } from "../core/Entity";
import { Recipe, ItemId } from "../GameTypes";
import { ITEM_CATALOG } from "../SurvivalEngine";

export class CraftingSystem {
  private gameState: GameState;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  public craftRecipe(player: PlayerEntityState, recipe: Recipe): boolean {
    if (player.isDead) return false;

    // 1. Verify player has required ingredients
    for (const ing of recipe.ingredients) {
      if (!this.playerHasItem(player, ing.item, ing.count)) {
        return false;
      }
    }

    // 2. Check station proximity if required
    if (recipe.requiresStation) {
      if (!this.isPlayerNearStation(player, recipe.requiresStation)) {
        this.gameState.eventBus.emit("FLOATING_TEXT", {
          text: `Requires nearby ${recipe.requiresStation}!`,
          x: player.x,
          y: player.y - 0.8,
          color: "#f59e0b",
        });
        return false;
      }
    }

    // 3. Deduct ingredients
    for (const ing of recipe.ingredients) {
      this.removePlayerItem(player, ing.item, ing.count);
    }

    // 4. Add crafted item to inventory
    const def = ITEM_CATALOG[recipe.result];
    player.doingTimer = 0.6;
    this.addItemToPlayer(
      player,
      recipe.result,
      recipe.count,
      def.durability,
      def.maxDurability
    );

    this.gameState.eventBus.emit("ITEM_CRAFTED", {
      playerId: player.id,
      recipeId: recipe.id,
      result: recipe.result,
      count: recipe.count,
      x: player.x,
      y: player.y,
    });
    this.gameState.eventBus.emit("AUDIO_TRIGGER", { sound: "craft", playerId: player.id });
    this.gameState.eventBus.emit("FLOATING_TEXT", {
      text: `Crafted: ${def.name}`,
      x: player.x,
      y: player.y - 0.8,
      color: "#a855f7",
    });

    if (recipe.result === "wooden_axe") {
      this.gameState.updateQuestProgress("craft_axe", 1, player.x, player.y);
    }
    if (recipe.result === "campfire") {
      this.gameState.updateQuestProgress("build_campfire", 1, player.x, player.y);
    }

    return true;
  }

  public isPlayerNearStation(player: PlayerEntityState, station: "workbench" | "campfire"): boolean {
    for (const struct of this.gameState.placedStructures) {
      if (struct.structureType === station) {
        if (Math.hypot(player.x - struct.x, player.y - struct.y) <= 4.0) {
          return true;
        }
      }
    }
    return false;
  }

  private playerHasItem(player: PlayerEntityState, item: ItemId, count = 1): boolean {
    let total = 0;
    for (const s of [...player.hotbar, ...player.inventory]) {
      if (s.item === item) total += s.count;
    }
    return total >= count;
  }

  private removePlayerItem(player: PlayerEntityState, item: ItemId, count: number): void {
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

  private addItemToPlayer(
    player: PlayerEntityState,
    item: ItemId,
    count: number,
    durability?: number,
    maxDurability?: number
  ): boolean {
    const def = ITEM_CATALOG[item];
    if (!def) return false;
    const maxStack = def.maxStack || 99;

    for (const slot of [...player.hotbar, ...player.inventory]) {
      if (slot.item === item && slot.count < maxStack) {
        const canAdd = Math.min(count, maxStack - slot.count);
        slot.count += canAdd;
        count -= canAdd;
        if (count <= 0) return true;
      }
    }

    for (const slot of player.hotbar) {
      if (!slot.item) {
        slot.item = item;
        slot.count = count;
        slot.durability = durability;
        slot.maxDurability = maxDurability;
        return true;
      }
    }

    for (const slot of player.inventory) {
      if (!slot.item) {
        slot.item = item;
        slot.count = count;
        slot.durability = durability;
        slot.maxDurability = maxDurability;
        return true;
      }
    }

    return false;
  }
}
