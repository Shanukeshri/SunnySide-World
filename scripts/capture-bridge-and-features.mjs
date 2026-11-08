import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUTPUT_DIR = 'test-results/bridge-crops-verification';

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  console.log('🚀 Running visual verification of Bridges, Stilts, Shadows, Crops, and Curvy Lakes...');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
  });

  try {
    const page = (await browser.pages())[0];
    await page.setViewport({ width: 1920, height: 1080 });

    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await wait(1000);

    // Dismiss start menu
    await page.evaluate(() => {
      const sp = document.getElementById('btn-menu-singleplayer');
      if (sp) sp.click();
    });
    await wait(1500);

    // 1. Locate and teleport to a bridge tile over water
    const bridgeCoord = await page.evaluate(() => {
      const engine = window.survivalEngine;
      const renderer = window.survivalRenderer;
      if (!engine) return null;

      // Find an authentic bridge over water in the world
      for (let r = 5; r < 200; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
            const tile = engine.worldManager.getTile(dx, dy);
            if (tile.isBridge || tile.terrain === 'bridge_wood') {
              // Found bridge! Teleport player and camera directly to bridge
              engine.player.x = dx;
              engine.player.y = dy;
              if (engine.networkPrediction) {
                engine.networkPrediction.predictedX = dx;
                engine.networkPrediction.predictedY = dy;
              }
              if (renderer) {
                renderer.cameraX = dx;
                renderer.cameraY = dy;
              }
              return { x: dx, y: dy, terrain: tile.terrain, isWater: tile.isWater };
            }
          }
        }
      }
      return null;
    });

    console.log('Bridge location found:', bridgeCoord);
    await wait(800);

    // Zoom in on bridge to see 3D stilts, drop shadow, and clean water underneath
    await page.screenshot({ path: `${OUTPUT_DIR}/01_wooden_bridge_over_water.png` });
    console.log('📸 Captured 01_wooden_bridge_over_water.png');

    // Walk a few steps on the bridge to see movement and perspective
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('KeyD');
      await wait(40);
    }
    await wait(400);
    await page.screenshot({ path: `${OUTPUT_DIR}/02_player_walking_on_bridge.png` });
    console.log('📸 Captured 02_player_walking_on_bridge.png');

    // 2. Teleport player to the Starter Farm to inspect the reduced crop size
    const farmCoord = await page.evaluate(() => {
      const engine = window.survivalEngine;
      const renderer = window.survivalRenderer;
      if (!engine) return null;
      // Starter village Oakvale is around (0, 0)
      for (let r = 2; r < 60; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const tile = engine.worldManager.getTile(dx, dy);
            if (tile.isFarm) {
              engine.player.x = dx;
              engine.player.y = dy;
              if (engine.networkPrediction) {
                engine.networkPrediction.predictedX = dx;
                engine.networkPrediction.predictedY = dy;
              }
              if (renderer) {
                renderer.cameraX = dx;
                renderer.cameraY = dy;
              }
              return { x: dx, y: dy };
            }
          }
        }
      }
      return null;
    });
    console.log('Farm location found:', farmCoord);
    await wait(800);
    await page.screenshot({ path: `${OUTPUT_DIR}/03_crops_reduced_size_in_furrows.png` });
    console.log('📸 Captured 03_crops_reduced_size_in_furrows.png');

    // 3. Switch to World Generation tab to inspect Curvy Lake & Fishing Pier
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
      await wait(100);
    }
    await wait(800);

    // Fit canvas
    await page.evaluate(() => {
      const fitBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Fit'));
      if (fitBtn) fitBtn.click();
    });
    await wait(600);
    await page.screenshot({ path: `${OUTPUT_DIR}/04_worldgen_curvy_lake_and_pier.png` });
    console.log('📸 Captured 04_worldgen_curvy_lake_and_pier.png');

    console.log('✨ All visual captures completed!');
  } catch (err) {
    console.error('Error in verification:', err);
  } finally {
    await browser.close();
  }
}

run();
