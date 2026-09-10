/**
 * CombatSystem.ts - Authoritative Combat & Enemy Simulation System
 * 
 * Implements Section 5 & 11 of authoritative_server.txt:
 * Validates attacks, calculates weapon damage, handles enemy AI behavior
 * (patrol, chase, attack, hurt, death), tool durability, and player damage/respawn.
 */

import { GameState } from "../core/GameState";
import { PlayerEntityState, EnemyEntityState } from "../core/Entity";
import { ITEM_CATALOG } from "../SurvivalEngine";
import { AnimalSystem } from "./AnimalSystem";
import { generateRandom, randomRange, randomInt, randomChance } from "../core/Random";

export class CombatSystem {
  private gameState: GameState;
  private animalSystem?: AnimalSystem;

  constructor(gameState: GameState, animalSystem?: AnimalSystem) {
    this.gameState = gameState;
    this.animalSystem = animalSystem;
  }

  public update(dt: number): void {
    // 1. Update hostile enemies AI and attacks
    this.updateEnemies(dt);
  }

  private updateEnemies(dt: number): void {
    const players = Array.from(this.gameState.players.values()).filter((p) => !p.isDead);

    for (let i = this.gameState.enemies.length - 1; i >= 0; i--) {
      const enemy = this.gameState.enemies[i];

      if (!enemy.isAlive) {
        enemy.deathTimer -= dt;
        if (enemy.deathTimer <= 0) {
          this.gameState.enemies.splice(i, 1);
        }
        continue;
      }

      if (enemy.hurtTimer > 0) enemy.hurtTimer -= dt;
      if (enemy.attackCooldown > 0) enemy.attackCooldown -= dt;

      // Find nearest player
      let nearestPlayer: PlayerEntityState | null = null;
      let nearestDist = 999;
      for (const p of players) {
        const d = Math.hypot(p.x - enemy.x, p.y - enemy.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearestPlayer = p;
        }
      }

      // Aggro / Chase check (8 tiles detection radius)
      if (nearestPlayer && nearestDist < 8.0) {
        const targetPlayer = nearestPlayer;
        enemy.state = "CHASE";
        const angle = Math.atan2(targetPlayer.y - enemy.y, targetPlayer.x - enemy.x);
        enemy.vx = Math.cos(angle) * enemy.speed;
        enemy.vy = Math.sin(angle) * enemy.speed;
        enemy.direction = Math.abs(enemy.vx) > Math.abs(enemy.vy) ? (enemy.vx > 0 ? "RIGHT" : "LEFT") : (enemy.vy > 0 ? "DOWN" : "UP");

        // Attack when in melee reach (1.2 tiles)
        if (nearestDist < 1.2 && enemy.attackCooldown <= 0) {
          enemy.state = "ATTACK";
          enemy.attackCooldown = 1.4;
          this.damagePlayer(targetPlayer, enemy.damage, enemy.name);
        }
      } else {
        // Patrol or Idle state
        enemy.patrolTimer -= dt;
        if (enemy.patrolTimer <= 0) {
          enemy.patrolTimer = randomRange(enemy.id, 2.5, 5.5);
          if (randomChance(enemy.id, 0.4)) {
            enemy.state = "IDLE";
            enemy.vx = 0;
            enemy.vy = 0;
          } else {
            enemy.state = "PATROL";
            const randAngle = generateRandom(enemy.id) * Math.PI * 2;
            enemy.vx = Math.cos(randAngle) * (enemy.speed * 0.5);
            enemy.vy = Math.sin(randAngle) * (enemy.speed * 0.5);
          }
        }
      }

      const nextX = enemy.x + enemy.vx * dt;
      const nextY = enemy.y + enemy.vy * dt;
      if (this.gameState.worldManager.isWalkable(nextX, nextY)) {
        enemy.x = nextX;
        enemy.y = nextY;
      }
    }
  }

  public performPlayerHit(player: PlayerEntityState): boolean {
    if (player.isDead) return false;

    player.swingTimer = 0.25;
    this.gameState.eventBus.emit("AUDIO_TRIGGER", { sound: "swing", playerId: player.id });

    // Target point 1.2 tiles in front of player
    let targetX = player.x;
    let targetY = player.y;
    if (player.direction === "UP") targetY -= 1.2;
    else if (player.direction === "DOWN") targetY += 1.2;
    else if (player.direction === "LEFT") targetX -= 1.2;
    else targetX += 1.2;

    // Check hit on hostile enemies
    for (const enemy of this.gameState.enemies) {
      if (!enemy.isAlive) continue;
      const dist = Math.hypot(targetX - enemy.x, targetY - enemy.y);
      if (dist < 1.3) {
        this.attackEnemy(player, enemy);
        return true;
      }
    }

    // Check hit on wildlife
    for (const animal of this.gameState.animals) {
      if (animal.behaviorState === "DEAD") continue;
      const dist = Math.hypot(targetX - animal.x, targetY - animal.y);
      if (dist < 1.3) {
        animal.health -= 15;
        this.animalSystem?.scareAnimal(animal, player.x, player.y);
        this.useActiveToolDurability(player);
        if (animal.health <= 0) {
          animal.behaviorState = "DEAD";
          this.gameState.spawnDroppedItem("raw_meat", 2, animal.x, animal.y);
        }
        return true;
      }
    }

    // Check hit on harvestable resources (trees, rocks)
    const res = this.gameState.worldManager.getResourceAt(targetX, targetY, 1.4);
    if (res && !res.isDepleted) {
      this.gameState.eventBus.emit("TREE_HIT", {
        resourceId: res.id,
        x: res.x,
        y: res.y,
        remainingHp: res.health,
      });
      return true;
    }

    return false;
  }

  public attackEnemy(player: PlayerEntityState, enemy: EnemyEntityState): void {
    const activeSlot = player.hotbar[player.activeHotbarIndex];
    const activeItemDef = activeSlot?.item ? ITEM_CATALOG[activeSlot.item] : null;

    const baseDamage = activeItemDef?.damage || 6;
    const damageVariance = randomRange(player.id, 0.9, 1.1);
    const finalDamage = Math.round(baseDamage * damageVariance);

    enemy.health -= finalDamage;
    enemy.hurtTimer = 0.25;

    this.gameState.eventBus.emit("FLOATING_TEXT", {
      text: `-${finalDamage}`,
      x: enemy.x,
      y: enemy.y - 0.5,
      color: "#ef4444",
    });
    this.gameState.eventBus.emit("AUDIO_TRIGGER", { sound: "hurt" });
    this.useActiveToolDurability(player);

    // Knockback
    const angle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
    enemy.x += Math.cos(angle) * 0.6;
    enemy.y += Math.sin(angle) * 0.6;

    if (enemy.health <= 0) {
      enemy.isAlive = false;
      this.gameState.eventBus.emit("FLOATING_TEXT", {
        text: "Defeated!",
        x: enemy.x,
        y: enemy.y - 0.7,
        color: "#fbbf24",
      });
      this.gameState.eventBus.emit("ENTITY_DIED", {
        entityId: enemy.id,
        enemyType: enemy.enemyType,
      });

      // Spawn loot deterministically with enemy.id
      if (enemy.enemyType === "slime") {
        this.gameState.spawnDroppedItem("slime_gel", randomInt(enemy.id, 1, 2), enemy.x, enemy.y);
      } else {
        this.gameState.spawnDroppedItem("raw_meat", 1, enemy.x, enemy.y);
        if (randomChance(enemy.id, 0.5)) {
          this.gameState.spawnDroppedItem("iron_ore", 1, enemy.x, enemy.y);
        }
      }
    }
  }

  public damagePlayer(player: PlayerEntityState, amount: number, source: string): void {
    if (player.isDead) return;

    player.health = Math.max(0, player.health - amount);
    player.hurtTimer = 0.45;

    this.gameState.eventBus.emit("PLAYER_DAMAGED", {
      playerId: player.id,
      amount,
      source,
      remainingHealth: player.health,
    });
    this.gameState.eventBus.emit("FLOATING_TEXT", {
      text: `-${amount} HP`,
      x: player.x,
      y: player.y - 0.6,
      color: "#ef4444",
    });
    this.gameState.eventBus.emit("AUDIO_TRIGGER", { sound: "hurt", playerId: player.id });

    if (player.health <= 0) {
      player.isDead = true;
      this.gameState.eventBus.emit("FLOATING_TEXT", {
        text: `Fallen to ${source}`,
        x: player.x,
        y: player.y - 1.0,
        color: "#dc2626",
      });
    }
  }

  public respawnPlayer(player: PlayerEntityState): void {
    player.health = player.maxHealth;
    player.hunger = player.maxHunger;
    player.stamina = player.maxStamina;
    player.isDead = false;
    player.x = 22;
    player.y = 18;

    this.gameState.eventBus.emit("PLAYER_RESPAWNED", {
      playerId: player.id,
      x: player.x,
      y: player.y,
    });
  }

  public useActiveToolDurability(player: PlayerEntityState): void {
    const slot = player.hotbar[player.activeHotbarIndex];
    if (slot && slot.durability !== undefined) {
      slot.durability -= 1;
      if (slot.durability <= 0) {
        this.gameState.eventBus.emit("AUDIO_TRIGGER", { sound: "hurt", playerId: player.id });
        this.gameState.eventBus.emit("FLOATING_TEXT", {
          text: "Tool Broke!",
          x: player.x,
          y: player.y - 0.8,
          color: "#f87171",
        });
        slot.item = null;
        slot.count = 0;
        slot.durability = undefined;
        player.activeHeldItem = null;
      }
    }
  }
}
