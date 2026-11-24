import puppeteer from "puppeteer-core";
import { mkdir, writeFile } from "node:fs/promises";

const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const APP_URL = "http://localhost:3000/";

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  await mkdir("test-results", { recursive: true });
  await mkdir("screenshots", { recursive: true });

  console.log("Launching Chrome at:", CHROME_PATH);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    protocolTimeout: 60000,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-web-security",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
    ],
  });

  try {
    console.log("=== 1. STARTING HOST ===");
    const pageHost = await browser.newPage();
    await pageHost.setViewport({ width: 1280, height: 800 });

    pageHost.on("console", (msg) => {
      const text = msg.text();
      if (!text.includes("Download the React DevTools") && !text.includes("Vite")) {
        console.log("[Host Console]:", text);
      }
    });

    await pageHost.goto(APP_URL, { waitUntil: "domcontentloaded" });
    await sleep(2000);

    // Host room via PlayroomKit
    console.log("Host initializing PlayroomKit world...");
    await pageHost.evaluate(() => {
      document.getElementById("main-menu")?.classList.add("hidden");
      if (typeof window.switchTab === "function") {
        window.switchTab("game");
      }
      const net = window.networkClient;
      if (net) {
        net.hostWorld("HostHero", "mophair", { skipLobby: true });
      }
    });

    // Wait for host connection and roomCode
    let roomCode = "";
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      const status = await pageHost.evaluate(() => {
        const net = window.networkClient;
        const se = window.survivalEngine;
        return {
          connected: net?.connectionState === "CONNECTED",
          isHost: net?.isHost,
          roomCode: net?.roomCode,
          playerPos: se ? { x: se.player.x, y: se.player.y } : null,
          animalsCount: se?.animals?.length || 0,
          npcsCount: se?.npcs?.length || 0,
        };
      });
      if (status.connected && status.roomCode && status.playerPos) {
        roomCode = status.roomCode;
        console.log(`Host connected to room [${roomCode}], isHost=${status.isHost}, playerPos=`, status.playerPos, `animals=${status.animalsCount}, npcs=${status.npcsCount}`);
        break;
      }
    }

    if (!roomCode) {
      throw new Error("Host failed to connect or obtain room code within 20s");
    }

    console.log("=== 2. STARTING GUEST ===");
    const pageGuest = await browser.newPage();
    await pageGuest.setViewport({ width: 1280, height: 800 });

    pageGuest.on("console", (msg) => {
      const text = msg.text();
      if (!text.includes("Download the React DevTools") && !text.includes("Vite")) {
        console.log("[Guest Console]:", text);
      }
    });

    await pageGuest.goto(APP_URL, { waitUntil: "domcontentloaded" });
    await sleep(2000);

    console.log(`Guest joining room [${roomCode}]...`);
    await pageGuest.evaluate((code) => {
      document.getElementById("main-menu")?.classList.add("hidden");
      if (typeof window.switchTab === "function") {
        window.switchTab("game");
      }
      const net = window.networkClient;
      if (net) {
        net.joinWorld(code, "GuestAdventurer", "spikeyhair", { skipLobby: true });
      }
    }, roomCode);

    // Wait until guest is fully connected and survivalEngine is loaded
    let guestReady = false;
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      const guestStatus = await pageGuest.evaluate(() => {
        const net = window.networkClient;
        const se = window.survivalEngine;
        return {
          connected: net?.connectionState === "CONNECTED",
          isHost: net?.isHost,
          hasEngine: Boolean(se),
          playerPos: se ? { x: se.player.x, y: se.player.y } : null,
          remoteCount: se?.remotePlayers?.length || 0,
          animalsCount: se?.animals?.length || 0,
          npcsCount: se?.npcs?.length || 0,
        };
      });
      if (guestStatus.connected && guestStatus.hasEngine && guestStatus.remoteCount > 0) {
        console.log("Guest connected and synced:", guestStatus);
        guestReady = true;
        break;
      }
    }

    if (!guestReady) {
      throw new Error("Guest failed to connect and sync with Host within 20s");
    }

    // Wait 2 seconds for initial physics & lighting to stabilize
    await sleep(2000);

    console.log("=== 3. CAPTURING INITIAL SYNC SCREENSHOTS ===");
    await pageHost.screenshot({ path: "screenshots/01_host_connected.png" });
    await pageGuest.screenshot({ path: "screenshots/01_guest_connected.png" });
    console.log("Saved screenshots/01_host_connected.png and screenshots/01_guest_connected.png");

    // Sample initial positions
    const initialHostEntities = await pageHost.evaluate(() => {
      const se = window.survivalEngine;
      return {
        player: { x: se.player.x, y: se.player.y },
        animals: se.animals.slice(0, 8).map((a) => ({ id: a.id, x: a.position.x, y: a.position.y, isMoving: a.movement?.isMoving })),
        npcs: se.npcs.slice(0, 8).map((n) => ({ id: n.id, x: n.position.x, y: n.position.y, isMoving: n.movement?.isMoving })),
      };
    });

    const initialGuestEntities = await pageGuest.evaluate(() => {
      const se = window.survivalEngine;
      return {
        player: { x: se.player.x, y: se.player.y },
        remotePlayers: se.remotePlayers.map((rp) => ({ id: rp.id, x: rp.x, y: rp.y })),
        animals: se.animals.slice(0, 8).map((a) => ({ id: a.id, x: a.position.x, y: a.position.y, isMoving: a.movement?.isMoving })),
        npcs: se.npcs.slice(0, 8).map((n) => ({ id: n.id, x: n.position.x, y: n.position.y, isMoving: n.movement?.isMoving })),
      };
    });

    console.log("Initial Host Player:", initialHostEntities.player);
    console.log("Initial Guest RemotePlayers:", initialGuestEntities.remotePlayers);
    console.log("Initial Host Animals (first 4):", initialHostEntities.animals.slice(0, 4));
    console.log("Initial Guest Animals (first 4):", initialGuestEntities.animals.slice(0, 4));

    console.log("=== 4. MOVING BOTH PLAYERS AND RUNNING ENTITY SIMULATION ===");

    // Move Host player to the RIGHT and DOWN
    await pageHost.evaluate(() => {
      window.activeSurvivalKeys?.add("d");
      window.activeSurvivalKeys?.add("s");
    });

    // Move Guest player to the UP and LEFT
    await pageGuest.evaluate(() => {
      window.activeSurvivalKeys?.add("w");
      window.activeSurvivalKeys?.add("a");
    });

    // Let both move for 3.5 seconds
    await sleep(3500);

    // Release movement keys
    await pageHost.evaluate(() => {
      window.activeSurvivalKeys?.delete("d");
      window.activeSurvivalKeys?.delete("s");
    });

    await pageGuest.evaluate(() => {
      window.activeSurvivalKeys?.delete("w");
      window.activeSurvivalKeys?.delete("a");
    });

    // Allow animals and NPCs to continue wandering for 3 more seconds
    console.log("Letting animals and NPCs wander for 3.5 seconds...");
    await sleep(3500);

    console.log("=== 5. CAPTURING POST-MOVEMENT SCREENSHOTS ===");
    await pageHost.screenshot({ path: "screenshots/02_host_moved.png" });
    await pageGuest.screenshot({ path: "screenshots/02_guest_moved.png" });
    console.log("Saved screenshots/02_host_moved.png and screenshots/02_guest_moved.png");

    // Sample final positions
    const finalHostEntities = await pageHost.evaluate(() => {
      const se = window.survivalEngine;
      return {
        player: { x: se.player.x, y: se.player.y },
        remotePlayers: se.remotePlayers.map((rp) => ({ id: rp.id, x: rp.x, y: rp.y })),
        animals: se.animals.slice(0, 8).map((a) => ({
          id: a.id,
          x: a.position.x,
          y: a.position.y,
          isMoving: a.movement?.isMoving,
          direction: a.direction,
          behaviorState: a.behaviorState,
        })),
        npcs: se.npcs.slice(0, 8).map((n) => ({
          id: n.id,
          x: n.position.x,
          y: n.position.y,
          isMoving: n.movement?.isMoving,
          direction: n.direction,
          behaviorState: n.behaviorState,
        })),
      };
    });

    const finalGuestEntities = await pageGuest.evaluate(() => {
      const se = window.survivalEngine;
      return {
        player: { x: se.player.x, y: se.player.y },
        remotePlayers: se.remotePlayers.map((rp) => ({ id: rp.id, x: rp.x, y: rp.y })),
        animals: se.animals.slice(0, 8).map((a) => ({
          id: a.id,
          x: a.position.x,
          y: a.position.y,
          isMoving: a.movement?.isMoving,
          direction: a.direction,
          behaviorState: a.behaviorState,
        })),
        npcs: se.npcs.slice(0, 8).map((n) => ({
          id: n.id,
          x: n.position.x,
          y: n.position.y,
          isMoving: n.movement?.isMoving,
          direction: n.direction,
          behaviorState: n.behaviorState,
        })),
      };
    });

    console.log("FINAL Host Player:", finalHostEntities.player);
    console.log("FINAL Guest RemotePlayers:", finalGuestEntities.remotePlayers);
    console.log("FINAL Guest Player:", finalGuestEntities.player);
    console.log("FINAL Host RemotePlayers:", finalHostEntities.remotePlayers);

    // Verification calculations
    // 1. Host moved
    const hostMovedDist = Math.hypot(
      finalHostEntities.player.x - initialHostEntities.player.x,
      finalHostEntities.player.y - initialHostEntities.player.y
    );

    // 2. Guest moved
    const guestMovedDist = Math.hypot(
      finalGuestEntities.player.x - initialGuestEntities.player.x,
      finalGuestEntities.player.y - initialGuestEntities.player.y
    );

    // 3. Host player position on Guest tab matches Host
    const guestRemoteHost = finalGuestEntities.remotePlayers[0];
    const hostSyncDelta = guestRemoteHost
      ? Math.hypot(guestRemoteHost.x - finalHostEntities.player.x, guestRemoteHost.y - finalHostEntities.player.y)
      : null;

    // 4. Guest player position on Host tab matches Guest
    const hostRemoteGuest = finalHostEntities.remotePlayers[0];
    const guestSyncDelta = hostRemoteGuest
      ? Math.hypot(hostRemoteGuest.x - finalGuestEntities.player.x, hostRemoteGuest.y - finalGuestEntities.player.y)
      : null;

    // 5. Animal movement and syncing
    const animalDeltas = [];
    let animalsMovedCount = 0;
    for (let i = 0; i < finalHostEntities.animals.length; i++) {
      const ha = finalHostEntities.animals[i];
      const ga = finalGuestEntities.animals.find((a) => a.id === ha.id);
      const initHa = initialHostEntities.animals.find((a) => a.id === ha.id);
      if (ha && initHa) {
        const moved = Math.hypot(ha.x - initHa.x, ha.y - initHa.y);
        if (moved > 0.05) animalsMovedCount++;
      }
      if (ha && ga) {
        const diff = Math.hypot(ha.x - ga.x, ha.y - ga.y);
        animalDeltas.push({ id: ha.id, hostPos: { x: ha.x, y: ha.y }, guestPos: { x: ga.x, y: ga.y }, diff, hostMoved: Math.hypot(ha.x - (initHa?.x || ha.x), ha.y - (initHa?.y || ha.y)) });
      }
    }

    // 6. NPC movement and syncing
    const npcDeltas = [];
    let npcsMovedCount = 0;
    for (let i = 0; i < finalHostEntities.npcs.length; i++) {
      const hn = finalHostEntities.npcs[i];
      const gn = finalGuestEntities.npcs.find((n) => n.id === hn.id);
      const initHn = initialHostEntities.npcs.find((n) => n.id === hn.id);
      if (hn && initHn) {
        const moved = Math.hypot(hn.x - initHn.x, hn.y - initHn.y);
        if (moved > 0.05) npcsMovedCount++;
      }
      if (hn && gn) {
        const diff = Math.hypot(hn.x - gn.x, hn.y - gn.y);
        npcDeltas.push({ id: hn.id, hostPos: { x: hn.x, y: hn.y }, guestPos: { x: gn.x, y: gn.y }, diff, hostMoved: Math.hypot(hn.x - (initHn?.x || hn.x), hn.y - (initHn?.y || hn.y)) });
      }
    }

    const testSummary = {
      roomCode,
      hostMovedDist,
      guestMovedDist,
      hostSyncDelta,
      guestSyncDelta,
      animalsMovedCount,
      totalSampledAnimals: finalHostEntities.animals.length,
      animalDeltas,
      npcsMovedCount,
      totalSampledNpcs: finalHostEntities.npcs.length,
      npcDeltas,
      success:
        hostMovedDist > 0.5 &&
        guestMovedDist > 0.5 &&
        (hostSyncDelta !== null && hostSyncDelta < 1.0) &&
        (guestSyncDelta !== null && guestSyncDelta < 1.0),
    };

    console.log("=== TEST SUMMARY ===");
    console.log(JSON.stringify(testSummary, null, 2));

    await writeFile("test-results/sync_and_movement_metrics.json", JSON.stringify(testSummary, null, 2));
    console.log("Metrics saved to test-results/sync_and_movement_metrics.json");

  } catch (err) {
    console.error("Test execution failed:", err);
    throw err;
  } finally {
    await browser.close();
  }
}

run();
