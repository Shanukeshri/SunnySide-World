/**
 * GameTypes.ts - Data structures and interfaces for the Survival Sandbox Game
 * Based on gameLogicV1.txt specification.
 */

import { Direction, Position2D } from "../lifeforms/types";
import { SettlementData } from "../generation/SettlementGenerator";

export type ItemId =
  | "wood"
  | "stick"
  | "stone"
  | "coal"
  | "iron_ore"
  | "iron_ingot"
  | "fiber"
  | "berries"
  | "apple"
  | "raw_meat"
  | "cooked_meat"
  | "wheat"
  | "bread"
  | "seeds"
  | "slime_gel"
  | "wooden_axe"
  | "stone_axe"
  | "iron_axe"
  | "wooden_pickaxe"
  | "stone_pickaxe"
  | "iron_pickaxe"
  | "wooden_sword"
  | "stone_sword"
  | "iron_sword"
  | "torch"
  | "campfire"
  | "workbench"
  | "chest"
  | "wood_wall"
  | "wood_floor"
  | "wood_door";

export type ItemCategory = "resource" | "tool" | "weapon" | "food" | "building" | "station" | "survival";

export interface ItemDef {
  id: ItemId;
  name: string;
  category: ItemCategory;
  description: string;
  icon: string; // Emoji / Symbol representation
  maxStack: number;
  durability?: number;
  maxDurability?: number;
  damage?: number;
  gatherPower?: number;
  gatherType?: "wood" | "stone" | "all";
  hungerRestore?: number;
  healthRestore?: number;
  isPlaceable?: boolean;
}

export interface InventorySlot {
  item: ItemId | null;
  count: number;
  durability?: number;
  maxDurability?: number;
}

export interface Recipe {
  id: string;
  name: string;
  result: ItemId;
  count: number;
  ingredients: { item: ItemId; count: number }[];
  requiresStation?: "workbench" | "campfire";
  category: "tools" | "survival" | "building";
}

export interface DroppedItem {
  id: number;
  item: ItemId;
  count: number;
  x: number;
  y: number;
  bobTimer: number;
  magnetized?: boolean;
}

export interface ResourceNode {
  id: number;
  type: "tree" | "rock" | "iron_rock" | "bush" | "crop";
  subType?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  health: number;
  maxHealth: number;
  lootItem: ItemId;
  secondaryLoot?: ItemId;
  shakeTimer?: number;
  isDepleted: boolean;
}

export interface PlacedStructure {
  id: number;
  type: "wood_wall" | "wood_floor" | "wood_door" | "campfire" | "workbench" | "chest";
  x: number;
  y: number;
  w: number;
  h: number;
  chestStorage?: InventorySlot[];
  isOpen?: boolean;
}

export interface EnemyEntity {
  id: number;
  type: "slime" | "goblin" | "wolf";
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  direction: Direction;
  health: number;
  maxHealth: number;
  damage: number;
  speed: number;
  state: "IDLE" | "PATROL" | "CHASE" | "ATTACK" | "HURT" | "DEAD";
  targetX?: number;
  targetY?: number;
  attackCooldown: number;
  patrolTimer: number;
  hurtTimer: number;
  deathTimer: number;
  isAlive: boolean;
}

export interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface WoodChipParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export interface Quest {
  id: string;
  title: string;
  desc: string;
  completed: boolean;
  progress: number;
  goal: number;
}

export interface WorldRealmVillage {
  id: number;
  name: string;
  gridX: number; // world tile X
  gridY: number; // world tile Y
  width: number;
  height: number;
  data: SettlementData;
  discovered: boolean;
}

export interface WorldTime {
  totalSeconds: number;
  timeOfDay: "Morning" | "Day" | "Sunset" | "Night";
  hour: number;
  minute: number;
  dayNumber: number;
  lightLevel: number; // 0.0 (pitch black night) to 1.0 (bright midday)
}
