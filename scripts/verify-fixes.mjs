import puppeteer from 'puppeteer-core';
import { mkdir, copyFile } from 'node:fs/promises';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ARTIFACT_DIR = '/Users/shanukeshri983/.gemini/antigravity/brain/658e5042-76bd-4cc8-86b1-94a7b3569fab';

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('🚀 Running Comprehensive Fix Verification in Browser...');

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

    const spBtn = await page.$('#btn-menu-singleplayer');
    if (spBtn) {
      await page.evaluate(() => document.getElementById('btn-menu-singleplayer').click());
    }
    await wait(1500);

    await page.waitForSelector('canvas', { timeout: 10000 });
    console.log('Canvas active.');

    // Helper inside browser context to snap player, camera, and prediction
    const snapTo = async (wx, wy) => {
      await page.evaluate((targetX, targetY) => {
        const g = window.gameEngine;
        g.player.x = targetX;
        g.player.y = targetY;
        if (g.networkPrediction) {
          g.networkPrediction.predictedX = targetX;
          g.networkPrediction.predictedY = targetY;
        }
        g.renderer.snapCameraTo(targetX, targetY);
        g.worldManager.updatePlayerLocation(targetX, targetY);
      }, wx, wy);
      await wait(600);
    };

    // 1. Verify Village NPCs (No water droplet icons above head, clean nametags, no redundant shadows)
    await page.evaluate(() => {
      const g = window.gameEngine;
      const v = g.worldManager.villages[0];
      const npc = g.npcs.find(n => n.inVillageId === v.id) || g.npcs[0];
      if (npc) {
        g.player.x = npc.position.x - 2;
        g.player.y = npc.position.y;
        if (g.networkPrediction) {
          g.networkPrediction.predictedX = g.player.x;
          g.networkPrediction.predictedY = g.player.y;
        }
        g.renderer.snapCameraTo(g.player.x, g.player.y);
        g.worldManager.updatePlayerLocation(g.player.x, g.player.y);
      }
    });
    await wait(600);
    const p1 = `${ARTIFACT_DIR}/fix_01_villagers_no_water_icon_clean_nametags.png`;
    await page.screenshot({ path: p1 });
    console.log(`📸 Captured: ${p1}`);

    // 2. Verify Bush Shaking Once (Player steps into bush, check that shake triggers once and stops)
    const bushCheck = await page.evaluate(async () => {
      const g = window.gameEngine;
      let targetBush = null;
      for (const [key, chunk] of g.worldManager.chunks.entries()) {
        const b = chunk.resources.find(r => r.type === 'bush' && !r.isDepleted);
        if (b) { targetBush = b; break; }
      }
      if (!targetBush) return { found: false };

      // Move player into bush
      g.player.x = targetBush.x;
      g.player.y = targetBush.y;
      g.renderer.snapCameraTo(g.player.x, g.player.y);
      g.worldManager.updatePlayerLocation(g.player.x, g.player.y);

      // Simulate a few physics ticks
      g.updateFloraReactions(0.1);
      const shakeInitial = targetBush.shakeTimer;
      const isBrushedInitial = targetBush.isBrushed;

      // Let shake expire
      targetBush.shakeTimer = 0;
      // Step again while still standing inside
      g.updateFloraReactions(0.1);
      const shakeAfterStillInside = targetBush.shakeTimer;

      return {
        found: true,
        shakeInitial,
        isBrushedInitial,
        shakeAfterStillInside,
      };
    });
    console.log('Bush brush reaction test:', bushCheck);

    const p2 = `${ARTIFACT_DIR}/fix_02_bush_shake_once_and_no_drop_shadows.png`;
    await page.screenshot({ path: p2 });
    console.log(`📸 Captured: ${p2}`);

    // 3. Verify Tree Collision Footprint & Walk-Behind Canopy
    const treeCollisionTest = await page.evaluate(() => {
      const g = window.gameEngine;
      let tree = null;
      for (const [key, chunk] of g.worldManager.chunks.entries()) {
        const t = chunk.resources.find(r => r.type === 'tree' && !r.isDepleted);
        if (t) { tree = t; break; }
      }
      if (!tree) return { found: false };

      const cx = tree.x + 1.0;
      const cy = tree.y + 1.65;

      // Player center foot at trunk base should be BLOCKED
      const canWalkIntoTrunk = g.canMoveTo(cx - 0.5, cy - 0.65);

      // Player behind canopy should be WALKABLE
      const canWalkBehindCanopy = g.canMoveTo(cx - 0.5, tree.y + 0.3 - 0.65);

      // Snap player behind tree to show canopy transparency
      g.player.x = cx - 0.5;
      g.player.y = tree.y + 0.3 - 0.65;
      g.renderer.snapCameraTo(g.player.x, g.player.y);
      g.worldManager.updatePlayerLocation(g.player.x, g.player.y);

      return {
        found: true,
        treePos: { x: tree.x, y: tree.y },
        canWalkIntoTrunk,
        canWalkBehindCanopy,
      };
    });
    console.log('Tree collision & canopy walk-behind test:', treeCollisionTest);

    await wait(600);
    const p3 = `${ARTIFACT_DIR}/fix_03_tree_subtile_collision_and_canopy_transparency.png`;
    await page.screenshot({ path: p3 });
    console.log(`📸 Captured: ${p3}`);

    // 4. Verify Big Lake Shoreline Autotiling & Correct Corner Alignment
    await page.evaluate(() => {
      const g = window.gameEngine;
      let wx = 0, wy = 0;
      for (let y = -150; y < 150; y += 3) {
        for (let x = -150; x < 150; x += 3) {
          const t = g.worldManager.getTile(x, y);
          if (t.isWater && !g.worldManager.villages.some(v => x >= v.gridX && x <= v.gridX + v.width && y >= v.gridY && y <= v.gridY + v.height)) {
            wx = x; wy = y; break;
          }
        }
        if (wx !== 0) break;
      }
      if (wx !== 0) {
        g.player.x = wx;
        g.player.y = wy;
        if (g.networkPrediction) {
          g.networkPrediction.predictedX = wx;
          g.networkPrediction.predictedY = wy;
        }
        g.renderer.snapCameraTo(wx, wy);
        g.worldManager.updatePlayerLocation(wx, wy);
      }
    });
    await wait(600);
    const p4 = `${ARTIFACT_DIR}/fix_04_expansive_lake_aligned_corners_no_player_shadow.png`;
    await page.screenshot({ path: p4 });
    console.log(`📸 Captured: ${p4}`);

    // 5. Verify Animals & Ducks (No redundant drop shadows)
    await page.evaluate(() => {
      const g = window.gameEngine;
      const duck = g.animals.find(a => a.species === 'duck') || g.animals[0];
      if (duck) {
        g.player.x = duck.position.x - 2;
        g.player.y = duck.position.y;
        g.renderer.snapCameraTo(g.player.x, g.player.y);
        g.worldManager.updatePlayerLocation(g.player.x, g.player.y);
      }
    });
    await wait(600);
    const p5 = `${ARTIFACT_DIR}/fix_05_ducks_and_animals_clean_no_redundant_shadows.png`;
    await page.screenshot({ path: p5 });
    console.log(`📸 Captured: ${p5}`);

    console.log('✅ All 5 fix verification screenshots captured successfully!');
  } catch (err) {
    console.error('Error during fix verification:', err);
  } finally {
    await browser.close();
  }
}

run();
