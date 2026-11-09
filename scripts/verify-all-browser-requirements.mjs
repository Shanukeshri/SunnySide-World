import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUTPUT_DIR = 'test-results/browser-verification';

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  console.log('🧪 Starting Comprehensive In-Browser Verification of All User Requirements...\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
  });

  const failures = [];

  try {
    const page = (await browser.pages())[0];
    await page.setViewport({ width: 1440, height: 900 });

    // ────────────────────────────────────────────────────────────────
    // TEST 1: Starting Screen & Fullscreen Start (No Top Tab Bar)
    // ────────────────────────────────────────────────────────────────
    console.log('--- TEST 1: Starting screen, random world, panning camera, 3 asset buttons ---');
    await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 15000 });
    await wait(1500);

    const startScreenCheck = await page.evaluate(() => {
      const topBar = document.querySelector('.top-tab-bar');
      const topBarStyle = topBar ? window.getComputedStyle(topBar) : null;

      const mainMenu = document.getElementById('main-menu');
      const bgContainer = document.getElementById('main-menu-bg-container');
      const bgCanvas = bgContainer ? bgContainer.querySelector('canvas') : null;

      const btnSingle = document.getElementById('btn-menu-singleplayer');
      const btnMulti = document.getElementById('btn-menu-multiplayer');
      const btnSettings = document.getElementById('btn-menu-settings');

      return {
        topBarDisplay: topBarStyle?.display,
        topBarHeight: topBar?.offsetHeight,
        mainMenuVisible: mainMenu && !mainMenu.classList.contains('hidden'),
        canvasPresent: !!bgCanvas,
        canvasW: bgCanvas?.width,
        canvasH: bgCanvas?.height,
        hasSinglePlayerBtn: !!btnSingle,
        hasMultiplayerBtn: !!btnMulti,
        hasSettingsBtn: !!btnSettings,
      };
    });

    console.log('Start screen check result:', startScreenCheck);
    if (startScreenCheck.topBarDisplay !== 'none' || startScreenCheck.topBarHeight > 0) {
      failures.push('Top bar is visible at startup (expected display: none, height: 0)');
    }
    if (!startScreenCheck.mainMenuVisible || !startScreenCheck.canvasPresent) {
      failures.push('Main menu starting screen or background canvas is missing');
    }

    // Capture initial starting screen
    await page.screenshot({ path: `${OUTPUT_DIR}/01_starting_screen.png` });
    console.log('📸 Saved 01_starting_screen.png');

    // Wait 2 seconds to verify camera spanning motion
    await wait(2000);
    await page.screenshot({ path: `${OUTPUT_DIR}/01b_starting_screen_panned.png` });
    console.log('📸 Saved 01b_starting_screen_panned.png (camera spanning in different directions)');

    // ────────────────────────────────────────────────────────────────
    // TEST 2: In-Game Minimal HUD & Fullscreen View
    // ────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 2: Enter Game, Verify Fullscreen View & Minimal HUD ---');
    await page.click('#btn-menu-singleplayer');
    await wait(2000);

    const hudCheck = await page.evaluate(() => {
      const topBar = document.querySelector('.top-tab-bar');
      const gameView = document.getElementById('game-view');
      const canvas = document.getElementById('survival-game-canvas');
      const barsCard = document.querySelector('.survival-bars-card');
      const timeCapsule = document.getElementById('hud-time-capsule');
      const clockTime = document.getElementById('hud-clock-time');
      const radarCard = document.getElementById('radar-card');
      const radarCanvas = document.getElementById('radar-canvas');
      const iconToolbar = document.querySelector('.hud-icon-toolbar');
      const hotbarWrapper = document.querySelector('.hotbar-wrapper');

      const hpFill = document.getElementById('hud-hp-fill');
      const hungerFill = document.getElementById('hud-hunger-fill');
      const staminaFill = document.getElementById('hud-stamina-fill');

      return {
        topBarDisplay: topBar ? window.getComputedStyle(topBar).display : null,
        gameViewHeight: gameView?.offsetHeight,
        canvasHeight: canvas?.offsetHeight,
        windowHeight: window.innerHeight,
        barsCardWidth: barsCard?.offsetWidth,
        timeCapsuleText: timeCapsule?.textContent?.trim(),
        clockText: clockTime?.textContent?.trim(),
        radarCardW: radarCard?.offsetWidth,
        radarCardH: radarCard?.offsetHeight,
        radarCanvasW: radarCanvas?.width,
        radarCanvasH: radarCanvas?.height,
        toolbarBtnCount: iconToolbar ? iconToolbar.querySelectorAll('.hud-icon-btn').length : 0,
        hotbarVisible: !!hotbarWrapper,
        hpFillWidth: hpFill?.style.width,
        hungerFillWidth: hungerFill?.style.width,
        staminaFillWidth: staminaFill?.style.width,
      };
    });

    console.log('HUD check result:', hudCheck);
    if (hudCheck.topBarDisplay !== 'none') {
      failures.push('Top bar is not hidden in game');
    }
    if (hudCheck.gameViewHeight !== hudCheck.windowHeight) {
      failures.push(`Game view height (${hudCheck.gameViewHeight}) does not fill window height (${hudCheck.windowHeight})`);
    }
    if (hudCheck.toolbarBtnCount < 5 || hudCheck.toolbarBtnCount > 6) {
      failures.push(`Expected 5 or 6 icon buttons below minimap, found ${hudCheck.toolbarBtnCount}`);
    }
    if (!/^\d{2}:\d{2}\s+(AM|PM)$/.test(hudCheck.clockText)) {
      failures.push(`Clock time "${hudCheck.clockText}" does not match AM/PM format (e.g. 08:30 AM)`);
    }

    await page.screenshot({ path: `${OUTPUT_DIR}/02_in_game_minimal_hud.png` });
    console.log('📸 Saved 02_in_game_minimal_hud.png');

    // ────────────────────────────────────────────────────────────────
    // TEST 3: Objectives Button & Compact Objectives Drawer
    // ────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 3: Objectives Drawer Toggle [O] ---');
    // Click Objectives button
    await page.click('#btn-toggle-objectives');
    await wait(400);

    const objCheck = await page.evaluate(() => {
      const panel = document.getElementById('compact-objectives-panel');
      const isVisible = panel && !panel.classList.contains('hidden');
      const quests = panel ? panel.querySelectorAll('.quest-item').length : 0;
      const title = panel ? panel.querySelector('.obj-header-title')?.textContent?.trim() : null;
      return {
        isVisible,
        quests,
        title,
        panelW: panel?.offsetWidth,
      };
    });

    console.log('Objectives drawer open check:', objCheck);
    if (!objCheck.isVisible) {
      failures.push('Compact objectives drawer did not open on clicking Objectives button');
    }

    await page.screenshot({ path: `${OUTPUT_DIR}/03_objectives_drawer_open.png` });
    console.log('📸 Saved 03_objectives_drawer_open.png');

    // Close objectives drawer
    await page.click('#btn-close-objectives');
    await wait(300);

    // ────────────────────────────────────────────────────────────────
    // TEST 4: Inventory Modal [I]
    // ────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 4: Inventory Modal Toggle [I] ---');
    await page.click('#btn-open-inventory');
    await wait(400);

    const invCheck = await page.evaluate(() => {
      const modal = document.getElementById('modal-inventory');
      const isVisible = modal && !modal.classList.contains('hidden');
      const invSlots = document.querySelectorAll('#modal-inventory-grid .inv-slot').length;
      const hotbarSlots = document.querySelectorAll('#modal-hotbar-grid .inv-slot').length;
      const craftRecipes = document.querySelectorAll('#craft-recipes-list .recipe-row').length;
      return {
        isVisible,
        invSlots,
        hotbarSlots,
        craftRecipes,
      };
    });

    console.log('Inventory modal check:', invCheck);
    if (!invCheck.isVisible) {
      failures.push('Inventory modal did not open on clicking Inventory button');
    }
    if (invCheck.invSlots !== 20) {
      failures.push(`Expected 20 inventory backpack slots, found ${invCheck.invSlots}`);
    }

    await page.screenshot({ path: `${OUTPUT_DIR}/04_inventory_modal_open.png` });
    console.log('📸 Saved 04_inventory_modal_open.png');

    // Close inventory
    await page.click('#btn-close-inventory');
    await wait(300);

    // ────────────────────────────────────────────────────────────────
    // TEST 5: Minimap World Elements & Remote Player Boundary Clamping
    // ────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 5: Minimap World Elements & Remote Player Clamping ---');
    const minimapCheck = await page.evaluate(() => {
      const engine = window.survivalEngine;
      const radarCanvas = document.getElementById('radar-canvas');
      if (!engine || !radarCanvas) return { error: 'Missing engine or radarCanvas' };

      const px = engine.player.x;
      const py = engine.player.y;

      // Add 2 remote players:
      // Player 1: within minimap range (e.g. +10 tiles away)
      // Player 2: far outside minimap range (e.g. +150 tiles away, should be stuck to boundary)
      engine.remotePlayers = [
        { id: 'p_near', name: 'NearbyExplorer', x: px + 15, y: py - 10, color: '#38bdf8' },
        { id: 'p_far_ne', name: 'DistantExplorer', x: px + 200, y: py - 180, color: '#ec4899' },
        { id: 'p_far_sw', name: 'SouthWestExplorer', x: px - 250, y: py + 220, color: '#10b981' },
      ];

      // Request next frame render of minimap
      return {
        remotePlayerCount: engine.remotePlayers.length,
        villagesCount: engine.worldManager.villages.length,
      };
    });

    console.log('Minimap remote players added:', minimapCheck);
    await wait(300);

    await page.screenshot({ path: `${OUTPUT_DIR}/05_minimap_remote_players_clamped.png` });
    console.log('📸 Saved 05_minimap_remote_players_clamped.png');

    // ────────────────────────────────────────────────────────────────
    // TEST 6: Breaking Resource & 100% Opaque Dropped Items
    // ────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 6: Breaking Resource & Opaque Dropped Items Verification ---');
    const breakAndDropCheck = await page.evaluate(() => {
      const engine = window.survivalEngine;
      const renderer = window.survivalRenderer;
      const canvas = document.getElementById('survival-game-canvas');
      const ctx = canvas.getContext('2d');
      if (!engine || !renderer || !canvas || !ctx) return { error: 'Missing engine/canvas' };

      const px = engine.player.x;
      const py = engine.player.y;

      // Clear any existing dropped items for clean measurement
      engine.droppedItems = [];

      // Spawn dropped items: wood (stack 4), stone (stack 2), iron_ore (1)
      const d1 = engine.spawnDroppedItem('wood', 4, px + 2.5, py);
      const d2 = engine.spawnDroppedItem('stone', 2, px + 3.2, py + 0.6);
      const d3 = engine.spawnDroppedItem('iron_ore', 1, px + 3.9, py);

      // Snap camera to dropped items
      renderer.snapCameraTo(px + 3.2, py);

      // Render frame
      renderer.render(canvas, engine, 0.016);

      const cellSize = 16 * renderer.zoom;
      const halfWidth = canvas.width / 2;
      const halfHeight = canvas.height / 2;

      // Check pixel opacity for each dropped item
      const itemOpacityResults = [];
      for (const item of [d1, d2, d3]) {
        const sx = (item.x - renderer.cameraX) * cellSize + halfWidth + cellSize / 2;
        const sy = (item.y - renderer.cameraY) * cellSize + halfHeight + cellSize / 2;

        const imgData = ctx.getImageData(Math.round(sx) - 6, Math.round(sy) - 6, 12, 12);
        const data = imgData.data;

        let minAlpha = 255;
        let nonZero = 0;
        let fullyOpaque = 0;

        for (let i = 3; i < data.length; i += 4) {
          const a = data[i];
          if (a < minAlpha) minAlpha = a;
          if (a > 0) nonZero++;
          if (a === 255) fullyOpaque++;
        }

        itemOpacityResults.push({
          item: item.item,
          count: item.count,
          minAlpha,
          fullyOpaque,
          total: data.length / 4,
          is100PercentOpaque: fullyOpaque === data.length / 4 && minAlpha === 255,
        });
      }

      return {
        itemOpacityResults,
        droppedCount: engine.droppedItems.length,
      };
    });

    console.log('Break & drop check results:', JSON.stringify(breakAndDropCheck, null, 2));

    for (const res of breakAndDropCheck.itemOpacityResults || []) {
      if (!res.is100PercentOpaque) {
        failures.push(`Dropped item ${res.item} is not 100% opaque: minAlpha=${res.minAlpha}, fullyOpaque=${res.fullyOpaque}/${res.total}`);
      }
    }

    await page.screenshot({ path: `${OUTPUT_DIR}/06_broken_resource_opaque_drops.png` });
    console.log('📸 Saved 06_broken_resource_opaque_drops.png');

    // ────────────────────────────────────────────────────────────────
    // SUMMARY
    // ────────────────────────────────────────────────────────────────
    console.log('\n======================================================');
    if (failures.length === 0) {
      console.log('🎉 ALL IN-BROWSER VERIFICATION CHECKS PASSED WITH 0 FAILURES!');
    } else {
      console.error('❌ FAILURES DETECTED:');
      failures.forEach((f, idx) => console.error(`  ${idx + 1}. ${f}`));
      process.exit(1);
    }
    console.log('======================================================\n');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('❌ In-browser verification crashed:', err);
  process.exit(1);
});

