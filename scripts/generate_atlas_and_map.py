import os
import re
import json
from PIL import Image

WORKSPACE = "/Users/shanukeshri983/Desktop/RTSGame"

def find_first_png_in_gamemaker_sprite(sprite_folder_name):
    sp_path = os.path.join(WORKSPACE, "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites", sprite_folder_name)
    if os.path.exists(sp_path):
        pngs = [f for f in os.listdir(sp_path) if f.endswith(".png") and not f.startswith(".")]
        if pngs:
            return os.path.join("Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites", sprite_folder_name, sorted(pngs)[0])
    return None

def get_image_info(rel_path):
    if not rel_path:
        return None
    full_path = os.path.join(WORKSPACE, rel_path)
    if not os.path.exists(full_path):
        return None
    try:
        with Image.open(full_path) as img:
            w, h = img.size
            return {"width": w, "height": h, "path": rel_path}
    except Exception as e:
        return None

def get_strip_frames(filename, w, h):
    match = re.search(r"strip(\d+)", filename, re.IGNORECASE)
    if match:
        count = int(match.group(1))
        frame_w = w // count
        frame_h = h
        return count, frame_w, frame_h
    return 1, w, h

def build_catalog():
    categories = []
    tileset_16 = "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Tileset/spr_tileset_sunnysideworld_16px.png"
    tileset_32 = "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Tileset/spr_tileset_sunnysideworld_forest_32px.png"

    # 1. World / Terrain
    world_items = [
        {"id": "grass_tile_01", "name": "Grass Tile (Lush)", "type": "tileset_slice", "source": tileset_16, "crop": [16, 48, 16, 16], "desc": "Standard vibrant green top-down grass tile"},
        {"id": "grass_tile_02", "name": "Grass Tile (Edge Detail)", "type": "tileset_slice", "source": tileset_16, "crop": [32, 48, 16, 16], "desc": "Grass terrain edge with natural shading"},
        {"id": "dirt_tile_01", "name": "Dirt Tile (Basic)", "type": "tileset_slice", "source": tileset_16, "crop": [16, 112, 16, 16], "desc": "Rich brown dirt terrain tile"},
        {"id": "sand_tile_01", "name": "Sand Tile (Beach/Desert)", "type": "tileset_slice", "source": tileset_16, "crop": [208, 48, 16, 16], "desc": "Warm golden beach and desert sand tile"},
        {"id": "stone_tile_01", "name": "Stone / Cobblestone", "type": "tileset_slice", "source": tileset_16, "crop": [192, 112, 16, 16], "desc": "Natural stone and paved cobblestone surface"},
        {"id": "water_tile_01", "name": "Water Tile (River Blue)", "type": "tileset_slice", "source": tileset_16, "crop": [352, 112, 16, 16], "desc": "Crystal blue river and ocean water tile"},
        {"id": "shore_transition_01", "name": "Shore / Water Transition", "type": "tileset_slice", "source": tileset_16, "crop": [368, 112, 16, 16], "desc": "Coastline shore transition from sand/grass to water"},
        {"id": "path_tile_01", "name": "Path 01 (Dirt Trail)", "type": "tileset_slice", "source": tileset_16, "crop": [16, 112, 16, 16], "desc": "Worn walking trail / dirt road connector"},
        {"id": "path_tile_02", "name": "Path 02 (Cobblestone Path)", "type": "tileset_slice", "source": tileset_16, "crop": [192, 112, 16, 16], "desc": "Paved stone village walkway"},
        {"id": "path_tile_03", "name": "Path 03 (Wooden Boardwalk)", "type": "tileset_slice", "source": tileset_16, "crop": [544, 112, 16, 16], "desc": "Wooden walkway and boardwalk path"},
        {"id": "cliff_elevation_01", "name": "Cliffs / Elevation Wall", "type": "tileset_slice", "source": tileset_16, "crop": [16, 64, 16, 32], "desc": "Raised cliff face, ledge elevation, and height step"},
        {"id": "small_rock_01", "name": "Small Rock Decor", "type": "image", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/rock.png", "desc": "Small scatter rock for natural ground decoration"},
        {"id": "grass_tuft_01", "name": "Grass Tuft Accent", "type": "tileset_slice", "source": tileset_16, "crop": [48, 48, 16, 16], "desc": "Decorative grass tuft and wild greenery overlay"},
        {"id": "flowers_wild_01", "name": "Wild Flowers (Scatter 1)", "type": "sprite_gm", "sprite": "spr_deco_flowers_house_01", "desc": "Wild field flowers in blooming colors"},
        {"id": "flowers_wild_02", "name": "Wild Flowers (Scatter 2)", "type": "sprite_gm", "sprite": "spr_deco_flowers_house_02", "desc": "Clumped cottage flowers"},
        {"id": "mushrooms_deco_blue", "name": "Blue Forest Mushroom", "type": "sprite_gm", "sprite": "spr_deco_mushroom_blue_01", "desc": "Glowing wild blue forest mushrooms"},
        {"id": "mushrooms_deco_red", "name": "Red Forest Mushroom", "type": "sprite_gm", "sprite": "spr_deco_mushroom_red_01", "desc": "Classic red cap spotted forest mushroom"},
        {"id": "acorn_deco_01", "name": "Fallen Forest Acorn", "type": "sprite_gm", "sprite": "spr_deco_acron", "desc": "Fallen oak acorn scatter item"},
        {"id": "truffle_deco_01", "name": "Wild Truffle Mushroom", "type": "sprite_gm", "sprite": "spr_deco_truffle", "desc": "Rare forageable wild ground truffle"},
        {"id": "stump_deco_01", "name": "Tree Stump", "type": "tileset_slice", "source": tileset_32, "crop": [256, 96, 32, 32], "desc": "Chopped tree stump and remaining root base"}
    ]
    categories.append({"id": "world_terrain", "title": "World / Terrain", "desc": "Core terrain tiles, shorelines, paths, cliffs, and scatter details", "items": world_items})

    # 2. Isometric "Block" System
    iso_items = [
        {"id": "iso_grass_block", "name": "Grass Block", "type": "iso_block", "topColor": 0x5da845, "sideColor": 0x8a5a36, "frontColor": 0x6e4526, "desc": "Isometric 3D-styled grass top cube block"},
        {"id": "iso_dirt_block", "name": "Dirt Block", "type": "iso_block", "topColor": 0x8a5a36, "sideColor": 0x734827, "frontColor": 0x5b381d, "desc": "Isometric rich soil block for terrain excavation"},
        {"id": "iso_stone_block", "name": "Stone Block", "type": "iso_block", "topColor": 0x9ca3af, "sideColor": 0x6b7280, "frontColor": 0x4b5563, "desc": "Chiseled stone block for mountain & construction"},
        {"id": "iso_sand_block", "name": "Sand Block", "type": "iso_block", "topColor": 0xf6d860, "sideColor": 0xd4a838, "frontColor": 0xb08422, "desc": "Desert and beach sand cube"},
        {"id": "iso_wood_block", "name": "Wood Block / Planks", "type": "iso_block", "topColor": 0xb57c48, "sideColor": 0x945f32, "frontColor": 0x754721, "desc": "Crafted wooden timber block for building"},
        {"id": "iso_water_block", "name": "Water Block", "type": "iso_block", "topColor": 0x38bdf8, "sideColor": 0x0284c7, "frontColor": 0x0369a1, "alpha": 0.85, "desc": "Translucent water volume cube"},
        {"id": "iso_path_block", "name": "Path Block", "type": "iso_block", "topColor": 0xd1b48c, "sideColor": 0x9c7c58, "frontColor": 0x7a5b3a, "desc": "Packed earth walkway block"},
        {"id": "iso_wall_block", "name": "Wall Block (Stone/Brick)", "type": "iso_block", "topColor": 0xd1d5db, "sideColor": 0x9ca3af, "frontColor": 0x6b7280, "desc": "Solid structural wall block"},
        {"id": "iso_floor_block", "name": "Floor Tile Block", "type": "iso_block", "topColor": 0xe2e8f0, "sideColor": 0x94a3b8, "frontColor": 0x64748b, "heightRatio": 0.25, "desc": "Low-profile floor slab"},
        {"id": "iso_corner_block", "name": "Corner / Slope Block", "type": "iso_block", "topColor": 0x5da845, "sideColor": 0x8a5a36, "frontColor": 0x6e4526, "slope": True, "desc": "Beveled corner/ramp elevation transition"},
        {"id": "iso_half_block", "name": "Half-Height Raised Slab", "type": "iso_block", "topColor": 0xb57c48, "sideColor": 0x945f32, "frontColor": 0x754721, "heightRatio": 0.5, "desc": "Half-step height modular elevation block"},
        {"id": "iso_block_edge", "name": "Block Edge Highlight", "type": "iso_overlay", "variant": "edge", "desc": "Edge border grid indicator for 3D alignment"},
        {"id": "iso_block_corner", "name": "Block Corner Accent", "type": "iso_overlay", "variant": "corner", "desc": "Corner vertex connection marker"},
        {"id": "iso_block_shadow", "name": "Block Ambient Shadow", "type": "iso_overlay", "variant": "shadow", "desc": "Ground cast shadow beneath placed block"},
        {"id": "iso_placement_preview", "name": "Placement Preview (Holo)", "type": "iso_overlay", "variant": "preview", "desc": "Cyan holographic preview guide for player placement"},
        {"id": "iso_break_effect", "name": "Destroy / Break Effect", "type": "iso_overlay", "variant": "break", "desc": "Cracking damage overlay (Stage 1 to 3)"}
    ]
    categories.append({"id": "iso_blocks", "title": "Isometric \"Block\" System", "desc": "2D isometric block primitives, modular construction cubes, highlights, and destruction states", "items": iso_items})

    # 3. Player Actions & Hairstyles (Exact 96x64 frames)
    player_items = []
    actions = [
        ("IDLE", "Idle Stance", 9),
        ("WALKING", "Walk Cycle", 8),
        ("RUN", "Run Sprint", 8),
        ("ATTACK", "Attack / Swing", 10),
        ("MINING", "Pickaxe Mining", 10),
        ("AXE", "Axe Chopping", 10),
        ("DIG", "Shovel Digging", 13),
        ("HAMMERING", "Hammer Building", 23),
        ("WATERING", "Can Watering", 5),
        ("CARRY", "Carry Object", 8),
        ("HURT", "Damage Hurt", 8),
        ("DEATH", "Death Collapse", 13),
        ("JUMP", "Jump Action", 9),
        ("SWIMMING", "Water Swimming", 12),
        ("WAITING", "Idle Waiting", 9),
        ("ROLL", "Evasion Roll", 10),
        ("CASTING", "Fishing Cast", 15),
        ("REELING", "Fishing Reel", 13),
        ("CAUGHT", "Fish Caught Catch", 10)
    ]
    hairstyles = [
        ("base", "Base / Bald"),
        ("curlyhair", "Curly Hair"),
        ("shorthair", "Short Hair"),
        ("longhair", "Long Hair"),
        ("spikeyhair", "Spikey Hair"),
        ("bowlhair", "Bowl Cut"),
        ("mophair", "Mop Hair"),
        ("tools", "Held Tool Overlay")
    ]

    for act_dir, act_label, frames in actions:
        dir_path = os.path.join(WORKSPACE, f"Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Human/{act_dir}")
        base_file = f"Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Human/{act_dir}/base_{act_dir.lower()}_strip{frames}.png"
        if os.path.exists(dir_path):
            matches = [f for f in os.listdir(dir_path) if f.startswith("base_")]
            if matches:
                base_file = f"Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Human/{act_dir}/{matches[0]}"
        player_items.append({
            "id": f"player_base_{act_dir.lower()}",
            "name": f"Player: {act_label} (Base)",
            "type": "animated_strip",
            "source": base_file,
            "frames": frames,
            "fps": 8,
            "desc": f"Player character animation for {act_label} (96x64 frame size, {frames} frames)"
        })

    for hair_code, hair_label in hairstyles:
        if hair_code == "base":
            continue
        h_file = f"Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Human/IDLE/{hair_code}_idle_strip9.png"
        if os.path.exists(os.path.join(WORKSPACE, h_file)):
            player_items.append({
                "id": f"player_hair_{hair_code}",
                "name": f"Hairstyle Variant: {hair_label}",
                "type": "animated_strip",
                "source": h_file,
                "frames": 9,
                "fps": 8,
                "desc": f"Player hairstyle overlay: {hair_label} (96x64 frames)"
            })

    categories.append({"id": "player_actions", "title": "Player (Hairstyles & Animations)", "desc": "All character action strips and hairstyles (96x64 native frame resolution)", "items": player_items})

    # 4. Friendly NPCs
    npc_items = [
        {"id": "npc_villager_default", "name": "Villager (Short Hair Citizen)", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Human/WALKING/shorthair_walk_strip8.png", "frames": 8, "fps": 8, "desc": "Town citizen NPC walking animation"},
        {"id": "npc_farmer", "name": "Farmer NPC (Watering)", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Human/WATERING/curlyhair_watering_strip5.png", "frames": 5, "fps": 6, "desc": "Friendly farmer tending to village crops"},
        {"id": "npc_merchant", "name": "Merchant / Trader (Waiting)", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Human/WAITING/longhair_waiting_strip9.png", "frames": 9, "fps": 8, "desc": "Shopkeeper NPC at storefront stall"},
        {"id": "npc_blacksmith", "name": "Blacksmith (Hammering)", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Human/HAMMERING/spikeyhair_hamering_strip23.png", "frames": 23, "fps": 12, "desc": "Village smith crafting armor & tools"},
        {"id": "npc_builder", "name": "Builder / Carpenter", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Human/AXE/mophair_axe_strip10.png", "frames": 10, "fps": 8, "desc": "Construction builder working on wooden structures"},
        {"id": "npc_fisher", "name": "Fisher NPC (Reeling)", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Human/REELING/bowlhair_reeling_strip13.png", "frames": 13, "fps": 8, "desc": "Angler fishing by dock or river shore"},
        {"id": "npc_dungeon_guide", "name": "Dungeon Explorer NPC", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Human/ATTACK/longhair_attack_strip10.png", "frames": 10, "fps": 8, "desc": "Veteran dungeon guide ready with weapon"},
        {"id": "npc_child_variant", "name": "Child / Cosmetic Variant", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Human/JUMP/bowlhair_jump_strip9.png", "frames": 9, "fps": 8, "desc": "Village child playing / jumping variant"}
    ]
    categories.append({"id": "friendly_npcs", "title": "Friendly NPCs", "desc": "Villager roles: Farmer, Merchant, Blacksmith, Builder, Fisher, Dungeon Guide, Children", "items": npc_items})

    # 5. Animals
    animal_items = [
        {"id": "animal_chicken", "name": "Chicken (Animated)", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Animals/spr_deco_chicken_01_strip4.png", "frames": 4, "fps": 6, "desc": "Pecking farm chicken animation (32x32)"},
        {"id": "animal_cow", "name": "Cow (Animated)", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Animals/spr_deco_cow_strip4.png", "frames": 4, "fps": 4, "desc": "Grazing dairy cow animation (32x32)"},
        {"id": "animal_duck", "name": "Duck (Animated)", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Animals/spr_deco_duck_01_strip4.png", "frames": 4, "fps": 6, "desc": "Waddling duck for ponds & farms (16x16)"},
        {"id": "animal_pig", "name": "Pig (Animated)", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Animals/spr_deco_pig_01_strip4.png", "frames": 4, "fps": 6, "desc": "Mud farm pig animation (32x32)"},
        {"id": "animal_sheep", "name": "Sheep (Animated)", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Animals/spr_deco_sheep_01_strip4.png", "frames": 4, "fps": 4, "desc": "Wooly sheep animation (32x32)"},
        {"id": "animal_bird", "name": "Bird (Animated)", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Animals/spr_deco_bird_01_strip4.png", "frames": 4, "fps": 6, "desc": "Wild songbird perching and hopping (16x16)"},
        {"id": "animal_fish", "name": "Fish (Water / Caught)", "type": "image", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/fish.png", "desc": "River fish for fishing and cooking"},
        {"id": "animal_blinking", "name": "Blinking Eyes FX", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Animals/spr_deco_blinking_strip12.png", "frames": 12, "fps": 8, "desc": "Nocturnal animal / foliage blinking eyes effect (16x16)"}
    ]
    categories.append({"id": "animals", "title": "Animals & Wildlife", "desc": "Chicken, Cow, Duck, Pig, Sheep, Bird, Fish, and Blinking Wildlife", "items": animal_items})

    # 6. Trees
    tree_items = [
        {"id": "tree_oak_01", "name": "Oak Tree (Deciduous)", "type": "sprite_gm", "sprite": "spr_deco_tree_01", "desc": "Full green foliage deciduous oak tree (32x34)"},
        {"id": "tree_pine_01", "name": "Pine / Evergreen Tree", "type": "sprite_gm", "sprite": "spr_deco_tree_02", "desc": "Slender evergreen pine tree (28x43)"},
        {"id": "tree_sway_strip", "name": "Swaying Canopy Tree", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Plants/spr_deco_tree_02_strip4.png", "frames": 4, "fps": 4, "desc": "Wind blowing gentle tree animation (28x43, 4 frames)"},
        {"id": "tree_prog_small", "name": "Tree Sapling Sprout", "type": "tileset_slice", "source": tileset_32, "crop": [32, 32, 32, 32], "desc": "Growing young tree sapling"},
        {"id": "tree_prog_stump", "name": "Chopped Forest Stump", "type": "tileset_slice", "source": tileset_32, "crop": [256, 96, 32, 32], "desc": "Harvested tree stump with rings"}
    ]
    categories.append({"id": "trees", "title": "Trees & Species Progression", "desc": "Oak trees, Pine trees, Animated swaying trees, and tree stumps", "items": tree_items})

    # 7. Plants & Foliage
    plant_items = [
        {"id": "plant_shroom_blue_01", "name": "Blue Mushroom Spores", "type": "sprite_gm", "sprite": "spr_deco_mushroom_blue_01", "desc": "Bioluminescent blue mushroom (16x16)"},
        {"id": "plant_shroom_blue_02", "name": "Blue Mushroom Cluster", "type": "sprite_gm", "sprite": "spr_deco_mushroom_blue_02", "desc": "Medium cluster blue forest mushroom"},
        {"id": "plant_shroom_blue_03", "name": "Giant Blue Toadstool", "type": "sprite_gm", "sprite": "spr_deco_mushroom_blue_03", "desc": "Large blue cap toadstool"},
        {"id": "plant_shroom_red_01", "name": "Red Forest Mushroom", "type": "sprite_gm", "sprite": "spr_deco_mushroom_red_01", "desc": "Classic spotted red toadstool"},
        {"id": "plant_flowers_01", "name": "Cottage Flower Bed 01", "type": "sprite_gm", "sprite": "spr_deco_flowers_house_01", "desc": "Blooming front porch floral arrangement"},
        {"id": "plant_flowers_02", "name": "Cottage Flower Bed 02", "type": "sprite_gm", "sprite": "spr_deco_flowers_house_02", "desc": "Pastel flower bed detail"},
        {"id": "plant_leaf_accent", "name": "Leaf Particle Decor", "type": "sprite_gm", "sprite": "leaves_hit", "desc": "Fallen autumn leaf ground accent"}
    ]
    categories.append({"id": "plants", "title": "Plants & Foliage", "desc": "Wild mushrooms (Blue & Red), cottage flowers, and ground flora", "items": plant_items})

    # 8. Farming & Crops
    crop_names = [
        ("wheat", "Wheat"),
        ("carrot", "Carrot"),
        ("potato", "Potato"),
        ("pumpkin", "Pumpkin"),
        ("cabbage", "Cabbage"),
        ("cauliflower", "Cauliflower"),
        ("kale", "Kale"),
        ("parsnip", "Parsnip"),
        ("radish", "Radish"),
        ("beetroot", "Beetroot"),
        ("sunflower", "Sunflower")
    ]
    stage_labels = ["00: Seed", "01: Sprout", "02: Small Plant", "03: Growing", "04: Mature", "05: Harvested"]

    farming_items = [
        {"id": "crop_seeds_generic", "name": "Generic Crop Seeds Pouch", "type": "image", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/seeds_generic.png", "desc": "Seed bag for planting farm crops"}
    ]

    for crop_id, crop_title in crop_names:
        for stage_idx, stage_lbl in enumerate(stage_labels):
            fpath = f"Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/{crop_id}_0{stage_idx}.png"
            farming_items.append({
                "id": f"crop_{crop_id}_stage_{stage_idx}",
                "name": f"{crop_title} ({stage_lbl})",
                "type": "image",
                "source": fpath,
                "cropType": crop_title,
                "stage": stage_idx,
                "desc": f"{crop_title} growth stage {stage_idx} ({stage_lbl})"
            })

    categories.append({"id": "farming_crops", "title": "Farming & Crops (Growth Stages 00–05)", "desc": "Complete growth sequences for all 11 crops: Wheat, Carrot, Potato, Pumpkin, Cabbage, Cauliflower, Kale, Parsnip, Radish, Beetroot, Sunflower + Seeds", "items": farming_items})

    # 9. Farm Objects & Storage
    farm_obj_items = [
        {"id": "farm_soil_00", "name": "Tilled Soil (Dry)", "type": "image", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/soil_00.png", "desc": "Freshly hoed soil tile"},
        {"id": "farm_soil_01", "name": "Tilled Soil (Wet / Watered)", "type": "image", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/soil_01.png", "desc": "Watered dark fertile soil ready for growth"},
        {"id": "farm_soil_03", "name": "Tilled Soil Corner", "type": "image", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/soil_03.png", "desc": "Soil patch boundary transition"},
        {"id": "farm_soil_04", "name": "Tilled Soil Enclosed Bed", "type": "image", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/soil_04.png", "desc": "Complete tilled garden plot tile"},
        {"id": "farm_well", "name": "Stone Water Well", "type": "sprite_gm", "sprite": "spr_deco_well", "desc": "Village stone water well with bucket"},
        {"id": "farm_well_covered", "name": "Roofed Water Well", "type": "sprite_gm", "sprite": "spr_deco_well_covered", "desc": "Sheltered timber-roofed well"},
        {"id": "farm_trough", "name": "Animal Feed Trough", "type": "sprite_gm", "sprite": "spr_deco_trough", "desc": "Wooden feeding trough for livestock"},
        {"id": "farm_waterbowl", "name": "Animal Water Bowl", "type": "sprite_gm", "sprite": "spr_deco_waterbowl", "desc": "Clay watering bowl for pets & poultry"},
        {"id": "farm_crate_base", "name": "Storage Crate Base", "type": "image", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/crate_base.png", "desc": "Wooden storage container bottom"},
        {"id": "farm_crate_top", "name": "Storage Crate Top / Lid", "type": "image", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/crate_top.png", "desc": "Wooden storage container lid"},
        {"id": "farm_crate_01", "name": "Wooden Crate (Small)", "type": "sprite_gm", "sprite": "spr_deco_crate_01", "desc": "Small goods storage crate"},
        {"id": "farm_crate_02", "name": "Wooden Crate (Large)", "type": "sprite_gm", "sprite": "spr_deco_crate_02", "desc": "Large reinforced cargo crate"},
        {"id": "farm_chest_closed", "name": "Chest 01 (Closed)", "type": "sprite_gm", "sprite": "spr_deco_chest_01_closed", "desc": "Wood and iron lockbox closed"},
        {"id": "farm_chest_open", "name": "Chest 01 (Open)", "type": "sprite_gm", "sprite": "spr_deco_chest_01_open", "desc": "Wood and iron lockbox open with inventory"},
        {"id": "farm_chest2_closed", "name": "Chest 02 (Golden Closed)", "type": "sprite_gm", "sprite": "spr_deco_chest_02_closed", "desc": "Ornate treasure chest closed"},
        {"id": "farm_chest2_open", "name": "Chest 02 (Golden Open)", "type": "sprite_gm", "sprite": "spr_deco_chest_02_open", "desc": "Ornate treasure chest open"}
    ]
    categories.append({"id": "farm_objects", "title": "Farm Objects & Storage", "desc": "Tilled soil, water wells, troughs, crates, and storage chests", "items": farm_obj_items})

    # 10. Buildings & Modular Pieces
    bld_items = [
        {"id": "bld_windmill", "name": "Windmill (Animated 9-Frame)", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Other/spr_deco_windmill_withshadow_strip9.png", "frames": 9, "fps": 8, "desc": "Large 112x112 rotating grain windmill structure"},
        {"id": "piece_beam", "name": "Structural Wooden Beam", "type": "sprite_gm", "sprite": "spr_deco_beam", "desc": "Heavy timber construction beam"},
        {"id": "piece_chimney_brick", "name": "Brick Chimney", "type": "sprite_gm", "sprite": "spr_deco_chinmney", "desc": "Cottage rooftop brick chimney"},
        {"id": "piece_chimney_cook", "name": "Cookhouse Stove Chimney", "type": "sprite_gm", "sprite": "spr_deco_cook_chinmney", "desc": "Stove chimney with stovepipe"},
        {"id": "piece_wall_wood_01", "name": "Building 01 Wall Segment", "type": "tileset_slice", "source": tileset_16, "crop": [16, 144, 16, 32], "desc": "Modular wood plank exterior house wall"},
        {"id": "piece_door_01", "name": "Building 01 Doorway", "type": "tileset_slice", "source": tileset_16, "crop": [32, 144, 16, 32], "desc": "Entrance door with frame"},
        {"id": "piece_roof_01", "name": "Building 01 Roof Shingle", "type": "tileset_slice", "source": tileset_16, "crop": [16, 160, 16, 16], "desc": "Slanted cottage roof shingle"},
        {"id": "piece_wall_wood_02", "name": "Building 02 Wall Segment", "type": "tileset_slice", "source": tileset_16, "crop": [16, 240, 16, 32], "desc": "Variant timber exterior wall"},
        {"id": "piece_roof_02", "name": "Building 02 Roof Shingle", "type": "tileset_slice", "source": tileset_16, "crop": [16, 256, 16, 16], "desc": "Variant roof shingle panel"},
        {"id": "piece_inner_wall", "name": "Interior Partition Wall", "type": "tileset_slice", "source": tileset_16, "crop": [16, 192, 16, 32], "desc": "Indoor room dividing wall"}
    ]
    categories.append({"id": "buildings", "title": "Buildings & Modular Construction Pieces", "desc": "Rotating windmill and modular wall, door, roof, beam, and chimney pieces", "items": bld_items})

    # 11. Water, Boats & Aquatic
    water_items = [
        {"id": "water_river_tile", "name": "River Water Tile", "type": "tileset_slice", "source": tileset_16, "crop": [352, 112, 16, 16], "desc": "Clear flowing river water"},
        {"id": "water_shore_edge", "name": "Water Shoreline Bank", "type": "tileset_slice", "source": tileset_16, "crop": [368, 112, 16, 16], "desc": "Shallow water bank transition"},
        {"id": "boat_coracle_water", "name": "Coracle Boat (Floating 4-Frame)", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Other/spr_deco_coracle_strip4.png", "frames": 4, "fps": 4, "desc": "Round traditional fishing coracle boat in water (48x37)"},
        {"id": "boat_coracle_land", "name": "Coracle Boat (Dry Land)", "type": "image", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Other/spr_deco_coracle_land.png", "desc": "Beached coracle boat on shore (32x30)"},
        {"id": "boat_oar", "name": "Wooden Rowing Oar", "type": "sprite_gm", "sprite": "spr_deco_oar", "desc": "Boat steering and rowing paddle"}
    ]
    categories.append({"id": "water_aquatic", "title": "Water, Boats & Aquatic", "desc": "Water depths, shores, floating animated coracle boats, and rowing oars", "items": water_items})

    # 12. Resources & Collectibles
    res_items = [
        {"id": "res_wood", "name": "Lumber / Wood Log", "type": "image", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/wood.png", "desc": "Harvested timber wood resource"},
        {"id": "res_stone", "name": "Stone / Cobblestone", "type": "image", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/rock.png", "desc": "Mined rough stone chunk"},
        {"id": "res_ore_coal", "name": "Coal Ore Deposit", "type": "sprite_gm", "sprite": "spr_deco_ore_coal", "desc": "Fuel source ore mined underground"},
        {"id": "res_ore_gold", "name": "Gold Ore Deposit", "type": "sprite_gm", "sprite": "spr_deco_ore_gold", "desc": "Precious gold metal deposit"},
        {"id": "res_ore_silver", "name": "Silver Ore Deposit", "type": "sprite_gm", "sprite": "spr_deco_ore_silver", "desc": "Refined silver mineral node"},
        {"id": "res_ore_bluestone", "name": "Lapis / Bluestone Ore", "type": "sprite_gm", "sprite": "spr_deco_ore_bluestone", "desc": "Magical blue crystal ore"},
        {"id": "res_milk", "name": "Fresh Milk Jug", "type": "image", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/milk.png", "desc": "Dairy resource collected from cows"},
        {"id": "res_egg", "name": "Farm Egg", "type": "image", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/egg.png", "desc": "Poultry resource collected from chickens"},
        {"id": "res_wool", "name": "Wool Fleece", "type": "sprite_gm", "sprite": "spr_deco_wool", "desc": "Sheared fluffy sheep wool"},
        {"id": "res_coin_single", "name": "Gold Coin", "type": "sprite_gm", "sprite": "spr_deco_coin", "desc": "Single currency gold coin"},
        {"id": "res_coins_pile", "name": "Coins Treasure Pile", "type": "sprite_gm", "sprite": "spr_deco_coins", "desc": "Heaped pile of shiny coins"}
    ]
    categories.append({"id": "resources", "title": "Resources & Collectibles", "desc": "Wood, stone, ores (Coal, Gold, Silver, Bluestone), milk, eggs, wool, and coins", "items": res_items})

    # 13. Enemies (Exact 96x64 frames)
    enemy_items = [
        {"id": "enemy_skel_idle", "name": "Skeleton (Idle)", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Skeleton/PNG/skeleton_idle_strip6.png", "frames": 6, "fps": 6, "desc": "Undead skeleton idle stance (96x64)"},
        {"id": "enemy_skel_walk", "name": "Skeleton (Walk / Patrol)", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Skeleton/PNG/skeleton_walk_strip8.png", "frames": 8, "fps": 8, "desc": "Skeleton patrol walk (96x64)"},
        {"id": "enemy_skel_attack", "name": "Skeleton (Attack Strike)", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Skeleton/PNG/skeleton_attack_strip7.png", "frames": 7, "fps": 8, "desc": "Undead skeleton sword strike animation (96x64)"},
        {"id": "enemy_skel_hurt", "name": "Skeleton (Hurt)", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Skeleton/PNG/skeleton_hurt_strip7.png", "frames": 7, "fps": 8, "desc": "Skeleton taking combat damage (96x64)"},
        {"id": "enemy_skel_death", "name": "Skeleton (Death / Crumble)", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Skeleton/PNG/skeleton_death_strip10.png", "frames": 10, "fps": 8, "desc": "Skeleton crumbling into bone pile (96x64)"},
        {"id": "enemy_goblin_idle", "name": "Goblin (Idle Stance)", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Goblin/PNG/spr_idle_strip9.png", "frames": 9, "fps": 8, "desc": "Goblin scout idle stance (96x64)"},
        {"id": "enemy_goblin_walk", "name": "Goblin (Walk Patrol)", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Goblin/PNG/spr_walk_strip8.png", "frames": 8, "fps": 8, "desc": "Goblin scout patrol walk (96x64)"},
        {"id": "enemy_goblin_run", "name": "Goblin (Run Charge)", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Goblin/PNG/spr_run_strip8.png", "frames": 8, "fps": 10, "desc": "Goblin fast charge attack (96x64)"},
        {"id": "enemy_goblin_attack", "name": "Goblin (Attack)", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Goblin/PNG/spr_attack_strip10.png", "frames": 10, "fps": 10, "desc": "Goblin combat dagger swing (96x64)"},
        {"id": "enemy_goblin_death", "name": "Goblin (Death)", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Goblin/PNG/spr_death_strip13.png", "frames": 13, "fps": 10, "desc": "Defeated goblin collapse (96x64)"},
        {"id": "enemy_goblin_mining", "name": "Goblin (Mining Ore)", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Goblin/PNG/spr_mining_strip10.png", "frames": 10, "fps": 8, "desc": "Goblin mining dungeon minerals (96x64)"}
    ]
    categories.append({"id": "enemies", "title": "Enemies (Skeleton & Goblin)", "desc": "Combat ready animated monsters with exact 96x64 frame strips", "items": enemy_items})

    # 14. Dungeon Visuals & Props
    dungeon_items = [
        {"id": "dungeon_minecart", "name": "Dungeon Ore Minecart", "type": "sprite_gm", "sprite": "spr_deco_minecart", "desc": "Subterranean rail ore transport cart"},
        {"id": "dungeon_sword_floor", "name": "Sword Embedded in Floor", "type": "sprite_gm", "sprite": "spr_deco_sword_floor", "desc": "Ancient warrior sword stuck in dungeon stone"},
        {"id": "dungeon_chest_closed", "name": "Ornate Dungeon Chest", "type": "sprite_gm", "sprite": "spr_deco_chest_02_closed", "desc": "Gold trim dungeon vault chest"}
    ]
    categories.append({"id": "dungeon_visuals", "title": "Dungeon Visuals & Props", "desc": "Minecarts, floor swords, and ancient dungeon treasure chests", "items": dungeon_items})

    # 15. Weather, Atmosphere & VFX
    vfx_items = [
        {"id": "vfx_smoke_01", "name": "Chimney Smoke 01", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/VFX/Chimney Smoke/chimneysmoke_01_strip30.png", "frames": 30, "fps": 15, "desc": "Soft rising white chimney puff (15x37, 30 frames)"},
        {"id": "vfx_smoke_02", "name": "Chimney Smoke 02", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/VFX/Chimney Smoke/chimneysmoke_02_strip30.png", "frames": 30, "fps": 15, "desc": "Dense billowing woodfire smoke (10x30, 30 frames)"},
        {"id": "vfx_smoke_03", "name": "Chimney Smoke 03", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/VFX/Chimney Smoke/chimneysmoke_03_strip30.png", "frames": 30, "fps": 15, "desc": "Whispering drifting chimney plume (18x21, 30 frames)"},
        {"id": "vfx_fire_01", "name": "Campfire Flame 01", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/VFX/Fire/spr_deco_fire_01_strip4.png", "frames": 4, "fps": 8, "desc": "Flickering warm fire effect"},
        {"id": "vfx_fire_02", "name": "Furnace Flame 02", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/VFX/Fire/spr_deco_fire_02_strip4.png", "frames": 4, "fps": 8, "desc": "Roaring hearth fire animation"},
        {"id": "vfx_glint_01", "name": "Sparkle Glint 01", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/VFX/Glint/spr_deco_glint_01_strip6.png", "frames": 6, "fps": 8, "desc": "Treasure and ore shimmer sparkle (6 frames)"},
        {"id": "vfx_glint_02", "name": "Star Sparkle 02", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/VFX/Glint/spr_deco_glint_02_strip4.png", "frames": 4, "fps": 6, "desc": "Item discovery twinkle effect (4 frames)"},
        {"id": "vfx_dust_run", "name": "Dust Run Particles", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Gamemaker/sprites/dust_run_strip8/3dca18ec-c5d9-4b68-b7eb-52296b02a9b6.png", "frames": 8, "fps": 10, "desc": "Player movement footstep dust puff"}
    ]
    categories.append({"id": "weather_vfx", "title": "Weather, Atmosphere & VFX", "desc": "Chimney smoke strips, burning campfire flames, treasure sparkle glints, and particles", "items": vfx_items})

    # 16. Player Construction & Furniture
    deco_items = [
        {"id": "furn_chair", "name": "Wooden Dining Chair", "type": "sprite_gm", "sprite": "spr_deco_chair_01", "desc": "Carved wood cottage chair"},
        {"id": "furn_sidetable", "name": "Bedside Sidetable", "type": "sprite_gm", "sprite": "spr_deco_sidetable_01", "desc": "Small nightstand / sidetable"},
        {"id": "furn_rug", "name": "Cozy Home Rug", "type": "sprite_gm", "sprite": "spr_deco_rug_01", "desc": "Woven interior floor rug"},
        {"id": "furn_picture", "name": "Wall Painting Picture", "type": "sprite_gm", "sprite": "spr_deco_picture_01", "desc": "Framed artwork for cottage walls"},
        {"id": "furn_anvil", "name": "Blacksmith Anvil", "type": "sprite_gm", "sprite": "spr_deco_anvil", "desc": "Heavy cast iron forging anvil"},
        {"id": "furn_campfire", "name": "Campfire Pit", "type": "sprite_gm", "sprite": "spr_deco_campfire", "desc": "Stone-ringed cooking campfire"},
        {"id": "furn_firepit", "name": "Outdoor Firepit", "type": "sprite_gm", "sprite": "spr_deco_firepit", "desc": "Outdoor stone fire pit"},
        {"id": "furn_barrel_closed", "name": "Storage Barrel (Sealed)", "type": "sprite_gm", "sprite": "spr_deco_barrel_closed", "desc": "Sealed oak barrel for wine & grain"},
        {"id": "furn_barrel_open", "name": "Storage Barrel (Open)", "type": "sprite_gm", "sprite": "spr_deco_barrel_open", "desc": "Open top barrel showing storage"},
        {"id": "furn_barrel_swords", "name": "Weapons Barrel (Swords)", "type": "sprite_gm", "sprite": "spr_deco_barrel_swords", "desc": "Armory barrel storing blades"},
        {"id": "furn_barrel_water", "name": "Rain Barrel (Water)", "type": "sprite_gm", "sprite": "spr_deco_barrel_water", "desc": "Water collection barrel"},
        {"id": "furn_dishware", "name": "Plate, Knife & Fork", "type": "sprite_gm", "sprite": "spr_deco_plate_knifeandfork", "desc": "Table setting tableware"},
        {"id": "furn_plate_food", "name": "Plate with Hot Food", "type": "sprite_gm", "sprite": "spr_deco_plate_food", "desc": "Cooked meal on porcelain plate"},
        {"id": "furn_jar", "name": "Ceramic Storage Jar", "type": "sprite_gm", "sprite": "spr_deco_jar_01", "desc": "Glazed pottery pantry jar"},
        {"id": "furn_mug", "name": "Clay Drinking Mug", "type": "sprite_gm", "sprite": "spr_deco_mug_02", "desc": "Warm beverage ceramic tankard"},
        {"id": "furn_book", "name": "Spellbook / Diary", "type": "sprite_gm", "sprite": "spr_deco_book_01", "desc": "Leather-bound tome and crafting journal"},
        {"id": "furn_bucket", "name": "Wooden Bucket", "type": "sprite_gm", "sprite": "spr_deco_bucket", "desc": "Water and milking pail"},
        {"id": "furn_bucket_rope", "name": "Well Bucket & Rope", "type": "sprite_gm", "sprite": "spr_deco_buckect_rope", "desc": "Bucket attached to winch rope"}
    ]
    categories.append({"id": "furniture_deco", "title": "Player Construction & Furniture", "desc": "Chairs, sidetables, rugs, paintings, anvils, campfires, barrels, tableware, books, and buckets", "items": deco_items})

    # 17. Tools & Implements
    ui_dir = "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI"
    tool_items = [
        {"id": "tool_axe", "name": "Woodcutter's Axe", "type": "image", "source": f"{ui_dir}/axe.png", "desc": "Essential tool for felling trees and gathering timber"},
        {"id": "tool_pickaxe", "name": "Miner's Pickaxe", "type": "image", "source": f"{ui_dir}/pickaxe.png", "desc": "Heavy tool for mining stone, ores and gems"},
        {"id": "tool_shovel", "name": "Gardening Shovel", "type": "image", "source": f"{ui_dir}/shovel.png", "desc": "Tool for digging earth, sand, and preparing ground"},
        {"id": "tool_hammer", "name": "Builder's Hammer", "type": "image", "source": f"{ui_dir}/hammer.png", "desc": "Construction tool for placing and upgrading structures"},
        {"id": "tool_watering_can", "name": "Watering Can (Hoe/Water)", "type": "image", "source": f"{ui_dir}/water.png", "desc": "Farm implement for irrigating crops"},
        {"id": "tool_fishing_rod", "name": "Fishing Rod (Bamboo)", "type": "image", "source": f"{ui_dir}/rod.png", "desc": "Angler's rod with line for catching river fish"},
        {"id": "tool_fishing_rod_alt", "name": "Fishing Rod (Reinforced)", "type": "image", "source": f"{ui_dir}/rod alt.png", "desc": "Upgraded deep-water fishing rod"},
        {"id": "tool_sword", "name": "Hero's Sword", "type": "image", "source": f"{ui_dir}/sword.png", "desc": "Steel weapon for combat defense against dungeon foes"},
        {"id": "tool_basket", "name": "Forager's Woven Basket", "type": "image", "source": f"{ui_dir}/basket.png", "desc": "Gathering basket for harvesting crops and wild berries"}
    ]
    categories.append({"id": "tools", "title": "Tools & Implements", "desc": "Axe, Pickaxe, Shovel, Hammer, Watering Can, Fishing Rods, Sword, and Foraging Basket", "items": tool_items})

    # 18. UI Visuals
    cozy_dir = "Assets/DEMO_MegaCozyUIPack_doboui - copia"
    diary_dir = "Assets/PixelInventoryDiaryUI_FreeDemo"

    ui_items = [
        {"id": "ui_9slice_white", "name": "9-Slice Window Box (White)", "type": "image", "source": f"{ui_dir}/9slice_box_white/w_box_9slice_c.png", "desc": "Window background 9-slice panel"},
        {"id": "ui_bar_health", "name": "Health Bar (Red Full)", "type": "image", "source": f"{ui_dir}/redbar_00.png", "desc": "Player vital health meter bar"},
        {"id": "ui_bar_energy", "name": "Energy Bar (Green Full)", "type": "image", "source": f"{ui_dir}/greenbar_00.png", "desc": "Player stamina / energy meter"},
        {"id": "ui_bar_mana", "name": "Mana Bar (Blue Full)", "type": "image", "source": f"{ui_dir}/bluebar_00.png", "desc": "Magic / thirst meter"},
        {"id": "ui_cursor_01", "name": "Pixel Mouse Cursor (Pointer)", "type": "image", "source": f"{ui_dir}/cursor_01.png", "desc": "Crisp pixel-art arrow mouse cursor"},
        {"id": "ui_cursor_hand", "name": "Interactive Hand Cursor", "type": "image", "source": f"{ui_dir}/hand_open_01.png", "desc": "Open grab hand cursor for inventory and building"},
        {"id": "ui_emote_chat", "name": "Emote Bubble: Chat", "type": "image", "source": f"{ui_dir}/expression_chat.png", "desc": "NPC conversation speech balloon"},
        {"id": "ui_emote_love", "name": "Emote Bubble: Heart Love", "type": "image", "source": f"{ui_dir}/expression_love.png", "desc": "Animal friendship / romance heart icon"},
        {"id": "ui_emote_working", "name": "Emote Bubble: Working", "type": "image", "source": f"{ui_dir}/expression_working.png", "desc": "Crafting in-progress status balloon"},
        {"id": "ui_sandtimer", "name": "Hourglass Sandtimer", "type": "image", "source": f"{ui_dir}/sandtimer.png", "desc": "Crafting time remaining icon"},
        {"id": "ui_cozy_btn_wood", "name": "Cozy Button (Wood Play)", "type": "image", "source": f"{cozy_dir}/Buttons/ButtonsBuild/PlayButton.png", "desc": "Tactile wooden push button"},
        {"id": "ui_cozy_btn_picnic", "name": "Cozy Button (Picnic Blue)", "type": "image", "source": f"{cozy_dir}/Buttons/CozyPicnic/CozyPicnicButton_blue.png", "desc": "Pastel aesthetic action button"},
        {"id": "ui_cozy_card", "name": "Info Card Panel", "type": "image", "source": f"{cozy_dir}/Cards/Card1_gray.png", "desc": "Item description info container card"},
        {"id": "ui_cozy_frame", "name": "Wood Picture Frame", "type": "image", "source": f"{cozy_dir}/Frames/Frame1_wood.png", "desc": "Decorative border frame"},
        {"id": "ui_cozy_slot", "name": "Inventory Item Slot", "type": "image", "source": f"{cozy_dir}/Inventory/ItemSlots/ItemSlotsDefault/SlotDefaultl1_cream.png", "desc": "Hotbar and bag grid slot container"},
        {"id": "ui_cozy_toggle", "name": "Switch Toggle", "type": "image", "source": f"{cozy_dir}/Toggles/Toggle1.png", "desc": "Settings ON/OFF slider switch"},
        {"id": "ui_cozy_icon_heart", "name": "Flat Icon: Heart", "type": "image", "source": f"{cozy_dir}/Icons/IconsFlat_16px/IconFlat1.png", "desc": "16px flat UI health icon"},
        {"id": "ui_cozy_icon_coin", "name": "Flat Icon: Coin", "type": "image", "source": f"{cozy_dir}/Icons/IconsFlat_16px/IconFlat9.png", "desc": "16px flat UI economy icon"},
        {"id": "ui_cozy_icon_bag", "name": "Flat Icon: Backpack", "type": "image", "source": f"{cozy_dir}/Icons/IconsFlat_16px/IconFlat10.png", "desc": "16px flat UI inventory bag icon"},
        {"id": "ui_diary_panel", "name": "Diary Item Area Panel", "type": "image", "source": f"{diary_dir}/UI_Elements_Demo/UI_Panel_ItemArea.png", "desc": "Illustrated quest & inventory diary background"},
        {"id": "ui_diary_badge_rose", "name": "Deco Icon: Single Rose", "type": "image", "source": f"{diary_dir}/Icons_Demo/UI_Icon_SingleRose.png", "desc": "Diary gift and romance achievement rose"}
    ]
    categories.append({"id": "ui_visuals", "title": "UI Visuals (MegaCozy, PixelDiary & Sunnyside)", "desc": "Buttons, Frames, Cards, Inventory slots, Flat icons, Health/Stamina bars, 9-slice boxes, Dialogue bubbles, and Diary panels", "items": ui_items})

    return categories

def resolve_and_layout(categories):
    START_X = 60
    START_Y = 120
    SECTION_SPACING_Y = 140
    COL_SPACING = 30
    ROW_SPACING = 36
    MAX_ROW_WIDTH = 2200

    current_y = START_Y
    resolved_categories = []

    for cat in categories:
        cat_id = cat["id"]
        cat_title = cat["title"]
        cat_desc = cat["desc"]
        items = cat["items"]

        cat_x = START_X
        cat_start_y = current_y

        resolved_items = []
        item_x = cat_x
        item_y = current_y + 70
        row_max_h = 0

        for itm in items:
            itype = itm["type"]
            w = 32
            h = 32
            source_path = ""
            frames = 1
            fps = 8

            if itype == "tileset_slice":
                crop = itm["crop"]
                w = crop[2]
                h = crop[3]
                source_path = itm["source"]
            elif itype == "image":
                info = get_image_info(itm["source"])
                if info:
                    w = info["width"]
                    h = info["height"]
                    source_path = itm["source"]
                    count, fw, fh = get_strip_frames(os.path.basename(source_path), w, h)
                    if count > 1:
                        frames = count
                        w = fw
                        h = fh
            elif itype == "animated_strip":
                info = get_image_info(itm["source"])
                if info:
                    source_path = itm["source"]
                    frames = itm.get("frames", 1)
                    fps = itm.get("fps", 8)
                    w = info["width"] // frames
                    h = info["height"]
            elif itype == "sprite_gm":
                sp_file = find_first_png_in_gamemaker_sprite(itm["sprite"])
                if sp_file:
                    info = get_image_info(sp_file)
                    if info:
                        w = info["width"]
                        h = info["height"]
                        source_path = sp_file
            elif itype == "iso_block":
                w = 48
                h = 48
                source_path = "[Procedural Isometric 3D-styled Block]"
            elif itype == "iso_overlay":
                w = 48
                h = 48
                source_path = "[Isometric UI Overlay Effect]"

            # Card size: enough room for character/strip preview without clipping
            card_w = max(100, w + 28)
            card_h = max(116, h + 50)

            if (item_x + card_w) > (START_X + MAX_ROW_WIDTH):
                item_x = START_X
                item_y += row_max_h + ROW_SPACING
                row_max_h = 0

            row_max_h = max(row_max_h, card_h)

            resolved_item = dict(itm)
            resolved_item.update({
                "x": item_x,
                "y": item_y,
                "w": w,
                "h": h,
                "cardW": card_w,
                "cardH": card_h,
                "sourcePath": source_path,
                "frames": frames,
                "fps": fps
            })
            resolved_items.append(resolved_item)

            item_x += card_w + COL_SPACING

        section_height = (item_y + row_max_h) - cat_start_y + 40
        current_y += section_height + SECTION_SPACING_Y

        resolved_categories.append({
            "id": cat_id,
            "title": cat_title,
            "desc": cat_desc,
            "y": cat_start_y,
            "height": section_height,
            "width": MAX_ROW_WIDTH + 80,
            "items": resolved_items
        })

    total_world_height = current_y + 200
    total_world_width = MAX_ROW_WIDTH + 200

    return resolved_categories, total_world_width, total_world_height

def generate_files():
    cats = build_catalog()
    resolved_cats, world_w, world_h = resolve_and_layout(cats)

    # 1. Generate map.txt
    map_lines = []
    map_lines.append("=" * 90)
    map_lines.append("           SUNNYSIDE 2D RTS/SURVIVAL GAME — VISUAL ASSET ATLAS MAP")
    map_lines.append("               Total Canvas Extents: " + str(world_w) + "px (W) x " + str(world_h) + "px (H)")
    map_lines.append("=" * 90)
    map_lines.append("")
    map_lines.append("This document is the master coordinate directory for every single asset and")
    map_lines.append("visual concept declared in v0.txt. Use these exact paths, slices, and canvas")
    map_lines.append("coordinates whenever referencing, spawning, or modifying assets.")
    map_lines.append("")
    map_lines.append("-" * 90)
    map_lines.append("CATEGORY                                      | ITEMS    | Y-POSITION")
    map_lines.append("-" * 90)
    for c in resolved_cats:
        t_str = c['title'].ljust(45)
        it_count = str(len(c['items'])).ljust(8)
        y_range = "Y: " + str(c['y']) + "px to " + str(c['y'] + c['height']) + "px"
        map_lines.append(t_str + " | " + it_count + " | " + y_range)
    map_lines.append("-" * 90)
    map_lines.append("")

    total_items = 0

    for cat_idx, cat in enumerate(resolved_cats, 1):
        map_lines.append("=" * 90)
        sec_num = str(cat_idx).zfill(2)
        map_lines.append("SECTION " + sec_num + ": " + cat['title'].upper())
        map_lines.append("Description: " + cat['desc'])
        map_lines.append("Bounds: X: 60px to " + str(cat['width']) + "px | Y: " + str(cat['y']) + "px to " + str(cat['y'] + cat['height']) + "px")
        map_lines.append("=" * 90)
        map_lines.append("ID                           | POS (X,Y)      | SIZE (WxH) | FRAMES | SOURCE PATH")
        map_lines.append("-" * 90)

        for itm in cat["items"]:
            total_items += 1
            pos_str = "(" + str(itm['x']) + "," + str(itm['y']) + ")"
            size_str = str(itm['w']) + "x" + str(itm['h'])
            frames_str = str(itm['frames']) + "f" if itm['frames'] > 1 else "1"
            id_str = itm['id'].ljust(28)
            pos_padded = pos_str.ljust(14)
            size_padded = size_str.ljust(10)
            frames_padded = frames_str.ljust(6)
            map_lines.append(id_str + " | " + pos_padded + " | " + size_padded + " | " + frames_padded + " | " + str(itm['sourcePath']))
            if itm.get("crop"):
                map_lines.append("  └─ Crop rect in tileset: [x:" + str(itm['crop'][0]) + ", y:" + str(itm['crop'][1]) + ", w:" + str(itm['crop'][2]) + ", h:" + str(itm['crop'][3]) + "]")
            map_lines.append("  └─ Name: " + itm['name'] + " — " + itm['desc'])
            map_lines.append("")

    map_lines.append("=" * 90)
    map_lines.append("TOTAL CATALOGED ITEMS: " + str(total_items) + " across " + str(len(resolved_cats)) + " categories")
    map_lines.append("=" * 90)

    with open(os.path.join(WORKSPACE, "map.txt"), "w") as f:
        f.write("\n".join(map_lines))

    print("Generated map.txt with " + str(total_items) + " items across " + str(len(resolved_cats)) + " categories.")

    # 2. Generate src/data/assetRegistry.ts
    cats_json = json.dumps(resolved_cats, indent=2)
    ts_code = [
        "// AUTO-GENERATED ASSET REGISTRY FOR PHASER 3 ATLAS",
        "// Contains spatial layout coordinates, sprite sources, slices and metadata for all v0.txt items.",
        "",
        "export interface AssetItem {",
        "  id: string;",
        "  name: string;",
        "  type: 'tileset_slice' | 'image' | 'animated_strip' | 'sprite_gm' | 'iso_block' | 'iso_overlay';",
        "  x: number;",
        "  y: number;",
        "  w: number;",
        "  h: number;",
        "  cardW: number;",
        "  cardH: number;",
        "  sourcePath: string;",
        "  frames: number;",
        "  fps: number;",
        "  desc: string;",
        "  source?: string;",
        "  sprite?: string;",
        "  crop?: [number, number, number, number];",
        "  topColor?: number;",
        "  sideColor?: number;",
        "  frontColor?: number;",
        "  alpha?: number;",
        "  heightRatio?: number;",
        "  slope?: boolean;",
        "  variant?: string;",
        "  cropType?: string;",
        "  stage?: number;",
        "}",
        "",
        "export interface AssetCategory {",
        "  id: string;",
        "  title: string;",
        "  desc: string;",
        "  y: number;",
        "  height: number;",
        "  width: number;",
        "  items: AssetItem[];",
        "}",
        "",
        "export interface AssetAtlasData {",
        "  worldWidth: number;",
        "  worldHeight: number;",
        "  totalItems: number;",
        "  categories: AssetCategory[];",
        "}",
        "",
        "export const ASSET_ATLAS_DATA: AssetAtlasData = {",
        "  worldWidth: " + str(world_w) + ",",
        "  worldHeight: " + str(world_h) + ",",
        "  totalItems: " + str(total_items) + ",",
        "  categories: " + cats_json,
        "};"
    ]

    with open(os.path.join(WORKSPACE, "src/data/assetRegistry.ts"), "w") as f:
        f.write("\n".join(ts_code))

    print("Generated src/data/assetRegistry.ts.")

if __name__ == "__main__":
    generate_files()
