import puppeteer from 'puppeteer-core';
import { mkdir, copyFile } from 'node:fs/promises';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUTPUT_DIR = 'test-results/house-collision-and-3d';
const ARTIFACT_DIR = '/Users/shanukeshri983/.gemini/antigravity/brain/3d377ad0-d352-4889-9acf-064928976e68';

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  console.log('🚀 Running visual verification of House Collision Rectification & 3D Polish...');

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

    // 1. COLLISION BOUNDARY VERIFICATION ACROSS ALL HOUSES
    const allHousesReport = await page.evaluate(() => {
      const engine = window.survivalEngine;
      if (!engine) return { error: 'No survivalEngine' };

      const v = engine.worldManager.villages[0];
      if (!v) return { error: 'No village' };

      const detailedHouses = v.data.houses.filter(h => h.metadata && h.metadata.detailedHouse);

      const houseReports = detailedHouses.map((detailedH, idx) => {
        const dh = detailedH.metadata.detailedHouse;
        const wx = v.gridX + detailedH.x;
        const wy = v.gridY + detailedH.y;

        const doorX = dh.door.x;
        const doorY = dh.door.y;
        const doorW = dh.door.w || 2;

        const doorPoints = [
          { desc: 'Doorstep outside left', x: wx + doorX + 0.2, y: wy + doorY + 1.2 },
          { desc: 'Doorstep outside center', x: wx + doorX + 0.5, y: wy + doorY + 1.2 },
          { desc: 'Doorstep outside right', x: wx + doorX + doorW - 0.2, y: wy + doorY + 1.2 },
          { desc: 'Doorway threshold left', x: wx + doorX + 0.2, y: wy + doorY + 0.2 },
          { desc: 'Doorway threshold center', x: wx + doorX + 0.5, y: wy + doorY + 0.2 },
          { desc: 'Doorway threshold right', x: wx + doorX + doorW - 0.2, y: wy + doorY + 0.2 },
          { desc: 'Living room interior entrance', x: wx + doorX + 0.5, y: wy + doorY - 1.0 },
        ];

        const doorResults = doorPoints.map(pt => ({
          desc: pt.desc,
          canMove: engine.canMoveTo(pt.x, pt.y),
        }));

        let partitionResults = [];
        if (dh.rooms.length >= 2) {
          const partX = dh.rooms[0].bounds.x + dh.rooms[0].bounds.w;
          const mainH = dh.hullBounds.h;
          const partDoorY = Math.max(3, Math.min(mainH - 4, Math.floor(mainH * 0.45)));
          const partPoints = [
            { desc: 'Partition door upper tile', x: wx + partX, y: wy + partDoorY },
            { desc: 'Partition door lower tile', x: wx + partX, y: wy + partDoorY + 1 },
            { desc: 'Cellar room inside', x: wx + partX + 1.5, y: wy + partDoorY + 0.5 },
          ];
          partitionResults = partPoints.map(pt => ({
            desc: pt.desc,
            canMove: engine.canMoveTo(pt.x, pt.y),
          }));
        }

        return {
          id: detailedH.id,
          houseW: detailedH.footprintW,
          houseH: detailedH.footprintH,
          rooms: dh.rooms.map(r => r.name),
          doorX,
          doorY,
          doorW,
          doorResults,
          partitionResults,
        };
      });

      return houseReports;
    });

    console.log('📊 All Village Houses Collision Report:', JSON.stringify(allHousesReport, null, 2));

    // 2. SCREENSHOT: Player standing on 2-Tile Door Threshold Mat
    await page.evaluate(() => {
      const engine = window.survivalEngine;
      const renderer = window.survivalRenderer;
      const v = engine.worldManager.villages[0];
      const detailedH = v.data.houses.find(h => h.metadata && h.metadata.detailedHouse && h.metadata.detailedHouse.rooms.length >= 2)
        || v.data.houses.find(h => h.metadata && h.metadata.detailedHouse);
      const dh = detailedH.metadata.detailedHouse;
      const wx = v.gridX + detailedH.x;
      const wy = v.gridY + detailedH.y;

      renderer.zoom = 3.0;

      // Stand right on the door threshold mat
      engine.player.x = wx + dh.door.x + 0.5;
      engine.player.y = wy + dh.door.y;
      if (engine.networkPrediction) {
        engine.networkPrediction.predictedX = engine.player.x;
        engine.networkPrediction.predictedY = engine.player.y;
      }
      renderer.cameraX = engine.player.x;
      renderer.cameraY = engine.player.y;
    });
    await wait(600);
    const shot1 = `${OUTPUT_DIR}/01_player_on_2tile_door_threshold.png`;
    await page.screenshot({ path: shot1 });
    console.log('📸 Captured 01_player_on_2tile_door_threshold.png');
    await copyFile(shot1, `${ARTIFACT_DIR}/player_on_2tile_door_threshold.png`);

    // 3. SCREENSHOT: Player inside Living Room
    await page.evaluate(() => {
      const engine = window.survivalEngine;
      const renderer = window.survivalRenderer;
      const v = engine.worldManager.villages[0];
      const detailedH = v.data.houses.find(h => h.metadata && h.metadata.detailedHouse && h.metadata.detailedHouse.rooms.length >= 2)
        || v.data.houses.find(h => h.metadata && h.metadata.detailedHouse);
      const dh = detailedH.metadata.detailedHouse;
      const wx = v.gridX + detailedH.x;
      const wy = v.gridY + detailedH.y;

      renderer.zoom = 3.0;

      // Move into living room center
      engine.player.x = wx + dh.door.x + 0.5;
      engine.player.y = wy + dh.door.y - 2.5;
      if (engine.networkPrediction) {
        engine.networkPrediction.predictedX = engine.player.x;
        engine.networkPrediction.predictedY = engine.player.y;
      }
      renderer.cameraX = engine.player.x;
      renderer.cameraY = engine.player.y;
    });
    await wait(600);
    const shot2 = `${OUTPUT_DIR}/02_player_inside_living_room.png`;
    await page.screenshot({ path: shot2 });
    console.log('📸 Captured 02_player_inside_living_room.png');
    await copyFile(shot2, `${ARTIFACT_DIR}/player_inside_living_room_3d.png`);

    // 4. SCREENSHOT: Player in Cellar Room beside Ladder & Anvil
    await page.evaluate(() => {
      const engine = window.survivalEngine;
      const renderer = window.survivalRenderer;
      const v = engine.worldManager.villages[0];
      const detailedH = v.data.houses.find(h => h.metadata && h.metadata.detailedHouse && h.metadata.detailedHouse.rooms.length >= 2)
        || v.data.houses.find(h => h.metadata && h.metadata.detailedHouse);
      const dh = detailedH.metadata.detailedHouse;
      const wx = v.gridX + detailedH.x;
      const wy = v.gridY + detailedH.y;

      renderer.zoom = 3.0;

      const cellar = dh.rooms.find(r => r.type === 'cellar');
      if (cellar) {
        engine.player.x = wx + cellar.bounds.x + 1.0;
        engine.player.y = wy + cellar.bounds.y + 1.5;
      } else {
        engine.player.x = wx + 2;
        engine.player.y = wy + 3;
      }
      if (engine.networkPrediction) {
        engine.networkPrediction.predictedX = engine.player.x;
        engine.networkPrediction.predictedY = engine.player.y;
      }
      renderer.cameraX = engine.player.x;
      renderer.cameraY = engine.player.y;
    });
    await wait(600);
    const shot3 = `${OUTPUT_DIR}/03_player_in_cellar_room.png`;
    await page.screenshot({ path: shot3 });
    console.log('📸 Captured 03_player_in_cellar_room.png');
    await copyFile(shot3, `${ARTIFACT_DIR}/player_in_cellar_room_3d.png`);

    // 5. SCREENSHOT: High-Detail Close-Up of Village Houses
    await page.evaluate(() => {
      const engine = window.survivalEngine;
      const renderer = window.survivalRenderer;
      const v = engine.worldManager.villages[0];
      const detailedH = v.data.houses.find(h => h.metadata && h.metadata.detailedHouse && h.metadata.detailedHouse.rooms.length >= 2)
        || v.data.houses.find(h => h.metadata && h.metadata.detailedHouse);
      const wx = v.gridX + detailedH.x;
      const wy = v.gridY + detailedH.y;

      renderer.zoom = 2.8;

      // Position camera showing front facade and doorsteps
      engine.player.x = wx + detailedH.footprintW / 2;
      engine.player.y = wy + detailedH.footprintH + 1.2;
      if (engine.networkPrediction) {
        engine.networkPrediction.predictedX = engine.player.x;
        engine.networkPrediction.predictedY = engine.player.y;
      }
      renderer.cameraX = engine.player.x;
      renderer.cameraY = engine.player.y;
    });
    await wait(600);
    const shot4 = `${OUTPUT_DIR}/04_houses_3d_facade_and_doorsteps.png`;
    await page.screenshot({ path: shot4 });
    console.log('📸 Captured 04_houses_3d_facade_and_doorsteps.png');
    await copyFile(shot4, `${ARTIFACT_DIR}/houses_3d_facade_and_doorsteps.png`);

    // 6. SCREENSHOT: Full Village Overview with White Translucent Clouds
    await page.evaluate(() => {
      const engine = window.survivalEngine;
      const renderer = window.survivalRenderer;
      const v = engine.worldManager.villages[0];

      renderer.zoom = 2.0;

      engine.player.x = v.gridX + 12;
      engine.player.y = v.gridY + 12;
      if (engine.networkPrediction) {
        engine.networkPrediction.predictedX = engine.player.x;
        engine.networkPrediction.predictedY = engine.player.y;
      }
      renderer.cameraX = engine.player.x;
      renderer.cameraY = engine.player.y;
    });
    await wait(600);
    const shot5 = `${OUTPUT_DIR}/05_village_overview_3d_houses_and_clouds.png`;
    await page.screenshot({ path: shot5 });
    console.log('📸 Captured 05_village_overview_3d_houses_and_clouds.png');
    await copyFile(shot5, `${ARTIFACT_DIR}/village_overview_3d_houses_and_clouds.png`);

  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('❌ Error during verification:', err);
  process.exit(1);
});
