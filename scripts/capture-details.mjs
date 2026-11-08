import puppeteer from 'puppeteer-core';
import { mkdir, copyFile } from 'node:fs/promises';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUTPUT_DIR = 'test-results/house-details-and-times';
const ARTIFACT_DIR = '/Users/shanukeshri983/.gemini/antigravity/brain/3d377ad0-d352-4889-9acf-064928976e68';

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
  });

  try {
    const page = (await browser.pages())[0];
    await page.setViewport({ width: 1920, height: 1080 });

    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await wait(1200);

    // Dismiss start menu
    await page.evaluate(() => {
      const sp = document.getElementById('btn-menu-singleplayer');
      if (sp) sp.click();
    });
    await wait(1500);

    // 1. Find stone manor or stone house in village
    const houseCoords = await page.evaluate(() => {
      const engine = window.survivalEngine;
      const renderer = window.survivalRenderer;
      if (!engine || !renderer) return null;

      const v = engine.worldManager.villages[0];
      if (!v) return null;

      const results = [];
      for (const h of v.data.houses) {
        if (h.metadata?.detailedHouse) {
          results.push({
            id: h.id,
            wx: v.gridX + h.x,
            wy: v.gridY + h.y,
            w: h.footprintW,
            h: h.footprintH,
            door: h.metadata.detailedHouse.door,
          });
        }
      }
      return results;
    });

    console.log('Found detailed houses:', houseCoords);

    if (houseCoords && houseCoords.length > 0) {
      // Pick first house: capture player just outside doorway
      const h0 = houseCoords[0];
      await page.evaluate((h) => {
        const engine = window.survivalEngine;
        const renderer = window.survivalRenderer;
        const tx = h.wx + h.door.x;
        const ty = h.wy + h.door.y + 1.2;
        engine.player.x = tx;
        engine.player.y = ty;
        engine.player.direction = 'UP';
        engine.player.facing = 'UP';
        if (engine.networkPrediction) {
          engine.networkPrediction.predictedX = tx;
          engine.networkPrediction.predictedY = ty;
        }
        renderer.cameraX = tx;
        renderer.cameraY = ty;
      }, h0);

      await wait(600);
      const shotDoorstep = `${OUTPUT_DIR}/01_player_outside_doorstep.png`;
      await page.screenshot({ path: shotDoorstep });
      await copyFile(shotDoorstep, `${ARTIFACT_DIR}/player_outside_doorstep.png`);
      console.log('📸 Captured 01_player_outside_doorstep.png');

      // Now move player inside doorway
      await page.evaluate((h) => {
        const engine = window.survivalEngine;
        const renderer = window.survivalRenderer;
        const tx = h.wx + h.door.x;
        const ty = h.wy + h.door.y - 1.5;
        engine.player.x = tx;
        engine.player.y = ty;
        engine.player.direction = 'UP';
        engine.player.facing = 'UP';
        if (engine.networkPrediction) {
          engine.networkPrediction.predictedX = tx;
          engine.networkPrediction.predictedY = ty;
        }
        renderer.cameraX = tx;
        renderer.cameraY = ty;
      }, h0);

      await wait(600);
      const shotInside = `${OUTPUT_DIR}/02_player_inside_living_room.png`;
      await page.screenshot({ path: shotInside });
      await copyFile(shotInside, `${ARTIFACT_DIR}/player_inside_living_room.png`);
      console.log('📸 Captured 02_player_inside_living_room.png');

      // Now set time of day to Noon (Day)
      await page.evaluate(() => {
        const engine = window.survivalEngine;
        engine.worldTime.hour = 12;
        engine.worldTime.minute = 0;
        engine.worldTime.timeOfDay = 'Day';
        engine.worldTime.lightLevel = 1.0;
      });
      await wait(600);
      const shotDay = `${OUTPUT_DIR}/03_clouds_daytime.png`;
      await page.screenshot({ path: shotDay });
      await copyFile(shotDay, `${ARTIFACT_DIR}/clouds_daytime.png`);
      console.log('📸 Captured 03_clouds_daytime.png');

      // Now set time of day to Sunset (Golden hour)
      await page.evaluate(() => {
        const engine = window.survivalEngine;
        engine.worldTime.hour = 19;
        engine.worldTime.minute = 30;
        engine.worldTime.timeOfDay = 'Sunset';
        engine.worldTime.lightLevel = 0.5;
      });
      await wait(600);
      const shotSunset = `${OUTPUT_DIR}/04_clouds_sunset.png`;
      await page.screenshot({ path: shotSunset });
      await copyFile(shotSunset, `${ARTIFACT_DIR}/clouds_sunset.png`);
      console.log('📸 Captured 04_clouds_sunset.png');

      // Now set time of day to Night (with lantern bloom & moonlit clouds)
      await page.evaluate(() => {
        const engine = window.survivalEngine;
        engine.worldTime.hour = 22;
        engine.worldTime.minute = 0;
        engine.worldTime.timeOfDay = 'Night';
        engine.worldTime.lightLevel = 0.2;
      });
      await wait(600);
      const shotNight = `${OUTPUT_DIR}/05_clouds_and_lanterns_night.png`;
      await page.screenshot({ path: shotNight });
      await copyFile(shotNight, `${ARTIFACT_DIR}/clouds_and_lanterns_night.png`);
      console.log('📸 Captured 05_clouds_and_lanterns_night.png');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

run();

