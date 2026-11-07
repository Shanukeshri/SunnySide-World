import { createServer } from "node:http";
import { Server } from "socket.io";
import { GameState } from "../game/core/GameState";
import { PlayerSystem } from "../game/systems/PlayerSystem";

type Room = { code: string; state: GameState; players: PlayerSystem; tick: number; timer: NodeJS.Timeout; emptyTimer?: NodeJS.Timeout };
const httpServer = createServer();
const io = new Server(httpServer, { cors: { origin: true, methods: ["GET", "POST"] } });
const rooms = new Map<string, Room>();
const code = () => Math.random().toString(36).slice(2, 7).toUpperCase();
const snapshot = (room: Room) => ({ tick: room.tick, serverTimeMs: Date.now(), seed: room.state.seed, roomCode: room.code, players: [...room.state.players.values()].map(({ inputQueue, ...player }) => player) });
function makeRoom(): Room {
  const state = new GameState(Math.floor(Math.random() * 999999)); const room = {} as Room;
  room.code = code(); room.state = state; room.players = new PlayerSystem(state); room.tick = 0;
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
  socket.on("host-world", ({ name, hairstyle }, ack) => { const room = makeRoom(); enter(socket, room, name, hairstyle); ack?.({ ok: true, code: room.code }); });
  socket.on("join-world", ({ code: joinCode, name, hairstyle }, ack) => { const room = rooms.get(String(joinCode).toUpperCase()); if (!room) return ack?.({ ok: false, error: "World not found. Check the invite code." }); enter(socket, room, name, hairstyle); ack?.({ ok: true }); });
  socket.on("player-input", input => { const room = [...socket.rooms].map((id: string) => rooms.get(id)).find(Boolean); const player = room?.state.getPlayer(socket.id); if (room && player) room.players.processInput(player, { ...input, clientTimeMs: Number(input.clientTimeMs) || Date.now(), serverReceivedAtMs: Date.now() }); });
  socket.on("webrtc-signal", ({ to, signal }) => io.to(to).emit("webrtc-signal", { from: socket.id, signal }));
  socket.on("disconnect", () => {
    for (const room of rooms.values()) {
      room.state.removePlayer(socket.id);
      // Keep an empty room alive briefly so Socket.IO can reconnect a transiently dropped host.
      if (!room.state.players.size && !room.emptyTimer) room.emptyTimer = setTimeout(() => {
        if (!room.state.players.size) { clearInterval(room.timer); rooms.delete(room.code); }
      }, 30_000);
    }
  });
});
httpServer.listen(Number(process.env.PORT || 3001), "0.0.0.0", () => console.log("Multiplayer server listening on :3001"));
