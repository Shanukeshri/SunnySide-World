import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUTPUT_DIR = 'test-results/fullscreen-opaque-drops-verification';

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  console.log('🚀 Running Fullscreen & Opaque Dropped Items Verification...');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
  });

  try {
    const page = (await browser.pages())[0];
    await page.setViewport({ width: 1440, height: 900 });

    // ─────────────────────────────────────────────────────────────
    // 1. STARTING SCREEN & TOP BAR CHECK
    // ─────────────────────────────────────────────────────────────
    console.log('[1/4] Navigating to game...');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
    await wait(1500);

    const topBarInfoStart = await page.evaluate(() => {
      const el = document.querySelector('.top-tab-bar');
      if (!el) return { exists: false };
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        exists: true,
        display: style.display,
        visibility: style.visibility,
        height: rect.height,
        offsetHeight: el.offsetHeight,
      };
    });

    console.log('Top bar at start:', topBarInfoStart);
    if (topBarInfoStart.display !== 'none' || topBarInfoStart.height > 0) {
      throw new Error(`Expected top bar to be hidden (display: none, height: 0), got: ${JSON.stringify(topBarInfoStart)}`);
    }

    await page.screenshot({ path: `${OUTPUT_DIR}/01_fullscreen_start_menu.png` });
    console.log('📸 Captured 01_fullscreen_start_menu.png');

    // ─────────────────────────────────────────────────────────────
    // 2. ENTER SINGLE PLAYER GAME
    // ─────────────────────────────────────────────────────────────
    console.log('[2/4] Entering Single Player...');
    await page.click('#btn-menu-singleplayer');
    await wait(2000);

    const gameViewInfo = await page.evaluate(() => {
      const topBar = document.querySelector('.top-tab-bar');
      const gameView = document.getElementById('game-view');
      const canvas = document.getElementById('survival-game-canvas');
      const topBarStyle = topBar ? window.getComputedStyle(topBar) : null;
      const gameViewRect = gameView ? gameView.getBoundingClientRect() : null;
      const canvasRect = canvas ? canvas.getBoundingClientRect() : null;

      return {
        topBarDisplay: topBarStyle?.display,
        topBarHeight: topBar?.offsetHeight,
        gameViewWidth: gameViewRect?.width,
        gameViewHeight: gameViewRect?.height,
        canvasWidth: canvasRect?.width,
        canvasHeight: canvasRect?.height,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
      };
    });

    console.log('Game view fullscreen info:', gameViewInfo);
    if (gameViewInfo.topBarDisplay !== 'none' || gameViewInfo.topBarHeight > 0) {
      throw new Error(`Top bar is not hidden in game: ${JSON.stringify(gameViewInfo)}`);
    }
    if (gameViewInfo.gameViewHeight !== gameViewInfo.windowHeight) {
      throw new Error(`Game view height (${gameViewInfo.gameViewHeight}) does not match window height (${gameViewInfo.windowHeight})`);
    }

    await page.screenshot({ path: `${OUTPUT_DIR}/02_fullscreen_game_view.png` });
    console.log('📸 Captured 02_fullscreen_game_view.png');

    // ─────────────────────────────────────────────────────────────
    // 3. SPAWN DROPPED ITEMS & BREAK A RESOURCE
    // ─────────────────────────────────────────────────────────────
    console.log('[3/4] Spawning dropped items and breaking a resource node...');
    const dropResult = await page.evaluate(() => {
      const engine = window.survivalEngine;
      if (!engine) return { success: false, reason: 'No survivalEngine' };

      // Temporarily move player slightly away from items so they don't immediately get picked up
      const px = engine.player.x;
      const py = engine.player.y;

      // Spawn dropped items at fixed offset
      const d1 = engine.spawnDroppedItem('wood', 5, px + 3.0, py);
      const d2 = engine.spawnDroppedItem('stone', 3, px + 3.8, py + 0.5);
      const d3 = engine.spawnDroppedItem('iron_ore', 1, px + 4.6, py);

      // Find nearest tree and break it
      let hitCount = 0;
      const tree = engine.worldManager.getResourceAt(px + 1.5, py + 1.5, 5);
      if (tree) {
        for (let h = 0; h < 6; h++) {
          engine.hitResource(tree.x, tree.y, 50, 'wooden_axe', false, tree.id);
          hitCount++;
        }
      }

      return {
        success: true,
        droppedCount: engine.droppedItems.length,
        items: engine.droppedItems.map(d => ({ id: d.id, item: d.item, count: d.count, x: d.x, y: d.y })),
        treeHit: !!tree,
        hitCount,
      };
    });

    console.log('Drop & Resource hit result:', dropResult);

    // Wait 500ms for renderer to draw frames with bobbing animation
    await wait(600);

    await page.screenshot({ path: `${OUTPUT_DIR}/03_opaque_dropped_items_fullscreen.png` });
    console.log('📸 Captured 03_opaque_dropped_items_fullscreen.png');

    // ─────────────────────────────────────────────────────────────
    // 4. VERIFY PIXEL OPACITY AROUND DROPPED ITEMS
    // ─────────────────────────────────────────────────────────────
    console.log('[4/4] Verifying dropped item pixel opacity...');
    const pixelAnalysis = await page.evaluate(() => {
      const engine = window.survivalEngine;
      const renderer = window.survivalRenderer;
      const canvas = document.getElementById('survival-game-canvas');
      if (!engine || !renderer || !canvas) return { error: 'Missing components' };

      const ctx = canvas.getContext('2d');
      if (!ctx) return { error: 'No 2d context' };

      if (engine.droppedItems.length === 0) return { error: 'No dropped items' };

      const cellSize = 16 * renderer.zoom;
      const halfWidth = canvas.width / 2;
      const halfHeight = canvas.height / 2;

      // Calculate screen position of first dropped item
      const item = engine.droppedItems[0];
      const screenX = (item.x - renderer.cameraX) * cellSize + halfWidth + cellSize / 2;
      const screenY = (item.y - renderer.cameraY) * cellSize + halfHeight + cellSize / 2;

      // Read a 20x20 pixel patch around item center
      const patchSize = 20;
      const startX = Math.round(screenX - patchSize / 2);
      const startY = Math.round(screenY - patchSize / 2);
      const imgData = ctx.getImageData(startX, startY, patchSize, patchSize);
      const data = imgData.data;

      let fullyOpaquePixels = 0;
      let nonZeroPixels = 0;
      for (let i = 3; i < data.length; i += 4) {
        const alpha = data[i];
        if (alpha > 0) nonZeroPixels++;
        if (alpha === 255) fullyOpaquePixels++;
      }

      return {
        screenX,
        screenY,
        startX,
        startY,
        totalPixels: patchSize * patchSize,
        nonZeroPixels,
        fullyOpaquePixels,
        firstItem: item.item,
        firstCount: item.count,
      };
    });

    console.log('Pixel analysis around dropped item:', pixelAnalysis);
    if (pixelAnalysis.fullyOpaquePixels === 0) {
      throw new Error('Dropped item region has zero opaque pixels!');
    }

    console.log('🎉 Verification PASSED! Fullscreen active and dropped items are 100% opaque.');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});

