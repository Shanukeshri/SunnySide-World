/**
 * EventBus.ts - Authoritative Game Simulation Event System
 * 
 * Implements Section 11 of authoritative_server.txt:
 * Decoupled event system emitting discrete simulation occurrences that are
 * packaged into network tick deltas and processed by client audio/VFX.
 */

export type GameEventType =
  | "PLAYER_JOINED"
  | "PLAYER_LEFT"
  | "ENTITY_SPAWNED"
  | "ENTITY_DESTROYED"
  | "ITEM_PICKED_UP"
  | "TREE_HIT"
  | "TREE_DESTROYED"
  | "ROCK_HIT"
  | "ROCK_DESTROYED"
  | "ANIMAL_PETTED"
  | "ANIMAL_FED"
  | "ANIMAL_HURT"
  | "NPC_DIALOGUE"
  | "PLAYER_DAMAGED"
  | "PLAYER_RESPAWNED"
  | "ENEMY_ATTACKED"
  | "ENTITY_DIED"
  | "ITEM_CRAFTED"
  | "BUILDING_PLACED"
  | "TOOL_BROKE"
  | "FLOATING_TEXT"
  | "AUDIO_TRIGGER";

export interface GameEvent<T = any> {
  id: number;
  type: GameEventType;
  tick: number;
  timestamp: number;
  payload: T;
}

export type EventHandler<T = any> = (event: GameEvent<T>) => void;

export class EventBus {
  private handlers = new Map<GameEventType, EventHandler[]>();
  private queuedEvents: GameEvent[] = [];
  private nextEventId = 1;
  private currentTick = 0;

  public setTick(tick: number): void {
    this.currentTick = tick;
  }

  public on<T = any>(type: GameEventType, handler: EventHandler<T>): () => void {
    const list = this.handlers.get(type) || [];
    list.push(handler);
    this.handlers.set(type, list);
    return () => {
      const idx = list.indexOf(handler);
      if (idx >= 0) list.splice(idx, 1);
    };
  }

  public emit<T = any>(type: GameEventType, payload: T): GameEvent<T> {
    const event: GameEvent<T> = {
      id: this.nextEventId++,
      type,
      tick: this.currentTick,
      timestamp: Date.now(),
      payload,
    };

    // Notify local subscribers
    const list = this.handlers.get(type);
    if (list) {
      for (const h of list) {
        h(event);
      }
    }

    // Queue for network broadcast
    this.queuedEvents.push(event);
    return event;
  }

  /**
   * Clears and returns queued events for network broadcast on the current tick.
   */
  public flushQueue(): GameEvent[] {
    const events = this.queuedEvents;
    this.queuedEvents = [];
    return events;
  }
}
