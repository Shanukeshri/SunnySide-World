import {
  AnimationRenderState,
  BehaviorState,
  Direction,
  EntityType,
  InteractionState,
  ILivingEntity,
  MovementState,
  NeedsState,
  Position2D,
  SpeciesConfig,
  SpeciesType,
} from './types';
import { EnvironmentDetector } from './EnvironmentDetector';

export abstract class LivingEntity implements ILivingEntity {
  public readonly id: number;
  public readonly type: EntityType;
  public readonly species: SpeciesType;
  public position: Position2D;
  public direction: Direction = 'DOWN';
  public movement: MovementState;
  public behaviorState: BehaviorState = 'IDLE';
  public needs: NeedsState;
  public interaction: InteractionState;
  public anim: AnimationRenderState;
  public health: number;
  public maxHealth: number;
  public isActive: boolean = true;
  public hairstyle?: string;
  public isAquatic?: boolean;
  public deathTimer?: number = 0;

  protected config: SpeciesConfig;

  constructor(id: number, config: SpeciesConfig, initialX: number, initialY: number) {
    this.id = id;
    this.config = config;
    this.type = config.entityType;
    this.species = config.species;

    this.position = { x: initialX, y: initialY };
    this.health = config.health;
    this.maxHealth = config.health;

    this.movement = {
      targetX: null,
      targetY: null,
      speed: config.movementSpeed ?? config.defaultSpeed,
      isMoving: false,
      wanderOriginX: initialX,
      wanderOriginY: initialY,
      wanderRadius: config.wanderRadius,
    };

    this.needs = {
      hunger: 0,
      hungerRate: config.hungerRate,
      hungerThreshold: config.hungerThreshold,
      maxHunger: 100,
    };

    this.interaction = {
      canPet: config.canPet,
      canFeed: config.canFeed,
      isPetted: false,
      pettedTimer: 0,
      pettedDuration: 2.5,
      pettingCooldown: 0,
      heartsEmitted: false,
    };

    this.anim = {
      currentFrame: 0,
      frameTimer: 0,
      frameSpeed: config.spriteAsset.frameSpeed,
      totalFrames: config.spriteAsset.totalFrames,
      eatingBobOffset: 0,
      jumpOffset: 0,
      playerHopOffset: 0,
      flipX: false,
      deathAlpha: 1.0,
    };
  }

  // --- Section 1: Entity System Direct Properties ---

  public get speed(): number {
    return this.movement.speed;
  }
  public set speed(val: number) {
    this.movement.speed = val;
  }

  public get state(): BehaviorState {
    return this.behaviorState;
  }
  public set state(val: BehaviorState) {
    this.behaviorState = val;
  }

  public get target(): Position2D | null {
    if (this.movement.targetX !== null && this.movement.targetY !== null) {
      return { x: this.movement.targetX, y: this.movement.targetY };
    }
    return null;
  }
  public set target(pos: Position2D | null) {
    if (pos) {
      this.setTarget(pos.x, pos.y);
    } else {
      this.clearTarget();
    }
  }

  public get hunger(): number {
    return this.needs.hunger;
  }
  public set hunger(val: number) {
    this.needs.hunger = Math.max(0, Math.min(this.needs.maxHunger, val));
  }

  public get isAlive(): boolean {
    return this.health > 0 && this.behaviorState !== 'DEAD';
  }

  // --- Jump / Hop Animation State ---
  public isJumping: boolean = false;
  protected jumpTimer: number = 0;
  protected jumpDuration: number = 0;
  protected jumpMaxHeight: number = 0;
  protected jumpHopsCount: number = 1;

  /**
   * Triggers a single high jump (e.g. Player jump on Spacebar).
   */
  public triggerJump(height: number = 14, duration: number = 0.38): boolean {
    if (this.isJumping) return false;
    this.isJumping = true;
    this.jumpTimer = 0;
    this.jumpDuration = duration;
    this.jumpMaxHeight = height;
    this.jumpHopsCount = 1;
    return true;
  }

  /**
   * Triggers 3 small-heighted fast jumps in succession (e.g. upon petting / feeding).
   */
  public triggerPetJumps(hopHeight: number = 6.5, singleHopDuration: number = 0.15): void {
    this.isJumping = true;
    this.jumpTimer = 0;
    this.jumpDuration = singleHopDuration * 3; // 3 fast hops total
    this.jumpMaxHeight = hopHeight;
    this.jumpHopsCount = 3;
  }

  /**
   * Updates visual jump offset at 60 FPS.
   * Maintains strict separation: visual position != logical position.
   */
  public updateJumpAnimation(dt: number): void {
    if (!this.isJumping) {
      this.anim.jumpOffset = 0;
      return;
    }

    this.jumpTimer += dt;
    if (this.jumpTimer >= this.jumpDuration) {
      this.isJumping = false;
      this.jumpTimer = 0;
      this.anim.jumpOffset = 0;
      return;
    }

    if (this.jumpHopsCount === 3) {
      // 3 fast consecutive small-heighted hops
      const singleHop = this.jumpDuration / 3;
      const hopProgress = (this.jumpTimer % singleHop) / singleHop;
      this.anim.jumpOffset = Math.sin(hopProgress * Math.PI) * this.jumpMaxHeight;
    } else {
      // Single continuous parabolic jump arc with smooth apex easing
      const progress = Math.min(1.0, this.jumpTimer / this.jumpDuration);
      const rawSine = Math.sin(progress * Math.PI);
      this.anim.jumpOffset = Math.pow(Math.max(0, rawSine), 0.88) * this.jumpMaxHeight;
    }
  }

  /**
   * Sets target destination.
   */
  public setTarget(x: number, y: number): void {
    this.movement.targetX = x;
    this.movement.targetY = y;
    this.movement.isMoving = true;
  }

  /**
   * Clears target destination.
   */
  public clearTarget(): void {
    this.movement.targetX = null;
    this.movement.targetY = null;
    this.movement.isMoving = false;
  }

  /**
   * Smooth continuous movement update at 60 FPS.
   */
  public updateMovement(dt: number, detector: EnvironmentDetector): void {
    // Check death state (Section 28)
    if (this.behaviorState === 'DEAD') {
      if (this.deathTimer && this.deathTimer > 0) {
        this.deathTimer -= dt;
        this.anim.deathAlpha = Math.max(0, this.deathTimer / 1.0);
        if (this.deathTimer <= 0) {
          this.isActive = false;
        }
      } else {
        this.isActive = false;
      }
      return;
    }

    // 1. Advance jump animation if active
    this.updateJumpAnimation(dt);

    // If target is set and moving
    if (this.movement.isMoving && this.movement.targetX !== null && this.movement.targetY !== null) {
      const dx = this.movement.targetX - this.position.x;
      const dy = this.movement.targetY - this.position.y;
      const dist = Math.hypot(dx, dy);

      // Arrival detection threshold
      if (dist < 0.08) {
        this.position.x = this.movement.targetX;
        this.position.y = this.movement.targetY;
        this.clearTarget();
        this.onTargetReached();
        return;
      }

      // Compute step: direction = normalize(target - position); position += direction * speed * deltaTime
      const step = this.movement.speed * dt;
      const moveDist = Math.min(step, dist);
      const nx = this.position.x + (dx / dist) * moveDist;
      const ny = this.position.y + (dy / dist) * moveDist;

      // Section 13: Animal direction UP, DOWN, LEFT, RIGHT
      if (Math.abs(dx) > Math.abs(dy)) {
        this.direction = dx > 0 ? 'RIGHT' : 'LEFT';
        // Sunnyside animal sprites face LEFT natively, while human characters face RIGHT natively
        if (this.type === 'ANIMAL') {
          this.anim.flipX = dx > 0;
        } else {
          this.anim.flipX = dx < 0;
        }
      } else {
        this.direction = dy > 0 ? 'DOWN' : 'UP';
      }

      // Section 12: Movement collision - isWalkable(nextPosition)
      if (detector.isWalkable(nx, ny, Boolean(this.config.isAquatic), Boolean(this.config.isAquatic))) {
        this.position.x = nx;
        this.position.y = ny;
      } else {
        // Collided with obstacle or boundary: stop current path
        this.clearTarget();
        this.onMovementBlocked();
      }
    }

    // Update sprite animation frame (walking animation during WANDER, idle when stopped)
    this.updateAnimation(dt);
  }

  /**
   * Section 14: Sprite frame cycling
   */
  protected updateAnimation(dt: number): void {
    if (this.movement.isMoving) {
      this.anim.frameTimer += dt;
      if (this.anim.frameTimer >= this.anim.frameSpeed) {
        this.anim.frameTimer = 0;
        this.anim.currentFrame = (this.anim.currentFrame + 1) % this.anim.totalFrames;
      }
    } else {
      // In IDLE state, keep resting/idle frame
      this.anim.currentFrame = 0;
      this.anim.frameTimer = 0;
    }
  }

  /**
   * Abstract hooks for subclasses
   */
  public abstract updateAI(dt: number, detector: EnvironmentDetector): void;
  protected abstract onTargetReached(): void;
  protected abstract onMovementBlocked(): void;

  /**
   * Section 28: Animal death support
   */
  public takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.behaviorState = 'DEAD';
      this.clearTarget();
      this.deathTimer = 1.0;
      this.anim.deathAlpha = 1.0;
    }
  }
}
