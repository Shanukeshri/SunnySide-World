import { LivingEntity } from "./LivingEntity";
import { SpeciesConfig } from "./types";
import { EnvironmentDetector } from "./EnvironmentDetector";
import { generateRandom, randomChoice, randomRange } from "./rng";

export const HAIRSTYLE_VARIANTS = [
  "bowlhair",
  "curlyhair",
  "longhair",
  "mophair",
  "shorthair",
  "spikeyhair",
] as const;

export type NPCRole =
  | "blacksmith"
  | "builder"
  | "farmer"
  | "fisher"
  | "guide"
  | "merchant"
  | "child"
  | "villager";

export interface NPCRoleConfig {
  role: NPCRole;
  title: string;
  compositeSheet: string;
  totalFrames: number;
  speed: number;
  dialogue: string;
}

export const NPC_ROLE_CONFIGS: Record<NPCRole, NPCRoleConfig> = {
  blacksmith: {
    role: "blacksmith",
    title: "Vulcan the Blacksmith",
    compositeSheet:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Composites/blacksmith_spikeyhair_hammering_strip23.png",
    totalFrames: 23,
    speed: 0.08,
    dialogue:
      "Greetings traveler! I forge tools and sturdy hardware. Keep an iron pickaxe handy for mineral veins!",
  },
  builder: {
    role: "builder",
    title: "Bob the Builder",
    compositeSheet:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Composites/builder_mophair_axe_strip10.png",
    totalFrames: 10,
    speed: 0.08,
    dialogue:
      "Timber is the foundation of every shelter. Chop oak trees with your axe to gather wood!",
  },
  farmer: {
    role: "farmer",
    title: "Hayley the Farmer",
    compositeSheet:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Composites/farmer_curlyhair_watering_strip5.png",
    totalFrames: 5,
    speed: 0.1,
    dialogue:
      "The crops look vibrant today! Till fertile soil with a shovel and keep them hydrated with a watering can.",
  },
  fisher: {
    role: "fisher",
    title: "Finn the Fisher",
    compositeSheet:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Composites/fisher_bowlhair_reeling_strip13.png",
    totalFrames: 13,
    speed: 0.08,
    dialogue:
      "The river is plentiful! Cast your rod into clear water and reel in fish for hearty meals.",
  },
  guide: {
    role: "guide",
    title: "Gareth the Village Guard",
    compositeSheet:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Composites/guide_longhair_attack_strip10.png",
    totalFrames: 10,
    speed: 0.08,
    dialogue:
      "Stay watchful when dusk arrives. Skeletons and forest goblins prowl the wilderness beyond our gates.",
  },
  merchant: {
    role: "merchant",
    title: "Milo the Merchant",
    compositeSheet:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Composites/merchant_longhair_waiting_strip9.png",
    totalFrames: 9,
    speed: 0.12,
    dialogue:
      "Welcome to Sunnyside Outpost! I trade valuable provisions, seeds, and craft essentials.",
  },
  child: {
    role: "child",
    title: "Pip the Village Youth",
    compositeSheet:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Composites/child_bowlhair_jump_strip9.png",
    totalFrames: 9,
    speed: 0.08,
    dialogue: "Look at the ducks swimming in the pond! Aren't they quick?",
  },
  villager: {
    role: "villager",
    title: "Town Villager",
    compositeSheet:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Composites/villager_shorthair_walk_strip8.png",
    totalFrames: 8,
    speed: 0.1,
    dialogue:
      "It's a serene day in the settlement. Make sure your campfire is lit before nighttime.",
  },
};

export class NPC extends LivingEntity {
  private stateTimer: number = 0;
  private homeX: number;
  private homeY: number;
  private villageMaxRadius: number = 6.0;

  public role?: NPCRole;
  public compositeSheet?: string;
  public compositeFrames?: number;
  public compositeSpeed?: number;
  public customTitle?: string;
  public customDialogue?: string;

  constructor(
    id: number,
    config: SpeciesConfig,
    initialX: number,
    initialY: number,
    homeX: number,
    homeY: number,
    roleOrHairstyle?: NPCRole | string,
  ) {
    super(id, config, initialX, initialY);
    this.homeX = homeX;
    this.homeY = homeY;

    if (roleOrHairstyle && roleOrHairstyle in NPC_ROLE_CONFIGS) {
      this.setRole(roleOrHairstyle as NPCRole);
    } else {
      this.hairstyle =
        (roleOrHairstyle as string) ||
        randomChoice(this.id, HAIRSTYLE_VARIANTS);
    }
    this.enterIdleState();
  }

  public setRole(role: NPCRole) {
    this.role = role;
    const cfg = NPC_ROLE_CONFIGS[role];
    if (cfg) {
      this.compositeSheet = cfg.compositeSheet;
      this.compositeFrames = cfg.totalFrames;
      this.compositeSpeed = cfg.speed;
      this.customTitle = cfg.title;
      this.customDialogue = cfg.dialogue;
    }
  }

  /**
   * Throttled AI Decision Tick for Villager NPC
   */
  public updateAI(dt: number, detector: EnvironmentDetector): void {
    if (this.behaviorState === "DEAD") return;
    this.stateTimer -= dt;

    if (this.behaviorState === "IDLE") {
      if (this.stateTimer <= 0) {
        this.enterWalkState(detector);
      }
    } else if (this.behaviorState === "WALK") {
      if (this.stateTimer <= 0) {
        this.clearTarget();
        this.enterIdleState();
      }
    }
  }

  private enterIdleState(): void {
    this.behaviorState = "IDLE";
    this.clearTarget();
    this.stateTimer = randomRange(
      this.id,
      this.config.idleDurationMin,
      this.config.idleDurationMax,
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
        if (env.type === "VILLAGE" || env.distToVillageCenter <= 8.0) {
          this.behaviorState = "WALK";
          this.stateTimer = randomRange(
            this.id,
            this.config.wanderDurationMin,
            this.config.wanderDurationMax,
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
