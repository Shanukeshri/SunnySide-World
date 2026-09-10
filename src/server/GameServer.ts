/**
 * GameServer.ts - Authoritative Game Server Simulation & Room Manager
 *
 * Implements Sections 1, 2, 4, 6, 10, 11, 12, 13, 17, 26, 33 of implementation_spec.txt:
 * Runs the single canonical authoritative 20 Hz simulation loop with all 10 game systems,
 * receives and validates client inputs/commands, manages player reconnection tokens,
 * and broadcasts state snapshots (over Socket.IO or embedded local transport).
 */

import type { Server as SocketIOServer, Socket } from "socket.io";
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
import { PlayerEntityState } from "../game/core/Entity";
import {
  ClientJoinMessage,
  ClientInputMessage,
  ClientActionMessage,
  ServerInitMessage,
  ServerSyncMessage,
} from "./networking/Protocol";

export interface ITransportSocket {
  id: string;
  emit(event: string, ...args: any[]): void;
  on(event: string, handler: (...args: any[]) => void): void;
}

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
  private socketMap = new Map<string, ITransportSocket>();

  // Reconnection and token session management (Section 26)
  private tokenPlayerMap = new Map<string, PlayerEntityState>();
  private playerTokenMap = new Map<string, string>(); // sessionId -> token
  private disconnectTimers = new Map<string, any>();

  // Delta synchronization trackers (Section 28)
  private structuresDirty = true;
  private droppedItemsDirty = true;
  private lastStructuresLength = -1;
  private lastDroppedItemsLength = -1;

  constructor(seed = 42891, tickRate = 20) {
    this.eventBus = new EventBus();
    this.gameState = new GameState(seed, this.eventBus);
    this.persistence = new PersistenceManager();
    this.persistence.loadSnapshot(this.gameState);

    // Instantiate authoritative systems
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

    // Initialize 20 Hz Game Loop
    this.gameLoop = new GameLoop(tickRate, (dt, tick) => this.tick(dt, tick));
  }

  public attachSocketIO(io: SocketIOServer): void {
    this.io = io;

    io.on("connection", (socket: Socket) => {
      console.log(`[GameServer] New WebSocket connection: ${socket.id}`);
      this.registerSocket(socket as unknown as ITransportSocket);
    });
  }

  /**
   * Registers a socket connection (either real Socket.IO or in-memory local transport).
   */
  public registerSocket(socket: ITransportSocket): void {
    this.socketMap.set(socket.id, socket);

    socket.on("join", (data: ClientJoinMessage) => {
      this.handlePlayerJoin(socket, data);
    });

    socket.on("input", (data: ClientInputMessage) => {
      const player = this.gameState.getPlayer(socket.id);
      if (player) {
        this.playerSystem.processInput(player, data);
      }
    });

    socket.on("action", (action: ClientActionMessage) => {
      const player = this.gameState.getPlayer(socket.id);
      if (player) {
        this.handlePlayerAction(player, action);
      }
    });

    socket.on("disconnect", () => {
      this.handlePlayerDisconnect(socket.id);
    });
  }

  /**
   * Creates an in-memory client transport for offline single-player mode.
   * Runs the exact same simulation model, systems, and protocols (Section 33).
   */
  public createLocalClientTransport(): {
    id: string;
    emit: (event: string, data?: any) => void;
    on: (event: string, handler: (data?: any) => void) => void;
    disconnect: () => void;
  } {
    const localId = `local_${Math.random().toString(36).substring(2, 9)}`;
    const serverHandlers = new Map<string, ((data: any) => void)[]>();
    const clientHandlers = new Map<string, ((data: any) => void)[]>();

    const serverSideSocket: ITransportSocket = {
      id: localId,
      emit: (event: string, data: any) => {
        const handlers = clientHandlers.get(event);
        if (handlers) {
          for (const h of handlers) h(data);
        }
      },
      on: (event: string, handler: (data: any) => void) => {
        let list = serverHandlers.get(event);
        if (!list) {
          list = [];
          serverHandlers.set(event, list);
        }
        list.push(handler);
      },
    };

    const clientSide = {
      id: localId,
      emit: (event: string, data?: any) => {
        const handlers = serverHandlers.get(event);
        if (handlers) {
          for (const h of handlers) h(data);
        }
      },
      on: (event: string, handler: (data?: any) => void) => {
        let list = clientHandlers.get(event);
        if (!list) {
          list = [];
          clientHandlers.set(event, list);
        }
        list.push(handler);
      },
      disconnect: () => {
        const handlers = serverHandlers.get("disconnect");
        if (handlers) {
          for (const h of handlers) h({});
        }
      },
    };

    this.registerSocket(serverSideSocket);
    return clientSide;
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
    if (this.socketMap.size > 0 && this.gameState.players.size > 0) {
      this.broadcastStateSync(tick, events);
    }
  }

  private handlePlayerJoin(socket: ITransportSocket, data: ClientJoinMessage): void {
    const token = data?.token;
    const name = data?.name || `Explorer_${socket.id.substring(0, 4)}`;
    const hairstyle = data?.hairstyle || "style_01";

    let player: PlayerEntityState | undefined;

    // Check if player is reconnecting with an existing valid session token (Section 26)
    if (token && this.tokenPlayerMap.has(token)) {
      player = this.tokenPlayerMap.get(token)!;
      console.log(`[GameServer] Reconnecting existing player: ${player.name} (id: ${player.id}, token: ${token})`);

      // Clear any pending disconnect cleanup timer
      if (this.disconnectTimers.has(player.sessionId)) {
        clearTimeout(this.disconnectTimers.get(player.sessionId));
        this.disconnectTimers.delete(player.sessionId);
      }

      // Re-bind to new socket ID
      this.gameState.players.delete(player.sessionId);
      player.sessionId = socket.id;
      this.gameState.players.set(socket.id, player);
      this.playerTokenMap.set(socket.id, token);
    } else {
      // Create new player
      player = this.gameState.addPlayer(socket.id, name, hairstyle);
      if (token) {
        this.tokenPlayerMap.set(token, player);
        this.playerTokenMap.set(socket.id, token);
      }
    }

    const otherPlayers = Array.from(this.gameState.players.values()).filter(
      (p) => p.sessionId !== socket.id,
    );

    const initMsg: ServerInitMessage = {
      playerId: player.id,
      sessionId: socket.id,
      seed: this.gameState.seed,
      worldTime: this.gameState.worldTime,
      player,
      otherPlayers,
      placedStructures: this.gameState.placedStructures,
      droppedItems: this.gameState.droppedItems,
      quests: this.gameState.quests,
    };

    socket.emit("init", initMsg);
    this.persistence.markDirty();
  }

  private handlePlayerDisconnect(sessionId: string): void {
    console.log(`[GameServer] Player disconnected: ${sessionId}`);
    this.socketMap.delete(sessionId);

    const token = this.playerTokenMap.get(sessionId);

    if (token) {
      // Grace period (30s) before destroying the player entity to allow reconnect (Section 26)
      const timer = setTimeout(() => {
        this.gameState.removePlayer(sessionId);
        this.tokenPlayerMap.delete(token);
        this.playerTokenMap.delete(sessionId);
        this.disconnectTimers.delete(sessionId);
        this.persistence.markDirty();
        console.log(`[GameServer] Disconnected player session expired: ${sessionId}`);
      }, 30000);
      this.disconnectTimers.set(sessionId, timer);
    } else {
      this.gameState.removePlayer(sessionId);
      this.persistence.markDirty();
    }
  }

  private handlePlayerAction(player: PlayerEntityState, action: ClientActionMessage): void {
    if (player.isDead && action.type !== "RESPAWN") return;

    switch (action.type) {
      case "HIT": {
        this.combatSystem.performPlayerHit(player);
        break;
      }

      case "CLICK": {
        const { wx, wy } = action;
        player.swingTimer = 0.25;

        // Check animal hit
        for (const animal of this.gameState.animals) {
          if (animal.behaviorState === "DEAD") continue;
          if (
            Math.hypot(wx - animal.x, wy - animal.y) < 1.3 &&
            Math.hypot(player.x - animal.x, player.y - animal.y) <= 3.2
          ) {
            animal.health -= 15;
            this.animalSystem.scareAnimal(animal, player.x, player.y);
            this.combatSystem.useActiveToolDurability(player);
            if (animal.health <= 0) {
              animal.behaviorState = "DEAD";
              this.gameState.spawnDroppedItem("raw_meat", 2, animal.x, animal.y);
              this.droppedItemsDirty = true;
            }
            return;
          }
        }

        // Check enemy hit
        for (const enemy of this.gameState.enemies) {
          if (!enemy.isAlive) continue;
          if (
            Math.hypot(wx - enemy.x, wy - enemy.y) < 1.4 &&
            Math.hypot(player.x - enemy.x, player.y - enemy.y) < 3.2
          ) {
            this.combatSystem.attackEnemy(player, enemy);
            return;
          }
        }

        // Check resource hit
        const res = this.gameState.worldManager.getResourceAt(wx, wy, 1.4);
        if (res && !res.isDepleted) {
          this.resourceSystem.harvestResource(player, res);
          this.droppedItemsDirty = true;
          return;
        }

        // Fallback: directional hit
        this.combatSystem.performPlayerHit(player);
        break;
      }

      case "ATTACK_RESOURCE": {
        const res = this.gameState.worldManager.getResourceById(action.resourceId);
        if (res && !res.isDepleted) {
          this.resourceSystem.harvestResource(player, res);
          this.droppedItemsDirty = true;
        }
        break;
      }

      case "JUMP":
      case "ROLL": {
        this.playerSystem.jump(player);
        break;
      }

      case "INTERACT": {
        // 1. Check NPC proximity
        for (const npc of this.gameState.npcs) {
          if (Math.hypot(player.x - npc.x, player.y - npc.y) < 2.4) {
            this.npcSystem.interactWithNPC(npc, player.id);
            return;
          }
        }
        // 2. Check Animal proximity for petting (Section 13)
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

      case "PET": {
        if (action.animalId) {
          const animal = this.gameState.animals.find((a) => a.id === action.animalId);
          if (animal && Math.hypot(player.x - animal.x, player.y - animal.y) < 2.5) {
            if (this.animalSystem.petAnimal(animal, player.x, player.y)) {
              player.hopTimer = 0.35;
            }
          }
        } else {
          for (const animal of this.gameState.animals) {
            if (Math.hypot(player.x - animal.x, player.y - animal.y) < 2.2) {
              if (this.animalSystem.petAnimal(animal, player.x, player.y)) {
                player.hopTimer = 0.35;
                return;
              }
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
        this.structuresDirty = true;
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
          this.structuresDirty = true;
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

    // Delta tracking for placed structures and dropped items (Section 28)
    const shouldSendStructures =
      this.structuresDirty ||
      this.gameState.placedStructures.length !== this.lastStructuresLength ||
      tick % 100 === 0;

    const shouldSendDroppedItems =
      this.droppedItemsDirty ||
      this.gameState.droppedItems.length !== this.lastDroppedItemsLength ||
      tick % 100 === 0;

    if (shouldSendStructures) {
      this.lastStructuresLength = this.gameState.placedStructures.length;
      this.structuresDirty = false;
    }
    if (shouldSendDroppedItems) {
      this.lastDroppedItemsLength = this.gameState.droppedItems.length;
      this.droppedItemsDirty = false;
    }

    const placedStructuresPayload = shouldSendStructures
      ? this.gameState.placedStructures
      : undefined;

    const droppedItemsPayload = shouldSendDroppedItems
      ? this.gameState.droppedItems
      : undefined;

    for (const [sessionId, socket] of this.socketMap.entries()) {
      const player = this.gameState.getPlayer(sessionId);
      if (!player) continue;

      // Do NOT send inputs to other players; send simulated player state (Section 10)
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
        droppedItems: droppedItemsPayload,
        placedStructures: placedStructuresPayload,
        events,
      };

      socket.emit("sync", syncMsg);
    }
  }
}
