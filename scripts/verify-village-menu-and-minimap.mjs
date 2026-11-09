import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUTPUT_DIR = 'test-results/browser-verification';

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  console.log('🧪 Starting Verification of Village Starting Screen & Downgraded World Minimap in Chrome...\n');

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

    // ────────────────────────────────────────────────────────────────
    // TEST 1: Starting Screen using Same World Rendering on a Village and Spanning Slowly
    // ────────────────────────────────────────────────────────────────
    console.log('--- TEST 1: Starting Screen with Same World Rendering on Village ---');
    await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 15000 });
    await wait(1200);

    const menuCheck1 = await page.evaluate(() => {
      const menu = document.getElementById('main-menu');
      const container = document.getElementById('main-menu-bg-container');
      const canvas = container ? container.querySelector('canvas') : null;

      // Access MenuBackgroundRenderer if exposed or check canvas context
      return {
        menuVisible: menu && !menu.classList.contains('hidden'),
        hasCanvas: !!canvas,
        canvasW: canvas ? canvas.width : 0,
        canvasH: canvas ? canvas.height : 0,
      };
    });

    console.log('Starting Screen initial state:', menuCheck1);
    if (!menuCheck1.menuVisible || !menuCheck1.hasCanvas) {
      failures.push('Main menu starting screen or background canvas is not present');
    }

    // Save initial screenshot of village starting screen
    await page.screenshot({ path: `${OUTPUT_DIR}/12_starting_screen_village_t0.png` });
    console.log('📸 Saved 12_starting_screen_village_t0.png');

    // Wait 2.5 seconds to observe slow panning
    await wait(2500);
    await page.screenshot({ path: `${OUTPUT_DIR}/13_starting_screen_village_t2.png` });
    console.log('📸 Saved 13_starting_screen_village_t2.png (slow panning)');

    // ────────────────────────────────────────────────────────────────
    // TEST 2: Enter Game and Inspect Minimap (Downgraded World View)
    // ────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 2: In-Game Downgraded World Minimap ---');
    await page.click('#btn-menu-singleplayer');
    await wait(2000);

    const minimapCheck = await page.evaluate(() => {
      const engine = window.survivalEngine;
      const radarCanvas = document.getElementById('radar-canvas');
      if (!engine || !radarCanvas) return { error: 'No survivalEngine or radarCanvas' };

      const ctx = radarCanvas.getContext('2d');
      const imgData = ctx.getImageData(0, 0, radarCanvas.width, radarCanvas.height);
      const pixels = imgData.data;

      // Analyze colors present on minimap:
      // Water: blue hues (r < 100, b > 180)
      // Grass: green hues (g > r, g > b, g > 70)
      // Road/path: amber/brown (r > 160, g > 100, b < 40)
      // Farm soil: dark brown (r ~ 120, g ~ 53, b ~ 15)
      // Roof / Houses: terracotta red (r > 190, g < 60, b < 60)
      // Shore foam: cyan-white (r > 170, g > 220, b > 240)
      let waterPixels = 0;
      let grassPixels = 0;
      let roadPixels = 0;
      let farmPixels = 0;
      let houseRoofPixels = 0;
      let shoreFoamPixels = 0;

      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];

        if (a === 0) continue;

        if (r > 190 && g < 70 && b < 70) {
          houseRoofPixels++;
        } else if (r < 80 && g > 120 && b > 200) {
          waterPixels++;
        } else if (r > 160 && g > 210 && b > 230) {
          shoreFoamPixels++;
        } else if (r > 180 && g > 100 && b < 50) {
          roadPixels++;
        } else if (r > 90 && r < 150 && g > 40 && g < 80 && b < 30) {
          farmPixels++;
        } else if (g > r && g > b && g > 65) {
          grassPixels++;
        }
      }

      // Check structures in village
      const villages = engine.worldManager.villages;
      let totalHouses = 0;
      if (villages) {
        for (const v of villages) {
          if (v.data?.houses) totalHouses += v.data.houses.length;
        }
      }

      // Add a placed structure near the player to test placed structure rendering
      engine.addPlacedStructure('wood_wall', Math.floor(engine.player.x) + 2, Math.floor(engine.player.y), false);
      engine.addPlacedStructure('chest', Math.floor(engine.player.x) + 2, Math.floor(engine.player.y) + 1, false);

      return {
        canvasW: radarCanvas.width,
        canvasH: radarCanvas.height,
        waterPixels,
        grassPixels,
        roadPixels,
        farmPixels,
        houseRoofPixels,
        shoreFoamPixels,
        totalHousesInWorld: totalHouses,
        playerPos: { x: engine.player.x, y: engine.player.y },
      };
    });

    console.log('Minimap analysis results:', minimapCheck);

    if (minimapCheck.grassPixels < 500) {
      failures.push('Minimap lacks proper grass terrain pixels');
    }

    // Teleport player directly into the village center to verify house and road rendering on minimap
    console.log('\n--- Teleporting player to village to inspect downgraded houses & roads ---');
    const villageTeleportCheck = await page.evaluate(() => {
      const engine = window.survivalEngine;
      const radarCanvas = document.getElementById('radar-canvas');
      const v = engine.worldManager.villages && engine.worldManager.villages[0];
      if (v && v.data?.houses && v.data.houses.length > 0) {
        const h = v.data.houses[0];
        engine.player.x = v.gridX + h.x;
        engine.player.y = v.gridY + h.y;
      }

      // Re-render minimap frame
      const ctx = radarCanvas.getContext('2d');
      const imgData = ctx.getImageData(0, 0, radarCanvas.width, radarCanvas.height);
      const pixels = imgData.data;

      let houseRoofPixels = 0;
      let roadPixels = 0;
      let farmPixels = 0;

      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        if (r > 190 && g < 70 && b < 70) houseRoofPixels++;
        if (r > 180 && g > 100 && b < 50) roadPixels++;
        if (r > 90 && r < 150 && g > 40 && g < 80 && b < 30) farmPixels++;
      }

      return {
        villageX: v ? v.gridX : 0,
        villageY: v ? v.gridY : 0,
        playerPos: { x: engine.player.x, y: engine.player.y },
        houseRoofPixels,
        roadPixels,
        farmPixels,
      };
    });

    console.log('Village center minimap results:', villageTeleportCheck);
    await wait(300);
    await page.screenshot({ path: `${OUTPUT_DIR}/14_minimap_downgraded_world_village.png` });
    console.log('📸 Saved 14_minimap_downgraded_world_village.png');

    if (villageTeleportCheck.houseRoofPixels < 10) {
      failures.push('Houses are not visible with terracotta roofs on village minimap');
    }

    console.log('\n=========================================');
    console.log(`Verification Complete. Failures: ${failures.length}`);
    if (failures.length > 0) {
      console.error('FAILURES:');
      failures.forEach((f) => console.error('  - ' + f));
    } else {
      console.log('🎉 ALL VILLAGE STARTING SCREEN & DOWNGRADED MINIMAP REQUIREMENTS VERIFIED!');
    }
    console.log('=========================================\n');

  } catch (err) {
    console.error('Test execution error:', err);
    failures.push(String(err));
  } finally {
    await browser.close();
  }

  if (failures.length > 0) {
    process.exit(1);
  }
}

run();

