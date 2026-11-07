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

    // 1. Oakvale Village Center (Pond and Road Junction)
    await page.evaluate(() => {
      const g = window.gameEngine;
      g.player.x = 26;
      g.player.y = 17;
      g.worldManager.updatePlayerLocation(26, 17);
    });
    await wait(800);
    const p1 = `${SCREENSHOTS_DIR}/01_oakvale_pond_and_roads.png`;
    await page.screenshot({ path: p1 });
    console.log(`📸 Captured: ${p1}`);

    // 2. Highway Bridge over Water
    await page.evaluate(() => {
      const g = window.gameEngine;
      g.player.x = 101;
      g.player.y = -22;
      g.worldManager.updatePlayerLocation(101, -22);
    });
    await wait(800);
    const p2 = `${SCREENSHOTS_DIR}/02_highway_and_bridge.png`;
    await page.screenshot({ path: p2 });
    console.log(`📸 Captured: ${p2}`);

    // 3. Wilderness Lake Shore & Sand Beach
    await page.evaluate(() => {
      const g = window.gameEngine;
      let foundX = 0, foundY = 0;
      for (let r = 15; r < 200; r += 5) {
        for (let a = 0; a < Math.PI * 2; a += 0.2) {
          const x = Math.round(22 + Math.cos(a) * r);
          const y = Math.round(18 + Math.sin(a) * r);
          const t = g.worldManager.getTile(x, y);
          if (t.isWater) {
            foundX = x;
            foundY = y;
            break;
          }
        }
        if (foundX !== 0) break;
      }
      if (foundX !== 0) {
        g.player.x = foundX - 2;
        g.player.y = foundY;
        g.worldManager.updatePlayerLocation(g.player.x, g.player.y);
      }
    });
    await wait(800);
    const p3 = `${SCREENSHOTS_DIR}/03_wilderness_lake_shore.png`;
    await page.screenshot({ path: p3 });
    console.log(`📸 Captured: ${p3}`);

    // 4. Random Wilderness Highway (Oakvale to Riverwood)
    await page.evaluate(() => {
      const g = window.gameEngine;
      for (let param = 0.3; param <= 0.8; param += 0.05) {
        const x = Math.round(22 + param * (118 - 22));
        const y = Math.round(18 + param * (-30 - 18));
        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            const t = g.worldManager.getTile(x + dx, y + dy);
            if (t.isRoad && !t.isBridge) {
              g.player.x = x + dx;
              g.player.y = y + dy;
              g.worldManager.updatePlayerLocation(g.player.x, g.player.y);
              return;
            }
          }
        }
      }
    });
    await wait(800);
    const p4 = `${SCREENSHOTS_DIR}/04_wilderness_road_fork.png`;
    await page.screenshot({ path: p4 });
    console.log(`📸 Captured: ${p4}`);

    // 5. Riverwood Village Site
    await page.evaluate(() => {
      const g = window.gameEngine;
      // Riverwood target is (96, -48)
      g.player.x = 110;
      g.player.y = -35;
      g.worldManager.updatePlayerLocation(110, -35);
    });
    await wait(800);
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
