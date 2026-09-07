/**
 * GameServer.ts - Authoritative Node.js Game Server Simulation & Room Manager
 * 
 * Implements Sections 1, 4, 10, 11, 13, 16 of authoritative_server.txt:
 * Runs the authoritative 20 Hz simulation loop with all game systems,
 * receives and validates client inputs/commands, and broadcasts state snapshots.
 */

import { Server as SocketIOServer, Socket } from "socket.io";
import { GameState } from "../game/core/GameState";
import { GameLoop } from "../game/core/GameLoop";
import { EventBus } from "../game/core/EventBus";
import { PlayerSystem } from "../game/systems/PlayerSystem";
import { AnimalSystem } from "../game/systems/AnimalSystem";
import { NPCSystem } from "../game/systems/NPCSystem";
import { CombatSystem } from "../game/systems/CombatSystem";
import { ResourceSystem } from "../game/systems/ResourceSystem";
import { CraftingSystem } from "../game/systems/CraftingSystem";
import { BuildingSystem } from "../game/systems/BuildingSystem";
import { SurvivalSystem } from "../game/systems/SurvivalSystem";
import { SpawnSystem } from "../game/systems/SpawnSystem";
import { WorldSystem } from "../game/systems/WorldSystem";
import { PersistenceManager } from "./persistence/PersistenceManager";
import { CRAFTING_RECIPES } from "../game/SurvivalEngine";
import {
  ClientJoinMessage,
  ClientInputMessage,
  ClientActionMessage,
  ServerInitMessage,
  ServerSyncMessage,
} from "./networking/Protocol";

export class GameServer {
  public gameState: GameState;
  public eventBus: EventBus;
  public gameLoop: GameLoop;
  public persistence: PersistenceManager;

  // Systems
  public playerSystem: PlayerSystem;
  public animalSystem: AnimalSystem;
  public npcSystem: NPCSystem;
  public combatSystem: CombatSystem;
  public resourceSystem: ResourceSystem;
  public craftingSystem: CraftingSystem;
  public buildingSystem: BuildingSystem;
  public survivalSystem: SurvivalSystem;
  public spawnSystem: SpawnSystem;
  public worldSystem: WorldSystem;

  private io: SocketIOServer | null = null;
  private socketMap = new Map<string, Socket>();

  constructor(seed = 42891, tickRate = 20) {
    this.eventBus = new EventBus();
    this.gameState = new GameState(seed, this.eventBus);
    this.persistence = new PersistenceManager();
    this.persistence.loadSnapshot(this.gameState);

    // Instantiate systems
    this.playerSystem = new PlayerSystem(this.gameState);
    this.animalSystem = new AnimalSystem(this.gameState);
    this.npcSystem = new NPCSystem(this.gameState);
    this.combatSystem = new CombatSystem(this.gameState, this.animalSystem);
    this.resourceSystem = new ResourceSystem(this.gameState, this.combatSystem);
    this.craftingSystem = new CraftingSystem(this.gameState);
    this.buildingSystem = new BuildingSystem(this.gameState);
    this.survivalSystem = new SurvivalSystem(this.gameState, this.combatSystem);
    this.spawnSystem = new SpawnSystem(this.gameState);
    this.worldSystem = new WorldSystem(this.gameState);

    // Initialize Game Loop
    this.gameLoop = new GameLoop(tickRate, (dt, tick) => this.tick(dt, tick));
  }

  public attachSocketIO(io: SocketIOServer): void {
    this.io = io;

    io.on("connection", (socket: Socket) => {
      console.log(`[GameServer] New connection: ${socket.id}`);
      this.socketMap.set(socket.id, socket);

      // 1. Client requests to join world
      socket.on("join", (data: ClientJoinMessage) => {
        this.handlePlayerJoin(socket, data);
      });

      // 2. Client sends continuous movement inputs
      socket.on("input", (data: ClientInputMessage) => {
        const player = this.gameState.getPlayer(socket.id);
        if (player) {
          this.playerSystem.processInput(player, data);
        }
      });

      // 3. Client sends discrete gameplay actions
      socket.on("action", (action: ClientActionMessage) => {
        const player = this.gameState.getPlayer(socket.id);
        if (player) {
          this.handlePlayerAction(player, action);
        }
      });

      // 4. Client disconnect
      socket.on("disconnect", () => {
        console.log(`[GameServer] Disconnected: ${socket.id}`);
        this.socketMap.delete(socket.id);
        this.gameState.removePlayer(socket.id);
        this.persistence.markDirty();
      });
    });
  }

  public start(): void {
    this.gameLoop.start();
    this.persistence.startAutoSave(this.gameState);
  }

  public stop(): void {
    this.gameLoop.stop();
    this.persistence.stopAutoSave();
    this.persistence.saveSnapshot(this.gameState);
  }

  /**
   * Main Simulation Tick (invoked at 20 Hz)
   */
  private tick(dt: number, tick: number): void {
    this.eventBus.setTick(tick);

    // 1. Update active player movement & timers
    this.playerSystem.update(dt);

    // 2. Update survival needs & world clock
    this.survivalSystem.update(dt);

    // 3. Update world chunks around active players
    this.worldSystem.update(dt);

    // 4. Update dropped items & pickups
    this.resourceSystem.update(dt);

    // 5. Update animals & NPCs
    this.animalSystem.update(dt);
    this.npcSystem.update(dt);

    // 6. Update hostile enemies & combat
    this.combatSystem.update(dt);

    // 7. Periodic enemy & wildlife spawns
    this.spawnSystem.update(dt);

    // 8. Collect queued events for network broadcast
    const events = this.eventBus.flushQueue();

    // 9. Broadcast authoritative state synchronization
    if (this.io && this.gameState.players.size > 0) {
      this.broadcastStateSync(tick, events);
    }
  }

  private handlePlayerJoin(socket: Socket, data: ClientJoinMessage): void {
    const name = data?.name || `Explorer_${socket.id.substring(0, 4)}`;
    const hairstyle = data?.hairstyle || "style_01";

    const player = this.gameState.addPlayer(socket.id, name, hairstyle);

    const otherPlayers = Array.from(this.gameState.players.values()).filter(
      (p) => p.sessionId !== socket.id
    );

    const initMsg: ServerInitMessage = {
      playerId: player.id,
      sessionId: socket.id,
      seed: this.gameState.seed,
      worldTime: this.gameState.worldTime,
      player,
      otherPlayers,
      placedStructures: this.gameState.placedStructures,
      quests: this.gameState.quests,
    };

    socket.emit("init", initMsg);
    this.persistence.markDirty();
  }

  private handlePlayerAction(player: any, action: ClientActionMessage): void {
    if (player.isDead && action.type !== "RESPAWN") return;

    switch (action.type) {
      case "HIT": {
        // Directional swing in front of player
        this.combatSystem.performPlayerHit(player);
        break;
      }

      case "CLICK": {
        const { wx, wy } = action;
        // Directional swing or hit clicked target
        player.swingTimer = 0.25;

        // Check animal hit
        for (const animal of this.gameState.animals) {
          if (animal.behaviorState === "DEAD") continue;
          if (Math.hypot(wx - animal.x, wy - animal.y) < 1.3 && Math.hypot(player.x - animal.x, player.y - animal.y) <= 3.2) {
            animal.health -= 15;
            this.animalSystem.scareAnimal(animal, player.x, player.y);
            this.combatSystem.useActiveToolDurability(player);
            if (animal.health <= 0) {
              animal.behaviorState = "DEAD";
              this.gameState.spawnDroppedItem("raw_meat", 2, animal.x, animal.y);
            }
            return;
          }
        }

        // Check enemy hit
        for (const enemy of this.gameState.enemies) {
          if (!enemy.isAlive) continue;
          if (Math.hypot(wx - enemy.x, wy - enemy.y) < 1.4 && Math.hypot(player.x - enemy.x, player.y - enemy.y) < 3.2) {
            this.combatSystem.attackEnemy(player, enemy);
            return;
          }
        }

        // Check resource hit
        const res = this.gameState.worldManager.getResourceAt(wx, wy, 1.4);
        if (res && !res.isDepleted) {
          this.resourceSystem.harvestResource(player, res);
          return;
        }

        // Fallback: directional hit
        this.combatSystem.performPlayerHit(player);
        break;
      }

      case "JUMP": {
        this.playerSystem.jump(player);
        break;
      }

      case "ROLL": {
        this.playerSystem.jump(player);
        break;
      }

      case "INTERACT": {
        // 1. Check NPC
        for (const npc of this.gameState.npcs) {
          if (Math.hypot(player.x - npc.x, player.y - npc.y) < 2.4) {
            this.npcSystem.interactWithNPC(npc, player.id);
            return;
          }
        }
        // 2. Check Animal
        for (const animal of this.gameState.animals) {
          if (Math.hypot(player.x - animal.x, player.y - animal.y) < 2.2) {
            if (this.animalSystem.petAnimal(animal, player.x, player.y)) {
              player.hopTimer = 0.35;
              return;
            }
          }
        }
        break;
      }

      case "FEED": {
        for (const animal of this.gameState.animals) {
          if (Math.hypot(player.x - animal.x, player.y - animal.y) < 2.2) {
            const foodItems = ["wheat", "seeds", "berries", "apple"] as const;
            for (const f of foodItems) {
              const slot = [...player.hotbar, ...player.inventory].find((s) => s.item === f);
              if (slot && slot.count > 0) {
                slot.count--;
                if (slot.count <= 0) slot.item = null;
                this.animalSystem.feedAnimal(animal, player.x, player.y);
                return;
              }
            }
          }
        }
        break;
      }

      case "EAT": {
        this.survivalSystem.eatActiveFood(player);
        break;
      }

      case "CRAFT": {
        const recipe = CRAFTING_RECIPES.find((r) => r.id === action.recipeId);
        if (recipe) {
          this.craftingSystem.craftRecipe(player, recipe);
        }
        break;
      }

      case "BUILD": {
        this.buildingSystem.placeStructure(player, action.pieceId, action.wx, action.wy);
        this.persistence.markDirty();
        break;
      }

      case "SELECT_HOTBAR": {
        if (action.index >= 0 && action.index < player.hotbar.length) {
          player.activeHotbarIndex = action.index;
          player.activeHeldItem = player.hotbar[action.index]?.item || null;
        }
        break;
      }

      case "TOGGLE_DOOR": {
        const struct = this.gameState.placedStructures.find((s) => s.id === action.structId);
        if (struct) {
          this.buildingSystem.toggleDoor(struct);
        }
        break;
      }

      case "RESPAWN": {
        this.combatSystem.respawnPlayer(player);
        break;
      }
    }
  }

  private broadcastStateSync(tick: number, events: any[]): void {
    const allPlayers = Array.from(this.gameState.players.values());

    for (const [sessionId, socket] of this.socketMap.entries()) {
      const player = this.gameState.getPlayer(sessionId);
      if (!player) continue;

      const otherPlayers = allPlayers.filter((p) => p.sessionId !== sessionId);

      const syncMsg: ServerSyncMessage = {
        tick,
        timestamp: Date.now(),
        worldTime: this.gameState.worldTime,
        lastProcessedInputSeq: player.lastProcessedInputSeq,
        player,
        otherPlayers,
        animals: this.gameState.animals,
        npcs: this.gameState.npcs,
        enemies: this.gameState.enemies,
        droppedItems: this.gameState.droppedItems,
        placedStructures: this.gameState.placedStructures,
        events,
      };

      socket.emit("sync", syncMsg);
    }
  }
}
