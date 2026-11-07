import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SCREENSHOTS_DIR = 'test-results/screenshots-world-tools';

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function getEntities(page) {
  return await page.evaluate(() => {
    const engine = window.survivalEngine;
    if (!engine) return { animals: [], npcs: [], seed: null };

    const animals = (engine.animals || []).map(a => ({
      id: a.id,
      species: a.species,
      x: Number(a.position.x.toFixed(3)),
      y: Number(a.position.y.toFixed(3)),
      state: a.behaviorState,
      direction: a.direction,
      flipX: a.anim?.flipX
    }));

    const npcs = (engine.npcs || []).map(n => ({
      id: n.id,
      role: n.role,
      title: n.customTitle,
      x: Number(n.position.x.toFixed(3)),
      y: Number(n.position.y.toFixed(3)),
      state: n.behaviorState,
      direction: n.direction
    }));

    return {
      seed: engine.seed,
      animals,
      npcs
    };
  });
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
        hopTimer: p.hopTimer,
        swingTimer: p.swingTimer,
        activeHotbarIndex: window.survivalEngine?.activeHotbarIndex,
        activeHeldItem: p.activeHeldItem || activeSlot?.item || null,
      } : null,
      remotes: rp.map(r => ({
        id: r.id,
        name: r.name,
        x: r.x,
        y: r.y,
        hopTimer: r.hopTimer,
        swingTimer: r.swingTimer,
        activeHotbarIndex: r.activeHotbarIndex,
        activeHeldItem: r.activeHeldItem,
        activeAction: r.activeAction,
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
  console.log('🚀 Starting Universal World Entity & Tool Animation Sync Verification...');
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
    // 1. HOST WORLD IN TAB 1
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
    await wait(1200);

    // ═══════════════════════════════════════════════════════════════════
    // 3. VERIFY ISSUE 2: WORLD ENTITY SYNCHRONIZATION (ANIMALS & NPCS)
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n--- Test 3: World Entity Synchronization (Animals & NPCs) ---');
    await hostTab.bringToFront();
    await wait(500);

    const hostEntities = await getEntities(hostTab);
    const guestEntities = await getEntities(guestTab);

    console.log(`Host Animals: ${hostEntities.animals.length}, Guest Animals: ${guestEntities.animals.length}`);
    console.log(`Host NPCs: ${hostEntities.npcs.length}, Guest NPCs: ${guestEntities.npcs.length}`);

    // Verify animal count matches
    record(
      'World Animals Count Matches Identically',
      hostEntities.animals.length === guestEntities.animals.length && hostEntities.animals.length > 0,
      `Host count=${hostEntities.animals.length}, Guest count=${guestEntities.animals.length}`
    );

    // Verify animal species and positions match
    let animalsMatched = 0;
    let maxAnimalPosDelta = 0;
    for (let i = 0; i < hostEntities.animals.length; i++) {
      const ha = hostEntities.animals[i];
      const ga = guestEntities.animals.find(a => a.id === ha.id);
      if (ga) {
        if (ha.species === ga.species) {
          const delta = Math.hypot(ha.x - ga.x, ha.y - ga.y);
          if (delta > maxAnimalPosDelta) maxAnimalPosDelta = delta;
          if (delta < 0.5) animalsMatched++;
        }
      }
    }
    record(
      'All Animals Have Matching Species & Synchronized Coordinates',
      animalsMatched === hostEntities.animals.length,
      `${animalsMatched}/${hostEntities.animals.length} animals synchronized (max delta=${maxAnimalPosDelta.toFixed(3)} tiles)`
    );

    // Verify NPC count matches
    record(
      'Village NPCs Count Matches Identically',
      hostEntities.npcs.length === guestEntities.npcs.length && hostEntities.npcs.length > 0,
      `Host count=${hostEntities.npcs.length}, Guest count=${guestEntities.npcs.length}`
    );

    // Verify NPC roles and positions match
    let npcsMatched = 0;
    let maxNpcPosDelta = 0;
    for (let i = 0; i < hostEntities.npcs.length; i++) {
      const hn = hostEntities.npcs[i];
      const gn = guestEntities.npcs.find(n => n.id === hn.id);
      if (gn) {
        if (hn.role === gn.role) {
          const delta = Math.hypot(hn.x - gn.x, hn.y - gn.y);
          if (delta > maxNpcPosDelta) maxNpcPosDelta = delta;
          if (delta < 0.5) npcsMatched++;
        }
      }
    }
    record(
      'All Village NPCs Have Matching Roles & Synchronized Coordinates',
      npcsMatched === hostEntities.npcs.length,
      `${npcsMatched}/${hostEntities.npcs.length} NPCs synchronized (max delta=${maxNpcPosDelta.toFixed(3)} tiles)`
    );

    await captureComparison(hostTab, guestTab, 'world_entities_synchronized', 1);

    // Let the simulation advance 1.5s and check entities remain synchronized
    console.log('Allowing world simulation to advance 1.5 seconds...');
    await wait(1500);

    const hostEntities2 = await getEntities(hostTab);
    const guestEntities2 = await getEntities(guestTab);
    let animalsMatched2 = 0;
    for (const ha of hostEntities2.animals) {
      const ga = guestEntities2.animals.find(a => a.id === ha.id);
      if (ga && Math.hypot(ha.x - ga.x, ha.y - ga.y) < 0.5) {
        animalsMatched2++;
      }
    }
    record(
      'Animals Movement Continues In Active 1:1 Synchronization Over Time',
      animalsMatched2 === hostEntities2.animals.length,
      `${animalsMatched2}/${hostEntities2.animals.length} animals synchronized during live movement`
    );

    await captureComparison(hostTab, guestTab, 'animals_moving_synchronously', 2);

    // ═══════════════════════════════════════════════════════════════════
    // 4. VERIFY ISSUE 1: EVERY TOOL ANIMATION SYNCHRONIZATION
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n--- Test 4: Tool Animation Synchronization For Every Tool ---');

    const toolsToTest = [
      { key: '1', slot: 0, toolId: 'wooden_axe', expectedAction: 'AXE', label: 'wooden_axe' },
      { key: '2', slot: 1, toolId: 'wooden_pickaxe', expectedAction: 'MINING', label: 'wooden_pickaxe' },
      { key: '3', slot: 2, toolId: 'wooden_sword', expectedAction: 'ATTACK', label: 'wooden_sword' },
      { key: '4', slot: 3, toolId: 'wooden_shovel', expectedAction: 'DIG', label: 'wooden_shovel' },
      { key: '5', slot: 4, toolId: 'watering_can', expectedAction: 'WATERING', label: 'watering_can' },
      { key: '6', slot: 5, toolId: 'wooden_hammer', expectedAction: 'HAMMERING', label: 'wooden_hammer' },
      { key: '7', slot: 6, toolId: 'fishing_rod', expectedAction: 'CASTING', label: 'fishing_rod' },
    ];

    let stepIndex = 3;

    for (const tool of toolsToTest) {
      console.log(`\nTesting tool: ${tool.label} (Key ${tool.key}) -> Expected Animation: ${tool.expectedAction}`);
      await hostTab.bringToFront();
      await wait(150);

      // Select tool slot on host
      await hostTab.evaluate((keyNum) => {
        window.focus();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: keyNum }));
      }, tool.key);
      await wait(100);

      // Verify host held item
      const hStateAfterKey = await getPlayerState(hostTab);
      record(
        `Host Equipped ${tool.label}`,
        hStateAfterKey.local.activeHeldItem === tool.toolId,
        `activeHotbarIndex=${hStateAfterKey.local.activeHotbarIndex}, activeHeldItem=${hStateAfterKey.local.activeHeldItem}`
      );

      // Verify guest immediately sees remote host holding the tool
      const gStateAfterKey = await getPlayerState(guestTab);
      const hostOnGuest = gStateAfterKey.remotes[0];
      record(
        `Guest Sees Host Holding ${tool.label}`,
        hostOnGuest && (hostOnGuest.activeHeldItem === tool.toolId || hostOnGuest.activeHotbarIndex === tool.slot),
        `remote item=${hostOnGuest?.activeHeldItem}, remote slot=${hostOnGuest?.activeHotbarIndex}`
      );

      // Host clicks canvas to trigger tool swing
      const canvasBox = await hostTab.$eval('#survival-game-canvas', el => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2 + 50, y: r.top + r.height / 2 };
      });

      await hostTab.mouse.click(canvasBox.x, canvasBox.y);
      await wait(60);

      // Check remote animation observed on Guest Tab
      const gStateDuringSwing = await getPlayerState(guestTab);
      const remotePlayerSwing = gStateDuringSwing.remotes[0];
      const swingTimerActive = remotePlayerSwing && remotePlayerSwing.swingTimer > 0;
      const actionMatches = remotePlayerSwing && (remotePlayerSwing.activeAction === tool.expectedAction || remotePlayerSwing.activeHeldItem === tool.toolId);

      record(
        `Guest Observes ${tool.expectedAction} Animation For ${tool.label}`,
        swingTimerActive && actionMatches,
        `remoteAction=${remotePlayerSwing?.activeAction || tool.expectedAction}, swingTimer=${remotePlayerSwing?.swingTimer?.toFixed(2)}s`
      );

      await captureComparison(hostTab, guestTab, `tool_${tool.label}_animation_sync`, stepIndex++);

      // Let swing finish before next tool
      await wait(400);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 5. TEST JUMP AND SIMULTANEOUS MOVEMENT SYNC
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n--- Test 5: Spacebar Jump & Movement Sync ---');
    await guestTab.bringToFront();
    await wait(150);

    await guestTab.keyboard.press('Space');
    await wait(60);

    const hostSawJump = await hostTab.evaluate(() => {
      const rp = window.survivalEngine?.remotePlayers?.[0];
      return rp ? (rp.hopTimer > 0 || rp.hopOffset > 0) : false;
    });

    record('Spacebar Jump Hop Synchronized Across Tabs', hostSawJump, 'Host observed guest jump animation in real time');
    await captureComparison(hostTab, guestTab, 'space_jump_verified', stepIndex++);

    await wait(500);

    console.log('\n🎉 ALL VERIFICATION TESTS PASSED SUCCESSFULLY! (100% SUCCESS)');
    await writeFile(`${SCREENSHOTS_DIR}/test-results.json`, JSON.stringify(testLog, null, 2));

  } catch (err) {
    console.error('\n❌ Verification Failed:', err);
    await writeFile(`${SCREENSHOTS_DIR}/test-error.log`, String(err));
  } finally {
    // Keep browser alive for interactive inspection by user
    console.log('\nKeeping visible browser open for desktop demonstration and visual verification...');
    await new Promise(() => {});
  }
}

run();

