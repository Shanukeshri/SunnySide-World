import puppeteer from 'puppeteer-core';
import { copyFile, mkdir } from 'node:fs/promises';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUTPUT_DIR = 'test-results/light-15-and-white-clouds';
const ARTIFACT_DIR = '/Users/shanukeshri983/.gemini/antigravity/brain/3d377ad0-d352-4889-9acf-064928976e68';

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  console.log('🚀 Running visual verification of 15% light blur spread and pure white translucent clouds...');

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

    // 1. Teleport to village houses
    await page.evaluate(() => {
      const engine = window.survivalEngine;
      const renderer = window.survivalRenderer;
      if (!engine || !renderer) return;

      const v = engine.worldManager.villages[0];
      if (!v) return;

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
    const shot1 = `${OUTPUT_DIR}/01_light_spread_15_percent.png`;
    await page.screenshot({ path: shot1 });
    await copyFile(shot1, `${ARTIFACT_DIR}/light_spread_15_percent.png`);
    console.log('📸 Captured 01_light_spread_15_percent.png');

    // 2. Zoom in slightly on the house interior to inspect the 15% candle halos
    await page.evaluate(() => {
      const renderer = window.survivalRenderer;
      if (renderer) {
        renderer.zoom = 2.8;
      }
    });
    await wait(600);
    const shot2 = `${OUTPUT_DIR}/02_house_interior_15_percent_bloom.png`;
    await page.screenshot({ path: shot2 });
    await copyFile(shot2, `${ARTIFACT_DIR}/house_interior_15_percent_bloom.png`);
    console.log('📸 Captured 02_house_interior_15_percent_bloom.png');

    // 3. Reset zoom and pan across the sky and meadows to inspect the pure white translucent clouds
    await page.evaluate(() => {
      const renderer = window.survivalRenderer;
      const engine = window.survivalEngine;
      if (renderer && engine) {
        renderer.zoom = 2.0;
        engine.player.x += 12;
        if (engine.networkPrediction) engine.networkPrediction.predictedX = engine.player.x;
        renderer.cameraX = engine.player.x;
      }
    });
    await wait(800);
    const shot3 = `${OUTPUT_DIR}/03_pure_white_translucent_clouds.png`;
    await page.screenshot({ path: shot3 });
    await copyFile(shot3, `${ARTIFACT_DIR}/pure_white_translucent_clouds.png`);
    console.log('📸 Captured 03_pure_white_translucent_clouds.png');

    console.log('✨ All captures completed successfully!');
  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    await browser.close();
  }
}

run();

