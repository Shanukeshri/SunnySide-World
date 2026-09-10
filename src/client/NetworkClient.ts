/**
 * NetworkClient.ts - Real-Time Network Client for Authoritative Simulation
 * 
 * Implements Sections 1, 2, 7, 8, 9, 11, 26, 33 of implementation_spec.txt:
 * Manages connection to the authoritative server (Node.js Socket.IO or Embedded Local GameServer),
 * client-side prediction, entity interpolation, reconnection with persistent session tokens,
 * and unified event dispatching.
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
import { GameServer } from "../server/GameServer";

export type ConnectionState = "CONNECTING" | "CONNECTED" | "LOCAL_SERVER" | "DISCONNECTED" | "OFFLINE";

export function getOrCreateSessionToken(): string {
  if (typeof window === "undefined") return "token_node_fallback";
  try {
    let token = window.localStorage.getItem("sunnyside_session_token");
    if (!token) {
      token = `tok_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`;
      window.localStorage.setItem("sunnyside_session_token", token);
    }
    return token;
  } catch {
    return "token_memory_fallback";
  }
}

export function resolveServerUrl(customUrl?: string): string {
  if (customUrl) return customUrl;

  if (typeof window !== "undefined") {
    // 1. Check URL query parameter: ?server=https://...
    try {
      const params = new URLSearchParams(window.location.search);
      const queryServer = params.get("server");
      if (queryServer) return queryServer;
    } catch {
      // ignore
    }

    // 2. In production or when served from custom origin
    if (window.location.hostname !== "localhost" || window.location.port !== "3000") {
      return window.location.origin;
    }
  }

  // 3. Local Node server port 4000
  return (import.meta as any).env?.VITE_SERVER_URL || "http://localhost:4000";
}

export interface ISocketLike {
  id?: string;
  connected?: boolean;
  emit(event: string, ...args: any[]): void;
  on(event: string, handler: (...args: any[]) => void): void;
  disconnect(): void;
}

export class NetworkClient {
  public socket: ISocketLike | null = null;
  public connectionState: ConnectionState = "DISCONNECTED";
  public prediction: ClientPrediction;
  public interpolator: EntityInterpolator;
  public localServer: GameServer | null = null;

  public serverUrl: string;
  public sessionToken: string;
  public localPlayerId: number | null = null;
  public pingMs: number = 0;

  // Latest received state snapshot
  public latestSync: ServerSyncMessage | null = null;
  public latestInit: ServerInitMessage | null = null;

  // Event handlers
  private eventListeners: ((event: GameEvent) => void)[] = [];
  private syncListeners: ((sync: ServerSyncMessage) => void)[] = [];
  private initListeners: ((init: ServerInitMessage) => void)[] = [];
  private stateChangeListeners: ((state: ConnectionState) => void)[] = [];

  public collisionChecker: ((x: number, y: number) => boolean) | null = null;

  constructor(serverUrl?: string) {
    this.serverUrl = resolveServerUrl(serverUrl);
    this.sessionToken = getOrCreateSessionToken();
    this.prediction = new ClientPrediction();
    this.interpolator = new EntityInterpolator(90); // 90ms interpolation buffer
  }

  public connect(name: string = "Explorer", hairstyle: string = "style_01"): void {
    if (this.socket && (this.socket as any).connected) return;

    this.setConnectionState("CONNECTING");

    let connectTimeout: any = null;

    try {
      const realSocket = io(this.serverUrl, {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1500,
        timeout: 3000,
      });
      this.socket = realSocket;

      // Fallback timer: if real Socket.IO fails to connect within 2.5s, launch embedded local server (Section 33)
      connectTimeout = setTimeout(() => {
        if (this.connectionState === "CONNECTING") {
          console.log("[NetworkClient] Network server unreachable; falling back to authoritative local server...");
          realSocket.disconnect();
          this.startLocalServer(name, hairstyle);
        }
      }, 2500);

      realSocket.on("connect", () => {
        if (connectTimeout) clearTimeout(connectTimeout);
        console.log(`[NetworkClient] Connected to authoritative server at ${this.serverUrl}`);
        this.setConnectionState("CONNECTED");
        this.socket?.emit("join", { name, hairstyle, token: this.sessionToken });
        this.startPingMeasurement();
      });

      this.setupSocketHandlers(realSocket, name, hairstyle);

      realSocket.on("connect_error", (err) => {
        console.warn(`[NetworkClient] Connection error:`, err.message);
        if (this.connectionState === "CONNECTING") {
          if (connectTimeout) clearTimeout(connectTimeout);
          this.startLocalServer(name, hairstyle);
        } else if (this.connectionState === "CONNECTED") {
          this.setConnectionState("OFFLINE");
        }
      });
    } catch (e) {
      console.warn("[NetworkClient] Socket initialization failed:", e);
      if (connectTimeout) clearTimeout(connectTimeout);
      this.startLocalServer(name, hairstyle);
    }
  }

  /**
   * Runs the exact same authoritative GameServer simulation locally in-client.
   * Unifies single-player and multiplayer on the exact same simulation model (Section 33).
   */
  public startLocalServer(name: string = "Explorer", hairstyle: string = "style_01", seed = 42891): void {
    if (this.localServer) {
      this.localServer.stop();
    }

    console.log("[NetworkClient] Initializing authoritative local GameServer simulation (20 Hz)...");
    this.localServer = new GameServer(seed, 20);
    this.localServer.start();

    const localTransport = this.localServer.createLocalClientTransport();
    this.socket = {
      ...localTransport,
      connected: true,
    };

    this.setConnectionState("LOCAL_SERVER");
    this.setupSocketHandlers(this.socket, name, hairstyle);

    // Join local authoritative world
    this.socket.emit("join", { name, hairstyle, token: this.sessionToken });
  }

  private setupSocketHandlers(sock: ISocketLike, name: string, hairstyle: string): void {
    sock.on("init", (initMsg: ServerInitMessage) => {
      console.log("[NetworkClient] Received authoritative init snapshot from server:", initMsg);
      this.latestInit = initMsg;
      this.localPlayerId = initMsg.playerId;
      this.prediction.initPosition(initMsg.player.x, initMsg.player.y);
      for (const l of this.initListeners) {
        l(initMsg);
      }
    });

    sock.on("sync", (syncMsg: ServerSyncMessage) => {
      this.latestSync = syncMsg;

      // Push samples to snapshot interpolator (Section 11)
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

      // Reconcile local player prediction with authoritative server position (Section 9)
      if (syncMsg.player) {
        const canMove = this.collisionChecker || (() => true);
        this.prediction.reconcile(
          syncMsg.player.x,
          syncMsg.player.y,
          syncMsg.lastProcessedInputSeq,
          syncMsg.player.isSwimming,
          canMove
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

    sock.on("disconnect", (reason?: any) => {
      console.log(`[NetworkClient] Disconnected:`, reason);
      if (this.connectionState !== "LOCAL_SERVER") {
        this.setConnectionState("DISCONNECTED");
      }
    });
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    if (this.localServer) {
      this.localServer.stop();
      this.localServer = null;
    }
    this.setConnectionState("DISCONNECTED");
  }

  public sendInput(vx: number, vy: number, isSprinting: boolean, seq: number, dt: number = 0.016): void {
    if (this.socket) {
      this.socket.emit("input", { vx, vy, isSprinting, seq, dt });
    }
  }

  public sendAction(action: ClientActionMessage): void {
    if (this.socket) {
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

  public onInit(callback: (init: ServerInitMessage) => void): () => void {
    this.initListeners.push(callback);
    return () => {
      const idx = this.initListeners.indexOf(callback);
      if (idx >= 0) this.initListeners.splice(idx, 1);
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
      if (!this.socket || (this.connectionState !== "CONNECTED")) return;
      const start = Date.now();
      this.socket.emit("ping", () => {
        this.pingMs = Date.now() - start;
      });
    }, 3000);
  }
}
