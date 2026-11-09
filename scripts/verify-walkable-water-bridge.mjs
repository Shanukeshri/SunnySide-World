import puppeteer from 'puppeteer-core';
import { mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const LOCAL_SCREENSHOT_DIR = 'test-results/browser-verification';
const ARTIFACT_SCREENSHOT_DIR = '/Users/shanukeshri983/.gemini/antigravity/brain/1e0e9b94-4c34-42a1-99ac-6ef4a8ca1d19/screenshots';

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  await mkdir(LOCAL_SCREENSHOT_DIR, { recursive: true });
  await mkdir(ARTIFACT_SCREENSHOT_DIR, { recursive: true });

  console.log('🌉 Starting Verification of Walkable Water Bridges in Chrome...\n');

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

    console.log('--- Step 1: Navigating to Game ---');
    await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 15000 });
    await wait(1200);

    // Click single player to start survival mode
    await page.click('#btn-menu-singleplayer');
    await wait(1800);

    // ────────────────────────────────────────────────────────────────
    // TEST 1: Find Water and Place Wooden Bridges
    // ────────────────────────────────────────────────────────────────
    console.log('--- TEST 1: Locating Water Body and Placing Wooden Bridges ---');
    const bridgeSetupResult = await page.evaluate(() => {
      const engine = window.survivalEngine;
      if (!engine || !engine.worldManager) return { error: 'Engine not ready' };

      const wm = engine.worldManager;
      const px = Math.round(engine.player.x);
      const py = Math.round(engine.player.y);

      // Search for water tile within 20 tiles
      let waterTile = null;
      for (let r = 1; r < 25; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const tx = px + dx;
            const ty = py + dy;
            const t = wm.getTile(tx, ty);
            if (t.isWater && !t.isBridge) {
              waterTile = { x: tx, y: ty };
              break;
            }
          }
          if (waterTile) break;
        }
        if (waterTile) break;
      }

      if (!waterTile) {
        return { error: 'No water tile found near player' };
      }

      // Add wood_bridge items to inventory
      engine.addItemToInventory('wood_bridge', 10);

      // Test placement on water
      const place1 = engine.placeStructure('wood_bridge', waterTile.x, waterTile.y);
      const tile1 = wm.getTile(waterTile.x, waterTile.y);

      // Also find or create an adjacent water tile for a 2-segment bridge
      let adjacentWater = null;
      const dirs = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
      for (const d of dirs) {
        const nx = waterTile.x + d.dx;
        const ny = waterTile.y + d.dy;
        const nt = wm.getTile(nx, ny);
        if (nt.isWater && !nt.isBridge) {
          adjacentWater = { x: nx, y: ny };
          break;
        }
      }

      let place2 = false;
      let tile2 = null;
      if (adjacentWater) {
        place2 = engine.placeStructure('wood_bridge', adjacentWater.x, adjacentWater.y);
        tile2 = wm.getTile(adjacentWater.x, adjacentWater.y);
      }

      return {
        waterTile,
        adjacentWater,
        placed1: place1,
        tile1IsBridge: tile1.isBridge,
        tile1IsWater: tile1.isWater,
        tile1IsBlocked: tile1.isBlocked,
        placed2: place2,
        tile2IsBridge: tile2?.isBridge,
      };
    });

    console.log('Bridge Setup Result:', JSON.stringify(bridgeSetupResult, null, 2));
    if (bridgeSetupResult.error) {
      failures.push(bridgeSetupResult.error);
    }
    if (!bridgeSetupResult.placed1 || !bridgeSetupResult.tile1IsBridge) {
      failures.push('Failed to place wood_bridge on water tile');
    }
    if (bridgeSetupResult.tile1IsBlocked) {
      failures.push('Water bridge tile still marked isBlocked = true');
    }

    // ────────────────────────────────────────────────────────────────
    // TEST 2: canMoveTo() Collision Verification on Water Bridge
    // ────────────────────────────────────────────────────────────────
    console.log('--- TEST 2: Verifying canMoveTo() Walkability on Bridge vs Open Water ---');
    const moveCheckResult = await page.evaluate((setup) => {
      const engine = window.survivalEngine;
      const bx = setup.waterTile.x;
      const by = setup.waterTile.y;

      // Center position of player when feet stand on (bx, by)
      // Since footX = x + 0.5 and footY = y + 0.65, standing centered on tile (bx, by) means:
      // x = bx, y = by - 0.15
      const bridgePlayerX = bx;
      const bridgePlayerY = by - 0.15;

      const canStandOnBridge = engine.canMoveTo(bridgePlayerX, bridgePlayerY);

      // Check open water without bridge (say 3 tiles into deep water)
      let openWaterPos = null;
      let canMoveToOpenWater = false;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const tx = bx + dx;
          const ty = by + dy;
          const t = engine.worldManager.getTile(tx, ty);
          if (t.isWater && !t.isBridge) {
            openWaterPos = { x: tx, y: ty - 0.15 };
            canMoveToOpenWater = engine.canMoveTo(tx, ty - 0.15);
            break;
          }
        }
        if (openWaterPos) break;
      }

      return {
        bridgePlayerPos: { x: bridgePlayerX, y: bridgePlayerY },
        canStandOnBridge,
        openWaterPos,
        canMoveToOpenWater,
      };
    }, bridgeSetupResult);

    console.log('Collision Check Result:', JSON.stringify(moveCheckResult, null, 2));
    if (!moveCheckResult.canStandOnBridge) {
      failures.push('Player cannot walk/stand on bridge over water (canMoveTo returned false)!');
    }
    if (moveCheckResult.canMoveToOpenWater) {
      failures.push('Player was allowed to walk on open water without bridge!');
    }

    // ────────────────────────────────────────────────────────────────
    // TEST 3: Moving Player Across Bridge and Capturing Visual Artifact
    // ────────────────────────────────────────────────────────────────
    console.log('--- TEST 3: Teleporting Player onto Bridge Deck & Simulating Walking ---');
    const walkingResult = await page.evaluate((setup) => {
      const engine = window.survivalEngine;
      const bx = setup.waterTile.x;
      const by = setup.waterTile.y;

      // Teleport player directly onto bridge
      engine.player.x = bx;
      engine.player.y = by - 0.15;
      engine.player.facing = 'RIGHT';
      engine.player.direction = 'RIGHT';

      // Test small step movement on bridge
      const startX = engine.player.x;
      const startY = engine.player.y;

      // Simulate moving along bridge
      engine.player.vx = 0.5;
      engine.player.vy = 0;
      engine.updatePlayerMovement(0.1);

      const movedX = engine.player.x;
      const curTile = engine.worldManager.getTile(
        Math.floor(engine.player.x + 0.5),
        Math.floor(engine.player.y + 0.65)
      );

      return {
        startX,
        startY,
        movedX,
        playerMoved: movedX !== startX,
        curTileIsWater: curTile.isWater,
        curTileIsBridge: curTile.isBridge,
        curTileTerrain: curTile.terrain,
      };
    }, bridgeSetupResult);

    console.log('Walking on Bridge Result:', JSON.stringify(walkingResult, null, 2));
    if (!walkingResult.playerMoved) {
      failures.push('Player could not move along bridge deck!');
    }

    // Allow renderer to draw player on bridge
    await wait(600);

    const shotPathLocal = path.join(LOCAL_SCREENSHOT_DIR, '18_player_walking_on_water_bridge.png');
    const shotPathArtifact = path.join(ARTIFACT_SCREENSHOT_DIR, '18_player_walking_on_water_bridge.png');

    await page.screenshot({ path: shotPathLocal });
    await copyFile(shotPathLocal, shotPathArtifact);
    console.log(`📸 Captured screenshot: ${shotPathLocal}`);
    console.log(`📸 Copied to artifact directory: ${shotPathArtifact}`);

    // Summary
    console.log('\n==========================================');
    if (failures.length === 0) {
      console.log('✅ ALL WALKABLE WATER BRIDGE TESTS PASSED!');
    } else {
      console.log('❌ FAILURES DETECTED:');
      failures.forEach((f) => console.log('  - ' + f));
      throw new Error(`Test suite failed with ${failures.length} errors.`);
    }
    console.log('==========================================\n');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

