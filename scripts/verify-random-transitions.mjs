import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SCREENSHOTS_DIR = 'test-results/screenshots-random-transitions';

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  await mkdir(SCREENSHOTS_DIR, { recursive: true });
  console.log('🚀 Starting Random Transitions Verification in Browser...');

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
    await wait(1500);

    await page.waitForSelector('canvas', { timeout: 10000 });
    console.log('Canvas active.');

    // Helper inside browser context to snap player, camera, and prediction
    const snapTo = async (wx, wy) => {
      await page.evaluate((targetX, targetY) => {
        const g = window.gameEngine;
        g.player.x = targetX;
        g.player.y = targetY;
        if (g.networkPrediction) {
          g.networkPrediction.predictedX = targetX;
          g.networkPrediction.predictedY = targetY;
        }
        g.renderer.snapCameraTo(targetX, targetY);
        g.worldManager.updatePlayerLocation(targetX, targetY);
      }, wx, wy);
      await wait(600);
    };

    // 1. Oakvale Village Center (Pond and Sand Shore Shelf)
    await page.evaluate(() => {
      const g = window.gameEngine;
      const v = g.worldManager.villages[0];
      const pond = v.data.waterBodies[0];
      const p = pond.cells[Math.floor(pond.cells.length / 2)];
      const wx = v.gridX + p.x;
      const wy = v.gridY + p.y;
      g.player.x = wx;
      g.player.y = wy;
      if (g.networkPrediction) {
        g.networkPrediction.predictedX = wx;
        g.networkPrediction.predictedY = wy;
      }
      g.renderer.snapCameraTo(wx, wy);
      g.worldManager.updatePlayerLocation(wx, wy);
    });
    await wait(600);
    const p1 = `${SCREENSHOTS_DIR}/01_oakvale_pond_and_roads.png`;
    await page.screenshot({ path: p1 });
    console.log(`📸 Captured: ${p1}`);

    // 2. Highway Bridge over Water
    await snapTo(101, -22);
    const p2 = `${SCREENSHOTS_DIR}/02_highway_and_bridge.png`;
    await page.screenshot({ path: p2 });
    console.log(`📸 Captured: ${p2}`);

    // 3. Wilderness Lake Shore & Sand Beach
    await page.evaluate(() => {
      const g = window.gameEngine;
      let wx = 0, wy = 0;
      for (let y = -150; y < 150; y += 3) {
        for (let x = -150; x < 150; x += 3) {
          const t = g.worldManager.getTile(x, y);
          if (t.isWater && !g.worldManager.villages.some(v => x >= v.gridX && x <= v.gridX + v.width && y >= v.gridY && y <= v.gridY + v.height)) {
            wx = x; wy = y; break;
          }
        }
        if (wx !== 0) break;
      }
      if (wx !== 0) {
        g.player.x = wx;
        g.player.y = wy;
        if (g.networkPrediction) {
          g.networkPrediction.predictedX = wx;
          g.networkPrediction.predictedY = wy;
        }
        g.renderer.snapCameraTo(wx, wy);
        g.worldManager.updatePlayerLocation(wx, wy);
      }
    });
    await wait(600);
    const p3 = `${SCREENSHOTS_DIR}/03_wilderness_lake_shore.png`;
    await page.screenshot({ path: p3 });
    console.log(`📸 Captured: ${p3}`);

    // 4. Random Wilderness Highway (Oakvale to Riverwood)
    await snapTo(76, -10);
    const p4 = `${SCREENSHOTS_DIR}/04_wilderness_road_fork.png`;
    await page.screenshot({ path: p4 });
    console.log(`📸 Captured: ${p4}`);

    // 5. Riverwood Village Site
    await snapTo(118, -30);
    const p5 = `${SCREENSHOTS_DIR}/05_riverwood_village_overview.png`;
    await page.screenshot({ path: p5 });
    console.log(`📸 Captured: ${p5}`);

    console.log('✅ All 5 random transition screenshots captured successfully!');
  } catch (err) {
    console.error('Error during transition verification:', err);
  } finally {
    await browser.close();
  }
}

run();
