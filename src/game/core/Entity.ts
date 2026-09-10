/**
 * Entity.ts - Stable Entity Interfaces & Type Definitions
 * 
 * Implements Section 8 & 9 of authoritative_server.txt:
 * Every entity in the world has a stable unique identifier and state machine.
 */

import { Direction, Position2D } from "../../lifeforms/types";
import { ItemId, InventorySlot, PlacedStructure, ResourceNode } from "../GameTypes";

export type EntityId = number;

export type EntityKind =
  | "player"
  | "animal"
  | "npc"
  | "enemy"
  | "resource"
  | "dropped_item"
  | "structure";

export interface IBaseEntity {
  id: EntityId;
  kind: EntityKind;
  x: number;
  y: number;
}

export interface PlayerEntityState extends IBaseEntity {
  kind: "player";
  sessionId: string; // Socket/Client connection ID
  name: string;
  hairstyle: string;
  vx: number;
  vy: number;
  direction: Direction;
  facing: "LEFT" | "RIGHT";
  speed: number;
  sprintSpeed: number;
  isSprinting: boolean;
  isSwimming: boolean;
  health: number;
  maxHealth: number;
  hunger: number;
  maxHunger: number;
  stamina: number;
  maxStamina: number;
  isDead: boolean;
  swingTimer: number;
  hopTimer: number;
  hopOffset: number;
  hurtTimer: number;
  rollTimer: number;
  doingTimer: number;
  fishingTimer: number;
  fishingState: "NONE" | "CASTING" | "REELING" | "CAUGHT";
  isWaiting: boolean;
  inventory: InventorySlot[];
  hotbar: InventorySlot[];
  activeHotbarIndex: number;
  activeHeldItem: ItemId | null;
  lastProcessedInputSeq: number;
  inputQueue?: { seq: number; vx: number; vy: number; isSprinting: boolean; dt: number }[];
}

export interface AnimalEntityState extends IBaseEntity {
  kind: "animal";
  species: "cow" | "sheep" | "chicken" | "rabbit" | "deer" | "pig" | "duck";
  direction: Direction;
  behaviorState: "IDLE" | "WANDER" | "EATING" | "FLEE" | "PETTED" | "FOLLOWING" | "DEAD";
  health: number;
  maxHealth: number;
  hunger: number;
  speed: number;
  targetX: number | null;
  targetY: number | null;
  eatingBobOffset: number;
  isPetted: boolean;
  pettedTimer: number;
  pettingCooldown: number;
  fleeTimer: number;
}

export interface NPCEntityState extends IBaseEntity {
  kind: "npc";
  npcType: string;
  name: string;
  role: string;
  direction: Direction;
  behaviorState: "IDLE" | "WANDER" | "TALKING" | "RESTING";
  dialogueState: string;
  isFrozen: boolean;
  targetX: number | null;
  targetY: number | null;
  hairstyle?: string;
}

export interface EnemyEntityState extends IBaseEntity {
  kind: "enemy";
  enemyType: "slime" | "goblin" | "wolf" | "skeleton";
  name: string;
  vx: number;
  vy: number;
  direction: Direction;
  health: number;
  maxHealth: number;
  damage: number;
  speed: number;
  state: "IDLE" | "PATROL" | "CHASE" | "ATTACK" | "HURT" | "DEAD";
  action?: string;
  attackCooldown: number;
  patrolTimer: number;
  hurtTimer: number;
  deathTimer: number;
  isAlive: boolean;
}

export interface DroppedItemEntityState extends IBaseEntity {
  kind: "dropped_item";
  item: ItemId;
  count: number;
  bobTimer: number;
}

export interface StructureEntityState extends IBaseEntity {
  kind: "structure";
  structureType: PlacedStructure["type"];
  w: number;
  h: number;
  chestStorage?: InventorySlot[];
  isOpen?: boolean;
}

export interface ResourceEntityState extends IBaseEntity {
  kind: "resource";
  resourceType: ResourceNode["type"];
  subType?: string;
  w: number;
  h: number;
  health: number;
  maxHealth: number;
  lootItem: ItemId;
  secondaryLoot?: ItemId;
  isDepleted: boolean;
  shakeTimer?: number;
}
