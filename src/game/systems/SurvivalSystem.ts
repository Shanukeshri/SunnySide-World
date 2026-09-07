/**
 * SurvivalSystem.ts - Authoritative Survival Mechanics & World Clock
 * 
 * Implements Section 2 & 13 of authoritative_server.txt:
 * Manages player hunger drain, natural health regeneration, starvation,
 * and the authoritative day/night simulation clock.
 */

import { GameState } from "../core/GameState";
import { PlayerEntityState } from "../core/Entity";
import { CombatSystem } from "./CombatSystem";
import { ITEM_CATALOG } from "../SurvivalEngine";

export class SurvivalSystem {
  private gameState: GameState;
  private combatSystem: CombatSystem;

  constructor(gameState: GameState, combatSystem: CombatSystem) {
    this.gameState = gameState;
    this.combatSystem = combatSystem;
  }

  public update(dt: number): void {
    this.updateWorldTime(dt);
    this.updateSurvivalNeeds(dt);
  }

  private updateWorldTime(dt: number): void {
    const wt = this.gameState.worldTime;
    wt.totalSeconds += dt;
    const cycleLength = 480; // 8 minutes full 24h cycle
    const dayProgress = (wt.totalSeconds % cycleLength) / cycleLength;

    const totalHours = dayProgress * 24;
    wt.hour = Math.floor(totalHours);
    wt.minute = Math.floor((totalHours % 1) * 60);
    wt.dayNumber = Math.floor(wt.totalSeconds / cycleLength) + 1;

    // Time of day & Light Level
    if (wt.hour >= 5 && wt.hour < 8) {
      wt.timeOfDay = "Morning";
      wt.lightLevel = 0.4 + ((wt.hour - 5) / 3) * 0.5;
    } else if (wt.hour >= 8 && wt.hour < 18) {
      wt.timeOfDay = "Day";
      wt.lightLevel = 1.0;
    } else if (wt.hour >= 18 && wt.hour < 21) {
      wt.timeOfDay = "Sunset";
      wt.lightLevel = 1.0 - ((wt.hour - 18) / 3) * 0.75;
    } else {
      wt.timeOfDay = "Night";
      wt.lightLevel = 0.18; // dark night
    }
  }

  private updateSurvivalNeeds(dt: number): void {
    this.gameState.hungerTickTimer += dt;
    if (this.gameState.hungerTickTimer >= 3.0) {
      this.gameState.hungerTickTimer = 0;

      for (const player of this.gameState.players.values()) {
        if (player.isDead) continue;

        // Hunger drain
        const drain = player.isSprinting ? 1.2 : 0.6;
        player.hunger = Math.max(0, player.hunger - drain);

        // Starvation damage vs healing
        if (player.hunger <= 0) {
          this.combatSystem.damagePlayer(player, 4, "Starvation");
        } else if (player.hunger >= 85 && player.health < player.maxHealth) {
          player.health = Math.min(player.maxHealth, player.health + 2);
        }
      }
    }
  }

  public eatActiveFood(player: PlayerEntityState): boolean {
    if (player.isDead) return false;

    const slot = player.hotbar[player.activeHotbarIndex];
    if (!slot || !slot.item) return false;

    const def = ITEM_CATALOG[slot.item];
    if (def && def.category === "food" && def.hungerRestore) {
      player.hunger = Math.min(player.maxHunger, player.hunger + def.hungerRestore);
      if (def.healthRestore) {
        player.health = Math.min(player.maxHealth, player.health + def.healthRestore);
      }

      this.gameState.eventBus.emit("AUDIO_TRIGGER", { sound: "eat", playerId: player.id });
      this.gameState.eventBus.emit("FLOATING_TEXT", {
        text: `+${def.hungerRestore} Hunger`,
        x: player.x,
        y: player.y - 0.8,
        color: "#10b981",
      });

      slot.count -= 1;
      if (slot.count <= 0) {
        slot.item = null;
        player.activeHeldItem = null;
      }
      return true;
    }
    return false;
  }
}
