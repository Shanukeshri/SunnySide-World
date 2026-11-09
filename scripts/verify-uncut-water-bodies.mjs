import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUTPUT_DIR = 'test-results/browser-verification';

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  console.log('🧪 Starting Verification of Inland Water Bodies Not Cut By Roads in Chrome...\n');

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

    console.log('--- Launching Single Player Game ---');
    await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 15000 });
    await wait(1200);

    // Click single player to start the survival game
    await page.click('#btn-menu-singleplayer');
    await wait(1800);

    // ────────────────────────────────────────────────────────────────
    // TEST 1: Inspect Settlement Water Bodies and Road Isolation
    // ────────────────────────────────────────────────────────────────
    console.log('--- TEST 1: Inspecting Settlement Water Bodies in Starter Village ---');
    const waterAnalysis = await page.evaluate(() => {
      const engine = window.survivalEngine;
      if (!engine || !engine.worldManager) return { error: 'Engine or WorldManager not ready' };

      const wm = engine.worldManager;
      const v = wm.villages && wm.villages[0];
      if (!v || !v.data) return { error: 'No village data found' };

      const waterBodies = v.data.waterBodies || [];
      const houses = v.data.houses || [];
      const roadCells = v.data.roadCells || [];

      let totalWaterCells = 0;
      let waterCellsWithRoad = 0;
      let waterCellsTouchingRoad = 0;

      const pondDetails = [];

      for (let pIdx = 0; pIdx < waterBodies.length; pIdx++) {
        const pond = waterBodies[pIdx];
        let pRoadCount = 0;
        let pAdjacentRoadCount = 0;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        for (const cell of pond.cells) {
          totalWaterCells++;
          const worldX = v.gridX + cell.x;
          const worldY = v.gridY + cell.y;
          const tile = wm.getTile(worldX, worldY);

          if (tile.isRoad) {
            waterCellsWithRoad++;
            pRoadCount++;
          }

          if (worldX < minX) minX = worldX;
          if (worldX > maxX) maxX = worldX;
          if (worldY < minY) minY = worldY;
          if (worldY > maxY) maxY = worldY;

          // Check 4 cardinal neighbors
          const neighbors = [
            wm.getTile(worldX, worldY - 1),
            wm.getTile(worldX, worldY + 1),
            wm.getTile(worldX - 1, worldY),
            wm.getTile(worldX + 1, worldY),
          ];

          for (const n of neighbors) {
            if (n && n.isRoad) {
              waterCellsTouchingRoad++;
              pAdjacentRoadCount++;
              break;
            }
          }
        }

        pondDetails.push({
          index: pIdx,
          cellCount: pond.cells.length,
          bounds: { minX, maxX, minY, maxY },
          center: { x: Math.round((minX + maxX) / 2), y: Math.round((minY + maxY) / 2) },
          roadInsideCount: pRoadCount,
          adjacentRoadCount: pAdjacentRoadCount,
        });
      }

      // Also check ducks spawned in water bodies
      const ducks = engine.animals ? engine.animals.filter((a) => a.type === 'duck') : [];

      return {
        villageName: v.name,
        villageOrigin: { x: v.gridX, y: v.gridY },
        waterBodiesCount: waterBodies.length,
        totalWaterCells,
        waterCellsWithRoad,
        waterCellsTouchingRoad,
        pondDetails,
        totalDucks: ducks.length,
        validation: v.data.validation,
      };
    });

    console.log('Settlement Water Analysis:', waterAnalysis);

    if (waterAnalysis.error) {
      failures.push(`Water analysis failed: ${waterAnalysis.error}`);
    } else {
      if (waterAnalysis.waterBodiesCount === 0) {
        failures.push('Expected at least 1 scenic inland water body in the village');
      }
      if (waterAnalysis.waterCellsWithRoad > 0) {
        failures.push(`FAILURE: Found ${waterAnalysis.waterCellsWithRoad} water cells cut by roads!`);
      }
      if (waterAnalysis.waterCellsTouchingRoad > 0) {
        failures.push(`FAILURE: Found ${waterAnalysis.waterCellsTouchingRoad} water cells touching roads!`);
      }
      if (waterAnalysis.validation && waterAnalysis.validation.violations.length > 0) {
        failures.push(`Village validation reported violations: ${waterAnalysis.validation.violations.join(', ')}`);
      }
    }

    // ────────────────────────────────────────────────────────────────
    // TEST 2: Teleport Player to Pond Shore and Capture Visual Proof
    // ────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 2: Teleporting Player to Inland Water Body Shoreline ---');
    if (waterAnalysis.pondDetails && waterAnalysis.pondDetails.length > 0) {
      const primaryPond = waterAnalysis.pondDetails[0];
      // Position player just 2 tiles south of the pond edge
      const targetX = primaryPond.center.x;
      const targetY = primaryPond.bounds.maxY + 2;

      await page.evaluate((tx, ty) => {
        const engine = window.survivalEngine;
        engine.player.x = tx;
        engine.player.y = ty;
        engine.player.vx = 0;
        engine.player.vy = 0;
        engine.worldManager.updatePlayerLocation(tx, ty);
        engine.worldTime.timeOfDay = 'Day';
        engine.worldTime.hour = 12;
        engine.worldTime.minute = 15;
        engine.worldTime.lightLevel = 1.0;
      }, targetX, targetY);

      await wait(800);

      // Verify minimap state at this location
      const minimapData = await page.evaluate(() => {
        const radarCanvas = document.getElementById('radar-canvas');
        if (!radarCanvas) return { hasCanvas: false };

        const ctx = radarCanvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, radarCanvas.width, radarCanvas.height);
        const data = imgData.data;

        let cyanWater = 0;
        let foamWater = 0;
        let orangeRoad = 0;
        let sandBeaches = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          // Cyan water: #0ea5e9 (14, 165, 233) or #0284c7 (2, 132, 199)
          if (b > 180 && g > 120 && r < 40) cyanWater++;
          // Foam water: #bae6fd (186, 230, 253)
          if (r > 170 && g > 210 && b > 240) foamWater++;
          // Road: #d97706 (217, 119, 6)
          if (r > 190 && g > 100 && g < 150 && b < 30) orangeRoad++;
          // Sand: #fde047 (253, 224, 71)
          if (r > 230 && g > 200 && b < 100) sandBeaches++;
        }

        return {
          hasCanvas: true,
          width: radarCanvas.width,
          height: radarCanvas.height,
          cyanWater,
          foamWater,
          orangeRoad,
          sandBeaches,
        };
      });

      console.log('Minimap analysis near pond:', minimapData);

      await page.screenshot({ path: `${OUTPUT_DIR}/15_inland_water_body_uncut.png` });
      console.log('📸 Saved 15_inland_water_body_uncut.png');
    }

    // ────────────────────────────────────────────────────────────────
    // TEST 3: Multi-Village Inspection in the Active World
    // ────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 3: Inspecting All Settlement Inland Water Bodies in the World ---');
    const allVillagesWaterCheck = await page.evaluate(() => {
      const engine = window.survivalEngine;
      const wm = engine.worldManager;
      const report = [];

      for (const v of wm.villages) {
        if (!v.data || !v.data.waterBodies) continue;
        let cuts = 0;
        let totalWater = 0;
        for (const wb of v.data.waterBodies) {
          for (const c of wb.cells) {
            totalWater++;
            const t = wm.getTile(v.gridX + c.x, v.gridY + c.y);
            if (t.isRoad) cuts++;
          }
        }
        report.push({
          name: v.name,
          waterBodies: v.data.waterBodies.length,
          totalWater,
          roadCuts: cuts,
        });
      }
      return report;
    });

    console.log('All Villages Inland Water Bodies Report:', allVillagesWaterCheck);
    for (const vReport of allVillagesWaterCheck) {
      if (vReport.roadCuts > 0) {
        failures.push(`Village ${vReport.name} has ${vReport.roadCuts} water cells cut by roads!`);
      }
    }

  } catch (err) {
    failures.push(`Script execution error: ${err.message}`);
    console.error('Fatal error during verification:', err);
  } finally {
    await browser.close();
  }

  console.log('\n=========================================');
  console.log(`Verification Complete. Failures: ${failures.length}`);
  if (failures.length > 0) {
    console.log('❌ FAILURES ENCOUNTERED:');
    failures.forEach((f) => console.log(`   - ${f}`));
    process.exit(1);
  } else {
    console.log('🎉 INLAND WATER BODIES VERIFIED TO NEVER BE CUT BY ROADS!');
    console.log('=========================================\n');
  }
}

run();
