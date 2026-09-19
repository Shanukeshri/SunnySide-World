/**
 * GameState.ts - Universal Authoritative Game State
 * 
 * Implements Section 7 & 8 of authoritative_server.txt:
 * Single source of truth containing players, animals, npcs, enemies,
 * resources, dropped items, placed structures, and world time.
 */

import { WorldManager } from "../WorldManager";
import {
  PlayerEntityState,
  AnimalEntityState,
  NPCEntityState,
  EnemyEntityState,
  DroppedItemEntityState,
  StructureEntityState,
  EntityId,
} from "./Entity";
import { EventBus } from "./EventBus";
import { WorldTime, Quest, ItemId } from "../GameTypes";
import { WALK_SPEED, SPRINT_SPEED } from "../MovementConstants";
import { setMasterSeed } from "./Random";

export class GameState {
  public worldManager: WorldManager;
  public eventBus: EventBus;
  public seed: number;

  // Stable ID counter
  private nextId: EntityId = 1000;

  // World Simulation Time
  public worldTime: WorldTime = {
    totalSeconds: 120, // Start around 6:00 AM (early morning)
    timeOfDay: "Morning",
    hour: 6,
    minute: 0,
    dayNumber: 1,
    lightLevel: 0.6,
  };

  // Connected Players (keyed by sessionId / socket id)
  public players = new Map<string, PlayerEntityState>();

  // Lifeforms & Entities
  public animals: AnimalEntityState[] = [];
  public npcs: NPCEntityState[] = [];
  public enemies: EnemyEntityState[] = [];
  public droppedItems: DroppedItemEntityState[] = [];
  public placedStructures: StructureEntityState[] = [];
  public depletedResourceIds: Set<number> = new Set();

  // Quests (per-player or realm-wide)
  public quests: Quest[] = [
    { id: "gather_wood", title: "Lumberjack Apprentice", desc: "Chop trees to gather 6 Oak Wood logs [Click Tree]", completed: false, progress: 0, goal: 6 },
    { id: "craft_axe", title: "Tool Forging", desc: "Open Inventory [I] and craft a Wooden Axe [3 Wood, 2 Sticks]", completed: false, progress: 0, goal: 1 },
    { id: "build_campfire", title: "Survival Warmth", desc: "Craft & place a Campfire for light and warmth [B]", completed: false, progress: 0, goal: 1 },
    { id: "pet_animal", title: "Beast Whisperer", desc: "Approach a gentle cow or sheep and pet them [E]", completed: false, progress: 0, goal: 1 },
    { id: "find_food", title: "Forager Instinct", desc: "Forage 5 Sweet Berries from wild bushes", completed: false, progress: 0, goal: 5 },
    { id: "mine_iron", title: "Mineral Wealth", desc: "Mine 3 raw Iron Ore deposits with your pickaxe", completed: false, progress: 0, goal: 3 },
  ];

  // Spawner timers
  public enemySpawnTimer = 0;
  public wildlifeSpawnTimer = 0;
  public hungerTickTimer = 0;

  constructor(seed: number = 42891, eventBus?: EventBus) {
    this.seed = seed;
    setMasterSeed(seed);
    this.eventBus = eventBus ?? new EventBus();
    this.worldManager = new WorldManager(seed);

    // Initial village planning and generation around spawn
    this.worldManager.updatePlayerLocation(22, 18);
    this.initializeEntitiesFromWorld();
  }

  public getNextId(): EntityId {
    return this.nextId++;
  }

  /**
   * Spawns starting wildlife and village NPCs from generated chunks.
   */
  private initializeEntitiesFromWorld(): void {
    // Collect starting wildlife from loaded chunks
    for (const chunk of this.worldManager.chunks.values()) {
      if (chunk.spawnedWildlife && chunk.spawnedWildlife.length > 0) {
        for (const wild of chunk.spawnedWildlife) {
          // Validate position against CURRENT tile state (post-village stamping)
          // Land animals must NOT be on water or blocked tiles
          const isAquatic = wild.species === "duck";
          const tile = this.worldManager.getTile(Math.floor(wild.x), Math.floor(wild.y));
          if (!isAquatic && (tile.isWater || tile.isBlocked)) continue; // Skip: this tile became water/blocked after village stamp
          if (isAquatic && !tile.isWater) continue; // Ducks must be on water

          this.animals.push({
            id: this.getNextId(),
            kind: "animal",
            species: wild.species,
            x: wild.x,
            y: wild.y,
            direction: "DOWN",
            behaviorState: "IDLE",
            health: 30,
            maxHealth: 30,
            hunger: 0,
            speed: 1.5,
            targetX: null,
            targetY: null,
            eatingBobOffset: 0,
            isPetted: false,
            pettedTimer: 0,
            pettingCooldown: 0,
            fleeTimer: 0,
          });
        }
        chunk.spawnedWildlife = [];
      }
    }

    // Spawn swimming ducks in ALL village water bodies (ponds, lakes)
    const starterVillage = this.worldManager.villages[0];
    if (starterVillage && starterVillage.data.waterBodies && starterVillage.data.waterBodies.length > 0) {
      for (const pond of starterVillage.data.waterBodies) {
        if (pond.cells.length === 0) continue;
        const duckCount = Math.min(5, Math.max(2, Math.floor(pond.cells.length / 4)));
        for (let i = 0; i < duckCount; i++) {
          const cellIndex = Math.floor(((i + 0.5) / duckCount) * pond.cells.length);
          const cell = pond.cells[cellIndex];
          this.animals.push({
            id: this.getNextId(),
            kind: "animal",
            species: "duck",
            x: starterVillage.gridX + cell.x + 0.5,
            y: starterVillage.gridY + cell.y + 0.5,
            direction: "DOWN",
            behaviorState: "IDLE",
            health: 20,
            maxHealth: 20,
            hunger: 0,
            speed: 0.8,
            targetX: null,
            targetY: null,
            eatingBobOffset: 0,
            isPetted: false,
            pettedTimer: 0,
            pettingCooldown: 0,
            fleeTimer: 0,
          });
        }
      }
    }

    // Populate specialized village NPCs around starter village (Oakvale)
    const compositeRoles = [
      { role: "blacksmith", name: "Goran the Smith", hairstyle: "mohawk" },
      { role: "builder", name: "Torvald the Carpenter", hairstyle: "curlyhair" },
      { role: "farmer", name: "Eliza the Herbologist", hairstyle: "spikeyhair" },
      { role: "fisher", name: "Finley the Angler", hairstyle: "longhair" },
      { role: "guide", name: "Old Jasper the Elder", hairstyle: "mophair" },
      { role: "merchant", name: "Marlo the Trader", hairstyle: "bowlhair" },
      { role: "child", name: "Pip the Adventurer", hairstyle: "curlyhair" },
      { role: "villager", name: "Aria the Forager", hairstyle: "braids" },
    ];

    compositeRoles.forEach((item, i) => {
      const angle = (i / compositeRoles.length) * Math.PI * 2;
      const radius = 4.5 + (i % 2) * 2.5;
      const sx = 22 + Math.cos(angle) * radius;
      const sy = 18 + Math.sin(angle) * radius;
      this.npcs.push({
        id: this.getNextId(),
        kind: "npc",
        npcType: "villager",
        name: item.name,
        role: item.role,
        x: sx,
        y: sy,
        direction: "DOWN",
        behaviorState: "IDLE",
        dialogueState: "GREETING",
        isFrozen: false,
        targetX: null,
        targetY: null,
        hairstyle: item.hairstyle,
      });
    });
  }

  /**
   * Spawns a new player into the authoritative simulation.
   */
  public addPlayer(sessionId: string, name: string = "Explorer", hairstyle: string = "style_01"): PlayerEntityState {
    const playerId = this.getNextId();
    // Default starter spawn location (Oakvale center)
    const player: PlayerEntityState = {
      id: playerId,
      kind: "player",
      sessionId,
      name,
      hairstyle,
      x: 22,
      y: 18,
      vx: 0,
      vy: 0,
      direction: "DOWN",
      facing: "RIGHT",
      speed: WALK_SPEED,
      sprintSpeed: SPRINT_SPEED,
      isSprinting: false,
      isSwimming: false,
      health: 100,
      maxHealth: 100,
      hunger: 100,
      maxHunger: 100,
      stamina: 100,
      maxStamina: 100,
      isDead: false,
      swingTimer: 0,
      hopTimer: 0,
      hopOffset: 0,
      hurtTimer: 0,
      rollTimer: 0,
      doingTimer: 0,
      fishingTimer: 0,
      fishingState: "NONE",
      isWaiting: false,
      inventory: Array.from({ length: 20 }, () => ({ item: null, count: 0 })),
      hotbar: [
        { item: "wooden_axe", count: 1, durability: 40, maxDurability: 40 },
        { item: "wooden_pickaxe", count: 1, durability: 35, maxDurability: 35 },
        { item: "wooden_sword", count: 1, durability: 50, maxDurability: 50 },
        { item: "apple", count: 5 },
        { item: null, count: 0 },
        { item: null, count: 0 },
        { item: null, count: 0 },
        { item: null, count: 0 },
      ],
      activeHotbarIndex: 0,
      activeHeldItem: "wooden_axe",
      lastProcessedInputSeq: 0,
      inputQueue: [],
    };

    this.players.set(sessionId, player);
    this.eventBus.emit("PLAYER_JOINED", {
      playerId,
      sessionId,
      name,
      x: player.x,
      y: player.y,
    });

    console.log(`[GameState] Player joined: ${name} (id: ${playerId}, session: ${sessionId})`);
    return player;
  }

  public removePlayer(sessionId: string): void {
    const player = this.players.get(sessionId);
    if (player) {
      this.players.delete(sessionId);
      this.eventBus.emit("PLAYER_LEFT", {
        playerId: player.id,
        sessionId,
        name: player.name,
      });
      console.log(`[GameState] Player left: ${player.name} (id: ${player.id})`);
    }
  }

  public getPlayer(sessionId: string): PlayerEntityState | undefined {
    return this.players.get(sessionId);
  }

  /**
   * Spawns a dropped item into the authoritative state.
   */
  public spawnDroppedItem(item: ItemId, count: number, x: number, y: number): DroppedItemEntityState {
    const drop: DroppedItemEntityState = {
      id: this.getNextId(),
      kind: "dropped_item",
      item,
      count,
      x,
      y,
      bobTimer: 0,
    };
    this.droppedItems.push(drop);
    this.eventBus.emit("ENTITY_SPAWNED", { entityId: drop.id, kind: "dropped_item", item, count, x, y });
    return drop;
  }

  public removeDroppedItem(id: EntityId): void {
    const idx = this.droppedItems.findIndex((d) => d.id === id);
    if (idx >= 0) {
      this.droppedItems.splice(idx, 1);
      this.eventBus.emit("ENTITY_DESTROYED", { entityId: id, kind: "dropped_item" });
    }
  }

  public updateQuestProgress(questId: string, amount: number, playerX: number, playerY: number): void {
    const q = this.quests.find((quest) => quest.id === questId);
    if (q && !q.completed) {
      q.progress = Math.min(q.goal, q.progress + amount);
      if (q.progress >= q.goal) {
        q.completed = true;
        this.eventBus.emit("FLOATING_TEXT", {
          text: `★ Quest Complete: ${q.title}!`,
          x: playerX,
          y: playerY - 1.2,
          color: "#facc15",
        });
        this.eventBus.emit("AUDIO_TRIGGER", { sound: "craft" });
      }
    }
  }

  /**
   * Authoritatively marks a resource as depleted, clearing collision on its footprint tiles.
   */
  public markResourceDepleted(resourceId: number): void {
    this.depletedResourceIds.add(resourceId);
    const res = this.worldManager.getResourceById(resourceId);
    if (res) {
      res.isDepleted = true;
      for (let dy = 0; dy < res.h; dy++) {
        for (let dx = 0; dx < res.w; dx++) {
          const tile = this.worldManager.getTile(
            Math.floor(res.x + dx),
            Math.floor(res.y + dy)
          );
          tile.isBlocked = false;
        }
      }
    }
  }
}
