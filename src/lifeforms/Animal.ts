import { LivingEntity } from './LivingEntity';
import { SpeciesConfig } from './types';
import { EnvironmentDetector } from './EnvironmentDetector';
import { generateRandom, randomRange } from './rng';

export class Animal extends LivingEntity {
  private stateTimer: number = 0;
  private eatingElapsedTime: number = 0;
  private isHeadingToFood: boolean = false;
  private fleeTimer: number = 0;
  private fleeSourceX: number = 0;
  private fleeSourceY: number = 0;

  constructor(id: number, config: SpeciesConfig, initialX: number, initialY: number) {
    super(id, config, initialX, initialY);
    // Initial random idle state
    this.enterIdleState();
  }

  /**
   * Throttled AI Decision Tick (called at 5-10 Hz by LifeformManager).
   * Strict Priority Hierarchy:
   *   FLEE (highest priority when threatened / struck)
   *   PETTED
   *   EATING
   *   WANDER
   *   IDLE (lowest)
   */
  public updateAI(dt: number, detector: EnvironmentDetector): void {
    if (this.behaviorState === 'DEAD') {
      return;
    }

    // 0. FLEE State: Animal was struck or spooked - sprints away from danger!
    if (this.behaviorState === 'FLEE') {
      this.fleeTimer -= dt;
      if (this.fleeTimer <= 0) {
        // Calm down: restore regular movement speed and return to idle
        this.movement.speed = this.config.movementSpeed ?? this.config.defaultSpeed;
        this.enterIdleState();
        return;
      }

      // If finished current sprint step or stopped, pick another sprint waypoint away from danger
      if (!this.movement.isMoving && this.fleeTimer > 0) {
        this.sprintAwayFrom(this.fleeSourceX, this.fleeSourceY, detector);
      }
      return;
    }

    // 1. Tick Petting Cooldown (Section 25: prevents spamming)
    if (this.interaction.pettingCooldown > 0) {
      this.interaction.pettingCooldown = Math.max(0, this.interaction.pettingCooldown - dt);
    }

    // 2. Section 21 & 22: PETTED State (high priority)
    if (this.interaction.isPetted) {
      this.interaction.pettedTimer -= dt;
      if (this.interaction.pettedTimer <= 0) {
        this.interaction.isPetted = false;
        this.enterIdleState();
      }
      this.behaviorState = 'PETTED';
      this.clearTarget();
      return;
    }

    // 3. Section 18: Hunger Progression
    this.needs.hunger = Math.min(
      this.needs.maxHunger,
      this.needs.hunger + this.needs.hungerRate * dt
    );

    // 4. Section 16 & 17: EATING State & Eating Animation
    if (this.behaviorState === 'EATING') {
      this.stateTimer -= dt;
      this.eatingElapsedTime += dt;

      // Section 17: Eating visual oscillation (baseY - smallOffset ... baseY + smallOffset)
      // Visual only: logical world position is completely untouched!
      this.anim.eatingBobOffset = Math.sin(this.eatingElapsedTime * 8.0) * 2.2;

      if (this.stateTimer <= 0) {
        // Section 2: generateRandom(id) deciding whether to continue eating
        const continueEatingChance = this.needs.hunger > 30 ? 0.35 : 0.0;
        const willContinue = generateRandom(this.id) < continueEatingChance;

        if (willContinue) {
          // Continue eating another short cycle
          this.stateTimer = this.config.eatingDuration * 0.6;
          this.needs.hunger = Math.max(0, this.needs.hunger - 25);
        } else {
          // Finish eating
          this.anim.eatingBobOffset = 0;
          this.eatingElapsedTime = 0;
          this.needs.hunger = Math.max(0, this.needs.hunger - 60);
          this.isHeadingToFood = false;
          this.enterIdleState();
        }
      }
      return;
    }

    // 5. Section 15: Grass Detection when hungry
    if (
      this.needs.hunger >= this.needs.hungerThreshold &&
      !this.isHeadingToFood &&
      this.behaviorState !== 'PETTED'
    ) {
      const foodPos = detector.findNearbyGrass(this.position.x, this.position.y, 6.0);
      if (foodPos) {
        this.isHeadingToFood = true;
        this.behaviorState = 'WANDER';
        this.setTarget(foodPos.x, foodPos.y);
        return;
      }
    }

    // 6. Section 9 & 10: Idle / Wander State Machine with generateRandom(id)
    this.stateTimer -= dt;

    if (this.behaviorState === 'IDLE') {
      if (this.stateTimer <= 0) {
        // Section 9: The decision comes from generateRandom(animal.id).
        // Possible result: remain idle or start wandering.
        // This prevents every animal from constantly moving.
        const shouldWander = generateRandom(this.id) < 0.65;
        if (shouldWander) {
          this.enterWanderState(detector);
        } else {
          // Remain idle for another short period
          this.enterIdleState();
        }
      }
    } else if (this.behaviorState === 'WANDER') {
      if (this.stateTimer <= 0 && !this.isHeadingToFood) {
        // Wandering timed out: return to IDLE
        this.clearTarget();
        this.enterIdleState();
      }
    }
  }

  /**
   * Section 9: Enter IDLE state with randomized duration using generateRandom(this.id).
   */
  private enterIdleState(): void {
    this.behaviorState = 'IDLE';
    this.clearTarget();
    this.isHeadingToFood = false;
    this.anim.eatingBobOffset = 0;
    this.stateTimer = randomRange(
      this.id,
      this.config.idleDurationMin,
      this.config.idleDurationMax
    );
  }

  /**
   * Section 10: Wandering
   * Choose random nearby target 3–7 tiles away using generateRandom(this.id).
   */
  private enterWanderState(detector: EnvironmentDetector): void {
    const attempts = 8;
    const minWanderDist = 3.0; // Section 10: 3–7 tiles away
    const maxWanderDist = Math.min(7.0, Math.max(3.5, this.config.wanderRadius));

    for (let i = 0; i < attempts; i++) {
      const angle = generateRandom(this.id) * Math.PI * 2;
      const dist = randomRange(this.id, minWanderDist, maxWanderDist);
      const targetX = this.movement.wanderOriginX + Math.cos(angle) * dist;
      const targetY = this.movement.wanderOriginY + Math.sin(angle) * dist;

      if (detector.isWalkable(targetX, targetY, Boolean(this.config.isAquatic), Boolean(this.config.isAquatic))) {
        this.behaviorState = 'WANDER';
        this.stateTimer = randomRange(
          this.id,
          this.config.wanderDurationMin,
          this.config.wanderDurationMax
        );
        this.setTarget(targetX, targetY);
        return;
      }
    }

    // If no valid spot found, stay idle a bit longer
    this.enterIdleState();
  }

  /**
   * Triggered when entity reaches its destination.
   */
  protected onTargetReached(): void {
    if (this.isHeadingToFood) {
      // Reached the grass: begin eating!
      this.behaviorState = 'EATING';
      this.stateTimer = this.config.eatingDuration;
      this.eatingElapsedTime = 0;
      this.isHeadingToFood = false;
    } else {
      // Finished regular wander: transition to IDLE
      this.enterIdleState();
    }
  }

  /**
   * Triggered when path is blocked by collision.
   */
  protected onMovementBlocked(): void {
    this.isHeadingToFood = false;
    if (this.behaviorState === 'FLEE') {
      // If blocked while fleeing, pick a deflected direction and keep sprinting!
      this.clearTarget();
    } else {
      this.enterIdleState();
    }
  }

  /**
   * Causes the animal to enter panic/flee state and sprint rapidly away from a danger point.
   */
  public fleeFrom(sourceX: number, sourceY: number, detector?: EnvironmentDetector): void {
    if (this.behaviorState === 'DEAD') return;

    this.behaviorState = 'FLEE';
    this.fleeTimer = 3.5;
    this.fleeSourceX = sourceX;
    this.fleeSourceY = sourceY;
    this.isHeadingToFood = false;
    this.interaction.isPetted = false;
    this.anim.eatingBobOffset = 0;

    // Sprint at 2.4x regular speed
    this.movement.speed = (this.config.movementSpeed ?? this.config.defaultSpeed) * 2.4;

    if (detector) {
      this.sprintAwayFrom(sourceX, sourceY, detector);
    } else {
      const angle = Math.atan2(this.position.y - sourceY, this.position.x - sourceX);
      this.setTarget(this.position.x + Math.cos(angle) * 5.0, this.position.y + Math.sin(angle) * 5.0);
    }
  }

  /**
   * Calculates a fleeing vector opposite to the danger source and finds a valid walkable tile.
   */
  private sprintAwayFrom(sourceX: number, sourceY: number, detector: EnvironmentDetector): void {
    const baseAngle = Math.atan2(this.position.y - sourceY, this.position.x - sourceX);
    const sprintDistance = 5.5 + Math.random() * 2.5;

    // Try multiple angles radiating away from the threat
    const angleOffsets = [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1];
    for (const offset of angleOffsets) {
      const angle = baseAngle + offset;
      const targetX = this.position.x + Math.cos(angle) * sprintDistance;
      const targetY = this.position.y + Math.sin(angle) * sprintDistance;

      if (detector.isWalkable(targetX, targetY, Boolean(this.config.isAquatic), Boolean(this.config.isAquatic))) {
        this.setTarget(targetX, targetY);
        return;
      }
    }

    // Fallback: small step away
    const fallbackX = this.position.x + Math.cos(baseAngle) * 3.0;
    const fallbackY = this.position.y + Math.sin(baseAngle) * 3.0;
    this.setTarget(fallbackX, fallbackY);
  }

  public override takeDamage(amount: number): void {
    super.takeDamage(amount);
    if (this.health > 0) {
      // Animal panics and sprints away when hit
      this.fleeFrom(this.fleeSourceX || this.position.x - 1, this.fleeSourceY || this.position.y);
    }
  }

  /**
   * Section 20, 21, 22, 25, 27: Pet interaction
   * Cancels current movement or eating immediately and enters PETTED state.
   */
  public pet(): boolean {
    if (!this.interaction.canPet || this.interaction.pettingCooldown > 0 || this.behaviorState === 'FLEE') {
      return false;
    }

    // Section 27 Priority: EATING / WANDER cancelled, transitions to PETTED
    this.behaviorState = 'PETTED';
    this.interaction.isPetted = true;
    this.interaction.pettedTimer = this.interaction.pettedDuration;
    this.interaction.pettingCooldown = 4.0; // Section 25: cooldown to prevent spamming
    this.interaction.heartsEmitted = true;
    this.isHeadingToFood = false;
    this.anim.eatingBobOffset = 0;
    this.clearTarget();
    return true;
  }

  /**
   * Section 26: Feeding interaction
   * Player feeds animal: reduces hunger and triggers small happy jumps + hearts.
   */
  public feed(): boolean {
    if (!this.interaction.canFeed || this.behaviorState === 'FLEE') return false;
    this.needs.hunger = Math.max(0, this.needs.hunger - 45);
    this.interaction.heartsEmitted = true;
    // Animal performs 3 small-heighted fast jumps in gratitude
    this.triggerPetJumps(5.5, 0.15);
    return true;
  }
}
