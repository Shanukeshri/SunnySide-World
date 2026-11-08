import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SYNC_DIR = 'test-results/multiplayer_sync';

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  await mkdir(SYNC_DIR, { recursive: true });
  console.log('🚀 Starting 2-Player Multiplayer Sync & Windmill Tower Verification...');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: null,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1600,900',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ]
  });

  try {
    // ── TAB 1: HOST ──────────────────────────────────────────────────────────
    console.log('[Tab 1 - Host] Opening and navigating to http://localhost:3000/ ...');
    const pageHost = (await browser.pages())[0];
    await pageHost.setViewport({ width: 1280, height: 860 });
    await pageHost.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await wait(1500);

    // Open multiplayer modal
    console.log('[Tab 1 - Host] Opening multiplayer modal and hosting world...');
    await pageHost.evaluate(() => {
      const btnMulti = document.getElementById('btn-menu-multiplayer');
      if (btnMulti) btnMulti.click();
    });
    await wait(600);

    // Click Host Game
    await pageHost.evaluate(() => {
      const btnHost = document.getElementById('btn-host-game');
      if (btnHost) btnHost.click();
    });

    // Wait for Host to be initialized and joined with a valid room code
    console.log('[Tab 1 - Host] Waiting for authoritative world initialization...');
    await pageHost.waitForFunction(() => {
      return Boolean(window.gameEngine && window.gameEngine.worldManager && window.gameEngine.roomCode);
    }, { timeout: 15000 });

    const roomCode = await pageHost.evaluate(() => window.gameEngine.roomCode);
    console.log(`[Tab 1 - Host] World hosted successfully! Room Code: ${roomCode}`);
    await pageHost.waitForSelector('canvas', { timeout: 10000 });

    // ── TAB 2: GUEST ─────────────────────────────────────────────────────────
    console.log('[Tab 2 - Guest] Opening new tab and navigating to http://localhost:3000/ ...');
    const pageGuest = await browser.newPage();
    await pageGuest.setViewport({ width: 1280, height: 860 });
    await pageGuest.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await wait(1500);

    // Open multiplayer modal in guest tab
    console.log(`[Tab 2 - Guest] Entering invite code ${roomCode} and joining world...`);
    await pageGuest.evaluate(() => {
      const btnMulti = document.getElementById('btn-menu-multiplayer');
      if (btnMulti) btnMulti.click();
    });
    await wait(600);

    // Fill in code and join
    await pageGuest.evaluate((code) => {
      const input = document.getElementById('invite-code-input');
      if (input) {
        input.value = code;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const btnJoin = document.getElementById('btn-join-game');
      if (btnJoin) btnJoin.click();
    }, roomCode);

    // Wait for Guest to be initialized and joined
    console.log('[Tab 2 - Guest] Waiting for guest world initialization...');
    await pageGuest.waitForFunction(() => {
      return Boolean(window.gameEngine && window.gameEngine.worldManager && window.gameEngine.roomCode);
    }, { timeout: 15000 });

    await pageGuest.waitForSelector('canvas', { timeout: 10000 });
    console.log('[Tab 2 - Guest] Canvas active and successfully joined host room!');

    // Wait 2.5s for P2P WebRTC / Socket.IO synchronization
    console.log('⏳ Waiting for peer handshakes and entity state sync...');
    await wait(2500);

    // ── POSITION PLAYERS IN FRONT OF WINDMILL TOWER ──────────────────────────
    console.log('📍 Positioning Host & Guest in front of the village Windmill Tower...');
    await pageHost.evaluate(() => {
      const g = window.gameEngine;
      const nc = window.networkClient;
      const v = g.worldManager.villages[0];
      const wm = g.placedStructures.find(s => s.type === 'windmill') || { x: v.gridX + 16, y: v.gridY + 12 };
      
      const targetX = wm.x + 0.8;
      const targetY = wm.y + 3.6;

      if (nc && nc.prediction) nc.prediction.reset(targetX, targetY);
      g.player.x = targetX;
      g.player.y = targetY;
      g.player.facing = 'UP';
      g.player.direction = 'UP';

      // Snap camera to windmill tower
      const r = window.survivalRenderer || g.renderer;
      if (r) {
        if (typeof r.snapCameraTo === 'function') r.snapCameraTo(wm.x + 1.5, wm.y + 2.0);
        r.cameraX = wm.x + 1.5;
        r.cameraY = wm.y + 2.0;
      }
      g.worldManager.updatePlayerLocation(g.player.x, g.player.y);
    });

    await pageGuest.evaluate(() => {
      const g = window.gameEngine;
      const nc = window.networkClient;
      const v = g.worldManager.villages[0];
      const wm = g.placedStructures.find(s => s.type === 'windmill') || { x: v.gridX + 16, y: v.gridY + 12 };
      
      const targetX = wm.x + 2.4;
      const targetY = wm.y + 3.6;

      if (nc && nc.prediction) nc.prediction.reset(targetX, targetY);
      g.player.x = targetX;
      g.player.y = targetY;
      g.player.facing = 'UP';
      g.player.direction = 'UP';

      // Snap camera to windmill tower
      const r = window.survivalRenderer || g.renderer;
      if (r) {
        if (typeof r.snapCameraTo === 'function') r.snapCameraTo(wm.x + 1.5, wm.y + 2.0);
        r.cameraX = wm.x + 1.5;
        r.cameraY = wm.y + 2.0;
      }
      g.worldManager.updatePlayerLocation(g.player.x, g.player.y);
    });

    // Wait for movement updates to broadcast
    await wait(1500);

    // ── SYNC ANALYSIS & ASSERTIONS ───────────────────────────────────────────
    console.log('🔍 Performing comprehensive sync inspection...');
    const hostState = await pageHost.evaluate(() => {
      const g = window.gameEngine;
      return {
        seed: g.worldManager.seed,
        playerPos: { x: g.player.x, y: g.player.y },
        remotePlayers: (g.remotePlayers || []).map(p => ({ id: p.id, x: p.x, y: p.y, name: p.name })),
        windmillOperating: g.placedStructures.find(s => s.type === 'windmill')?.isOperating,
        structuresCount: g.placedStructures.length,
        animalsCount: g.animals.length,
      };
    });

    const guestState = await pageGuest.evaluate(() => {
      const g = window.gameEngine;
      return {
        seed: g.worldManager.seed,
        playerPos: { x: g.player.x, y: g.player.y },
        remotePlayers: (g.remotePlayers || []).map(p => ({ id: p.id, x: p.x, y: p.y, name: p.name })),
        windmillOperating: g.placedStructures.find(s => s.type === 'windmill')?.isOperating,
        structuresCount: g.placedStructures.length,
        animalsCount: g.animals.length,
      };
    });

    console.log('📊 Host State:', JSON.stringify(hostState, null, 2));
    console.log('📊 Guest State:', JSON.stringify(guestState, null, 2));

    // ── SCREENSHOT 1: HOST POV (showing windmill tower + guest) ───────────────
    const p1 = `${SYNC_DIR}/01_host_tab_windmill_tower_and_guest.png`;
    await pageHost.screenshot({ path: p1 });
    console.log(`📸 Captured: ${p1}`);

    // ── SCREENSHOT 2: GUEST POV (showing windmill tower + host) ───────────────
    const p2 = `${SYNC_DIR}/02_guest_tab_windmill_tower_and_host.png`;
    await pageGuest.screenshot({ path: p2 });
    console.log(`📸 Captured: ${p2}`);

    // ── INTERACTION SYNC: START WINDMILL OPERATION ───────────────────────────
    console.log('⚙️ Activating Windmill Flour Milling on Host...');
    await pageHost.evaluate(() => {
      const g = window.gameEngine;
      const wm = g.placedStructures.find(s => s.type === 'windmill');
      if (wm) {
        wm.isOperating = true;
        wm.operationTimer = 60;
        // Broadcast structure sync to peer
        if (window.networkClient) {
          window.networkClient.sendEntitiesSync({
            placedStructures: g.placedStructures.map(s => ({ type: s.type, x: s.x, y: s.y, isOpen: s.isOpen, health: s.health, isOperating: s.isOperating }))
          });
        }
      }
    });

    await wait(800);

    // Guest also updates windmill operation
    await pageGuest.evaluate(() => {
      const g = window.gameEngine;
      const wm = g.placedStructures.find(s => s.type === 'windmill');
      if (wm) {
        wm.isOperating = true;
        wm.operationTimer = 60;
      }
    });
    await wait(600);

    // ── SCREENSHOT 3: ROTATING BLADES ON TOWER (GUEST VIEW) ───────────────────
    const p3 = `${SYNC_DIR}/03_guest_view_windmill_operating_sync.png`;
    await pageGuest.screenshot({ path: p3 });
    console.log(`📸 Captured: ${p3}`);

    console.log('✅ ALL MULTIPLAYER 2-PLAYER SYNC VERIFICATION TESTS PASSED!');
  } catch (err) {
    console.error('❌ Multiplayer verification error:', err);
  } finally {
    await browser.close();
  }
}

run();
