/**
 * ResourceSystem.ts - Authoritative Resource Harvesting & Dropped Item Pickup
 * 
 * Implements Section 3, 5, 11 of authoritative_server.txt:
 * Validates resource interaction, decreases resource HP on the server,
 * spawns dropped items, and manages auto-pickup into player inventories.
 */

import { GameState } from "../core/GameState";
import { PlayerEntityState } from "../core/Entity";
import { ResourceNode, ItemId } from "../GameTypes";
import { ITEM_CATALOG } from "../SurvivalEngine";
import { CombatSystem } from "./CombatSystem";
import { generateRandom, randomInt, randomChance } from "../core/Random";

export class ResourceSystem {
  private gameState: GameState;
  private combatSystem: CombatSystem;

  constructor(gameState: GameState, combatSystem: CombatSystem) {
    this.gameState = gameState;
    this.combatSystem = combatSystem;
  }

  public update(dt: number): void {
    this.updateDroppedItems(dt);
  }

  /**
   * Validates and executes harvesting on a resource node (tree, rock, bush, crop).
   */
  public harvestResource(player: PlayerEntityState, res: ResourceNode): boolean {
    if (res.isDepleted) return false;

    // Server proximity validation: player must be within 3.5 tiles of the resource
    const dist = Math.hypot(player.x - res.x, player.y - res.y);
    if (dist > 3.5) return false;

    const activeSlot = player.hotbar[player.activeHotbarIndex];
    const activeItemDef = activeSlot?.item ? ITEM_CATALOG[activeSlot.item] : null;

    let power = 5;
    if (activeItemDef?.gatherType === "wood" && res.type === "tree") {
      power = activeItemDef.gatherPower || 12;
    } else if (
      activeItemDef?.gatherType === "stone" &&
      (res.type === "rock" || res.type === "iron_rock")
    ) {
      power = activeItemDef.gatherPower || 12;
    }

    res.health -= power;
    res.shakeTimer = 0.2;

    if (res.type === "tree") {
      this.gameState.eventBus.emit("TREE_HIT", {
        resourceId: res.id,
        x: res.x,
        y: res.y,
        remainingHp: res.health,
      });
      this.gameState.eventBus.emit("AUDIO_TRIGGER", { sound: "chop", playerId: player.id });
    } else if (res.type === "rock" || res.type === "iron_rock") {
      this.gameState.eventBus.emit("ROCK_HIT", {
        resourceId: res.id,
        x: res.x,
        y: res.y,
        remainingHp: res.health,
      });
      this.gameState.eventBus.emit("AUDIO_TRIGGER", { sound: "mine", playerId: player.id });
    } else {
      this.gameState.eventBus.emit("AUDIO_TRIGGER", { sound: "pickup", playerId: player.id });
    }

    this.combatSystem.useActiveToolDurability(player);

    if (res.health <= 0) {
      res.isDepleted = true;

      if (res.type === "crop") {
        this.gameState.spawnDroppedItem("wheat", randomInt(res.id, 1, 2), res.x, res.y);
        if (randomChance(res.id, 0.5)) {
          this.gameState.spawnDroppedItem("seeds", 1, res.x + 0.2, res.y);
        }
      } else if (res.type === "tree") {
        const count = randomInt(res.id, 3, 5);
        this.gameState.spawnDroppedItem(res.lootItem, count, res.x, res.y);
        if (res.secondaryLoot && randomChance(res.id, 0.55)) {
          this.gameState.spawnDroppedItem(res.secondaryLoot, 1, res.x + 0.3, res.y);
        }
        this.gameState.eventBus.emit("TREE_DESTROYED", { resourceId: res.id, x: res.x, y: res.y });
      } else {
        const count = randomInt(res.id, 2, 3);
        this.gameState.spawnDroppedItem(res.lootItem, count, res.x, res.y);
        if (res.secondaryLoot && randomChance(res.id, 0.55)) {
          this.gameState.spawnDroppedItem(res.secondaryLoot, 1, res.x + 0.3, res.y);
        }
        this.gameState.eventBus.emit("ROCK_DESTROYED", { resourceId: res.id, x: res.x, y: res.y });
      }

      // Unblock tiles
      for (let dy = 0; dy < res.h; dy++) {
        for (let dx = 0; dx < res.w; dx++) {
          const tile = this.gameState.worldManager.getTile(
            Math.floor(res.x + dx),
            Math.floor(res.y + dy)
          );
          tile.isBlocked = false;
        }
      }
    }

    return true;
  }

  /**
   * Updates dropped items bobbing, magnet pull, and auto-pickup into player inventories.
   */
  private updateDroppedItems(dt: number): void {
    const players = Array.from(this.gameState.players.values()).filter((p) => !p.isDead);

    for (let i = this.gameState.droppedItems.length - 1; i >= 0; i--) {
      const item = this.gameState.droppedItems[i];
      item.bobTimer += dt * 4;

      // Check proximity to any player
      for (const player of players) {
        const dist = Math.hypot(player.x - item.x, player.y - item.y);

        if (dist < 2.5) {
          // Magnet pull
          const speed = (2.5 - dist) * 4;
          const angle = Math.atan2(player.y - item.y, player.x - item.x);
          item.x += Math.cos(angle) * speed * dt;
          item.y += Math.sin(angle) * speed * dt;

          // Pickup distance
          if (dist < 0.7) {
            if (this.addItemToPlayer(player, item.item, item.count)) {
              this.gameState.eventBus.emit("ITEM_PICKED_UP", {
                playerId: player.id,
                item: item.item,
                count: item.count,
                x: item.x,
                y: item.y,
              });
              this.gameState.eventBus.emit("AUDIO_TRIGGER", { sound: "pickup", playerId: player.id });
              this.gameState.eventBus.emit("FLOATING_TEXT", {
                text: `+${item.count} ${ITEM_CATALOG[item.item]?.name || item.item}`,
                x: item.x,
                y: item.y,
                color: "#38bdf8",
              });

              // Quest checks
              if (item.item === "wood") this.gameState.updateQuestProgress("gather_wood", item.count, player.x, player.y);
              if (item.item === "berries") this.gameState.updateQuestProgress("find_food", item.count, player.x, player.y);
              if (item.item === "iron_ore") this.gameState.updateQuestProgress("mine_iron", item.count, player.x, player.y);

              this.gameState.droppedItems.splice(i, 1);
              break;
            }
          }
        }
      }
    }
  }

  private addItemToPlayer(player: PlayerEntityState, item: ItemId, count: number): boolean {
    const def = ITEM_CATALOG[item];
    if (!def) return false;

    const maxStack = def.maxStack || 99;

    // Stack in existing slot
    for (const slot of [...player.hotbar, ...player.inventory]) {
      if (slot.item === item && slot.count < maxStack) {
        const canAdd = Math.min(count, maxStack - slot.count);
        slot.count += canAdd;
        count -= canAdd;
        if (count <= 0) return true;
      }
    }

    // Hotbar first
    for (const slot of player.hotbar) {
      if (!slot.item) {
        slot.item = item;
        slot.count = count;
        return true;
      }
    }

    // Inventory
    for (const slot of player.inventory) {
      if (!slot.item) {
        slot.item = item;
        slot.count = count;
        return true;
      }
    }

    return false; // full
  }
}
