/**
 * PlayerSystem.ts - Authoritative Player Physics, Movement & Input Validation
 * 
 * Implements Section 4, 5, 15 of authoritative_server.txt:
 * Validates player inputs, performs collision detection, manages stamina,
 * swimming, and timers on the server.
 */

import { GameState } from "../core/GameState";
import { PlayerEntityState } from "../core/Entity";
import { ITEM_CATALOG } from "../SurvivalEngine";
import { ItemId } from "../GameTypes";

export class PlayerSystem {
  private gameState: GameState;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  /**
   * Applies client input vector and validates movement with collision detection.
   */
  public processInput(
    player: PlayerEntityState,
    input: { vx: number; vy: number; isSprinting: boolean; seq?: number }
  ): void {
    if (player.isDead) return;

    // Normalize input vectors to prevent speed-hacking diagonals
    let vx = input.vx;
    let vy = input.vy;
    const len = Math.hypot(vx, vy);
    if (len > 1.0) {
      vx /= len;
      vy /= len;
    }

    player.vx = vx;
    player.vy = vy;
    player.isSprinting = !!input.isSprinting;
    if (input.seq !== undefined) {
      player.lastProcessedInputSeq = input.seq;
    }
  }

  public update(dt: number): void {
    for (const player of this.gameState.players.values()) {
      if (player.isDead) continue;

      this.updatePlayerMovement(player, dt);
      this.updatePlayerTimers(player, dt);
    }
  }

  private updatePlayerMovement(player: PlayerEntityState, dt: number): void {
    const curTile = this.gameState.worldManager.getTile(
      Math.floor(player.x),
      Math.floor(player.y)
    );
    player.isSwimming = curTile.isWater;

    // Sprint & swimming speed logic
    let baseSpeed =
      player.isSprinting && player.stamina > 10
        ? player.sprintSpeed
        : player.speed;

    if (player.isSwimming) {
      baseSpeed *= 0.65;
    }

    // Stamina depletion & regeneration
    const isMoving = player.vx !== 0 || player.vy !== 0;
    if (player.isSprinting && isMoving && !player.isSwimming) {
      player.stamina = Math.max(0, player.stamina - dt * 18);
    } else {
      player.stamina = Math.min(player.maxStamina, player.stamina + dt * 14);
    }

    const nextX = player.x + player.vx * baseSpeed * dt;
    const nextY = player.y + player.vy * baseSpeed * dt;

    // Collision detection with diagonal sliding
    if (this.canMoveTo(nextX, nextY)) {
      player.x = nextX;
      player.y = nextY;
    } else {
      // Slide horizontally
      if (this.canMoveTo(nextX, player.y)) {
        player.x = nextX;
      }
      // Slide vertically
      if (this.canMoveTo(player.x, nextY)) {
        player.y = nextY;
      }
    }

    // Update facing direction
    if (player.vx > 0) {
      player.facing = "RIGHT";
      player.direction = "RIGHT";
    } else if (player.vx < 0) {
      player.facing = "LEFT";
      player.direction = "LEFT";
    } else if (player.vy > 0) {
      player.direction = "DOWN";
    } else if (player.vy < 0) {
      player.direction = "UP";
    }

    // Update active held item
    const activeSlot = player.hotbar[player.activeHotbarIndex];
    player.activeHeldItem = activeSlot?.item || null;
  }

  private updatePlayerTimers(player: PlayerEntityState, dt: number): void {
    // Hop / jump timer
    if (player.hopTimer > 0) {
      player.hopTimer -= dt;
      const progress = Math.max(0, Math.min(1, 1 - player.hopTimer / 0.55));
      player.hopOffset = Math.sin(progress * Math.PI) * 0.55;
    } else {
      player.hopOffset = 0;
    }

    // Idle wait timer
    const isMoving = player.vx !== 0 || player.vy !== 0;
    if (!isMoving && player.swingTimer <= 0 && player.hopTimer <= 0 && !player.isSwimming) {
      if (!player.isWaiting) {
        player.isWaiting = true;
      }
    } else {
      player.isWaiting = false;
    }

    // Tool swing, hurt, roll, doing timers
    if (player.swingTimer > 0) player.swingTimer -= dt;
    if (player.hurtTimer > 0) player.hurtTimer -= dt;
    if (player.rollTimer > 0) player.rollTimer -= dt;
    if (player.doingTimer > 0) player.doingTimer -= dt;

    // Fishing rod state machine
    if (player.fishingTimer > 0) {
      player.fishingTimer -= dt;
      if (player.fishingTimer <= 0) {
        if (player.fishingState === "CASTING") {
          player.fishingState = "REELING";
          player.fishingTimer = 1.6;
        } else if (player.fishingState === "REELING") {
          player.fishingState = "CAUGHT";
          player.fishingTimer = 1.0;
          this.addItemToPlayer(player, "raw_fish", 1);
          this.gameState.eventBus.emit("FLOATING_TEXT", {
            text: "+1 Raw Fish 🐟",
            x: player.x,
            y: player.y - 1,
            color: "#38bdf8",
          });
        } else {
          player.fishingState = "NONE";
        }
      }
    }
  }

  public canMoveTo(x: number, y: number): boolean {
    const r = 0.22;
    const pts = [
      { x: x - r, y: y - r },
      { x: x + r, y: y - r },
      { x: x - r, y: y + r },
      { x: x + r, y: y + r },
    ];
    for (const p of pts) {
      const tile = this.gameState.worldManager.getTile(
        Math.floor(p.x),
        Math.floor(p.y)
      );
      if (tile.isBlocked) return false;
      if (this.isBlockedByStructure(p.x, p.y)) return false;
    }
    return true;
  }

  private isBlockedByStructure(x: number, y: number): boolean {
    for (const struct of this.gameState.placedStructures) {
      if (
        struct.structureType === "wood_wall" ||
        (struct.structureType === "wood_door" && !struct.isOpen)
      ) {
        if (
          Math.abs(x - (struct.x + 0.5)) < 0.55 &&
          Math.abs(y - (struct.y + 0.5)) < 0.55
        ) {
          return true;
        }
      }
    }
    return false;
  }

  public jump(player: PlayerEntityState): void {
    if (player.isDead || player.hopTimer > 0 || player.isSwimming) return;
    player.hopTimer = 0.55;
    this.gameState.eventBus.emit("AUDIO_TRIGGER", { sound: "jump", playerId: player.id });
  }

  public addItemToPlayer(
    player: PlayerEntityState,
    item: ItemId,
    count: number,
    durability?: number,
    maxDurability?: number
  ): boolean {
    const def = ITEM_CATALOG[item];
    if (!def) return false;

    const maxStack = def.maxStack || 99;

    // 1. Stack into existing slot
    for (const slot of [...player.hotbar, ...player.inventory]) {
      if (slot.item === item && slot.count < maxStack) {
        const canAdd = Math.min(count, maxStack - slot.count);
        slot.count += canAdd;
        count -= canAdd;
        if (count <= 0) return true;
      }
    }

    // 2. Put into first empty hotbar slot
    for (const slot of player.hotbar) {
      if (!slot.item) {
        slot.item = item as any;
        slot.count = count;
        slot.durability = durability;
        slot.maxDurability = maxDurability;
        return true;
      }
    }

    // 3. Put into inventory
    for (const slot of player.inventory) {
      if (!slot.item) {
        slot.item = item as any;
        slot.count = count;
        slot.durability = durability;
        slot.maxDurability = maxDurability;
        return true;
      }
    }

    return false; // Inventory full
  }
}
