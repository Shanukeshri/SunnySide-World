import { LivingEntity } from './LivingEntity';
import { SpeciesConfig } from './types';
import { EnvironmentDetector } from './EnvironmentDetector';
import { generateRandom, randomChoice, randomRange } from './rng';

export const HAIRSTYLE_VARIANTS = [
  'bowlhair',
  'curlyhair',
  'longhair',
  'mophair',
  'shorthair',
  'spikeyhair',
] as const;

export class NPC extends LivingEntity {
  private stateTimer: number = 0;
  private homeX: number;
  private homeY: number;
  private villageMaxRadius: number = 6.0;

  constructor(
    id: number,
    config: SpeciesConfig,
    initialX: number,
    initialY: number,
    homeX: number,
    homeY: number,
    hairstyle?: string
  ) {
    super(id, config, initialX, initialY);
    this.homeX = homeX;
    this.homeY = homeY;
    this.hairstyle = hairstyle || randomChoice(this.id, HAIRSTYLE_VARIANTS);
    this.enterIdleState();
  }

  /**
   * Throttled AI Decision Tick for Villager NPC
   */
  public updateAI(dt: number, detector: EnvironmentDetector): void {
    if (this.behaviorState === 'DEAD') return;
    this.stateTimer -= dt;

    if (this.behaviorState === 'IDLE') {
      if (this.stateTimer <= 0) {
        this.enterWalkState(detector);
      }
    } else if (this.behaviorState === 'WALK') {
      if (this.stateTimer <= 0) {
        this.clearTarget();
        this.enterIdleState();
      }
    }
  }

  private enterIdleState(): void {
    this.behaviorState = 'IDLE';
    this.clearTarget();
    this.stateTimer = randomRange(
      this.id,
      this.config.idleDurationMin,
      this.config.idleDurationMax
    );
  }

  /**
   * Village NPC walks between village spots (bounded to village area).
   */
  private enterWalkState(detector: EnvironmentDetector): void {
    const attempts = 8;
    for (let i = 0; i < attempts; i++) {
      const angle = generateRandom(this.id) * Math.PI * 2;
      const dist = randomRange(this.id, 1.5, this.villageMaxRadius);
      const targetX = this.homeX + Math.cos(angle) * dist;
      const targetY = this.homeY + Math.sin(angle) * dist;

      // Keep inside walkable village boundaries
      if (detector.isWalkable(targetX, targetY)) {
        const env = detector.getEnvironmentAt(targetX, targetY);
        // Villagers prefer staying in or near village
        if (env.type === 'VILLAGE' || env.distToVillageCenter <= 8.0) {
          this.behaviorState = 'WALK';
          this.stateTimer = randomRange(
            this.id,
            this.config.wanderDurationMin,
            this.config.wanderDurationMax
          );
          this.setTarget(targetX, targetY);
          return;
        }
      }
    }

    this.enterIdleState();
  }

  protected onTargetReached(): void {
    this.enterIdleState();
  }

  protected onMovementBlocked(): void {
    this.enterIdleState();
  }
}
