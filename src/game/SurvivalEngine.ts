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
  FootstepVFX,
  AmbientBird,
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

  // 11 Crops & Harvested Produce:
  cabbage: {
    id: "cabbage",
    name: "Spring Cabbage",
    category: "food",
    description: "Fresh leafy cabbage harvested in spring.",
    icon: "🥬",
    spritePath: "/assets/crops/cabbage_05.png",
    maxStack: 50,
    hungerRestore: 20,
    healthRestore: 6,
  },
  carrot: {
    id: "carrot",
    name: "Sweet Carrot",
    category: "food",
    description: "Crunchy sweet carrot harvested from spring soil.",
    icon: "🥕",
    spritePath: "/assets/crops/carrot_05.png",
    maxStack: 50,
    hungerRestore: 20,
    healthRestore: 8,
  },
  parsnip: {
    id: "parsnip",
    name: "Earthy Parsnip",
    category: "food",
    description: "Hearty root vegetable grown in spring.",
    icon: "🥔",
    spritePath: "/assets/crops/parsnip_05.png",
    maxStack: 50,
    hungerRestore: 22,
    healthRestore: 8,
  },
  radish: {
    id: "radish",
    name: "Red Radish",
    category: "food",
    description: "Crisp peppery radish from spring plots.",
    icon: "🥗",
    spritePath: "/assets/crops/radish_05.png",
    maxStack: 50,
    hungerRestore: 18,
    healthRestore: 5,
  },
  sunflower: {
    id: "sunflower",
    name: "Summer Sunflower",
    category: "resource",
    description: "Tall bright sunflower blooming in summer heat.",
    icon: "🌻",
    spritePath: "/assets/crops/sunflower_05.png",
    maxStack: 50,
    hungerRestore: 15,
  },
  cauliflower: {
    id: "cauliflower",
    name: "Summer Cauliflower",
    category: "food",
    description: "Dense white cauliflower head grown in summer.",
    icon: "🥦",
    spritePath: "/assets/crops/cauliflower_05.png",
    maxStack: 50,
    hungerRestore: 28,
    healthRestore: 12,
  },
  pumpkin: {
    id: "pumpkin",
    name: "Autumn Pumpkin",
    category: "food",
    description: "Large ripe pumpkin harvested in crisp autumn.",
    icon: "🎃",
    spritePath: "/assets/crops/pumpkin_05.png",
    maxStack: 30,
    hungerRestore: 35,
    healthRestore: 15,
  },
  beetroot: {
    id: "beetroot",
    name: "Autumn Beetroot",
    category: "food",
    description: "Deep red earthy beet from autumn farms.",
    icon: "🍠",
    spritePath: "/assets/crops/beetroot_05.png",
    maxStack: 50,
    hungerRestore: 22,
    healthRestore: 8,
  },
  kale: {
    id: "kale",
    name: "Autumn Kale",
    category: "food",
    description: "Hearty dark green kale resistant to frost.",
    icon: "🥬",
    spritePath: "/assets/crops/kale_05.png",
    maxStack: 50,
    hungerRestore: 20,
    healthRestore: 8,
  },
  potato: {
    id: "potato",
    name: "Starchy Potato",
    category: "food",
    description: "Filling starchy potato harvested in autumn.",
    icon: "🥔",
    spritePath: "/assets/crops/potato_05.png",
    maxStack: 50,
    hungerRestore: 25,
    healthRestore: 10,
  },

  // Bakery, Flour & Economy:
  flour: {
    id: "flour",
    name: "Bag of Flour",
    category: "resource",
    description: "Finely ground wheat flour from the village windmill.",
    icon: "🌾",
    spritePath: "/assets/crops/soil_00.png",
    maxStack: 50,
  },
  fresh_bread: {
    id: "fresh_bread",
    name: "Warm Oven Bread",
    category: "food",
    description: "Golden crust bread fresh from the stone oven. Restores 50 hunger and grants Stamina Surge buff.",
    icon: "🍞",
    spritePath: "/assets/crops/soil_01.png",
    maxStack: 30,
    hungerRestore: 50,
    healthRestore: 25,
  },

  // Animal Products & Tools:
  milk: {
    id: "milk",
    name: "Fresh Milk",
    category: "food",
    description: "Cool creamy milk fresh from dairy cows.",
    icon: "🥛",
    spritePath: "/assets/crops/milk.png",
    maxStack: 20,
    hungerRestore: 30,
    healthRestore: 20,
  },
  egg: {
    id: "egg",
    name: "Farm Egg",
    category: "food",
    description: "Farm fresh egg laid by village chickens.",
    icon: "🥚",
    spritePath: "/assets/crops/egg.png",
    maxStack: 40,
    hungerRestore: 15,
    healthRestore: 5,
  },
  wool: {
    id: "wool",
    name: "Soft Sheep Wool",
    category: "resource",
    description: "Warm sheared wool for weaving cloth and beds.",
    icon: "🧶",
    spritePath: "/assets/crops/soil_00.png",
    maxStack: 50,
  },
  shears: {
    id: "shears",
    name: "Iron Shears",
    category: "tool",
    description: "Used to gently shear wool from adult sheep.",
    icon: "✂️",
    spritePath: "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/axe.png",
    maxStack: 1,
    durability: 50,
    maxDurability: 50,
  },
  bucket: {
    id: "bucket",
    name: "Empty Bucket",
    category: "tool",
    description: "Used to milk cows or fetch river water.",
    icon: "🪣",
    spritePath: "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/water.png",
    maxStack: 5,
  },
  water_bucket: {
    id: "water_bucket",
    name: "Water Bucket",
    category: "tool",
    description: "Clean water bucket for dough mixing and hydration.",
    icon: "🚰",
    spritePath: "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/water.png",
    maxStack: 5,
  },

  // Farming & Shipping:
  fertilizer: {
    id: "fertilizer",
    name: "Organic Fertilizer",
    category: "survival",
    description: "Made from wood ash and fish bones. Advances crops by 2 growth stages.",
    icon: "✨",
    spritePath: "/assets/crops/soil_04.png",
    maxStack: 50,
  },
  wood_ash: {
    id: "wood_ash",
    name: "Wood Ash",
    category: "resource",
    description: "Combustion byproduct from ovens and campfires.",
    icon: "🌫️",
    spritePath: "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/rock.png",
    maxStack: 99,
  },
  fish_bones: {
    id: "fish_bones",
    name: "Fish Bones",
    category: "resource",
    description: "Calcium-rich bones left after enjoying fresh fish.",
    icon: "🦴",
    spritePath: "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/fish.png",
    maxStack: 99,
  },
  crate_wood: {
    id: "crate_wood",
    name: "Empty Wooden Crate",
    category: "building",
    description: "Sturdy crate crafted to pack bulk crops for village export.",
    icon: "📦",
    spritePath: "/assets/crops/crate_base.png",
    maxStack: 20,
    isPlaceable: true,
  },
  crate_bulk_crops: {
    id: "crate_bulk_crops",
    name: "Packed Crop Crate",
    category: "resource",
    description: "Packed crate with 10x harvest produce. Sells to village merchants for gold coins.",
    icon: "🎁",
    spritePath: "/assets/crops/crate_top.png",
    maxStack: 10,
  },

  // Alchemy & Foraging:
  blue_mushroom: {
    id: "blue_mushroom",
    name: "Mystic Blue Mushroom",
    category: "resource",
    description: "Glows with celestial blue light in shaded forest groves.",
    icon: "🍄",
    spritePath: "/public/assets/plants/spr_deco_mushroom_blue_01_strip4.png",
    maxStack: 50,
  },
  red_mushroom: {
    id: "red_mushroom",
    name: "Crimson Red Mushroom",
    category: "resource",
    description: "Vibrant red mushroom with potent alchemical enzymes.",
    icon: "🍄",
    spritePath: "/public/assets/plants/spr_deco_mushroom_red_01_strip4.png",
    maxStack: 50,
  },
  blue_potion: {
    id: "blue_potion",
    name: "Astral Stamina Elixir",
    category: "survival",
    description: "Brewed from blue mushrooms. Grants Infinite Stamina and Night Vision for 3 minutes.",
    icon: "🧪",
    spritePath: "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/itemdisc_02.png",
    maxStack: 10,
  },
  potion_stamina: {
    id: "potion_stamina",
    name: "Astral Stamina Elixir",
    category: "survival",
    description: "Brewed from blue mushrooms. Grants Infinite Stamina and Night Vision for 3 minutes.",
    icon: "🧪",
    spritePath: "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/itemdisc_02.png",
    maxStack: 10,
  },
  red_potion: {
    id: "red_potion",
    name: "Berserker Tonic",
    category: "survival",
    description: "Brewed from red mushrooms. Grants +15 Attack Damage and Rapid Health Regeneration for 2 minutes.",
    icon: "🧪",
    spritePath: "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/itemdisc_01.png",
    maxStack: 10,
  },
  potion_berserker: {
    id: "potion_berserker",
    name: "Berserker Tonic",
    category: "survival",
    description: "Brewed from red mushrooms. Grants +15 Attack Damage and Rapid Health Regeneration for 2 minutes.",
    icon: "🧪",
    spritePath: "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/itemdisc_01.png",
    maxStack: 10,
  },
  mushroom_blue: {
    id: "mushroom_blue",
    name: "Blue Forest Mushroom",
    category: "resource",
    description: "Luminescent glowing mushroom found in shaded old-growth forests. Used for stamina alchemy.",
    icon: "🍄",
    spritePath: "/public/assets/plants/spr_deco_mushroom_blue_01_strip4.png",
    maxStack: 20,
  },
  mushroom_red: {
    id: "mushroom_red",
    name: "Crimson Forest Mushroom",
    category: "resource",
    description: "Potent crimson mushroom found in dense canopy forests. Used for berserker combat alchemy.",
    icon: "🍄",
    spritePath: "/public/assets/plants/spr_deco_mushroom_red_01_strip4.png",
    maxStack: 20,
  },
  coracle: {
    id: "coracle",
    name: "Coracle Boat",
    category: "station",
    description: "Lightweight woven boat to cross deep oceans, reach offshore islands, and fish.",
    icon: "🛶",
    spritePath: "/public/assets/other/spr_deco_coracle_land.png",
    maxStack: 2,
    isPlaceable: true,
  },

  // Boating & Navigation:
  coracle_boat: {
    id: "coracle_boat",
    name: "Coracle Boat",
    category: "station",
    description: "Lightweight woven boat to cross deep oceans, reach offshore islands, and fish.",
    icon: "🛶",
    spritePath: "/public/assets/other/spr_deco_coracle_land.png",
    maxStack: 2,
    isPlaceable: true,
  },

  // Advanced Building & Economy:
  stone_oven: {
    id: "stone_oven",
    name: "Stone Baking Oven",
    category: "station",
    description: "Combines flour, water, and fire to bake wholesome bread.",
    icon: "🏛️",
    spritePath: "/assets/crops/rock.png",
    maxStack: 5,
    isPlaceable: true,
  },
  windmill_kit: {
    id: "windmill_kit",
    name: "Windmill Kit",
    category: "station",
    description: "Large mechanical windmill to grind grain into flour.",
    icon: "🌬️",
    spritePath: "/public/assets/other/spr_deco_windmill_strip9.png",
    maxStack: 2,
    isPlaceable: true,
  },
  brewing_stand: {
    id: "brewing_stand",
    name: "Alchemy Brewing Stand",
    category: "station",
    description: "Brews powerful potions from forest mushrooms.",
    icon: "⚗️",
    spritePath: "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/itemdisc_02.png",
    maxStack: 5,
    isPlaceable: true,
  },
  chimney: {
    id: "chimney",
    name: "Stone Chimney",
    category: "building",
    description: "Rooftop chimney emitting realistic drifting hearth smoke.",
    icon: "🏭",
    spritePath: "/assets/crops/rock.png",
    maxStack: 10,
    isPlaceable: true,
  },
  wall_window: {
    id: "wall_window",
    name: "Windowed Wall",
    category: "building",
    description: "Timber wall segment with sunlit glass window.",
    icon: "🪟",
    spritePath: "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/itemdisc_01.png",
    maxStack: 50,
    isPlaceable: true,
  },
  stone_wall: {
    id: "stone_wall",
    name: "Masonry Stone Wall",
    category: "building",
    description: "Heavy fortified stone wall providing superior defense.",
    icon: "🧱",
    spritePath: "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/rock.png",
    maxStack: 50,
    isPlaceable: true,
  },
  stone_floor: {
    id: "stone_floor",
    name: "Flagstone Floor",
    category: "building",
    description: "Smooth stone paved floor for sturdy interiors.",
    icon: "🪨",
    spritePath: "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/rock.png",
    maxStack: 50,
    isPlaceable: true,
  },
  roof_wood: {
    id: "roof_wood",
    name: "Sloped Wooden Roof",
    category: "building",
    description: "Sloped rooftop overhang completing house enclosures.",
    icon: "🏠",
    spritePath: "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/wood.png",
    maxStack: 50,
    isPlaceable: true,
  },
  bed: {
    id: "bed",
    name: "Comfortable Wool Bed",
    category: "building",
    description: "Soft bed to rest and sleep through the dark night until 06:00.",
    icon: "🛏️",
    spritePath: "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/itemdisc_01.png",
    maxStack: 5,
    isPlaceable: true,
  },
  gold_coin: {
    id: "gold_coin",
    name: "Realm Gold Coin",
    category: "resource",
    description: "Standard currency accepted across all village settlements and traders.",
    icon: "🪙",
    spritePath: "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/itemdisc_01.png",
    maxStack: 999,
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
    id: "fertilizer",
    name: "Organic Fertilizer",
    result: "fertilizer",
    count: 2,
    ingredients: [
      { item: "wood_ash", count: 1 },
      { item: "fish_bones", count: 1 },
    ],
    category: "survival",
  },
  {
    id: "crate_wood",
    name: "Empty Wooden Crate",
    result: "crate_wood",
    count: 1,
    ingredients: [{ item: "wood", count: 4 }],
    requiresStation: "workbench",
    category: "building",
  },
  {
    id: "coracle_boat",
    name: "Coracle Boat",
    result: "coracle_boat",
    count: 1,
    ingredients: [
      { item: "wood", count: 8 },
      { item: "fiber", count: 6 },
    ],
    requiresStation: "workbench",
    category: "survival",
  },
  {
    id: "stone_oven",
    name: "Stone Baking Oven",
    result: "stone_oven",
    count: 1,
    ingredients: [
      { item: "stone", count: 12 },
      { item: "coal", count: 4 },
      { item: "iron_ingot", count: 1 },
    ],
    requiresStation: "workbench",
    category: "building",
  },
  {
    id: "windmill_kit",
    name: "Windmill Kit",
    result: "windmill_kit",
    count: 1,
    ingredients: [
      { item: "wood", count: 20 },
      { item: "stone", count: 10 },
      { item: "wool", count: 4 },
    ],
    requiresStation: "workbench",
    category: "building",
  },
  {
    id: "brewing_stand",
    name: "Alchemy Brewing Stand",
    result: "brewing_stand",
    count: 1,
    ingredients: [
      { item: "stone", count: 6 },
      { item: "iron_ingot", count: 2 },
      { item: "wood", count: 2 },
    ],
    requiresStation: "workbench",
    category: "building",
  },
  {
    id: "bed",
    name: "Woolen Bed",
    result: "bed",
    count: 1,
    ingredients: [
      { item: "wood", count: 6 },
      { item: "wool", count: 3 },
    ],
    requiresStation: "workbench",
    category: "building",
  },
  {
    id: "shears",
    name: "Iron Shears",
    result: "shears",
    count: 1,
    ingredients: [{ item: "iron_ingot", count: 2 }],
    requiresStation: "workbench",
    category: "tools",
  },
  {
    id: "bucket",
    name: "Iron Bucket",
    result: "bucket",
    count: 1,
    ingredients: [{ item: "iron_ingot", count: 3 }],
    requiresStation: "workbench",
    category: "tools",
  },
  {
    id: "chimney",
    name: "Stone Chimney",
    result: "chimney",
    count: 1,
    ingredients: [{ item: "stone", count: 6 }],
    category: "building",
  },
  {
    id: "wall_window",
    name: "Windowed Wall",
    result: "wall_window",
    count: 1,
    ingredients: [
      { item: "wood", count: 3 },
      { item: "stick", count: 2 },
    ],
    category: "building",
  },
  {
    id: "stone_wall",
    name: "Masonry Stone Wall",
    result: "stone_wall",
    count: 2,
    ingredients: [{ item: "stone", count: 4 }],
    category: "building",
  },
  {
    id: "stone_floor",
    name: "Flagstone Floor (x2)",
    result: "stone_floor",
    count: 2,
    ingredients: [{ item: "stone", count: 2 }],
    category: "building",
  },
  {
    id: "roof_wood",
    name: "Sloped Wooden Roof",
    result: "roof_wood",
    count: 1,
    ingredients: [{ item: "wood", count: 3 }],
    category: "building",
  },
  {
    id: "fresh_bread",
    name: "Warm Oven Bread",
    result: "fresh_bread",
    count: 2,
    ingredients: [
      { item: "flour", count: 2 },
      { item: "water_bucket", count: 1 },
      { item: "wood", count: 1 },
    ],
    requiresStation: "workbench",
    category: "survival",
  },
  {
    id: "blue_potion",
    name: "Astral Stamina Elixir",
    result: "blue_potion",
    count: 1,
    ingredients: [
      { item: "blue_mushroom", count: 1 },
      { item: "water_bucket", count: 1 },
    ],
    requiresStation: "workbench",
    category: "survival",
  },
  {
    id: "red_potion",
    name: "Berserker Tonic",
    result: "red_potion",
    count: 1,
    ingredients: [
      { item: "red_mushroom", count: 1 },
      { item: "water_bucket", count: 1 },
    ],
    requiresStation: "workbench",
    category: "survival",
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
  {
    id: "fertilizer",
    name: "Organic Fertilizer",
    result: "fertilizer",
    count: 2,
    ingredients: [
      { item: "wood_ash", count: 1 },
      { item: "fish_bones", count: 1 },
    ],
    category: "survival",
  },
  {
    id: "crate_wood",
    name: "Empty Wooden Crate",
    result: "crate_wood",
    count: 1,
    ingredients: [{ item: "wood", count: 4 }],
    requiresStation: "workbench",
    category: "building",
  },
  {
    id: "coracle_boat",
    name: "Coracle Boat",
    result: "coracle_boat",
    count: 1,
    ingredients: [
      { item: "wood", count: 8 },
      { item: "fiber", count: 6 },
    ],
    requiresStation: "workbench",
    category: "survival",
  },
  {
    id: "stone_oven",
    name: "Stone Baking Oven",
    result: "stone_oven",
    count: 1,
    ingredients: [
      { item: "stone", count: 12 },
      { item: "coal", count: 4 },
      { item: "iron_ingot", count: 1 },
    ],
    requiresStation: "workbench",
    category: "building",
  },
  {
    id: "windmill_kit",
    name: "Windmill Kit",
    result: "windmill_kit",
    count: 1,
    ingredients: [
      { item: "wood", count: 20 },
      { item: "stone", count: 10 },
      { item: "wool", count: 4 },
    ],
    requiresStation: "workbench",
    category: "building",
  },
  {
    id: "brewing_stand",
    name: "Alchemy Brewing Stand",
    result: "brewing_stand",
    count: 1,
    ingredients: [
      { item: "stone", count: 6 },
      { item: "iron_ingot", count: 2 },
      { item: "wood", count: 2 },
    ],
    requiresStation: "workbench",
    category: "building",
  },
  {
    id: "bed",
    name: "Woolen Bed",
    result: "bed",
    count: 1,
    ingredients: [
      { item: "wood", count: 6 },
      { item: "wool", count: 3 },
    ],
    requiresStation: "workbench",
    category: "building",
  },
  {
    id: "shears",
    name: "Iron Shears",
    result: "shears",
    count: 1,
    ingredients: [{ item: "iron_ingot", count: 2 }],
    requiresStation: "workbench",
    category: "tools",
  },
  {
    id: "bucket",
    name: "Iron Bucket",
    result: "bucket",
    count: 1,
    ingredients: [{ item: "iron_ingot", count: 3 }],
    requiresStation: "workbench",
    category: "tools",
  },
  {
    id: "chimney",
    name: "Stone Chimney",
    result: "chimney",
    count: 1,
    ingredients: [{ item: "stone", count: 6 }],
    category: "building",
  },
  {
    id: "wall_window",
    name: "Windowed Wall",
    result: "wall_window",
    count: 1,
    ingredients: [
      { item: "wood", count: 3 },
      { item: "stick", count: 2 },
    ],
    category: "building",
  },
  {
    id: "stone_wall",
    name: "Masonry Stone Wall",
    result: "stone_wall",
    count: 2,
    ingredients: [{ item: "stone", count: 4 }],
    category: "building",
  },
  {
    id: "stone_floor",
    name: "Flagstone Floor (x2)",
    result: "stone_floor",
    count: 2,
    ingredients: [{ item: "stone", count: 2 }],
    category: "building",
  },
  {
    id: "roof_wood",
    name: "Sloped Wooden Roof",
    result: "roof_wood",
    count: 1,
    ingredients: [{ item: "wood", count: 3 }],
    category: "building",
  },
  {
    id: "fresh_bread",
    name: "Warm Oven Bread",
    result: "fresh_bread",
    count: 2,
    ingredients: [
      { item: "flour", count: 2 },
      { item: "water_bucket", count: 1 },
      { item: "wood", count: 1 },
    ],
    requiresStation: "workbench",
    category: "survival",
  },
  {
    id: "blue_potion",
    name: "Astral Stamina Elixir",
    result: "blue_potion",
    count: 1,
    ingredients: [
      { item: "blue_mushroom", count: 1 },
      { item: "water_bucket", count: 1 },
    ],
    requiresStation: "workbench",
    category: "survival",
  },
  {
    id: "red_potion",
    name: "Berserker Tonic",
    result: "red_potion",
    count: 1,
    ingredients: [
      { item: "red_mushroom", count: 1 },
      { item: "water_bucket", count: 1 },
    ],
    requiresStation: "workbench",
    category: "survival",
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
    doingTimer: number;
    fishingState: "NONE" | "CASTING" | "REELING" | "CAUGHT";
    fishingTimer: number;
    isBlocking: boolean;
    isMountedBoat?: boolean;
    mountedBoatId?: string | number;
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
  public footstepParticles: FootstepVFX[] = [];
  public ambientBirds: AmbientBird[] = [];
  public floatingTexts: FloatingText[] = [];
  public remotePlayers: any[] = [];
  public sessionId: string = "";
  public onWorldAction?: (action: any) => void;

  // Juicy Micro-Feel & Screen Shake
  public footstepTimer: number = 0;
  public screenShakeTimer: number = 0;
  public screenShakeIntensity: number = 0;
  public screenShakeX: number = 0;
  public screenShakeY: number = 0;
  public hitStopTimer: number = 0;

  // Day / Night World Clock
  public worldTime: WorldTime = {
    totalSeconds: 120, // start at mid-morning
    timeOfDay: "Day",
    hour: 8,
    minute: 30,
    dayNumber: 1,
    lightLevel: 1.0,
    season: "Spring",
    seasonDay: 1,
  };
  public showJournal: boolean = false;
  public activeJournalTab: "ALMANAC" | "ANGLER" | "QUESTS" = "ALMANAC";
  public midnightInvasionSpawnedDay: number = -1;

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

  private nextEntityId = 10000;
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
    const spawnX = 55;
    const spawnY = 44;
    this.worldManager.updatePlayerLocation(spawnX, spawnY);

    const startVillage = this.worldManager.villages[0]?.data;
    const startVillageX = this.worldManager.villages[0]?.gridX ?? 0;
    const startVillageY = this.worldManager.villages[0]?.gridY ?? 0;
    this.detector = new EnvironmentDetector(startVillage, startVillageX, startVillageY, this.worldManager);

    this.player = {
      x: spawnX,
      y: spawnY,
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
      doingTimer: 0,
      fishingState: "NONE",
      fishingTimer: 0,
      isBlocking: false,
      isMountedBoat: false,
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


    // ── PHASE 10: Player Initialization & Playable Game Ready ──
    if (maxPhase >= 10) {
      console.log("[LIFECYCLE PHASE 10: World Playable] Player inventory and survival equipment initialized. Ready to play!");
      this.initInventory();
    }

    this.spawnAmbientBirds();
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

    const village = this.worldManager.villages[0];
    if (village) {
      newNpcs.forEach((npc, idx) => {
        npc.happiness = 95;
        npc.scheduleState = "WORK";
        npc.workstation = {
          x: village.gridX + 16 + (idx % 2) * 2,
          y: village.gridY + 12 + Math.floor(idx / 2) * 2,
          type: idx === 0 ? "windmill" : idx === 1 ? "oven" : "farm",
        };
        npc.bedLocation = {
          x: village.gridX + 6 + (idx % 3),
          y: village.gridY + 6 + Math.floor(idx / 3),
        };
      });
    }

    this.npcs.push(...newNpcs);
    this.nextEntityId = this.lifeformSpawner.getNextEntityId();
    this.spawnInitialVillageStructures();
  }

  private spawnInitialVillageStructures() {
    const village = this.worldManager.villages[0];
    if (!village) return;

    const vx = village.gridX;
    const vy = village.gridY;

    // Find a clear 3x3 grass knoll for the village windmill that does not overlap farm crops, roads, or water
    let wmX = vx + 16;
    let wmY = vy + 12;
    let foundSpot = false;

    for (let r = 4; r < 45 && !foundSpot; r += 2) {
      for (let dy = -r; dy <= r && !foundSpot; dy += 2) {
        for (let dx = -r; dx <= r && !foundSpot; dx += 2) {
          const candX = vx + 35 + dx;
          const candY = vy + 30 + dy;
          let valid = true;
          for (let sy = 0; sy < 3; sy++) {
            for (let sx = 0; sx < 3; sx++) {
              const tile = this.worldManager.getTile(candX + sx, candY + sy);
              if (tile.isWater || tile.isFarm || tile.isRoad || tile.isBlocked) {
                valid = false;
                break;
              }
            }
            if (!valid) break;
          }
          if (valid) {
            wmX = candX;
            wmY = candY;
            foundSpot = true;
          }
        }
      }
    }

    // 1. Windmill placed safely on grassy knoll overlooking fields
    this.placedStructures.push({
      id: "village_windmill_01",
      type: "windmill",
      x: wmX,
      y: wmY,
      w: 3,
      h: 3,
      health: 500,
      maxHealth: 500,
      isOperating: false,
      frameTimer: 0,
    });
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
   * Main game tick update loop (dt in seconds, ~0.016 for 60 FPS).
   */
  public update(dt: number) {
    if (this.player.isDead) return;

    // 0. Hit Stop (40ms impact pause on strikes/combat for satisfying physical weight)
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      return;
    }

    // 0b. Screen Shake Decay
    if (this.screenShakeTimer > 0) {
      this.screenShakeTimer -= dt;
      const decay = Math.max(0, this.screenShakeTimer / 0.16);
      this.screenShakeX = (Math.random() - 0.5) * 2 * this.screenShakeIntensity * decay;
      this.screenShakeY = (Math.random() - 0.5) * 2 * this.screenShakeIntensity * decay;
    } else {
      this.screenShakeX = 0;
      this.screenShakeY = 0;
    }

    // 1. Advance World Clock (8 minutes = 480 seconds per full 24h cycle)
    this.updateWorldTime(dt);

    if (this.isWorldGenMode) {
      this.worldManager.updatePlayerLocation(this.player.x, this.player.y);
      this.updateLifeforms(dt);
      return;
    }

    // 2. Player Movement & Physics
    this.updatePlayerMovement(dt);

    // 2b. Physically Reactive Flora (rustle + leaf flakes when entities brush past)
    this.updateFloraReactions(dt);

    // 2c. Ambient Wildlife / Birds Behavior
    this.updateAmbientBirds(dt);

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

    for (const struct of this.placedStructures) {
      if (struct.shakeTimer && struct.shakeTimer > 0) {
        struct.shakeTimer = Math.max(0, struct.shakeTimer - dt);
      }
    }

    // 9. Periodic Spawning (Wildlife)
    this.lifeformSpawner.setNextEntityId(this.nextEntityId);
    const periodicAnimals: Animal[] = [];
    this.lifeformSpawner.handlePeriodicSpawns(
      dt,
      this.player.x,
      this.player.y,
      this.animals.length,
      periodicAnimals
    );
    this.nextEntityId = this.lifeformSpawner.getNextEntityId();

    // 10. Placed Structure Economy (Windmills & Stone Ovens)
    this.updateStructureEconomy(dt);

    // 11. Animal Husbandry & Breeding
    this.updateAnimalHusbandry(dt);

    // 12. Villager Daily Schedules & Expressions
    this.updateVillagerSchedules(dt);
  }

  private updateStructureEconomy(dt: number) {
    for (const struct of this.placedStructures) {
      if (struct.type === "windmill") {
        if (struct.isOperating) {
          struct.productionTimer = (struct.productionTimer || 4.0) - dt;
          if (struct.productionTimer <= 0) {
            struct.isOperating = false;
            this.spawnDroppedItem("flour", 2, struct.x + 1.5, struct.y + struct.h + 0.5);
            this.addFloatingText("+2 Bags of Flour!", struct.x + 1.5, struct.y, "#22c55e");
            this.updateQuestProgress("deliver_wheat", 1);
            GameAudio.playPickup();
          }
        }
      } else if (struct.type === "stone_oven") {
        if (struct.isOperating) {
          struct.productionTimer = (struct.productionTimer || 5.0) - dt;
          if (struct.productionTimer <= 0) {
            struct.isOperating = false;
            this.spawnDroppedItem("fresh_bread", 2, struct.x + 1, struct.y + struct.h + 0.5);
            this.addFloatingText("+2 Loaves of Fresh Bread!", struct.x + 1, struct.y, "#22c55e");
            this.updateQuestProgress("bake_bread", 2);
            GameAudio.playPickup();
          }
        }
      }
    }
  }

  private updateAnimalHusbandry(dt: number) {
    // 1. Decay timers
    for (const animal of this.animals) {
      if ((animal as any).loveTimer && (animal as any).loveTimer > 0) {
        (animal as any).loveTimer = Math.max(0, (animal as any).loveTimer - dt);
      }
      if ((animal as any).isBaby && (animal as any).growthTimer) {
        (animal as any).growthTimer -= dt;
        if ((animal as any).growthTimer <= 0) {
          (animal as any).isBaby = false;
          this.addFloatingText("Baby grew into mature adult!", animal.position.x, animal.position.y - 0.8, "#10b981");
        }
      }
    }

    // 2. Pairwise breeding
    for (let i = 0; i < this.animals.length; i++) {
      const a1 = this.animals[i];
      if ((a1 as any).isBaby || !((a1 as any).loveTimer > 0)) continue;

      for (let j = i + 1; j < this.animals.length; j++) {
        const a2 = this.animals[j];
        if ((a2 as any).isBaby || !((a2 as any).loveTimer > 0)) continue;
        if (a1.config.name !== a2.config.name) continue;

        const dist = Math.hypot(a1.position.x - a2.position.x, a1.position.y - a2.position.y);
        if (dist < 2.5) {
          (a1 as any).loveTimer = 0;
          (a2 as any).loveTimer = 0;
          const babyX = (a1.position.x + a2.position.x) / 2;
          const babyY = (a1.position.y + a2.position.y) / 2;

          this.lifeformSpawner.setNextEntityId(this.nextEntityId);
          const baby = new Animal(this.nextEntityId++, (a1 as any).config, babyX, babyY);
          (baby as any).isBaby = true;
          (baby as any).growthTimer = 80;
          this.animals.push(baby);

          this.emitHeart(babyX, babyY - 0.5);
          this.addFloatingText("Baby Animal Born! ♥", babyX, babyY - 0.8, "#f43f5e");
          GameAudio.playHeartChime();
          break;
        }
      }
    }
  }

  private updateVillagerSchedules(_dt: number) {
    const hr = this.worldTime.hour;
    let targetSchedule: "SLEEP" | "WORK" | "STROLL" = "WORK";
    if (hr >= 21 || hr < 6) {
      targetSchedule = "SLEEP";
    } else if (hr >= 6 && hr < 18) {
      targetSchedule = "WORK";
    } else {
      targetSchedule = "STROLL";
    }

    for (const npc of this.npcs) {
      (npc as any).scheduleState = targetSchedule;
      if (targetSchedule === "SLEEP") {
        (npc as any).currentExpression = undefined;
      } else {
        if (Math.random() < 0.003) {
          (npc as any).currentExpression = "chat";
        }
      }
    }
  }

  private spawnMidnightSkeletonInvasion() {
    this.addFloatingText("Midnight Fog creeps in... Skeletons Awaken!", this.player.x, this.player.y - 1.5, "#9333ea");
    GameAudio.playHurt();

    const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    angles.forEach((ang, idx) => {
      const ex = this.player.x + Math.cos(ang) * 14;
      const ey = this.player.y + Math.sin(ang) * 14;
      this.enemies.push({
        id: `skeleton_raid_${this.worldTime.dayNumber}_${idx}`,
        type: "skeleton",
        subType: "NIGHT_RAID",
        x: ex,
        y: ey,
        health: 40,
        maxHealth: 40,
        attackPower: 12,
        speed: 1.8,
        state: "CHASE",
        stateTimer: 10,
        direction: "DOWN",
        facing: "DOWN",
      } as any);
    });
  }

  public toggleJournalModal() {
    this.showJournal = !this.showJournal;
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

    // 4-Season Cycle (7 in-game days per season)
    const seasonIdx = Math.floor((this.worldTime.dayNumber - 1) / 7) % 4;
    (this.worldTime as any).season = ["Spring", "Summer", "Autumn", "Winter"][seasonIdx];

    // Midnight Skeleton Invasion trigger
    if (this.worldTime.hour === 0 && this.worldTime.minute < 5 && this.midnightInvasionSpawnedDay !== this.worldTime.dayNumber) {
      this.midnightInvasionSpawnedDay = this.worldTime.dayNumber;
      this.spawnMidnightSkeletonInvasion();
    }

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

    // Smooth movement with beveled diagonal corner sliding
    if (this.canMoveTo(nextX, nextY)) {
      this.player.x = nextX;
      this.player.y = nextY;
    } else {
      let moved = false;
      // Primary axis sliding
      if (this.canMoveTo(nextX, this.player.y)) {
        this.player.x = nextX;
        moved = true;
      }
      if (this.canMoveTo(this.player.x, nextY)) {
        this.player.y = nextY;
        moved = true;
      }

      // Beveled corner sliding: deflect along collision normals if stuck on obstacle corners
      if (!moved && (this.player.vx !== 0 || this.player.vy !== 0)) {
        const bevelOffset = 0.08;
        if (this.player.vx !== 0) {
          if (this.canMoveTo(nextX, this.player.y + bevelOffset)) {
            this.player.x = nextX;
            this.player.y += bevelOffset;
          } else if (this.canMoveTo(nextX, this.player.y - bevelOffset)) {
            this.player.x = nextX;
            this.player.y -= bevelOffset;
          }
        } else if (this.player.vy !== 0) {
          if (this.canMoveTo(this.player.x + bevelOffset, nextY)) {
            this.player.x += bevelOffset;
            this.player.y = nextY;
          } else if (this.canMoveTo(this.player.x - bevelOffset, nextY)) {
            this.player.x -= bevelOffset;
            this.player.y = nextY;
          }
        }
      }
    }

    // Surface-aware footsteps and particle FX
    if (this.player.vx !== 0 || this.player.vy !== 0) {
      this.footstepTimer -= dt;
      if (this.footstepTimer <= 0) {
        this.footstepTimer = this.player.isSprinting ? 0.22 : 0.35;
        const curTile = this.worldManager.getTile(
          Math.floor(this.player.x + 0.5),
          Math.floor(this.player.y + 0.65),
        );
        let surface: "grass" | "dirt" | "sand" | "water" | "wood" = "grass";
        if (this.player.isSwimming || curTile.isWater) {
          surface = "water";
        } else if (
          this.placedStructures.some(
            (s) =>
              s.type === "wood_floor" &&
              Math.abs(this.player.x + 0.5 - (s.x + 0.5)) < 0.5 &&
              Math.abs(this.player.y + 0.65 - (s.y + 0.5)) < 0.5,
          )
        ) {
          surface = "wood";
        } else if (
          curTile.isRoad ||
          curTile.terrain.startsWith("sand") ||
          curTile.terrain.startsWith("path") ||
          curTile.terrain.startsWith("dirt")
        ) {
          surface = curTile.terrain.startsWith("sand") ? "sand" : "dirt";
        }

        GameAudio.playFootstep(surface);
        this.emitFootstepVFX(
          surface,
          this.player.x + 0.5,
          this.player.y + 0.68,
        );
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
    if (this.worldManager.isBlockedByFence(footX, footY)) return false;
    if (this.isBlockedByRemotePlayer(footX, footY)) return false;
    return true;
  }

  private isBlockedByRemotePlayer(footX: number, footY: number): boolean {
    if (!this.remotePlayers || this.remotePlayers.length === 0) return false;
    const curFootX = this.player.x + 0.5;
    const curFootY = this.player.y + 0.65;
    for (const rp of this.remotePlayers) {
      if (rp.isDead || rp.health <= 0) continue;
      const rpFootX = rp.x + 0.5;
      const rpFootY = rp.y + 0.65;
      const targetDist = Math.hypot(footX - rpFootX, footY - rpFootY);
      if (targetDist < 0.65) {
        const curDist = Math.hypot(curFootX - rpFootX, curFootY - rpFootY);
        // If moving closer while within collision radius, block movement
        if (targetDist < curDist) {
          return true;
        }
      }
    }
    return false;
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
            const itemId = item.id;
            this.removeDroppedItem(itemId, false);

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
  public updateLifeforms(dt: number) {
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

      animal.updateAI(dt, this.detector, this.worldTime, this.worldManager);
      animal.updateMovement(dt, this.detector);

      // REQUIREMENT: Animals must NEVER be inside houses
      if (this.worldManager.villages) {
        for (const v of this.worldManager.villages) {
          if (v.data?.houses) {
            for (const h of v.data.houses) {
              const hx = v.gridX + h.x;
              const hy = v.gridY + h.y;
              if (
                animal.position.x >= hx - 0.2 &&
                animal.position.x < hx + h.footprintW + 0.2 &&
                animal.position.y >= hy - 0.2 &&
                animal.position.y < hy + h.footprintH + 0.2
              ) {
                // Eject animal safely outside the house onto the pathway or village green
                animal.position.x = hx + (h.door?.x ?? Math.floor(h.footprintW / 2)) + 0.5;
                animal.position.y = hy + (h.door?.y ?? h.footprintH) + 3.0;
                animal.movement.wanderOriginX = animal.position.x;
                animal.movement.wanderOriginY = animal.position.y;
                animal.clearTarget();
                break;
              }
            }
          }
        }
      }
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
      npc.updateAI(dt, this.detector, this.worldTime, this.worldManager);
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

    // 2b. Footstep ground VFX & water ripples
    for (let i = this.footstepParticles.length - 1; i >= 0; i--) {
      const p = this.footstepParticles[i];
      if (p.type === "ripple") {
        p.radius += dt * 18;
        p.alpha -= dt * 1.8;
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 4.5 * dt; // slight gravity
        p.alpha -= dt * 2.2;
      }
      if (p.alpha <= 0) {
        this.footstepParticles.splice(i, 1);
      }
    }

    // 3. Floating Damage / Info Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const t = this.floatingTexts[i];
      t.life -= dt;
      t.y -= 0.6 * dt; // float upwards
      if (t.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  /**
   * Triggers micro-screen shake & 40ms hit stop for weighted, punchy impacts.
   */
  public triggerImpactJuice(intensity = 2.5, hitStopSeconds = 0.04) {
    this.screenShakeTimer = 0.16;
    this.screenShakeIntensity = intensity;
    this.hitStopTimer = hitStopSeconds;
  }

  /**
   * Spawns ground footstep particles (turf flakes, dust puffs, water ripples).
   */
  public emitFootstepVFX(
    surface: "grass" | "dirt" | "sand" | "water" | "wood",
    x: number,
    y: number,
  ) {
    if (surface === "water") {
      this.footstepParticles.push({
        id: this.nextParticleId++,
        x,
        y,
        type: "ripple",
        radius: 2,
        maxRadius: 10,
        alpha: 0.85,
        vx: 0,
        vy: 0,
        color: "rgba(186, 230, 253, 0.7)",
      });
    } else if (surface === "grass") {
      for (let i = 0; i < 2; i++) {
        this.footstepParticles.push({
          id: this.nextParticleId++,
          x: x + (Math.random() - 0.5) * 0.3,
          y: y + (Math.random() - 0.5) * 0.1,
          type: "turf",
          radius: 1.5,
          maxRadius: 2.2,
          alpha: 0.8,
          vx: (Math.random() - 0.5) * 1.2,
          vy: -0.7 - Math.random() * 0.7,
          color: "#4ade80",
        });
      }
    } else if (surface === "dirt" || surface === "sand") {
      for (let i = 0; i < 2; i++) {
        this.footstepParticles.push({
          id: this.nextParticleId++,
          x: x + (Math.random() - 0.5) * 0.25,
          y: y + (Math.random() - 0.5) * 0.1,
          type: "dust",
          radius: 2,
          maxRadius: 3.8,
          alpha: 0.65,
          vx: (Math.random() - 0.5) * 0.9,
          vy: -0.6 - Math.random() * 0.6,
          color: surface === "sand" ? "#fde68a" : "#d97706",
        });
      }
    } else {
      // Wood floor tap
      this.footstepParticles.push({
        id: this.nextParticleId++,
        x,
        y,
        type: "wood",
        radius: 1.5,
        maxRadius: 2,
        alpha: 0.6,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -0.5,
        color: "#b45309",
      });
    }
  }

  /**
   * Initializes ambient perched birds in the starting village.
   */
  public spawnAmbientBirds() {
    this.ambientBirds = [];
    const birdColors = ["#38bdf8", "#fb923c", "#facc15", "#a78bfa"];
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const dist = 6 + (i % 4) * 3;
      this.ambientBirds.push({
        id: this.nextEntityId++,
        x: 22 + Math.cos(angle) * dist,
        y: 18 + Math.sin(angle) * dist,
        isFlying: false,
        flyTimer: 0,
        vx: 0,
        vy: 0,
        wingAngle: 0,
        color: birdColors[i % birdColors.length],
      });
    }
  }

  /**
   * Checks entities walking near flora (bushes/crops) and triggers rustle + leaf flakes.
   */
  private updateFloraReactions(dt: number) {
    const testPositions = [{ x: this.player.x + 0.5, y: this.player.y + 0.65 }];
    if (this.remotePlayers) {
      for (const rp of this.remotePlayers) {
        testPositions.push({ x: rp.x + 0.5, y: rp.y + 0.65 });
      }
    }

    const pcx = Math.floor(this.player.x / 16);
    const pcy = Math.floor(this.player.y / 16);

    for (let dcy = -1; dcy <= 1; dcy++) {
      for (let dcx = -1; dcx <= 1; dcx++) {
        const chunk = this.worldManager.chunks.get(`${pcx + dcx},${pcy + dcy}`);
        if (!chunk) continue;

        for (const res of chunk.resources) {
          if (res.isDepleted) continue;
          if (res.type === "bush" || res.type === "crop") {
            const rx = res.x + res.w / 2;
            const ry = res.y + res.h / 2;

            let isNearAny = false;
            for (const pos of testPositions) {
              if (Math.hypot(pos.x - rx, pos.y - ry) < 0.75) {
                isNearAny = true;
                break;
              }
            }

            // Brush reaction triggers only once upon entering/brushing the flora
            if (isNearAny) {
              if (!(res as any).isBrushed) {
                (res as any).isBrushed = true;
                res.shakeTimer = 0.35;
                GameAudio.playRustle();
                for (let k = 0; k < 2; k++) {
                  this.footstepParticles.push({
                    id: this.nextParticleId++,
                    x: rx + (Math.random() - 0.5) * 0.4,
                    y: ry + (Math.random() - 0.5) * 0.4,
                    type: "turf",
                    radius: 2,
                    maxRadius: 3,
                    alpha: 0.9,
                    vx: (Math.random() - 0.5) * 1.5,
                    vy: -1.2 - Math.random() * 1.2,
                    color: "#4ade80",
                  });
                }
              }
            } else {
              // Reset brushed state once all entities have walked away
              (res as any).isBrushed = false;
            }
          }
          if (res.shakeTimer && res.shakeTimer > 0) {
            res.shakeTimer -= dt;
          }
        }
      }
    }
  }

  /**
   * Updates ambient birds: take flight when entity approaches.
   */
  private updateAmbientBirds(dt: number) {
    for (let i = this.ambientBirds.length - 1; i >= 0; i--) {
      const b = this.ambientBirds[i];
      if (b.isFlying) {
        b.flyTimer -= dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.wingAngle = Math.sin(Date.now() / 60) * 0.8;
        if (b.flyTimer <= 0) {
          this.ambientBirds.splice(i, 1);
        }
      } else {
        const dist = Math.hypot(
          this.player.x + 0.5 - b.x,
          this.player.y + 0.65 - b.y,
        );
        if (dist < 2.2) {
          b.isFlying = true;
          b.flyTimer = 3.5;
          b.vx =
            (b.x >= this.player.x ? 1 : -1) * (2.2 + Math.random() * 1.5);
          b.vy = -2.6 - Math.random() * 1.5;
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // PLAYER ACTIONS (GATHERING, ATTACK, CRAFTING, BUILDING, PETTING)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Universal Player Hit & PVP Damage Synchronization
   */
  public hitPlayer(
    targetId: string,
    damage: number,
    attackerX: number,
    attackerY: number,
    isRemote = false,
  ): boolean {
    const isLocal =
      targetId === "local" ||
      (this.sessionId && this.sessionId === targetId) ||
      (typeof window !== "undefined" && (window as any).networkClient?.clientId === targetId);

    if (isLocal) {
      if (this.player.isDead) return false;
      const isBlocking = Boolean(this.player.isBlocking);
      const effectiveDmg = isBlocking ? Math.max(1, Math.round(damage * 0.15)) : damage;

      if (isBlocking) {
        GameAudio.playCraft();
        this.emitWoodChips(this.player.x + 0.5, this.player.y + 0.65, "#38bdf8");
        this.addFloatingText("🛡️ Blocked!", this.player.x + 0.5, this.player.y - 0.6, "#38bdf8");
        this.triggerImpactJuice(1.8, 0.03);
      } else {
        GameAudio.playHurt();
        this.player.hurtTimer = 0.45;
        this.emitWoodChips(this.player.x + 0.5, this.player.y + 0.65, "#ef4444");
        this.addFloatingText(`-${effectiveDmg} HP`, this.player.x + 0.5, this.player.y - 0.6, "#ef4444");
        this.triggerImpactJuice(3.2, 0.04);
      }

      this.player.health = Math.max(0, this.player.health - effectiveDmg);
      if (this.player.health <= 0) {
        this.player.isDead = true;
        this.addFloatingText("Defeated in battle!", this.player.x + 0.5, this.player.y - 1.0, "#dc2626");
      }

      // Knockback
      const kbDist = isBlocking ? 0.15 : 0.45;
      const angle = Math.atan2(this.player.y - attackerY, this.player.x - attackerX);
      const kbX = this.player.x + Math.cos(angle) * kbDist;
      const kbY = this.player.y + Math.sin(angle) * kbDist;
      if (this.canMoveTo(kbX, kbY)) {
        this.player.x = kbX;
        this.player.y = kbY;
      }

      if (!isRemote && this.onWorldAction) {
        this.onWorldAction({
          type: "hit-player",
          targetId,
          damage,
          attackerX,
          attackerY,
        });
      }
      return true;
    }

    // Remote player target
    const rp = this.remotePlayers.find((p: any) => p.id === targetId || p.sessionId === targetId);
    if (!rp || rp.isDead) return false;

    const isBlocking = Boolean(rp.isBlocking);
    const effectiveDmg = isBlocking ? Math.max(1, Math.round(damage * 0.15)) : damage;

    if (isBlocking) {
      GameAudio.playCraft();
      this.emitWoodChips(rp.x + 0.5, rp.y + 0.65, "#38bdf8");
      this.addFloatingText("🛡️ Blocked!", rp.x + 0.5, rp.y - 0.6, "#38bdf8");
      this.triggerImpactJuice(1.8, 0.03);
    } else {
      GameAudio.playHurt();
      rp.hurtTimer = 0.45;
      this.emitWoodChips(rp.x + 0.5, rp.y + 0.65, "#ef4444");
      this.addFloatingText(`-${effectiveDmg} HP`, rp.x + 0.5, rp.y - 0.6, "#ef4444");
      this.triggerImpactJuice(3.0, 0.04);
    }

    if (rp.health === undefined) rp.health = 100;
    rp.health = Math.max(0, rp.health - effectiveDmg);
    if (rp.health <= 0) {
      rp.isDead = true;
      this.addFloatingText("Defeated in battle!", rp.x + 0.5, rp.y - 1.0, "#dc2626");
    }

    // Knockback for remote player visually
    const kbDist = isBlocking ? 0.15 : 0.45;
    const angle = Math.atan2(rp.y - attackerY, rp.x - attackerX);
    rp.x += Math.cos(angle) * kbDist;
    rp.y += Math.sin(angle) * kbDist;

    this.useActiveToolDurability();

    if (!isRemote && this.onWorldAction) {
      this.onWorldAction({
        type: "hit-player",
        targetId,
        damage,
        attackerX,
        attackerY,
      });
    }
    return true;
  }

  /**
   * Universal Animal Hit & Damage Synchronization
   */
  public hitAnimal(
    animalId: number,
    damage: number,
    attackerX: number,
    attackerY: number,
    isRemote = false,
  ): boolean {
    const animal = this.animals.find((a) => a.id === animalId);
    if (!animal || !animal.isActive || animal.behaviorState === "DEAD") return false;

    animal.takeDamage(damage);
    animal.fleeFrom(attackerX, attackerY, this.detector);
    GameAudio.playHurt();
    this.triggerImpactJuice(2.2, 0.04);
    this.emitWoodChips(animal.position.x, animal.position.y, "#f43f5e");
    this.addFloatingText(
      `-${damage}`,
      animal.position.x,
      animal.position.y - 0.6,
      "#ef4444",
    );

    if (!isRemote) {
      this.useActiveToolDurability();
      this.onWorldAction?.({
        type: "hit-animal",
        animalId: animal.id,
        damage,
        attackerX,
        attackerY,
      });
    }

    if (animal.health <= 0) {
      animal.behaviorState = "DEAD";
      this.addFloatingText("Defeated!", animal.position.x, animal.position.y - 0.8, "#fbbf24");
      const isBird = animal.species === "duck" || animal.species === "chicken";
      this.spawnDroppedItem("raw_meat", 1 + (animal.species === "cow" ? 1 : 0), animal.position.x, animal.position.y);
      if (isBird) {
        this.spawnDroppedItem("feathers" as ItemId, 1, animal.position.x + 0.2, animal.position.y);
      } else if (animal.species === "cow" || animal.species === "deer") {
        this.spawnDroppedItem("leather" as ItemId, 1, animal.position.x + 0.2, animal.position.y);
      }
    }
    return true;
  }

  /**
   * Universal Resource Node Hit & Depletion Synchronization
   */
  public hitResource(
    resX: number,
    resY: number,
    power: number,
    activeItem: string | null = null,
    isRemote = false,
    resId?: number,
  ): boolean {
    let res: ResourceNode | null = null;
    if (resId !== undefined) {
      res = this.worldManager.getResourceById(resId);
    }
    if (!res) {
      res = this.worldManager.getResourceAt(resX, resY, 1.4);
    }
    if (!res || res.isDepleted) return false;

    res.health -= power;
    res.shakeTimer = 0.25;
    this.triggerImpactJuice(2.2, 0.04);

    if (res.type === "tree" || res.type.startsWith("tree_")) {
      GameAudio.playChop();
      this.emitWoodChips(res.x + res.w / 2, res.y + res.h / 2, "#a16207");
      this.addFloatingText(`-${power}`, res.x + res.w / 2, res.y - 0.4, "#f59e0b");
    } else if (res.type === "rock" || res.type === "iron_rock") {
      GameAudio.playMine();
      this.emitWoodChips(res.x + res.w / 2, res.y + res.h / 2, "#94a3b8");
      this.addFloatingText(`-${power}`, res.x + res.w / 2, res.y - 0.4, "#94a3b8");
    } else if (res.type === "bush") {
      GameAudio.playPickup();
      this.emitWoodChips(res.x + 0.5, res.y + 0.5, "#4ade80");
      this.addFloatingText(`-${power}`, res.x + 0.5, res.y - 0.4, "#4ade80");
    } else {
      GameAudio.playPickup();
      this.emitWoodChips(res.x + 0.5, res.y + 0.5, "#facc15");
      this.addFloatingText(`-${power}`, res.x + 0.5, res.y - 0.4, "#facc15");
    }

    if (!isRemote) {
      this.useActiveToolDurability();
      this.onWorldAction?.({
        type: "hit-resource",
        id: res.id,
        x: res.x,
        y: res.y,
        damage: power,
        tool: activeItem,
      });
    }

    if (res.health <= 0) {
      res.isDepleted = true;
      this.worldManager.markResourceDepleted(res.id);

      if (res.type === "crop") {
        this.spawnDroppedItem("wheat", 1 + Math.floor(Math.random() * 2), res.x + 0.5, res.y + 0.5);
        if (Math.random() < 0.5) this.spawnDroppedItem("seeds", 1, res.x + 0.7, res.y + 0.5);
      } else if (res.type === "tree" || res.type.startsWith("tree_")) {
        const count = 3 + Math.floor(Math.random() * 3);
        this.spawnDroppedItem(res.lootItem, count, res.x + 1.0, res.y + 1.0);
        if (res.secondaryLoot && Math.random() < 0.55) {
          this.spawnDroppedItem(res.secondaryLoot, 1, res.x + 1.3, res.y + 1.0);
        }
      } else {
        const count = 2 + Math.floor(Math.random() * 2);
        this.spawnDroppedItem(res.lootItem, count, res.x + 0.5, res.y + 0.5);
        if (res.secondaryLoot && Math.random() < 0.55) {
          this.spawnDroppedItem(res.secondaryLoot, 1, res.x + 0.7, res.y + 0.5);
        }
      }
    }
    return true;
  }

  /**
   * Universal Hostile Enemy Hit Synchronization
   */
  public hitEnemy(
    enemyId: number | string,
    damage: number,
    attackerX: number,
    attackerY: number,
    isRemote = false,
  ): boolean {
    const enemy = this.enemies.find((e) => e.id === enemyId);
    if (!enemy || !enemy.isAlive) return false;

    enemy.health -= damage;
    enemy.hurtTimer = 0.25;
    GameAudio.playHurt();
    this.triggerImpactJuice(3.0, 0.05);
    this.addFloatingText(`-${damage}`, enemy.x, enemy.y - 0.5, "#ef4444");

    const angle = Math.atan2(enemy.y - attackerY, enemy.x - attackerX);
    enemy.x += Math.cos(angle) * 0.6;
    enemy.y += Math.sin(angle) * 0.6;

    if (!isRemote) {
      this.useActiveToolDurability();
      this.onWorldAction?.({
        type: "hit-enemy",
        enemyId: enemy.id,
        damage,
        attackerX,
        attackerY,
      });
    }

    if (enemy.health <= 0) {
      enemy.isAlive = false;
      this.addFloatingText("Defeated!", enemy.x, enemy.y - 0.7, "#fbbf24");
      if (enemy.type === "slime") {
        this.spawnDroppedItem("slime_gel", Math.floor(1 + Math.random() * 2), enemy.x, enemy.y);
      } else {
        this.spawnDroppedItem("raw_meat", 1, enemy.x, enemy.y);
        if (Math.random() < 0.5) this.spawnDroppedItem("iron_ore", 1, enemy.x, enemy.y);
      }
    }
    return true;
  }

  /**
   * Universal Placed Structure Damage / Dismantling Synchronization
   */
  public hitStructure(
    structX: number,
    structY: number,
    damage: number,
    isRemote = false,
  ): boolean {
    const tileX = Math.round(structX);
    const tileY = Math.round(structY);
    const idx = this.placedStructures.findIndex((s) => s.x === tileX && s.y === tileY);
    if (idx < 0) return false;

    const struct = this.placedStructures[idx];
    if (struct.health === undefined) {
      struct.health = 25;
      struct.maxHealth = 25;
    }
    struct.health -= damage;
    struct.shakeTimer = 0.25;
    this.triggerImpactJuice(2.2, 0.03);

    GameAudio.playCraft();
    this.emitWoodChips(struct.x + 0.5, struct.y + 0.5, "#a16207");
    this.addFloatingText(`-${damage}`, struct.x + 0.5, struct.y - 0.4, "#f59e0b");

    if (!isRemote) {
      this.useActiveToolDurability();
      this.onWorldAction?.({
        type: "hit-structure",
        x: tileX,
        y: tileY,
        damage,
      });
    }

    if (struct.health <= 0) {
      this.placedStructures.splice(idx, 1);
      const tile = this.worldManager.getTile(tileX, tileY);
      tile.isBlocked = false;
      GameAudio.playHurt();
      this.addFloatingText("Dismantled!", tileX + 0.5, tileY - 0.5, "#f87171");
      this.spawnDroppedItem(struct.type as ItemId, 1, tileX + 0.5, tileY + 0.5);
    }
    return true;
  }

  /**
   * Universal Door State Toggle Synchronization
   */
  public toggleDoor(tileX: number, tileY: number, isRemote = false): boolean {
    tileX = Math.round(tileX);
    tileY = Math.round(tileY);
    const struct = this.placedStructures.find((s) => s.x === tileX && s.y === tileY && s.type === "wood_door");
    if (!struct) return false;
    struct.isOpen = !struct.isOpen;
    GameAudio.playBuild();
    if (!isRemote) {
      this.onWorldAction?.({
        type: "toggle-door",
        x: tileX,
        y: tileY,
        isOpen: struct.isOpen,
      });
    }
    return true;
  }

  /**
   * Performs an attack/hit in front of the player based on facing direction.
   */
  public performDirectionalHit(): boolean {
    if (this.player.isDead) return false;

    this.player.swingTimer = 0.25;
    GameAudio.playSwing();

    const playerCenterX = this.player.x + 0.5;
    const playerCenterY = this.player.y + 0.65;
    const reach = 0.95;
    let hitX = playerCenterX;
    let hitY = playerCenterY;
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

    const hitRadius = 1.4;
    const activeSlot = this.getActiveItemSlot();
    const activeItem = activeSlot?.item || "";
    const activeItemDef = activeSlot?.item ? ITEM_CATALOG[activeSlot.item] : null;

    // 0. Check Remote Players in facing hit cone
    for (const rp of this.remotePlayers) {
      if (rp.isDead || (rp.health !== undefined && rp.health <= 0)) continue;
      const rpCenterX = rp.x + 0.5;
      const rpCenterY = rp.y + 0.65;
      const dist = Math.hypot(hitX - rpCenterX, hitY - rpCenterY);
      const directDist = Math.hypot(playerCenterX - rpCenterX, playerCenterY - rpCenterY);
      const inFacingCone =
        (this.player.facing === "RIGHT" && rpCenterX >= playerCenterX) ||
        (this.player.facing === "LEFT" && rpCenterX <= playerCenterX) ||
        (this.player.direction === "DOWN" && rpCenterY >= playerCenterY) ||
        (this.player.direction === "UP" && rpCenterY <= playerCenterY);

      if (dist <= hitRadius || (directDist <= 2.1 && inFacingCone)) {
        const dmg = activeItemDef?.damage || (activeItem.includes("sword") ? 18 : activeItem.includes("axe") ? 12 : 8);
        this.hitPlayer(rp.id || rp.sessionId, dmg, this.player.x, this.player.y, false);
        return true;
      }
    }

    // 1. Check Living Animals in facing hit cone
    for (const animal of this.animals) {
      if (!animal.isActive || animal.behaviorState === "DEAD") continue;
      const animCenterX = animal.position.x + 0.5;
      const animCenterY = animal.position.y + 0.5;
      const dist = Math.hypot(hitX - animCenterX, hitY - animCenterY);
      if (dist <= hitRadius) {
        const dmg = activeItemDef?.damage || 15;
        this.hitAnimal(animal.id, dmg, this.player.x, this.player.y, false);
        return true;
      }
    }

    // 2. Check Hostile Enemies in facing hit cone
    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;
      const dist = Math.hypot(hitX - enemy.x, hitY - enemy.y);
      if (dist <= hitRadius + 0.2) {
        const dmg = activeItemDef?.damage || 6;
        this.hitEnemy(enemy.id, dmg, this.player.x, this.player.y, false);
        return true;
      }
    }

    // 3. Check Harvestable Resources (Trees, Rocks, Bushes, Crops)
    const resource = this.worldManager.getResourceAt(hitX, hitY, hitRadius);
    if (resource && !resource.isDepleted) {
      let power = 5;
      if (resource.type === "tree" || resource.type.startsWith("tree_")) {
        if (activeItemDef?.gatherType !== "wood") {
          this.addFloatingText("Needs Axe", resource.x, resource.y - 0.5, "#f87171");
          return true;
        }
        power = activeItemDef.gatherPower || 12;
      } else if (resource.type === "rock" || resource.type === "iron_rock") {
        if (activeItemDef?.gatherType !== "stone") {
          this.addFloatingText("Needs Pickaxe", resource.x, resource.y - 0.5, "#f87171");
          return true;
        }
        power = activeItemDef.gatherPower || 12;
      }
      this.hitResource(resource.x, resource.y, power, activeItem, false);
      return true;
    }

    // 4. Check Placed Structures in hit cone
    for (const struct of this.placedStructures) {
      const dist = Math.hypot(hitX - (struct.x + 0.5), hitY - (struct.y + 0.5));
      if (dist <= hitRadius) {
        if (activeItem.includes("hammer") || activeItem.includes("axe") || activeItem.includes("pickaxe")) {
          this.hitStructure(struct.x, struct.y, 10, false);
          return true;
        }
      }
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
    const activeItemDef = activeSlot?.item ? ITEM_CATALOG[activeSlot.item] : null;

    // Fishing Rod interaction on water
    if (activeItem === "fishing_rod") {
      const clickTile = this.worldManager.getTile(
        Math.floor(wx),
        Math.floor(wy),
      );
      if (clickTile.isWater) {
        this.player.fishingState = "CASTING";
        this.player.fishingTimer = 2.0;
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

    // 0. Check if clicking on another player within interaction reach
    for (const rp of this.remotePlayers) {
      if (rp.isDead || (rp.health !== undefined && rp.health <= 0)) continue;
      const dist = Math.hypot(wx - (rp.x + 0.5), wy - (rp.y + 0.65));
      const playerDist = Math.hypot(this.player.x - rp.x, this.player.y - rp.y);
      if (dist < 1.3 && playerDist <= 3.2) {
        const dmg = activeItemDef?.damage || (activeItem.includes("sword") ? 18 : activeItem.includes("axe") ? 12 : 8);
        this.hitPlayer(rp.id || rp.sessionId, dmg, this.player.x, this.player.y, false);
        return;
      }
    }

    // 1. Check if clicking on an animal within interaction reach
    for (const animal of this.animals) {
      if (!animal.isActive || animal.behaviorState === "DEAD") continue;
      const dist = Math.hypot(wx - animal.position.x, wy - animal.position.y);
      const playerDist = Math.hypot(
        this.player.x - animal.position.x,
        this.player.y - animal.position.y,
      );
      if (dist < 1.3 && playerDist <= 3.2) {
        const dmg = activeItemDef?.damage || 15;
        this.hitAnimal(animal.id, dmg, this.player.x, this.player.y, false);
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
        const dmg = activeItemDef?.damage || 6;
        this.hitEnemy(enemy.id, dmg, this.player.x, this.player.y, false);
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
        let power = 5;
        if (resource.type === "tree" || resource.type.startsWith("tree_")) {
          if (activeItemDef?.gatherType !== "wood") {
            this.addFloatingText("Needs Axe", resource.x, resource.y - 0.5, "#f87171");
            return;
          }
          power = activeItemDef.gatherPower || 12;
        } else if (resource.type === "rock" || resource.type === "iron_rock") {
          if (activeItemDef?.gatherType !== "stone") {
            this.addFloatingText("Needs Pickaxe", resource.x, resource.y - 0.5, "#f87171");
            return;
          }
          power = activeItemDef.gatherPower || 12;
        }
        this.hitResource(resource.x, resource.y, power, activeItem, false);
        return;
      }
    }

    // 4. Check if clicking on a placed chest, door, or structure
    for (const struct of this.placedStructures) {
      if (Math.hypot(wx - (struct.x + 0.5), wy - (struct.y + 0.5)) < 1.2) {
        if (struct.type === "chest") {
          this.activeChest = struct;
          return;
        } else if (struct.type === "wood_door") {
          this.toggleDoor(struct.x, struct.y, false);
          return;
        } else if (activeItem.includes("hammer") || activeItem.includes("axe") || activeItem.includes("pickaxe")) {
          this.hitStructure(struct.x, struct.y, 10, false);
          return;
        }
      }
    }

    // 5. Directional swing in front of player
    this.performDirectionalHit();
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
  public spawnDroppedItem(
    item: ItemId,
    count: number,
    x: number,
    y: number,
    id?: number,
    isRemote = false,
  ): DroppedItem {
    const dropped: DroppedItem = {
      id: id !== undefined ? id : this.nextItemId++,
      item,
      count,
      x: x + (Math.random() * 0.4 - 0.2),
      y: y + (Math.random() * 0.4 - 0.2),
      bobTimer: Math.random() * Math.PI,
    };
    this.droppedItems.push(dropped);
    if (!isRemote) {
      this.onWorldAction?.({
        type: "spawn-item",
        id: dropped.id,
        item: dropped.item,
        count: dropped.count,
        x: dropped.x,
        y: dropped.y,
      });
    }
    return dropped;
  }

  /**
   * Removes dropped item from world.
   */
  public removeDroppedItem(id: number, isRemote = false): boolean {
    const idx = this.droppedItems.findIndex((i) => i.id === id);
    if (idx >= 0) {
      this.droppedItems.splice(idx, 1);
      if (!isRemote) {
        this.onWorldAction?.({
          type: "pickup-item",
          id,
        });
      }
      return true;
    }
    return false;
  }

  /**
   * Interacts with nearby entities: structures, boats, animals, NPCs [E].
   */
  public handleInteractKey() {
    // 0. Coracle Boat Mount / Dismount
    if (this.player.isMountedBoat) {
      this.player.isMountedBoat = false;
      this.player.mountedBoatId = undefined;
      this.placedStructures.push({
        id: `boat_${Date.now()}`,
        type: "coracle",
        x: Math.round(this.player.x),
        y: Math.round(this.player.y),
        w: 1,
        h: 1,
      });
      this.addFloatingText("Dismounted Boat", this.player.x, this.player.y - 1, "#38bdf8");
      GameAudio.playPickup();
      return;
    }

    // Check for nearby coracle boat to mount
    for (let i = 0; i < this.placedStructures.length; i++) {
      const s = this.placedStructures[i];
      if (s.type === "coracle") {
        const dist = Math.hypot(this.player.x - (s.x + 0.5), this.player.y - (s.y + 0.5));
        if (dist < 2.0) {
          this.player.isMountedBoat = true;
          this.player.mountedBoatId = s.id;
          this.placedStructures.splice(i, 1);
          this.addFloatingText("Mounted Coracle Boat! [Traverse Water]", this.player.x, this.player.y - 1, "#38bdf8");
          GameAudio.playPickup();
          return;
        }
      }
    }

    // 1. Placed Structures Interaction (Windmill, Stone Oven, Bed, Brewing Stand)
    for (const struct of this.placedStructures) {
      const dist = Math.hypot(
        this.player.x - (struct.x + struct.w / 2),
        this.player.y - (struct.y + struct.h / 2),
      );
      if (dist < (struct.type === "windmill" ? 3.0 : 2.4)) {
        if (struct.type === "windmill") {
          if (this.hasItem("wheat", 1)) {
            this.removeItem("wheat", 1);
            struct.isOperating = true;
            struct.productionTimer = 4.0;
            this.addFloatingText("Milling Wheat -> Flour...", struct.x + 1.5, struct.y, "#fef08a");
            GameAudio.playCraft();
            return;
          } else {
            this.addFloatingText("Need Wheat to Mill!", struct.x + 1.5, struct.y, "#f59e0b");
            return;
          }
        } else if (struct.type === "stone_oven") {
          if (this.hasItem("flour", 1)) {
            this.removeItem("flour", 1);
            struct.isOperating = true;
            struct.productionTimer = 5.0;
            struct.fuelTimer = 15.0;
            this.addFloatingText("Baking Warm Bread...", struct.x + 1, struct.y, "#fbbf24");
            GameAudio.playCraft();
            return;
          } else {
            this.addFloatingText("Need Flour to Bake Bread!", struct.x + 1, struct.y, "#f59e0b");
            return;
          }
        } else if (struct.type === "bed") {
          // Sleep until 06:00 dawn
          this.worldTime.hour = 6;
          this.worldTime.minute = 0;
          this.player.health = this.player.maxHealth;
          this.player.hunger = Math.min(100, this.player.hunger + 30);
          this.addFloatingText("Slept peacefully until morning! [Well Rested]", this.player.x, this.player.y - 1, "#38bdf8");
          GameAudio.playHeartChime();
          return;
        } else if (struct.type === "brewing_stand") {
          if (this.hasItem("mushroom_blue", 1)) {
            this.removeItem("mushroom_blue", 1);
            this.addItemToInventory("potion_stamina", 1);
            this.addFloatingText("Brewed Astral Stamina Potion!", struct.x + 0.5, struct.y, "#c084fc");
            GameAudio.playCraft();
            return;
          } else if (this.hasItem("mushroom_red", 1)) {
            this.removeItem("mushroom_red", 1);
            this.addItemToInventory("potion_berserker", 1);
            this.addFloatingText("Brewed Berserker Tonic!", struct.x + 0.5, struct.y, "#ef4444");
            GameAudio.playCraft();
            return;
          } else {
            this.addFloatingText("Need Blue or Red Mushroom to Brew!", struct.x + 0.5, struct.y, "#c084fc");
            return;
          }
        }
      }
    }

    // 2. Check for neutral Goblin Trader
    for (const enemy of this.enemies) {
      if (enemy.subType === "TRADER") {
        const dist = Math.hypot(this.player.x - enemy.x, this.player.y - enemy.y);
        if (dist < 2.4) {
          if (this.hasItem("berries", 5)) {
            this.removeItem("berries", 5);
            this.addItemToInventory("mushroom_blue", 2);
            this.addItemToInventory("gold_coin", 15);
            this.addFloatingText("Traded 5 Berries -> 2 Blue Mushrooms + 15 Coins!", enemy.x, enemy.y - 1, "#22c55e");
            GameAudio.playHeartChime();
            return;
          } else {
            this.addFloatingText("Goblin Trader: 'Bring 5 Berries for Rare Mushrooms!'", enemy.x, enemy.y - 1, "#38bdf8");
            return;
          }
        }
      }
    }

    // 3. Animal Milking (Bucket + Cow) & Shearing (Shears + Sheep)
    const activeItem = this.getActiveItemSlot()?.item;
    for (const animal of this.animals) {
      const dist = Math.hypot(
        this.player.x - animal.position.x,
        this.player.y - animal.position.y,
      );
      if (dist < 2.2) {
        if (activeItem === "bucket" && animal.config.name.toLowerCase().includes("cow")) {
          this.removeItem("bucket", 1);
          this.addItemToInventory("milk", 1);
          this.addFloatingText("Milked Cow -> Fresh Milk!", animal.position.x, animal.position.y - 0.8, "#f8fafc");
          GameAudio.playPickup();
          return;
        }
        if (activeItem === "shears" && animal.config.name.toLowerCase().includes("sheep")) {
          this.addItemToInventory("wool", 2);
          this.addFloatingText("Sheared Sheep -> 2 Wool!", animal.position.x, animal.position.y - 0.8, "#f8fafc");
          GameAudio.playPickup();
          return;
        }
      }
    }

    // 4. Check for nearby NPC to talk to
    for (const npc of this.npcs) {
      const dist = Math.hypot(
        this.player.x - npc.position.x,
        this.player.y - npc.position.y,
      );
      if (dist < 2.4) {
        this.activeDialogueNPC = npc;
        (npc as any).happiness = Math.min(100, ((npc as any).happiness || 90) + 5);
        (npc as any).currentExpression = "chat";
        GameAudio.playHeartChime();
        return;
      }
    }

    // 5. Check for nearby animal to pet
    for (const animal of this.animals) {
      const dist = Math.hypot(
        this.player.x - animal.position.x,
        this.player.y - animal.position.y,
      );
      if (dist < 2.2) {
        if (animal.pet()) {
          this.player.hopTimer = 0.35;
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
            (animal as any).loveTimer = 30.0;
            GameAudio.playHeartChime();
            this.emitHeart(animal.position.x, animal.position.y - 0.5);
            this.addFloatingText(
              "Fed +♥ Ready to Breed!",
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
   * Directly adds placed structure into world (used locally and on remote peer action).
   */
  public addPlacedStructure(
    pieceId: ItemId,
    tileX: number,
    tileY: number,
    isRemote = false,
  ): boolean {
    tileX = Math.round(tileX);
    tileY = Math.round(tileY);

    const existing = this.placedStructures.find((s) => s.x === tileX && s.y === tileY);
    if (existing) return false;

    const tile = this.worldManager.getTile(tileX, tileY);
    const structType = pieceId as PlacedStructure["type"];
    const struct: PlacedStructure = {
      id: this.nextEntityId++,
      type: structType,
      x: tileX,
      y: tileY,
      w: 1,
      h: 1,
      health: 25,
      maxHealth: 25,
      shakeTimer: 0,
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
    this.emitWoodChips(tileX + 0.5, tileY + 0.5, "#a16207");
    this.addFloatingText(
      `Placed ${ITEM_CATALOG[pieceId]?.name || pieceId}`,
      tileX,
      tileY - 0.5,
      "#22c55e",
    );

    return true;
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
    this.addPlacedStructure(pieceId, tileX, tileY, false);
    this.onWorldAction?.({
      type: "place-structure",
      piece: pieceId,
      x: tileX,
      y: tileY,
    });

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
    this.player.x = 55;
    this.player.y = 44;
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
