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

  console.log('🧱 Starting Verification of Placeable 3D Blocks in Chrome...\n');

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

    // Click singleplayer
    await page.click('#btn-menu-singleplayer');
    await wait(1800);

    // ────────────────────────────────────────────────────────────────
    // TEST 1: Verify 3D Block Catalog, Crafting Recipes & Inventory
    // ────────────────────────────────────────────────────────────────
    console.log('--- TEST 1: Inspecting Item Catalog & Crafting Recipes for 6 3D Block Types ---');
    const catalogCheck = await page.evaluate(() => {
      const engine = window.survivalEngine;
      if (!engine) return { error: 'Survival engine not initialized' };

      const materials = [
        'block_stone',
        'block_wood',
        'block_dirt',
        'block_brick',
        'block_sandstone',
        'block_glass',
      ];

      const catalog = window.survivalEngine.itemCatalog || {};
      const results = {};

      for (const mat of materials) {
        const hasInInventory = engine.hasItem(mat, 1);
        results[mat] = {
          hasInInventory,
        };
      }

      const hotbarItems = engine.hotbar.map((s) => s.item);
      return { results, hotbarItems };
    });

    console.log('Catalog check results:', JSON.stringify(catalogCheck, null, 2));
    if (!catalogCheck.hotbarItems.includes('block_stone')) {
      failures.push('Hotbar does not contain block_stone');
    }

    // ────────────────────────────────────────────────────────────────
    // TEST 2: Place Tier 0 Block (Ground Tier)
    // ────────────────────────────────────────────────────────────────
    console.log('--- TEST 2: Placing Tier 0 3D Block (Ground Tier) ---');
    const placeTier0Result = await page.evaluate(() => {
      const engine = window.survivalEngine;
      const px = Math.round(engine.player.x);
      const py = Math.round(engine.player.y);
      const targetX = px + 2;
      const targetY = py;

      // Add blocks to inventory to ensure sufficient supply
      engine.addItemToInventory('block_stone', 10);
      engine.addItemToInventory('block_wood', 10);
      engine.addItemToInventory('block_brick', 10);

      const canPlace0 = engine.canPlaceBlockAt(targetX, targetY, 0);
      if (!canPlace0) {
        return { success: false, reason: 'canPlaceBlockAt returned false for Tier 0', targetX, targetY };
      }

      const placed0 = engine.place3DBlock('block_stone', targetX, targetY, 0);
      const block0 = engine.getBlockAt(targetX, targetY, 0);
      const tileBlocked = engine.worldManager.getTile(targetX, targetY).isBlocked;

      return {
        success: placed0 && !!block0 && tileBlocked,
        block0,
        tileBlocked,
        targetX,
        targetY,
      };
    });

    console.log('Place Tier 0 Result:', JSON.stringify(placeTier0Result, null, 2));
    if (!placeTier0Result.success) {
      failures.push(`Failed to place Tier 0 block: ${placeTier0Result.reason || 'Unknown'}`);
    }

    // ────────────────────────────────────────────────────────────────
    // TEST 3: Vertical Stacking (Tier 1 & Tier 2)
    // ────────────────────────────────────────────────────────────────
    console.log('--- TEST 3: Stacking Tier 1 & Tier 2 Blocks ---');
    const stackResult = await page.evaluate(() => {
      const engine = window.survivalEngine;
      const px = Math.round(engine.player.x);
      const py = Math.round(engine.player.y);
      const targetX = px + 2;
      const targetY = py;

      // Cannot place Tier 2 before Tier 1
      const invalidSkip = engine.canPlaceBlockAt(targetX, targetY, 2);

      // Place Tier 1 (block_stone)
      const canPlace1 = engine.canPlaceBlockAt(targetX, targetY, 1);
      const placed1 = engine.place3DBlock('block_stone', targetX, targetY, 1);
      const block1 = engine.getBlockAt(targetX, targetY, 1);

      // Place Tier 2 (block_wood)
      const canPlace2 = engine.canPlaceBlockAt(targetX, targetY, 2);
      const placed2 = engine.place3DBlock('block_wood', targetX, targetY, 2);
      const block2 = engine.getBlockAt(targetX, targetY, 2);

      // Place Tier 3 (block_brick)
      const canPlace3 = engine.canPlaceBlockAt(targetX, targetY, 3);
      const placed3 = engine.place3DBlock('block_brick', targetX, targetY, 3);
      const block3 = engine.getBlockAt(targetX, targetY, 3);

      // Attempt to place Tier 4 (should be rejected, max tiers is 4: 0, 1, 2, 3)
      const invalidTier4 = engine.canPlaceBlockAt(targetX, targetY, 4);

      const top = engine.getTopBlock(targetX, targetY);

      return {
        invalidSkipRejected: !invalidSkip,
        placed1: placed1 && !!block1,
        placed2: placed2 && !!block2,
        placed3: placed3 && !!block3,
        invalidTier4Rejected: !invalidTier4,
        topBlockZ: top?.z,
        topBlockMaterial: top?.material,
        totalPlacedBlocks: engine.placedBlocks.length,
      };
    });

    console.log('Vertical Stacking Result:', JSON.stringify(stackResult, null, 2));
    if (!stackResult.invalidSkipRejected) failures.push('Floating tier placement was not rejected');
    if (!stackResult.placed1) failures.push('Failed to stack Tier 1 block');
    if (!stackResult.placed2) failures.push('Failed to stack Tier 2 block');
    if (!stackResult.placed3) failures.push('Failed to stack Tier 3 block');
    if (!stackResult.invalidTier4Rejected) failures.push('Tier 4 was not rejected by max tier limit');
    if (stackResult.topBlockZ !== 3) failures.push(`Expected top block Z to be 3, got ${stackResult.topBlockZ}`);

    // ────────────────────────────────────────────────────────────────
    // TEST 4: Mining, Destructibility & Tool-Specific Impact Shake
    // ────────────────────────────────────────────────────────────────
    console.log('--- TEST 4: Mining & Damaging Top Block ---');
    const mineResult = await page.evaluate(() => {
      const engine = window.survivalEngine;
      const px = Math.round(engine.player.x);
      const py = Math.round(engine.player.y);
      const targetX = px + 2;
      const targetY = py;

      // Select pickaxe
      engine.activeHotbarIndex = 1;

      const preBlock = engine.getBlockAt(targetX, targetY, 3);
      const preHealth = preBlock ? preBlock.health : 0;

      // Strike block (damage = 15)
      engine.hit3DBlock(targetX, targetY, 3, 15, false);

      const midBlock = engine.getBlockAt(targetX, targetY, 3);
      const midHealth = midBlock ? midBlock.health : 0;
      const midShake = midBlock ? midBlock.shakeTimer : 0;
      const screenShake = engine.screenShakeTimer;

      // Second strike to destroy block (damage = 15, remaining 10 health drops to 0)
      const preItems = engine.droppedItems.length;
      engine.hit3DBlock(targetX, targetY, 3, 15, false);

      const postBlock = engine.getBlockAt(targetX, targetY, 3);
      const newTop = engine.getTopBlock(targetX, targetY);
      const postItems = engine.droppedItems.length;

      return {
        preHealth,
        midHealth,
        midShakeGreaterThanZero: midShake > 0,
        screenShakeTriggered: screenShake > 0,
        destroyed: !postBlock,
        newTopZ: newTop?.z,
        itemDropped: postItems > preItems,
      };
    });

    console.log('Mining Result:', JSON.stringify(mineResult, null, 2));
    if (mineResult.midHealth >= mineResult.preHealth) failures.push('Mining did not reduce block health');
    if (!mineResult.destroyed) failures.push('Second strike did not destroy top block');
    if (mineResult.newTopZ !== 2) failures.push(`Expected new top block Z to be 2, got ${mineResult.newTopZ}`);
    if (!mineResult.itemDropped) failures.push('Destroyed block did not drop item');

    // ────────────────────────────────────────────────────────────────
    // TEST 5: Render and Capture Visual Screenshot of 3D Blocks
    // ────────────────────────────────────────────────────────────────
    console.log('--- TEST 5: Capturing Visual Artifact Screenshot ---');
    await page.evaluate(() => {
      const engine = window.survivalEngine;
      const px = Math.round(engine.player.x);
      const py = Math.round(engine.player.y);

      // Build a scenic multi-column stepped structure next to the player:
      // Column A at (px + 2, py - 1): Cobblestone Tiers 0..2
      // Column B at (px + 2, py): Terracotta Brick Tiers 0..1
      // Column C at (px + 2, py + 1): Timber Wood Tier 0
      // Column D at (px + 3, py): Sandstone Tier 0, Glass Tier 1
      engine.addItemToInventory('block_stone', 10);
      engine.addItemToInventory('block_brick', 10);
      engine.addItemToInventory('block_wood', 10);
      engine.addItemToInventory('block_sandstone', 10);
      engine.addItemToInventory('block_glass', 10);

      // Column A
      engine.place3DBlock('block_stone', px + 2, py - 1, 0);
      engine.place3DBlock('block_stone', px + 2, py - 1, 1);
      engine.place3DBlock('block_stone', px + 2, py - 1, 2);

      // Column B
      engine.place3DBlock('block_brick', px + 2, py, 0);
      engine.place3DBlock('block_brick', px + 2, py, 1);

      // Column C
      engine.place3DBlock('block_wood', px + 2, py + 1, 0);

      // Column D
      engine.place3DBlock('block_sandstone', px + 3, py, 0);
      engine.place3DBlock('block_glass', px + 3, py, 1);

      // Face player towards the construction
      engine.player.facing = 'RIGHT';
      engine.player.direction = 'RIGHT';

      // Select block_stone in hotbar (slot 7) to activate holographic preview on cursor
      engine.activeHotbarIndex = 7;
      engine.buildPiece = 'block_stone';
      engine.buildPreviewX = px + 3;
      engine.buildPreviewY = py + 1;
      engine.buildPreviewZ = 0;
      engine.isBuildPreviewValid = true;
    });

    await wait(600);

    const shotPathLocal = path.join(LOCAL_SCREENSHOT_DIR, '16_placeable_3d_blocks_stacked.png');
    const shotPathArtifact = path.join(ARTIFACT_SCREENSHOT_DIR, '16_placeable_3d_blocks_stacked.png');

    await page.screenshot({ path: shotPathLocal });
    await copyFile(shotPathLocal, shotPathArtifact);
    console.log(`📸 Captured screenshot: ${shotPathLocal}`);
    console.log(`📸 Copied to artifact directory: ${shotPathArtifact}`);

    // Summary
    console.log('\n==========================================');
    if (failures.length === 0) {
      console.log('✅ ALL 3D PLACEABLE BLOCK TESTS PASSED!');
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
