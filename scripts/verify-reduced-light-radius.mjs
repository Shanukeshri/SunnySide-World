import puppeteer from 'puppeteer-core';
import { copyFile, mkdir } from 'node:fs/promises';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUTPUT_DIR = 'test-results/light-spread-verification';
const ARTIFACT_DIR = '/Users/shanukeshri983/.gemini/antigravity/brain/3d377ad0-d352-4889-9acf-064928976e68';

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  console.log('🚀 Running visual verification of reduced light blur spread radius...');

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

    // Find the two houses seen in user screenshot (tavern and blacksmith/workshop)
    await page.evaluate(() => {
      const engine = window.survivalEngine;
      const renderer = window.survivalRenderer;
      if (!engine || !renderer) return;

      const v = engine.worldManager.villages[0];
      if (!v) return;

      // Locate house at ~ wx = 66, wy = 48 or similar
      const detailedH = v.data.houses.find(h => h.id.includes('mansion') || h.id.includes('tavern') || h.id.includes('workshop'));
      if (detailedH) {
        const targetX = v.gridX + detailedH.x + 6;
        const targetY = v.gridY + detailedH.y + 6;

        engine.player.x = targetX;
        engine.player.y = targetY;
        if (engine.networkPrediction) {
          engine.networkPrediction.predictedX = targetX;
          engine.networkPrediction.predictedY = targetY;
        }
        renderer.cameraX = targetX;
        renderer.cameraY = targetY;
      }
    });

    await wait(800);
    const shot1 = `${OUTPUT_DIR}/01_reduced_light_spread_5_percent.png`;
    await page.screenshot({ path: shot1 });
    await copyFile(shot1, `${ARTIFACT_DIR}/reduced_light_spread_5_percent.png`);
    console.log('📸 Captured 01_reduced_light_spread_5_percent.png');

    // Also take a close-up of a house interior
    await page.evaluate(() => {
      const renderer = window.survivalRenderer;
      if (renderer) {
        renderer.zoom = 3.2; // Zoom in to clearly see the crisp tiny candle/lamp flame dots
      }
    });
    await wait(600);
    const shot2 = `${OUTPUT_DIR}/02_close_up_candle_lights.png`;
    await page.screenshot({ path: shot2 });
    await copyFile(shot2, `${ARTIFACT_DIR}/close_up_candle_lights.png`);
    console.log('📸 Captured 02_close_up_candle_lights.png');

    console.log('✨ Verification completed!');
  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    await browser.close();
  }
}

run();

