/**
 * Types and interfaces for the Village Lifeform & Wildlife system.
 * Implements the complete entity data structures specified in gameLogicV1.txt.
 */

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export type EntityType = 'ANIMAL' | 'NPC' | 'PLAYER';

export type SpeciesType =
  | 'cow'
  | 'sheep'
  | 'rabbit'
  | 'chicken'
  | 'deer'
  | 'pig'
  | 'duck'
  | 'villager'
  | 'player';

// Section 8 & Section 28 & Section 29 behavior states
export type BehaviorState = 'IDLE' | 'WANDER' | 'EATING' | 'PETTED' | 'WALK' | 'DEAD';

// Section 4 environments: Grassland, Water, Village, Jungle
export type EnvironmentType = 'GRASSLAND' | 'WATER' | 'VILLAGE' | 'JUNGLE';

export interface Position2D {
  x: number; // Logical tile coordinates (floating point for smooth 60 FPS interpolation)
  y: number;
}

export interface MovementState {
  targetX: number | null;
  targetY: number | null;
  speed: number; // tiles per second
  isMoving: boolean;
  wanderOriginX: number;
  wanderOriginY: number;
  wanderRadius: number;
}

export interface NeedsState {
  hunger: number; // 0 (full) to 100 (starving)
  hungerRate: number; // hunger points added per second
  hungerThreshold: number; // hunger level at which entity seeks food (e.g., 55)
  maxHunger: number;
}

export interface InteractionState {
  canPet: boolean;
  canFeed: boolean;
  isPetted: boolean;
  pettedTimer: number; // countdown in seconds
  pettedDuration: number;
  pettingCooldown: number; // cooldown timer after being petted
  heartsEmitted: boolean;
}

export interface AnimationRenderState {
  currentFrame: number;
  frameTimer: number;
  frameSpeed: number; // seconds per frame
  totalFrames: number;
  eatingBobOffset: number; // visual Y offset (logical position stays unchanged)
  jumpOffset: number;      // visual Y offset during jump/hops (positive lifts sprite up)
  playerHopOffset?: number; // legacy hop offset
  flipX: boolean; // true when facing LEFT
  deathAlpha?: number; // visual fade on death
}

export interface RangeValue {
  min: number;
  max: number;
}

/**
 * Section 3: Species Configuration
 * Configures behavior per species without hardcoding individual animal classes.
 */
export interface SpeciesConfig {
  species: SpeciesType;
  entityType: EntityType;
  name: string;
  movementSpeed: number; // tiles per second
  preferredEnvironment: EnvironmentType[]; // Grassland, Water, Village, Jungle
  food: string; // e.g. 'grass', 'seeds', 'grain', 'carrots'
  groupSize: RangeValue;
  idleTime: RangeValue; // seconds
  wanderTime: RangeValue; // seconds
  wanderRadius: number; // 3–7 tiles
  canPet: boolean;
  canFeed: boolean;
  health: number;
  isAquatic?: boolean;

  // Compatibility helpers
  defaultSpeed: number;
  preferredEnvironments: EnvironmentType[];
  groupSizeMin: number;
  groupSizeMax: number;
  idleDurationMin: number;
  idleDurationMax: number;
  wanderDurationMin: number;
  wanderDurationMax: number;
  eatingDuration: number;
  hungerRate: number;
  hungerThreshold: number;
  shadowRadiusX: number;
  shadowRadiusY: number;

  spriteAsset: {
    sheetPath: string;
    frameWidth: number;
    frameHeight: number;
    totalFrames: number;
    frameSpeed: number;
    drawWidth: number;
    drawHeight: number;
    originYOffset?: number;
    sourceCropX?: number;
    sourceCropY?: number;
    strideX?: number;
  };
}

/**
 * Section 1: Entity System
 * Generic living-entity interface with all required properties.
 */
export interface ILivingEntity {
  readonly id: number;
  readonly type: EntityType;
  readonly species: SpeciesType;
  position: Position2D;
  direction: Direction;
  speed: number;
  state: BehaviorState;
  target: Position2D | null;
  health: number;
  maxHealth: number;
  hunger: number;
  isAlive: boolean;

  movement: MovementState;
  behaviorState: BehaviorState;
  needs: NeedsState;
  interaction: InteractionState;
  anim: AnimationRenderState;
  isActive: boolean;
  hairstyle?: string;
  isAquatic?: boolean;
  deathTimer?: number;
}

export interface HeartParticle {
  id: number;
  x: number; // world coordinate in tiles
  y: number; // world coordinate in tiles
  vx: number;
  vy: number;
  alpha: number;
  scale: number;
  life: number; // remaining life in seconds
  maxLife: number;
  color: string;
  wobbleSpeed: number;
  wobbleAmp: number;
}

/**
 * Section 4: Environment Detection query result
 */
export interface EnvironmentInfo {
  grass: boolean;
  water: boolean;
  village: boolean;
  denseTrees: boolean;
  type: EnvironmentType;
  isWalkable: boolean;
  hasGrass: boolean;
  treeDensity: number;
  distToVillageCenter: number;
}
