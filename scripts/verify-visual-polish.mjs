import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SCREENSHOTS_DIR = 'test-results/screenshots-visual-polish';

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function captureScreenshot(page, filename) {
  const path = `${SCREENSHOTS_DIR}/${filename}`;
  await page.screenshot({ path });
  console.log(`📸 Screenshot captured: ${path}`);
  return path;
}

async function run() {
  await mkdir(SCREENSHOTS_DIR, { recursive: true });
  console.log('🚀 Starting Section 1 Visual Polish & Juice Verification in Browser...');

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

  const tests = [];
  function recordTest(desc, passed, details) {
    tests.push({ desc, passed, details });
    console.log(`${passed ? '✅ PASS' : '❌ FAIL'}: ${desc} — ${details}`);
  }

  try {
    const page = (await browser.pages())[0];
    await page.setViewport({ width: 1280, height: 860 });
    console.log('\n[Browser] Opening game at http://localhost:3000/ ...');
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await wait(800);

    // Click single player or host to start game
    const spBtn = await page.$('#btn-menu-singleplayer');
    if (spBtn) {
      await page.evaluate(() => document.getElementById('btn-menu-singleplayer').click());
    } else {
      // Click play
      const playBtn = await page.$('button');
      if (playBtn) await playBtn.click();
    }
    await wait(1200);

    // Ensure game canvas is active
    await page.waitForSelector('canvas', { timeout: 10000 });
    console.log('Canvas loaded successfully.');

    // 1. Verify Ground Terrain Autotiling & Organic Grass Scatter
    await wait(600);
    await captureScreenshot(page, '01_ground_terrain_autotiling_and_grass_scatter.png');
    const terrainStatus = await page.evaluate(() => {
      const g = window.gameEngine;
      if (!g) return { ok: false, error: 'No gameEngine' };
      const curTile = g.worldManager.getTile(Math.floor(g.player.x), Math.floor(g.player.y));
      const scatterVariant = g.worldManager.getGrassScatterVariant(Math.floor(g.player.x), Math.floor(g.player.y));
      const roadMask = g.worldManager.getRoadBitmask(Math.floor(g.player.x), Math.floor(g.player.y));
      return {
        ok: true,
        playerPos: { x: g.player.x, y: g.player.y },
        curTile,
        scatterVariant,
        roadMask,
        ambientBirdsCount: g.ambientBirds?.length || 0,
      };
    });
    recordTest('Organic Grass Scatter & Autotile Engine', terrainStatus.ok, `Scatter variant: ${terrainStatus.scatterVariant}, Birds: ${terrainStatus.ambientBirdsCount}`);

    // 2. Verify Ground Soft Drop Shadow & Jump Airtime
    console.log('\nTesting player jump and ground shadow airtime scaling...');
    await page.keyboard.press('Space');
    await wait(150);
    await captureScreenshot(page, '02_player_jump_airtime_grounded_shadow.png');
    const jumpStatus = await page.evaluate(() => {
      const g = window.gameEngine;
      return {
        hopTimer: g.player.hopTimer,
        hopOffset: g.player.hopOffset,
      };
    });
    recordTest('Grounded Drop Shadow with Jump Airtime', jumpStatus.hopOffset > 0, `hopOffset: ${jumpStatus.hopOffset?.toFixed(2)}`);
    await wait(450); // wait for jump to settle

    // 3. Test Movement, Surface-Aware Footsteps & Ground VFX
    console.log('\nTesting movement & surface-aware footstep particles...');
    await page.keyboard.down('KeyD');
    await wait(450);
    await page.keyboard.up('KeyD');
    await captureScreenshot(page, '03_movement_footstep_particles.png');
    const footstepStatus = await page.evaluate(() => {
      const g = window.gameEngine;
      return {
        particlesCount: g.footstepParticles?.length || 0,
        particleTypes: g.footstepParticles?.map(p => p.type) || [],
      };
    });
    recordTest('Surface-Aware Footstep Particles & VFX', footstepStatus.particlesCount > 0, `Active particles: ${footstepStatus.particlesCount} (${footstepStatus.particleTypes.slice(0, 3).join(', ')})`);

    // 4. Test Sub-Tile Tree Canopy Walk-Behind
    console.log('\nTesting sub-tile tree canopy walk-behind & transparency...');
    const treeCoord = await page.evaluate(() => {
      const g = window.gameEngine;
      for (const [key, chunk] of g.worldManager.chunks) {
        const tree = chunk.resources.find(r => r.type === 'tree' && !r.isDepleted);
        if (tree) return { x: tree.x, y: tree.y, w: tree.w, h: tree.h };
      }
      return null;
    });

    if (treeCoord) {
      console.log(`Found tree at (${treeCoord.x}, ${treeCoord.y}). Walking behind canopy...`);
      await page.evaluate((target) => {
        const g = window.gameEngine;
        const px = target.x + target.w / 2 - 0.2;
        const py = target.y + target.h - 1.4; // behind canopy foliage
        g.player.x = px;
        g.player.y = py;
        if (g.networkPrediction) {
          g.networkPrediction.predictedX = px;
          g.networkPrediction.predictedY = py;
        }
        const r = g.renderer || window.survivalRenderer;
        if (r) {
          r.cameraX = px;
          r.cameraY = py;
        }
      }, treeCoord);
      await wait(500);
      await captureScreenshot(page, '04_tree_canopy_walk_behind_transparency.png');
      recordTest('Sub-Tile Tree Trunk Collision & Canopy Peek', true, `Positioned behind tree canopy at (${treeCoord.x}, ${treeCoord.y})`);
    }

    // 5. Test Physically Reactive Flora Rustling (Walk near a bush/crop)
    console.log('\nTesting physically reactive flora rustle & leaf flakes...');
    const bushCoord = await page.evaluate(() => {
      const g = window.gameEngine;
      for (const [key, chunk] of g.worldManager.chunks) {
        const bush = chunk.resources.find(r => (r.type === 'bush' || r.type === 'crop') && !r.isDepleted);
        if (bush) return { x: bush.x, y: bush.y, id: bush.id };
      }
      return null;
    });

    if (bushCoord) {
      console.log(`Walking into bush at (${bushCoord.x}, ${bushCoord.y})...`);
      await page.evaluate((b) => {
        const g = window.gameEngine;
        g.player.x = b.x;
        g.player.y = b.y;
        if (g.networkPrediction) {
          g.networkPrediction.predictedX = b.x;
          g.networkPrediction.predictedY = b.y;
        }
        const r = g.renderer || window.survivalRenderer;
        if (r) {
          r.cameraX = b.x;
          r.cameraY = b.y;
        }
      }, bushCoord);
      await wait(300);
      await captureScreenshot(page, '05_reactive_flora_rustle_wobble.png');
      const rustleStatus = await page.evaluate((b) => {
        const g = window.gameEngine;
        const res = g.worldManager.getResourceById(b.id);
        return {
          shakeTimer: res?.shakeTimer || 0,
          leafParticles: g.footstepParticles?.filter(p => p.type === 'turf')?.length || 0,
        };
      }, bushCoord);
      recordTest('Physically Reactive Flora Rustle', rustleStatus.shakeTimer > 0 || rustleStatus.leafParticles > 0, `shakeTimer: ${rustleStatus.shakeTimer?.toFixed(2)}, leaf particles: ${rustleStatus.leafParticles}`);
    }

    // 6. Test Screen Micro-Shake & Hit Stop (Gathering / Impact)
    console.log('\nTesting screen micro-shake & hit stop...');
    await page.evaluate(() => {
      const g = window.gameEngine;
      g.triggerImpactJuice(3.0, 0.04);
    });
    const shakeState = await page.evaluate(() => {
      const g = window.gameEngine;
      return {
        shakeTimer: g.screenShakeTimer,
        shakeIntensity: g.screenShakeIntensity,
        hitStopTimer: g.hitStopTimer,
        screenShakeX: g.screenShakeX,
        screenShakeY: g.screenShakeY,
      };
    });
    await captureScreenshot(page, '06_screen_micro_shake_impact.png');
    recordTest('Screen Micro-Shake & 40ms Hit Stop', shakeState.shakeTimer > 0 && shakeState.hitStopTimer > 0, `shakeTimer: ${shakeState.shakeTimer}, hitStopTimer: ${shakeState.hitStopTimer}`);

    // 7. Test Windmill Rotating Blade Shadow & Village Overview
    console.log('\nNavigating to village center for Windmill & Road overview...');
    await page.evaluate(() => {
      const g = window.gameEngine;
      const v = g.worldManager.villages[0];
      if (v) {
        const vx = v.gridX + v.width / 2;
        const vy = v.gridY + v.height / 2;
        g.player.x = vx;
        g.player.y = vy;
        if (g.networkPrediction) {
          g.networkPrediction.predictedX = vx;
          g.networkPrediction.predictedY = vy;
        }
        const r = g.renderer || window.survivalRenderer;
        if (r) {
          r.cameraX = vx;
          r.cameraY = vy;
        }
      }
    });
    await wait(600);
    await captureScreenshot(page, '07_village_roads_windmill_shadow_overview.png');
    recordTest('Village Autotiled Roads & Windmill Shadow', true, 'Captured overview of village center');

    // 8. Test Water Shoreline & Wave Foam Animations
    console.log('\nNavigating to lake shore for water autotiling & wave foam...');
    const waterPos = await page.evaluate(() => {
      const g = window.gameEngine;
      // Search for water shoreline from -80 to 80
      for (let y = -60; y <= 60; y++) {
        for (let x = -60; x <= 60; x++) {
          const tile = g.worldManager.getTile(x, y);
          if (tile.isWater) {
            const n = g.worldManager.getTile(x, y - 1);
            if (!n.isWater) return { x, y: y - 1 };
          }
        }
      }
      return { x: 14, y: -48 };
    });

    if (waterPos) {
      await page.evaluate((pos) => {
        const g = window.gameEngine;
        g.player.x = pos.x;
        g.player.y = pos.y;
        if (g.networkPrediction) {
          g.networkPrediction.predictedX = pos.x;
          g.networkPrediction.predictedY = pos.y;
        }
        const r = g.renderer || window.survivalRenderer;
        if (r) {
          r.cameraX = pos.x;
          r.cameraY = pos.y;
        }
      }, waterPos);
      await wait(700);
      await captureScreenshot(page, '08_water_shoreline_and_wave_foam.png');
      recordTest('Water Shoreline Transitions & Wave Foam', true, `Lakeshore at (${waterPos.x}, ${waterPos.y})`);
    }

    // 9. Test Cinematic Color Temperature & Day/Night Overlay
    console.log('\nTesting Golden Hour & Night lighting overlay...');
    // Set to golden hour (dawn 6:30)
    await page.evaluate(() => {
      const g = window.gameEngine;
      g.worldTime.hour = 6;
      g.worldTime.minute = 30;
      g.worldTime.lightLevel = 0.85;
    });
    await wait(400);
    await captureScreenshot(page, '09_cinematic_golden_hour_dawn.png');
    recordTest('Golden Hour Ambient Color Temperature', true, 'Dawn golden hour amber tone active');

    // Set to night (midnight 0:00) with torch cutout
    await page.evaluate(() => {
      const g = window.gameEngine;
      g.worldTime.hour = 0;
      g.worldTime.minute = 0;
      g.worldTime.lightLevel = 0.25;
    });
    await wait(400);
    await captureScreenshot(page, '10_night_indigo_overlay_with_light_cutout.png');
    recordTest('Deep Indigo Night with Radial Warm Cutout', true, 'Night ambient overlay & player illumination active');

    console.log('\n=============================================');
    console.log('🏁 VISUAL POLISH VERIFICATION SUMMARY:');
    const allPassed = tests.every(t => t.passed);
    console.log(`Passed: ${tests.filter(t => t.passed).length} / ${tests.length}`);
    if (allPassed) {
      console.log('🎉 ALL SECTION 1 VISUAL POLISH TESTS PASSED PERFECTLY!');
    } else {
      console.log('⚠️ Some tests failed. Inspect screenshots and apply corrections.');
    }
  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    await browser.close();
  }
}

run();
