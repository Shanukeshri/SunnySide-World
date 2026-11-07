import { io, Socket } from "socket.io-client";
import { SPRINT_SPEED, WALK_SPEED, SWIM_MULTIPLIER } from "../game/MovementConstants";

type SnapshotPlayer = {
  sessionId: string; name: string; hairstyle: string; x: number; y: number;
  vx: number; vy: number; direction: string; facing: "LEFT" | "RIGHT";
  health: number; hunger: number; stamina: number; isSprinting: boolean;
  lastProcessedInputSeq: number;
};

type Snapshot = { tick: number; seed: number; roomCode: string; hostSessionId?: string; entities?: any; players: SnapshotPlayer[] };

/** High-precision 60 FPS dead reckoning & exponential interpolator for remote entities. */
class EntityInterpolator {
  private targets = new Map<
    string | number,
    { x: number; y: number; vx: number; vy: number; receivedAt: number }
  >();

  public push(id: string | number, x: number, y: number, vx = 0, vy = 0) {
    this.targets.set(id, { x, y, vx, vy, receivedAt: performance.now() });
  }

  public getInterpolatedEntity(
    id: string | number,
    currentX: number,
    currentY: number,
    dt: number = 0.016,
  ) {
    const target = this.targets.get(id);
    if (!target) return { x: currentX, y: currentY, vx: 0, vy: 0, isMoving: false };

    const now = performance.now();
    const elapsedSec = Math.max(0, (now - target.receivedAt) / 1000);

    // Dead reckoning: extrapolate along velocity up to 350ms to bridge network ticks smoothly
    const extrapolateSec = Math.min(0.35, elapsedSec);
    const tx = target.x + target.vx * extrapolateSec;
    const ty = target.y + target.vy * extrapolateSec;

    const dist = Math.hypot(tx - currentX, ty - currentY);

    // Instant snap if teleported or too far out of sync (> 3.5 tiles)
    if (dist > 3.5) {
      return {
        x: tx,
        y: ty,
        vx: target.vx,
        vy: target.vy,
        isMoving: Math.hypot(target.vx, target.vy) > 0.02,
      };
    }

    // Frame-rate independent exponential smoothing factor (lambda = 18.0)
    // At 60 FPS (dt = 0.0166s), factor = 1 - exp(-18 * 0.0166) ≈ 0.26 per frame
    const factor = Math.min(1.0, 1 - Math.exp(-18.0 * Math.max(0.001, dt)));

    const nx = currentX + (tx - currentX) * factor;
    const ny = currentY + (ty - currentY) * factor;

    // Movement detection considers target velocity as well as active position convergence
    const hasVelocity = Math.hypot(target.vx, target.vy) > 0.02;
    const isClosingDistance = dist > 0.04 && elapsedSec < 0.4;
    const isMoving = hasVelocity || isClosingDistance;

    // Provide continuous velocity for animation states
    const effVx = hasVelocity ? target.vx : (nx - currentX) / Math.max(0.001, dt);
    const effVy = hasVelocity ? target.vy : (ny - currentY) / Math.max(0.001, dt);

    return {
      x: nx,
      y: ny,
      vx: isMoving ? effVx : 0,
      vy: isMoving ? effVy : 0,
      isMoving,
    };
  }
}

class ClientPrediction {
  private seq = 0;
  private x = 22;
  private y = 18;
  private visualX = 22;
  private visualY = 18;
  private pending: Array<{ seq: number; vx: number; vy: number; isSprinting: boolean; dt: number }> = [];
  /** Stable predicted coordinates consumed by SurvivalRenderer's camera. */
  public get predictedX() { return this.x; }
  public get predictedY() { return this.y; }
  public reset(x: number, y: number) { this.x = this.visualX = x; this.y = this.visualY = y; this.seq = 0; this.pending = []; }
  public predictMovement(vx: number, vy: number, sprint: boolean, swimming: boolean, dt: number, canMove: (x: number, y: number) => boolean) {
    const length = Math.hypot(vx, vy) || 1;
    vx /= length; vy /= length;
    const speed = (sprint ? SPRINT_SPEED : WALK_SPEED) * (swimming ? SWIM_MULTIPLIER : 1);
    const nx = this.x + vx * speed * dt; const ny = this.y + vy * speed * dt;
    if (canMove(nx, ny)) {
      this.x = nx; this.y = ny;
    } else {
      if (canMove(nx, this.y)) this.x = nx;
      if (canMove(this.x, ny)) this.y = ny;
    }
    this.visualX = this.x; this.visualY = this.y;
    const input = { vx, vy, isSprinting: sprint, seq: ++this.seq, dt };
    this.pending.push(input); if (this.pending.length > 60) this.pending.shift();
    return input;
  }
  public reconcile(player: SnapshotPlayer) {
    // Ignore stale server states. The current input sequence remains locally monotonic.
    this.pending = this.pending.filter(input => input.seq > player.lastProcessedInputSeq);
    this.x = player.x; this.y = player.y;
    for (const input of this.pending) { const speed = input.isSprinting ? SPRINT_SPEED : WALK_SPEED; this.x += input.vx * speed * input.dt; this.y += input.vy * speed * input.dt; }
    this.visualX += (this.x - this.visualX) * 0.35; this.visualY += (this.y - this.visualY) * 0.35;
  }
  public updateSmoothing(_dt: number) { this.visualX += (this.x - this.visualX) * 0.15; this.visualY += (this.y - this.visualY) * 0.15; }
  public getVisualPosition() { return { x: this.visualX, y: this.visualY }; }
}

export class NetworkClient {
  public connectionState: "DISCONNECTED" | "CONNECTING" | "CONNECTED" = "DISCONNECTED";
  public isHost = false;
  public readonly prediction = new ClientPrediction();
  public readonly interpolator = new EntityInterpolator();
  private socket: Socket;
  private peers = new Map<string, RTCPeerConnection>();
  private roomCode = "";
  private lastJoin: { event: "host-world" | "join-world"; payload: Record<string, string> } | null = null;
  private identity = { name: "Explorer", hairstyle: "mophair" };
  private shouldResume = false;
  public serverClockOffsetMs = 0;
  private onSnapshot: (snapshot: Snapshot) => void;
  private onJoined: (snapshot: Snapshot) => void;
  private onStatus: (text: string, playerCount: number) => void;
  private onAction?: (action: { sessionId: string; type: string; [key: string]: any }) => void;
  private onSyncEntities?: (entities: any) => void;

  constructor(options: {
    onSnapshot: (snapshot: Snapshot) => void;
    onJoined: (snapshot: Snapshot) => void;
    onStatus: (text: string, playerCount: number) => void;
    onAction?: (action: { sessionId: string; type: string; [key: string]: any }) => void;
    onSyncEntities?: (entities: any) => void;
  }) {
    this.onSnapshot = options.onSnapshot; this.onJoined = options.onJoined; this.onStatus = options.onStatus; this.onAction = options.onAction; this.onSyncEntities = options.onSyncEntities;
    const endpoint = (import.meta as any).env?.VITE_SERVER_URL || `${location.protocol}//${location.hostname}:3001`;
    this.socket = io(endpoint, { autoConnect: false, transports: ["websocket", "polling"] });
    this.socket.on("connect", () => {
      this.connectionState = "CONNECTED";
      if (this.shouldResume && this.lastJoin) {
        this.shouldResume = false;
        this.socket.emit(this.lastJoin.event, this.lastJoin.payload);
        this.onStatus("Rejoining world…", 1);
      } else this.onStatus("Connected", 1);
    });
    this.socket.on("disconnect", () => { this.connectionState = "DISCONNECTED"; this.shouldResume = !!this.lastJoin; this.onStatus("Reconnecting…", 1); this.closePeers(); });
    this.socket.on("world-joined", (snapshot: Snapshot) => {
      this.roomCode = snapshot.roomCode;
      this.isHost = snapshot.hostSessionId ? snapshot.hostSessionId === this.socket.id : this.lastJoin?.event === "host-world";
      this.lastJoin = { event: "join-world", payload: { code: snapshot.roomCode, ...this.identity } };
      this.prediction.reset(snapshot.players.find(p => p.sessionId === this.socket.id)?.x ?? 22, snapshot.players.find(p => p.sessionId === this.socket.id)?.y ?? 18);
      this.onJoined(snapshot);
      if (snapshot.entities) {
        this.onSyncEntities?.(snapshot.entities);
      }
    });
    this.socket.on("snapshot", (snapshot: Snapshot & { serverTimeMs?: number }) => {
      if (snapshot.serverTimeMs) this.serverClockOffsetMs = this.serverClockOffsetMs * .85 + (snapshot.serverTimeMs - Date.now()) * .15;
      if (snapshot.hostSessionId) {
        this.isHost = snapshot.hostSessionId === this.socket.id;
      }
      this.onSnapshot(snapshot);
      this.onStatus(`Online · ${snapshot.roomCode}`, snapshot.players.length);
    });
    this.socket.on("sync-entities", (entities: any) => {
      if (!this.isHost) {
        this.onSyncEntities?.(entities);
      }
    });
    this.socket.on("player-action", (data: { sessionId: string; type: string; [key: string]: any }) => {
      this.onAction?.(data);
    });
    this.socket.on("peer-joined", ({ peerId }: { peerId: string }) => this.openPeer(peerId, true));
    this.socket.on("webrtc-signal", ({ from, signal }: { from: string; signal: RTCSessionDescriptionInit | RTCIceCandidateInit }) => this.receiveSignal(from, signal));
  }

  public hostWorld(name: string, hairstyle: string) {
    this.isHost = true;
    this.connectThen("host-world", { name, hairstyle });
  }
  public joinWorld(code: string, name: string, hairstyle: string) {
    this.isHost = false;
    this.connectThen("join-world", { code: code.toUpperCase(), name, hairstyle });
  }
  public get clientId() { return this.socket.id; }
  public sendInput(vx: number, vy: number, isSprinting: boolean, seq: number, dt: number, extra?: { activeHeldItem?: string | null; activeHotbarIndex?: number }) {
    const position = this.prediction.getVisualPosition();
    const input = { vx, vy, isSprinting, seq, dt, clientTimeMs: Date.now(), x: position.x, y: position.y, ...extra };
    this.socket.emit("player-input", input);
    // The data channel gives peers immediate cosmetic movement; Socket.IO remains authoritative.
    const speed = isSprinting ? SPRINT_SPEED : WALK_SPEED;
    const presence = { ...input, vx: vx * speed, vy: vy * speed };
    this.peers.forEach(peer => {
      const channel = (peer as any)._gameChannel as RTCDataChannel | undefined;
      if (channel?.readyState === "open") channel.send(JSON.stringify({ type: "presence", ...presence }));
    });
  }
  public sendAction(action: { type: string; [key: string]: any }) {
    if (!action.actionId) {
      action.actionId = `${this.socket.id || "client"}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    }
    this.socket.emit("player-action", action);
    this.peers.forEach(peer => {
      const channel = (peer as any)._gameChannel as RTCDataChannel | undefined;
      if (channel?.readyState === "open") {
        channel.send(JSON.stringify({ type: "action", action }));
      }
    });
  }
  public sendEntitiesSync(entities: any) {
    this.socket.emit("sync-entities", entities);
    this.peers.forEach(peer => {
      const channel = (peer as any)._gameChannel as RTCDataChannel | undefined;
      if (channel?.readyState === "open") {
        channel.send(JSON.stringify({ type: "sync-entities", entities }));
      }
    });
  }
  private connectThen(event: string, payload: Record<string, string>) {
    this.identity = { name: payload.name || "Explorer", hairstyle: payload.hairstyle || "mophair" };
    this.lastJoin = { event: event as "host-world" | "join-world", payload };
    this.connectionState = "CONNECTING"; this.onStatus("Connecting…", 1);
    const send = () => this.socket.emit(event, payload, (result: { ok: boolean; error?: string }) => { if (!result.ok) this.onStatus(result.error || "Unable to join world", 1); });
    if (this.socket.connected) send(); else { this.socket.once("connect", send); this.socket.connect(); }
  }
  private openPeer(peerId: string, initiator: boolean) {
    if (this.peers.has(peerId) || !window.RTCPeerConnection) return;
    const peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }); this.peers.set(peerId, peer);
    peer.onicecandidate = e => { if (e.candidate) this.socket.emit("webrtc-signal", { to: peerId, signal: e.candidate.toJSON() }); };
    peer.ondatachannel = e => this.bindChannel(peer, peerId, e.channel);
    peer.onconnectionstatechange = () => { if (["failed", "closed"].includes(peer.connectionState)) { peer.close(); this.peers.delete(peerId); } };
    if (initiator) { const channel = peer.createDataChannel("game-input", { ordered: false, maxRetransmits: 0 }); this.bindChannel(peer, peerId, channel); peer.createOffer().then(offer => peer.setLocalDescription(offer)).then(() => this.socket.emit("webrtc-signal", { to: peerId, signal: peer.localDescription })); }
  }
  private bindChannel(peer: RTCPeerConnection, peerId: string, channel: RTCDataChannel) {
    (peer as any)._gameChannel = channel;
    channel.onmessage = event => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "presence" && Number.isFinite(message.x) && Number.isFinite(message.y)) {
          this.interpolator.push(peerId, message.x, message.y, message.vx, message.vy);
        } else if (message.type === "action") {
          this.onAction?.({ sessionId: peerId, ...message.action });
        } else if (message.type === "sync-entities" && !this.isHost) {
          this.onSyncEntities?.(message.entities);
        }
      } catch { /* Ignore malformed unreliable channel data. */ }
    };
  }
  private async receiveSignal(from: string, signal: RTCSessionDescriptionInit | RTCIceCandidateInit) {
    let peer = this.peers.get(from); if (!peer) { this.openPeer(from, false); peer = this.peers.get(from)!; }
    if ("type" in signal) { await peer.setRemoteDescription(signal as RTCSessionDescriptionInit); if (signal.type === "offer") { const answer = await peer.createAnswer(); await peer.setLocalDescription(answer); this.socket.emit("webrtc-signal", { to: from, signal: peer.localDescription }); } } else await peer.addIceCandidate(signal as RTCIceCandidateInit);
  }
  private closePeers() { this.peers.forEach(p => p.close()); this.peers.clear(); }
}
