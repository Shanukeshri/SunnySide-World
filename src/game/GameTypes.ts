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
  | "fresh_bread"
  | "flour"
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
  | "wooden_shovel"
  | "stone_shovel"
  | "iron_shovel"
  | "watering_can"
  | "wooden_hammer"
  | "iron_hammer"
  | "fishing_rod"
  | "raw_fish"
  | "cooked_fish"
  | "torch"
  | "campfire"
  | "workbench"
  | "chest"
  | "wood_wall"
  | "wood_floor"
  | "wood_door"
  // 11 Crops & Harvested Produce:
  | "cabbage"
  | "carrot"
  | "parsnip"
  | "radish"
  | "sunflower"
  | "cauliflower"
  | "pumpkin"
  | "beetroot"
  | "kale"
  | "potato"
  // Animal Husbandry & Products:
  | "milk"
  | "egg"
  | "wool"
  | "shears"
  | "bucket"
  | "water_bucket"
  // Farming & Shipping:
  | "fertilizer"
  | "wood_ash"
  | "fish_bones"
  | "crate_wood"
  | "crate_bulk_crops"
  // Alchemy & Foraging:
  | "blue_mushroom"
  | "red_mushroom"
  | "blue_potion"
  | "red_potion"
  | "mushroom_blue"
  | "mushroom_red"
  | "potion_stamina"
  | "potion_berserker"
  | "coracle"
  // Boating & Navigation:
  | "coracle_boat"
  // Advanced Building & Economy:
  | "stone_oven"
  | "windmill_kit"
  | "brewing_stand"
  | "chimney"
  | "wall_window"
  | "stone_wall"
  | "stone_floor"
  | "roof_wood"
  | "bed"
  | "roof_terracotta"
  | "farm_soil"
  | "farm_fence"
  | "farm_gate"
  | "water_well"
  | "wood_bridge"
  | "gold_coin"
  // Placeable 3D Blocks:
  | "block_stone"
  | "block_wood"
  | "block_dirt"
  | "block_brick"
  | "block_sandstone"
  | "block_glass";

export type ItemCategory = "resource" | "tool" | "weapon" | "food" | "building" | "station" | "survival";

export interface ItemDef {
  id: ItemId;
  name: string;
  category: ItemCategory;
  description: string;
  icon: string; // Emoji / Symbol representation
  spritePath?: string; // Pixel art sprite icon path
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
  id: number | string;
  type:
    | "wood_wall"
    | "wood_floor"
    | "wood_door"
    | "campfire"
    | "workbench"
    | "chest"
    | "windmill"
    | "stone_oven"
    | "brewing_stand"
    | "chimney"
    | "wall_window"
    | "stone_wall"
    | "stone_floor"
    | "roof_wood"
    | "roof_terracotta"
    | "bed"
    | "farm_soil"
    | "farm_fence"
    | "farm_gate"
    | "water_well"
    | "wood_bridge"
    | "coracle";
  x: number;
  y: number;
  w: number;
  h: number;
  health?: number;
  maxHealth?: number;
  shakeTimer?: number;
  chestStorage?: InventorySlot[];
  isOpen?: boolean;
  // Dynamic Structure Economy & Production State:
  rotation?: number;
  frameTimer?: number;
  frameIndex?: number;
  isOperating?: boolean;
  productionTimer?: number;
  inputItem?: ItemId | null;
  inputCount?: number;
  outputItem?: ItemId | null;
  outputCount?: number;
  fuelTimer?: number;
}

export type BlockMaterial =
  | "block_stone"
  | "block_wood"
  | "block_dirt"
  | "block_brick"
  | "block_sandstone"
  | "block_glass";

export interface Placed3DBlock {
  id: number | string;
  material: BlockMaterial;
  x: number; // Integer Grid X
  y: number; // Integer Grid Y
  z: number; // Vertical Level: 0 = ground tier, 1 = 1st tier, 2 = 2nd tier, etc. (max 4)
  health: number;
  maxHealth: number;
  shakeTimer?: number;
}

export interface CoracleEntity {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isMounted: boolean;
  passengerId: string | null;
  bobTimer: number;
  heading: number;
  speed: number;
}

export interface EnemyEntity {
  id: number | string;
  type: "slime" | "goblin" | "wolf" | "skeleton";
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
  action?: string;
  targetX?: number;
  targetY?: number;
  attackCooldown: number;
  patrolTimer: number;
  hurtTimer: number;
  deathTimer: number;
  isAlive: boolean;
  // Special Enemy Variants:
  subType?: "neutral_trader" | "hostile_raider" | "night_invasion" | "crypt_guardian" | "TRADER" | "NIGHT_RAID";
  tradeOffer?: {
    wantItem: ItemId;
    wantCount: number;
    giveItem: ItemId;
    giveCount: number;
  };
  raidTarget?: { x: number; y: number; type: "tree" | "chest" | "crop" };
  slashTimer?: number;
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

export interface FootstepVFX {
  id: number;
  x: number;
  y: number;
  type: "turf" | "dust" | "ripple" | "wood";
  radius: number;
  maxRadius: number;
  alpha: number;
  vx: number;
  vy: number;
  color?: string;
}

export interface AmbientBird {
  id: number;
  x: number;
  y: number;
  isFlying: boolean;
  flyTimer: number;
  vx: number;
  vy: number;
  wingAngle: number;
  color: string;
}

export interface Quest {
  id: string;
  title: string;
  desc: string;
  completed: boolean;
  progress: number;
  goal: number;
  rewardCoins?: number;
  rewardItem?: ItemId;
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

export type WorldSeason = "Spring" | "Summer" | "Autumn" | "Winter";

export interface WorldTime {
  totalSeconds: number;
  timeOfDay: "Morning" | "Day" | "Sunset" | "Night";
  hour: number;
  minute: number;
  dayNumber: number;
  lightLevel: number; // 0.0 (pitch black night) to 1.0 (bright midday)
  season: WorldSeason;
  seasonDay: number;
}

export interface JournalRecord {
  discoveredCrops: Record<string, boolean>;
  harvestedCrops: Record<string, number>;
  caughtFish: Record<string, { count: number; maxWeight: number }>;
  questsCompleted: number;
}
