import { LivingEntity } from './LivingEntity';
import { SpeciesConfig } from './types';
import { EnvironmentDetector } from './EnvironmentDetector';

function seededRand(seed: number, step: number, subIndex: number = 0): number {
  let h = (seed * 374761393 + step * 668265263 + subIndex * 12345) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class Animal extends LivingEntity {
  private stateTimer: number = 0;
  private aiDecisionCount: number = 0;

  // Husbandry, Breeding & Production:
  public isBaby: boolean = false;
  public growthTimer: number = 0;
  public loveTimer: number = 0;
  public gestationTimer: number = 0;
  public hasMilk: boolean = true;
  public hasWool: boolean = true;
  public eggTimer: number = 0;
  public parentId?: number;

  constructor(id: number, config: SpeciesConfig, initialX: number, initialY: number) {
    super(id, config, initialX, initialY);
  }

  updateAI(dt: number, det: EnvironmentDetector, worldTime?: any, worldManager?: any) {
    if (this.behaviorState === 'DEAD' || this.interaction.isPetted) return;

    this.stateTimer -= dt;

    if (this.stateTimer <= 0) {
      const step = ++this.aiDecisionCount;
      // Time of day logic could be added here if available in det, but for now we wander/eat
      if (this.behaviorState === 'IDLE' || this.behaviorState === 'EATING') {
        this.behaviorState = 'WANDER';
        const rDuration = seededRand(this.id, step, 1);
        this.stateTimer = this.config.wanderDurationMin + rDuration * (this.config.wanderDurationMax - this.config.wanderDurationMin);
        // slowly drift the wander origin based on a deterministic herd angle
        if (worldTime) {
          const herdId = Math.floor(this.id / 5); // group by 5s
          // deterministic angle that changes slowly over time (e.g., every 30 seconds)
          const timePhase = Math.floor(worldTime.totalSeconds / 30);
          const pseudoRandom = Math.sin(herdId * 12.9898 + timePhase * 78.233) * 43758.5453;
          const sharedAngle = (pseudoRandom - Math.floor(pseudoRandom)) * Math.PI * 2;
          
          const nextOriginX = this.movement.wanderOriginX + Math.cos(sharedAngle) * 1.5;
          const nextOriginY = this.movement.wanderOriginY + Math.sin(sharedAngle) * 1.5;
          
          if (det.isAreaWalkable(nextOriginX, nextOriginY, 0.20, 0.14, Boolean(this.config.isAmphibious || this.config.isAquatic), Boolean(this.config.isAquatic && !this.config.isAmphibious))) {
            this.movement.wanderOriginX = nextOriginX;
            this.movement.wanderOriginY = nextOriginY;
          }
        }

        const angle = seededRand(this.id, step, 2) * Math.PI * 2;
        const dist = seededRand(this.id, step, 3) * this.movement.wanderRadius;
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
        if (seededRand(this.id, step, 4) < 0.3) {
          this.behaviorState = 'EATING';
          this.stateTimer = this.config.eatingDuration || 3.0;
        } else {
          this.behaviorState = 'IDLE';
          const rIdle = seededRand(this.id, step, 5);
          this.stateTimer = this.config.idleDurationMin + rIdle * (this.config.idleDurationMax - this.config.idleDurationMin);
        }
        this.clearTarget();
      }
    }
  }

  onTargetReached() {
    this.behaviorState = 'IDLE';
    this.movement.speed = this.config.movementSpeed ?? this.config.defaultSpeed;
    const r = seededRand(this.id, ++this.aiDecisionCount, 6);
    this.stateTimer = this.config.idleDurationMin + r * (this.config.idleDurationMax - this.config.idleDurationMin);
  }

  onMovementBlocked() {
    this.behaviorState = 'IDLE';
    this.movement.speed = this.config.movementSpeed ?? this.config.defaultSpeed;
    this.stateTimer = 1.0;
  }

  fleeFrom(x: number, y: number, det: EnvironmentDetector) {
    // Dynamic flee behavior: boost speed and steer directly away from attacker
    this.behaviorState = 'WANDER';
    this.stateTimer = 3.0;
    this.movement.speed = (this.config.movementSpeed ?? this.config.defaultSpeed) * 2.2;
    const dx = this.position.x - x;
    const dy = this.position.y - y;
    const angle = Math.atan2(dy, dx);
    const tx = this.position.x + Math.cos(angle) * 5.5;
    const ty = this.position.y + Math.sin(angle) * 5.5;
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
