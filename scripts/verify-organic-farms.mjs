import puppeteer from 'puppeteer-core';
import { mkdir, copyFile } from 'node:fs/promises';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUTPUT_DIR = 'test-results/organic-farms';
const ARTIFACT_DIR = '/Users/shanukeshri983/.gemini/antigravity/brain/3d377ad0-d352-4889-9acf-064928976e68';

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  console.log('🚀 Running visual verification of Organic Curved Farmlands...');

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

    // 1. Inspect organic farms generated in starter village
    const farmsInfo = await page.evaluate(() => {
      const engine = window.survivalEngine;
      const renderer = window.survivalRenderer;
      if (!engine || !renderer) return null;

      const v = engine.worldManager.villages[0];
      if (!v) return null;

      return v.data.farms.map((f, idx) => ({
        index: idx,
        x: v.gridX + f.x,
        y: v.gridY + f.y,
        w: f.w,
        h: f.h,
        cellCount: f.cells.length,
        cropBaseId: f.cropBaseId,
      }));
    });

    console.log('Found organic farms in village:', farmsInfo);

    if (farmsInfo && farmsInfo.length > 0) {
      // Teleport to the first organic farm
      const f0 = farmsInfo[0];
      await page.evaluate((farm) => {
        const engine = window.survivalEngine;
        const renderer = window.survivalRenderer;
        const targetX = farm.x + Math.floor(farm.w / 2);
        const targetY = farm.y + Math.floor(farm.h / 2);

        engine.player.x = targetX;
        engine.player.y = targetY - 4;
        engine.player.direction = 'DOWN';
        engine.player.facing = 'DOWN';
        if (engine.networkPrediction) {
          engine.networkPrediction.predictedX = engine.player.x;
          engine.networkPrediction.predictedY = engine.player.y;
        }
        renderer.cameraX = targetX;
        renderer.cameraY = targetY;
      }, f0);

      await wait(800);
      const shot1 = `${OUTPUT_DIR}/01_organic_farm_plot_0.png`;
      await page.screenshot({ path: shot1 });
      await copyFile(shot1, `${ARTIFACT_DIR}/organic_farm_plot_0.png`);
      console.log('📸 Captured 01_organic_farm_plot_0.png');

      // Teleport to second farm if available
      if (farmsInfo.length > 1) {
        const f1 = farmsInfo[1];
        await page.evaluate((farm) => {
          const engine = window.survivalEngine;
          const renderer = window.survivalRenderer;
          const targetX = farm.x + Math.floor(farm.w / 2);
          const targetY = farm.y + Math.floor(farm.h / 2);

          engine.player.x = targetX;
          engine.player.y = targetY - 3;
          if (engine.networkPrediction) {
            engine.networkPrediction.predictedX = engine.player.x;
            engine.networkPrediction.predictedY = engine.player.y;
          }
          renderer.cameraX = targetX;
          renderer.cameraY = targetY;
        }, f1);

        await wait(800);
        const shot2 = `${OUTPUT_DIR}/02_organic_farm_plot_1.png`;
        await page.screenshot({ path: shot2 });
        await copyFile(shot2, `${ARTIFACT_DIR}/organic_farm_plot_1.png`);
        console.log('📸 Captured 02_organic_farm_plot_1.png');
      }

      // Teleport to third farm if available
      if (farmsInfo.length > 2) {
        const f2 = farmsInfo[2];
        await page.evaluate((farm) => {
          const engine = window.survivalEngine;
          const renderer = window.survivalRenderer;
          const targetX = farm.x + Math.floor(farm.w / 2);
          const targetY = farm.y + Math.floor(farm.h / 2);

          engine.player.x = targetX;
          engine.player.y = targetY - 3;
          if (engine.networkPrediction) {
            engine.networkPrediction.predictedX = engine.player.x;
            engine.networkPrediction.predictedY = engine.player.y;
          }
          renderer.cameraX = targetX;
          renderer.cameraY = targetY;
        }, f2);

        await wait(800);
        const shot3 = `${OUTPUT_DIR}/03_organic_farm_plot_2.png`;
        await page.screenshot({ path: shot3 });
        await copyFile(shot3, `${ARTIFACT_DIR}/organic_farm_plot_2.png`);
        console.log('📸 Captured 03_organic_farm_plot_2.png');
      }
    }

    // 2. Switch to World Generation tab to see all farmlands from above
    await page.evaluate(() => {
      const tab = document.getElementById('tab-settlement');
      if (tab) tab.click();
    });
    await wait(800);

    // Advance to Phase 10
    for (let p = 0; p < 10; p++) {
      await page.evaluate(() => {
        const btn = document.getElementById('btn-next-phase');
        if (btn && !btn.disabled) btn.click();
      });
      await wait(80);
    }
    await wait(800);

    // Click Fit button
    await page.evaluate(() => {
      const fitBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Fit'));
      if (fitBtn) fitBtn.click();
    });
    await wait(800);

    const shot4 = `${OUTPUT_DIR}/04_worldgen_organic_farms_overview.png`;
    await page.screenshot({ path: shot4 });
    await copyFile(shot4, `${ARTIFACT_DIR}/worldgen_organic_farms_overview.png`);
    console.log('📸 Captured 04_worldgen_organic_farms_overview.png');

    console.log('✨ All organic farm verification captures completed!');
  } catch (err) {
    console.error('Error in verification:', err);
  } finally {
    await browser.close();
  }
}

run();

