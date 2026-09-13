/**
 * WorldRoom.ts - Per-Room World State Container
 *
 * Implements spec item 19 (Introduce a World/Room):
 * Each WorldRoom is an isolated simulation with its own GameState, GameLoop,
 * and set of connected players. The GameServer manages a map of rooms.
 *
 * A room is identified by its roomId and accessible via an invite code.
 * The owner is the first player who created (hosted) the room.
 */

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
import { PlayerEntityState } from "../game/core/Entity";
import { ServerSyncMessage } from "./networking/Protocol";
import { PersistenceManager } from "./persistence/PersistenceManager";
import type { ITransportSocket } from "./GameServer";

/** Generates a human-readable invite code like SUNNY-4821 */
function generateInviteCode(): string {
  const words = ["SUNNY", "FIELD", "RIVER", "GROVE", "MIST", "DAWN", "CREEK", "BLOOM"];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${word}-${num}`;
}

export class WorldRoom {
  public readonly roomId: string;
  public readonly inviteCode: string;
  public readonly ownerSessionId: string;

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

  /** Active socket connections for all players in this room (keyed by sessionId) */
  public sockets = new Map<string, ITransportSocket>();

  /** Delta dirty flags for structures, dropped items, and depleted resources */
  private structuresDirty = true;
  private droppedItemsDirty = true;
  private depletedDirty = true;
  private lastStructuresLength = -1;
  private lastDroppedItemsLength = -1;
  private lastDepletedCount = -1;

  constructor(seed: number, tickRate: number, ownerSessionId: string) {
    this.roomId = `room_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    this.inviteCode = generateInviteCode();
    this.ownerSessionId = ownerSessionId;

    this.eventBus = new EventBus();
    this.gameState = new GameState(seed, this.eventBus);

    this.persistence = new PersistenceManager("./saves", `room_${this.inviteCode}.json`);
    this.persistence.loadSnapshot(this.gameState);

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

    this.gameLoop = new GameLoop(tickRate, (dt: number, tick: number) => this.tick(dt, tick));
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

  public get isEmpty(): boolean {
    return this.sockets.size === 0;
  }

  // ─── Per-tick simulation ─────────────────────────────────────────────────

  private tick(dt: number, tick: number): void {
    this.eventBus.setTick(tick);

    this.playerSystem.update(dt);
    this.survivalSystem.update(dt);
    this.worldSystem.update(dt);
    this.resourceSystem.update(dt);
    this.animalSystem.update(dt);
    this.npcSystem.update(dt);
    this.combatSystem.update(dt);
    this.spawnSystem.update(dt);

    const events = this.eventBus.flushQueue();

    if (this.sockets.size > 0 && this.gameState.players.size > 0) {
      this.broadcastStateSync(tick, events);
    }
  }

  // ─── Broadcast ─────────────────────────────────────────────────────────────

  private broadcastStateSync(tick: number, events: any[]): void {
    const allPlayers = Array.from(this.gameState.players.values());

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

    const placedStructuresPayload = shouldSendStructures ? this.gameState.placedStructures : undefined;
    const droppedItemsPayload = shouldSendDroppedItems ? this.gameState.droppedItems : undefined;
    const depletedPayload = shouldSendDepleted ? Array.from(this.gameState.depletedResourceIds) : undefined;

    for (const [sessionId, socket] of this.sockets.entries()) {
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
        droppedItems: droppedItemsPayload,
        placedStructures: placedStructuresPayload,
        depletedResourceIds: depletedPayload,
        events,
      };

      socket.emit("sync", syncMsg);
    }
  }

  // ─── Player management ─────────────────────────────────────────────────────

  public addPlayer(
    socket: ITransportSocket,
    name: string,
    hairstyle: string,
    existingPlayer?: PlayerEntityState,
  ): PlayerEntityState {
    this.sockets.set(socket.id, socket);

    let player: PlayerEntityState;
    if (existingPlayer) {
      existingPlayer.sessionId = socket.id;
      this.gameState.players.set(socket.id, existingPlayer);
      player = existingPlayer;
    } else {
      player = this.gameState.addPlayer(socket.id, name, hairstyle);
    }
    return player;
  }

  public removeSocket(sessionId: string): void {
    this.sockets.delete(sessionId);
  }

  public markStructuresDirty(): void {
    this.structuresDirty = true;
    this.persistence.markDirty();
  }

  public markDroppedItemsDirty(): void {
    this.droppedItemsDirty = true;
  }

  public markDepletedDirty(): void {
    this.depletedDirty = true;
    this.persistence.markDirty();
  }
}
