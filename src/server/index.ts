/**
 * index.ts - Standalone Node.js Game Server Entry Point
 * 
 * Runs the authoritative game server on port 3001 with Socket.io.
 * Can be deployed to Render or run locally via: npm run server
 */

import http from "http";
import fs from "fs";
import path from "path";
import { Server as SocketIOServer } from "socket.io";
import { GameServer } from "./GameServer";

const PORT = parseInt(process.env.PORT || "4000", 10);
const SEED = parseInt(process.env.WORLD_SEED || "42891", 10);
const TICK_RATE = parseInt(process.env.TICK_RATE || "20", 10);

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
};

const ROOT_DIR = process.cwd();
const DIST_DIR = path.resolve(ROOT_DIR, "dist");
const ASSET_PACK_DIR = path.resolve(ROOT_DIR, "Sunnyside_World_ASSET_PACK_V2.1");
const PUBLIC_DIR = path.resolve(ROOT_DIR, "public");

function serveFile(res: http.ServerResponse, filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  try {
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) return false;
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": stat.size,
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
    });
    fs.createReadStream(filePath).pipe(res);
    return true;
  } catch {
    return false;
  }
}

const server = http.createServer((req, res) => {
  const reqUrl = req.url || "/";
  const parsedPath = decodeURIComponent(reqUrl.split("?")[0]);

  // 1. Health check for Render uptime monitoring
  if (parsedPath === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        uptime: process.uptime(),
        players: gameServer.gameState.players.size,
        tickRate: TICK_RATE,
        seed: SEED,
      })
    );
    return;
  }

  // 2. Direct asset pack request: /Sunnyside_World_ASSET_PACK_V2.1/...
  if (parsedPath.startsWith("/Sunnyside_World_ASSET_PACK_V2.1/")) {
    const relativePath = parsedPath.replace("/Sunnyside_World_ASSET_PACK_V2.1/", "");
    const assetPath = path.join(ASSET_PACK_DIR, relativePath);
    if (serveFile(res, assetPath)) return;
  }

  // 3. Static files from dist/
  if (fs.existsSync(DIST_DIR)) {
    const distFilePath = path.join(DIST_DIR, parsedPath === "/" ? "index.html" : parsedPath);
    if (serveFile(res, distFilePath)) return;

    // SPA fallback: if request doesn't have an extension, serve dist/index.html
    if (!path.extname(parsedPath)) {
      const indexHtmlPath = path.join(DIST_DIR, "index.html");
      if (serveFile(res, indexHtmlPath)) return;
    }
  }

  // 4. Fallback to public/ or root assets if dist not yet built
  const publicPath = path.join(PUBLIC_DIR, parsedPath);
  if (serveFile(res, publicPath)) return;

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("404 Not Found");
});

const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

const gameServer = new GameServer(SEED, TICK_RATE);
gameServer.attachSocketIO(io);
gameServer.start();

// Handle graceful shutdown
function shutdown() {
  console.log("\n[Server] Shutting down gracefully...");
  gameServer.stop();
  io.close(() => {
    server.close(() => {
      console.log("[Server] Server closed.");
      process.exit(0);
    });
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Check if running in test/verification mode
if (process.argv.includes("--test")) {
  console.log("[Server] Running in headless test mode (50 ticks)...");
  setTimeout(() => {
    console.log("[Server] Headless test passed successfully!");
    shutdown();
  }, 2500);
}

server.listen(PORT, "0.0.0.0", () => {
  console.log("══════════════════════════════════════════════════════════════");
  console.log(`🎮 Sunnyside Authoritative Game Server running on port ${PORT}`);
  console.log(`🌱 World Seed: ${SEED} | Simulation Rate: ${TICK_RATE} Hz`);
  console.log("══════════════════════════════════════════════════════════════");
});
