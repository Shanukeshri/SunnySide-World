/**
 * NetworkClient.ts - Real-Time Socket.io Client for Authoritative Simulation
 * 
 * Implements Section 4, 11, 14, 15, 16 of authoritative_server.txt:
 * Manages WebSocket connection to the authoritative Node.js server,
 * client-side prediction, entity interpolation, and event dispatching.
 */

import { io, Socket } from "socket.io-client";
import {
  ServerInitMessage,
  ServerSyncMessage,
  ClientActionMessage,
} from "../server/networking/Protocol";
import { ClientPrediction } from "./ClientPrediction";
import { EntityInterpolator } from "./EntityInterpolator";
import { GameEvent } from "../game/core/EventBus";

export type ConnectionState = "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "OFFLINE";

export function resolveServerUrl(customUrl?: string): string {
  if (customUrl) return customUrl;

  if (typeof window !== "undefined") {
    // 1. Check for URL query parameter: ?server=https://...
    try {
      const params = new URLSearchParams(window.location.search);
      const queryServer = params.get("server");
      if (queryServer) return queryServer;
    } catch {
      // ignore
    }

    // 2. In production (on Render) or when served on custom host, connect to current origin
    if (window.location.hostname !== "localhost" || window.location.port !== "3000") {
      return window.location.origin;
    }
  }

  // 3. Fallback to Vite env or local Node server port 4000
  return (import.meta as any).env?.VITE_SERVER_URL || "http://localhost:4000";
}

export class NetworkClient {
  public socket: Socket | null = null;
  public connectionState: ConnectionState = "DISCONNECTED";
  public prediction: ClientPrediction;
  public interpolator: EntityInterpolator;

  public serverUrl: string;
  public localPlayerId: number | null = null;
  public pingMs: number = 0;

  // Latest received state snapshot
  public latestSync: ServerSyncMessage | null = null;
  public latestInit: ServerInitMessage | null = null;

  // Event handlers
  private eventListeners: ((event: GameEvent) => void)[] = [];
  private syncListeners: ((sync: ServerSyncMessage) => void)[] = [];
  private stateChangeListeners: ((state: ConnectionState) => void)[] = [];

  constructor(serverUrl?: string) {
    this.serverUrl = resolveServerUrl(serverUrl);
    this.prediction = new ClientPrediction();
    this.interpolator = new EntityInterpolator(80); // 80ms interpolation buffer
  }

  public connect(name: string = "Explorer", hairstyle: string = "style_01"): void {
    if (this.socket && this.socket.connected) return;

    this.setConnectionState("CONNECTING");

    try {
      this.socket = io(this.serverUrl, {
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 5000,
      });

      this.socket.on("connect", () => {
        console.log(`[NetworkClient] Connected to server at ${this.serverUrl}`);
        this.setConnectionState("CONNECTED");
        this.socket?.emit("join", { name, hairstyle });
        this.startPingMeasurement();
      });

      this.socket.on("init", (initMsg: ServerInitMessage) => {
        console.log("[NetworkClient] Received init snapshot from server:", initMsg);
        this.latestInit = initMsg;
        this.localPlayerId = initMsg.playerId;
        this.prediction.initPosition(initMsg.player.x, initMsg.player.y);
      });

      this.socket.on("sync", (syncMsg: ServerSyncMessage) => {
        this.latestSync = syncMsg;

        // Push samples to interpolator
        const now = Date.now();

        // Other players
        for (const op of syncMsg.otherPlayers) {
          this.interpolator.pushSample(op.id, op.x, op.y, now);
        }
        // Animals
        for (const a of syncMsg.animals) {
          this.interpolator.pushSample(a.id, a.x, a.y, now);
        }
        // NPCs
        for (const n of syncMsg.npcs) {
          this.interpolator.pushSample(n.id, n.x, n.y, now);
        }
        // Enemies
        for (const e of syncMsg.enemies) {
          this.interpolator.pushSample(e.id, e.x, e.y, now);
        }

        // Reconcile local player prediction with server position
        if (syncMsg.player) {
          this.prediction.reconcile(
            syncMsg.player.x,
            syncMsg.player.y,
            syncMsg.lastProcessedInputSeq,
            syncMsg.player.isSwimming,
            () => true
          );
        }

        // Notify sync listeners
        for (const l of this.syncListeners) {
          l(syncMsg);
        }

        // Dispatch incoming events (audio, VFX, particles)
        if (syncMsg.events && syncMsg.events.length > 0) {
          for (const ev of syncMsg.events) {
            for (const l of this.eventListeners) {
              l(ev);
            }
          }
        }
      });

      this.socket.on("disconnect", (reason) => {
        console.log(`[NetworkClient] Disconnected: ${reason}`);
        this.setConnectionState("DISCONNECTED");
      });

      this.socket.on("connect_error", (err) => {
        console.warn(`[NetworkClient] Connection error:`, err.message);
        this.setConnectionState("OFFLINE");
      });
    } catch (e) {
      console.warn("[NetworkClient] Socket initialization failed:", e);
      this.setConnectionState("OFFLINE");
    }
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.setConnectionState("DISCONNECTED");
  }

  public sendInput(vx: number, vy: number, isSprinting: boolean, seq: number): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit("input", { vx, vy, isSprinting, seq });
    }
  }

  public sendAction(action: ClientActionMessage): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit("action", action);
    }
  }

  public onEvent(callback: (event: GameEvent) => void): () => void {
    this.eventListeners.push(callback);
    return () => {
      const idx = this.eventListeners.indexOf(callback);
      if (idx >= 0) this.eventListeners.splice(idx, 1);
    };
  }

  public onSync(callback: (sync: ServerSyncMessage) => void): () => void {
    this.syncListeners.push(callback);
    return () => {
      const idx = this.syncListeners.indexOf(callback);
      if (idx >= 0) this.syncListeners.splice(idx, 1);
    };
  }

  public onStateChange(callback: (state: ConnectionState) => void): () => void {
    this.stateChangeListeners.push(callback);
    return () => {
      const idx = this.stateChangeListeners.indexOf(callback);
      if (idx >= 0) this.stateChangeListeners.splice(idx, 1);
    };
  }

  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    for (const l of this.stateChangeListeners) {
      l(state);
    }
  }

  private startPingMeasurement(): void {
    setInterval(() => {
      if (!this.socket || !this.socket.connected) return;
      const start = Date.now();
      this.socket.emit("ping", () => {
        this.pingMs = Date.now() - start;
      });
    }, 3000);
  }
}
