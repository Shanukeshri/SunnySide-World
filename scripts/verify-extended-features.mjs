import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUTPUT_DIR = 'test-results/browser-verification';

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  console.log('🧪 Starting Verification of Extended Features in Chrome...\n');

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

    await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 15000 });
    await wait(1200);

    // Click Single Player to launch survival game
    console.log('--- Launching Single Player Game ---');
    await page.click('#btn-menu-singleplayer');
    await wait(2000);

    // ────────────────────────────────────────────────────────────────
    // TEST 1: Camera Shake on Jump & Tool-Specific Camera Shakes
    // ────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 1: Jump Camera Shake & Tool-Specific Impact Shakes ---');
    const shakeTestResults = await page.evaluate(() => {
      const engine = window.survivalEngine;
      if (!engine) return { error: 'No survival engine' };

      // 1. Test jump stationary
      engine.player.vx = 0;
      engine.player.vy = 0;
      engine.jump();
      const stationaryShake = {
        timer: engine.screenShakeTimer,
        intensity: engine.screenShakeIntensity,
        duration: engine.screenShakeDuration,
      };

      // 2. Test jump while running
      engine.player.hopTimer = 0; // reset hop
      engine.player.vx = 3.5;
      engine.player.vy = 0;
      engine.jump();
      const movingShake = {
        timer: engine.screenShakeTimer,
        intensity: engine.screenShakeIntensity,
        duration: engine.screenShakeDuration,
      };
      // Reset velocity
      engine.player.vx = 0;
      engine.player.vy = 0;

      // 3. Test tool-specific impact shakes
      engine.triggerToolImpactShake('pickaxe');
      const pickaxeShake = { intensity: engine.screenShakeIntensity, duration: engine.screenShakeDuration };

      engine.triggerToolImpactShake('axe');
      const axeShake = { intensity: engine.screenShakeIntensity, duration: engine.screenShakeDuration };

      engine.triggerToolImpactShake('iron_sword');
      const swordShake = { intensity: engine.screenShakeIntensity, duration: engine.screenShakeDuration };

      engine.triggerToolImpactShake('shovel');
      const shovelShake = { intensity: engine.screenShakeIntensity, duration: engine.screenShakeDuration };

      engine.triggerToolImpactShake('hammer');
      const hammerShake = { intensity: engine.screenShakeIntensity, duration: engine.screenShakeDuration };

      engine.triggerToolImpactShake('bare_hands');
      const handsShake = { intensity: engine.screenShakeIntensity, duration: engine.screenShakeDuration };

      // 4. Test tool swing durations
      const prevActive = engine.getActiveItemSlot();
      engine.hotbar[0] = { item: 'pickaxe', count: 1 };
      engine.activeHotbarIndex = 0;
      engine.performDirectionalHit();
      const pickaxeSwingDur = engine.player.swingDuration;

      engine.hotbar[0] = { item: 'axe', count: 1 };
      engine.performDirectionalHit();
      const axeSwingDur = engine.player.swingDuration;

      engine.hotbar[0] = { item: 'shovel', count: 1 };
      engine.performDirectionalHit();
      const shovelSwingDur = engine.player.swingDuration;

      return {
        stationaryShake,
        movingShake,
        pickaxeShake,
        axeShake,
        swordShake,
        shovelShake,
        hammerShake,
        handsShake,
        pickaxeSwingDur,
        axeSwingDur,
        shovelSwingDur,
      };
    });

    console.log('Shake test results:', shakeTestResults);
    if (shakeTestResults.movingShake.intensity <= shakeTestResults.stationaryShake.intensity) {
      failures.push('Moving jump shake intensity is not higher than stationary jump shake');
    }
    if (shakeTestResults.pickaxeShake.intensity <= shakeTestResults.shovelShake.intensity) {
      failures.push('Pickaxe shake is not heavier than shovel shake');
    }
    if (shakeTestResults.pickaxeSwingDur < 0.35 || shakeTestResults.axeSwingDur < 0.35) {
      failures.push('Tool swing animations are not slowed down (expected >= 0.35s)');
    }

    // ────────────────────────────────────────────────────────────────
    // TEST 2: Harvesting Crops & Permanent Removal from Farms
    // ────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 2: Harvesting Crops and Removal from Farm Cells ---');
    const cropTestResults = await page.evaluate(() => {
      const engine = window.survivalEngine;
      const wm = engine.worldManager;

      // Find a village farm cell with a crop
      let foundCrop = null;
      if (wm.villages) {
        for (const v of wm.villages) {
          if (v.data?.farms) {
            for (const f of v.data.farms) {
              for (const c of f.cells) {
                if (c.cropId) {
                  foundCrop = {
                    gridX: v.gridX + c.x,
                    gridY: v.gridY + c.y,
                    cropId: c.cropId,
                  };
                  break;
                }
              }
              if (foundCrop) break;
            }
          }
          if (foundCrop) break;
        }
      }

      if (!foundCrop) {
        // If no pre-existing village crop, manually plant one to test harvesting
        if (wm.villages && wm.villages.length > 0 && wm.villages[0].data?.farms?.length > 0) {
          const farm = wm.villages[0].data.farms[0];
          const c = farm.cells[0];
          c.cropId = 'crop_wheat';
          foundCrop = {
            gridX: wm.villages[0].gridX + c.x,
            gridY: wm.villages[0].gridY + c.y,
            cropId: 'crop_wheat',
          };
        }
      }

      if (!foundCrop) return { error: 'Could not find or create farm crop' };

      // Teleport player near crop
      engine.player.x = foundCrop.gridX;
      engine.player.y = foundCrop.gridY + 1;

      // Check crop existence before harvest
      const beforeCropId = foundCrop.cropId;

      // Harvest crop via removeCropAt and simulate hitResource
      wm.removeCropAt(foundCrop.gridX, foundCrop.gridY);
      engine.spawnDroppedItem('wheat', 2, foundCrop.gridX + 0.5, foundCrop.gridY + 0.5);

      // Verify cell.cropId is now empty string ""
      let afterCropId = 'NOT_FOUND';
      for (const v of wm.villages) {
        if (v.data?.farms) {
          for (const f of v.data.farms) {
            for (const c of f.cells) {
              if (v.gridX + c.x === foundCrop.gridX && v.gridY + c.y === foundCrop.gridY) {
                afterCropId = c.cropId;
              }
            }
          }
        }
      }

      const droppedWheat = engine.droppedItems.filter((d) => d.item === 'wheat');

      return {
        foundCrop,
        beforeCropId,
        afterCropId,
        droppedWheatCount: droppedWheat.length,
      };
    });

    console.log('Crop test results:', cropTestResults);
    if (cropTestResults.afterCropId !== '') {
      failures.push(`Crop was not removed from farm cell (afterCropId was '${cropTestResults.afterCropId}', expected '')`);
    }

    await wait(300);
    await page.screenshot({ path: `${OUTPUT_DIR}/07_harvested_crop_removed.png` });
    console.log('📸 Saved 07_harvested_crop_removed.png');

    // ────────────────────────────────────────────────────────────────
    // TEST 3: Night Villager Sleep Schedule vs Village Guard Patrol
    // ────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 3: Night Villager Sleep vs Guard Patrol ---');
    const nightSleepResults = await page.evaluate(() => {
      const engine = window.survivalEngine;

      // Set world time to Night (Hour 23)
      engine.worldTime.timeOfDay = 'Night';
      engine.worldTime.hour = 23;
      engine.worldTime.minute = 15;
      engine.worldTime.lightLevel = 0.18;

      // Advance AI
      for (let i = 0; i < 15; i++) {
        engine.updateLifeforms(0.2);
      }

      const villagers = engine.npcs.filter((n) => n.role !== 'guard');
      const guards = engine.npcs.filter((n) => n.role === 'guard');

      const sleepingVillagers = villagers.filter((n) => n.isSleeping || n.scheduleState === 'SLEEP');
      const awakeGuards = guards.filter((n) => !n.isSleeping && n.scheduleState !== 'SLEEP');

      return {
        totalNPCs: engine.npcs.length,
        totalVillagers: villagers.length,
        sleepingVillagersCount: sleepingVillagers.length,
        totalGuards: guards.length,
        awakeGuardsCount: awakeGuards.length,
        guardRoles: guards.map((g) => ({ role: g.role, title: g.customTitle, isSleeping: g.isSleeping, schedule: g.scheduleState })),
      };
    });

    console.log('Night sleep results:', nightSleepResults);
    if (nightSleepResults.totalGuards > 0 && nightSleepResults.awakeGuardsCount === 0) {
      failures.push('Village guard fell asleep at night (guard must stay awake to patrol)');
    }
    if (nightSleepResults.sleepingVillagersCount === 0) {
      failures.push('No villagers went to sleep at night');
    }

    await wait(300);
    await page.screenshot({ path: `${OUTPUT_DIR}/08_night_villagers_sleeping_guard_patrol.png` });
    console.log('📸 Saved 08_night_villagers_sleeping_guard_patrol.png');

    // ────────────────────────────────────────────────────────────────
    // TEST 4: Hostile Enemies (Skeletons & Goblins) Spawning & Functioning
    // ────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 4: Hostile Skeletons and Enemies at Night ---');
    const enemyTestResults = await page.evaluate(() => {
      const engine = window.survivalEngine;

      // Force spawn a night enemy wave
      engine.spawnNightEnemyWave();
      engine.spawnNightEnemyWave();

      const skeletons = engine.enemies.filter((e) => e.type === 'skeleton');
      const goblins = engine.enemies.filter((e) => e.type === 'goblin');

      // Teleport skeleton near player to test AI chase
      if (skeletons.length > 0) {
        skeletons[0].x = engine.player.x + 3;
        skeletons[0].y = engine.player.y;
      }

      // Update enemies for a few frames
      for (let i = 0; i < 5; i++) {
        engine.updateEnemies(0.1);
      }

      const chasingEnemies = engine.enemies.filter((e) => e.state === 'CHASE');

      return {
        totalEnemies: engine.enemies.length,
        skeletonCount: skeletons.length,
        goblinCount: goblins.length,
        chasingCount: chasingEnemies.length,
        firstSkeletonState: skeletons[0]?.state,
      };
    });

    console.log('Enemy test results:', enemyTestResults);
    if (enemyTestResults.skeletonCount === 0) {
      failures.push('No skeletons spawned during night waves');
    }
    if (enemyTestResults.firstSkeletonState !== 'CHASE') {
      failures.push(`Skeleton near player did not enter CHASE state (state was ${enemyTestResults.firstSkeletonState})`);
    }

    await wait(300);
    await page.screenshot({ path: `${OUTPUT_DIR}/09_night_skeletons_and_goblins.png` });
    console.log('📸 Saved 09_night_skeletons_and_goblins.png');

    // ────────────────────────────────────────────────────────────────
    // TEST 5: Villagers & NPCs Damaged and Fighting Back
    // ────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 5: NPCs Damaged and Fighting Back ---');
    const npcCombatResults = await page.evaluate(() => {
      const engine = window.survivalEngine;

      if (engine.npcs.length === 0) return { error: 'No NPCs to test' };

      const targetNpc = engine.npcs[0];
      const initialHealth = targetNpc.health || 50;

      // Hit NPC
      engine.hitNPC(targetNpc.id, 12, engine.player.x, engine.player.y, false);

      const healthAfterHit = targetNpc.health;
      const combatTarget = targetNpc.combatTarget;
      const expression = targetNpc.currentExpression;

      // Check if nearby guards alerted
      const alertedGuards = engine.npcs.filter((n) => n.role === 'guard' && n.combatTarget?.type === 'player');

      // Simulate NPC retaliating
      let npcAttacked = false;
      targetNpc.position.x = engine.player.x + 0.5;
      targetNpc.position.y = engine.player.y + 0.5;
      const playerHealthBefore = engine.player.health;
      targetNpc.attackCooldown = 0;
      targetNpc.updateAI(0.1, engine.detector, engine.worldTime, engine.worldManager);

      return {
        initialHealth,
        healthAfterHit,
        tookDamage: healthAfterHit < initialHealth,
        hasCombatTarget: !!combatTarget,
        combatTargetType: combatTarget?.type,
        expressionType: expression?.type,
        alertedGuardsCount: alertedGuards.length,
        npcBehaviorState: targetNpc.behaviorState,
      };
    });

    console.log('NPC combat results:', npcCombatResults);
    if (!npcCombatResults.tookDamage) {
      failures.push('NPC did not take damage when attacked');
    }
    if (!npcCombatResults.hasCombatTarget || npcCombatResults.combatTargetType !== 'player') {
      failures.push('NPC did not target player to fight back after being damaged');
    }

    await wait(300);
    await page.screenshot({ path: `${OUTPUT_DIR}/10_npc_damaged_retaliation.png` });
    console.log('📸 Saved 10_npc_damaged_retaliation.png');

    // ────────────────────────────────────────────────────────────────
    // TEST 6: Fishing Animation Machine - Rod Stays in Water
    // ────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 6: Fishing Rod Animation Stays in Water ---');
    const fishingResults = await page.evaluate(() => {
      const engine = window.survivalEngine;

      // Equip fishing rod in hotbar
      engine.hotbar[0] = { item: 'fishing_rod', count: 1 };
      engine.activeHotbarIndex = 0;

      // Find nearby water tile
      let waterTile = null;
      for (let dx = -10; dx <= 10; dx++) {
        for (let dy = -10; dy <= 10; dy++) {
          const tx = Math.floor(engine.player.x) + dx;
          const ty = Math.floor(engine.player.y) + dy;
          const t = engine.worldManager.getTile(tx, ty);
          if (t && t.isWater) {
            waterTile = { x: tx, y: ty };
            break;
          }
        }
        if (waterTile) break;
      }

      if (!waterTile) {
        // If no natural water nearby, set adjacent tile to water for test
        const tx = Math.floor(engine.player.x) + 2;
        const ty = Math.floor(engine.player.y);
        const t = engine.worldManager.getTile(tx, ty);
        t.isWater = true;
        waterTile = { x: tx, y: ty };
      }

      // 1. Cast into water
      engine.handleWorldClick(waterTile.x, waterTile.y);
      const castState = engine.player.fishingState;
      const castTarget = engine.player.fishingTarget;

      // 2. Advance time past CASTING duration (0.8s) -> should transition to WAITING and STAY
      engine.player.fishingTimer = 0.05;
      engine.updatePlayerMovement(0.1);
      const waitingState = engine.player.fishingState;
      const waitTimer = engine.player.fishingWaitTimer;

      // 3. Ensure it STAYS in WAITING for another 0.5s without auto-chaining
      engine.updatePlayerMovement(0.5);
      const stillWaitingState = engine.player.fishingState;

      // 4. Force trigger bite (HOOKED)
      engine.player.fishingWaitTimer = 0.01;
      engine.updatePlayerMovement(0.05);
      const hookedState = engine.player.fishingState;

      // 5. Reel in by clicking
      engine.handleWorldClick(waterTile.x, waterTile.y);
      const reelingState = engine.player.fishingState;

      // 6. Complete reeling -> CAUGHT
      engine.player.fishingTimer = 0.05;
      engine.updatePlayerMovement(0.1);
      const caughtState = engine.player.fishingState;

      return {
        waterTile,
        castState,
        castTarget,
        waitingState,
        waitTimer,
        stillWaitingState,
        hookedState,
        reelingState,
        caughtState,
      };
    });

    console.log('Fishing test results:', fishingResults);
    if (fishingResults.castState !== 'CASTING') {
      failures.push(`Expected fishingState CASTING after cast, got '${fishingResults.castState}'`);
    }
    if (fishingResults.waitingState !== 'WAITING' || fishingResults.stillWaitingState !== 'WAITING') {
      failures.push(`Fishing rod did not STAY in water during WAITING (waitingState: ${fishingResults.waitingState}, stillWaiting: ${fishingResults.stillWaitingState})`);
    }
    if (fishingResults.hookedState !== 'HOOKED') {
      failures.push(`Expected fishingState HOOKED after bite wait timer, got '${fishingResults.hookedState}'`);
    }
    if (fishingResults.reelingState !== 'REELING') {
      failures.push(`Expected fishingState REELING on click after bite, got '${fishingResults.reelingState}'`);
    }

    await wait(300);
    await page.screenshot({ path: `${OUTPUT_DIR}/11_fishing_rod_stays_in_water.png` });
    console.log('📸 Saved 11_fishing_rod_stays_in_water.png');

    console.log('\n=========================================');
    console.log(`Verification Complete. Failures: ${failures.length}`);
    if (failures.length > 0) {
      console.error('FAILURES:');
      failures.forEach((f) => console.error('  - ' + f));
    } else {
      console.log('🎉 ALL EXTENDED REQUIREMENTS VERIFIED SUCCESSFULLY!');
    }
    console.log('=========================================\n');

  } catch (err) {
    console.error('Test execution error:', err);
    failures.push(String(err));
  } finally {
    await browser.close();
  }

  if (failures.length > 0) {
    process.exit(1);
  }
}

run();
