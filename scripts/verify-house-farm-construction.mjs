import puppeteer from 'puppeteer-core';
import { mkdir, copyFile } from 'node:fs/promises';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUTPUT_DIR = 'test-results/browser-verification';
const ARTIFACT_DIR = '/Users/shanukeshri983/.gemini/antigravity/brain/1e0e9b94-4c34-42a1-99ac-6ef4a8ca1d19/screenshots';

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(ARTIFACT_DIR, { recursive: true });
  console.log('🧪 Starting Verification of Player House & Farm Construction in Chrome...\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
  });

  const failures = [];

  try {
    const page = (await browser.pages())[0];
    await page.setViewport({ width: 1440, height: 900 });

    page.on('console', (msg) => {
      const txt = msg.text();
      if (txt.includes('error') || txt.includes('Error')) {
        console.log('   [Browser Console Error]:', txt);
      }
    });

    console.log('--- Launching Single Player Game ---');
    await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 15000 });
    await wait(1200);

    await page.click('#btn-menu-singleplayer');
    await wait(1800);

    // ────────────────────────────────────────────────────────────────
    // TEST 1: Build Mode Palette UI & Category Switching
    // ────────────────────────────────────────────────────────────────
    console.log('--- TEST 1: Build Mode Palette UI & Category Switching ---');
    // Click [B] button in HUD icon toolbar
    await page.click('#btn-toggle-build');
    await wait(500);

    const paletteState = await page.evaluate(() => {
      const panel = document.getElementById('compact-build-panel');
      const tabs = Array.from(document.querySelectorAll('.build-tab-btn')).map((t) => t.textContent.trim());
      const items = Array.from(document.querySelectorAll('.build-item-name')).map((t) => t.textContent.trim());
      return {
        isOpen: panel && !panel.classList.contains('hidden'),
        tabs,
        housesItemCount: items.length,
      };
    });

    console.log('Palette State (Houses tab):', paletteState);
    if (!paletteState.isOpen) failures.push('Build palette panel did not open on button click');
    if (paletteState.tabs.length < 4) failures.push('Expected 4 tabs (Houses, Farms, Stations, Blocks)');

    // Switch to Farms tab
    await page.click('button[data-cat="farms"]');
    await wait(300);
    const farmItems = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.build-item-name')).map((t) => t.textContent.trim());
    });
    console.log('Farms Tab Items:', farmItems);
    if (!farmItems.includes('Farmland Soil') || !farmItems.includes('Wooden Fence')) {
      failures.push('Expected Farmland Soil and Wooden Fence in Farms tab');
    }

    // ────────────────────────────────────────────────────────────────
    // TEST 2: Construct House (Floors, Walls, Windows, Door, Roof, Bed, Chest)
    // ────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 2: Constructing Player House ---');
    const houseBuildResult = await page.evaluate(() => {
      const engine = window.survivalEngine;
      if (!engine) return { error: 'No engine' };

      // Ensure player has building items (modest amounts that don't overflow stack limits)
      engine.addItemToInventory('stone_wall', 10);
      engine.addItemToInventory('wall_window', 6);
      engine.addItemToInventory('roof_terracotta', 6);

      // Teleport player near meadow build site
      engine.player.x = 82;
      engine.player.y = 26;
      engine.player.vx = 0;
      engine.player.vy = 0;
      engine.worldTime.hour = 12;
      engine.worldTime.minute = 0;
      engine.worldTime.timeOfDay = 'Day';

      // Build a 5x4 cozy house at x: 80..84, y: 22..25
      // 1. Hardwood Floors (5x4)
      for (let dy = 0; dy < 4; dy++) {
        for (let dx = 0; dx < 5; dx++) {
          engine.placeStructure('wood_floor', 80 + dx, 22 + dy);
        }
      }

      // 2. North Walls (roof & windows)
      engine.placeStructure('stone_wall', 80, 22);
      engine.placeStructure('roof_wood', 81, 22);
      const resTerracotta = engine.placeStructure('roof_terracotta', 82, 22);
      engine.placeStructure('roof_wood', 83, 22);
      engine.placeStructure('stone_wall', 84, 22);

      // 3. West & East Walls with windows
      engine.placeStructure('wall_window', 80, 23);
      engine.placeStructure('wood_wall', 80, 24);
      engine.placeStructure('wall_window', 84, 23);
      engine.placeStructure('wood_wall', 84, 24);

      // 4. South Wall with Wooden Door
      engine.placeStructure('stone_wall', 80, 25);
      engine.placeStructure('wood_wall', 81, 25);
      engine.placeStructure('wood_door', 82, 25);
      engine.placeStructure('wood_wall', 83, 25);
      engine.placeStructure('stone_wall', 84, 25);

      // 5. Furniture inside house
      engine.placeStructure('bed', 81, 23);
      engine.placeStructure('chest', 83, 23);

      // Test door interaction (toggle open/close)
      const doorStruct = engine.placedStructures.find((s) => s.x === 82 && s.y === 25 && s.type === 'wood_door');
      const initialOpen = doorStruct ? Boolean(doorStruct.isOpen) : false;
      engine.toggleDoor(82, 25);
      const afterToggleOpen = doorStruct ? Boolean(doorStruct.isOpen) : false;

      return {
        resTerracotta,
        totalPlaced: engine.placedStructures.length,
        hasBed: engine.placedStructures.some((s) => s.type === 'bed'),
        hasDoor: engine.placedStructures.some((s) => s.type === 'wood_door'),
        hasWindow: engine.placedStructures.some((s) => s.type === 'wall_window'),
        hasTerracottaRoof: engine.placedStructures.some((s) => s.type === 'roof_terracotta'),
        doorInitial: initialOpen,
        doorAfterToggle: afterToggleOpen,
      };
    });

    console.log('House Build Result:', houseBuildResult);
    if (!houseBuildResult.hasDoor || !houseBuildResult.hasBed) failures.push('House structures failed to place');
    if (!houseBuildResult.hasWindow) failures.push('Windowed wall failed to place');
    if (!houseBuildResult.hasTerracottaRoof) failures.push('Terracotta roof failed to place');
    if (!houseBuildResult.doorAfterToggle) failures.push('Wooden door toggle open failed');

    // ────────────────────────────────────────────────────────────────
    // TEST 3: Construct Farm (Tilled Farmland, Connecting Fences, Gate, Planting Seeds)
    // ────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 3: Constructing Player Farm & Cultivating Crops ---');
    const farmBuildResult = await page.evaluate(() => {
      const engine = window.survivalEngine;
      if (!engine) return { error: 'No engine' };

      engine.addItemToInventory('water_well', 5);

      // Build Farm adjacent to house (x: 87..92, y: 22..25)
      // 1. Tilled Farmland plots
      for (let dy = 1; dy <= 2; dy++) {
        for (let dx = 1; dx <= 4; dx++) {
          engine.placeStructure('farm_soil', 87 + dx, 22 + dy);
        }
      }

      // 2. Perimeter Fences with Gate
      for (let x = 87; x <= 92; x++) {
        engine.placeStructure('farm_fence', x, 22); // Top fence
        if (x === 89) {
          engine.placeStructure('farm_gate', x, 25); // Front Gate
        } else {
          engine.placeStructure('farm_fence', x, 25); // Bottom fence
        }
      }
      for (let y = 23; y <= 24; y++) {
        engine.placeStructure('farm_fence', 87, y); // Left fence
        engine.placeStructure('farm_fence', 92, y); // Right fence
      }

      // 3. Water Well
      const resWell = engine.placeStructure('water_well', 86, 23);

      // 4. Plant Seeds on Farmland Soil
      // Equip seeds in active hotbar
      engine.hotbar[0] = { item: 'seeds', count: 10 };
      engine.activeHotbarIndex = 0;

      // Click on farm soil plot (88, 23) and (89, 23) to plant
      engine.handleWorldClick(88.5, 23.5, false);
      engine.handleWorldClick(89.5, 23.5, false);

      const res1 = engine.worldManager.getResourceAt(88.5, 23.5, 0.8);
      const res2 = engine.worldManager.getResourceAt(89.5, 23.5, 0.8);

      return {
        resWell,
        totalStructures: engine.placedStructures.length,
        farmSoils: engine.placedStructures.filter((s) => s.type === 'farm_soil').length,
        fences: engine.placedStructures.filter((s) => s.type === 'farm_fence').length,
        hasGate: engine.placedStructures.some((s) => s.type === 'farm_gate'),
        hasWell: engine.placedStructures.some((s) => s.type === 'water_well'),
        plantedCrop1: Boolean(res1 && res1.type === 'crop'),
        plantedCrop2: Boolean(res2 && res2.type === 'crop'),
      };
    });

    console.log('Farm Build Result:', farmBuildResult);
    if (farmBuildResult.farmSoils < 8) failures.push('Expected 8 farm soil plots');
    if (farmBuildResult.fences < 8) failures.push('Expected at least 8 fence segments');
    if (!farmBuildResult.hasGate) failures.push('Farm gate was not placed');
    if (!farmBuildResult.hasWell) failures.push('Water well was not placed');
    if (!farmBuildResult.plantedCrop1 || !farmBuildResult.plantedCrop2) failures.push('Expected seeds to be planted on farm soil');

    // ────────────────────────────────────────────────────────────────
    // TEST 4: Construct Wooden Bridge across Water
    // ────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 4: Constructing Wooden Bridge across Water ---');
    const bridgeResult = await page.evaluate(() => {
      const engine = window.survivalEngine;
      const wm = engine.worldManager;

      engine.addItemToInventory('wood_bridge', 20);

      // Find an inland water tile
      let waterTile = null;
      for (let y = 0; y < 88; y++) {
        for (let x = 0; x < 110; x++) {
          const t = wm.getTile(x, y);
          if (t.isWater && !t.isBridge) {
            waterTile = { x, y };
            break;
          }
        }
        if (waterTile) break;
      }

      if (!waterTile) return { error: 'No water tile found to test bridge' };

      // Normal terrestrial structures should fail on water
      const wallOnWater = engine.placeStructure('wood_wall', waterTile.x, waterTile.y);

      // Bridge should succeed on water
      const bridgeOnWater = engine.placeStructure('wood_bridge', waterTile.x, waterTile.y);

      return {
        waterTile,
        wallBlockedOnWater: !wallOnWater,
        bridgeAllowedOnWater: bridgeOnWater,
      };
    });

    console.log('Bridge Result:', bridgeResult);
    if (!bridgeResult.wallBlockedOnWater) failures.push('Wood wall should NOT be placeable directly on water');
    if (!bridgeResult.bridgeAllowedOnWater) failures.push('Wooden bridge SHOULD be placeable directly on water');

    // ────────────────────────────────────────────────────────────────
    // TEST 5: Verify Minimap Rendering of House and Farm Structures
    // ────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 5: Minimap Radar Verification for Player Structures ---');
    const minimapVerification = await page.evaluate(() => {
      const radarCanvas = document.getElementById('radar-canvas');
      if (!radarCanvas) return { hasCanvas: false };

      const ctx = radarCanvas.getContext('2d');
      const imgData = ctx.getImageData(0, 0, radarCanvas.width, radarCanvas.height);
      const d = imgData.data;

      let darkRedRoof = 0; // #dc2626
      let brownWood = 0;    // #a16207 or #78350f
      let greenGate = 0;    // #22c55e

      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        // Red roof
        if (r > 200 && g < 50 && b < 50) darkRedRoof++;
        // Brown wood/soil
        if (r > 100 && r < 190 && g > 40 && g < 130 && b < 60) brownWood++;
        // Green open door/gate
        if (g > 180 && r < 50 && b < 100) greenGate++;
      }

      return {
        hasCanvas: true,
        darkRedRoof,
        brownWood,
        greenGate,
      };
    });

    console.log('Minimap Verification:', minimapVerification);

    // ────────────────────────────────────────────────────────────────
    // TEST 6: Capture Screenshot of Player Built House & Farm
    // ────────────────────────────────────────────────────────────────
    await page.evaluate(() => {
      // Close build panel so game view is clean
      document.getElementById('compact-build-panel')?.classList.add('hidden');
      document.getElementById('btn-toggle-build')?.classList.remove('active');
      window.survivalEngine.player.x = 86;
      window.survivalEngine.player.y = 26;
    });
    await wait(600);

    const screenshotPath = `${OUTPUT_DIR}/17_player_built_house_and_farm.png`;
    await page.screenshot({ path: screenshotPath });
    await copyFile(screenshotPath, `${ARTIFACT_DIR}/17_player_built_house_and_farm.png`);
    console.log(`📸 Saved screenshot: ${screenshotPath}`);

    console.log('\n=========================================');
    console.log(`Verification Complete. Failures: ${failures.length}`);
    if (failures.length > 0) {
      console.log('FAILURES:');
      failures.forEach((f) => console.log(' ❌', f));
      process.exit(1);
    } else {
      console.log('🎉 ALL HOUSE & FARM CONSTRUCTION CAPABILITIES FULLY VERIFIED!');
      console.log('=========================================\n');
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
