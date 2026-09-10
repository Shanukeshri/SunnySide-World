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
   * Enqueues client input vector and metadata for deterministic server simulation.
   */
  public processInput(
    player: PlayerEntityState,
    input: { seq: number; vx: number; vy: number; isSprinting: boolean; dt: number }
  ): void {
    if (player.isDead) return;

    if (!player.inputQueue) {
      player.inputQueue = [];
    }
    // Prevent queue overflow (cap to 40 recent inputs per tick)
    if (player.inputQueue.length > 40) {
      player.inputQueue.shift();
    }
    player.inputQueue.push(input);
  }

  public update(dt: number): void {
    for (const player of this.gameState.players.values()) {
      if (player.isDead) continue;

      this.updatePlayerMovement(player, dt);
      this.updatePlayerTimers(player, dt);
    }
  }

  private updatePlayerMovement(player: PlayerEntityState, dt: number): void {
    // Fix 7: Use same conceptual foot reference point for swimming detection as collision uses.
    // Previously swimming used top-left tile (floor(x), floor(y)) while collision used
    // foot position (x+0.5, y+0.65), causing inconsistent behavior around water edges.
    const curTile = this.gameState.worldManager.getTile(
      Math.floor(player.x + 0.5),
      Math.floor(player.y + 0.65)
    );
    player.isSwimming = curTile.isWater;

    // Process all queued client inputs from this tick
    if (player.inputQueue && player.inputQueue.length > 0) {
      const inputs = player.inputQueue;
      player.inputQueue = [];

      for (const input of inputs) {
        let vx = input.vx;
        let vy = input.vy;
        const len = Math.hypot(vx, vy);
        if (len > 1.0) {
          vx /= len;
          vy /= len;
        }

        const inputDt = Math.max(0.001, Math.min(0.1, input.dt || dt));
        const isSprinting = !!input.isSprinting;

        let baseSpeed = isSprinting && player.stamina > 10 ? player.sprintSpeed : player.speed;
        if (player.isSwimming) {
          baseSpeed *= 0.65;
        }

        // Stamina logic per input slice
        const isMoving = vx !== 0 || vy !== 0;
        if (isSprinting && isMoving && !player.isSwimming) {
          player.stamina = Math.max(0, player.stamina - inputDt * 18);
        } else {
          player.stamina = Math.min(player.maxStamina, player.stamina + inputDt * 14);
        }

        const nextX = player.x + vx * baseSpeed * inputDt;
        const nextY = player.y + vy * baseSpeed * inputDt;

        // Collision detection with diagonal sliding
        if (this.canMoveTo(nextX, nextY)) {
          player.x = nextX;
          player.y = nextY;
        } else {
          const canX = this.canMoveTo(nextX, player.y);
          const canY = this.canMoveTo(player.x, nextY);
          if (canX) player.x = nextX;
          if (canY) player.y = nextY;
        }

        // Direction & facing
        if (vx > 0) {
          player.facing = "RIGHT";
          player.direction = "RIGHT";
        } else if (vx < 0) {
          player.facing = "LEFT";
          player.direction = "LEFT";
        } else if (vy > 0) {
          player.direction = "DOWN";
        } else if (vy < 0) {
          player.direction = "UP";
        }

        player.vx = vx;
        player.vy = vy;
        player.isSprinting = isSprinting;
        if (input.seq !== undefined) {
          player.lastProcessedInputSeq = input.seq;
        }
      }
    } else {
      // Standing still / idle: restore stamina
      player.vx = 0;
      player.vy = 0;
      player.isSprinting = false;
      player.stamina = Math.min(player.maxStamina, player.stamina + dt * 14);
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
    const footX = x + 0.5;
    const footY = y + 0.65;
    const rx = 0.22;
    const ry = 0.16;
    const pts = [
      { x: footX - rx, y: footY - ry },
      { x: footX + rx, y: footY - ry },
      { x: footX - rx, y: footY + ry },
      { x: footX + rx, y: footY + ry },
    ];
    for (const p of pts) {
      const tile = this.gameState.worldManager.getTile(
        Math.floor(p.x),
        Math.floor(p.y)
      );
      if (tile.isBlocked) return false;
      if (this.isBlockedByStructure(footX, footY)) return false;
    }
    return true;
  }

  private isBlockedByStructure(footX: number, footY: number): boolean {
    for (const struct of this.gameState.placedStructures) {
      if (
        struct.structureType === "wood_wall" ||
        (struct.structureType === "wood_door" && !struct.isOpen)
      ) {
        const sx = struct.x + 0.5;
        const sy = struct.y + 0.5;
        if (
          Math.abs(footX - sx) < 0.62 &&
          Math.abs(footY - sy) < 0.62
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
