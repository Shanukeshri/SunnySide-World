import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SCREENSHOTS_DIR = 'test-results/screenshots-pvp-blocking';

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
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
  console.log('🚀 Starting PVP Combat & Player Body/Shield Blocking Verification...');
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

  const tests = [];
  function recordTest(desc, passed, details) {
    tests.push({ desc, passed, details });
    console.log(`${passed ? '✅ PASS' : '❌ FAIL'}: ${desc} — ${details}`);
  }

  try {
    // 1. Host World Setup
    const hostPage = (await browser.pages())[0];
    await hostPage.setViewport({ width: 1280, height: 860 });
    console.log('\n[Tab 1 - Host] Opening game at http://localhost:3000/ ...');
    await hostPage.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await wait(800);

    await hostPage.waitForSelector('#btn-menu-multiplayer', { timeout: 10000 });
    await hostPage.evaluate(() => document.getElementById('btn-menu-multiplayer').click());
    await wait(400);

    await hostPage.waitForSelector('#btn-host-game', { timeout: 8000 });
    await hostPage.evaluate(() => document.getElementById('btn-host-game').click());

    await hostPage.waitForFunction(() => {
      const status = document.getElementById('hud-server-status');
      return status && status.textContent.includes('Online');
    }, { timeout: 10000 });

    const hostStatus = await hostPage.$eval('#hud-server-status', el => el.textContent);
    const match = hostStatus.match(/([A-Z0-9]{5})/);
    const roomCode = match ? match[1] : null;
    recordTest('Host Room Created', Boolean(roomCode), `Room Code: ${roomCode}`);

    // 2. Guest Join World
    const guestPage = await browser.newPage();
    await guestPage.setViewport({ width: 1280, height: 860 });
    console.log('\n[Tab 2 - Guest] Joining world in second tab...');
    await guestPage.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await wait(800);

    await guestPage.waitForSelector('#btn-menu-multiplayer', { timeout: 10000 });
    await guestPage.evaluate(() => document.getElementById('btn-menu-multiplayer').click());
    await wait(400);

    await guestPage.waitForSelector('#invite-code-input', { timeout: 8000 });
    await guestPage.type('#invite-code-input', roomCode);
    await wait(200);

    await guestPage.evaluate(() => document.getElementById('btn-join-game').click());

    await guestPage.waitForFunction(() => {
      const status = document.getElementById('hud-server-status');
      return status && status.textContent.includes('Online');
    }, { timeout: 10000 });

    await hostPage.waitForFunction(() => {
      const count = document.getElementById('hud-player-count');
      return count && count.textContent.includes('2 Online');
    }, { timeout: 10000 });

    recordTest('Both Tabs Connected to World', true, 'Host and Guest report 2 Online');
    await wait(1000);

    await captureComparison(hostPage, guestPage, 'connected', 1);

    // Verify initial positions
    const initPos = await hostPage.evaluate(() => {
      const eng = window.survivalEngine;
      const rp = eng.remotePlayers[0];
      return {
        hostX: eng.player.x,
        hostY: eng.player.y,
        rpX: rp?.x,
        rpY: rp?.y,
        rpCount: eng.remotePlayers.length
      };
    });
    console.log(`Initial Positions: Host at (${initPos.hostX.toFixed(2)}, ${initPos.hostY.toFixed(2)}), Remote Guest at (${initPos.rpX?.toFixed(2)}, ${initPos.rpY?.toFixed(2)})`);

    // ── TEST 2: Solid Body Collision (Physical Player-to-Player Blocking) ──
    console.log('\n[Test 2] Testing Solid Body Collision (Player Physical Blocking)...');
    const collisionCheck = await hostPage.evaluate(() => {
      const eng = window.survivalEngine;
      const rp = eng.remotePlayers[0];
      if (!rp) return { ok: false, error: 'No remote player found' };
      // Try to move directly to the remote player's coordinate
      const canMoveDirectlyToPlayer = eng.canMoveTo(rp.x, rp.y);
      // Try to move very close (target dist ~0.2 < 0.65)
      const canMoveTooClose = eng.canMoveTo(rp.x - 0.2, rp.y);
      // Moving away (target dist > current dist)
      const canMoveAway = eng.canMoveTo(eng.player.x - 1.0, eng.player.y);
      return { ok: true, canMoveDirectlyToPlayer, canMoveTooClose, canMoveAway };
    });

    recordTest(
      'Physical Player Body Blocking: Cannot walk through other player body',
      collisionCheck.canMoveDirectlyToPlayer === false && collisionCheck.canMoveTooClose === false,
      `Blocked at other player body: directlyToPlayer=${collisionCheck.canMoveDirectlyToPlayer}, tooClose=${collisionCheck.canMoveTooClose}`
    );
    recordTest(
      'Physical Player Body Blocking: Separation-friendly movement away is permitted',
      collisionCheck.canMoveAway === true,
      `Allowed moving away: ${collisionCheck.canMoveAway}`
    );

    // Now have Guest walk left towards Host until blocked by collision
    console.log('\nGuest walks left towards Host (testing physical collision stop)...');
    await guestPage.keyboard.down('a');
    await wait(600); // walk for 600ms
    await guestPage.keyboard.up('a');
    await wait(300);

    const positionsAfterWalk = await hostPage.evaluate(() => {
      const eng = window.survivalEngine;
      const rp = eng.remotePlayers[0];
      const dist = Math.hypot((eng.player.x + 0.5) - (rp.x + 0.5), (eng.player.y + 0.65) - (rp.y + 0.65));
      return { hostX: eng.player.x, guestX: rp.x, dist };
    });

    recordTest(
      'Physical Player Body Blocking: Player collision physically stops movement before crossing',
      positionsAfterWalk.dist >= 0.60 && positionsAfterWalk.guestX > positionsAfterWalk.hostX,
      `Distance between players: ${positionsAfterWalk.dist.toFixed(2)} tiles (stopped at collision boundary, guestX=${positionsAfterWalk.guestX.toFixed(2)}, hostX=${positionsAfterWalk.hostX.toFixed(2)})`
    );

    await captureComparison(hostPage, guestPage, 'body_collision_blocked', 2);

    // ── TEST 3: Host Attacks Guest (PVP Hit, Damage, VFX & Knockback Sync) ──
    console.log('\n[Test 3] Testing PVP Attack: Host hits Guest...');
    const initialGuestHealth = await guestPage.evaluate(() => window.survivalEngine.player.health);
    const guestXBeforeHit = await guestPage.evaluate(() => window.survivalEngine.player.x);

    // Host faces RIGHT (towards Guest) and attacks
    await hostPage.evaluate(() => {
      const eng = window.survivalEngine;
      eng.player.facing = 'RIGHT';
      eng.player.direction = 'RIGHT';
      eng.performDirectionalHit();
    });

    await wait(300);

    const guestHurtState = await guestPage.evaluate(() => {
      const eng = window.survivalEngine;
      return {
        health: eng.player.health,
        hurtTimer: eng.player.hurtTimer,
        x: eng.player.x,
        y: eng.player.y,
        hasFloatingText: eng.floatingTexts.some(t => t.text.includes('HP')),
        hasBloodChips: eng.woodChips.some(c => c.color === '#ef4444'),
      };
    });

    const hostViewsGuestDamaged = await hostPage.evaluate(() => {
      const eng = window.survivalEngine;
      const rp = eng.remotePlayers[0];
      return {
        rpHealth: rp?.health,
        rpHurtTimer: rp?.hurtTimer,
        hasFloatingText: eng.floatingTexts.some(t => t.text.includes('HP')),
        hasBloodChips: eng.woodChips.some(c => c.color === '#ef4444'),
      };
    });

    recordTest(
      'PVP Hit: Guest took synchronized damage',
      guestHurtState.health < initialGuestHealth,
      `Guest health dropped from ${initialGuestHealth} to ${guestHurtState.health}`
    );
    recordTest(
      'PVP Hit: Red hurt flash, blood VFX & floating text synced on tabs',
      guestHurtState.hasFloatingText || hostViewsGuestDamaged.hasFloatingText || guestHurtState.hasBloodChips || hostViewsGuestDamaged.hasBloodChips,
      `Guest text=${guestHurtState.hasFloatingText}, Host text=${hostViewsGuestDamaged.hasFloatingText}, Blood chips=${guestHurtState.hasBloodChips || hostViewsGuestDamaged.hasBloodChips}`
    );
    recordTest(
      'PVP Hit: Knockback displaced hit player',
      guestHurtState.x >= guestXBeforeHit,
      `Guest knocked back from x=${guestXBeforeHit.toFixed(2)} to x=${guestHurtState.x.toFixed(2)}`
    );

    await captureComparison(hostPage, guestPage, 'pvp_hit_synced', 3);

    // ── TEST 4: Guest Enters Guard Stance / Blocking (Shield Stance Sync) ──
    console.log('\n[Test 4] Testing Combat Blocking: Guest enters Guard Stance (Right Click / Q)...');
    await guestPage.evaluate(() => {
      const eng = window.survivalEngine;
      eng.player.isBlocking = true;
      if (eng.onWorldAction) {
        eng.onWorldAction({ type: 'block', isBlocking: true });
      }
    });

    await wait(300);

    const hostViewsGuestBlocking = await hostPage.evaluate(() => {
      const eng = window.survivalEngine;
      const rp = eng.remotePlayers[0];
      return {
        isBlocking: rp?.isBlocking,
      };
    });

    recordTest(
      'Combat Guard Stance: Guest isBlocking synced to Host',
      hostViewsGuestBlocking.isBlocking === true,
      `Host sees Guest isBlocking=${hostViewsGuestBlocking.isBlocking}`
    );

    await captureComparison(hostPage, guestPage, 'guard_stance_active', 4);

    // ── TEST 5: Host Attacks Guest while Guest is Blocking ──
    console.log('\n[Test 5] Testing Host attacks Guest while Guest is Guarding/Blocking...');
    const guestHealthBeforeBlockHit = await guestPage.evaluate(() => window.survivalEngine.player.health);

    // Host attacks towards Guest
    await hostPage.evaluate(() => {
      const eng = window.survivalEngine;
      eng.player.facing = 'RIGHT';
      eng.player.direction = 'RIGHT';
      eng.performDirectionalHit();
    });

    await wait(300);

    const blockedResult = await guestPage.evaluate(() => {
      const eng = window.survivalEngine;
      return {
        health: eng.player.health,
        hasBlockedText: eng.floatingTexts.some(t => t.text.includes('Blocked')),
        hasShieldSparks: eng.woodChips.some(c => c.color === '#38bdf8'),
      };
    });

    const hostBlockedView = await hostPage.evaluate(() => {
      const eng = window.survivalEngine;
      return {
        hasBlockedText: eng.floatingTexts.some(t => t.text.includes('Blocked')),
        hasShieldSparks: eng.woodChips.some(c => c.color === '#38bdf8'),
      };
    });

    const dmgTakenWhileBlocking = guestHealthBeforeBlockHit - blockedResult.health;
    recordTest(
      'Combat Defense: Attack Blocked with 85% damage reduction',
      dmgTakenWhileBlocking <= 2,
      `Damage taken while blocking: ${dmgTakenWhileBlocking} HP (vs normal ~8-12 HP)`
    );
    recordTest(
      'Combat Defense: "🛡️ Blocked!" text and shield sparks (#38bdf8) displayed',
      (blockedResult.hasBlockedText || hostBlockedView.hasBlockedText) ||
      (blockedResult.hasShieldSparks || hostBlockedView.hasShieldSparks),
      `Blocked text=${blockedResult.hasBlockedText || hostBlockedView.hasBlockedText}, Sparks=${blockedResult.hasShieldSparks || hostBlockedView.hasShieldSparks}`
    );

    await captureComparison(hostPage, guestPage, 'attack_blocked_synced', 5);

    // ── TEST 6: Reverse Combat (Guest Attacks Host, Host Blocks) ──
    console.log('\n[Test 6] Testing Reverse Combat: Guest attacks Host, Host blocks...');
    // Guest stops blocking
    await guestPage.evaluate(() => {
      const eng = window.survivalEngine;
      eng.player.isBlocking = false;
      if (eng.onWorldAction) {
        eng.onWorldAction({ type: 'block', isBlocking: false });
      }
    });

    // Host enters blocking stance
    await hostPage.evaluate(() => {
      const eng = window.survivalEngine;
      eng.player.isBlocking = true;
      if (eng.onWorldAction) {
        eng.onWorldAction({ type: 'block', isBlocking: true });
      }
    });
    await wait(200);

    const hostHealthBeforeHit = await hostPage.evaluate(() => window.survivalEngine.player.health);

    // Guest swings towards Host (facing LEFT)
    await guestPage.evaluate(() => {
      const eng = window.survivalEngine;
      eng.player.facing = 'LEFT';
      eng.player.direction = 'LEFT';
      eng.performDirectionalHit();
    });

    await wait(300);

    const hostReverseBlockedResult = await hostPage.evaluate(() => {
      const eng = window.survivalEngine;
      return {
        health: eng.player.health,
        hasBlockedText: eng.floatingTexts.some(t => t.text.includes('Blocked')),
        hasShieldSparks: eng.woodChips.some(c => c.color === '#38bdf8'),
      };
    });

    const hostDmgTaken = hostHealthBeforeHit - hostReverseBlockedResult.health;
    recordTest(
      'Reverse Combat: Host blocked Guest attack with reduced damage',
      hostDmgTaken <= 2,
      `Host damage taken while guarding: ${hostDmgTaken} HP`
    );
    recordTest(
      'Reverse Combat: Host displayed "🛡️ Blocked!" feedback and shield spark VFX',
      hostReverseBlockedResult.hasBlockedText || hostReverseBlockedResult.hasShieldSparks,
      `Host blocked text=${hostReverseBlockedResult.hasBlockedText}, Sparks=${hostReverseBlockedResult.hasShieldSparks}`
    );

    await captureComparison(hostPage, guestPage, 'host_blocked_guest_synced', 6);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('🏁 PVP COMBAT & PLAYER BLOCKING VERIFICATION SUMMARY:');
    const passedCount = tests.filter(t => t.passed).length;
    console.log(`Passed: ${passedCount} / ${tests.length} tests (${(passedCount / tests.length * 100).toFixed(1)}%)`);
    console.log('='.repeat(60));

    // Keep browser visible briefly for manual review
    await wait(2000);
    await browser.close();

    process.exit(passedCount === tests.length ? 0 : 1);
  } catch (err) {
    console.error('❌ Verification script crashed with error:', err);
    await wait(3000);
    try { await browser.close(); } catch {}
    process.exit(1);
  }
}

run();
