/**
 * SurvivalEngine.ts - Complete Single-Player Survival Sandbox Simulation
 *
 * Implements the full gameplay loop from gameLogicV1.txt:
 * Explore -> Gather -> Craft -> Build -> Survive -> Combat -> Wildlife/NPCs.
 */

import {
  Direction,
  Position2D,
  HeartParticle,
  SpeciesType,
} from "../lifeforms/types";
import { Animal } from "../lifeforms/Animal";
import { NPC } from "../lifeforms/NPC";
import { Player } from "../lifeforms/Player";
import { SPECIES_CONFIGS } from "../lifeforms/speciesConfig";
import { EnvironmentDetector } from "../lifeforms/EnvironmentDetector";
import { WorldManager, CHUNK_SIZE } from "./WorldManager";
import {
  ItemId,
  ItemDef,
  InventorySlot,
  Recipe,
  ResourceNode,
  DroppedItem,
  PlacedStructure,
  EnemyEntity,
  FloatingText,
  WoodChipParticle,
  Quest,
  WorldTime,
} from "./GameTypes";
import { GameAudio } from "./GameAudio";
import { LifeformSpawner } from "./LifeformSpawner";

// Item Catalog Definition
export const ITEM_CATALOG: Record<ItemId, ItemDef> = {
  wood: {
    id: "wood",
    name: "Oak Wood",
    category: "resource",
    description: "Sturdy wood logs chopped from trees.",
    icon: "🪵",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/wood.png",
    maxStack: 99,
  },
  stick: {
    id: "stick",
    name: "Sticks",
    category: "resource",
    description: "Thin wooden branches for crafting tools.",
    icon: "🥢",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/axe.png",
    maxStack: 99,
  },
  stone: {
    id: "stone",
    name: "Cobblestone",
    category: "resource",
    description: "Rough stone mined from boulders.",
    icon: "🪨",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/rock.png",
    maxStack: 99,
  },
  coal: {
    id: "coal",
    name: "Lump of Coal",
    category: "resource",
    description: "Combustible fuel for campfires and torches.",
    icon: "⚫",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/rock.png",
    maxStack: 99,
  },
  iron_ore: {
    id: "iron_ore",
    name: "Iron Ore",
    category: "resource",
    description: "Unrefined iron extracted from mineral veins.",
    icon: "⛏️",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/rock.png",
    maxStack: 99,
  },
  iron_ingot: {
    id: "iron_ingot",
    name: "Iron Ingot",
    category: "resource",
    description: "Smelted iron bar for superior tools.",
    icon: "🪙",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/itemdisc_01.png",
    maxStack: 99,
  },
  fiber: {
    id: "fiber",
    name: "Plant Fiber",
    category: "resource",
    description: "Tough fibers for binding and crafting.",
    icon: "🌿",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/plant.png",
    maxStack: 99,
  },
  berries: {
    id: "berries",
    name: "Sweet Berries",
    category: "food",
    description: "Juicy forest berries. Restores 15 hunger.",
    icon: "🍓",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/radish_05.png",
    maxStack: 50,
    hungerRestore: 15,
    healthRestore: 4,
  },
  apple: {
    id: "apple",
    name: "Red Apple",
    category: "food",
    description: "Crisp wild apple. Restores 20 hunger.",
    icon: "🍎",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/carrot_05.png",
    maxStack: 50,
    hungerRestore: 20,
    healthRestore: 8,
  },
  raw_meat: {
    id: "raw_meat",
    name: "Raw Meat",
    category: "food",
    description: "Raw cut of meat. Cook before eating.",
    icon: "🥩",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/egg.png",
    maxStack: 30,
    hungerRestore: 10,
    healthRestore: -5,
  },
  cooked_meat: {
    id: "cooked_meat",
    name: "Roasted Meat",
    category: "food",
    description: "Savory meat roasted over fire. Restores 45 hunger.",
    icon: "🍖",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/egg.png",
    maxStack: 30,
    hungerRestore: 45,
    healthRestore: 25,
  },
  wheat: {
    id: "wheat",
    name: "Golden Wheat",
    category: "resource",
    description: "Harvested grain for baking bread.",
    icon: "🌾",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/wheat_05.png",
    maxStack: 99,
  },
  bread: {
    id: "bread",
    name: "Hearty Bread",
    category: "food",
    description: "Fresh baked loaf. Restores 35 hunger.",
    icon: "🍞",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/wheat_04.png",
    maxStack: 30,
    hungerRestore: 35,
    healthRestore: 15,
  },
  seeds: {
    id: "seeds",
    name: "Crop Seeds",
    category: "resource",
    description: "Seeds to plant crops in tilled farm soil.",
    icon: "🌱",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/seeds_generic.png",
    maxStack: 99,
  },
  slime_gel: {
    id: "slime_gel",
    name: "Slime Gel",
    category: "resource",
    description: "Sticky gooey residue dropped by slimes.",
    icon: "🧪",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/itemdisc_02.png",
    maxStack: 99,
  },

  // Tools & Weapons
  wooden_axe: {
    id: "wooden_axe",
    name: "Wooden Axe",
    category: "tool",
    description: "Basic woodcutter axe. Effective on trees.",
    icon: "🪓",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/axe.png",
    maxStack: 1,
    durability: 40,
    maxDurability: 40,
    damage: 5,
    gatherPower: 10,
    gatherType: "wood",
  },
  stone_axe: {
    id: "stone_axe",
    name: "Stone Axe",
    category: "tool",
    description: "Sharpened stone axe with greater durability.",
    icon: "🪓",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/axe.png",
    maxStack: 1,
    durability: 90,
    maxDurability: 90,
    damage: 9,
    gatherPower: 16,
    gatherType: "wood",
  },
  iron_axe: {
    id: "iron_axe",
    name: "Iron Axe",
    category: "tool",
    description: "Heavy iron axe. Chops trees with ease.",
    icon: "🪓",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/axe.png",
    maxStack: 1,
    durability: 200,
    maxDurability: 200,
    damage: 15,
    gatherPower: 25,
    gatherType: "wood",
  },

  wooden_pickaxe: {
    id: "wooden_pickaxe",
    name: "Wooden Pickaxe",
    category: "tool",
    description: "Crude pickaxe for breaking soft rock.",
    icon: "⛏️",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/pickaxe.png",
    maxStack: 1,
    durability: 35,
    maxDurability: 35,
    damage: 4,
    gatherPower: 8,
    gatherType: "stone",
  },
  stone_pickaxe: {
    id: "stone_pickaxe",
    name: "Stone Pickaxe",
    category: "tool",
    description: "Sturdy pickaxe for mining stone and iron.",
    icon: "⛏️",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/pickaxe.png",
    maxStack: 1,
    durability: 85,
    maxDurability: 85,
    damage: 7,
    gatherPower: 15,
    gatherType: "stone",
  },
  iron_pickaxe: {
    id: "iron_pickaxe",
    name: "Iron Pickaxe",
    category: "tool",
    description: "High-grade iron pickaxe for rapid mining.",
    icon: "⛏️",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/pickaxe.png",
    maxStack: 1,
    durability: 180,
    maxDurability: 180,
    damage: 12,
    gatherPower: 24,
    gatherType: "stone",
  },

  wooden_sword: {
    id: "wooden_sword",
    name: "Wooden Club",
    category: "weapon",
    description: "Carved wooden club for basic defense.",
    icon: "🗡️",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/sword.png",
    maxStack: 1,
    durability: 50,
    maxDurability: 50,
    damage: 12,
  },
  stone_sword: {
    id: "stone_sword",
    name: "Stone Blade",
    category: "weapon",
    description: "Flint-edged shortsword for combat.",
    icon: "⚔️",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/sword.png",
    maxStack: 1,
    durability: 110,
    maxDurability: 110,
    damage: 20,
  },
  iron_sword: {
    id: "iron_sword",
    name: "Iron Broadsword",
    category: "weapon",
    description: "Forged iron sword dealing lethal damage.",
    icon: "🗡️",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/sword.png",
    maxStack: 1,
    durability: 220,
    maxDurability: 220,
    damage: 32,
  },

  wooden_shovel: {
    id: "wooden_shovel",
    name: "Wooden Shovel",
    category: "tool",
    description: "Tills soil for crops and digs ground.",
    icon: "🪴",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/shovel.png",
    maxStack: 1,
    durability: 40,
    maxDurability: 40,
    damage: 3,
    gatherPower: 10,
    gatherType: "all",
  },
  stone_shovel: {
    id: "stone_shovel",
    name: "Stone Shovel",
    category: "tool",
    description: "Sturdy shovel for excavation and tilling.",
    icon: "🪴",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/shovel.png",
    maxStack: 1,
    durability: 80,
    maxDurability: 80,
    damage: 6,
    gatherPower: 15,
    gatherType: "all",
  },
  iron_shovel: {
    id: "iron_shovel",
    name: "Iron Shovel",
    category: "tool",
    description: "High-grade shovel for rapid digging.",
    icon: "🪴",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/shovel.png",
    maxStack: 1,
    durability: 160,
    maxDurability: 160,
    damage: 10,
    gatherPower: 22,
    gatherType: "all",
  },

  watering_can: {
    id: "watering_can",
    name: "Watering Can",
    category: "tool",
    description: "Waters crops and hydrated dry farmland.",
    icon: "🚰",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/water.png",
    maxStack: 1,
    durability: 60,
    maxDurability: 60,
  },

  wooden_hammer: {
    id: "wooden_hammer",
    name: "Wooden Mallet",
    category: "tool",
    description: "Carpenter mallet for building and repairing.",
    icon: "🔨",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/hammer.png",
    maxStack: 1,
    durability: 50,
    maxDurability: 50,
    damage: 6,
  },
  iron_hammer: {
    id: "iron_hammer",
    name: "Smithing Hammer",
    category: "tool",
    description: "Heavy iron hammer for forging and construction.",
    icon: "🔨",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/hammer.png",
    maxStack: 1,
    durability: 150,
    maxDurability: 150,
    damage: 14,
  },

  fishing_rod: {
    id: "fishing_rod",
    name: "Fishing Rod",
    category: "tool",
    description: "Casts into water to catch fresh fish.",
    icon: "🎣",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/rod.png",
    maxStack: 1,
    durability: 40,
    maxDurability: 40,
  },

  raw_fish: {
    id: "raw_fish",
    name: "Raw Fish",
    category: "food",
    description: "Freshly caught river fish.",
    icon: "🐟",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/egg.png",
    maxStack: 30,
    hungerRestore: 15,
    healthRestore: 5,
  },
  cooked_fish: {
    id: "cooked_fish",
    name: "Grilled Fish",
    category: "food",
    description: "Delicious tender fish cooked over campfire.",
    icon: "🍣",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/egg.png",
    maxStack: 30,
    hungerRestore: 45,
    healthRestore: 20,
  },

  // Survival & Stations
  torch: {
    id: "torch",
    name: "Torch",
    category: "survival",
    description: "Provides portable illumination in dark night.",
    icon: "🔥",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/indicator.png",
    maxStack: 20,
  },
  campfire: {
    id: "campfire",
    name: "Campfire",
    category: "station",
    description: "Provides warmth, night light, and cooks meat.",
    icon: "🏕️",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/plant.png",
    maxStack: 5,
    isPlaceable: true,
  },
  workbench: {
    id: "workbench",
    name: "Crafting Bench",
    category: "station",
    description: "Unlocks advanced stone & iron recipes.",
    icon: "🧰",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/hammer.png",
    maxStack: 5,
    isPlaceable: true,
  },
  chest: {
    id: "chest",
    name: "Storage Chest",
    category: "building",
    description: "Stores up to 16 item stacks safely.",
    icon: "📦",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/basket.png",
    maxStack: 5,
    isPlaceable: true,
  },

  // Building Structures
  wood_wall: {
    id: "wood_wall",
    name: "Wooden Wall",
    category: "building",
    description: "Solid timber wall section for shelter.",
    icon: "🧱",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/itemdisc_01.png",
    maxStack: 50,
    isPlaceable: true,
  },
  wood_floor: {
    id: "wood_floor",
    name: "Wooden Floor",
    category: "building",
    description: "Plank floor tile for dry shelter base.",
    icon: "🪵",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/wood.png",
    maxStack: 50,
    isPlaceable: true,
  },
  wood_door: {
    id: "wood_door",
    name: "Wooden Door",
    category: "building",
    description: "Hinged wooden door that can be opened/closed.",
    icon: "🚪",
    spritePath:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/indicator.png",
    maxStack: 10,
    isPlaceable: true,
  },
};

// Crafting Recipes Catalog
export const CRAFTING_RECIPES: Recipe[] = [
  {
    id: "stick",
    name: "Sticks (x4)",
    result: "stick",
    count: 4,
    ingredients: [{ item: "wood", count: 1 }],
    category: "survival",
  },
  {
    id: "torch",
    name: "Torches (x4)",
    result: "torch",
    count: 4,
    ingredients: [
      { item: "stick", count: 1 },
      { item: "coal", count: 1 },
    ],
    category: "survival",
  },
  {
    id: "campfire",
    name: "Campfire",
    result: "campfire",
    count: 1,
    ingredients: [
      { item: "wood", count: 3 },
      { item: "stone", count: 4 },
      { item: "fiber", count: 2 },
    ],
    category: "survival",
  },
  {
    id: "workbench",
    name: "Crafting Bench",
    result: "workbench",
    count: 1,
    ingredients: [
      { item: "wood", count: 4 },
      { item: "stick", count: 2 },
    ],
    category: "survival",
  },
  {
    id: "wooden_axe",
    name: "Wooden Axe",
    result: "wooden_axe",
    count: 1,
    ingredients: [
      { item: "wood", count: 3 },
      { item: "stick", count: 2 },
    ],
    category: "tools",
  },
  {
    id: "wooden_pickaxe",
    name: "Wooden Pickaxe",
    result: "wooden_pickaxe",
    count: 1,
    ingredients: [
      { item: "wood", count: 3 },
      { item: "stick", count: 2 },
    ],
    category: "tools",
  },
  {
    id: "wooden_sword",
    name: "Wooden Club",
    result: "wooden_sword",
    count: 1,
    ingredients: [
      { item: "wood", count: 2 },
      { item: "stick", count: 1 },
    ],
    category: "tools",
  },
  {
    id: "stone_axe",
    name: "Stone Axe",
    result: "stone_axe",
    count: 1,
    ingredients: [
      { item: "stone", count: 3 },
      { item: "stick", count: 2 },
      { item: "fiber", count: 1 },
    ],
    requiresStation: "workbench",
    category: "tools",
  },
  {
    id: "stone_pickaxe",
    name: "Stone Pickaxe",
    result: "stone_pickaxe",
    count: 1,
    ingredients: [
      { item: "stone", count: 3 },
      { item: "stick", count: 2 },
    ],
    requiresStation: "workbench",
    category: "tools",
  },
  {
    id: "stone_sword",
    name: "Stone Blade",
    result: "stone_sword",
    count: 1,
    ingredients: [
      { item: "stone", count: 2 },
      { item: "stick", count: 1 },
      { item: "fiber", count: 1 },
    ],
    requiresStation: "workbench",
    category: "tools",
  },
  {
    id: "wooden_shovel",
    name: "Wooden Shovel",
    result: "wooden_shovel",
    count: 1,
    ingredients: [
      { item: "wood", count: 2 },
      { item: "stick", count: 1 },
    ],
    category: "tools",
  },
  {
    id: "stone_shovel",
    name: "Stone Shovel",
    result: "stone_shovel",
    count: 1,
    ingredients: [
      { item: "stone", count: 2 },
      { item: "stick", count: 1 },
    ],
    requiresStation: "workbench",
    category: "tools",
  },
  {
    id: "watering_can",
    name: "Watering Can",
    result: "watering_can",
    count: 1,
    ingredients: [
      { item: "wood", count: 3 },
      { item: "fiber", count: 2 },
    ],
    category: "tools",
  },
  {
    id: "wooden_hammer",
    name: "Wooden Mallet",
    result: "wooden_hammer",
    count: 1,
    ingredients: [
      { item: "wood", count: 3 },
      { item: "stick", count: 2 },
    ],
    category: "tools",
  },
  {
    id: "fishing_rod",
    name: "Fishing Rod",
    result: "fishing_rod",
    count: 1,
    ingredients: [
      { item: "stick", count: 3 },
      { item: "fiber", count: 2 },
    ],
    category: "tools",
  },
  {
    id: "bread",
    name: "Hearty Bread",
    result: "bread",
    count: 1,
    ingredients: [{ item: "wheat", count: 3 }],
    category: "survival",
  },
  {
    id: "cooked_meat",
    name: "Roasted Meat",
    result: "cooked_meat",
    count: 1,
    ingredients: [{ item: "raw_meat", count: 1 }],
    requiresStation: "campfire",
    category: "survival",
  },
  {
    id: "cooked_fish",
    name: "Grilled Fish",
    result: "cooked_fish",
    count: 1,
    ingredients: [{ item: "raw_fish", count: 1 }],
    requiresStation: "campfire",
    category: "survival",
  },
  {
    id: "chest",
    name: "Storage Chest",
    result: "chest",
    count: 1,
    ingredients: [
      { item: "wood", count: 6 },
      { item: "stick", count: 2 },
    ],
    requiresStation: "workbench",
    category: "building",
  },
  {
    id: "wood_wall",
    name: "Wooden Wall (x2)",
    result: "wood_wall",
    count: 2,
    ingredients: [{ item: "wood", count: 2 }],
    category: "building",
  },
  {
    id: "wood_floor",
    name: "Wooden Floor (x2)",
    result: "wood_floor",
    count: 2,
    ingredients: [{ item: "wood", count: 1 }],
    category: "building",
  },
  {
    id: "wood_door",
    name: "Wooden Door",
    result: "wood_door",
    count: 1,
    ingredients: [
      { item: "wood", count: 4 },
      { item: "stick", count: 2 },
    ],
    requiresStation: "workbench",
    category: "building",
  },
];

export class SurvivalEngine {
  public worldManager: WorldManager;

  // Player State
  public player: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    direction: Direction;
    facing: "LEFT" | "RIGHT";
    speed: number;
    sprintSpeed: number;
    isSprinting: boolean;
    health: number;
    maxHealth: number;
    hunger: number;
    maxHunger: number;
    stamina: number;
    maxStamina: number;
    isDead: boolean;
    hopOffset: number;
    hopTimer: number;
    swingTimer: number;
    hurtTimer: number;
    rollTimer: number;
    isSwimming: boolean;
    idleStillTimer: number;
    isWaiting: boolean;
    doingTimer: number;
    fishingState: "NONE" | "CASTING" | "REELING" | "CAUGHT";
    fishingTimer: number;
  };

  // Inventory & Hotbar (20 main slots + 8 quick hotbar slots)
  public inventory: InventorySlot[] = [];
  public hotbar: InventorySlot[] = [];
  public activeHotbarIndex = 0;

  // World Simulation & Entities
  public animals: Animal[] = [];
  public npcs: NPC[] = [];
  public enemies: EnemyEntity[] = [];
  public droppedItems: DroppedItem[] = [];
  public placedStructures: PlacedStructure[] = [];
  public particles: HeartParticle[] = [];
  public woodChips: WoodChipParticle[] = [];
  public floatingTexts: FloatingText[] = [];
  public remotePlayers: any[] = [];

  // Day / Night World Clock
  public worldTime: WorldTime = {
    totalSeconds: 120, // start at mid-morning
    timeOfDay: "Day",
    hour: 8,
    minute: 30,
    dayNumber: 1,
    lightLevel: 1.0,
  };

  // Quests / Milestones
  public quests: Quest[] = [
    {
      id: "gather_wood",
      title: "Gather Wood",
      desc: "Chop nearby trees to collect 5 wood logs.",
      progress: 0,
      goal: 5,
      completed: false,
    },
    {
      id: "craft_axe",
      title: "Craft an Axe",
      desc: "Craft sticks and a Wooden Axe in your crafting menu [C].",
      progress: 0,
      goal: 1,
      completed: false,
    },
    {
      id: "find_food",
      title: "Gather Food",
      desc: "Forage 5 Sweet Berries from bushes.",
      progress: 0,
      goal: 5,
      completed: false,
    },
    {
      id: "pet_animal",
      title: "Befriend Wildlife",
      desc: "Approach a cow or sheep and press [E] to pet it.",
      progress: 0,
      goal: 1,
      completed: false,
    },
    {
      id: "build_campfire",
      title: "Shelter & Warmth",
      desc: "Craft and place a Campfire before night falls.",
      progress: 0,
      goal: 1,
      completed: false,
    },
    {
      id: "discover_village",
      title: "Explore the Realm",
      desc: "Travel outward to discover another village in the world.",
      progress: 1,
      goal: 2,
      completed: false,
    },
    {
      id: "mine_iron",
      title: "Mine Mineral Veins",
      desc: "Mine boulders with a pickaxe to find Iron Ore.",
      progress: 0,
      goal: 3,
      completed: false,
    },
  ];

  // Building Preview State
  public isBuildMode = false;
  public buildPiece: ItemId | null = null;
  public buildPreviewX = 0;
  public buildPreviewY = 0;
  public isBuildPreviewValid = false;

  // NPC Dialogue / Barter State
  public activeDialogueNPC: NPC | null = null;

  // Chest Storage Modal State
  public activeChest: PlacedStructure | null = null;

  public detector: EnvironmentDetector;

  private nextEntityId = 1000;
  private nextItemId = 1;
  private nextParticleId = 1;
  private hungerTickTimer = 0;
  private enemySpawnTimer = 0;
  private wildlifeSpawnTimer = 0;

  public lifeformSpawner: LifeformSpawner;
  public isWorldGenMode = false;

  constructor(seed = 42891, isWorldGenMode = false, maxPhase = 10) {
    this.isWorldGenMode = isWorldGenMode;

    // ── PHASE 1 & 2: World Generation & Farm Generation (via WorldManager & FarmGenerator) ──
    console.log("[LIFECYCLE PHASE 1: World Generation] Generating terrain chunks, biomes, road networks, water bodies, and village layouts...");
    this.worldManager = new WorldManager(seed, maxPhase);
    this.lifeformSpawner = new LifeformSpawner(this.worldManager, seed);
    this.worldManager.updatePlayerLocation(22, 18);

    const startVillage = this.worldManager.villages[0]?.data;
    this.detector = new EnvironmentDetector(startVillage);

    this.player = {
      x: 22,
      y: 18,
      vx: 0,
      vy: 0,
      direction: "DOWN",
      facing: "RIGHT",
      speed: 3.4,
      sprintSpeed: 5.6,
      isSprinting: false,
      health: 100,
      maxHealth: 100,
      hunger: 100,
      maxHunger: 100,
      stamina: 100,
      maxStamina: 100,
      isDead: false,
      hopOffset: 0,
      hopTimer: 0,
      swingTimer: 0,
      hurtTimer: 0,
      rollTimer: 0,
      isSwimming: false,
      idleStillTimer: 0,
      isWaiting: false,
      doingTimer: 0,
      fishingState: "NONE",
      fishingTimer: 0,
    };

    // ── PHASE 8: Village Villager Spawning ──
    if (maxPhase >= 8) {
      console.log("[LIFECYCLE PHASE 8: Lifeform Spawning] Spawning villagers with assigned roles...");
      this.spawnInitialVillagers();
    }

    // ── PHASE 9: Passive Wildlife Spawning ──
    if (maxPhase >= 9) {
      console.log("[LIFECYCLE PHASE 9: Wildlife Spawning] Spawning wildlife (ducks in water, livestock on land)...");
      this.spawnInitialWildlife();
    }

    // ── PHASE 10: Enemy Spawning ──
    if (maxPhase >= 10) {
      console.log("[LIFECYCLE PHASE 10: Enemy Spawning] Spawning monsters and hostile lifeforms in the wilderness...");
      this.spawnInitialEnemies();
    }

    // ── PHASE 11: Player Initialization & Playable Game Ready ──
    if (maxPhase >= 11) {
      console.log("[LIFECYCLE PHASE 11: World Playable] Player inventory and survival equipment initialized. Ready to play!");
      this.initInventory();
    }
  }

  private initInventory() {
    // 20 main inventory slots
    for (let i = 0; i < 20; i++) {
      this.inventory.push({ item: null, count: 0 });
    }
    // 8 hotbar slots
    for (let i = 0; i < 8; i++) {
      this.hotbar.push({ item: null, count: 0 });
    }

    // Starter tools with animations in Human folder
    this.hotbar[0] = {
      item: "wooden_axe",
      count: 1,
      durability: 40,
      maxDurability: 40,
    };
    this.hotbar[1] = {
      item: "wooden_pickaxe",
      count: 1,
      durability: 35,
      maxDurability: 35,
    };
    this.hotbar[2] = {
      item: "wooden_sword",
      count: 1,
      durability: 50,
      maxDurability: 50,
    };
    this.hotbar[3] = {
      item: "wooden_shovel",
      count: 1,
      durability: 40,
      maxDurability: 40,
    };
    this.hotbar[4] = {
      item: "watering_can",
      count: 1,
      durability: 50,
      maxDurability: 50,
    };
    this.hotbar[5] = {
      item: "wooden_hammer",
      count: 1,
      durability: 40,
      maxDurability: 40,
    };
    this.hotbar[6] = {
      item: "fishing_rod",
      count: 1,
      durability: 30,
      maxDurability: 30,
    };
    this.hotbar[7] = { item: "berries", count: 10 };
  }

  /**
   * Phase 3: Spawns initial passive wildlife & NPCs in the starting village area.
   */
  private spawnInitialVillagers() {
    this.lifeformSpawner.setNextEntityId(this.nextEntityId);
    
    const newNpcs: any[] = [];
    
    this.lifeformSpawner.spawnInitialVillagers(
      this.worldManager.villages[0],
      this.player.x,
      this.player.y,
      newNpcs
    );

    this.npcs.push(...newNpcs);
    this.nextEntityId = this.lifeformSpawner.getNextEntityId();
  }

  private spawnInitialWildlife() {
    this.lifeformSpawner.setNextEntityId(this.nextEntityId);
    
    const newAnimals: any[] = [];
    
    // Sub-Phase: Aquatic life (Ducks)
    console.log("[Sub-Phase: Aquatic Life] Spawning ducks in water bodies...");
    this.lifeformSpawner.spawnInitialDucks(
      this.worldManager.villages[0],
      newAnimals
    );
    
    // Sub-Phase: Terrestrial Wildlife
    console.log("[Sub-Phase: Terrestrial Wildlife] Spawning terrestrial animals across village bounds...");
    this.lifeformSpawner.spawnInitialWildlife(
      this.worldManager.villages[0],
      newAnimals
    );

    this.animals.push(...newAnimals);
    this.nextEntityId = this.lifeformSpawner.getNextEntityId();
  }

  /**
   * Phase 4: Spawns hostile entities in the wilderness strictly after world generation and passive lifeforms.
   */
  private spawnInitialEnemies() {
    this.lifeformSpawner.setNextEntityId(this.nextEntityId);

    const newEnemies: any[] = [];
    this.lifeformSpawner.spawnInitialEnemies(
      this.player.x,
      this.player.y,
      newEnemies
    );

    this.enemies.push(...newEnemies);
    this.nextEntityId = this.lifeformSpawner.getNextEntityId();
  }

  /**
   * Main game tick update loop (dt in seconds, ~0.016 for 60 FPS).
   */
  public update(dt: number) {
    if (this.player.isDead) return;

    // 1. Advance World Clock (8 minutes = 480 seconds per full 24h cycle)
    this.updateWorldTime(dt);

    if (this.isWorldGenMode) {
      this.worldManager.updatePlayerLocation(this.player.x, this.player.y);
      return;
    }

    // 2. Player Movement & Physics
    this.updatePlayerMovement(dt);

    // 3. Survival Needs (Hunger, Stamina, Health)
    this.updateSurvivalNeeds(dt);

    // 4. Update World Generation around player (Minecraft-style infinite chunks)
    this.worldManager.updatePlayerLocation(this.player.x, this.player.y);

    // Collect wild animals spawned as new chunks load
    this.lifeformSpawner.setNextEntityId(this.nextEntityId);
    const newAnimals: Animal[] = [];
    this.lifeformSpawner.processChunksAroundPlayer(this.player.x, this.player.y, newAnimals);
    
    // this.animals.push(...newAnimals);
    this.nextEntityId = this.lifeformSpawner.getNextEntityId();


    // 5. Dropped Items Magnet & Pickup
    this.updateDroppedItems(dt);

    // 6. Update Wildlife & Village NPCs (Culled and frozen when > 4 chunks away)
    this.updateLifeforms(dt);

    // 7. Update Hostile Enemies & Combat
    this.updateEnemies(dt);

    // 8. Update Particles & VFX
    this.updateParticles(dt);

    // 9. Periodic Spawning (Wildlife & Night Enemies)
    this.lifeformSpawner.setNextEntityId(this.nextEntityId);
    const periodicAnimals: Animal[] = [];
    const periodicEnemies: any[] = [];
    this.lifeformSpawner.handlePeriodicSpawns(
      dt,
      this.worldTime.timeOfDay,
      this.player.x,
      this.player.y,
      this.animals.length,
      this.enemies.length,
      periodicAnimals,
      periodicEnemies
    );
    // this.animals.push(...periodicAnimals);
    this.enemies.push(...periodicEnemies);
    this.nextEntityId = this.lifeformSpawner.getNextEntityId();
  }

  /**
   * Updates day/night clock, light levels, and ambient illumination.
   */
  private updateWorldTime(dt: number) {
    this.worldTime.totalSeconds += dt;
    const cycleLength = 480; // 8 minutes
    const dayProgress =
      (this.worldTime.totalSeconds % cycleLength) / cycleLength;

    const totalHours = dayProgress * 24;
    this.worldTime.hour = Math.floor(totalHours);
    this.worldTime.minute = Math.floor((totalHours % 1) * 60);
    this.worldTime.dayNumber =
      Math.floor(this.worldTime.totalSeconds / cycleLength) + 1;

    // Time of day & Light Level
    if (this.worldTime.hour >= 5 && this.worldTime.hour < 8) {
      this.worldTime.timeOfDay = "Morning";
      this.worldTime.lightLevel = 0.4 + ((this.worldTime.hour - 5) / 3) * 0.5;
    } else if (this.worldTime.hour >= 8 && this.worldTime.hour < 18) {
      this.worldTime.timeOfDay = "Day";
      this.worldTime.lightLevel = 1.0;
    } else if (this.worldTime.hour >= 18 && this.worldTime.hour < 21) {
      this.worldTime.timeOfDay = "Sunset";
      this.worldTime.lightLevel = 1.0 - ((this.worldTime.hour - 18) / 3) * 0.75;
    } else {
      this.worldTime.timeOfDay = "Night";
      this.worldTime.lightLevel = 0.18; // dark night
    }

    // Quest check: Survive the night
    if (
      this.worldTime.timeOfDay === "Morning" &&
      this.worldTime.dayNumber >= 2
    ) {
      this.completeQuest("build_campfire");
    }
  }

  /**
   * Updates player position with collision detection against water, trees, and walls.
   */
  private updatePlayerMovement(dt: number) {
    // Player never swims — water is always a solid collision barrier
    this.player.isSwimming = false;

    // Sprint speed logic (no swimming modifier)
    let baseSpeed =
      this.player.isSprinting && this.player.stamina > 10
        ? this.player.sprintSpeed
        : this.player.speed;
    const currentSpeed = baseSpeed;

    if (
      this.player.isSprinting &&
      (this.player.vx !== 0 || this.player.vy !== 0)
    ) {
      this.player.stamina = Math.max(0, this.player.stamina - dt * 18);
    } else {
      this.player.stamina = Math.min(
        this.player.maxStamina,
        this.player.stamina + dt * 14,
      );
    }

    const nextX = this.player.x + this.player.vx * currentSpeed * dt;
    const nextY = this.player.y + this.player.vy * currentSpeed * dt;

    // Smooth movement with diagonal sliding
    if (this.canMoveTo(nextX, nextY)) {
      this.player.x = nextX;
      this.player.y = nextY;
    } else {
      // Slide horizontally if clear
      if (this.canMoveTo(nextX, this.player.y)) {
        this.player.x = nextX;
      }
      // Slide vertically if clear
      if (this.canMoveTo(this.player.x, nextY)) {
        this.player.y = nextY;
      }
    }

    // Facing direction: moving diagonal updates facing direction smoothly (e.g. SW to SE switches to East immediately)
    if (this.player.vx > 0) {
      this.player.facing = "RIGHT";
      this.player.direction = "RIGHT";
    } else if (this.player.vx < 0) {
      this.player.facing = "LEFT";
      this.player.direction = "LEFT";
    } else if (this.player.vy > 0) {
      this.player.direction = "DOWN";
    } else if (this.player.vy < 0) {
      this.player.direction = "UP";
    }

    // Visual hop/jump animation (smooth, longer 0.55s graceful parabolic arc)
    if (this.player.hopTimer > 0) {
      this.player.hopTimer -= dt;
      const progress = Math.max(
        0,
        Math.min(1, 1 - this.player.hopTimer / 0.55),
      );
      this.player.hopOffset = Math.sin(progress * Math.PI) * 0.55;
    } else {
      this.player.hopOffset = 0;
    }

    // Still / idle detection for WAITING animation (> 3 seconds still)
    if (
      this.player.vx === 0 &&
      this.player.vy === 0 &&
      this.player.swingTimer <= 0 &&
      this.player.hopTimer <= 0 &&
      !this.player.isSwimming
    ) {
      this.player.idleStillTimer += dt;
      if (this.player.idleStillTimer >= 3.0) {
        this.player.isWaiting = true;
      }
    } else {
      this.player.idleStillTimer = 0;
      this.player.isWaiting = false;
    }

    // Tool swing animation timer
    if (this.player.swingTimer > 0) {
      this.player.swingTimer -= dt;
    }
    if (this.player.hurtTimer > 0) {
      this.player.hurtTimer -= dt;
    }
    if (this.player.rollTimer > 0) {
      this.player.rollTimer -= dt;
    }
    if (this.player.doingTimer > 0) {
      this.player.doingTimer -= dt;
    }

    // Fishing rod state machine
    if (this.player.fishingTimer > 0) {
      this.player.fishingTimer -= dt;
      if (this.player.fishingTimer <= 0) {
        if (this.player.fishingState === "CASTING") {
          this.player.fishingState = "REELING";
          this.player.fishingTimer = 1.6;
        } else if (this.player.fishingState === "REELING") {
          this.player.fishingState = "CAUGHT";
          this.player.fishingTimer = 1.0;
          this.addItemToInventory("raw_fish", 1);
          this.addFloatingText(
            "+1 Raw Fish 🐟",
            this.player.x,
            this.player.y - 1,
            "#38bdf8",
          );
        } else {
          this.player.fishingState = "NONE";
        }
      }
    }
  }

  public jump(): void {
    if (
      this.player.isDead ||
      this.player.hopTimer > 0 ||
      this.player.isSwimming
    )
      return;
    this.player.hopTimer = 0.55;
    GameAudio.playJump();
  }

  public roll(): void {
    this.jump();
  }

  public canMoveTo(x: number, y: number): boolean {
    const footX = x + 0.5;
    const footY = y + 0.65;
    const rx = 0.35;
    const ry = 0.25;

    // Check 4 corners + center foot point + 4 edge midpoints for robust diagonal collision.
    // This prevents corner-cutting through diagonally adjacent water/blocked tiles.
    const pts = [
      // 4 corners of foot bounding box
      { x: footX - rx, y: footY - ry },
      { x: footX + rx, y: footY - ry },
      { x: footX - rx, y: footY + ry },
      { x: footX + rx, y: footY + ry },
      // Center foot point (catches diagonal tiles the corners miss)
      { x: footX, y: footY },
      // 4 edge midpoints for extra diagonal coverage
      { x: footX, y: footY - ry }, // top-center
      { x: footX, y: footY + ry }, // bottom-center
      { x: footX - rx, y: footY }, // left-center
      { x: footX + rx, y: footY }, // right-center
    ];
    for (const p of pts) {
      const tile = this.worldManager.getTile(Math.floor(p.x), Math.floor(p.y));
      if (tile.isWater || tile.isBlocked) return false;
    }
    if (this.isBlockedByStructure(footX, footY)) return false;
    if (this.worldManager.isBlockedByTreeTrunk(footX, footY)) return false;
    return true;
  }

  private isBlockedByStructure(footX: number, footY: number): boolean {
    for (const struct of this.placedStructures) {
      const isSolid =
        struct.type === "wood_wall" ||
        struct.type === "chest" ||
        struct.type === "workbench" ||
        (struct.type === "wood_door" && !struct.isOpen);
      if (isSolid) {
        const sx = struct.x + 0.5;
        const sy = struct.y + 0.5;
        if (Math.abs(footX - sx) < 0.62 && Math.abs(footY - sy) < 0.62) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Manages hunger drain and health regeneration/depletion.
   */
  private updateSurvivalNeeds(dt: number) {
    this.hungerTickTimer += dt;
    if (this.hungerTickTimer >= 3.0) {
      this.hungerTickTimer = 0;
      // Hunger slowly depletes (faster when sprinting)
      const drain = this.player.isSprinting ? 1.2 : 0.6;
      this.player.hunger = Math.max(0, this.player.hunger - drain);

      // If starving (hunger == 0), take starvation damage
      if (this.player.hunger <= 0) {
        this.damagePlayer(4, "Starvation");
      } else if (
        this.player.hunger >= 85 &&
        this.player.health < this.player.maxHealth
      ) {
        // Passive natural health regeneration when well-fed
        this.player.health = Math.min(
          this.player.maxHealth,
          this.player.health + 2,
        );
      }
    }
  }

  /**
   * Magnetizes dropped items towards player and auto-picks them up into inventory.
   */
  private updateDroppedItems(dt: number) {
    for (let i = this.droppedItems.length - 1; i >= 0; i--) {
      const item = this.droppedItems[i];
      item.bobTimer += dt * 4;

      const dist = Math.hypot(this.player.x - item.x, this.player.y - item.y);
      if (dist < 2.5) {
        // Magnet pull towards player
        const speed = (2.5 - dist) * 4;
        const angle = Math.atan2(
          this.player.y - item.y,
          this.player.x - item.x,
        );
        item.x += Math.cos(angle) * speed * dt;
        item.y += Math.sin(angle) * speed * dt;

        // Auto pickup range
        if (dist < 0.7) {
          if (this.addItemToInventory(item.item, item.count)) {
            GameAudio.playPickup();
            this.addFloatingText(
              `+${item.count} ${ITEM_CATALOG[item.item]?.name || item.item}`,
              item.x,
              item.y,
              "#38bdf8",
            );
            this.droppedItems.splice(i, 1);

            // Check quest progress
            if (item.item === "wood")
              this.updateQuestProgress("gather_wood", item.count);
            if (item.item === "berries")
              this.updateQuestProgress("find_food", item.count);
            if (item.item === "iron_ore")
              this.updateQuestProgress("mine_iron", item.count);
          }
        }
      }
    }
  }

  /**
   * Updates state of living wildlife animals and village NPCs.
   * Entities > 4 chunks away: animals are culled/not simulated, NPCs are frozen in place.
   */
  private updateLifeforms(dt: number) {
    const pcx = Math.floor(this.player.x / 16);
    const pcy = Math.floor(this.player.y / 16);

    // 1. Animals: culled & dormant outside 4 chunks
    for (const animal of this.animals) {
      if (!animal.isActive) continue;

      const acx = Math.floor(animal.position.x / 16);
      const acy = Math.floor(animal.position.y / 16);
      if (Math.abs(acx - pcx) > 4 || Math.abs(acy - pcy) > 4) {
        continue; // Culled when outside active 4-chunk radius
      }

      animal.updateAI(dt, this.detector);
      animal.updateMovement(dt, this.detector);
    }

    // 2. NPCs: frozen in place on unloaded chunks, resumed when chunk re-enters 4-chunk radius
    for (const npc of this.npcs) {
      if (!npc.isActive) continue;

      const ncx = Math.floor(npc.position.x / 16);
      const ncy = Math.floor(npc.position.y / 16);
      if (Math.abs(ncx - pcx) > 4 || Math.abs(ncy - pcy) > 4) {
        // Frozen on unloaded chunk (position & state preserved)
        (npc as any).isFrozen = true;
        continue;
      }

      (npc as any).isFrozen = false;
      npc.updateAI(dt, this.detector);
      npc.updateMovement(dt, this.detector);
    }
  }

  /**
   * Hostile Enemy AI (Slimes, Goblins, Wolves) active at night.
   */
  private updateEnemies(dt: number) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy.isAlive) {
        enemy.deathTimer -= dt;
        if (enemy.deathTimer <= 0) {
          this.enemies.splice(i, 1);
        }
        continue;
      }

      if (enemy.hurtTimer > 0) enemy.hurtTimer -= dt;
      if (enemy.attackCooldown > 0) enemy.attackCooldown -= dt;

      const dist = Math.hypot(this.player.x - enemy.x, this.player.y - enemy.y);

      // Detection & Chase
      if (dist < 8.0) {
        enemy.state = "CHASE";
        const angle = Math.atan2(
          this.player.y - enemy.y,
          this.player.x - enemy.x,
        );
        enemy.vx = Math.cos(angle) * enemy.speed;
        enemy.vy = Math.sin(angle) * enemy.speed;

        // Attack when within melee range
        if (dist < 1.1 && enemy.attackCooldown <= 0) {
          enemy.state = "ATTACK";
          enemy.attackCooldown = 1.4;
          this.damagePlayer(enemy.damage, enemy.name);
        }
      } else {
        // Patrol / Idle
        enemy.patrolTimer -= dt;
        if (enemy.patrolTimer <= 0) {
          enemy.patrolTimer = 2.5 + Math.random() * 3;
          if (Math.random() < 0.4) {
            enemy.state = "IDLE";
            enemy.vx = 0;
            enemy.vy = 0;
          } else {
            enemy.state = "PATROL";
            const randAngle = Math.random() * Math.PI * 2;
            enemy.vx = Math.cos(randAngle) * (enemy.speed * 0.5);
            enemy.vy = Math.sin(randAngle) * (enemy.speed * 0.5);
          }
        }
      }

      const nextX = enemy.x + enemy.vx * dt;
      const nextY = enemy.y + enemy.vy * dt;
      if (this.worldManager.isWalkable(nextX, nextY)) {
        enemy.x = nextX;
        enemy.y = nextY;
      }
    }
  }



  /**
   * Updates floating text, heart particles, and wood chip VFX.
   */
  private updateParticles(dt: number) {
    // 1. Hearts
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.y += p.vy * dt;
      p.x += p.vx * dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // 2. Wood chips
    for (let i = this.woodChips.length - 1; i >= 0; i--) {
      const c = this.woodChips[i];
      c.life -= dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vy += 6 * dt; // gravity
      if (c.life <= 0) this.woodChips.splice(i, 1);
    }

    // 3. Floating Damage / Info Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const t = this.floatingTexts[i];
      t.life -= dt;
      t.y -= 0.6 * dt; // float upwards
      if (t.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // PLAYER ACTIONS (GATHERING, ATTACK, CRAFTING, BUILDING, PETTING)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Performs an attack/hit in a small radius in front of the player based on facing direction.
   * Strikes any living creature (animals sprint away, enemies take damage) or harvestable resources.
   */
  public performDirectionalHit(): boolean {
    if (this.player.isDead) return false;

    this.player.swingTimer = 0.25;
    GameAudio.playSwing();

    // Small radius in the direction the player is facing
    const reach = 0.95;
    let hitX = this.player.x;
    let hitY = this.player.y;
    if (this.player.direction === "UP") {
      hitY -= reach;
    } else if (this.player.direction === "DOWN") {
      hitY += reach;
    } else if (
      this.player.direction === "LEFT" ||
      this.player.facing === "LEFT"
    ) {
      hitX -= reach;
    } else {
      hitX += reach;
    }

    const hitRadius = 1.35;

    // 1. Check Living Animals in facing hit cone -> take damage & sprint away!
    for (const animal of this.animals) {
      if (!animal.isActive || animal.behaviorState === "DEAD") continue;
      const dist = Math.hypot(
        hitX - animal.position.x,
        hitY - animal.position.y,
      );
      if (dist <= hitRadius) {
        const dmg = 15;
        animal.takeDamage(dmg);
        animal.fleeFrom(this.player.x, this.player.y, this.detector);
        GameAudio.playHurt();
        this.emitWoodChips(animal.position.x, animal.position.y, "#f43f5e");
        this.addFloatingText(
          `-${dmg}`,
          animal.position.x,
          animal.position.y - 0.6,
          "#ef4444",
        );
        this.useActiveToolDurability();
        return true;
      }
    }

    // 2. Check Hostile Enemies in facing hit cone
    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;
      const dist = Math.hypot(hitX - enemy.x, hitY - enemy.y);
      if (dist <= hitRadius + 0.2) {
        this.attackEnemy(enemy);
        return true;
      }
    }

    // 3. Check Harvestable Resources (Trees, Rocks, Bushes, Crops)
    const resource = this.worldManager.getResourceAt(hitX, hitY, hitRadius);
    if (resource && !resource.isDepleted) {
      this.harvestResource(resource);
      return true;
    }

    return false;
  }

  /**
   * Handles player click on world position (wx, wy).
   * Strikes living creatures, resources, structures, or falls back to directional hit.
   */
  public handleWorldClick(wx: number, wy: number) {
    if (this.player.isDead) return;

    // Face towards the clicked point smoothly
    const dx = wx - this.player.x;
    const dy = wy - this.player.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      this.player.facing = dx < 0 ? "LEFT" : "RIGHT";
      this.player.direction = dx < 0 ? "LEFT" : "RIGHT";
    } else {
      this.player.direction = dy < 0 ? "UP" : "DOWN";
    }

    this.player.swingTimer = 0.25;
    GameAudio.playSwing();

    const activeSlot = this.getActiveItemSlot();
    const activeItem = activeSlot?.item || "";

    // Fishing Rod interaction on water
    if (activeItem === "fishing_rod") {
      const clickTile = this.worldManager.getTile(
        Math.floor(wx),
        Math.floor(wy),
      );
      if (clickTile.isWater) {
        this.player.fishingState = "CASTING";
        this.player.fishingTimer = 1.4;
        this.addFloatingText(
          "Casting line... 🎣",
          this.player.x,
          this.player.y - 1,
          "#67e8f9",
        );
        return;
      }
    }

    // Watering Can
    if (activeItem === "watering_can") {
      this.player.swingTimer = 0.35;
      this.addFloatingText("Watering soil 💧", wx, wy, "#60a5fa");
      this.useActiveToolDurability();
      return;
    }

    // Shovel / Digging
    if (activeItem.includes("shovel")) {
      this.player.swingTimer = 0.35;
      this.emitWoodChips(wx, wy, "#a16207");
      this.addFloatingText("Tilling earth 🪴", wx, wy, "#d97706");
      this.useActiveToolDurability();
      return;
    }

    // Hammer
    if (activeItem.includes("hammer")) {
      this.player.swingTimer = 0.35;
      GameAudio.playCraft();
      this.addFloatingText("Hammering 🔨", wx, wy, "#f59e0b");
      this.useActiveToolDurability();
      return;
    }

    // 1. Check if clicking on an animal within interaction reach -> hits and sprints away!
    for (const animal of this.animals) {
      if (!animal.isActive || animal.behaviorState === "DEAD") continue;
      const dist = Math.hypot(wx - animal.position.x, wy - animal.position.y);
      const playerDist = Math.hypot(
        this.player.x - animal.position.x,
        this.player.y - animal.position.y,
      );
      if (dist < 1.3 && playerDist <= 3.2) {
        const dmg = 15;
        animal.takeDamage(dmg);
        animal.fleeFrom(this.player.x, this.player.y, this.detector);
        GameAudio.playHurt();
        this.emitWoodChips(animal.position.x, animal.position.y, "#f43f5e");
        this.addFloatingText(
          `-${dmg}`,
          animal.position.x,
          animal.position.y - 0.6,
          "#ef4444",
        );
        this.useActiveToolDurability();
        return;
      }
    }

    // 2. Check if clicking on an enemy in combat
    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;
      const dist = Math.hypot(wx - enemy.x, wy - enemy.y);
      if (
        dist < 1.4 &&
        Math.hypot(this.player.x - enemy.x, this.player.y - enemy.y) < 3.2
      ) {
        this.attackEnemy(enemy);
        return;
      }
    }

    // 3. Check if clicking on a resource node (tree, rock, bush, crop)
    const resource = this.worldManager.getResourceAt(wx, wy, 1.4);
    if (resource && !resource.isDepleted) {
      const playerDist = Math.hypot(
        this.player.x - resource.x,
        this.player.y - resource.y,
      );
      if (playerDist <= 3.2) {
        this.harvestResource(resource);
        return;
      }
    }

    // 4. Check if clicking on a placed chest or door
    for (const struct of this.placedStructures) {
      if (Math.hypot(wx - struct.x, wy - struct.y) < 1.2) {
        if (struct.type === "chest") {
          this.activeChest = struct;
          return;
        } else if (struct.type === "wood_door") {
          struct.isOpen = !struct.isOpen;
          GameAudio.playBuild();
          return;
        }
      }
    }

    // 5. Directional swing in front of player
    this.performDirectionalHit();
  }

  /**
   * Attacks enemy with active weapon/tool.
   */
  private attackEnemy(enemy: EnemyEntity) {
    const activeSlot = this.getActiveItemSlot();
    const activeItemDef = activeSlot?.item
      ? ITEM_CATALOG[activeSlot.item]
      : null;

    const baseDamage = activeItemDef?.damage || 6;
    const finalDamage = Math.round(baseDamage * (0.9 + Math.random() * 0.2));

    enemy.health -= finalDamage;
    enemy.hurtTimer = 0.25;
    GameAudio.playHurt();
    this.addFloatingText(`-${finalDamage}`, enemy.x, enemy.y - 0.5, "#ef4444");

    // Reduce tool durability
    this.useActiveToolDurability();

    // Knockback
    const angle = Math.atan2(enemy.y - this.player.y, enemy.x - this.player.x);
    enemy.x += Math.cos(angle) * 0.6;
    enemy.y += Math.sin(angle) * 0.6;

    if (enemy.health <= 0) {
      enemy.isAlive = false;
      this.addFloatingText("Defeated!", enemy.x, enemy.y - 0.7, "#fbbf24");

      // Spawn loot drops
      if (enemy.type === "slime") {
        this.spawnDroppedItem(
          "slime_gel",
          Math.floor(1 + Math.random() * 2),
          enemy.x,
          enemy.y,
        );
      } else {
        this.spawnDroppedItem("raw_meat", 1, enemy.x, enemy.y);
        if (Math.random() < 0.5)
          this.spawnDroppedItem("iron_ore", 1, enemy.x, enemy.y);
      }
    }
  }

  /**
   * Harvests tree, rock, bush, or crop and generates dropped item pickups.
   * Ensures crops have a finite harvest yield (not unlimited).
   */
  private harvestResource(res: ResourceNode) {
    if (res.isDepleted) return;

    const activeSlot = this.getActiveItemSlot();
    const activeItemDef = activeSlot?.item
      ? ITEM_CATALOG[activeSlot.item]
      : null;

    let power = 5;
    if (activeItemDef?.gatherType === "wood" && res.type === "tree") {
      power = activeItemDef.gatherPower || 12;
    } else if (
      activeItemDef?.gatherType === "stone" &&
      (res.type === "rock" || res.type === "iron_rock")
    ) {
      power = activeItemDef.gatherPower || 12;
    }

    res.health -= power;
    res.shakeTimer = 0.2;

    if (res.type === "tree") {
      GameAudio.playChop();
      this.emitWoodChips(res.x, res.y, "#a16207");
    } else if (res.type === "rock" || res.type === "iron_rock") {
      GameAudio.playMine();
      this.emitWoodChips(res.x, res.y, "#94a3b8");
    } else {
      GameAudio.playPickup();
    }

    this.useActiveToolDurability();

    if (res.health <= 0) {
      res.isDepleted = true;

      if (res.type === "crop") {
        // Finite harvest: single wheat yield + chance of seeds
        this.spawnDroppedItem(
          "wheat",
          1 + Math.floor(Math.random() * 2),
          res.x,
          res.y,
        );
        if (Math.random() < 0.5) {
          this.spawnDroppedItem("seeds", 1, res.x + 0.2, res.y);
        }
      } else if (res.type === "tree") {
        const count = 3 + Math.floor(Math.random() * 3);
        this.spawnDroppedItem(res.lootItem, count, res.x, res.y);
        if (res.secondaryLoot && Math.random() < 0.55) {
          this.spawnDroppedItem(res.secondaryLoot, 1, res.x + 0.3, res.y);
        }
      } else {
        const count = 2 + Math.floor(Math.random() * 2);
        this.spawnDroppedItem(res.lootItem, count, res.x, res.y);
        if (res.secondaryLoot && Math.random() < 0.55) {
          this.spawnDroppedItem(res.secondaryLoot, 1, res.x + 0.3, res.y);
        }
      }

      // Unblock all tiles if obstacle was cleared
      for (let dy = 0; dy < res.h; dy++) {
        for (let dx = 0; dx < res.w; dx++) {
          const tile = this.worldManager.getTile(
            Math.floor(res.x + dx),
            Math.floor(res.y + dy),
          );
          tile.isBlocked = false;
        }
      }
    }
  }

  private useActiveToolDurability() {
    const slot = this.getActiveItemSlot();
    if (slot && slot.durability !== undefined) {
      slot.durability -= 1;
      if (slot.durability <= 0) {
        GameAudio.playHurt();
        this.addFloatingText(
          "Tool Broke!",
          this.player.x,
          this.player.y - 0.8,
          "#f87171",
        );
        slot.item = null;
        slot.count = 0;
        slot.durability = undefined;
      }
    }
  }

  /**
   * Spawns dropped item entity into the world.
   */
  public spawnDroppedItem(item: ItemId, count: number, x: number, y: number) {
    this.droppedItems.push({
      id: this.nextItemId++,
      item,
      count,
      x: x + (Math.random() * 0.4 - 0.2),
      y: y + (Math.random() * 0.4 - 0.2),
      bobTimer: Math.random() * Math.PI,
    });
  }

  /**
   * Interacts with nearby entities: pets animals or talks to village NPCs [E].
   */
  public handleInteractKey() {
    // 1. Check for nearby NPC to talk to
    for (const npc of this.npcs) {
      const dist = Math.hypot(
        this.player.x - npc.position.x,
        this.player.y - npc.position.y,
      );
      if (dist < 2.4) {
        this.activeDialogueNPC = npc;
        GameAudio.playHeartChime();
        return;
      }
    }

    // 2. Check for nearby animal to pet
    for (const animal of this.animals) {
      const dist = Math.hypot(
        this.player.x - animal.position.x,
        this.player.y - animal.position.y,
      );
      if (dist < 2.2) {
        if (animal.pet()) {
          this.player.hopTimer = 0.35; // Player hops! (Section 24)
          GameAudio.playHeartChime();
          this.emitHeart(animal.position.x, animal.position.y - 0.5);
          this.addFloatingText(
            "♥ Loved!",
            animal.position.x,
            animal.position.y - 0.8,
            "#f43f5e",
          );
          this.updateQuestProgress("pet_animal", 1);
          return;
        }
      }
    }
  }

  /**
   * Feeds nearby animal using seeds, wheat, or berries from hotbar [F].
   */
  public handleFeedKey() {
    for (const animal of this.animals) {
      const dist = Math.hypot(
        this.player.x - animal.position.x,
        this.player.y - animal.position.y,
      );
      if (dist < 2.2) {
        // Check if player has food in hotbar/inventory
        const foodItems: ItemId[] = ["wheat", "seeds", "berries", "apple"];
        for (const food of foodItems) {
          if (this.hasItem(food, 1)) {
            this.removeItem(food, 1);
            animal.feed();
            GameAudio.playHeartChime();
            this.emitHeart(animal.position.x, animal.position.y - 0.5);
            this.addFloatingText(
              "Fed +♥",
              animal.position.x,
              animal.position.y - 0.8,
              "#10b981",
            );
            return;
          }
        }
        this.addFloatingText(
          "Need food in inventory!",
          this.player.x,
          this.player.y - 0.8,
          "#f59e0b",
        );
        return;
      }
    }
  }

  /**
   * Eats currently selected food item from active hotbar.
   */
  public eatActiveFood() {
    const slot = this.getActiveItemSlot();
    if (!slot || !slot.item) return;

    const def = ITEM_CATALOG[slot.item];
    if (def.category === "food" && def.hungerRestore) {
      this.player.hunger = Math.min(
        this.player.maxHunger,
        this.player.hunger + def.hungerRestore,
      );
      if (def.healthRestore) {
        this.player.health = Math.min(
          this.player.maxHealth,
          this.player.health + def.healthRestore,
        );
      }
      GameAudio.playEat();
      this.addFloatingText(
        `+${def.hungerRestore} Hunger`,
        this.player.x,
        this.player.y - 0.8,
        "#10b981",
      );

      slot.count -= 1;
      if (slot.count <= 0) slot.item = null;
    }
  }

  /**
   * Crafts an item from recipe if ingredients are available.
   */
  public craftRecipe(recipe: Recipe): boolean {
    // Check ingredients
    for (const ing of recipe.ingredients) {
      if (!this.hasItem(ing.item, ing.count)) return false;
    }

    // Check station proximity if required
    if (recipe.requiresStation) {
      if (!this.isNearStation(recipe.requiresStation)) {
        this.addFloatingText(
          `Requires nearby ${recipe.requiresStation}!`,
          this.player.x,
          this.player.y - 0.8,
          "#f59e0b",
        );
        return false;
      }
    }

    // Deduct ingredients
    for (const ing of recipe.ingredients) {
      this.removeItem(ing.item, ing.count);
    }

    // Add crafted result
    const def = ITEM_CATALOG[recipe.result];
    this.player.doingTimer = 0.6;
    this.addItemToInventory(
      recipe.result,
      recipe.count,
      def.durability,
      def.maxDurability,
    );
    GameAudio.playCraft();
    this.addFloatingText(
      `Crafted: ${def.name}`,
      this.player.x,
      this.player.y - 0.8,
      "#a855f7",
    );

    if (recipe.result === "wooden_axe")
      this.updateQuestProgress("craft_axe", 1);
    if (recipe.result === "campfire")
      this.updateQuestProgress("build_campfire", 1);

    return true;
  }

  public isNearStation(station: "workbench" | "campfire"): boolean {
    for (const struct of this.placedStructures) {
      if (struct.type === station) {
        if (
          Math.hypot(this.player.x - struct.x, this.player.y - struct.y) <= 4.0
        ) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Places structure at world coordinate (wx, wy) during build mode.
   */
  public placeStructure(pieceId: ItemId, wx: number, wy: number): boolean {
    const tileX = Math.round(wx);
    const tileY = Math.round(wy);

    const tile = this.worldManager.getTile(tileX, tileY);
    if (tile.isWater || tile.isBlocked) {
      this.addFloatingText("Cannot build here!", tileX, tileY, "#ef4444");
      return false;
    }

    if (!this.hasItem(pieceId, 1)) return false;

    this.removeItem(pieceId, 1);

    const structType = pieceId as PlacedStructure["type"];
    const struct: PlacedStructure = {
      id: this.nextEntityId++,
      type: structType,
      x: tileX,
      y: tileY,
      w: 1,
      h: 1,
      chestStorage:
        structType === "chest"
          ? Array.from({ length: 16 }, () => ({ item: null, count: 0 }))
          : undefined,
    };

    this.placedStructures.push(struct);
    tile.isBlocked =
      structType === "wood_wall" ||
      structType === "chest" ||
      structType === "workbench";
    GameAudio.playBuild();
    this.addFloatingText(
      `Placed ${ITEM_CATALOG[pieceId]?.name}`,
      tileX,
      tileY - 0.5,
      "#22c55e",
    );

    if (pieceId === "campfire") this.updateQuestProgress("build_campfire", 1);

    return true;
  }

  private damagePlayer(amount: number, source: string) {
    this.player.health = Math.max(0, this.player.health - amount);
    this.player.hurtTimer = 0.45;
    GameAudio.playHurt();
    this.addFloatingText(
      `-${amount} HP`,
      this.player.x,
      this.player.y - 0.6,
      "#ef4444",
    );

    if (this.player.health <= 0) {
      this.player.isDead = true;
      this.addFloatingText(
        `Fallen to ${source}`,
        this.player.x,
        this.player.y - 1.0,
        "#dc2626",
      );
    }
  }

  public respawnPlayer() {
    this.player.health = this.player.maxHealth;
    this.player.hunger = this.player.maxHunger;
    this.player.stamina = this.player.maxStamina;
    this.player.isDead = false;
    this.player.x = 22;
    this.player.y = 18;
  }

  // ═══════════════════════════════════════════════════════════════════
  // INVENTORY HELPERS
  // ═══════════════════════════════════════════════════════════════════

  public getActiveItemSlot(): InventorySlot | null {
    return this.hotbar[this.activeHotbarIndex] || null;
  }

  public addItemToInventory(
    item: ItemId,
    count: number,
    durability?: number,
    maxDurability?: number,
  ): boolean {
    const def = ITEM_CATALOG[item];
    if (!def) return false;

    // Requirement: only tools that have their animation in the Human folder can be picked in inventory
    if (def.category === "tool" || def.category === "weapon") {
      const allowedToolKeywords = [
        "axe",
        "pickaxe",
        "sword",
        "shovel",
        "hoe",
        "water",
        "hammer",
        "rod",
      ];
      const isAllowed = allowedToolKeywords.some((kw) =>
        item.toLowerCase().includes(kw),
      );
      if (!isAllowed) {
        return false;
      }
    }

    const maxStack = def?.maxStack || 99;

    // 1. Try stacking into existing hotbar or inventory slots
    const allSlots = [...this.hotbar, ...this.inventory];
    for (const slot of allSlots) {
      if (slot.item === item && slot.count < maxStack) {
        const canAdd = Math.min(count, maxStack - slot.count);
        slot.count += canAdd;
        count -= canAdd;
        if (count <= 0) return true;
      }
    }

    // 2. Put remainder into first empty slot (prefer hotbar)
    for (const slot of this.hotbar) {
      if (!slot.item) {
        slot.item = item;
        slot.count = count;
        slot.durability = durability;
        slot.maxDurability = maxDurability;
        return true;
      }
    }

    for (const slot of this.inventory) {
      if (!slot.item) {
        slot.item = item;
        slot.count = count;
        slot.durability = durability;
        slot.maxDurability = maxDurability;
        return true;
      }
    }

    return false; // Inventory full
  }

  public hasItem(item: ItemId, count = 1): boolean {
    let total = 0;
    for (const s of [...this.hotbar, ...this.inventory]) {
      if (s.item === item) total += s.count;
    }
    return total >= count;
  }

  public removeItem(item: ItemId, count: number) {
    let needed = count;
    for (const s of [...this.hotbar, ...this.inventory]) {
      if (s.item === item) {
        const take = Math.min(needed, s.count);
        s.count -= take;
        needed -= take;
        if (s.count <= 0) s.item = null;
        if (needed <= 0) return;
      }
    }
  }

  private updateQuestProgress(questId: string, amount: number) {
    const q = this.quests.find((quest) => quest.id === questId);
    if (q && !q.completed) {
      q.progress = Math.min(q.goal, q.progress + amount);
      if (q.progress >= q.goal) {
        q.completed = true;
        GameAudio.playCraft();
        this.addFloatingText(
          `★ Quest Complete: ${q.title}!`,
          this.player.x,
          this.player.y - 1.2,
          "#facc15",
        );
      }
    }
  }

  private completeQuest(questId: string) {
    const q = this.quests.find((quest) => quest.id === questId);
    if (q && !q.completed) {
      q.completed = true;
      q.progress = q.goal;
      GameAudio.playCraft();
      this.addFloatingText(
        `★ Quest Complete: ${q.title}!`,
        this.player.x,
        this.player.y - 1.2,
        "#facc15",
      );
    }
  }

  private emitHeart(x: number, y: number) {
    for (let i = 0; i < 4; i++) {
      this.particles.push({
        id: this.nextParticleId++,
        x: x + (Math.random() * 0.4 - 0.2),
        y: y + (Math.random() * 0.2 - 0.1),
        vx: (Math.random() - 0.5) * 0.8,
        vy: -1.2 - Math.random() * 0.6,
        alpha: 1,
        scale: 1,
        life: 1.4,
        maxLife: 1.4,
        color: "#f43f5e",
        wobbleSpeed: 4,
        wobbleAmp: 0.3,
      });
    }
  }

  private emitWoodChips(x: number, y: number, color: string) {
    for (let i = 0; i < 6; i++) {
      this.woodChips.push({
        id: this.nextParticleId++,
        x,
        y,
        vx: (Math.random() - 0.5) * 3,
        vy: -2 - Math.random() * 2,
        color,
        size: 3 + Math.random() * 2,
        life: 0.5,
        maxLife: 0.5,
      });
    }
  }

  public addFloatingText(
    text: string,
    x: number,
    y: number,
    color = "#ffffff",
  ) {
    this.floatingTexts.push({
      id: this.nextParticleId++,
      text,
      x,
      y,
      color,
      life: 1.2,
      maxLife: 1.2,
    });
  }
}
