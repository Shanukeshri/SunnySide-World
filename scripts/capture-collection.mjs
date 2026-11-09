import puppeteer from 'puppeteer-core';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const LOCAL_DIR = '/Users/shanukeshri983/Desktop/RTSGame/screenshots/collection';
const ARTIFACT_DIR = '/Users/shanukeshri983/.gemini/antigravity/brain/81e1705d-2f19-444c-8cab-428b8abc028c/screenshots';

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  await mkdir(LOCAL_DIR, { recursive: true });
  await mkdir(ARTIFACT_DIR, { recursive: true });

  console.log('🚀 Starting Screenshot Collection Generation in 1920x1080...');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
  });

  const page = (await browser.pages())[0];
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await wait(1200);

  // Click singleplayer
  await page.evaluate(() => {
    const sp = document.getElementById('btn-menu-singleplayer');
    if (sp) sp.click();
  });
  await wait(1800);

  const manifest = [];

  async function captureShot(filename, category, title, description, setupFn) {
    console.log(`\n📸 Capturing: [${category}] ${title} (${filename})...`);
    await page.evaluate(setupFn);
    await wait(750); // wait for renderer cycle and lighting to stabilize

    const localPath = path.join(LOCAL_DIR, filename);
    const artifactPath = path.join(ARTIFACT_DIR, filename);

    await page.screenshot({ path: localPath });
    await copyFile(localPath, artifactPath);

    manifest.push({
      filename,
      category,
      title,
      description,
      localPath,
      artifactPath,
    });
    console.log(`   ✅ Saved to ${localPath}`);
  }

  // ══════════════════════════════════════════════════════════════════
  // CATEGORY 1: FARMS & AGRICULTURE
  // ══════════════════════════════════════════════════════════════════

  // 1. Oakvale Central Farm
  await captureShot(
    '01_farms_lush_village_crops.png',
    'Farms',
    'Oakvale Central Vegetable Fields',
    'Sprawling organic village farm plot with flourishing crop rows, irrigation paths, and wooden fencing.',
    () => {
      const e = window.survivalEngine;
      const r = window.survivalRenderer;
      e.worldTime.timeOfDay = 'Day';
      e.worldTime.hour = 11;
      e.worldTime.minute = 30;
      e.worldTime.lightLevel = 1.0;

      // Farm at (21, 65), w: 13, h: 15
      const cx = 27.5;
      const cy = 72.5;
      e.player.x = cx;
      e.player.y = cy;
      e.player.direction = 'DOWN';
      e.player.facing = 'DOWN';
      e.hotbar[e.activeHotbarIndex] = { item: 'watering_can', count: 1 };
      e.player.activeHeldItem = 'watering_can';

      r.cameraX = cx;
      r.cameraY = cy;
      r.zoom = 2.2;
    }
  );

  // 2. Pumpkin Patch Farm
  await captureShot(
    '02_farms_pumpkin_harvest.png',
    'Farms',
    'Golden Pumpkin Patch',
    'Round orange pumpkins basking in the sunlight surrounded by tilled soil and village roads.',
    () => {
      const e = window.survivalEngine;
      const r = window.survivalRenderer;
      e.worldTime.timeOfDay = 'Day';
      e.worldTime.hour = 12;
      e.worldTime.lightLevel = 1.0;

      // Pumpkin farm at (40, 19), w: 14, h: 10
      const cx = 47;
      const cy = 24;
      e.player.x = cx - 2;
      e.player.y = cy;
      e.player.direction = 'RIGHT';
      e.player.facing = 'RIGHT';
      e.hotbar[e.activeHotbarIndex] = { item: 'pumpkin', count: 5 };
      e.player.activeHeldItem = 'pumpkin';

      r.cameraX = cx;
      r.cameraY = cy;
      r.zoom = 2.5;
    }
  );

  // 3. Close-up Crop Tending
  await captureShot(
    '03_farms_tending_crop_closeup.png',
    'Farms',
    'Crop Inspection (Macro Zoom)',
    'High-magnification close-up of tilled soil furrows, budding carrots, and player tending the harvest.',
    () => {
      const e = window.survivalEngine;
      const r = window.survivalRenderer;
      e.worldTime.timeOfDay = 'Day';
      e.worldTime.hour = 10;
      e.worldTime.lightLevel = 1.0;

      // Carrot farm at (86, 17), w: 19, h: 16
      const cx = 93;
      const cy = 25;
      e.player.x = cx;
      e.player.y = cy;
      e.player.direction = 'DOWN';
      e.player.facing = 'DOWN';
      e.hotbar[e.activeHotbarIndex] = { item: 'watering_can', count: 1 };
      e.player.activeHeldItem = 'watering_can';

      r.cameraX = cx;
      r.cameraY = cy;
      r.zoom = 3.3; // Macro zoom
    }
  );

  // 4. Farmstead Potato Fields
  await captureShot(
    '04_farms_potato_farmstead.png',
    'Farms',
    'Rustic Potato Farmstead',
    'Abundant potato fields bordering country pathways and stone borders.',
    () => {
      const e = window.survivalEngine;
      const r = window.survivalRenderer;
      e.worldTime.timeOfDay = 'Day';
      e.worldTime.hour = 14;
      e.worldTime.lightLevel = 1.0;

      // Farm at (17, 48), w: 25, h: 7
      const cx = 29.5;
      const cy = 51.5;
      e.player.x = cx;
      e.player.y = cy;
      e.player.direction = 'UP';
      e.player.facing = 'UP';
      e.hotbar[e.activeHotbarIndex] = { item: 'potato', count: 12 };
      e.player.activeHeldItem = 'potato';

      r.cameraX = cx;
      r.cameraY = cy;
      r.zoom = 2.4;
    }
  );

  // 5. Golden Sunset Farmland
  await captureShot(
    '05_farms_golden_sunset_harvest.png',
    'Farms',
    'Sunset Over Farmland (Panoramic)',
    'Panoramic wide-angle view of the agricultural plots washed in warm golden evening sunset tones.',
    () => {
      const e = window.survivalEngine;
      const r = window.survivalRenderer;
      e.worldTime.timeOfDay = 'Sunset';
      e.worldTime.hour = 19;
      e.worldTime.minute = 15;
      e.worldTime.lightLevel = 0.58;

      const cx = 26;
      const cy = 60;
      e.player.x = cx;
      e.player.y = cy;
      e.player.direction = 'LEFT';
      e.player.facing = 'LEFT';
      e.hotbar[e.activeHotbarIndex] = { item: 'wheat', count: 20 };
      e.player.activeHeldItem = 'wheat';

      r.cameraX = cx;
      r.cameraY = cy;
      r.zoom = 1.8; // Wide view
    }
  );

  // ══════════════════════════════════════════════════════════════════
  // CATEGORY 2: HOUSES & ARCHITECTURE
  // ══════════════════════════════════════════════════════════════════

  // 6. Noble Manor Facade
  await captureShot(
    '06_houses_noble_manor_facade.png',
    'Houses',
    'The Grand Noble Manor',
    'Majestic multi-gable stone manor featuring slate roof tiles, double chimney stacks, and stone masonry.',
    () => {
      const e = window.survivalEngine;
      const r = window.survivalRenderer;
      e.worldTime.timeOfDay = 'Day';
      e.worldTime.hour = 11;
      e.worldTime.lightLevel = 1.0;

      // Manor at (21, 28), w: 12, h: 9, door: (24, 36)
      const cx = 27;
      const cy = 34;
      e.player.x = 24;
      e.player.y = 38;
      e.player.direction = 'UP';
      e.player.facing = 'UP';

      r.cameraX = cx;
      r.cameraY = cy;
      r.zoom = 2.2;
    }
  );

  // 7. Thatched Cottage & Flower Garden
  await captureShot(
    '07_houses_thatched_cottage_garden.png',
    'Houses',
    'Thatched Village Cottage',
    'Picturesque rural cottage with thatched roof, stone chimney, blooming flower beds, and lantern post.',
    () => {
      const e = window.survivalEngine;
      const r = window.survivalRenderer;
      e.worldTime.timeOfDay = 'Day';
      e.worldTime.hour = 13;
      e.worldTime.lightLevel = 1.0;

      // Cottage at (55, 18), w: 7, h: 7, door: (58, 24)
      const cx = 58.5;
      const cy = 22;
      e.player.x = 58;
      e.player.y = 26;
      e.player.direction = 'UP';
      e.player.facing = 'UP';

      r.cameraX = cx;
      r.cameraY = cy;
      r.zoom = 2.6;
    }
  );

  // 8. Village Tavern & Inn
  await captureShot(
    '08_houses_village_tavern_inn.png',
    'Houses',
    'The Boar & Barrel Tavern',
    'Spacious wooden tavern with roadside terrace, brewing barrels, rustic timber siding, and welcoming entryway.',
    () => {
      const e = window.survivalEngine;
      const r = window.survivalRenderer;
      e.worldTime.timeOfDay = 'Day';
      e.worldTime.hour = 15;
      e.worldTime.lightLevel = 1.0;

      // Tavern at (78, 6), w: 11, h: 8, door: (81, 13)
      const cx = 83.5;
      const cy = 11;
      e.player.x = 81;
      e.player.y = 15;
      e.player.direction = 'UP';
      e.player.facing = 'UP';

      r.cameraX = cx;
      r.cameraY = cy;
      r.zoom = 2.2;
    }
  );

  // 9. Timber Barn & Workshop
  await captureShot(
    '09_houses_timber_barn.png',
    'Houses',
    'Timber Barn & Workshop',
    'Heavy timber farm building with haylofts, double wide doorways, and crafting facilities.',
    () => {
      const e = window.survivalEngine;
      const r = window.survivalRenderer;
      e.worldTime.timeOfDay = 'Day';
      e.worldTime.hour = 12;
      e.worldTime.lightLevel = 1.0;

      // Barn at (62, 24), w: 10, h: 8, door: (64, 31)
      const cx = 67;
      const cy = 29;
      e.player.x = 64;
      e.player.y = 33;
      e.player.direction = 'UP';
      e.player.facing = 'UP';

      r.cameraX = cx;
      r.cameraY = cy;
      r.zoom = 2.3;
    }
  );

  // 10. House Interior Cutaway Living Room
  await captureShot(
    '10_houses_cutaway_interior_living.png',
    'Houses',
    'Furnished House Interior (2.5D Cutaway)',
    'Walkable 2.5D interior showing stone hearth fireplace, patterned rug, wooden bed, dining table, and lanterns.',
    () => {
      const e = window.survivalEngine;
      const r = window.survivalRenderer;
      e.worldTime.timeOfDay = 'Day';
      e.worldTime.hour = 14;
      e.worldTime.lightLevel = 1.0;

      // Inside Cottage (55, 18), door at (58, 24), step inside at (58, 22.5)
      e.player.x = 58;
      e.player.y = 22.5;
      e.player.direction = 'UP';
      e.player.facing = 'UP';

      r.cameraX = 58.5;
      r.cameraY = 21.5;
      r.zoom = 2.8;
    }
  );

  // 11. Village Houses at Night
  await captureShot(
    '11_houses_night_village_lanterns.png',
    'Houses',
    'Nocturnal Village Glow',
    'Village houses illuminated in the dark with glowing lantern posts, window light, and warm torchlight ambiance.',
    () => {
      const e = window.survivalEngine;
      const r = window.survivalRenderer;
      e.worldTime.timeOfDay = 'Night';
      e.worldTime.hour = 22;
      e.worldTime.minute = 10;
      e.worldTime.lightLevel = 0.18;

      // Street near cottage
      e.player.x = 58;
      e.player.y = 25;
      e.player.direction = 'UP';
      e.player.facing = 'UP';
      e.hotbar[e.activeHotbarIndex] = { item: 'torch', count: 1 };
      e.player.activeHeldItem = 'torch';

      r.cameraX = 58;
      r.cameraY = 22;
      r.zoom = 2.2;
    }
  );

  // ══════════════════════════════════════════════════════════════════
  // CATEGORY 3: WATER & AQUATIC FEATURES
  // ══════════════════════════════════════════════════════════════════

  // 12. Wooden Bridge with 3D Stilts
  await captureShot(
    '12_water_wooden_bridge_stilts.png',
    'Water',
    'Wooden Bridge with 3D Stilts',
    'Authentic timber bridge spanning clear blue water with visible underwater support stilts and drop shadows.',
    () => {
      const e = window.survivalEngine;
      const r = window.survivalRenderer;
      e.worldTime.timeOfDay = 'Day';
      e.worldTime.hour = 11;
      e.worldTime.lightLevel = 1.0;

      // Bridge at (57, -1)
      e.player.x = 57;
      e.player.y = 1;
      e.player.direction = 'UP';
      e.player.facing = 'UP';

      r.cameraX = 57;
      r.cameraY = -1;
      r.zoom = 2.5;
    }
  );

  // 13. Player Crossing Bridge
  await captureShot(
    '13_water_crossing_perspective.png',
    'Water',
    'Crossing the River Bridge',
    'Player navigating the wooden bridge over deep water with a fishing rod in hand.',
    () => {
      const e = window.survivalEngine;
      const r = window.survivalRenderer;
      e.worldTime.timeOfDay = 'Day';
      e.worldTime.hour = 13;
      e.worldTime.lightLevel = 1.0;

      e.player.x = 57;
      e.player.y = -1;
      e.player.direction = 'RIGHT';
      e.player.facing = 'RIGHT';
      e.hotbar[e.activeHotbarIndex] = { item: 'fishing_rod', count: 1 };
      e.player.activeHeldItem = 'fishing_rod';

      r.cameraX = 57;
      r.cameraY = -1;
      r.zoom = 2.6;
    }
  );

  // 14. Curved Lake Shoreline
  await captureShot(
    '14_water_curved_lake_shoreline.png',
    'Water',
    'Curved Shoreline & Water Reeds',
    'Natural organic water body with sandy bank transitions, aquatic reeds, and deep blue water ripples.',
    () => {
      const e = window.survivalEngine;
      const r = window.survivalRenderer;
      e.worldTime.timeOfDay = 'Day';
      e.worldTime.hour = 12;
      e.worldTime.lightLevel = 1.0;

      const cx = 64;
      const cy = -6;
      e.player.x = 64;
      e.player.y = -4;
      e.player.direction = 'UP';
      e.player.facing = 'UP';

      r.cameraX = cx;
      r.cameraY = cy;
      r.zoom = 2.4;
    }
  );

  // 15. Lakeside Sunset Reflection
  await captureShot(
    '15_water_lakeside_sunset_reflection.png',
    'Water',
    'Sunset Over the Waterway',
    'Dusk ambiance reflecting warm orange and violet sky tones across the shimmering river and lake surface.',
    () => {
      const e = window.survivalEngine;
      const r = window.survivalRenderer;
      e.worldTime.timeOfDay = 'Sunset';
      e.worldTime.hour = 19;
      e.worldTime.minute = 20;
      e.worldTime.lightLevel = 0.55;

      e.player.x = 57;
      e.player.y = 1;
      e.player.direction = 'UP';
      e.player.facing = 'UP';

      r.cameraX = 57;
      r.cameraY = -2;
      r.zoom = 2.1;
    }
  );

  // 16. Deep River Bend
  await captureShot(
    '16_water_deep_river_bend.png',
    'Water',
    'Winding River Bend & Sandbanks',
    'Lush river embankment winding past the northern boundary of the settlement with pristine water.',
    () => {
      const e = window.survivalEngine;
      const r = window.survivalRenderer;
      e.worldTime.timeOfDay = 'Day';
      e.worldTime.hour = 14;
      e.worldTime.lightLevel = 1.0;

      const cx = 72;
      const cy = -4;
      e.player.x = 72;
      e.player.y = -2;
      e.player.direction = 'UP';
      e.player.facing = 'UP';

      r.cameraX = cx;
      r.cameraY = cy;
      r.zoom = 2.3;
    }
  );

  // ══════════════════════════════════════════════════════════════════
  // CATEGORY 4: BLOCKS & 3D CONSTRUCTION
  // ══════════════════════════════════════════════════════════════════

  // 17. 3D Fortress Watchtower
  await captureShot(
    '17_blocks_3d_stacked_watchtower.png',
    'Blocks',
    '3D Fortress Watchtower',
    'Multi-tiered 3D stone and timber bastion demonstrating vertical stacking (Tiers 0-3), directional lighting, and block depth.',
    () => {
      const e = window.survivalEngine;
      const r = window.survivalRenderer;
      e.worldTime.timeOfDay = 'Day';
      e.worldTime.hour = 11;
      e.worldTime.lightLevel = 1.0;

      const bx = 50;
      const by = 35;

      // Base Tier 0 (3x3 stone & brick)
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 3; dx++) {
          e.place3DBlock('block_stone', bx + dx, by + dy, 0, true);
        }
      }
      // Tier 1 (brick)
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 3; dx++) {
          e.place3DBlock('block_brick', bx + dx, by + dy, 1, true);
        }
      }
      // Tier 2 (corner battlements wood)
      e.place3DBlock('block_wood', bx, by, 2, true);
      e.place3DBlock('block_wood', bx + 2, by, 2, true);
      e.place3DBlock('block_wood', bx, by + 2, 2, true);
      e.place3DBlock('block_wood', bx + 2, by + 2, 2, true);
      e.place3DBlock('block_stone', bx + 1, by + 1, 2, true);
      // Tier 3 (center peak)
      e.place3DBlock('block_stone', bx + 1, by + 1, 3, true);

      e.player.x = bx + 1;
      e.player.y = by + 4;
      e.player.direction = 'UP';
      e.player.facing = 'UP';
      e.hotbar[e.activeHotbarIndex] = { item: 'block_stone', count: 64 };
      e.player.activeHeldItem = 'block_stone';

      r.cameraX = bx + 1;
      r.cameraY = by + 1.5;
      r.zoom = 2.6;
    }
  );

  // 18. All 6 Materials Exhibition
  await captureShot(
    '18_blocks_material_showcase.png',
    'Blocks',
    'All 6 3D Block Materials Showcase',
    'Stepped architectural podium showcasing Stone, Wood, Dirt, Brick, Sandstone, and Glass blocks with isometric depth.',
    () => {
      const e = window.survivalEngine;
      const r = window.survivalRenderer;
      e.worldTime.timeOfDay = 'Day';
      e.worldTime.hour = 12;
      e.worldTime.lightLevel = 1.0;

      const sx = 66;
      const sy = 34;

      const mats = [
        'block_stone',
        'block_wood',
        'block_dirt',
        'block_brick',
        'block_sandstone',
        'block_glass',
      ];

      mats.forEach((m, idx) => {
        const x = sx + idx;
        const y = sy;
        // Tier 0
        e.place3DBlock(m, x, y, 0, true);
        // Tier 1 on half
        if (idx >= 2) e.place3DBlock(m, x, y, 1, true);
        // Tier 2 on top 2
        if (idx >= 4) e.place3DBlock(m, x, y, 2, true);
      });

      e.player.x = sx + 2.5;
      e.player.y = sy + 3;
      e.player.direction = 'UP';
      e.player.facing = 'UP';
      e.hotbar[e.activeHotbarIndex] = { item: 'block_brick', count: 32 };
      e.player.activeHeldItem = 'block_brick';

      r.cameraX = sx + 2.5;
      r.cameraY = sy + 0.5;
      r.zoom = 2.8;
    }
  );

  // 19. 3D Construction Preview
  await captureShot(
    '19_blocks_construction_preview.png',
    'Blocks',
    'Active 3D Construction & Preview',
    'Builder placing structural 3D blocks with the holographic snap preview cursor showing tier placement.',
    () => {
      const e = window.survivalEngine;
      const r = window.survivalRenderer;
      e.worldTime.timeOfDay = 'Day';
      e.worldTime.hour = 13;
      e.worldTime.lightLevel = 1.0;

      const px = 48;
      const py = 35;
      e.player.x = px;
      e.player.y = py;
      e.player.direction = 'RIGHT';
      e.player.facing = 'RIGHT';

      // Set active build piece
      e.buildPiece = 'block_brick';
      e.buildPreviewX = px + 1;
      e.buildPreviewY = py;
      e.buildPreviewZ = 1;
      e.isBuildPreviewValid = true;

      e.hotbar[e.activeHotbarIndex] = { item: 'block_brick', count: 50 };
      e.player.activeHeldItem = 'block_brick';

      r.cameraX = px + 0.5;
      r.cameraY = py;
      r.zoom = 2.8;
    }
  );

  // 20. Fortified Perimeter Wall
  await captureShot(
    '20_blocks_defensive_wall_gate.png',
    'Blocks',
    'Fortified Perimeter Wall & Ramparts',
    'Continuous defensive wall created out of stone & brick blocks protecting the eastern border of the settlement.',
    () => {
      const e = window.survivalEngine;
      const r = window.survivalRenderer;
      e.worldTime.timeOfDay = 'Day';
      e.worldTime.hour = 15;
      e.worldTime.lightLevel = 1.0;

      const wx = 38;
      const wy = 33;
      // Build a 5-block long defensive wall
      for (let i = 0; i < 6; i++) {
        e.place3DBlock('block_stone', wx + i, wy, 0, true);
        if (i !== 3) {
          e.place3DBlock('block_brick', wx + i, wy, 1, true);
        }
      }

      e.player.x = wx + 3;
      e.player.y = wy + 2.5;
      e.player.direction = 'UP';
      e.player.facing = 'UP';
      e.hotbar[e.activeHotbarIndex] = { item: 'iron_hammer', count: 1 };
      e.player.activeHeldItem = 'iron_hammer';

      r.cameraX = wx + 2.5;
      r.cameraY = wy;
      r.zoom = 2.5;
    }
  );

  // 21. Glass & Sandstone Pavilion
  await captureShot(
    '21_blocks_glass_sanctuary.png',
    'Blocks',
    'Luminous Glass & Sandstone Monument',
    'Translucent glass blocks layered atop warm sandstone pedestal, capturing daylight refractions.',
    () => {
      const e = window.survivalEngine;
      const r = window.survivalRenderer;
      e.worldTime.timeOfDay = 'Day';
      e.worldTime.hour = 12;
      e.worldTime.lightLevel = 1.0;

      const gx = 60;
      const gy = 34;

      e.place3DBlock('block_sandstone', gx, gy, 0, true);
      e.place3DBlock('block_sandstone', gx + 1, gy, 0, true);
      e.place3DBlock('block_glass', gx, gy, 1, true);
      e.place3DBlock('block_glass', gx + 1, gy, 1, true);
      e.place3DBlock('block_glass', gx, gy, 2, true);
      e.place3DBlock('block_glass', gx + 1, gy, 2, true);

      e.player.x = gx + 0.5;
      e.player.y = gy + 2.5;
      e.player.direction = 'UP';
      e.player.facing = 'UP';
      e.hotbar[e.activeHotbarIndex] = { item: 'block_glass', count: 20 };
      e.player.activeHeldItem = 'block_glass';

      r.cameraX = gx + 0.5;
      r.cameraY = gy + 0.5;
      r.zoom = 2.8;
    }
  );

  // ══════════════════════════════════════════════════════════════════
  // CATEGORY 5: NATURE, WILDLIFE & LIFE ("ETC.")
  // ══════════════════════════════════════════════════════════════════

  // 22. Dense Wilderness Forest
  await captureShot(
    '22_env_enchanted_forest_clearing.png',
    'Nature & Life',
    'Wilderness Forest Clearing',
    'Dense woodland grove with towering pine trees, leafy oaks, mossy boulders, and woodland flora.',
    () => {
      const e = window.survivalEngine;
      const r = window.survivalRenderer;
      e.worldTime.timeOfDay = 'Day';
      e.worldTime.hour = 11;
      e.worldTime.lightLevel = 1.0;

      // Forest area near (-8, -25)
      const fx = -10;
      const fy = -24;
      e.player.x = fx;
      e.player.y = fy;
      e.player.direction = 'RIGHT';
      e.player.facing = 'RIGHT';
      e.hotbar[e.activeHotbarIndex] = { item: 'iron_axe', count: 1 };
      e.player.activeHeldItem = 'iron_axe';

      r.cameraX = fx;
      r.cameraY = fy;
      r.zoom = 2.2;
    }
  );

  // 23. Rocky Mining Quarry & Iron Ores
  await captureShot(
    '23_env_rocky_mining_quarry.png',
    'Nature & Life',
    'Rocky Outcrop & Iron Ore Veins',
    'Natural stone quarry with exposed boulders, mineral veins, and miner extracting ores.',
    () => {
      const e = window.survivalEngine;
      const r = window.survivalRenderer;
      e.worldTime.timeOfDay = 'Day';
      e.worldTime.hour = 14;
      e.worldTime.lightLevel = 1.0;

      // Iron rocks at (75, -27)
      const qx = 75;
      const qy = -26;
      e.player.x = qx;
      e.player.y = qy + 1;
      e.player.direction = 'UP';
      e.player.facing = 'UP';
      e.hotbar[e.activeHotbarIndex] = { item: 'iron_pickaxe', count: 1 };
      e.player.activeHeldItem = 'iron_pickaxe';

      r.cameraX = qx;
      r.cameraY = qy;
      r.zoom = 2.4;
    }
  );

  // 24. Oakvale Village Town Square
  await captureShot(
    '24_life_village_square_market.png',
    'Nature & Life',
    'Oakvale Central Market Square',
    'Cobblestone crossroads connecting the village inns, houses, and townspeople going about daily routines.',
    () => {
      const e = window.survivalEngine;
      const r = window.survivalRenderer;
      e.worldTime.timeOfDay = 'Day';
      e.worldTime.hour = 12;
      e.worldTime.lightLevel = 1.0;

      // Road junction around (50, 20)
      const sx = 52;
      const sy = 22;
      e.player.x = sx;
      e.player.y = sy;
      e.player.direction = 'DOWN';
      e.player.facing = 'DOWN';

      r.cameraX = sx;
      r.cameraY = sy;
      r.zoom = 2.2;
    }
  );

  // 25. Grazing Wildlife Pasture
  await captureShot(
    '25_life_grazing_wildlife_pasture.png',
    'Nature & Life',
    'Pastoral Meadow with Grazing Animals',
    'Peaceful green pastures where sheep, chickens, and wildlife roam freely beside the settlement.',
    () => {
      const e = window.survivalEngine;
      const r = window.survivalRenderer;
      e.worldTime.timeOfDay = 'Day';
      e.worldTime.hour = 15;
      e.worldTime.lightLevel = 1.0;

      // Gather a few friendly animals near (35, 74)
      const px = 35;
      const py = 74;

      const animalsToMove = e.animals.slice(0, 8);
      animalsToMove.forEach((a, idx) => {
        const offsetAngle = (idx / animalsToMove.length) * Math.PI * 2;
        const dist = 1.5 + (idx % 3) * 0.8;
        a.position.x = px + Math.cos(offsetAngle) * dist;
        a.position.y = py + Math.sin(offsetAngle) * dist;
      });

      e.player.x = px;
      e.player.y = py;
      e.player.direction = 'DOWN';
      e.player.facing = 'DOWN';

      r.cameraX = px;
      r.cameraY = py;
      r.zoom = 2.6;
    }
  );

  // 26. Night Wilderness Campfire
  await captureShot(
    '26_night_wilderness_campfire.png',
    'Nature & Life',
    'Starlit Wilderness Campfire',
    'Crackling campfire casting dynamic flickering embers and warm illumination into the deep nocturnal wilderness.',
    () => {
      const e = window.survivalEngine;
      const r = window.survivalRenderer;
      e.worldTime.timeOfDay = 'Night';
      e.worldTime.hour = 23;
      e.worldTime.minute = 30;
      e.worldTime.lightLevel = 0.16;

      const cx = 55;
      const cy = 42;

      // Place campfire
      e.addPlacedStructure('campfire', cx, cy, true);

      e.player.x = cx - 1.2;
      e.player.y = cy;
      e.player.direction = 'RIGHT';
      e.player.facing = 'RIGHT';
      e.hotbar[e.activeHotbarIndex] = { item: 'torch', count: 1 };
      e.player.activeHeldItem = 'torch';

      r.cameraX = cx;
      r.cameraY = cy;
      r.zoom = 2.5;
    }
  );

  await browser.close();
  console.log(`\n🎉 Successfully captured all ${manifest.length} screenshots!`);

  // Write JSON Manifest
  const manifestPath = path.join(LOCAL_DIR, 'collection-manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  await copyFile(manifestPath, path.join(ARTIFACT_DIR, 'collection-manifest.json'));

  // Generate HTML Gallery for easy viewing
  const htmlContent = generateHtmlGallery(manifest);
  const htmlPath = path.join(LOCAL_DIR, 'index.html');
  await writeFile(htmlPath, htmlContent, 'utf-8');
  await copyFile(htmlPath, path.join(ARTIFACT_DIR, 'index.html'));

  console.log(`🖼️  HTML Gallery created at: ${htmlPath}`);
}

function generateHtmlGallery(items) {
  const categories = [...new Set(items.map((i) => i.category))];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sunnyside Survival RTS — Visual Screenshot Collection</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: rgba(22, 28, 45, 0.85);
      --card-border: rgba(255, 255, 255, 0.08);
      --primary: #3b82f6;
      --accent: #10b981;
      --gold: #f59e0b;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: radial-gradient(circle at 50% 0%, #1e293b 0%, #0b0f19 100%);
      color: var(--text);
      font-family: 'Outfit', -apple-system, sans-serif;
      min-height: 100vh;
      padding: 40px 24px;
    }
    .header {
      max-width: 1400px;
      margin: 0 auto 36px;
      text-align: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(59, 130, 246, 0.15);
      color: #60a5fa;
      border: 1px solid rgba(59, 130, 246, 0.3);
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 16px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    h1 {
      font-size: 40px;
      font-weight: 800;
      letter-spacing: -1px;
      margin-bottom: 12px;
      background: linear-gradient(135deg, #ffffff 30%, #94a3b8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p.subtitle {
      color: var(--text-muted);
      font-size: 16px;
      max-width: 650px;
      margin: 0 auto;
    }
    .categories {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 10px;
      margin: 28px 0;
    }
    .cat-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--card-border);
      color: var(--text-muted);
      padding: 8px 18px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .cat-btn:hover, .cat-btn.active {
      background: var(--primary);
      color: #fff;
      border-color: var(--primary);
      box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
      gap: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      overflow: hidden;
      backdrop-filter: blur(12px);
      transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
      cursor: pointer;
      display: flex;
      flex-direction: column;
    }
    .card:hover {
      transform: translateY(-4px);
      border-color: rgba(59, 130, 246, 0.4);
      box-shadow: 0 16px 32px rgba(0, 0, 0, 0.4);
    }
    .thumb-wrapper {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      background: #020617;
      overflow: hidden;
    }
    .thumb-wrapper img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      transition: transform 0.35s ease;
    }
    .card:hover .thumb-wrapper img {
      transform: scale(1.03);
    }
    .tag {
      position: absolute;
      top: 12px;
      left: 12px;
      background: rgba(11, 15, 25, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(8px);
      color: #e2e8f0;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .card-body {
      padding: 18px 20px 22px;
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .card-title {
      font-size: 17px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 8px;
    }
    .card-desc {
      font-size: 13.5px;
      color: var(--text-muted);
      line-height: 1.5;
      flex: 1;
    }
    .card-footer {
      margin-top: 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11.5px;
      color: #64748b;
    }
    .lightbox {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.92);
      backdrop-filter: blur(10px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 24px;
    }
    .lightbox.active {
      display: flex;
    }
    .lightbox-content {
      max-width: 90vw;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .lightbox-img {
      max-width: 100%;
      max-height: 80vh;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .lightbox-caption {
      margin-top: 16px;
      text-align: center;
    }
    .lightbox-title {
      font-size: 18px;
      font-weight: 700;
      color: #fff;
    }
    .lightbox-sub {
      color: var(--text-muted);
      font-size: 14px;
      margin-top: 4px;
    }
    .close-btn {
      position: absolute;
      top: 24px;
      right: 28px;
      font-size: 32px;
      color: #fff;
      cursor: pointer;
      opacity: 0.7;
    }
    .close-btn:hover { opacity: 1; }
  </style>
</head>
<body>
  <div class="header">
    <div class="badge">📸 Visual Asset Atlas • 26 Screenshots</div>
    <h1>Game Features Collection</h1>
    <p class="subtitle">Curated gallery of high-resolution 1080p screenshots showcasing procedural farms, architecture, water features, 3D placeable blocks, wildlife, and atmosphere.</p>

    <div class="categories">
      <button class="cat-btn active" onclick="filterCat('all', this)">All (${items.length})</button>
      ${categories
        .map(
          (c) =>
            `<button class="cat-btn" onclick="filterCat('${c}', this)">${c} (${items.filter((i) => i.category === c).length})</button>`
        )
        .join('')}
    </div>
  </div>

  <div class="grid">
    ${items
      .map(
        (item) => `
      <div class="card" data-category="${item.category}" onclick="openLightbox('${item.filename}', '${item.title.replace(/'/g, "\\'")}', '${item.description.replace(/'/g, "\\'")}')">
        <div class="thumb-wrapper">
          <span class="tag">${item.category}</span>
          <img src="${item.filename}" alt="${item.title}" loading="lazy">
        </div>
        <div class="card-body">
          <h3 class="card-title">${item.title}</h3>
          <p class="card-desc">${item.description}</p>
          <div class="card-footer">
            <span>${item.filename}</span>
            <span>1920 × 1080</span>
          </div>
        </div>
      </div>
    `
      )
      .join('')}
  </div>

  <div class="lightbox" id="lightbox" onclick="closeLightbox()">
    <span class="close-btn">&times;</span>
    <div class="lightbox-content" onclick="event.stopPropagation()">
      <img id="lightbox-img" class="lightbox-img" src="" alt="">
      <div class="lightbox-caption">
        <div id="lightbox-title" class="lightbox-title"></div>
        <div id="lightbox-sub" class="lightbox-sub"></div>
      </div>
    </div>
  </div>

  <script>
    function filterCat(cat, btn) {
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.card').forEach(card => {
        if (cat === 'all' || card.dataset.category === cat) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    }

    function openLightbox(filename, title, desc) {
      document.getElementById('lightbox-img').src = filename;
      document.getElementById('lightbox-title').textContent = title;
      document.getElementById('lightbox-sub').textContent = desc;
      document.getElementById('lightbox').classList.add('active');
    }

    function closeLightbox() {
      document.getElementById('lightbox').classList.remove('active');
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeLightbox();
    });
  </script>
</body>
</html>`;
}

run().catch((err) => {
  console.error('Fatal error during capture:', err);
  process.exit(1);
});

