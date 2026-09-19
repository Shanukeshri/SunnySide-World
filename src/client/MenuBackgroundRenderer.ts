import Phaser from "phaser";
import { WorldManager } from "../game/WorldManager";

class MenuBackgroundScene extends Phaser.Scene {
  private worldManager!: WorldManager;
  private cameraPanSpeed = 1.0; // pixels per frame

  constructor() {
    super({ key: "MenuBackgroundScene" });
  }

  preload() {
    // Load just enough assets to render the terrain and village
    this.load.image("iso_grass_block", "/assets/iso_grass_block.png");
    this.load.image("iso_dirt_block", "/assets/iso_dirt_block.png");
    this.load.image("iso_sand_block", "/assets/iso_sand_block.png");
    this.load.image("iso_water_block", "/assets/iso_water_block.png");
    
    // Some basic sprites for houses/trees
    this.load.image("tree_01", "/assets/tree_01.png");
  }

  create() {
    // Random seed for the background village
    const seed = Math.floor(Math.random() * 100000);
    this.worldManager = new WorldManager(seed);
    
    // Generate some chunks
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const chunk = this.worldManager.getOrCreateChunk(dx, dy);
        // We will just render the chunks simply using graphics for performance in the background,
        // or actually draw the isometric tiles.
        // For the sake of simplicity and performance on the main menu, let's render a flat 2D top-down view
        // like the 'Village Generator' tab does, but animated!
      }
    }

    // Let's draw the village directly to a graphics object to keep it super lightweight
    const graphics = this.add.graphics();
    this.drawVillageToGraphics(graphics);

    // Setup Camera
    this.cameras.main.setZoom(2.0);
    this.cameras.main.centerOn(0, 0);
  }

  private drawVillageToGraphics(graphics: Phaser.GameObjects.Graphics) {
    graphics.clear();
    const tileSize = 16;
    const startX = -100;
    const endX = 100;
    const startY = -100;
    const endY = 100;

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const tile = this.worldManager.getTile(x, y);
        
        let color = 0x86efac; // Grass
        if (tile.isWater) color = 0x3b82f6;
        else if (tile.isRoad) color = 0xd4d4d8;
        else if (tile.isFarm) color = 0xb45309;

        graphics.fillStyle(color, 1.0);
        graphics.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        
        if (tile.isBlocked && !tile.isWater) {
          graphics.fillStyle(0x1e293b, 0.8);
          graphics.fillRect(x * tileSize + 2, y * tileSize + 2, tileSize - 4, tileSize - 4);
        }
      }
    }
  }

  update(time: number, delta: number) {
    // Slowly pan the camera to the right
    this.cameras.main.scrollX += (this.cameraPanSpeed * delta) / 16;
    this.cameras.main.scrollY += (Math.sin(time / 2000) * delta) / 32; // Slight bobbing
  }
}

export class MenuBackgroundRenderer {
  private game: Phaser.Game;

  constructor(containerId: string) {
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: containerId,
      width: "100%",
      height: "100%",
      backgroundColor: "#0f172a",
      pixelArt: true,
      scene: [MenuBackgroundScene],
    };

    this.game = new Phaser.Game(config);
  }

  public destroy() {
    this.game.destroy(true);
  }
}
