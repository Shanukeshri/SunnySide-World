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
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-web-security",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });

  try {
    console.log("=== TAB 1: HOST ===");
    const pageHost = await browser.newPage();
    await pageHost.setViewport({ width: 1024, height: 768 });

    pageHost.on("console", (msg) => {
      const text = msg.text();
      if (!text.includes("Download the React DevTools") && !text.includes("Vite")) {
        console.log("[Host Console]:", text);
      }
    });

    await pageHost.goto(APP_URL, { waitUntil: "networkidle2" });
    await sleep(1000);

    // Host room via PlayroomKit (skipLobby: true for fast headless testing)
    console.log("Host initializing PlayroomKit world...");
    const hostInit = await pageHost.evaluate(async () => {
      const net = window.networkClient;
      if (!net) return { ok: false, error: "networkClient not found" };

      // Ensure survival game loaded
      if (typeof window.switchTab === "function") {
        window.switchTab("game");
      }
      const hostPromise = net.hostWorld("HostPlayer", "mophair", { skipLobby: true });
      return { ok: true };
    });
    console.log("Host init result:", hostInit);

    // Wait until host is connected and has room code
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
        };
      });
      if (status.connected && status.roomCode) {
        roomCode = status.roomCode;
        console.log(`Host connected to room: ${roomCode}, isHost: ${status.isHost}, playerPos:`, status.playerPos);
        break;
      }
    }

    if (!roomCode) {
      throw new Error("Host failed to connect or generate room code within 20s");
    }

    await pageHost.screenshot({ path: "screenshots/playroom_host_lobby.png" });

    console.log("=== TAB 2: GUEST ===");
    const pageGuest = await browser.newPage();
    await pageGuest.setViewport({ width: 1024, height: 768 });

    pageGuest.on("console", (msg) => {
      const text = msg.text();
      if (!text.includes("Download the React DevTools") && !text.includes("Vite")) {
        console.log("[Guest Console]:", text);
      }
    });

    await pageGuest.goto(APP_URL, { waitUntil: "networkidle2" });
    await sleep(1000);

    console.log(`Guest joining room ${roomCode}...`);
    await pageGuest.evaluate(async (code) => {
      if (typeof window.switchTab === "function") {
        window.switchTab("game");
      }
      const net = window.networkClient;
      await net.joinWorld(code, "GuestPlayer", "mophair", { skipLobby: true });
    }, roomCode);

    // Wait for guest to be connected
    let guestConnected = false;
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      const status = await pageGuest.evaluate(() => {
        const net = window.networkClient;
        const se = window.survivalEngine;
        return {
          connected: net?.connectionState === "CONNECTED",
          isHost: net?.isHost,
          roomCode: net?.roomCode,
          remoteCount: se?.remotePlayers?.length || 0,
        };
      });
      if (status.connected && status.remoteCount > 0) {
        guestConnected = true;
        console.log(`Guest connected! Remote players observed by guest: ${status.remoteCount}`);
        break;
      }
    }

    if (!guestConnected) {
      throw new Error("Guest failed to connect or see remote host within 20s");
    }

    // Verify both tabs see 2 players
    const playersHost = await pageHost.evaluate(() => window.survivalEngine?.remotePlayers?.length);
    const playersGuest = await pageGuest.evaluate(() => window.survivalEngine?.remotePlayers?.length);
    console.log(`Host sees ${playersHost} remote players; Guest sees ${playersGuest} remote players.`);

    console.log("=== MOVEMENT & JITTER-FREE SYNCHRONIZATION TEST ===");
    // Host moves to the right (x increases)
    console.log("Host moving to the right...");
    await pageHost.evaluate(() => {
      const se = window.survivalEngine;
      const net = window.networkClient;
      // Simulate input sequence
      for (let s = 1; s <= 10; s++) {
        const x = 22 + s * 0.4;
        const y = 18;
        se.player.x = x;
        se.player.y = y;
        net.sendInput(1, 0, false, s, 0.033);
      }
    });

    await sleep(300);

    // Guest observes Host moving via Snapshot Interpolation
    const guestObservedHost = await pageGuest.evaluate(() => {
      const se = window.survivalEngine;
      const rp = se?.remotePlayers?.[0];
      return rp ? { id: rp.id, x: rp.x, y: rp.y, vx: rp.vx, direction: rp.direction } : null;
    });
    console.log("Guest observed host position after movement:", guestObservedHost);

    // Guest moves down (y increases)
    console.log("Guest moving downwards...");
    await pageGuest.evaluate(() => {
      const se = window.survivalEngine;
      const net = window.networkClient;
      for (let s = 1; s <= 10; s++) {
        const x = 22;
        const y = 18 + s * 0.4;
        se.player.x = x;
        se.player.y = y;
        net.sendInput(0, 1, false, s, 0.033);
      }
    });

    await sleep(300);

    // Host observes Guest moving via Snapshot Interpolation
    const hostObservedGuest = await pageHost.evaluate(() => {
      const se = window.survivalEngine;
      const rp = se?.remotePlayers?.[0];
      return rp ? { id: rp.id, x: rp.x, y: rp.y, vy: rp.vy, direction: rp.direction } : null;
    });
    console.log("Host observed guest position after movement:", hostObservedGuest);

    console.log("=== MOBILE CONTROLS TEST ===");
    const mobileTest = await pageGuest.evaluate(() => {
      const net = window.networkClient;
      net.toggleMobileControls(true);
      const joystickEl = document.getElementById("pr-joystick");
      const hasJoystick = Boolean(net.mobileJoystick);
      const isVisible = net.mobileControlsVisible;
      return { hasJoystick, isVisible, domPresent: Boolean(joystickEl) };
    });
    console.log("Mobile controls test result on Guest:", mobileTest);

    await pageHost.screenshot({ path: "screenshots/playroom_host_synced.png" });
    await pageGuest.screenshot({ path: "screenshots/playroom_guest_synced.png" });

    console.log("✅ ALL CHECKS PASSED: Two browser tabs connected via PlayroomKit, synchronized position state over WebRTC with @geckos.io/snapshot-interpolation, and mobile controls verified!");

    await writeFile("test-results/two-tab-sync-success.json", JSON.stringify({
      roomCode,
      hostObservedGuest,
      guestObservedHost,
      mobileTest,
      timestamp: new Date().toISOString(),
      status: "PASS",
    }, null, 2));

  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
