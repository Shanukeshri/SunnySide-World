import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SCREENSHOTS_DIR = 'test-results/screenshots-expanded-features';

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  await mkdir(SCREENSHOTS_DIR, { recursive: true });
  console.log('🚀 Starting Expanded Features & Visual Autotiling Verification...');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: null,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1280,860',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ]
  });

  try {
    const page = (await browser.pages())[0];
    await page.setViewport({ width: 1280, height: 860 });
    console.log('[Browser] Navigating to http://localhost:3000/ ...');
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await wait(1000);

    // Click singleplayer
    const spBtn = await page.$('#btn-menu-singleplayer');
    if (spBtn) {
      await page.evaluate(() => document.getElementById('btn-menu-singleplayer').click());
    }
    await wait(2000);

    await page.waitForSelector('canvas', { timeout: 10000 });
    console.log('Canvas active.');

    const snapTo = async (wx, wy) => {
      await page.evaluate((targetX, targetY) => {
        const g = window.gameEngine;
        if (!g) return;
        g.player.x = targetX;
        g.player.y = targetY;
        if (g.networkPrediction) {
          g.networkPrediction.predictedX = targetX;
          g.networkPrediction.predictedY = targetY;
        }
        const r = window.survivalRenderer || g.renderer;
        if (r) {
          if (typeof r.snapCameraTo === 'function') r.snapCameraTo(targetX, targetY);
          r.cameraX = targetX;
          r.cameraY = targetY;
        }
        g.worldManager.updatePlayerLocation(targetX, targetY);
      }, wx, wy);
      await wait(600);
    };

    // 1. Expansive On-Land Lake & Shoreline Autotiling Check
    console.log('[1/10] Verifying Expansive On-Land Lake & Shorelines...');
    await page.evaluate(() => {
      const g = window.gameEngine;
      let targetX = 0, targetY = 0;
      // Search for wilderness lake outside the starting village
      for (let y = -120; y <= 120; y += 4) {
        for (let x = -120; x <= 120; x += 4) {
          const t = g.worldManager.getTile(x, y);
          const isFarFromVillage = !g.worldManager.villages.some(v => 
            x >= v.gridX - 10 && x <= v.gridX + v.width + 10 &&
            y >= v.gridY - 10 && y <= v.gridY + v.height + 10
          );
          if (t.isWater && isFarFromVillage) {
            targetX = x; targetY = y; break;
          }
        }
        if (targetX !== 0) break;
      }
      if (targetX === 0) {
        // Fallback to village lake / pond
        const v = g.worldManager.villages[0];
        targetX = v.gridX + 8;
        targetY = v.gridY + 22;
      }
      g.player.x = targetX;
      g.player.y = targetY;
      const r = window.survivalRenderer || g.renderer;
      if (r) {
        if (typeof r.snapCameraTo === 'function') r.snapCameraTo(targetX, targetY);
        r.cameraX = targetX;
        r.cameraY = targetY;
      }
      g.worldManager.updatePlayerLocation(targetX, targetY);
    });
    await wait(800);
    const p1 = `${SCREENSHOTS_DIR}/01_expansive_onland_lake_and_shorelines.png`;
    await page.screenshot({ path: p1 });
    console.log(`📸 Captured: ${p1}`);

    // 2. Windmill Flour Milling & Bakery Stone Oven
    console.log('[2/10] Verifying Windmill & Stone Oven in Village Bakery...');
    await page.evaluate(() => {
      const g = window.gameEngine;
      const v = g.worldManager.villages[0];
      const wm = g.placedStructures.find(s => s.type === "windmill");
      if (wm) {
        wm.isOperating = true;
      }
      const oven = g.placedStructures.find(s => s.type === "stone_oven");
      if (oven) {
        oven.isOperating = true;
        oven.fuelTimer = 20;
      }
      const targetX = v.gridX + 14;
      const targetY = v.gridY + 14;
      g.player.x = targetX;
      g.player.y = targetY;
      const r = window.survivalRenderer || g.renderer;
      if (r) {
        if (typeof r.snapCameraTo === 'function') r.snapCameraTo(targetX, targetY);
        r.cameraX = targetX;
        r.cameraY = targetY;
      }
      g.worldManager.updatePlayerLocation(targetX, targetY);
    });
    await wait(800);
    const p2 = `${SCREENSHOTS_DIR}/02_village_windmill_and_stone_oven.png`;
    await page.screenshot({ path: p2 });
    console.log(`📸 Captured: ${p2}`);

    // 3. Coracle Boat Ocean Navigation
    console.log('[3/10] Verifying Coracle Boat Water Navigation...');
    await page.evaluate(() => {
      const g = window.gameEngine;
      const v = g.worldManager.villages[0];
      // Search for water tile in village pond
      let wx = 0, wy = 0;
      for (let y = v.gridY; y < v.gridY + v.height; y++) {
        for (let x = v.gridX; x < v.gridX + v.width; x++) {
          const t = g.worldManager.getTile(x, y);
          if (t.isWater) {
            wx = x + 0.5;
            wy = y + 0.5;
            break;
          }
        }
        if (wx !== 0) break;
      }
      g.player.x = wx;
      g.player.y = wy;
      g.player.isMountedBoat = true;
      const r = window.survivalRenderer || g.renderer;
      if (r) {
        if (typeof r.snapCameraTo === 'function') r.snapCameraTo(wx, wy);
        r.cameraX = wx;
        r.cameraY = wy;
      }
      g.worldManager.updatePlayerLocation(wx, wy);
    });
    await wait(800);
    const p3 = `${SCREENSHOTS_DIR}/03_coracle_boat_ocean_navigation.png`;
    await page.screenshot({ path: p3 });
    console.log(`📸 Captured: ${p3}`);

    // 4. 11-Crop Farming Cycle with Seasons
    console.log('[4/10] Verifying 11 Crops & Farmland...');
    await page.evaluate(() => {
      const g = window.gameEngine;
      const v = g.worldManager.villages[0];
      g.player.isMountedBoat = false;
      const farm = v.data.farms[0];
      const targetX = v.gridX + (farm ? farm.cells[0].x : 10);
      const targetY = v.gridY + (farm ? farm.cells[0].y : 10);
      g.player.x = targetX;
      g.player.y = targetY;
      const r = window.survivalRenderer || g.renderer;
      if (r) {
        if (typeof r.snapCameraTo === 'function') r.snapCameraTo(targetX, targetY);
        r.cameraX = targetX;
        r.cameraY = targetY;
      }
      g.worldManager.updatePlayerLocation(targetX, targetY);
    });
    await wait(800);
    const p4 = `${SCREENSHOTS_DIR}/04_11_crop_farming_and_seasons.png`;
    await page.screenshot({ path: p4 });
    console.log(`📸 Captured: ${p4}`);

    // 5. Dynamic Villager Jobs, Daily Schedules & Happiness
    console.log('[5/10] Verifying Villager Schedules & Expressions...');
    await page.evaluate(() => {
      const g = window.gameEngine;
      const v = g.worldManager.villages[0];
      if (g.npcs.length > 0) {
        g.npcs[0].position.x = v.gridX + 15;
        g.npcs[0].position.y = v.gridY + 15;
        g.npcs[0].currentExpression = "working";
        g.npcs[0].happiness = 98;
      }
      if (g.npcs.length > 1) {
        g.npcs[1].position.x = v.gridX + 17;
        g.npcs[1].position.y = v.gridY + 15;
        g.npcs[1].currentExpression = "chat";
        g.npcs[1].happiness = 85;
      }
      g.player.x = v.gridX + 16;
      g.player.y = v.gridY + 16;
      const r = window.survivalRenderer || g.renderer;
      if (r) {
        if (typeof r.snapCameraTo === 'function') r.snapCameraTo(g.player.x, g.player.y);
        r.cameraX = g.player.x;
        r.cameraY = g.player.y;
      }
      g.worldManager.updatePlayerLocation(g.player.x, g.player.y);
    });
    await wait(800);
    const p5 = `${SCREENSHOTS_DIR}/05_villager_schedules_and_expressions.png`;
    await page.screenshot({ path: p5 });
    console.log(`📸 Captured: ${p5}`);

    // 6. Goblin Encounters & Neutral Trader
    console.log('[6/10] Verifying Goblin Camp & Trader...');
    await page.evaluate(() => {
      const g = window.gameEngine;
      const v = g.worldManager.villages[0];
      const gx = v.gridX + 26;
      const gy = v.gridY + 8;
      g.enemies.push({
        id: "goblin_trader_test",
        type: "goblin",
        subType: "TRADER",
        x: gx,
        y: gy,
        health: 50,
        maxHealth: 50,
        damage: 0,
        speed: 0,
        state: "IDLE",
        direction: "DOWN",
        isAlive: true,
      });
      g.player.x = gx - 1.5;
      g.player.y = gy;
      const r = window.survivalRenderer || g.renderer;
      if (r) {
        if (typeof r.snapCameraTo === 'function') r.snapCameraTo(g.player.x, g.player.y);
        r.cameraX = g.player.x;
        r.cameraY = g.player.y;
      }
      g.worldManager.updatePlayerLocation(g.player.x, g.player.y);
    });
    await wait(800);
    const p6 = `${SCREENSHOTS_DIR}/06_goblin_camp_and_trader.png`;
    await page.screenshot({ path: p6 });
    console.log(`📸 Captured: ${p6}`);

    // 7. Midnight Skeleton Night Invasion & Fog
    console.log('[7/10] Verifying Midnight Skeleton Raid & Indigo Fog...');
    await page.evaluate(() => {
      const g = window.gameEngine;
      g.worldTime.totalSeconds = 0; // Exactly 00:00 Midnight
      g.worldTime.hour = 0;
      g.worldTime.minute = 5;
      g.worldTime.lightLevel = 0.15;
      // Spawn nearby invading skeleton
      g.enemies.push({
        id: "skeleton_test_raid",
        type: "skeleton",
        subType: "NIGHT_RAID",
        x: g.player.x + 2.5,
        y: g.player.y,
        health: 40,
        maxHealth: 40,
        damage: 15,
        speed: 1.5,
        state: "CHASE",
        direction: "LEFT",
        isAlive: true,
      });
      g.player.isBlocking = true;
    });
    await wait(800);
    const p7 = `${SCREENSHOTS_DIR}/07_midnight_skeleton_invasion_and_fog.png`;
    await page.screenshot({ path: p7 });
    console.log(`📸 Captured: ${p7}`);

    // 8. Animal Husbandry & Baby Breeding with Love Hearts
    console.log('[8/10] Verifying Animal Husbandry & Baby Animals...');
    await page.evaluate(() => {
      const g = window.gameEngine;
      g.worldTime.hour = 10;
      g.worldTime.lightLevel = 1.0;
      g.player.isBlocking = false;
      const v = g.worldManager.villages[0];
      const ax = v.gridX + 10;
      const ay = v.gridY + 18;
      if (g.animals.length > 0) {
        g.animals[0].position.x = ax;
        g.animals[0].position.y = ay;
        g.animals[0].loveTimer = 25;
      }
      if (g.animals.length > 1) {
        g.animals[1].position.x = ax + 1.2;
        g.animals[1].position.y = ay;
        g.animals[1].isBaby = true;
      }
      g.player.x = ax - 1.5;
      g.player.y = ay;
      const r = window.survivalRenderer || g.renderer;
      if (r) {
        if (typeof r.snapCameraTo === 'function') r.snapCameraTo(g.player.x, g.player.y);
        r.cameraX = g.player.x;
        r.cameraY = g.player.y;
      }
      g.worldManager.updatePlayerLocation(g.player.x, g.player.y);
    });
    await wait(800);
    const p8 = `${SCREENSHOTS_DIR}/08_animal_husbandry_and_baby_animals.png`;
    await page.screenshot({ path: p8 });
    console.log(`📸 Captured: ${p8}`);

    // 9. House with Chimney & Animated Smoke
    console.log('[9/10] Verifying Chimney Smoke...');
    await page.evaluate(() => {
      const g = window.gameEngine;
      const v = g.worldManager.villages[0];
      const cx = v.gridX + 8;
      const cy = v.gridY + 4;
      g.player.x = cx;
      g.player.y = cy + 3;
      const r = window.survivalRenderer || g.renderer;
      if (r) {
        if (typeof r.snapCameraTo === 'function') r.snapCameraTo(cx, cy + 2);
        r.cameraX = cx;
        r.cameraY = cy + 2;
      }
      g.worldManager.updatePlayerLocation(cx, cy + 2);
    });
    await wait(800);
    const p9 = `${SCREENSHOTS_DIR}/09_modular_house_with_chimney_smoke.png`;
    await page.screenshot({ path: p9 });
    console.log(`📸 Captured: ${p9}`);

    // 10. Adventure Journal & Almanac Modal ([J] key)
    console.log('[10/11] Verifying Adventure Journal Modal ([J] key)...');
    await page.evaluate(() => {
      const g = window.gameEngine;
      g.showJournal = true;
      g.activeJournalTab = "ALMANAC";
    });
    await wait(800);
    const p10 = `${SCREENSHOTS_DIR}/10_adventure_journal_and_almanac_modal.png`;
    await page.screenshot({ path: p10 });
    console.log(`📸 Captured: ${p10}`);

    // 11. Alchemy & Brewing Stand with Forest Mushrooms
    console.log('[11/11] Verifying Alchemy & Brewing Stand...');
    await page.evaluate(() => {
      const g = window.gameEngine;
      g.showJournal = false;
      const v = g.worldManager.villages[0];
      const bx = v.gridX + 18;
      const by = v.gridY + 12;
      g.placedStructures.push({
        id: "brewing_stand_demo",
        type: "brewing_stand",
        x: bx,
        y: by,
        health: 100,
        maxHealth: 100,
      });
      g.player.x = bx - 1;
      g.player.y = by;
      const r = window.survivalRenderer || g.renderer;
      if (r) {
        if (typeof r.snapCameraTo === 'function') r.snapCameraTo(bx, by);
        r.cameraX = bx;
        r.cameraY = by;
      }
      g.worldManager.updatePlayerLocation(bx, by);
    });
    await wait(800);
    const p11 = `${SCREENSHOTS_DIR}/11_alchemy_and_mushroom_brewing.png`;
    await page.screenshot({ path: p11 });
    console.log(`📸 Captured: ${p11}`);

    console.log('✅ ALL VERIFICATION SCREENSHOTS CAPTURED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Verification run error:', err);
  } finally {
    await browser.close();
  }
}

run();
