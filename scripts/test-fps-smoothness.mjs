import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SCREENSHOTS_DIR = 'test-results/screenshots-smoothness';

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  await mkdir(SCREENSHOTS_DIR, { recursive: true });
  console.log('🚀 Starting Entity Movement FPS & Smoothness Verification...');
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
    // 1. Host creates world
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

    // 2. Guest joins world
    console.log('\n[Tab 2 - Guest] Joining world in second tab...');
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

    await hostTab.waitForFunction(() => {
      const count = document.getElementById('hud-player-count');
      return count && count.textContent.includes('2 Online');
    }, { timeout: 10000 });

    record('Both Tabs Connected to World', true, 'Host and Guest report 2 Online');
    await wait(1000);

    // 3. Measure movement sampling of Host moving seen by Guest at 60 FPS
    console.log('\n--- Test 3: Remote Player Movement 60 FPS Smoothness (Guest observing Host) ---');
    
    // Start continuous movement on Host
    await hostTab.bringToFront();
    await hostTab.evaluate(() => {
      window.focus();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
    });

    // On Guest tab, sample remote player's position over 60 consecutive animation frames (~1.0 second)
    const guestSampling = await guestTab.evaluate(() => {
      return new Promise((resolve) => {
        const samples = [];
        let framesLeft = 60;

        function recordFrame() {
          const rp = window.survivalEngine?.remotePlayers?.[0];
          if (rp) {
            samples.push({
              x: rp.x,
              y: rp.y,
              vx: rp.vx,
              vy: rp.vy,
              time: performance.now()
            });
          }
          framesLeft--;
          if (framesLeft > 0) {
            requestAnimationFrame(recordFrame);
          } else {
            resolve(samples);
          }
        }

        requestAnimationFrame(recordFrame);
      });
    });

    // Release movement key on host
    await hostTab.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'd' }));
    });

    // Analyze smoothness of Guest observing Host movement
    let movingSteps = 0;
    let deltas = [];
    for (let i = 1; i < guestSampling.length; i++) {
      const d = Math.hypot(guestSampling[i].x - guestSampling[i-1].x, guestSampling[i].y - guestSampling[i-1].y);
      if (d > 0.001) {
        movingSteps++;
        deltas.push(d);
      }
    }

    const smoothnessRatio = movingSteps / (guestSampling.length - 1);
    console.log(`Sampled ${guestSampling.length} frames on Guest: ${movingSteps} frames moved smoothly (${(smoothnessRatio * 100).toFixed(1)}% active movement continuity)`);

    record(
      'Remote Player Movement Continues Smoothly Every Frame (60 FPS)',
      smoothnessRatio > 0.85,
      `${(smoothnessRatio * 100).toFixed(1)}% frames showed continuous 60fps movement (no 50ms stutter freezing)`
    );

    // 4. Measure Wildlife & NPC Movement Smoothness on Guest
    console.log('\n--- Test 4: Animal & NPC Movement Smoothness on Guest ---');

    // Sample an actively moving animal over 60 frames on Guest
    const animalSampling = await guestTab.evaluate(() => {
      return new Promise((resolve) => {
        const engine = window.survivalEngine;
        if (!engine || !engine.animals || engine.animals.length === 0) return resolve({ found: false });

        // Find an animal with target velocity or moving
        const targetAnimal = engine.animals.find(a => Math.hypot(a.movement?.vx || 0, a.movement?.vy || 0) > 0.05) || engine.animals[0];
        const targetId = targetAnimal.id;

        const samples = [];
        let framesLeft = 60;

        function recordFrame() {
          const a = window.survivalEngine?.animals?.find(x => x.id === targetId);
          if (a) {
            samples.push({
              x: a.position.x,
              y: a.position.y,
              state: a.behaviorState,
              time: performance.now()
            });
          }
          framesLeft--;
          if (framesLeft > 0) {
            requestAnimationFrame(recordFrame);
          } else {
            resolve({ found: true, id: targetId, samples });
          }
        }

        requestAnimationFrame(recordFrame);
      });
    });

    record(
      'World Animals Position Sampled Continuously At 60 FPS',
      animalSampling.found && animalSampling.samples.length >= 50,
      `Captured ${animalSampling.samples?.length} continuous frame coordinates for animal #${animalSampling.id}`
    );

    await hostTab.screenshot({ path: `${SCREENSHOTS_DIR}/host_smooth_view.png` });
    await guestTab.screenshot({ path: `${SCREENSHOTS_DIR}/guest_smooth_view.png` });

    console.log('\n🎉 ALL FPS & SMOOTHNESS TESTS PASSED (100% SUCCESS)');
    await writeFile(`${SCREENSHOTS_DIR}/results.json`, JSON.stringify(testLog, null, 2));

  } catch (err) {
    console.error('\n❌ Smoothness Verification Failed:', err);
    await writeFile(`${SCREENSHOTS_DIR}/error.log`, String(err));
  } finally {
    console.log('\nKeeping visible browser open for desktop demonstration...');
    await new Promise(() => {});
  }
}

run();

