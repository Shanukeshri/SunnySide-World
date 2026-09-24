import { LivingEntity } from './LivingEntity';
import { SpeciesConfig } from './types';
export class NPC extends LivingEntity {
  public customTitle?: string;
  public customDialogue?: string;
  constructor(id: number, config: SpeciesConfig, initialX: number, initialY: number, homeX: number, homeY: number, role?: any) {
    super(id, config, initialX, initialY);
  }
  updateAI(dt: any, det: any) {}
  onTargetReached() {}
  onMovementBlocked() {}
}
