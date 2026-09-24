import { LivingEntity } from './LivingEntity';
import { SpeciesConfig } from './types';
import { EnvironmentDetector } from './EnvironmentDetector';

export class NPC extends LivingEntity {
  public customTitle?: string;
  public customDialogue?: string;
  public role?: string;
  private stateTimer: number = 0;
  public homeX: number;
  public homeY: number;

  constructor(id: number, config: SpeciesConfig, initialX: number, initialY: number, homeX: number, homeY: number, role?: string) {
    super(id, config, initialX, initialY);
    this.homeX = homeX;
    this.homeY = homeY;
    this.role = role;
    this.movement.wanderOriginX = homeX;
    this.movement.wanderOriginY = homeY;
  }

  updateAI(dt: number, det: EnvironmentDetector) {
    if (this.behaviorState === 'DEAD') return;

    this.stateTimer -= dt;
    if (this.stateTimer <= 0) {
      if (this.behaviorState === 'IDLE') {
        this.behaviorState = 'WANDER';
        this.stateTimer = 3.0 + Math.random() * 4.0;
        
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 5.0; // Wander near home
        const tx = this.movement.wanderOriginX + Math.cos(angle) * dist;
        const ty = this.movement.wanderOriginY + Math.sin(angle) * dist;
        
        if (det.isAreaWalkable(tx, ty, 0.20, 0.14, false, false)) {
          this.setTarget(tx, ty);
        } else {
          this.behaviorState = 'IDLE';
          this.stateTimer = 1.0;
        }
      } else {
        this.behaviorState = 'IDLE';
        this.stateTimer = 2.0 + Math.random() * 3.0;
        this.clearTarget();
      }
    }
  }

  onTargetReached() {
    this.behaviorState = 'IDLE';
    this.stateTimer = 2.0 + Math.random() * 3.0;
  }

  onMovementBlocked() {
    this.behaviorState = 'IDLE';
    this.stateTimer = 1.0;
  }
}
