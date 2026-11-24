import {
  insertCoin,
  isHost,
  myPlayer,
  onPlayerJoin,
  getRoomCode,
  setState,
  getState,
  waitForState,
  RPC,
  Joystick,
  PlayerState,
} from "playroomkit";
import { SnapshotInterpolation } from "@geckos.io/snapshot-interpolation";
import { SPRINT_SPEED, WALK_SPEED, SWIM_MULTIPLIER } from "../game/MovementConstants";

export type SnapshotPlayer = {
  sessionId: string;
  name: string;
  hairstyle: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  direction: string;
  facing: "LEFT" | "RIGHT";
  health: number;
  hunger: number;
  stamina: number;
  isSprinting: boolean;
  lastProcessedInputSeq: number;
  activeHeldItem?: string | null;
  activeHotbarIndex?: number;
  hopTimer?: number;
  hopOffset?: number;
  swingTimer?: number;
  hurtTimer?: number;
  rollTimer?: number;
  isBlocking?: boolean;
};

export type Snapshot = {
  tick: number;
  seed: number;
  roomCode: string;
  hostSessionId?: string;
  entities?: any;
  players: SnapshotPlayer[];
  serverTimeMs?: number;
};

/**
 * Jitter Removal via @geckos.io/snapshot-interpolation.
 * Every incoming position update is pushed into a snapshot buffer (SI.snapshot.add),
 * and on every frame SI.calcInterpolation() blends between buffered frames so
 * remote players and entities glide smoothly instead of stuttering.
 */
export class SnapshotEntityInterpolator {
  private interpolators = new Map<string | number, SnapshotInterpolation>();
  private latestPositions = new Map<
    string | number,
    { x: number; y: number; vx: number; vy: number; time: number }
  >();

  private getSI(id: string | number): SnapshotInterpolation {
    let si = this.interpolators.get(id);
    if (!si) {
      // 25-30 FPS tick rate with 100ms interpolation buffer window
      si = new SnapshotInterpolation(25);
      si.interpolationBuffer.set(100);
      this.interpolators.set(id, si);
    }
    return si;
  }

  public push(id: string | number, x: number, y: number, vx = 0, vy = 0, time = Date.now()) {
    this.latestPositions.set(id, { x, y, vx, vy, time });
    const si = this.getSI(id);
    si.snapshot.add({
      id: SnapshotInterpolation.NewId(),
      time,
      state: [{ id: String(id), x, y, vx, vy }],
    });
  }

  public getInterpolatedEntity(
    id: string | number,
    currentX: number,
    currentY: number,
    dt: number = 0.016,
  ) {
    const last = this.latestPositions.get(id);
    if (!last) {
      return { x: currentX, y: currentY, vx: 0, vy: 0, isMoving: false };
    }

    const si = this.interpolators.get(id);
    let targetX = currentX;
    let targetY = currentY;
    let targetVx = last.vx;
    let targetVy = last.vy;
    let interpolated = false;

    if (si) {
      const interp = si.calcInterpolation("x y vx vy");
      if (interp && interp.state && interp.state.length > 0) {
        const s = interp.state[0] as any;
        targetX = s.x;
        targetY = s.y;
        if (typeof s.vx === "number") targetVx = s.vx;
        if (typeof s.vy === "number") targetVy = s.vy;
        interpolated = true;
      }
    }

    if (!interpolated) {
      // Smooth extrapolation / lerp toward latest known position when buffer is catching up
      const dx = last.x - currentX;
      const dy = last.y - currentY;
      const dist = Math.hypot(dx, dy);
      if (dist > 3.0) {
        targetX = last.x;
        targetY = last.y;
      } else {
        const lerpFactor = Math.min(1.0, dt * 10);
        targetX = currentX + dx * lerpFactor + targetVx * dt;
        targetY = currentY + dy * lerpFactor + targetVy * dt;
      }
    }

    const dist = Math.hypot(targetX - currentX, targetY - currentY);

    // Instant snap if teleported or too far out of sync (> 4 tiles)
    if (dist > 4.0) {
      return {
        x: targetX,
        y: targetY,
        vx: targetVx,
        vy: targetVy,
        isMoving: Math.hypot(targetVx, targetVy) > 0.02,
      };
    }

    const hasVelocity = Math.hypot(targetVx, targetVy) > 0.02;
    const isClosingDistance = dist > 0.008;
    const isMoving = hasVelocity || isClosingDistance;

    const effVx = hasVelocity ? targetVx : (dt > 0 ? (targetX - currentX) / dt : 0);
    const effVy = hasVelocity ? targetVy : (dt > 0 ? (targetY - currentY) / dt : 0);

    return {
      x: targetX,
      y: targetY,
      vx: isMoving ? effVx : 0,
      vy: isMoving ? effVy : 0,
      isMoving,
    };
  }
}

/**
 * Client Prediction for 0-latency local movement responsiveness.
 */
export class ClientPrediction {
  private seq = 0;
  private x = 22;
  private y = 18;
  private visualX = 22;
  private visualY = 18;
  private pending: Array<{ seq: number; vx: number; vy: number; isSprinting: boolean; dt: number }> = [];

  public get predictedX() { return this.x; }
  public get predictedY() { return this.y; }

  public reset(x: number, y: number) {
    this.x = this.visualX = x;
    this.y = this.visualY = y;
    this.seq = 0;
    this.pending = [];
  }

  public stepMovement(
    startX: number,
    startY: number,
    vx: number,
    vy: number,
    sprint: boolean,
    swimming: boolean,
    dt: number,
    canMove: (x: number, y: number) => boolean,
  ) {
    const length = Math.hypot(vx, vy);
    if (!length) return { x: startX, y: startY, vx: 0, vy: 0 };
    const nvx = vx / length;
    const nvy = vy / length;
    const speed = (sprint ? SPRINT_SPEED : WALK_SPEED) * (swimming ? SWIM_MULTIPLIER : 1);
    const nx = startX + nvx * speed * dt;
    const ny = startY + nvy * speed * dt;
    if (canMove(nx, ny)) {
      return { x: nx, y: ny, vx: nvx, vy: nvy };
    }
    let resX = startX;
    let resY = startY;
    if (canMove(nx, startY)) resX = nx;
    if (canMove(startX, ny)) resY = ny;
    return { x: resX, y: resY, vx: nvx, vy: nvy };
  }

  public predictMovement(
    vx: number,
    vy: number,
    sprint: boolean,
    swimming: boolean,
    dt: number,
    canMove: (x: number, y: number) => boolean,
  ) {
    const res = this.stepMovement(this.x, this.y, vx, vy, sprint, swimming, dt, canMove);
    this.x = res.x;
    this.y = res.y;
    this.visualX = this.x;
    this.visualY = this.y;
    const input = { vx: res.vx, vy: res.vy, isSprinting: sprint, seq: ++this.seq, dt };
    this.pending.push(input);
    if (this.pending.length > 60) this.pending.shift();
    return input;
  }

  public reconcile(player: SnapshotPlayer, canMove?: (x: number, y: number) => boolean) {
    this.pending = this.pending.filter((input) => input.seq > player.lastProcessedInputSeq);
    this.x = player.x;
    this.y = player.y;
    for (const input of this.pending) {
      if (canMove) {
        const res = this.stepMovement(this.x, this.y, input.vx, input.vy, input.isSprinting, false, input.dt, canMove);
        this.x = res.x;
        this.y = res.y;
      } else {
        const speed = input.isSprinting ? SPRINT_SPEED : WALK_SPEED;
        this.x += input.vx * speed * input.dt;
        this.y += input.vy * speed * input.dt;
      }
    }
    this.visualX += (this.x - this.visualX) * 0.35;
    this.visualY += (this.y - this.visualY) * 0.35;
  }

  public updateSmoothing(_dt: number) {
    this.visualX += (this.x - this.visualX) * 0.15;
    this.visualY += (this.y - this.visualY) * 0.15;
  }

  public getVisualPosition() {
    return { x: this.visualX, y: this.visualY };
  }
}

/**
 * Option B: Zero-Backend WebRTC-First Architecture via PlayroomKit & @geckos.io/snapshot-interpolation.
 * - Static Hosting (Cloudflare Pages): 100% client-side zero-backend multiplayer.
 * - PlayroomKit: Lobby UI, room management, automatic host assignment (isHost()).
 * - WebRTC-First Fast Movement: player.setState("pos", {...}, false) for lowest latency unreliable streaming.
 * - Automatic WebSocket Fallback: Handled transparently by Playroom if WebRTC fails.
 * - WebSockets for Critical Events: reliable = true for seeds, scores, picks, structures, and RPC.
 * - Mobile Controls: Playroom Joystick touch dpad & buttons on screen.
 */
export class NetworkClient {
  public connectionState: "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "LOCAL_SERVER" = "DISCONNECTED";
  public isHost = false;
  public readonly prediction = new ClientPrediction();
  public readonly interpolator = new SnapshotEntityInterpolator();
  public roomCode = "";
  public seed = 123456;
  public mobileJoystick: any = null;
  public mobileControlsVisible = false;

  private players = new Map<string, PlayerState>();
  private localPlayerState: PlayerState | null = null;
  private identity = { name: "Explorer", hairstyle: "mophair" };
  private tick = 0;
  private snapshotInterval: any = null;
  private lastEntitiesTime = 0;

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
    this.onSnapshot = options.onSnapshot;
    this.onJoined = options.onJoined;
    this.onStatus = options.onStatus;
    this.onAction = options.onAction;
    this.onSyncEntities = options.onSyncEntities;

    // Detect if running on mobile device to auto-show mobile controls
    const isMobile =
      typeof navigator !== "undefined" &&
      (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints && navigator.maxTouchPoints > 0));
    this.mobileControlsVisible = Boolean(isMobile);
  }

  public get clientId(): string {
    return this.localPlayerState?.id || "";
  }

  /**
   * Host a shared world using PlayroomKit lobby UI.
   */
  public async hostWorld(name: string, hairstyle: string, options?: { skipLobby?: boolean; streamMode?: boolean }) {
    this.identity = { name: name || "Host", hairstyle: hairstyle || "mophair" };
    this.connectionState = "CONNECTING";
    this.onStatus("Opening Playroom Lobby…", 1);

    try {
      await insertCoin({
        gameId: "rtcgame-survival",
        skipLobby: options?.skipLobby ?? false,
        streamMode: options?.streamMode ?? false,
      });

      this.localPlayerState = myPlayer();
      this.isHost = isHost();
      this.roomCode = getRoomCode() || "ROOM";

      // The host generates and syncs the shared deterministic world seed via WebSockets (reliable = true)
      if (this.isHost) {
        this.seed = Math.floor(Math.random() * 1000000);
        setState("worldSeed", this.seed, true);
      } else {
        const remoteSeed = await waitForState<number>("worldSeed");
        this.seed = remoteSeed || 123456;
      }

      this.setupPlayroomNetworking();
      this.initMobileControls();

      this.connectionState = "CONNECTED";
      this.onStatus(`Online · ${this.roomCode}`, this.players.size || 1);

      this.prediction.reset(22, 18);
      this.onJoined({
        tick: 0,
        seed: this.seed,
        roomCode: this.roomCode,
        hostSessionId: this.isHost ? this.clientId : undefined,
        players: this.buildSnapshotPlayers(),
      });
    } catch (err: any) {
      console.error("Playroom host error:", err);
      this.connectionState = "DISCONNECTED";
      this.onStatus(err?.message || "Multiplayer failed to launch", 1);
    }
  }

  /**
   * Join an existing world via room code using PlayroomKit.
   */
  public async joinWorld(code: string, name: string, hairstyle: string, options?: { skipLobby?: boolean }) {
    const cleanCode = code.trim().toUpperCase();
    this.identity = { name: name || "Explorer", hairstyle: hairstyle || "mophair" };
    this.connectionState = "CONNECTING";
    this.onStatus(`Connecting to ${cleanCode}…`, 1);

    try {
      await insertCoin({
        gameId: "rtcgame-survival",
        roomCode: cleanCode,
        skipLobby: options?.skipLobby ?? false,
      });

      this.localPlayerState = myPlayer();
      this.isHost = isHost();
      this.roomCode = getRoomCode() || cleanCode;

      // Guest receives host's deterministic procedural seed
      const remoteSeed = await waitForState<number>("worldSeed");
      this.seed = remoteSeed || 123456;

      this.setupPlayroomNetworking();
      this.initMobileControls();

      this.connectionState = "CONNECTED";
      this.onStatus(`Online · ${this.roomCode}`, this.players.size || 1);

      this.prediction.reset(22, 18);
      this.onJoined({
        tick: 0,
        seed: this.seed,
        roomCode: this.roomCode,
        hostSessionId: this.isHost ? this.clientId : undefined,
        players: this.buildSnapshotPlayers(),
      });
    } catch (err: any) {
      console.error("Playroom join error:", err);
      this.connectionState = "DISCONNECTED";
      this.onStatus(err?.message || `Unable to join room ${cleanCode}`, 1);
    }
  }

  /**
   * Wire up player state listeners, RPC channels, and the 30Hz snapshot loop.
   */
  private setupPlayroomNetworking() {
    // 1. Register players
    onPlayerJoin((player: PlayerState) => {
      this.players.set(player.id, player);
      player.onQuit(() => {
        this.players.delete(player.id);
        this.onStatus(`Online · ${this.roomCode}`, this.players.size);
      });
      this.onStatus(`Online · ${this.roomCode}`, this.players.size);
    });

    // 2. Register RPC for guaranteed reliable events (WebSockets)
    RPC.register("playerAction", async (action: any, sender: PlayerState) => {
      this.onAction?.({ sessionId: sender.id, ...action });
    });

    // 3. Register RPC for direct entity sync if needed
    RPC.register("syncEntities", async (entities: any, sender: PlayerState) => {
      if (!this.isHost) {
        this.onSyncEntities?.(entities);
      }
    });

    // 4. Set self profile
    if (this.localPlayerState) {
      this.localPlayerState.setState("profile", this.identity, true);
      this.localPlayerState.setState(
        "pos",
        {
          x: 22,
          y: 18,
          vx: 0,
          vy: 0,
          direction: "DOWN",
          facing: "RIGHT",
          isMoving: false,
          isSprinting: false,
          time: Date.now(),
        },
        false, // WebRTC fast position update
      );
    }

    // 5. Periodic Snapshot & Entity Sync Loop (30 FPS)
    if (this.snapshotInterval) clearInterval(this.snapshotInterval);
    this.snapshotInterval = setInterval(() => {
      this.pollNetworkState();
    }, 33);
  }

  /**
   * Send continuous position inputs.
   * reliable = false sends directly over WebRTC Data Channel for lowest latency.
   * Playroom automatically falls back to WebSockets on restrictive networks.
   */
  public sendInput(
    vx: number,
    vy: number,
    isSprinting: boolean,
    seq: number,
    dt: number,
    extra?: { activeHeldItem?: string | null; activeHotbarIndex?: number },
  ) {
    if (!this.localPlayerState) return;

    const position = this.prediction.getVisualPosition();
    const speed = isSprinting ? SPRINT_SPEED : WALK_SPEED;
    const direction =
      Math.abs(vx) > Math.abs(vy)
        ? vx > 0
          ? "RIGHT"
          : "LEFT"
        : vy > 0
        ? "DOWN"
        : "UP";
    const facing = vx < 0 ? "LEFT" : "RIGHT";
    const isMoving = Math.hypot(vx, vy) > 0.01;

    // WebRTC First: reliable = false for fast unreliable packets
    this.localPlayerState.setState(
      "pos",
      {
        x: position.x,
        y: position.y,
        vx: vx * speed,
        vy: vy * speed,
        isSprinting,
        direction,
        facing,
        isMoving,
        seq,
        dt,
        time: Date.now(),
        ...extra,
      },
      false, // Unreliable = WebRTC Data Channel
    );
  }

  /**
   * WebSockets for Critical Events: scores, attacks, item pickups, structures.
   * RPC guarantees delivery without drops.
   */
  public sendAction(action: { type: string; [key: string]: any }) {
    if (!action.actionId) {
      action.actionId = `${this.clientId || "client"}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    }
    RPC.call("playerAction", action, RPC.Mode.ALL);
  }

  /**
   * Host broadcasts world entities (animals, NPCs, enemies, clock, items).
   * Rapid updates use WebRTC (reliable = false), structures use reliable = true.
   */
  public sendEntitiesSync(entities: any) {
    if (!this.isHost) return;
    setState("worldEntities", { ...entities, time: Date.now() }, false);
    // Also broadcast via RPC so peers receive updates directly without waiting on room-state polls
    RPC.call("syncEntities", entities, RPC.Mode.OTHERS);
    if (entities.placedStructures || entities.depletedResources) {
      setState(
        "worldEntitiesReliable",
        {
          depletedResources: entities.depletedResources,
          placedStructures: entities.placedStructures,
          placedBlocks: entities.placedBlocks,
        },
        true, // WebSockets for structural world modifications
      );
    }
  }

  /**
   * Periodic polling that reads Playroom state and pushes into SnapshotInterpolation.
   */
  private pollNetworkState() {
    if (this.connectionState !== "CONNECTED") return;

    // Update host status if Playroom migrated host
    this.isHost = isHost();

    // 1. Build players list
    const snapshotPlayers = this.buildSnapshotPlayers();

    // 2. If guest, sync world entities from host
    if (!this.isHost) {
      const entities = getState("worldEntities");
      if (entities && entities.time && entities.time !== this.lastEntitiesTime) {
        this.lastEntitiesTime = entities.time;
        this.onSyncEntities?.(entities);
      }
      const reliable = getState("worldEntitiesReliable");
      if (reliable) {
        this.onSyncEntities?.(reliable);
      }
    }

    // 3. Emit local snapshot to main game loop
    this.onSnapshot({
      tick: ++this.tick,
      seed: this.seed,
      roomCode: this.roomCode,
      hostSessionId: this.isHost ? this.clientId : undefined,
      players: snapshotPlayers,
      serverTimeMs: Date.now(),
    });
  }

  private buildSnapshotPlayers(): SnapshotPlayer[] {
    const list: SnapshotPlayer[] = [];
    this.players.forEach((player) => {
      const pos = player.getState("pos");
      const profile = player.getState("profile") || player.getProfile() || {};
      const id = player.id;

      const sp: SnapshotPlayer = {
        sessionId: id,
        name: profile.name || "Explorer",
        hairstyle: profile.hairstyle || "mophair",
        x: pos?.x ?? 22,
        y: pos?.y ?? 18,
        vx: pos?.vx ?? 0,
        vy: pos?.vy ?? 0,
        direction: pos?.direction || "DOWN",
        facing: pos?.facing || "RIGHT",
        health: pos?.health ?? 100,
        hunger: pos?.hunger ?? 100,
        stamina: pos?.stamina ?? 100,
        isSprinting: Boolean(pos?.isSprinting),
        lastProcessedInputSeq: pos?.seq ?? 0,
        activeHeldItem: pos?.activeHeldItem,
        activeHotbarIndex: pos?.activeHotbarIndex,
        hopTimer: pos?.hopTimer,
        hopOffset: pos?.hopOffset,
        swingTimer: pos?.swingTimer,
        hurtTimer: pos?.hurtTimer,
        rollTimer: pos?.rollTimer,
        isBlocking: pos?.isBlocking,
      };
      list.push(sp);

      // Push remote players into @geckos.io/snapshot-interpolation
      if (id !== this.clientId && pos) {
        this.interpolator.push(id, sp.x, sp.y, sp.vx, sp.vy, Date.now());
      }
    });
    return list;
  }

  /**
   * Initializes mobile touch controls using PlayroomKit's Joystick.
   * Creates an on-screen D-Pad and action buttons on mobile screens.
   */
  public initMobileControls() {
    if (this.mobileJoystick || !this.localPlayerState) return;

    try {
      this.mobileJoystick = new Joystick(this.localPlayerState, {
        type: "dpad",
        buttons: [
          { id: "action", label: "⚔️" },
          { id: "sprint", label: "🏃" },
          { id: "roll", label: "⚡" },
          { id: "interact", label: "✋" },
        ],
        zones: {
          up: { id: "up", label: "▲" },
          down: { id: "down", label: "▼" },
          left: { id: "left", label: "◀" },
          right: { id: "right", label: "▶" },
        },
      });

      this.applyMobileControlStyles();
    } catch (e) {
      console.warn("Playroom Joystick initialization note:", e);
    }
  }

  /**
   * Toggles the visibility of mobile touch controls on screen.
   */
  public toggleMobileControls(force?: boolean): boolean {
    this.mobileControlsVisible = force !== undefined ? force : !this.mobileControlsVisible;
    this.applyMobileControlStyles();
    return this.mobileControlsVisible;
  }

  private applyMobileControlStyles() {
    const joystickEl = document.getElementById("pr-joystick");
    const displayVal = this.mobileControlsVisible ? "block" : "none";
    if (joystickEl) {
      joystickEl.style.display = displayVal;
      joystickEl.style.zIndex = "9999";
    }
    // Also toggle Playroom action buttons
    const buttons = document.querySelectorAll<HTMLElement>("div[style*='position: fixed']");
    buttons.forEach((btn) => {
      if (btn.id !== "main-menu" && btn.id !== "hud" && btn.id !== "game-container") {
        btn.style.display = displayVal;
        btn.style.zIndex = "9999";
      }
    });
  }

  public getMobileMovement(): { dx: number; dy: number; isSprinting: boolean } {
    if (!this.mobileJoystick) return { dx: 0, dy: 0, isSprinting: false };

    let dx = 0;
    let dy = 0;
    const dpad = this.mobileJoystick.dpad?.() || {};

    if (dpad.x === "left") dx -= 1;
    if (dpad.x === "right") dx += 1;
    if (dpad.y === "up") dy -= 1;
    if (dpad.y === "down") dy += 1;

    if (this.mobileJoystick.isJoystickPressed?.()) {
      const angle = this.mobileJoystick.angle?.() || 0;
      dx += Math.sin(angle);
      dy -= Math.cos(angle);
    }

    const isSprinting = Boolean(this.mobileJoystick.isPressed?.("sprint"));
    return { dx, dy, isSprinting };
  }
}
