/**
 * Headless multiplayer smoke test.
 * Starts the authoritative server when needed, joins Host + Guest to one room,
 * sends ordered movement inputs, and records every assertion to test-results/.
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { io } from "socket.io-client";

const endpoint = process.env.RTS_SERVER_URL || "http://127.0.0.1:3001";
const lines = [];
const stamp = () => new Date().toISOString();
const log = (message) => { const line = `[${stamp()}] ${message}`; lines.push(line); console.log(line); };
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
let server;
let host;
let guest;

async function serverIsAvailable() {
  return await new Promise(resolve => {
    const probe = io(endpoint, { transports: ["websocket"], timeout: 600 });
    probe.once("connect", () => { probe.close(); resolve(true); });
    probe.once("connect_error", () => { probe.close(); resolve(false); });
  });
}

async function run() {
  await mkdir("test-results", { recursive: true });
  if (!await serverIsAvailable()) {
    log("Server unavailable; starting src/server/index.ts");
    server = spawn("npx", ["tsx", "src/server/index.ts"], { stdio: ["ignore", "pipe", "pipe"] });
    await wait(900);
  } else log("Using existing multiplayer server");

  host = io(endpoint, { transports: ["websocket"], timeout: 3000 });
  guest = io(endpoint, { transports: ["websocket"], timeout: 3000 });
  const fail = (reason) => { throw new Error(reason); };
  const hostRoom = await new Promise((resolve, reject) => {
    host.once("connect_error", reject);
    host.on("connect", () => host.emit("host-world", { name: "Test Host", hairstyle: "base" }, result => result.ok ? resolve(result.code) : reject(new Error(result.error))));
  });
  log(`Host created room ${hostRoom}`);

  await new Promise((resolve, reject) => {
    guest.once("connect_error", reject);
    const join = () => guest.emit("join-world", { code: hostRoom, name: "Test Guest", hairstyle: "base" }, result => result.ok ? resolve() : reject(new Error(result.error)));
    guest.connected ? join() : guest.once("connect", join);
  });
  log("Guest joined host room");

  const moved = await new Promise((resolve, reject) => {
    let sawMovement = false;
    const timeout = setTimeout(() => reject(new Error("Guest movement was not replicated within 3 seconds")), 3000);
    host.on("snapshot", snapshot => {
      const player = snapshot.players.find(p => p.name === "Test Guest");
      if (!sawMovement && snapshot.players.length === 2 && player && player.vx > 0.1) {
        log(`HOST VIEW: ${snapshot.players.length} players visible in room ${snapshot.roomCode}`);
        log(`HOST VIEW — WALKING: Test Guest x=${player.x.toFixed(2)}, y=${player.y.toFixed(2)}, velocity=(${player.vx.toFixed(2)}, ${player.vy.toFixed(2)}), direction=${player.direction}`);
        sawMovement = true;
        guest.emit("player-input", { seq: 3, vx: 0, vy: 0, isSprinting: false, dt: 0.05, clientTimeMs: Date.now() });
      } else if (sawMovement && player && player.vx === 0 && player.x > 22.1) {
        log(`HOST VIEW — IDLE: Test Guest x=${player.x.toFixed(2)}, y=${player.y.toFixed(2)}, velocity=(0.00, 0.00), direction=${player.direction}`);
        clearTimeout(timeout); resolve(player);
      }
    });
    // Ordered inputs model key down, sustained motion, then key up.
    guest.emit("player-input", { seq: 1, vx: 1, vy: 0, isSprinting: false, dt: 0.05, clientTimeMs: Date.now() });
    guest.emit("player-input", { seq: 2, vx: 1, vy: 0, isSprinting: false, dt: 0.05, clientTimeMs: Date.now() });
  });
  log(`PASS: host observed guest at x=${moved.x.toFixed(2)}, y=${moved.y.toFixed(2)} after ordered key events`);
}

try { await run(); log("PASS: multiplayer movement smoke test complete"); }
catch (error) { log(`FAIL: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; }
finally {
  host?.close(); guest?.close();
  if (server) server.kill("SIGTERM");
  await mkdir("test-results", { recursive: true });
  const report = `${lines.join("\n")}\n`;
  await writeFile(`test-results/multiplayer-smoke-${Date.now()}.log`, report);
  await writeFile("test-results/latest-multiplayer-smoke.log", report);
}
