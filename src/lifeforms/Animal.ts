import { LivingEntity } from './LivingEntity';
import { SpeciesConfig } from './types';
export class Animal extends LivingEntity {
  constructor(id: number, config: SpeciesConfig, initialX: number, initialY: number) {
    super(id, config, initialX, initialY);
  }
  updateAI(dt: any, det: any) {}
  onTargetReached() {}
  onMovementBlocked() {}
  fleeFrom(x: any, y: any, det: any) {}
  pet() { return false; }
  feed() { return false; }
}
