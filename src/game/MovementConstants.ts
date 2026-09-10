/**
 * MovementConstants.ts - Single Source of Truth for Player Movement Speed
 *
 * Implements spec item 3: shared movement rules so client prediction and
 * server simulation use identical constants, preventing continuous divergence.
 */

/** Base walk speed in world tiles/second */
export const WALK_SPEED = 3.8;

/** Sprint speed in world tiles/second */
export const SPRINT_SPEED = 5.6;

/** Swimming speed multiplier applied on top of base/sprint speed */
export const SWIM_MULTIPLIER = 0.65;
