import puppeteer from 'puppeteer-core';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function pressKey(page, key, durationMs) {
  await page.evaluate(() => window.focus());
  await page.keyboard.down(key);
  await wait(durationMs);
  await page.keyboard.up(key);
  await wait(250);
}

async function pressKeys(page, keys, durationMs) {
  await page.evaluate(() => window.focus());
  for (const k of keys) await page.keyboard.down(k);
  await wait(durationMs);
  for (const k of keys) await page.keyboard.up(k);
  await wait(250);
}

async function run() {
  console.log('🖥️  Launching visible Google Chrome with 2 tabs on your desktop...');
  
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

  // Get the default initial page as Tab 1 (Host)
  const pages = await browser.pages();
  const hostTab = pages[0] || (await browser.newPage());
  
  console.log('\n[Tab 1 - Host] Opening game at http://localhost:3000/ ...');
  await hostTab.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await wait(800);

  // Click Multiplayer
  console.log('[Tab 1 - Host] Clicking "Multiplayer Co-op"...');
  await hostTab.waitForSelector('#btn-menu-multiplayer', { timeout: 10000 });
  await hostTab.evaluate(() => document.getElementById('btn-menu-multiplayer').click());
  await wait(500);

  // Click Host Game
  console.log('[Tab 1 - Host] Clicking "Host New World"...');
  await hostTab.waitForSelector('#btn-host-game', { timeout: 8000 });
  await hostTab.evaluate(() => document.getElementById('btn-host-game').click());

  // Wait for status to show Online
  await hostTab.waitForFunction(() => {
    const status = document.getElementById('hud-server-status');
    return status && status.textContent.includes('Online');
  }, { timeout: 10000 });

  const hostStatus = await hostTab.$eval('#hud-server-status', el => el.textContent);
  const match = hostStatus.match(/([A-Z0-9]{5})/);
  const roomCode = match ? match[1] : null;
  console.log(`[Tab 1 - Host] World created! Room Code: ${roomCode}`);

  // Now create Tab 2 (Guest) in the SAME browser window
  console.log('\n[Tab 2 - Guest] Creating second tab in the same browser window...');
  const guestTab = await browser.newPage();
  await guestTab.bringToFront();

  console.log('[Tab 2 - Guest] Opening game at http://localhost:3000/ ...');
  await guestTab.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await wait(800);

  console.log('[Tab 2 - Guest] Clicking "Multiplayer Co-op"...');
  await guestTab.waitForSelector('#btn-menu-multiplayer', { timeout: 10000 });
  await guestTab.evaluate(() => document.getElementById('btn-menu-multiplayer').click());
  await wait(500);

  console.log(`[Tab 2 - Guest] Entering Room Code: ${roomCode} ...`);
  await guestTab.waitForSelector('#invite-code-input', { timeout: 8000 });
  await guestTab.type('#invite-code-input', roomCode);
  await wait(300);

  console.log('[Tab 2 - Guest] Clicking "Join World"...');
  await guestTab.evaluate(() => document.getElementById('btn-join-game').click());

  console.log('[Tab 2 - Guest] Waiting for guest to connect...');
  await guestTab.waitForFunction(() => {
    const status = document.getElementById('hud-server-status');
    return status && status.textContent.includes('Online');
  }, { timeout: 10000 });
  console.log('[Tab 2 - Guest] Guest is Online!');

  // Wait for both tabs to report "2 Online"
  await hostTab.waitForFunction(() => {
    const count = document.getElementById('hud-player-count');
    return count && count.textContent.includes('2 Online');
  }, { timeout: 10000 });

  await guestTab.waitForFunction(() => {
    const count = document.getElementById('hud-player-count');
    return count && count.textContent.includes('2 Online');
  }, { timeout: 10000 });

  console.log('\n🎉 SUCCESS: Both tabs are in the SAME WORLD! (2 Online)');
  await wait(1000);

  // ═══════════════════════════════════════════════════════════════════
  // DEMO MOVEMENTS ACROSS TABS
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n--- 🏃 Demonstration: Moving around in Tab 2 (Guest) ---');
  await guestTab.bringToFront();
  await wait(500);

  console.log('Guest moving Right (D)...');
  await pressKey(guestTab, 'd', 600);
  await wait(400);

  console.log('Guest moving Down (S)...');
  await pressKey(guestTab, 's', 400);
  await wait(400);

  console.log('Guest sprinting Left (Shift + A)...');
  await pressKeys(guestTab, ['ShiftLeft', 'a'], 600);
  await wait(400);

  console.log('Guest moving Up (W)...');
  await pressKey(guestTab, 'w', 400);
  await wait(400);

  console.log('\n--- 🏃 Demonstration: Switching to Tab 1 (Host) ---');
  await hostTab.bringToFront();
  await wait(600);

  console.log('Host observing Guest in the world, now Host moves Left (A)...');
  await pressKey(hostTab, 'a', 600);
  await wait(400);

  console.log('Host moves Down (S)...');
  await pressKey(hostTab, 's', 400);
  await wait(400);

  console.log('Host moves Right (D)...');
  await pressKey(hostTab, 'd', 600);
  await wait(400);

  console.log('Host moves Up (W)...');
  await pressKey(hostTab, 'w', 400);
  await wait(400);

  console.log('\n--- 🏃 Demonstration: Switching back to Tab 2 (Guest) ---');
  await guestTab.bringToFront();
  await wait(600);

  console.log('Guest jumping (Spacebar)...');
  await guestTab.keyboard.press('Space');
  await wait(500);

  console.log('Guest moving Right (D) towards Host...');
  await pressKey(guestTab, 'd', 600);
  await wait(500);

  console.log('\n✅ Demonstration complete! The browser window with both tabs remains open for you to play and test freely.');
  console.log(`Room Code: ${roomCode}`);
  console.log('Tab 1: Host Explorer');
  console.log('Tab 2: Guest Explorer');
  console.log('You can click between tabs and move with WASD or Arrow keys!\n');

  // Keep the process alive so the browser window stays open on screen
  await new Promise(() => {});
}

run().catch(err => {
  console.error('Error running browser demo:', err);
  process.exit(1);
});
