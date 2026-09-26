import { LivingEntity } from './LivingEntity';
import { SpeciesConfig } from './types';
import { EnvironmentDetector } from './EnvironmentDetector';

export class Animal extends LivingEntity {
  private stateTimer: number = 0;

  constructor(id: number, config: SpeciesConfig, initialX: number, initialY: number) {
    super(id, config, initialX, initialY);
  }

  updateAI(dt: number, det: EnvironmentDetector, worldTime?: any, worldManager?: any) {
    if (this.behaviorState === 'DEAD' || this.interaction.isPetted) return;

    this.stateTimer -= dt;

    if (this.stateTimer <= 0) {
      // Time of day logic could be added here if available in det, but for now we wander/eat
      if (this.behaviorState === 'IDLE' || this.behaviorState === 'EATING') {
        this.behaviorState = 'WANDER';
        this.stateTimer = this.config.wanderDurationMin + Math.random() * (this.config.wanderDurationMax - this.config.wanderDurationMin);
        // slowly drift the wander origin based on a deterministic herd angle
        if (worldTime) {
          const herdId = Math.floor(this.id / 5); // group by 5s
          // deterministic angle that changes slowly over time (e.g., every 30 seconds)
          const timePhase = Math.floor(worldTime.totalSeconds / 30);
          const pseudoRandom = Math.sin(herdId * 12.9898 + timePhase * 78.233) * 43758.5453;
          const sharedAngle = (pseudoRandom - Math.floor(pseudoRandom)) * Math.PI * 2;
          
          this.movement.wanderOriginX += Math.cos(sharedAngle) * 1.5;
          this.movement.wanderOriginY += Math.sin(sharedAngle) * 1.5;
        }

        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * this.movement.wanderRadius;
        const tx = this.movement.wanderOriginX + Math.cos(angle) * dist;
        const ty = this.movement.wanderOriginY + Math.sin(angle) * dist;
        
        // isAreaWalkable helps ensure the target is safe
        if (det.isAreaWalkable(tx, ty, 0.20, 0.14, Boolean(this.config.isAmphibious || this.config.isAquatic), Boolean(this.config.isAquatic && !this.config.isAmphibious))) {
          this.setTarget(tx, ty);
        } else {
          this.behaviorState = 'IDLE';
          this.stateTimer = 1.0;
        }
      } else if (this.behaviorState === 'WANDER') {
        if (Math.random() < 0.3) {
          this.behaviorState = 'EATING';
          this.stateTimer = this.config.eatingDuration || 3.0;
        } else {
          this.behaviorState = 'IDLE';
          this.stateTimer = this.config.idleDurationMin + Math.random() * (this.config.idleDurationMax - this.config.idleDurationMin);
        }
        this.clearTarget();
      }
    }
  }

  onTargetReached() {
    this.behaviorState = 'IDLE';
    this.stateTimer = this.config.idleDurationMin + Math.random() * (this.config.idleDurationMax - this.config.idleDurationMin);
  }

  onMovementBlocked() {
    this.behaviorState = 'IDLE';
    this.stateTimer = 1.0;
  }

  fleeFrom(x: number, y: number, det: EnvironmentDetector) {
    // Basic flee logic implementation
    this.behaviorState = 'WANDER';
    this.stateTimer = 2.0;
    const dx = this.position.x - x;
    const dy = this.position.y - y;
    const angle = Math.atan2(dy, dx);
    const tx = this.position.x + Math.cos(angle) * 5.0;
    const ty = this.position.y + Math.sin(angle) * 5.0;
    if (det.isAreaWalkable(tx, ty, 0.20, 0.14, Boolean(this.config.isAmphibious || this.config.isAquatic), Boolean(this.config.isAquatic && !this.config.isAmphibious))) {
      this.setTarget(tx, ty);
    }
  }

  pet() {
    if (!this.config.canPet) return false;
    this.interaction.isPetted = true;
    this.behaviorState = 'PETTED';
    this.stateTimer = this.interaction.pettedDuration;
    this.interaction.heartsEmitted = true;
    this.triggerPetJumps();
    return true;
  }

  feed() {
    if (!this.config.canFeed) return false;
    this.interaction.isPetted = true;
    this.behaviorState = 'EATING';
    this.stateTimer = this.interaction.pettedDuration;
    this.interaction.heartsEmitted = true;
    this.triggerPetJumps();
    return true;
  }
}
