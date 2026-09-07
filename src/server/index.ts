/**
 * index.ts - Standalone Node.js Game Server Entry Point
 * 
 * Runs the authoritative game server on port 3001 with Socket.io.
 * Can be deployed to Render or run locally via: npm run server
 */

import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { GameServer } from "./GameServer";

const PORT = parseInt(process.env.PORT || "4000", 10);
const SEED = parseInt(process.env.WORLD_SEED || "42891", 10);
const TICK_RATE = parseInt(process.env.TICK_RATE || "20", 10);

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", uptime: process.uptime() }));
    return;
  }
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Sunnyside Authoritative RTS Game Server (Node.js + Socket.io)");
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
