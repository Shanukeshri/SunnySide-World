/**
 * Protocol.ts - Client-Server Network Message Specifications
 * 
 * Implements Section 4 & 21 of authoritative_server.txt:
 * Compact, typed network messages for client commands and authoritative state updates.
 */

import {
  PlayerEntityState,
  AnimalEntityState,
  NPCEntityState,
  EnemyEntityState,
  DroppedItemEntityState,
  StructureEntityState,
  EntityId,
} from "../../game/core/Entity";
import { GameEvent } from "../../game/core/EventBus";
import { WorldTime, Quest, ItemId } from "../../game/GameTypes";

export interface ClientJoinMessage {
  name: string;
  hairstyle: string;
  token?: string; // Session token for reconnection (Section 26)
}

export interface ClientInputMessage {
  seq: number;
  vx: number;
  vy: number;
  isSprinting: boolean;
  dt: number;
}

export type ClientActionMessage =
  | { type: "HIT" }
  | { type: "CLICK"; wx: number; wy: number }
  | { type: "JUMP" }
  | { type: "ROLL" }
  | { type: "INTERACT" }
  | { type: "PET"; animalId?: number }
  | { type: "ATTACK_RESOURCE"; resourceId: number }
  | { type: "FEED" }
  | { type: "EAT" }
  | { type: "CRAFT"; recipeId: string }
  | { type: "BUILD"; pieceId: ItemId; wx: number; wy: number }
  | { type: "SELECT_HOTBAR"; index: number }
  | { type: "TOGGLE_DOOR"; structId: number }
  | { type: "RESPAWN" };

export interface ServerInitMessage {
  playerId: EntityId;
  sessionId: string;
  seed: number;
  worldTime: WorldTime;
  player: PlayerEntityState;
  otherPlayers: PlayerEntityState[];
  placedStructures: StructureEntityState[];
  droppedItems: DroppedItemEntityState[];
  quests: Quest[];
}

export interface ServerSyncMessage {
  tick: number;
  timestamp: number;
  worldTime: WorldTime;
  lastProcessedInputSeq: number;
  player: PlayerEntityState;
  otherPlayers: PlayerEntityState[];
  animals: AnimalEntityState[];
  npcs: NPCEntityState[];
  enemies: EnemyEntityState[];
  droppedItems?: DroppedItemEntityState[];
  placedStructures?: StructureEntityState[];
  events: GameEvent[];
}
