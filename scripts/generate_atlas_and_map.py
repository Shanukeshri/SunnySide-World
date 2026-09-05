import os
import re
import json
from PIL import Image
import numpy as np

WORKSPACE = "/Users/shanukeshri983/Desktop/RTSGame"
NEW_TILESET_16 = "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Tileset/sprite_sheet_16x_transparent.png"
TILESET_FOREST_32 = "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Tileset/spr_tileset_sunnysideworld_forest_32px.png"

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
    except Exception:
        return None

def get_strip_frames(filename, w, h):
    match = re.search(r"strip(\d+)", filename, re.IGNORECASE)
    if match:
        count = int(match.group(1))
        frame_w = w // count
        frame_h = h
        return count, frame_w, frame_h
    return 1, w, h

def extract_all_transparent_tiles():
    full_path = os.path.join(WORKSPACE, NEW_TILESET_16)
    img = Image.open(full_path).convert("RGBA")
    arr = np.array(img)
    
    tiles = []
    # 64x64 grid of 16x16 tiles
    for r in range(64):
        for c in range(64):
            tile = arr[r*16:(r+1)*16, c*16:(c+1)*16]
            if np.any(tile[:, :, 3] > 0):
                x = c * 16
                y = r * 16
                cat, item_id, name, desc = classify_tile(r, c, x, y)
                tiles.append({
                    "cat": cat,
                    "id": item_id,
                    "name": name,
                    "desc": desc,
                    "crop": [x, y, 16, 16],
                    "type": "tileset_slice",
                    "source": NEW_TILESET_16
                })
    return tiles

def classify_tile(r, c, x, y):
    # Rows 0-9: World Terrain (Grass, Cliffs, Dirt, Sand, Stone, Paths, Water)
    if 0 <= r <= 9:
        if 0 <= c <= 16:
            if r in [1, 2, 3] and 0 <= c <= 8:
                return "world_terrain", f"terrain_grass_slope_r{r:02d}_c{c:02d}", f"Grass Terrain Slope ({r},{c})", f"Lush grass terrain slope, angle variation, and edge transition at [{x},{y}]"
            elif r in [4, 5, 6, 7] and 0 <= c <= 8:
                return "world_terrain", f"cliff_elevation_r{r:02d}_c{c:02d}", f"Cliff Elevation Face ({r},{c})", f"Natural earth cliff wall, height ledge, and elevation step at [{x},{y}]"
            elif 9 <= c <= 16:
                return "world_terrain", f"dirt_soil_r{r:02d}_c{c:02d}", f"Dirt Trail & Soil ({r},{c})", f"Rich brown dirt trail, earth connection, and soil shading at [{x},{y}]"
            else:
                return "world_terrain", f"terrain_grass_edge_r{r:02d}_c{c:02d}", f"Grass & Earth Border ({r},{c})", f"Grass and soil gradient boundary tile at [{x},{y}]"
        elif 17 <= c <= 36:
            if 17 <= c <= 26:
                return "world_terrain", f"sand_dune_r{r:02d}_c{c:02d}", f"Sand & Desert Dune ({r},{c})", f"Warm golden sand dune, beach shore angle, and desert transition at [{x},{y}]"
            elif 27 <= c <= 36:
                return "world_terrain", f"stone_cobble_r{r:02d}_c{c:02d}", f"Stone & Cobble Path ({r},{c})", f"Cobblestone walkway, natural stone flagstone, and paved path edge at [{x},{y}]"
        elif 37 <= c <= 43:
            if 0 <= r <= 4 and 38 <= c <= 40:
                fence_names = {
                    (0, 38): ("fence_timber_post_top", "Wooden Fence Post Top (0,38)", "Top cap of timber fence post"),
                    (0, 39): ("fence_timber_rail_top", "Wooden Fence Rail Top (0,39)", "Top horizontal rail of wooden fence"),
                    (1, 38): ("fence_timber_post_mid", "Wooden Fence Post (1,38)", "Vertical wooden post segment"),
                    (1, 39): ("fence_timber_corner_ne", "Wooden Fence Corner North-East (1,39)", "Corner fence segment extending north and east"),
                    (1, 40): ("fence_timber_rail_v_top", "Wooden Fence North-South Rail Top (1,40)", "Vertical north-south extending fence segment connecting upward"),
                    (2, 38): ("fence_timber_post", "Wooden Fence Standalone Post (2,38)", "Standalone wooden fence post segment"),
                    (2, 39): ("fence_timber_rail_h", "Wooden Fence Horizontal Rail (2,39)", "Horizontal continuous wooden fence rail extending left and right with post"),
                    (2, 40): ("fence_timber_corner", "Wooden Fence Corner Post (2,40)", "Wooden fence corner post joint connecting perimeter fences"),
                    (3, 39): ("fence_timber_stub", "Wooden Fence Post Stubs (3,39)", "Twin timber post stubs"),
                    (3, 40): ("fence_timber_rail_v_bot", "Wooden Fence North-South Rail (3,40)", "Vertical north-south extending fence rail segment"),
                    (4, 38): ("fence_timber_tip", "Wooden Fence Post Tip (4,38)", "Pointed timber post stake"),
                    (4, 40): ("fence_timber_rail_v_cap", "Wooden Fence North-South Rail Bottom (4,40)", "Bottom termination of vertical north-south fence rail"),
                }
                fid, fname, fdesc = fence_names.get((r, c), (f"fence_timber_r{r:02d}_c{c:02d}", f"Wooden Fence ({r},{c})", "Modular timber fence segment"))
                return "buildings", fid, fname, f"{fdesc} at [{x},{y}]"
            return "water_aquatic", f"water_shoreline_r{r:02d}_c{c:02d}", f"Water & Shore Bank ({r},{c})", f"Flowing river water, shore corner transition, and coastline bank at [{x},{y}]"
        elif 44 <= c <= 63:
            if r in [0, 1, 2, 3]:
                return "buildings", f"roof_shingle_r{r:02d}_c{c:02d}", f"Roof Shingle & Eave ({r},{c})", f"Modular cottage roof shingle slope, ridge, and overhang at [{x},{y}]"
            else:
                return "buildings", f"wall_timber_r{r:02d}_c{c:02d}", f"Timber Wall & Boardwalk ({r},{c})", f"Wooden plank building facade, doorway, window frame, or boardwalk at [{x},{y}]"

    # Rows 10-17: Building structures, walls, fences, doors (Cols 40-63)
    if 10 <= r <= 17:
        if 40 <= c <= 63:
            return "buildings", f"building_facade_r{r:02d}_c{c:02d}", f"Building Facade & Panel ({r},{c})", f"Architectural timber beam, exterior planking, window, or door at [{x},{y}]"
        elif 34 <= c <= 39:
            return "dungeon_visuals", f"dungeon_arch_r{r:02d}_c{c:02d}", f"Stone Dungeon Arch ({r},{c})", f"Carved stone archway, dungeon pillar column, and cavern wall at [{x},{y}]"

    # Rows 18-27: Dungeon stone stairs, masonry, farmland, water ripples, fences
    if 18 <= r <= 27:
        if 11 <= c <= 15:
            return "farm_objects", f"fence_bridge_r{r:02d}_c{c:02d}", f"Wooden Fence & Gate ({r},{c})", f"Farmyard post fence, corral gate, and footbridge crossing plank at [{x},{y}]"
        elif 34 <= c <= 48:
            return "dungeon_visuals", f"dungeon_step_r{r:02d}_c{c:02d}", f"Dungeon Step & Masonry ({r},{c})", f"Chiseled dungeon staircase step, masonry floor slab, and dungeon ledge at [{x},{y}]"
        elif 49 <= c <= 55:
            return "farming_crops", f"farmland_furrow_r{r:02d}_c{c:02d}", f"Farmland Soil Furrow ({r},{c})", f"Tilled garden plot furrow, irrigation channel, and fertile crop soil at [{x},{y}]"
        elif 56 <= c <= 63:
            return "water_aquatic", f"water_wave_foam_r{r:02d}_c{c:02d}", f"Water Wave Foam ({r},{c})", f"Water ripple surface, flowing river foam, and wave sparkle at [{x},{y}]"

    # Rows 28-37: Plants, Foliage, Trees, Stumps, Stone steps
    if 28 <= r <= 37:
        if 0 <= c <= 10:
            return "plants", f"wild_flora_r{r:02d}_c{c:02d}", f"Wild Flora & Foliage ({r},{c})", f"Wild grass tuft, forest mushroom, tree base, root stump, or greenery at [{x},{y}]"
        elif 36 <= c <= 42:
            return "world_terrain", f"flagstone_step_r{r:02d}_c{c:02d}", f"Flagstone Step ({r},{c})", f"Garden walkway flagstone, rock border, and paved ground step at [{x},{y}]"
        elif 49 <= c <= 55:
            return "farming_crops", f"garden_bed_r{r:02d}_c{c:02d}", f"Garden Bed Ridge ({r},{c})", f"Cultivated garden plot ridge and crop planting bed border at [{x},{y}]"

    # Rows 44-49: Special deep water / liquid layers
    if 44 <= r <= 49:
        if 36 <= c <= 46:
            return "water_aquatic", f"water_depth_r{r:02d}_c{c:02d}", f"Deep Water Gradient ({r},{c})", f"Submerged deep water gradient, lake floor tier, and liquid flow tile at [{x},{y}]"

    # Fallback
    return "world_terrain", f"tileset_slice_r{r:02d}_c{c:02d}", f"Tileset Slice ({r},{c})", f"16x16 modular tile from transparent sprite sheet at [{x},{y}]"

def build_catalog():
    extracted_tiles = extract_all_transparent_tiles()
    tiles_by_cat = {}
    for t in extracted_tiles:
        tiles_by_cat.setdefault(t["cat"], []).append(t)

    categories = []

    # 1. World / Terrain
    world_items = list(tiles_by_cat.get("world_terrain", []))
    world_items.extend([
        {"id": "small_rock_01", "name": "Small Rock Decor", "type": "image", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/rock.png", "desc": "Small scatter rock for natural ground decoration"},
        {"id": "flowers_wild_01", "name": "Wild Flowers (Scatter 1)", "type": "sprite_gm", "sprite": "spr_deco_flowers_house_01", "desc": "Wild field flowers in blooming colors"},
        {"id": "flowers_wild_02", "name": "Wild Flowers (Scatter 2)", "type": "sprite_gm", "sprite": "spr_deco_flowers_house_02", "desc": "Clumped cottage flowers"},
        {"id": "mushrooms_deco_blue", "name": "Blue Forest Mushroom", "type": "sprite_gm", "sprite": "spr_deco_mushroom_blue_01", "desc": "Glowing wild blue forest mushrooms"},
        {"id": "mushrooms_deco_red", "name": "Red Forest Mushroom", "type": "sprite_gm", "sprite": "spr_deco_mushroom_red_01", "desc": "Classic red cap spotted forest mushroom"},
        {"id": "acorn_deco_01", "name": "Fallen Forest Acorn", "type": "sprite_gm", "sprite": "spr_deco_acron", "desc": "Fallen oak acorn scatter item"},
        {"id": "truffle_deco_01", "name": "Wild Truffle Mushroom", "type": "sprite_gm", "sprite": "spr_deco_truffle", "desc": "Rare forageable wild ground truffle"}
    ])
    categories.append({"id": "world_terrain", "title": "World / Terrain (All Slopes & Transitions)", "desc": "Exhaustive 16x16 terrain tiles: Lush grass, slopes, cliffs, elevation ledges, dirt trails, sand dunes, cobblestone paths, and shorelines", "items": world_items})

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

    # 6. Trees & Species Progression
    tree_items = [
        {"id": "tree_oak_01", "name": "Oak Tree (Deciduous)", "type": "sprite_gm", "sprite": "spr_deco_tree_01", "desc": "Full green foliage deciduous oak tree (32x34)"},
        {"id": "tree_pine_01", "name": "Pine / Evergreen Tree", "type": "sprite_gm", "sprite": "spr_deco_tree_02", "desc": "Slender evergreen pine tree (28x43)"},
        {"id": "tree_sway_strip", "name": "Swaying Canopy Tree", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Plants/spr_deco_tree_02_strip4.png", "frames": 4, "fps": 4, "desc": "Wind blowing gentle tree animation (28x43, 4 frames)"},
        {"id": "tree_prog_small", "name": "Tree Sapling Sprout", "type": "tileset_slice", "source": TILESET_FOREST_32, "crop": [32, 32, 32, 32], "desc": "Growing young tree sapling"},
        {"id": "tree_prog_stump", "name": "Chopped Forest Stump", "type": "tileset_slice", "source": TILESET_FOREST_32, "crop": [256, 96, 32, 32], "desc": "Harvested tree stump with rings"}
    ]
    categories.append({"id": "trees", "title": "Trees & Species Progression", "desc": "Oak trees, Pine trees, Animated swaying trees, and tree stumps", "items": tree_items})

    # 7. Plants & Foliage
    plant_items = list(tiles_by_cat.get("plants", []))
    plant_items.extend([
        {"id": "plant_shroom_blue_01", "name": "Blue Mushroom Spores", "type": "sprite_gm", "sprite": "spr_deco_mushroom_blue_01", "desc": "Bioluminescent blue mushroom (16x16)"},
        {"id": "plant_shroom_blue_02", "name": "Blue Mushroom Cluster", "type": "sprite_gm", "sprite": "spr_deco_mushroom_blue_02", "desc": "Medium cluster blue forest mushroom"},
        {"id": "plant_shroom_blue_03", "name": "Giant Blue Toadstool", "type": "sprite_gm", "sprite": "spr_deco_mushroom_blue_03", "desc": "Large blue cap toadstool"},
        {"id": "plant_shroom_red_01", "name": "Red Forest Mushroom", "type": "sprite_gm", "sprite": "spr_deco_mushroom_red_01", "desc": "Classic spotted red toadstool"},
        {"id": "plant_flowers_01", "name": "Cottage Flower Bed 01", "type": "sprite_gm", "sprite": "spr_deco_flowers_house_01", "desc": "Blooming front porch floral arrangement"},
        {"id": "plant_flowers_02", "name": "Cottage Flower Bed 02", "type": "sprite_gm", "sprite": "spr_deco_flowers_house_02", "desc": "Pastel flower bed detail"}
    ])
    categories.append({"id": "plants", "title": "Plants & Foliage (Wild Flora & Stumps)", "desc": "All wild mushrooms, ground flora, root stumps, wild grass tufts, and foliage overlays", "items": plant_items})

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

    farming_items = list(tiles_by_cat.get("farming_crops", []))
    farming_items.append({"id": "crop_seeds_generic", "name": "Generic Crop Seeds Pouch", "type": "image", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/seeds_generic.png", "desc": "Seed bag for planting farm crops"})

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

    categories.append({"id": "farming_crops", "title": "Farming & Crops (Furrows & Growth Stages)", "desc": "Farmland soil furrows, irrigation channels, and complete growth sequences for all 11 crops (Wheat, Carrot, Potato, Pumpkin, etc.)", "items": farming_items})

    # 9. Farm Objects & Storage
    farm_obj_items = list(tiles_by_cat.get("farm_objects", []))
    farm_obj_items.extend([
        {"id": "farm_soil_00", "name": "Tilled Soil (Dry)", "type": "image", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/soil_00.png", "desc": "Freshly hoed soil tile"},
        {"id": "farm_soil_01", "name": "Tilled Soil (Wet / Watered)", "type": "image", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/soil_01.png", "desc": "Watered dark fertile soil ready for growth"},
        {"id": "farm_well", "name": "Stone Water Well", "type": "sprite_gm", "sprite": "spr_deco_well", "desc": "Village stone water well with bucket"},
        {"id": "farm_well_covered", "name": "Roofed Water Well", "type": "sprite_gm", "sprite": "spr_deco_well_covered", "desc": "Sheltered timber-roofed well"},
        {"id": "farm_trough", "name": "Animal Feed Trough", "type": "sprite_gm", "sprite": "spr_deco_trough", "desc": "Wooden feeding trough for livestock"},
        {"id": "farm_waterbowl", "name": "Animal Water Bowl", "type": "sprite_gm", "sprite": "spr_deco_waterbowl", "desc": "Clay watering bowl for pets & poultry"},
        {"id": "farm_crate_01", "name": "Wooden Crate (Small)", "type": "sprite_gm", "sprite": "spr_deco_crate_01", "desc": "Small goods storage crate"},
        {"id": "farm_crate_02", "name": "Wooden Crate (Large)", "type": "sprite_gm", "sprite": "spr_deco_crate_02", "desc": "Large reinforced cargo crate"},
        {"id": "farm_chest_closed", "name": "Chest 01 (Closed)", "type": "sprite_gm", "sprite": "spr_deco_chest_01_closed", "desc": "Wood and iron lockbox closed"},
        {"id": "farm_chest_open", "name": "Chest 01 (Open)", "type": "sprite_gm", "sprite": "spr_deco_chest_01_open", "desc": "Wood and iron lockbox open with inventory"},
        {"id": "farm_chest2_closed", "name": "Chest 02 (Golden Closed)", "type": "sprite_gm", "sprite": "spr_deco_chest_02_closed", "desc": "Ornate treasure chest closed"}
    ])
    categories.append({"id": "farm_objects", "title": "Farm Objects & Storage", "desc": "Wooden fences, corral gates, bridge crossings, water wells, troughs, crates, and storage chests", "items": farm_obj_items})

    # 10. Buildings & Modular Construction Pieces
    bld_items = list(tiles_by_cat.get("buildings", []))
    bld_items.extend([
        {"id": "bld_windmill", "name": "Windmill (Animated 9-Frame)", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Other/spr_deco_windmill_withshadow_strip9.png", "frames": 9, "fps": 8, "desc": "Large 112x112 rotating grain windmill structure"},
        {"id": "piece_beam", "name": "Structural Wooden Beam", "type": "sprite_gm", "sprite": "spr_deco_beam", "desc": "Heavy timber construction beam"},
        {"id": "piece_chimney_brick", "name": "Brick Chimney", "type": "sprite_gm", "sprite": "spr_deco_chinmney", "desc": "Cottage rooftop brick chimney"},
        {"id": "piece_chimney_cook", "name": "Cookhouse Stove Chimney", "type": "sprite_gm", "sprite": "spr_deco_cook_chinmney", "desc": "Stove chimney with stovepipe"}
    ])
    categories.append({"id": "buildings", "title": "Buildings & Modular Construction Pieces", "desc": "Complete modular cottage roof shingles, timber wall facades, doors, windows, beams, and windmill", "items": bld_items})

    # 11. Water, Aquatic & Depth Layers
    water_items = list(tiles_by_cat.get("water_aquatic", []))
    water_items.extend([
        {"id": "boat_coracle_water", "name": "Coracle Boat (Floating 4-Frame)", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Other/spr_deco_coracle_strip4.png", "frames": 4, "fps": 4, "desc": "Round traditional fishing coracle boat in water (48x37)"},
        {"id": "boat_coracle_land", "name": "Coracle Boat (Dry Land)", "type": "image", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Other/spr_deco_coracle_land.png", "desc": "Beached coracle boat on shore (32x30)"},
        {"id": "boat_oar", "name": "Wooden Rowing Oar", "type": "sprite_gm", "sprite": "spr_deco_oar", "desc": "Boat steering and rowing paddle"}
    ])
    categories.append({"id": "water_aquatic", "title": "Water, Aquatic & Depth Layers", "desc": "Coastline shorelines, river currents, wave foams, deep ocean gradients, and floating coracle boats", "items": water_items})

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
    dungeon_items = list(tiles_by_cat.get("dungeon_visuals", []))
    dungeon_items.extend([
        {"id": "dungeon_minecart", "name": "Dungeon Ore Minecart", "type": "sprite_gm", "sprite": "spr_deco_minecart", "desc": "Subterranean rail ore transport cart"},
        {"id": "dungeon_sword_floor", "name": "Sword Embedded in Floor", "type": "sprite_gm", "sprite": "spr_deco_sword_floor", "desc": "Ancient warrior sword stuck in dungeon stone"},
        {"id": "dungeon_chest_closed", "name": "Ornate Dungeon Chest", "type": "sprite_gm", "sprite": "spr_deco_chest_02_closed", "desc": "Gold trim dungeon vault chest"}
    ])
    categories.append({"id": "dungeon_visuals", "title": "Dungeon Visuals & Masonry", "desc": "Dungeon stone staircases, archways, pillar columns, minecarts, and treasure chests", "items": dungeon_items})

    # 15. Weather, Atmosphere & VFX
    vfx_items = [
        {"id": "vfx_smoke_01", "name": "Chimney Smoke 01", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/VFX/Chimney Smoke/chimneysmoke_01_strip30.png", "frames": 30, "fps": 15, "desc": "Soft rising white chimney puff (15x37, 30 frames)"},
        {"id": "vfx_smoke_02", "name": "Chimney Smoke 02", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/VFX/Chimney Smoke/chimneysmoke_02_strip30.png", "frames": 30, "fps": 15, "desc": "Dense billowing woodfire smoke (10x30, 30 frames)"},
        {"id": "vfx_smoke_03", "name": "Chimney Smoke 03", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/VFX/Chimney Smoke/chimneysmoke_03_strip30.png", "frames": 30, "fps": 15, "desc": "Whispering drifting chimney plume (18x21, 30 frames)"},
        {"id": "vfx_fire_01", "name": "Campfire Flame 01", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/VFX/Fire/spr_deco_fire_01_strip4.png", "frames": 4, "fps": 8, "desc": "Flickering warm fire effect"},
        {"id": "vfx_fire_02", "name": "Furnace Flame 02", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/VFX/Fire/spr_deco_fire_02_strip4.png", "frames": 4, "fps": 8, "desc": "Roaring hearth fire animation"},
        {"id": "vfx_glint_01", "name": "Sparkle Glint 01", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/VFX/Glint/spr_deco_glint_01_strip6.png", "frames": 6, "fps": 8, "desc": "Treasure and ore shimmer sparkle (6 frames)"},
        {"id": "vfx_glint_02", "name": "Star Sparkle 02", "type": "animated_strip", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/VFX/Glint/spr_deco_glint_02_strip4.png", "frames": 4, "fps": 6, "desc": "Item discovery twinkle effect (4 frames)"}
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
        {"id": "furn_barrel_swords", "name": "Weapons Barrel (Swords)", "type": "sprite_gm", "sprite": "spr_deco_barrel_swords", "desc": "Armory barrel storing blades"}
    ]
    categories.append({"id": "furniture_deco", "title": "Player Construction & Furniture", "desc": "Chairs, sidetables, rugs, paintings, anvils, campfires, and storage barrels", "items": deco_items})

    # 17. Tools & Equipment
    tools_items = [
        {"id": "tool_axe", "name": "Woodcutter Axe", "type": "image", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/axe.png", "desc": "Chopping wood & felling trees tool"},
        {"id": "tool_pickaxe", "name": "Mining Pickaxe", "type": "image", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/pickaxe.png", "desc": "Excavating rock & mining underground ores"},
        {"id": "tool_shovel", "name": "Tilling Shovel", "type": "image", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/shovel.png", "desc": "Digging earth & prepping soil beds"},
        {"id": "tool_watering_can", "name": "Watering Can", "type": "image", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/watering_can.png", "desc": "Irrigating farm seeds and thirsty crops"},
        {"id": "tool_fishing_rod", "name": "Fishing Rod", "type": "image", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/fishing_rod.png", "desc": "Catching fish in rivers, lakes & oceans"},
        {"id": "tool_bucket", "name": "Wooden Bucket", "type": "image", "source": "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Crops/bucket.png", "desc": "Liquid transport & dairy milking bucket"}
    ]
    categories.append({"id": "tools", "title": "Tools & Equipment", "desc": "Axe, Pickaxe, Shovel, Watering Can, Fishing Rod, and Bucket", "items": tools_items})

    # 18. UI Visuals
    cozy_dir = "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/MegaCozy_UI_Pack"
    diary_dir = "Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/UI/PixelDiary_UI_Pack"
    ui_items = [
        {"id": "ui_cozy_btn_cyan", "name": "Button: Blue Cyan (Small)", "type": "image", "source": f"{cozy_dir}/Buttons/Buttons_Square_Small/Button_Square_Small_Blue.png", "desc": "Vibrant blue clickable square button"},
        {"id": "ui_cozy_btn_green", "name": "Button: Emerald Green (Small)", "type": "image", "source": f"{cozy_dir}/Buttons/Buttons_Square_Small/Button_Square_Small_Green.png", "desc": "Emerald green affirmative action button"},
        {"id": "ui_cozy_btn_amber", "name": "Button: Amber Gold (Small)", "type": "image", "source": f"{cozy_dir}/Buttons/Buttons_Square_Small/Button_Square_Small_Yellow.png", "desc": "Amber warning / special button"},
        {"id": "ui_cozy_btn_red", "name": "Button: Ruby Red (Small)", "type": "image", "source": f"{cozy_dir}/Buttons/Buttons_Square_Small/Button_Square_Small_Red.png", "desc": "Ruby red danger / cancel button"},
        {"id": "ui_cozy_inv_slot", "name": "Inventory Item Slot (Wood Frame)", "type": "image", "source": f"{cozy_dir}/Slots/Slot_Square_Small/Slot_Square_Small_White.png", "desc": "Crisp white item slot frame"},
        {"id": "ui_cozy_icon_heart", "name": "Flat Icon: Heart (HP)", "type": "image", "source": f"{cozy_dir}/Icons/IconsFlat_16px/IconFlat01.png", "desc": "16px flat heart health UI icon"},
        {"id": "ui_cozy_icon_coin", "name": "Flat Icon: Gold Coin", "type": "image", "source": f"{cozy_dir}/Icons/IconsFlat_16px/IconFlat02.png", "desc": "16px flat coin economy UI icon"},
        {"id": "ui_cozy_icon_star", "name": "Flat Icon: Level Star", "type": "image", "source": f"{cozy_dir}/Icons/IconsFlat_16px/IconFlat03.png", "desc": "16px flat experience star icon"},
        {"id": "ui_cozy_icon_potion", "name": "Flat Icon: Potion Flask", "type": "image", "source": f"{cozy_dir}/Icons/IconsFlat_16px/IconFlat04.png", "desc": "16px flat health potion icon"},
        {"id": "ui_cozy_icon_sword", "name": "Flat Icon: Attack Sword", "type": "image", "source": f"{cozy_dir}/Icons/IconsFlat_16px/IconFlat05.png", "desc": "16px flat melee attack sword icon"},
        {"id": "ui_cozy_icon_shield", "name": "Flat Icon: Defense Shield", "type": "image", "source": f"{cozy_dir}/Icons/IconsFlat_16px/IconFlat06.png", "desc": "16px flat armor defense shield icon"},
        {"id": "ui_cozy_icon_gem", "name": "Flat Icon: Crystal Gem", "type": "image", "source": f"{cozy_dir}/Icons/IconsFlat_16px/IconFlat07.png", "desc": "16px flat premium gemstone icon"},
        {"id": "ui_cozy_icon_key", "name": "Flat Icon: Dungeon Key", "type": "image", "source": f"{cozy_dir}/Icons/IconsFlat_16px/IconFlat08.png", "desc": "16px flat dungeon chest key icon"},
        {"id": "ui_cozy_icon_food", "name": "Flat Icon: Food Bread", "type": "image", "source": f"{cozy_dir}/Icons/IconsFlat_16px/IconFlat09.png", "desc": "16px flat survival food icon"},
        {"id": "ui_cozy_icon_bag", "name": "Flat Icon: Backpack", "type": "image", "source": f"{cozy_dir}/Icons/IconsFlat_16px/IconFlat10.png", "desc": "16px flat UI inventory bag icon"},
        {"id": "ui_diary_panel", "name": "Diary Item Area Panel", "type": "image", "source": f"{diary_dir}/UI_Elements_Demo/UI_Panel_ItemArea.png", "desc": "Illustrated quest & inventory diary background"},
        {"id": "ui_diary_badge_rose", "name": "Deco Icon: Single Rose", "type": "image", "source": f"{diary_dir}/Icons_Demo/UI_Icon_SingleRose.png", "desc": "Diary gift and romance achievement rose"}
    ]
    categories.append({"id": "ui_visuals", "title": "UI Visuals (MegaCozy, PixelDiary & Sunnyside)", "desc": "Buttons, Frames, Cards, Inventory slots, Flat icons, Health/Stamina bars, 9-slice boxes, Dialogue bubbles, and Diary panels", "items": ui_items})

    return categories

def resolve_and_layout(categories):
    START_X = 60
    START_Y = 120
    SECTION_SPACING_Y = 100
    COL_SPACING = 14
    ROW_SPACING = 14
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
            w = 16
            h = 16
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

            # Compact, clean card sizing (48x48 for 16x16, 56x56 for 32x32, larger for characters)
            if w <= 16 and h <= 16:
                card_w = 48
                card_h = 48
            elif w <= 32 and h <= 32:
                card_w = 56
                card_h = 56
            else:
                card_w = max(64, w + 16)
                card_h = max(64, h + 16)

            if (item_x + card_w) > (START_X + MAX_ROW_WIDTH):
                item_x = START_X
                item_y += row_max_h + ROW_SPACING
                row_max_h = 0

            row_max_h = max(row_max_h, card_h)

            resolved_item = dict(itm)
            if "cat" in resolved_item:
                del resolved_item["cat"]
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

        section_height = (item_y + row_max_h) - cat_start_y + 30
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
    map_lines.append("visual concept. Use these exact paths, slices, and canvas coordinates whenever")
    map_lines.append("referencing, spawning, or modifying assets.")
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
        "// Contains spatial layout coordinates, sprite sources, slices and metadata for all assets.",
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
