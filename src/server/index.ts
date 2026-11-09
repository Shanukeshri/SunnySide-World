import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { Server } from "socket.io";
import { GameState } from "../game/core/GameState";
import { PlayerSystem } from "../game/systems/PlayerSystem";
import { readFile } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT_DIR = join(__dirname, "../..");
const DIST_DIR = join(ROOT_DIR, "dist");

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js":   "application/javascript",
  ".css":  "text/css",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".wav":  "audio/wav",
  ".mp3":  "audio/mpeg",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".woff":  "font/woff",
  ".ttf":   "font/ttf",
};

function serveStatic(req: IncomingMessage, res: ServerResponse): boolean {
  // Let socket.io handle its own requests
  if (req.url?.startsWith("/socket.io")) return false;

  let urlPath = decodeURIComponent(req.url?.split("?")[0] || "/");
  if (urlPath === "/" || (!extname(urlPath) && !urlPath.includes("."))) urlPath = "/index.html";

  // Check dist first, then root directory (for Sunnyside_World_ASSET_PACK_V2.1, assets, etc.)
  let filePath = join(DIST_DIR, urlPath);
  const ext = extname(filePath);
  const mime = MIME[ext] || "application/octet-stream";

  readFile(filePath, (err, data) => {
    if (!err) {
      res.writeHead(200, {
        "Content-Type": mime,
        "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000",
      });
      res.end(data);
      return;
    }

    // Try root folder
    const rootFilePath = join(ROOT_DIR, urlPath);
    readFile(rootFilePath, (err2, data2) => {
      if (!err2) {
        res.writeHead(200, {
          "Content-Type": mime,
          "Cache-Control": "public, max-age=31536000",
        });
        res.end(data2);
        return;
      }

      // If it's a static file request (has extension) and not found, return 404 rather than corrupting images with index.html!
      if (ext && ext !== ".html") {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
        return;
      }

      // SPA fallback: only serve index.html for page navigation routes
      readFile(join(DIST_DIR, "index.html"), (err3, html) => {
        if (err3) { res.writeHead(404); res.end("Not found"); return; }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(html);
      });
    });
  });
  return true;
}

type Room = { code: string; hostSessionId: string; state: GameState; players: PlayerSystem; tick: number; timer: NodeJS.Timeout; emptyTimer?: NodeJS.Timeout; entities?: any };
const httpServer = createServer((req, res) => {
  serveStatic(req, res);
});
const io = new Server(httpServer, { cors: { origin: true, methods: ["GET", "POST"] } });
const rooms = new Map<string, Room>();
const code = () => Math.random().toString(36).slice(2, 7).toUpperCase();
const snapshot = (room: Room) => ({
  tick: room.tick,
  serverTimeMs: Date.now(),
  seed: room.state.seed,
  roomCode: room.code,
  hostSessionId: room.hostSessionId,
  entities: room.entities,
  players: [...room.state.players.values()].map(({ inputQueue, ...player }) => player)
});
function makeRoom(hostId: string = ""): Room {
  const state = new GameState(Math.floor(Math.random() * 999999)); const room = {} as Room;
  room.code = code(); room.hostSessionId = hostId; room.state = state; room.players = new PlayerSystem(state); room.tick = 0;
  room.timer = setInterval(() => { room.players.update(0.05); room.tick++; io.to(room.code).emit("snapshot", snapshot(room)); }, 50);
  rooms.set(room.code, room); return room;
}
function enter(socket: any, room: Room, name: string, hairstyle: string) {
  if (room.emptyTimer) { clearTimeout(room.emptyTimer); room.emptyTimer = undefined; }
  const existing = [...socket.rooms].filter((id: string) => rooms.has(id)); existing.forEach((id: string) => socket.leave(id));
  const peers = [...room.state.players.keys()]; room.state.addPlayer(socket.id, String(name).slice(0, 18) || "Explorer", hairstyle || "mophair"); socket.join(room.code);
  socket.emit("world-joined", snapshot(room)); peers.forEach(peerId => io.to(peerId).emit("peer-joined", { peerId: socket.id }));
}
io.on("connection", socket => {
  socket.on("host-world", ({ name, hairstyle }, ack) => { const room = makeRoom(socket.id); enter(socket, room, name, hairstyle); ack?.({ ok: true, code: room.code }); });
  socket.on("join-world", ({ code: joinCode, name, hairstyle }, ack) => { const room = rooms.get(String(joinCode).toUpperCase()); if (!room) return ack?.({ ok: false, error: "World not found. Check the invite code." }); enter(socket, room, name, hairstyle); ack?.({ ok: true }); });
  socket.on("sync-entities", entities => {
    const room = [...socket.rooms].map((id: string) => rooms.get(id)).find(Boolean);
    if (!room) return;
    room.entities = entities;
    socket.to(room.code).emit("sync-entities", entities);
  });
  socket.on("player-input", input => {
    const room = [...socket.rooms].map((id: string) => rooms.get(id)).find(Boolean);
    const player = room?.state.getPlayer(socket.id);
    if (room && player) {
      if (input.activeHeldItem !== undefined) {
        player.activeHeldItem = input.activeHeldItem;
        if (player.hotbar[player.activeHotbarIndex]) {
          player.hotbar[player.activeHotbarIndex].item = input.activeHeldItem;
        }
      }
      if (input.activeHotbarIndex !== undefined) {
        player.activeHotbarIndex = input.activeHotbarIndex;
      }
      room.players.processInput(player, { ...input, clientTimeMs: Number(input.clientTimeMs) || Date.now(), serverReceivedAtMs: Date.now() });
    }
  });
  socket.on("player-action", action => {
    const room = [...socket.rooms].map((id: string) => rooms.get(id)).find(Boolean);
    const player = room?.state.getPlayer(socket.id);
    if (!room || !player) return;

    if (action.type === "jump") {
      room.players.jump(player);
    } else if (action.type === "swing") {
      player.swingTimer = action.duration || 0.25;
      if (action.tool !== undefined) {
        player.activeHeldItem = action.tool;
        if (player.hotbar[player.activeHotbarIndex]) {
          player.hotbar[player.activeHotbarIndex].item = action.tool;
        }
      }
      if (action.facing) {
        player.facing = action.facing;
        player.direction = action.facing;
      }
      if (action.fishingState) {
        player.fishingState = action.fishingState;
        player.fishingTimer = 2.0;
      }
    } else if (action.type === "hotbar") {
      player.activeHotbarIndex = action.index;
      player.activeHeldItem = action.item || player.hotbar[action.index]?.item || null;
      if (action.item && player.hotbar[action.index]) {
        player.hotbar[action.index].item = action.item;
      }
    } else if (action.type === "roll") {
      player.rollTimer = 0.4;
    } else if (action.type === "interact") {
      player.doingTimer = 0.3;
    } else if (action.type === "block") {
      player.isBlocking = Boolean(action.isBlocking);
    } else if (action.type === "player-health") {
      player.health = action.health;
      player.isDead = Boolean(action.isDead);
    } else if (action.type === "hit-player") {
      const target = room.state.getPlayer(action.targetId);
      if (target) {
        const dmg = action.damage || 10;
        const effectiveDmg = target.isBlocking ? Math.max(1, Math.round(dmg * 0.15)) : dmg;
        target.health = Math.max(0, target.health - effectiveDmg);
        if (!target.isBlocking) {
          target.hurtTimer = 0.45;
        }
        if (target.health <= 0) target.isDead = true;
      }
    }

    socket.to(room.code).emit("player-action", {
      sessionId: socket.id,
      ...action
    });
  });
  socket.on("webrtc-signal", ({ to, signal }) => io.to(to).emit("webrtc-signal", { from: socket.id, signal }));
  socket.on("disconnect", () => {
    for (const room of rooms.values()) {
      room.state.removePlayer(socket.id);
      if (room.hostSessionId === socket.id && room.state.players.size > 0) {
        room.hostSessionId = room.state.players.keys().next().value || "";
      }
      // Keep an empty room alive briefly so Socket.IO can reconnect a transiently dropped host.
      if (!room.state.players.size && !room.emptyTimer) room.emptyTimer = setTimeout(() => {
        if (!room.state.players.size) { clearInterval(room.timer); rooms.delete(room.code); }
      }, 30_000);
    }
  });
});
httpServer.listen(Number(process.env.PORT || 3001), "0.0.0.0", () => console.log("Multiplayer server listening on :3001"));
