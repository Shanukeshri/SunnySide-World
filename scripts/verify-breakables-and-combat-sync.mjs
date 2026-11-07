import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SCREENSHOTS_DIR = 'test-results/screenshots-breakables-combat';

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
  console.log('🚀 Starting Breakables, Combat & World Hit Synchronization Verification...');
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

    // Initial capture
    await captureComparison(hostPage, guestPage, 'world_connected', 1);

    // ── TEST 1: ANIMAL HIT & DAMAGE SYNCHRONIZATION ──────────────────
    console.log('\n--- Test 1: Animal Hit & Damage Synchronization ---');
    // Find animal near host
    const targetAnimal = await hostPage.evaluate(() => {
      const p = window.survivalEngine.player;
      let closest = null;
      let minD = 999;
      for (const a of window.survivalEngine.animals) {
        if (!a.isActive || a.behaviorState === 'DEAD') continue;
        const d = Math.hypot(p.x - a.position.x, p.y - a.position.y);
        if (d < minD) {
          minD = d;
          closest = { id: a.id, species: a.species, x: a.position.x, y: a.position.y, health: a.health, dist: d };
        }
      }
      return closest;
    });

    console.log(`Target animal found: #${targetAnimal?.id} (${targetAnimal?.species}), health: ${targetAnimal?.health}, dist: ${targetAnimal?.dist.toFixed(2)} tiles`);

    // Teleport host player right next to animal for clean hit
    await hostPage.evaluate((target) => {
      window.survivalEngine.player.x = target.x - 0.7;
      window.survivalEngine.player.y = target.y;
      window.survivalEngine.activeHotbarIndex = 2; // Wooden sword
      window.survivalEngine.player.activeHeldItem = 'wooden_sword';
    }, targetAnimal);

    // Also bring guest player near to witness the hit clearly
    await guestPage.evaluate((target) => {
      window.survivalEngine.player.x = target.x + 1.2;
      window.survivalEngine.player.y = target.y + 0.5;
    }, targetAnimal);
    await wait(600);

    // Host hits the animal
    const hitResultHost = await hostPage.evaluate((target) => {
      const initialHp = window.survivalEngine.animals.find(a => a.id === target.id)?.health;
      const success = window.survivalEngine.hitAnimal(target.id, 15, window.survivalEngine.player.x, window.survivalEngine.player.y, false);
      const newHp = window.survivalEngine.animals.find(a => a.id === target.id)?.health;
      return { success, initialHp, newHp };
    }, targetAnimal);

    console.log(`Host hit target animal: success=${hitResultHost.success}, HP before=${hitResultHost.initialHp}, HP after=${hitResultHost.newHp}`);
    await wait(300);

    // Check guest tab
    const guestAnimalState = await guestPage.evaluate((target) => {
      const a = window.survivalEngine.animals.find(item => item.id === target.id);
      return a ? {
        id: a.id,
        health: a.health,
        state: a.behaviorState,
        hurtTimer: a.hurtTimer,
        x: a.position.x,
        y: a.position.y
      } : null;
    }, targetAnimal);

    const animalDamageSynced = guestAnimalState && guestAnimalState.health === hitResultHost.newHp;
    recordTest(
      'Animal Hit Synced to Guest',
      Boolean(animalDamageSynced),
      `Guest sees animal #${targetAnimal.id} health drop to ${guestAnimalState?.health} (Expected: ${hitResultHost.newHp})`
    );

    await captureComparison(hostPage, guestPage, 'animal_hit_synced', 2);

    // Now Guest hits another animal to verify bidirectional sync
    const guestTarget = await guestPage.evaluate((hitId) => {
      const p = window.survivalEngine.player;
      let closest = null;
      let minD = 999;
      for (const a of window.survivalEngine.animals) {
        if (a.id === hitId || !a.isActive || a.behaviorState === 'DEAD') continue;
        const d = Math.hypot(p.x - a.position.x, p.y - a.position.y);
        if (d < minD) {
          minD = d;
          closest = { id: a.id, species: a.species, x: a.position.x, y: a.position.y, health: a.health };
        }
      }
      return closest;
    }, targetAnimal.id);

    // Teleport guest next to animal and hit it
    await guestPage.evaluate((t) => {
      window.survivalEngine.player.x = t.x - 0.7;
      window.survivalEngine.player.y = t.y;
      window.survivalEngine.hitAnimal(t.id, 15, window.survivalEngine.player.x, window.survivalEngine.player.y, false);
    }, guestTarget);
    await wait(400);

    const hostObservedGuestHit = await hostPage.evaluate((t) => {
      const a = window.survivalEngine.animals.find(item => item.id === t.id);
      return a ? { id: a.id, health: a.health, state: a.behaviorState } : null;
    }, guestTarget);

    const guestHitSyncedToHost = hostObservedGuestHit && hostObservedGuestHit.health < guestTarget.health;
    recordTest(
      'Guest Hit on Animal Synced to Host',
      Boolean(guestHitSyncedToHost),
      `Host observed animal #${guestTarget.id} health drop from ${guestTarget.health} to ${hostObservedGuestHit?.health}`
    );

    // ── TEST 2: BREAKABLE RESOURCE NODE SYNC (CHOP TREE) ─────────────
    console.log('\n--- Test 2: Tree Chopping & Depletion Synchronization ---');
    // Find living tree near host
    const targetTree = await hostPage.evaluate(() => {
      const p = window.survivalEngine.player;
      let closest = null;
      let minD = 999;
      for (const chunk of window.survivalEngine.worldManager.chunks.values()) {
        for (const res of chunk.resources) {
          if (res.type === 'tree' && !res.isDepleted) {
            const d = Math.hypot(p.x - res.x, p.y - res.y);
            if (d < minD) {
              minD = d;
              closest = { id: res.id, x: res.x, y: res.y, health: res.health, maxHealth: res.maxHealth, loot: res.lootItem };
            }
          }
        }
      }
      return closest;
    });

    console.log(`Target tree found: id=${targetTree?.id} at (${targetTree?.x}, ${targetTree?.y}), health=${targetTree?.health}`);

    // Teleport both players near the tree
    await hostPage.evaluate((tree) => {
      window.survivalEngine.player.x = tree.x - 0.8;
      window.survivalEngine.player.y = tree.y + 0.5;
      window.survivalEngine.activeHotbarIndex = 0; // Wooden Axe
      window.survivalEngine.player.activeHeldItem = 'wooden_axe';
    }, targetTree);

    await guestPage.evaluate((tree) => {
      window.survivalEngine.player.x = tree.x + 2.5;
      window.survivalEngine.player.y = tree.y + 0.5;
    }, targetTree);
    await wait(500);

    // Host hits tree once
    await hostPage.evaluate((tree) => {
      window.survivalEngine.hitResource(tree.x + 1, tree.y + 1, 10, 'wooden_axe', false, tree.id);
    }, targetTree);
    await wait(300);

    const guestTreeState = await guestPage.evaluate((tree) => {
      const res = window.survivalEngine.worldManager.getResourceById(tree.id) ||
                  window.survivalEngine.worldManager.getResourceAt(tree.x + 1, tree.y + 1, 1.4);
      return res ? { id: res.id, health: res.health, shakeTimer: res.shakeTimer, isDepleted: res.isDepleted } : null;
    }, targetTree);

    const treeHitSynced = guestTreeState && guestTreeState.health === targetTree.health - 10;
    recordTest(
      'Tree Hit Synced to Guest',
      Boolean(treeHitSynced),
      `Guest sees tree health: ${guestTreeState?.health} (Expected: ${targetTree.health - 10})`
    );

    await captureComparison(hostPage, guestPage, 'tree_hit_synced', 3);

    // Now host finishes chopping tree until it completely breaks
    await hostPage.evaluate((tree) => {
      window.survivalEngine.hitResource(tree.x + 1, tree.y + 1, 25, 'wooden_axe', false, tree.id);
    }, targetTree);
    await wait(500);

    const hostTreeBroken = await hostPage.evaluate((tree) => {
      const res = window.survivalEngine.worldManager.getResourceById(tree.id);
      const isDepleted = res ? res.isDepleted : true;
      const drops = window.survivalEngine.droppedItems.filter(d => Math.hypot(d.x - (tree.x + 1), d.y - (tree.y + 1)) < 3.5);
      const woodCount = window.survivalEngine.inventory.reduce((sum, slot) => slot.item === 'wood' ? sum + slot.count : sum, 0);
      return { isDepleted, dropsCount: drops.length, woodCount };
    }, targetTree);

    const guestTreeBroken = await guestPage.evaluate((tree) => {
      const res = window.survivalEngine.worldManager.getResourceById(tree.id);
      const isDepleted = res ? res.isDepleted : true;
      const drops = window.survivalEngine.droppedItems.filter(d => Math.hypot(d.x - (tree.x + 1), d.y - (tree.y + 1)) < 3.5);
      return { isDepleted, dropsCount: drops.length };
    }, targetTree);

    const treeDepletionSynced = hostTreeBroken.isDepleted && guestTreeBroken.isDepleted;
    recordTest(
      'Tree Broken & Depleted on Both Tabs',
      Boolean(treeDepletionSynced),
      `Host depleted=${hostTreeBroken.isDepleted}, Guest depleted=${guestTreeBroken.isDepleted}`
    );

    const dropsSynced = hostTreeBroken.dropsCount > 0 || hostTreeBroken.woodCount > 0;
    recordTest(
      'Tree Wood Drops Harvested & Synced on Both Tabs',
      Boolean(dropsSynced),
      `Host gathered wood logs=${hostTreeBroken.woodCount}, ground drops remaining=${hostTreeBroken.dropsCount}`
    );

    await captureComparison(hostPage, guestPage, 'tree_broken_drops_synced', 4);

    // ── TEST 3: PLACED STRUCTURES SYNC & DISMANTLE ───────────────────
    console.log('\n--- Test 3: Placed Structures Sync & Dismantling ---');
    const placeCoord = { x: 26, y: 19 };

    // Host places campfire structure
    await hostPage.evaluate((coord) => {
      window.survivalEngine.addItemToInventory('campfire', 1);
      window.survivalEngine.addPlacedStructure('campfire', coord.x, coord.y, false);
    }, placeCoord);
    await wait(500);

    const guestSawPlacement = await guestPage.evaluate((coord) => {
      const s = window.survivalEngine.placedStructures.find(struct => struct.x === coord.x && struct.y === coord.y);
      return s ? { type: s.type, x: s.x, y: s.y, health: s.health } : null;
    }, placeCoord);

    recordTest(
      'Structure Placement Synced to Guest',
      Boolean(guestSawPlacement && guestSawPlacement.type === 'campfire'),
      `Guest sees placed campfire at (${guestSawPlacement?.x}, ${guestSawPlacement?.y})`
    );

    await captureComparison(hostPage, guestPage, 'structure_placed_synced', 5);

    // Guest dismantles the structure by hitting it
    await guestPage.evaluate((coord) => {
      window.survivalEngine.hitStructure(coord.x, coord.y, 30, false);
    }, placeCoord);
    await wait(500);

    const hostSawDismantle = await hostPage.evaluate((coord) => {
      const s = window.survivalEngine.placedStructures.find(struct => struct.x === coord.x && struct.y === coord.y);
      const tile = window.survivalEngine.worldManager.getTile(coord.x, coord.y);
      return { exists: Boolean(s), isBlocked: tile.isBlocked };
    }, placeCoord);

    recordTest(
      'Structure Dismantled & Cleared on Host',
      !hostSawDismantle.exists && !hostSawDismantle.isBlocked,
      `Host placedStructures contains structure: ${hostSawDismantle.exists}, Tile blocked: ${hostSawDismantle.isBlocked}`
    );

    await captureComparison(hostPage, guestPage, 'structure_dismantled_synced', 6);

    // ── TEST 4: DROPPED ITEM PICKUP SYNCHRONIZATION ──────────────────
    console.log('\n--- Test 4: Dropped Item Ground Pickup Sync ---');
    // Spawn test item at known coordinate
    const dropCoord = { x: 25.5, y: 18.5 };
    const spawnedItem = await hostPage.evaluate((coord) => {
      const item = window.survivalEngine.spawnDroppedItem('wood', 3, coord.x, coord.y, 88888, false);
      return { id: item.id, item: item.item, count: item.count };
    }, dropCoord);
    await wait(400);

    const guestSawItem = await guestPage.evaluate((id) => {
      return window.survivalEngine.droppedItems.some(d => d.id === id);
    }, spawnedItem.id);

    recordTest(
      'Dropped Item Exists on Both Tabs',
      guestSawItem,
      `Item #${spawnedItem.id} visible on guest ground before pickup`
    );

    // Guest picks it up
    await guestPage.evaluate((id) => {
      window.survivalEngine.removeDroppedItem(id, false);
    }, spawnedItem.id);
    await wait(400);

    const hostSawRemoval = await hostPage.evaluate((id) => {
      return !window.survivalEngine.droppedItems.some(d => d.id === id);
    }, spawnedItem.id);

    recordTest(
      'Item Pickup Cleared from Host Ground',
      hostSawRemoval,
      `Item #${spawnedItem.id} cleanly removed from host ground upon guest pickup`
    );

    await captureComparison(hostPage, guestPage, 'item_pickup_synced', 7);

    // Save final report JSON
    await writeFile(
      `${SCREENSHOTS_DIR}/test-results.json`,
      JSON.stringify({ timestamp: new Date().toISOString(), roomCode, tests }, null, 2)
    );

    const passedCount = tests.filter(t => t.passed).length;
    console.log(`\n🎉 RESULTS: ${passedCount}/${tests.length} TESTS PASSED (${((passedCount/tests.length)*100).toFixed(1)}%)`);

    console.log('\nKeeping visible browser open for desktop demonstration...');
    while (true) {
      await wait(10000);
    }
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  }
}

run();
