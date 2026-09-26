import { LivingEntity } from './LivingEntity';
import { SpeciesConfig } from './types';
import { EnvironmentDetector } from './EnvironmentDetector';

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
  compositeSheet?: string;
  totalFrames?: number;
  speed?: number;
  dialogue: string;
  hairstyle?: string;
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
    hairstyle: "spikeyhair",
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
    hairstyle: "mophair",
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
    hairstyle: "curlyhair",
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
    hairstyle: "bowlhair",
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
    hairstyle: "longhair",
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
    hairstyle: "longhair",
  },
  child: {
    role: "child",
    title: "Pip the Village Youth",
    compositeSheet:
      "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Composites/child_bowlhair_jump_strip9.png",
    totalFrames: 9,
    speed: 0.08,
    dialogue: "Look at the ducks swimming in the pond! Aren't they quick?",
    hairstyle: "bowlhair",
  },
  villager: {
    role: "villager",
    title: "Villager", // Will be prefixed by a dynamic name
    dialogue:
      "It's a serene day in the settlement. Make sure your campfire is lit before nighttime.",
  },
};

export class NPC extends LivingEntity {
  public role?: NPCRole;
  public compositeSheet?: string;
  public compositeFrames?: number;
  public compositeSpeed?: number;
  public customTitle?: string;
  public customDialogue?: string;
  private stateTimer: number = 0;
  
  public homeX: number;
  public homeY: number;

  constructor(
    id: number,
    config: SpeciesConfig,
    initialX: number,
    initialY: number,
    homeX: number,
    homeY: number,
    roleOrHairstyle?: NPCRole | string
  ) {
    super(id, config, initialX, initialY);
    this.homeX = homeX;
    this.homeY = homeY;
    
    this.hairstyle = (roleOrHairstyle as string) || HAIRSTYLE_VARIANTS[Math.floor(Math.random() * HAIRSTYLE_VARIANTS.length)];
    
    if (roleOrHairstyle && roleOrHairstyle in NPC_ROLE_CONFIGS) {
      this.setRole(roleOrHairstyle as NPCRole);
    }
    
    this.behaviorState = 'IDLE'; // They only idle for now!
    this.clearTarget();
  }

  public setRole(role: NPCRole) {
    this.role = role;
    const cfg = NPC_ROLE_CONFIGS[role];
    if (cfg) {
      this.compositeSheet = cfg.compositeSheet;
      this.compositeFrames = cfg.totalFrames;
      this.compositeSpeed = cfg.speed;
      
      if (cfg.hairstyle) {
        this.hairstyle = cfg.hairstyle;
      }
      
      if (role === 'villager') {
        const randomNames = ["Alden", "Bryn", "Cael", "Dara", "Elara", "Finn", "Gael", "Hollis", "Ida", "Jace", "Kira", "Leo", "Mila", "Nora", "Orin", "Pia", "Quin", "Rowan", "Sia", "Theo"];
        const name = randomNames[Math.floor(Math.random() * randomNames.length)];
        this.customTitle = `${name} the ${cfg.title}`;
      } else {
        this.customTitle = cfg.title;
      }
      this.customDialogue = cfg.dialogue;
    }
  }

  updateAI(dt: number, det: EnvironmentDetector, worldTime?: any, worldManager?: any) {
    this.stateTimer -= dt;
    if (this.stateTimer <= 0) {
      this.stateTimer = 2.0 + Math.random() * 3.0; // Check every 2-5s
      
      let targetX = this.homeX;
      let targetY = this.homeY;
      
      if (worldTime && (worldTime.timeOfDay === "Morning" || worldTime.timeOfDay === "Day" || worldTime.timeOfDay === "Sunset")) {
         if (this.role === "farmer" && worldManager) {
           const farmCell = this.findNearestFarm(worldManager);
           if (farmCell) {
             targetX = farmCell.x; targetY = farmCell.y;
           }
         } else if (this.role === "fisher" && worldManager) {
           const waterCell = this.findNearestPond(worldManager);
           if (waterCell) {
             targetX = waterCell.x; targetY = waterCell.y;
           }
         } else if (this.role === "blacksmith") {
           targetX = this.homeX + (Math.random() - 0.5) * 6;
           targetY = this.homeY + (Math.random() - 0.5) * 6;
         } else if (this.role === "guide") {
           targetX = this.homeX + (Math.random() - 0.5) * 20;
           targetY = this.homeY + (Math.random() - 0.5) * 20;
         } else {
           targetX = this.homeX + (Math.random() - 0.5) * 8;
           targetY = this.homeY + (Math.random() - 0.5) * 8;
         }
      } else {
         targetX = this.homeX + (Math.random() - 0.5) * 2;
         targetY = this.homeY + (Math.random() - 0.5) * 2;
      }
      
      if (det.isAreaWalkable(targetX, targetY, 0.2, 0.2, false, false)) {
        this.setTarget(targetX, targetY);
        this.behaviorState = 'WALKING';
      } else {
        this.clearTarget();
        this.behaviorState = 'IDLE';
      }
    }
  }

  private findNearestFarm(worldManager: any): {x: number, y: number} | null {
     let bestDist = Infinity;
     let best = null;
     for (const village of worldManager.villages) {
       if (!village.data.farms) continue;
       for (const farm of village.data.farms) {
         for (const cell of farm.cells) {
           const wx = village.gridX + cell.x;
           const wy = village.gridY + cell.y;
           const d = Math.hypot(wx - this.position.x, wy - this.position.y);
           if (d < bestDist && d < 40) {
             bestDist = d;
             best = {x: wx, y: wy};
           }
         }
       }
     }
     return best;
  }

  private findNearestPond(worldManager: any): {x: number, y: number} | null {
     let bestDist = Infinity;
     let best = null;
     for (const village of worldManager.villages) {
       if (!village.data.waterBodies) continue;
       for (const pond of village.data.waterBodies) {
         for (const cell of pond.cells) {
           const wx = village.gridX + cell.x;
           const wy = village.gridY + cell.y;
           const d = Math.hypot(wx - this.position.x, wy - this.position.y);
           if (d < bestDist && d < 40) {
             bestDist = d;
             best = {x: wx, y: wy};
           }
         }
       }
     }
     return best;
  }

  onTargetReached() {
    if (this.role && this.role !== 'villager' && this.role !== 'child') {
      this.behaviorState = Math.random() > 0.3 ? 'WORKING' : 'IDLE';
    } else {
      this.behaviorState = 'IDLE';
    }
  }

  onMovementBlocked() {
    this.behaviorState = 'IDLE';
  }
}
