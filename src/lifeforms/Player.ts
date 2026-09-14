import { LivingEntity } from './LivingEntity';
import { Animal } from './Animal';
import { SpeciesConfig } from './types';
import { EnvironmentDetector } from './EnvironmentDetector';

export class Player extends LivingEntity {
  public moveInputX: number = 0;
  public moveInputY: number = 0;

  constructor(id: number, config: SpeciesConfig, initialX: number, initialY: number, hairstyle: string = 'spikeyhair') {
    super(id, config, initialX, initialY);
    this.hairstyle = hairstyle;
    this.movement.speed = 3.4; // Responsive player movement
  }

  /**
   * Updates player position directly based on keyboard inputs or click-to-move targets.
   */
  public updatePlayer(dt: number, detector: EnvironmentDetector): void {
    // 1. Advance jump & hop animation (both single jump and 3-hop petting reaction)
    this.updateJumpAnimation(dt);

    // 2. Direct Keyboard Movement
    if (this.moveInputX !== 0 || this.moveInputY !== 0) {
      // Normalize vector
      const len = Math.hypot(this.moveInputX, this.moveInputY);
      const dirX = this.moveInputX / len;
      const dirY = this.moveInputY / len;

      const step = this.movement.speed * dt;
      const nx = this.position.x + dirX * step;
      const ny = this.position.y + dirY * step;

      // Update orientation
      if (Math.abs(dirX) > Math.abs(dirY)) {
        this.direction = dirX > 0 ? 'RIGHT' : 'LEFT';
        this.anim.flipX = dirX < 0;
      } else {
        this.direction = dirY > 0 ? 'DOWN' : 'UP';
      }

      // Try full move or axis sliding with foot collision area
      if (detector.isAreaWalkable(nx, ny, 0.18, 0.12)) {
        this.position.x = nx;
        this.position.y = ny;
      } else if (detector.isAreaWalkable(nx, this.position.y, 0.18, 0.12)) {
        this.position.x = nx;
      } else if (detector.isAreaWalkable(this.position.x, ny, 0.18, 0.12)) {
        this.position.y = ny;
      }

      this.movement.isMoving = true;
      this.updateAnimation(dt);
      return;
    }

    // 3. Fallback: Path / Target movement (e.g. click to move)
    if (this.movement.isMoving && this.movement.targetX !== null) {
      this.updateMovement(dt, detector);
    } else {
      this.movement.isMoving = false;
      this.anim.currentFrame = 0; // idle pose
    }
  }

  public updateAI(_dt: number, _detector: EnvironmentDetector): void {
    // Player AI is user-driven
  }

  protected onTargetReached(): void {
    this.movement.isMoving = false;
  }

  protected onMovementBlocked(): void {
    this.clearTarget();
  }

  /**
   * Player jumps on command (Spacebar) - smooth, graceful float.
   */
  public jump(): boolean {
    return this.triggerJump(15, 0.56);
  }

  /**
   * Triggers the player's joyous 3 small-heighted fast jumps when petting an animal.
   */
  public triggerHop(): void {
    this.triggerPetJumps(6.5, 0.15); // 3 small-heighted fast jumps (0.45s total)
  }

  /**
   * Finds closest animal within reach.
   */
  public findNearbyInteractable(
    animals: Animal[],
    maxRadius: number = 2.0
  ): Animal | null {
    let closest: Animal | null = null;
    let minDist = maxRadius;

    for (const animal of animals) {
      if (!animal.isActive) continue;
      const dist = Math.hypot(
        this.position.x - animal.position.x,
        this.position.y - animal.position.y
      );
      if (dist < minDist) {
        minDist = dist;
        closest = animal;
      }
    }

    return closest;
  }
}
