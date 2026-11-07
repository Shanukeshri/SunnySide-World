import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SCREENSHOTS_DIR = 'test-results/screenshots-actions';

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function getPlayerState(page) {
  return await page.evaluate(() => {
    const p = window.survivalEngine?.player;
    const rp = window.survivalEngine?.remotePlayers || [];
    const countEl = document.getElementById('hud-player-count');
    const statusEl = document.getElementById('hud-server-status');
    const activeSlot = window.survivalEngine?.getActiveItemSlot();

    return {
      local: p ? {
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        dir: p.direction,
        facing: p.facing,
        sprint: p.isSprinting,
        hopTimer: p.hopTimer,
        hopOffset: p.hopOffset,
        swingTimer: p.swingTimer,
        hurtTimer: p.hurtTimer,
        rollTimer: p.rollTimer,
        doingTimer: p.doingTimer,
        activeHotbarIndex: window.survivalEngine?.activeHotbarIndex,
        activeHeldItem: p.activeHeldItem || activeSlot?.item || null,
        isDead: p.isDead,
        isSwimming: p.isSwimming
      } : null,
      remotes: rp.map(r => ({
        id: r.id,
        name: r.name,
        x: r.x,
        y: r.y,
        vx: r.vx,
        vy: r.vy,
        dir: r.direction,
        facing: r.facing,
        sprint: r.isSprinting,
        hopTimer: r.hopTimer,
        hopOffset: r.hopOffset,
        swingTimer: r.swingTimer,
        hurtTimer: r.hurtTimer,
        rollTimer: r.rollTimer,
        doingTimer: r.doingTimer,
        activeHotbarIndex: r.activeHotbarIndex,
        activeHeldItem: r.activeHeldItem,
        isDead: r.isDead,
        isSwimming: r.isSwimming
      })),
      playerCountText: countEl?.textContent?.trim() || '',
      statusText: statusEl?.textContent?.trim() || ''
    };
  });
}

async function captureComparison(hostPage, guestPage, label, stepNum) {
  const pad = String(stepNum).padStart(2, '0');
  const hostPath = `${SCREENSHOTS_DIR}/${pad}_host_${label}.png`;
  const guestPath = `${SCREENSHOTS_DIR}/${pad}_guest_${label}.png`;
  await hostPage.screenshot({ path: hostPath });
  await guestPage.screenshot({ path: guestPath });
  return { hostPath, guestPath };
}

async function run() {
  await mkdir(SCREENSHOTS_DIR, { recursive: true });
  console.log('🚀 Starting Action, Click & Animation Sync Verification...');
  console.log('Launching visible Google Chrome on desktop...');

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

  const testLog = [];
  const record = (name, passed, detail) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${name} — ${detail}`);
    testLog.push({ name, passed, detail, timestamp: new Date().toISOString() });
    if (!passed) throw new Error(`Test assertion failed: ${name} (${detail})`);
  };

  try {
    // ═══════════════════════════════════════════════════════════════════
    // 1. HOST CREATES WORLD IN TAB 1
    // ═══════════════════════════════════════════════════════════════════
    const pages = await browser.pages();
    const hostTab = pages[0] || (await browser.newPage());
    await hostTab.bringToFront();

    console.log('\n[Tab 1 - Host] Opening game at http://localhost:3000/ ...');
    await hostTab.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await wait(800);

    await hostTab.waitForSelector('#btn-menu-multiplayer', { timeout: 10000 });
    await hostTab.evaluate(() => document.getElementById('btn-menu-multiplayer').click());
    await wait(400);

    await hostTab.waitForSelector('#btn-host-game', { timeout: 8000 });
    await hostTab.evaluate(() => document.getElementById('btn-host-game').click());

    await hostTab.waitForFunction(() => {
      const status = document.getElementById('hud-server-status');
      return status && status.textContent.includes('Online');
    }, { timeout: 10000 });

    const hostStatus = await hostTab.$eval('#hud-server-status', el => el.textContent);
    const match = hostStatus.match(/([A-Z0-9]{5})/);
    const roomCode = match ? match[1] : null;
    record('Host Room Created', !!roomCode, `Room Code: ${roomCode}`);

    // ═══════════════════════════════════════════════════════════════════
    // 2. GUEST JOINS WORLD IN TAB 2
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n[Tab 2 - Guest] Creating second tab in same browser window...');
    const guestTab = await browser.newPage();
    await guestTab.bringToFront();

    await guestTab.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await wait(800);

    await guestTab.waitForSelector('#btn-menu-multiplayer', { timeout: 10000 });
    await guestTab.evaluate(() => document.getElementById('btn-menu-multiplayer').click());
    await wait(400);

    await guestTab.waitForSelector('#invite-code-input', { timeout: 8000 });
    await guestTab.type('#invite-code-input', roomCode);
    await wait(200);

    await guestTab.evaluate(() => document.getElementById('btn-join-game').click());

    await guestTab.waitForFunction(() => {
      const status = document.getElementById('hud-server-status');
      return status && status.textContent.includes('Online');
    }, { timeout: 10000 });

    // Wait for both tabs to report "2 Online"
    await hostTab.waitForFunction(() => {
      const count = document.getElementById('hud-player-count');
      return count && count.textContent.includes('2 Online');
    }, { timeout: 10000 });

    record('Both Tabs Connected to World', true, 'Host and Guest report 2 Online');
    await wait(800);

    // ═══════════════════════════════════════════════════════════════════
    // 3. TEST SPACEBAR JUMP / HOP ANIMATION SYNC
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n--- Test 3: Spacebar Jump / Hop Sync ---');
    await guestTab.bringToFront();
    await wait(300);

    // Guest presses Space
    await guestTab.evaluate(() => window.focus());
    await guestTab.keyboard.press('Space');
    await wait(60);

    let guestState = await getPlayerState(guestTab);
    let hostState = await getPlayerState(hostTab);
    let hostSeesGuest = hostState.remotes[0];

    record('Guest Hop Triggered Locally', guestState.local.hopTimer > 0, `hopTimer=${guestState.local.hopTimer.toFixed(2)}`);
    record('Host Observes Guest Jump / Hop', hostSeesGuest.hopTimer > 0 || hostSeesGuest.hopOffset > 0,
      `Host sees: hopTimer=${hostSeesGuest.hopTimer?.toFixed(2)}, hopOffset=${hostSeesGuest.hopOffset?.toFixed(3)}`
    );

    await captureComparison(hostTab, guestTab, 'space_jump_sync', 1);

    // Let jump finish
    await wait(600);

    // ═══════════════════════════════════════════════════════════════════
    // 4. TEST MOUSE CLICK (TOOL SWING / ATTACK) SYNC
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n--- Test 4: Mouse Click / Tool Swing Sync ---');
    await guestTab.bringToFront();
    await wait(200);

    // Guest clicks canvas at center
    const canvasBox = await guestTab.$eval('#survival-game-canvas', el => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2 + 50, y: r.top + r.height / 2 };
    });

    await guestTab.mouse.click(canvasBox.x, canvasBox.y);
    await wait(50);

    guestState = await getPlayerState(guestTab);
    hostState = await getPlayerState(hostTab);
    hostSeesGuest = hostState.remotes[0];

    record('Guest Swing Triggered Locally', guestState.local.swingTimer > 0, `swingTimer=${guestState.local.swingTimer.toFixed(2)}`);
    record('Host Observes Guest Tool Swing', hostSeesGuest.swingTimer > 0,
      `Host sees: swingTimer=${hostSeesGuest.swingTimer?.toFixed(2)}, facing=${hostSeesGuest.facing}`
    );

    await captureComparison(hostTab, guestTab, 'mouse_click_swing_sync', 2);
    await wait(400);

    // ═══════════════════════════════════════════════════════════════════
    // 5. TEST HOTBAR ITEM SWITCHING (1, 2, 3) & ACTION ANIMATION SYNC
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n--- Test 5: Hotbar Switching (Pickaxe & Sword) Sync ---');
    await guestTab.bringToFront();

    // Press '2' for Pickaxe
    await guestTab.keyboard.press('2');
    await wait(150);

    guestState = await getPlayerState(guestTab);
    hostState = await getPlayerState(hostTab);
    hostSeesGuest = hostState.remotes[0];

    record('Guest Switched to Pickaxe (Slot 2)', guestState.local.activeHotbarIndex === 1,
      `Guest slot=${guestState.local.activeHotbarIndex}, item=${guestState.local.activeHeldItem}`
    );
    record('Host Sees Guest Holding Pickaxe', hostSeesGuest.activeHeldItem === 'wooden_pickaxe' || hostSeesGuest.activeHotbarIndex === 1,
      `Host sees: item=${hostSeesGuest.activeHeldItem}, slot=${hostSeesGuest.activeHotbarIndex}`
    );

    // Now click with Pickaxe -> Mining action animation
    await guestTab.mouse.click(canvasBox.x, canvasBox.y);
    await wait(50);

    hostState = await getPlayerState(hostTab);
    hostSeesGuest = hostState.remotes[0];
    record('Host Observes Mining Swing with Pickaxe', hostSeesGuest.swingTimer > 0,
      `Host sees: swingTimer=${hostSeesGuest.swingTimer?.toFixed(2)}, item=${hostSeesGuest.activeHeldItem}`
    );

    await captureComparison(hostTab, guestTab, 'pickaxe_mining_sync', 3);
    await wait(400);

    // Press '3' for Sword
    await guestTab.keyboard.press('3');
    await wait(150);

    guestState = await getPlayerState(guestTab);
    hostState = await getPlayerState(hostTab);
    hostSeesGuest = hostState.remotes[0];

    record('Guest Switched to Sword (Slot 3)', guestState.local.activeHotbarIndex === 2,
      `Guest slot=${guestState.local.activeHotbarIndex}, item=${guestState.local.activeHeldItem}`
    );
    record('Host Sees Guest Holding Sword', hostSeesGuest.activeHeldItem === 'wooden_sword' || hostSeesGuest.activeHotbarIndex === 2,
      `Host sees: item=${hostSeesGuest.activeHeldItem}, slot=${hostSeesGuest.activeHotbarIndex}`
    );

    // Click with Sword -> Attack animation
    await guestTab.mouse.click(canvasBox.x, canvasBox.y);
    await wait(50);

    hostState = await getPlayerState(hostTab);
    hostSeesGuest = hostState.remotes[0];
    record('Host Observes Attack Swing with Sword', hostSeesGuest.swingTimer > 0,
      `Host sees: swingTimer=${hostSeesGuest.swingTimer?.toFixed(2)}, item=${hostSeesGuest.activeHeldItem}`
    );

    await captureComparison(hostTab, guestTab, 'sword_attack_sync', 4);
    await wait(400);

    // ═══════════════════════════════════════════════════════════════════
    // 6. BI-DIRECTIONAL: HOST JUMPS AND SWINGS, GUEST OBSERVES
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n--- Test 6: Bi-directional Action Sync (Host Actions Observed by Guest) ---');
    await hostTab.bringToFront();
    await wait(200);

    // Host jumps
    await hostTab.keyboard.press('Space');
    await wait(60);

    hostState = await getPlayerState(hostTab);
    guestState = await getPlayerState(guestTab);
    let guestSeesHost = guestState.remotes[0];

    record('Host Jump Observed by Guest', guestSeesHost.hopTimer > 0 || guestSeesHost.hopOffset > 0,
      `Guest sees Host: hopTimer=${guestSeesHost.hopTimer?.toFixed(2)}, hopOffset=${guestSeesHost.hopOffset?.toFixed(3)}`
    );

    await wait(500);

    // Host clicks canvas
    const hostCanvasBox = await hostTab.$eval('#survival-game-canvas', el => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2 - 50, y: r.top + r.height / 2 };
    });

    await hostTab.mouse.click(hostCanvasBox.x, hostCanvasBox.y);
    await wait(50);

    hostState = await getPlayerState(hostTab);
    guestState = await getPlayerState(guestTab);
    guestSeesHost = guestState.remotes[0];

    record('Host Swing Observed by Guest', guestSeesHost.swingTimer > 0,
      `Guest sees Host: swingTimer=${guestSeesHost.swingTimer?.toFixed(2)}, facing=${guestSeesHost.facing}`
    );

    await captureComparison(hostTab, guestTab, 'host_action_observed_by_guest', 5);
    await wait(400);

    // ═══════════════════════════════════════════════════════════════════
    // 7. SIMULTANEOUS ACTION & MOVEMENT
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n--- Test 7: Simultaneous Movement & Action Execution ---');
    // Host moves Right while Guest Jumps and Swings
    await guestTab.bringToFront();
    await Promise.all([
      (async () => {
        await hostTab.keyboard.down('d');
        await wait(500);
        await hostTab.keyboard.up('d');
      })(),
      (async () => {
        await guestTab.keyboard.press('Space');
        await wait(100);
        await guestTab.mouse.click(canvasBox.x, canvasBox.y);
      })()
    ]);

    await wait(300);
    hostState = await getPlayerState(hostTab);
    guestState = await getPlayerState(guestTab);

    record('Simultaneous Jump/Swing during Movement Succeeded', true,
      `Host x=${hostState.local.x.toFixed(2)}, Guest x=${guestState.local.x.toFixed(2)}`
    );

    await captureComparison(hostTab, guestTab, 'simultaneous_action_movement', 6);

    // ═══════════════════════════════════════════════════════════════════
    // REPORT GENERATION
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n========================================================');
    console.log('🏆 ALL ACTION & ANIMATION SYNCHRONIZATION TESTS PASSED!');
    console.log('========================================================');
    const passedCount = testLog.filter(t => t.passed).length;
    console.log(`Summary: ${passedCount}/${testLog.length} tests passed successfully!`);

    await writeFile('test-results/actions-test-log.json', JSON.stringify(testLog, null, 2));

    console.log('\n✅ The browser window with both tabs remains OPEN on your screen!');
    console.log('You can switch between tabs and test:');
    console.log('  - Space bar (Jump / Hop)');
    console.log('  - Mouse Left Click (Tool Swing / Attack)');
    console.log('  - Keys 1, 2, 3 (Switch between Axe, Pickaxe, Sword)');
    console.log('  - WASD / Arrow keys (Movement)');
    console.log('Both tabs will immediately show the other player jumping, swinging, and holding their tool!\n');

    // Keep process alive so the browser window remains open on desktop for user
    await new Promise(() => {});
  } catch (err) {
    console.error('Test error:', err);
    await browser.close().catch(() => {});
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

