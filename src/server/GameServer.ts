/**
 * GameServer.ts - Authoritative Game Server Simulation & Room Manager
 *
 * Implements Sections 1, 2, 4, 6, 10, 11, 12, 13, 17, 19-23, 26, 33 of implementation_spec.txt:
 * Runs the single canonical authoritative 20 Hz simulation loop with all 10 game systems,
 * receives and validates client inputs/commands, manages player reconnection tokens,
 * broadcasts state snapshots (over Socket.IO or embedded local transport),
 * and manages multiplayer World Rooms with invite → accept → join flow.
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
import { WorldRoom } from "./WorldRoom";
import {
  ClientJoinMessage,
  ClientInputMessage,
  ClientActionMessage,
  ClientHostWorldMessage,
  ClientJoinWorldMessage,
  ClientInvitePlayerMessage,
  ClientAcceptInviteMessage,
  ClientDeclineInviteMessage,
  ServerInitMessage,
  ServerSyncMessage,
  ServerInviteReceivedMessage,
  ServerInviteResponseMessage,
  ServerRoomJoinedMessage,
  ServerErrorMessage,
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
  private tokenToRoomMap = new Map<string, string>(); // token -> roomId
  private disconnectTimers = new Map<string, any>();

  // Delta synchronization trackers (Section 28)
  private structuresDirty = true;
  private droppedItemsDirty = true;
  private depletedDirty = true;
  private lastStructuresLength = -1;
  private lastDroppedItemsLength = -1;
  private lastDepletedCount = -1;

  // ─── Room / Multiplayer management (spec items 19-23) ──────────────────────
  /** All active WorldRoom instances, keyed by roomId */
  public rooms = new Map<string, WorldRoom>();
  /** Invite code → roomId reverse lookup */
  private inviteCodeToRoom = new Map<string, string>();
  /** Which room each socket belongs to (sessionId → roomId). Non-room singletons absent. */
  private socketToRoom = new Map<string, string>();
  /** Pending invites: inviteId → { roomId, fromSessionId } */
  private pendingInvites = new Map<string, { roomId: string; fromSessionId: string; fromName: string }>();

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

    // ── Single-player / default join ──────────────────────────────────────────
    socket.on("join", (data: ClientJoinMessage) => {
      this.handlePlayerJoin(socket, data);
    });

    // ── Input routing (single-player OR room player) ───────────────────────────
    socket.on("input", (data: ClientInputMessage) => {
      const roomId = this.socketToRoom.get(socket.id);
      if (roomId) {
        const room = this.rooms.get(roomId);
        const player = room?.gameState.getPlayer(socket.id);
        if (player) room!.playerSystem.processInput(player, data);
      } else {
        const player = this.gameState.getPlayer(socket.id);
        if (player) this.playerSystem.processInput(player, data);
      }
    });

    // ── Action routing ────────────────────────────────────────────────────────
    socket.on("action", (action: ClientActionMessage) => {
      const roomId = this.socketToRoom.get(socket.id);
      if (roomId) {
        const room = this.rooms.get(roomId);
        const player = room?.gameState.getPlayer(socket.id);
        if (player) this.handleRoomPlayerAction(room!, player, action);
      } else {
        const player = this.gameState.getPlayer(socket.id);
        if (player) this.handlePlayerAction(player, action);
      }
    });

    // ── Multiplayer room events (spec items 20-23) ────────────────────────────
    socket.on("hostWorld", (data: ClientHostWorldMessage) => {
      this.handleHostWorld(socket, data);
    });

    socket.on("joinWorld", (data: ClientJoinWorldMessage) => {
      this.handleJoinWorld(socket, data);
    });

    socket.on("invitePlayer", (data: ClientInvitePlayerMessage) => {
      this.handleInvitePlayer(socket, data);
    });

    socket.on("acceptInvite", (data: ClientAcceptInviteMessage) => {
      this.handleAcceptInvite(socket, data);
    });

    socket.on("declineInvite", (data: ClientDeclineInviteMessage) => {
      this.handleDeclineInvite(socket, data);
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

    // Check if player is reconnecting with an existing valid session token (Section 26 & Part F)
    if (token && this.tokenPlayerMap.has(token)) {
      player = this.tokenPlayerMap.get(token)!;
      console.log(`[GameServer] Reconnecting existing player: ${player.name} (id: ${player.id}, token: ${token})`);

      // Check if this player was inside an active WorldRoom
      const roomId = this.tokenToRoomMap.get(token);
      const room = roomId ? this.rooms.get(roomId) : undefined;

      if (room) {
        // Clear pending room disconnect timer
        if (this.disconnectTimers.has(player.sessionId)) {
          clearTimeout(this.disconnectTimers.get(player.sessionId));
          this.disconnectTimers.delete(player.sessionId);
        }

        // Re-bind to room state and new socket ID
        room.gameState.players.delete(player.sessionId);
        player.sessionId = socket.id;
        room.gameState.players.set(socket.id, player);
        room.sockets.set(socket.id, socket);
        this.socketToRoom.set(socket.id, room.roomId);
        this.playerTokenMap.set(socket.id, token);

        const otherPlayers = Array.from(room.gameState.players.values()).filter(
          (p) => p.sessionId !== socket.id,
        );

        const isOwner = room.ownerSessionId === player.sessionId || room.ownerSessionId === socket.id;

        const initMsg: ServerInitMessage = {
          playerId: player.id,
          sessionId: socket.id,
          seed: room.gameState.seed,
          worldTime: room.gameState.worldTime,
          player,
          otherPlayers,
          placedStructures: room.gameState.placedStructures,
          droppedItems: room.gameState.droppedItems,
          depletedResourceIds: Array.from(room.gameState.depletedResourceIds),
          quests: room.gameState.quests,
          roomId: room.roomId,
          inviteCode: isOwner ? room.inviteCode : undefined,
        };

        socket.emit("init", initMsg);
        console.log(`[GameServer] Successfully restored player ${player.name} into room ${room.roomId}`);
        return;
      }

      // Single-player reconnection
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
      depletedResourceIds: Array.from(this.gameState.depletedResourceIds),
      quests: this.gameState.quests,
    };

    socket.emit("init", initMsg);
    this.persistence.markDirty();
  }

  private handlePlayerDisconnect(sessionId: string): void {
    console.log(`[GameServer] Player disconnected: ${sessionId}`);
    this.socketMap.delete(sessionId);

    // ── Room cleanup ──────────────────────────────────────────────────────────
    const roomId = this.socketToRoom.get(sessionId);
    const token = this.playerTokenMap.get(sessionId);

    if (roomId) {
      this.socketToRoom.delete(sessionId);
      if (token) this.playerTokenMap.delete(sessionId);
      const room = this.rooms.get(roomId);
      if (room) {
        room.removeSocket(sessionId);
        // Grace period: keep player entity for 30s to allow reconnect (Section 26 & Part F)
        const timer = setTimeout(() => {
          room.gameState.removePlayer(sessionId);
          if (token) {
            this.tokenPlayerMap.delete(token);
            this.tokenToRoomMap.delete(token);
          }
          // Destroy empty room
          if (room.isEmpty && room.gameState.players.size === 0) {
            room.stop();
            this.rooms.delete(roomId);
            this.inviteCodeToRoom.delete(room.inviteCode);
            console.log(`[GameServer] Room ${roomId} destroyed (empty after grace period)`);
          }
          this.disconnectTimers.delete(sessionId);
        }, 30000);
        this.disconnectTimers.set(sessionId, timer);
      }
      return;
    }

    // ── Single-player cleanup ─────────────────────────────────────────────────
    if (token) {
      // Grace period (30s) before destroying the player entity to allow reconnect (Section 26)
      const timer = setTimeout(() => {
        this.gameState.removePlayer(sessionId);
        this.tokenPlayerMap.delete(token);
        this.tokenToRoomMap.delete(token);
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
          this.depletedDirty = true;
          this.persistence.markDirty();
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
          this.depletedDirty = true;
          this.persistence.markDirty();
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

    const shouldSendDepleted =
      this.depletedDirty ||
      this.gameState.depletedResourceIds.size !== this.lastDepletedCount ||
      tick % 100 === 0;

    if (shouldSendStructures) {
      this.lastStructuresLength = this.gameState.placedStructures.length;
      this.structuresDirty = false;
    }
    if (shouldSendDroppedItems) {
      this.lastDroppedItemsLength = this.gameState.droppedItems.length;
      this.droppedItemsDirty = false;
    }
    if (shouldSendDepleted) {
      this.lastDepletedCount = this.gameState.depletedResourceIds.size;
      this.depletedDirty = false;
    }

    const placedStructuresPayload = shouldSendStructures
      ? this.gameState.placedStructures
      : undefined;

    const droppedItemsPayload = shouldSendDroppedItems
      ? this.gameState.droppedItems
      : undefined;

    const depletedPayload = shouldSendDepleted
      ? Array.from(this.gameState.depletedResourceIds)
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
        depletedResourceIds: depletedPayload,
        events,
      };

      socket.emit("sync", syncMsg);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Room / Invite Handlers (spec items 20-23)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * spec item 20: Create Game — Server creates a WorldRoom and enters owner.
   */
  private handleHostWorld(socket: ITransportSocket, data: ClientHostWorldMessage): void {
    const name = data?.name || `Explorer_${socket.id.substring(0, 4)}`;
    const hairstyle = data?.hairstyle || "style_01";
    const token = data?.token;

    // Create a fresh room using the global world seed
    const room = new WorldRoom(this.gameState.seed, 20, socket.id);
    room.start();
    this.rooms.set(room.roomId, room);
    this.inviteCodeToRoom.set(room.inviteCode, room.roomId);
    this.socketToRoom.set(socket.id, room.roomId);

    const player = room.addPlayer(socket, name, hairstyle);
    if (token) {
      this.tokenPlayerMap.set(token, player);
      this.playerTokenMap.set(socket.id, token);
      this.tokenToRoomMap.set(token, room.roomId);
    }

    const otherPlayers = Array.from(room.gameState.players.values()).filter(
      (p) => p.sessionId !== socket.id,
    );

    const initMsg: ServerInitMessage = {
      playerId: player.id,
      sessionId: socket.id,
      seed: room.gameState.seed,
      worldTime: room.gameState.worldTime,
      player,
      otherPlayers,
      placedStructures: room.gameState.placedStructures,
      droppedItems: room.gameState.droppedItems,
      depletedResourceIds: Array.from(room.gameState.depletedResourceIds),
      quests: room.gameState.quests,
      roomId: room.roomId,
      inviteCode: room.inviteCode, // Only owner gets this
    };

    socket.emit("init", initMsg);
    console.log(`[GameServer] Player ${name} hosted room ${room.roomId} (code: ${room.inviteCode})`);
  }

  /**
   * spec item 22: Join screen — player enters invite code to join a room.
   */
  private handleJoinWorld(socket: ITransportSocket, data: ClientJoinWorldMessage): void {
    const { inviteCode, name = `Explorer_${socket.id.substring(0, 4)}`, hairstyle = "style_01", token } = data;

    const roomId = this.inviteCodeToRoom.get(inviteCode?.toUpperCase());
    if (!roomId) {
      const err: ServerErrorMessage = { message: `No world found with code "${inviteCode}". Check the code and try again.` };
      socket.emit("error", err);
      return;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      const err: ServerErrorMessage = { message: "World no longer exists." };
      socket.emit("error", err);
      return;
    }

    this.socketToRoom.set(socket.id, room.roomId);
    const player = room.addPlayer(socket, name, hairstyle);
    if (token) {
      this.tokenPlayerMap.set(token, player);
      this.playerTokenMap.set(socket.id, token);
      this.tokenToRoomMap.set(token, room.roomId);
    }

    const otherPlayers = Array.from(room.gameState.players.values()).filter(
      (p) => p.sessionId !== socket.id,
    );

    const initMsg: ServerInitMessage = {
      playerId: player.id,
      sessionId: socket.id,
      seed: room.gameState.seed,
      worldTime: room.gameState.worldTime,
      player,
      otherPlayers,
      placedStructures: room.gameState.placedStructures,
      droppedItems: room.gameState.droppedItems,
      depletedResourceIds: Array.from(room.gameState.depletedResourceIds),
      quests: room.gameState.quests,
      roomId: room.roomId,
      // Note: inviteCode is NOT sent to joining players
    };

    socket.emit("init", initMsg);
    console.log(`[GameServer] Player ${name} joined room ${room.roomId}`);
  }

  /**
   * spec item 21: Invite — owner sends an invite to another connected player.
   */
  private handleInvitePlayer(socket: ITransportSocket, data: ClientInvitePlayerMessage): void {
    const roomId = this.socketToRoom.get(socket.id);
    if (!roomId) {
      socket.emit("error", { message: "You are not in a room. Host a world first." } as ServerErrorMessage);
      return;
    }

    const room = this.rooms.get(roomId);
    if (!room) return;

    const targetSocket = this.socketMap.get(data?.targetSessionId);
    if (!targetSocket) {
      socket.emit("error", { message: "Player not found or not connected." } as ServerErrorMessage);
      return;
    }

    const inviterPlayer = room.gameState.getPlayer(socket.id);
    const fromName = inviterPlayer?.name || "Unknown";

    const inviteId = `inv_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    this.pendingInvites.set(inviteId, { roomId, fromSessionId: socket.id, fromName });

    const inviteMsg: ServerInviteReceivedMessage = {
      inviteId,
      fromName,
      fromSessionId: socket.id,
      roomId,
    };

    targetSocket.emit("inviteReceived", inviteMsg);
    console.log(`[GameServer] ${fromName} invited ${data.targetSessionId} (inviteId: ${inviteId})`);
  }

  /**
   * spec item 23: Accept invite — player joins the room they were invited to.
   */
  private handleAcceptInvite(socket: ITransportSocket, data: ClientAcceptInviteMessage): void {
    const invite = this.pendingInvites.get(data?.inviteId);
    if (!invite) {
      socket.emit("error", { message: "Invite not found or already expired." } as ServerErrorMessage);
      return;
    }

    this.pendingInvites.delete(data.inviteId);
    const room = this.rooms.get(invite.roomId);
    if (!room) {
      socket.emit("error", { message: "The world no longer exists." } as ServerErrorMessage);
      return;
    }

    // Find current player name from global state (if already in single-player)
    const existingGlobalPlayer = this.gameState.getPlayer(socket.id);
    const name = existingGlobalPlayer?.name || `Explorer_${socket.id.substring(0, 4)}`;
    const hairstyle = existingGlobalPlayer?.hairstyle || "style_01";

    // Remove from global state if present
    if (existingGlobalPlayer) {
      this.gameState.removePlayer(socket.id);
    }

    this.socketToRoom.set(socket.id, room.roomId);
    const player = room.addPlayer(socket, name, hairstyle);

    const token = this.playerTokenMap.get(socket.id);
    if (token) {
      this.tokenPlayerMap.set(token, player);
      this.tokenToRoomMap.set(token, room.roomId);
    }

    const otherPlayers = Array.from(room.gameState.players.values()).filter(
      (p) => p.sessionId !== socket.id,
    );

    const initMsg: ServerInitMessage = {
      playerId: player.id,
      sessionId: socket.id,
      seed: room.gameState.seed,
      worldTime: room.gameState.worldTime,
      player,
      otherPlayers,
      placedStructures: room.gameState.placedStructures,
      droppedItems: room.gameState.droppedItems,
      depletedResourceIds: Array.from(room.gameState.depletedResourceIds),
      quests: room.gameState.quests,
      roomId: room.roomId,
    };

    socket.emit("init", initMsg);

    // Notify the inviter
    const inviterSocket = this.socketMap.get(invite.fromSessionId);
    if (inviterSocket) {
      const resp: ServerInviteResponseMessage = {
        inviteId: data.inviteId,
        accepted: true,
        byName: player.name,
      };
      inviterSocket.emit("inviteResponse", resp);
    }

    console.log(`[GameServer] ${player.name} accepted invite and joined room ${room.roomId}`);
  }

  /**
   * spec item 23: Decline invite.
   */
  private handleDeclineInvite(socket: ITransportSocket, data: ClientDeclineInviteMessage): void {
    const invite = this.pendingInvites.get(data?.inviteId);
    if (!invite) return;

    this.pendingInvites.delete(data.inviteId);

    const inviterSocket = this.socketMap.get(invite.fromSessionId);
    if (inviterSocket) {
      const globalPlayer = this.gameState.getPlayer(socket.id);
      const resp: ServerInviteResponseMessage = {
        inviteId: data.inviteId,
        accepted: false,
        byName: globalPlayer?.name || "Another player",
      };
      inviterSocket.emit("inviteResponse", resp);
    }
  }

  /**
   * Handles game actions for players inside a WorldRoom.
   * Delegates to the same logic as single-player but uses room-scoped systems.
   */
  private handleRoomPlayerAction(room: WorldRoom, player: PlayerEntityState, action: ClientActionMessage): void {
    if (player.isDead && action.type !== "RESPAWN") return;

    switch (action.type) {
      case "HIT": {
        room.combatSystem.performPlayerHit(player);
        break;
      }
      case "CLICK": {
        const { wx, wy } = action as any;
        player.swingTimer = 0.25;

        // Check animal hit
        for (const animal of room.gameState.animals) {
          if (animal.behaviorState === "DEAD") continue;
          if (
            Math.hypot(wx - animal.x, wy - animal.y) < 1.3 &&
            Math.hypot(player.x - animal.x, player.y - animal.y) <= 3.2
          ) {
            animal.health -= 15;
            room.animalSystem.scareAnimal(animal, player.x, player.y);
            room.combatSystem.useActiveToolDurability(player);
            if (animal.health <= 0) {
              animal.behaviorState = "DEAD";
              room.gameState.spawnDroppedItem("raw_meat", 2, animal.x, animal.y);
              room.markDroppedItemsDirty();
            }
            return;
          }
        }

        // Check enemy hit
        for (const enemy of room.gameState.enemies) {
          if (!enemy.isAlive) continue;
          if (
            Math.hypot(wx - enemy.x, wy - enemy.y) < 1.4 &&
            Math.hypot(player.x - enemy.x, player.y - enemy.y) < 3.2
          ) {
            room.combatSystem.attackEnemy(player, enemy);
            return;
          }
        }

        // Check resource hit
        const res = room.gameState.worldManager.getResourceAt(wx, wy, 1.4);
        if (res && !res.isDepleted) {
          room.resourceSystem.harvestResource(player, res);
          room.markDroppedItemsDirty();
          room.markDepletedDirty();
          return;
        }

        // Fallback: directional hit
        room.combatSystem.performPlayerHit(player);
        break;
      }

      case "ATTACK_RESOURCE": {
        const res = room.gameState.worldManager.getResourceById(action.resourceId);
        if (res && !res.isDepleted) {
          room.resourceSystem.harvestResource(player, res);
          room.markDroppedItemsDirty();
          room.markDepletedDirty();
        }
        break;
      }

      case "JUMP":
      case "ROLL": {
        room.playerSystem.jump(player);
        break;
      }

      case "INTERACT": {
        for (const npc of room.gameState.npcs) {
          if (Math.hypot(player.x - npc.x, player.y - npc.y) < 2.4) {
            room.npcSystem.interactWithNPC(npc, player.id);
            return;
          }
        }
        for (const animal of room.gameState.animals) {
          if (Math.hypot(player.x - animal.x, player.y - animal.y) < 2.2) {
            if (room.animalSystem.petAnimal(animal, player.x, player.y)) {
              player.hopTimer = 0.35;
              return;
            }
          }
        }
        break;
      }

      case "PET": {
        const animalId = (action as any).animalId;
        if (animalId) {
          const animal = room.gameState.animals.find((a) => a.id === animalId);
          if (animal && Math.hypot(player.x - animal.x, player.y - animal.y) < 2.5) {
            if (room.animalSystem.petAnimal(animal, player.x, player.y)) player.hopTimer = 0.35;
          }
        } else {
          for (const animal of room.gameState.animals) {
            if (Math.hypot(player.x - animal.x, player.y - animal.y) < 2.2) {
              if (room.animalSystem.petAnimal(animal, player.x, player.y)) {
                player.hopTimer = 0.35;
                return;
              }
            }
          }
        }
        break;
      }

      case "FEED": {
        for (const animal of room.gameState.animals) {
          if (Math.hypot(player.x - animal.x, player.y - animal.y) < 2.2) {
            const foodItems = ["wheat", "seeds", "berries", "apple"] as const;
            for (const f of foodItems) {
              const slot = [...player.hotbar, ...player.inventory].find((s) => s.item === f);
              if (slot && slot.count > 0) {
                slot.count--;
                if (slot.count <= 0) slot.item = null;
                room.animalSystem.feedAnimal(animal, player.x, player.y);
                return;
              }
            }
          }
        }
        break;
      }
      case "EAT": {
        room.survivalSystem.eatActiveFood(player);
        break;
      }
      case "CRAFT": {
        const recipe = CRAFTING_RECIPES.find((r) => r.id === (action as any).recipeId);
        if (recipe) room.craftingSystem.craftRecipe(player, recipe);
        break;
      }
      case "BUILD": {
        room.buildingSystem.placeStructure(player, (action as any).pieceId, (action as any).wx, (action as any).wy);
        room.markStructuresDirty();
        break;
      }
      case "SELECT_HOTBAR": {
        const idx = (action as any).index;
        if (idx >= 0 && idx < player.hotbar.length) {
          player.activeHotbarIndex = idx;
          player.activeHeldItem = player.hotbar[idx]?.item || null;
        }
        break;
      }
      case "TOGGLE_DOOR": {
        const struct = room.gameState.placedStructures.find((s) => s.id === (action as any).structId);
        if (struct) {
          room.buildingSystem.toggleDoor(struct);
          room.markStructuresDirty();
        }
        break;
      }
      case "RESPAWN": {
        room.combatSystem.respawnPlayer(player);
        break;
      }
    }
  }
}
