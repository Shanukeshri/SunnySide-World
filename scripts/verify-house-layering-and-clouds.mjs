import puppeteer from 'puppeteer-core';
import { mkdir, copyFile } from 'node:fs/promises';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUTPUT_DIR = 'test-results/house-layering-and-clouds';
const ARTIFACT_DIR = '/Users/shanukeshri983/.gemini/antigravity/brain/3d377ad0-d352-4889-9acf-064928976e68';

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  console.log('🚀 Running visual verification of House Layering, Cloud Overlay, Inland Ponds, and Random Block Removal...');

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

    // 1. VERIFY RANDOM BLOCKS ARE GONE at player spawn / starter village center
    await page.evaluate(() => {
      const engine = window.survivalEngine;
      const renderer = window.survivalRenderer;
      if (!engine || !renderer) return;

      // Teleport near village center
      const v = engine.worldManager.villages[0];
      if (v) {
        engine.player.x = v.gridX + 10;
        engine.player.y = v.gridY + 10;
        if (engine.networkPrediction) {
          engine.networkPrediction.predictedX = engine.player.x;
          engine.networkPrediction.predictedY = engine.player.y;
        }
        renderer.cameraX = engine.player.x;
        renderer.cameraY = engine.player.y;
      }
    });
    await wait(600);
    const shot1 = `${OUTPUT_DIR}/01_village_no_random_blocks.png`;
    await page.screenshot({ path: shot1 });
    console.log('📸 Captured 01_village_no_random_blocks.png');
    await copyFile(shot1, `${ARTIFACT_DIR}/village_no_random_blocks.png`);

    // 2. VERIFY HOUSE INTERIOR 3D LAYERING (Player inside detailed house)
    const houseInfo = await page.evaluate(() => {
      const engine = window.survivalEngine;
      const renderer = window.survivalRenderer;
      if (!engine || !renderer) return null;

      const v = engine.worldManager.villages[0];
      if (!v) return null;

      const detailedH = v.data.houses.find(h => h.metadata && h.metadata.detailedHouse);
      if (!detailedH) return null;

      const wx = v.gridX + detailedH.x;
      const wy = v.gridY + detailedH.y;
      const dh = detailedH.metadata.detailedHouse;

      // Teleport player directly into the main living room of the detailed house
      const targetX = wx + dh.door.x;
      const targetY = wy + dh.door.y - 2.5;

      engine.player.x = targetX;
      engine.player.y = targetY;
      engine.player.direction = 'UP';
      engine.player.facing = 'UP';
      if (engine.networkPrediction) {
        engine.networkPrediction.predictedX = targetX;
        engine.networkPrediction.predictedY = targetY;
      }
      renderer.cameraX = targetX;
      renderer.cameraY = targetY;

      return {
        houseId: detailedH.id,
        wx,
        wy,
        footprintW: detailedH.footprintW,
        footprintH: detailedH.footprintH,
        door: dh.door,
        playerPos: { x: targetX, y: targetY }
      };
    });

    console.log('Detailed House Interior Info:', houseInfo);
    await wait(800);
    const shot2 = `${OUTPUT_DIR}/02_player_inside_house_layering.png`;
    await page.screenshot({ path: shot2 });
    console.log('📸 Captured 02_player_inside_house_layering.png');
    await copyFile(shot2, `${ARTIFACT_DIR}/player_inside_house_layering.png`);

    // Walk a few steps inside the house to verify depth sorting with furniture
    await page.evaluate(() => {
      const engine = window.survivalEngine;
      const renderer = window.survivalRenderer;
      if (engine && renderer) {
        engine.player.y -= 1.2; // Move deeper into room, near furniture
        if (engine.networkPrediction) engine.networkPrediction.predictedY = engine.player.y;
        renderer.cameraY = engine.player.y;
      }
    });
    await wait(600);
    const shot3 = `${OUTPUT_DIR}/03_player_deeper_inside_house.png`;
    await page.screenshot({ path: shot3 });
    console.log('📸 Captured 03_player_deeper_inside_house.png');
    await copyFile(shot3, `${ARTIFACT_DIR}/player_deeper_inside_house.png`);

    // Move player right in the doorway
    await page.evaluate(() => {
      const engine = window.survivalEngine;
      const renderer = window.survivalRenderer;
      if (engine && renderer && window._hInfo) {
        const { wx, wy, door } = window._hInfo;
        engine.player.x = wx + door.x;
        engine.player.y = wy + door.y + 0.2;
        if (engine.networkPrediction) {
          engine.networkPrediction.predictedX = engine.player.x;
          engine.networkPrediction.predictedY = engine.player.y;
        }
        renderer.cameraX = engine.player.x;
        renderer.cameraY = engine.player.y;
      }
    });

    // 3. VERIFY INLAND PONDS (No bridges or piers on inland ponds)
    const pondInfo = await page.evaluate(() => {
      const engine = window.survivalEngine;
      const renderer = window.survivalRenderer;
      if (!engine || !renderer) return null;

      const v = engine.worldManager.villages[0];
      if (!v) return null;

      const pond = v.data.waterBodies?.[0];
      if (!pond || !pond.cells || pond.cells.length === 0) return null;

      const avgX = Math.round(pond.cells.reduce((sum, c) => sum + c.x, 0) / pond.cells.length);
      const avgY = Math.round(pond.cells.reduce((sum, c) => sum + c.y, 0) / pond.cells.length);

      const px = v.gridX + avgX;
      const py = v.gridY + avgY;

      engine.player.x = px;
      engine.player.y = py - 4;
      if (engine.networkPrediction) {
        engine.networkPrediction.predictedX = engine.player.x;
        engine.networkPrediction.predictedY = engine.player.y;
      }
      renderer.cameraX = px;
      renderer.cameraY = py;

      // Count if any bridge tiles exist in this pond
      let bridgeCount = 0;
      let totalWater = 0;
      for (const c of pond.cells) {
        const t = engine.worldManager.getTile(v.gridX + c.x, v.gridY + c.y);
        if (t.isWater) totalWater++;
        if (t.isBridge || t.terrain === 'bridge_wood') bridgeCount++;
      }

      return { px, py, totalWater, bridgeCount, cellCount: pond.cells.length };
    });

    console.log('Inland Pond Info:', pondInfo);
    await wait(800);
    const shot4 = `${OUTPUT_DIR}/04_inland_pond_pure_water.png`;
    await page.screenshot({ path: shot4 });
    console.log('📸 Captured 04_inland_pond_pure_water.png');
    await copyFile(shot4, `${ARTIFACT_DIR}/inland_pond_pure_water.png`);

    // 4. VERIFY CLOUD OVERLAY (Always active and independent of player position)
    // Capture at T0
    const shot5 = `${OUTPUT_DIR}/05_cloud_overlay_t0.png`;
    await page.screenshot({ path: shot5 });
    console.log('📸 Captured 05_cloud_overlay_t0.png');
    await copyFile(shot5, `${ARTIFACT_DIR}/cloud_overlay_t0.png`);

    // Move player and camera by 15 world tiles to the right
    await page.evaluate(() => {
      const engine = window.survivalEngine;
      const renderer = window.survivalRenderer;
      if (engine && renderer) {
        engine.player.x += 15;
        if (engine.networkPrediction) engine.networkPrediction.predictedX = engine.player.x;
        renderer.cameraX += 15;
      }
    });
    await wait(800);
    const shot6 = `${OUTPUT_DIR}/06_cloud_overlay_player_moved.png`;
    await page.screenshot({ path: shot6 });
    console.log('📸 Captured 06_cloud_overlay_player_moved.png');
    await copyFile(shot6, `${ARTIFACT_DIR}/cloud_overlay_player_moved.png`);

    console.log('🎉 Verification completed successfully!');
  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    await browser.close();
  }
}

run();
