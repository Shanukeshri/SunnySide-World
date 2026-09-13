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
  depletedResourceIds?: number[];
  quests: Quest[];
  /** Room the player was placed in (if multiplayer) */
  roomId?: string;
  /** Invite code to share with friends (only sent to room owner) */
  inviteCode?: string;
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
  depletedResourceIds?: number[];
  events: GameEvent[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Multiplayer Room / Invite messages (spec items 19-23)
// ─────────────────────────────────────────────────────────────────────────────

/** Client: create a new hosted world room */
export interface ClientHostWorldMessage {
  name: string;
  hairstyle: string;
  token?: string;
}

/** Client: join a room using an invite code */
export interface ClientJoinWorldMessage {
  inviteCode: string;
  name: string;
  hairstyle: string;
  token?: string;
}

/** Client: invite another player (by their socket/session id) to your current room */
export interface ClientInvitePlayerMessage {
  targetSessionId: string;
}

/** Client: accept a pending invite */
export interface ClientAcceptInviteMessage {
  inviteId: string;
}

/** Client: decline a pending invite */
export interface ClientDeclineInviteMessage {
  inviteId: string;
}

/** Server → target player: you've been invited */
export interface ServerInviteReceivedMessage {
  inviteId: string;
  fromName: string;
  fromSessionId: string;
  roomId: string;
}

/** Server → inviter: the invite was accepted or declined */
export interface ServerInviteResponseMessage {
  inviteId: string;
  accepted: boolean;
  byName: string;
}

/** Server → joining player: room successfully joined, follow with full init */
export interface ServerRoomJoinedMessage {
  roomId: string;
  inviteCode: string;
  ownerName: string;
}

/** Server → all room members: a player left the room */
export interface ServerPlayerLeftRoomMessage {
  playerId: EntityId;
  name: string;
}

/** Server: simple error response */
export interface ServerErrorMessage {
  message: string;
}

