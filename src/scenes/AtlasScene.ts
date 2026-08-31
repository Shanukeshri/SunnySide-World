import Phaser from 'phaser';
import { ASSET_ATLAS_DATA, AssetItem, AssetCategory } from '../data/assetRegistry';

export class AtlasScene extends Phaser.Scene {
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private camStartX = 0;
  private camStartY = 0;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: { [key: string]: Phaser.Input.Keyboard.Key };
  private hoveredCard: Phaser.GameObjects.Container | null = null;
  private selectedCard: Phaser.GameObjects.Container | null = null;
  private itemMap: Map<string, { item: AssetItem; card: Phaser.GameObjects.Container; category: AssetCategory }> = new Map();
  private createdFrames: Set<string> = new Set();

  constructor() {
    super({ key: 'AtlasScene' });
  }

  preload() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const loadingText = this.add.text(width / 2, height / 2, 'Loading Sunnyside Assets...', {
      fontFamily: 'Outfit, sans-serif',
      fontSize: '20px',
      color: '#38bdf8'
    }).setOrigin(0.5);

    this.load.on('progress', (val: number) => {
      loadingText.setText(`Loading Sunnyside Assets... ${Math.round(val * 100)}%`);
    });

    this.load.on('complete', () => {
      loadingText.destroy();
    });

    // 1. Load Main Tilesets
    this.load.image(
      'tileset_sunnysideworld_16px',
      '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Tileset/spr_tileset_sunnysideworld_16px.png'
    );
    this.load.image(
      'tileset_sunnysideworld_forest_32px',
      '/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Tileset/spr_tileset_sunnysideworld_forest_32px.png'
    );

    // 2. Load all unique asset textures and animated strips
    const loadedKeys = new Set<string>();

    for (const cat of ASSET_ATLAS_DATA.categories) {
      for (const itm of cat.items) {
        if (!itm.sourcePath || itm.type === 'iso_block' || itm.type === 'iso_overlay' || itm.type === 'tileset_slice') {
          continue;
        }

        const url = '/' + itm.sourcePath;
        const key = `asset_${itm.id}`;

        if (!loadedKeys.has(key)) {
          loadedKeys.add(key);
          if (itm.type === 'animated_strip') {
            this.load.spritesheet(key, url, {
              frameWidth: itm.w,
              frameHeight: itm.h
            });
          } else if (itm.type === 'image' || itm.type === 'sprite_gm') {
            this.load.image(key, url);
          }
        }
      }
    }
  }

  create() {
    // 1. Setup World Bounds & Camera
    const totalW = ASSET_ATLAS_DATA.worldWidth + 400;
    const totalH = ASSET_ATLAS_DATA.worldHeight + 400;
    this.cameras.main.setBounds(-200, -200, totalW, totalH);
    this.cameras.main.setZoom(1.0);
    this.cameras.main.centerOn(1200, 300);

    // 2. Extract pixel-perfect sub-texture frames for all tileset slices
    for (const cat of ASSET_ATLAS_DATA.categories) {
      for (const itm of cat.items) {
        if (itm.type === 'tileset_slice' && itm.crop) {
          const tilesetKey = (itm.sourcePath.indexOf('forest') !== -1)
            ? 'tileset_sunnysideworld_forest_32px'
            : 'tileset_sunnysideworld_16px';
          const frameKey = `slice_${itm.id}`;

          if (!this.createdFrames.has(frameKey) && this.textures.exists(tilesetKey)) {
            const texture = this.textures.get(tilesetKey);
            if (texture && !texture.has(frameKey)) {
              texture.add(frameKey, 0, itm.crop[0], itm.crop[1], itm.crop[2], itm.crop[3]);
              this.createdFrames.add(frameKey);
            }
          }
        }
      }
    }

    // 3. Setup Animations
    for (const cat of ASSET_ATLAS_DATA.categories) {
      for (const itm of cat.items) {
        if (itm.type === 'animated_strip') {
          const key = `asset_${itm.id}`;
          const animKey = `anim_${itm.id}`;
          if (!this.anims.exists(animKey) && this.textures.exists(key)) {
            this.anims.create({
              key: animKey,
              frames: this.anims.generateFrameNumbers(key, { start: 0, end: itm.frames - 1 }),
              frameRate: itm.fps || 8,
              repeat: -1
            });
          }
        }
      }
    }

    // 4. Render Background Canvas Grid
    this.renderBackground(totalW, totalH);

    // 5. Render All Categories and Items
    for (const cat of ASSET_ATLAS_DATA.categories) {
      this.renderCategory(cat);
    }

    // 6. Setup Laptop Trackpad, Wheel & Drag Controls
    this.setupInputControls();

    // 7. Expose global controller for HTML UI
    (window as any).AtlasViewer = {
      panToCategory: (catId: string) => this.panToCategory(catId),
      panToItem: (itemId: string) => this.panToItem(itemId),
      setZoom: (delta: number) => this.adjustZoom(delta),
      resetZoom: () => this.resetZoom(),
      zoomToFit: () => this.zoomToFit(),
      getItem: (itemId: string) => this.itemMap.get(itemId)?.item
    };

    window.dispatchEvent(new CustomEvent('atlas-ready', { detail: ASSET_ATLAS_DATA }));
  }

  private renderBackground(w: number, h: number) {
    const bg = this.add.graphics();
    bg.fillStyle(0x0c0f17, 1);
    bg.fillRect(-200, -200, w, h);

    // Grid dots / subtle grid
    bg.lineStyle(1, 0x1e293b, 0.4);
    const gridSize = 80;
    for (let x = -200; x < w - 200; x += gridSize) {
      bg.beginPath();
      bg.moveTo(x, -200);
      bg.lineTo(x, h - 200);
      bg.strokePath();
    }
    for (let y = -200; y < h - 200; y += gridSize) {
      bg.beginPath();
      bg.moveTo(-200, y);
      bg.lineTo(w - 200, y);
      bg.strokePath();
    }
  }

  private renderCategory(cat: AssetCategory) {
    const catX = 60;
    const catY = cat.y;
    const catW = cat.width;
    const catH = cat.height;

    // Section Background Panel
    const panel = this.add.graphics();
    panel.fillStyle(0x131a28, 0.75);
    panel.fillRoundedRect(catX - 20, catY - 10, catW + 40, catH + 20, 16);
    panel.lineStyle(1, 0x334155, 0.6);
    panel.strokeRoundedRect(catX - 20, catY - 10, catW + 40, catH + 20, 16);

    // Category Header Banner
    const banner = this.add.graphics();
    banner.fillStyle(0x1e293b, 0.9);
    banner.fillRoundedRect(catX - 10, catY, catW + 20, 48, 10);
    banner.lineStyle(2, 0x0284c7, 0.8);
    banner.strokeRoundedRect(catX - 10, catY, catW + 20, 48, 10);

    // Title Text
    this.add.text(catX + 16, catY + 12, cat.title.toUpperCase(), {
      fontFamily: 'Outfit, sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#f8fafc'
    });

    // Description Text
    this.add.text(catX + 380, catY + 16, cat.desc, {
      fontFamily: 'Outfit, sans-serif',
      fontSize: '12px',
      color: '#94a3b8'
    });

    // Item Count Badge
    const badgeX = catX + catW - 100;
    const badgeG = this.add.graphics();
    badgeG.fillStyle(0x0284c7, 0.25);
    badgeG.fillRoundedRect(badgeX, catY + 10, 80, 26, 13);
    badgeG.lineStyle(1, 0x38bdf8, 0.6);
    badgeG.strokeRoundedRect(badgeX, catY + 10, 80, 26, 13);

    this.add.text(badgeX + 40, catY + 16, `${cat.items.length} Items`, {
      fontFamily: 'Outfit, sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#38bdf8'
    }).setOrigin(0.5, 0);

    // Render individual item cards
    for (const itm of cat.items) {
      this.renderItemCard(itm, cat);
    }
  }

  private renderItemCard(itm: AssetItem, cat: AssetCategory) {
    const card = this.add.container(itm.x, itm.y);
    const cardW = itm.cardW;
    const cardH = itm.cardH;

    // Card background graphics
    const bg = this.add.graphics();
    bg.fillStyle(0x1a2234, 0.9);
    bg.fillRoundedRect(0, 0, cardW, cardH, 8);
    bg.lineStyle(1, 0x334155, 0.8);
    bg.strokeRoundedRect(0, 0, cardW, cardH, 8);
    card.add(bg);

    // Preview pedestal / well
    const previewWell = this.add.graphics();
    const wellPad = 8;
    const wellH = cardH - 34;
    previewWell.fillStyle(0x0f172a, 0.9);
    previewWell.fillRoundedRect(wellPad, wellPad, cardW - wellPad * 2, wellH, 6);
    previewWell.lineStyle(1, 0x1e293b, 0.6);
    previewWell.strokeRoundedRect(wellPad, wellPad, cardW - wellPad * 2, wellH, 6);
    card.add(previewWell);

    // Center position for preview sprite
    const centerX = cardW / 2;
    const centerY = wellPad + wellH / 2;

    // Render the visual element with pixel-perfect origin & sub-textures
    if (itm.type === 'tileset_slice') {
      const tilesetKey = (itm.sourcePath.indexOf('forest') !== -1)
        ? 'tileset_sunnysideworld_forest_32px'
        : 'tileset_sunnysideworld_16px';
      const frameKey = `slice_${itm.id}`;

      if (this.textures.exists(tilesetKey) && this.textures.get(tilesetKey).has(frameKey)) {
        const img = this.add.image(centerX, centerY, tilesetKey, frameKey);
        img.setOrigin(0.5, 0.5);
        if (itm.w <= 16 && itm.h <= 16) {
          img.setScale(1.5);
        }
        card.add(img);
      }
    } else if (itm.type === 'animated_strip') {
      const key = `asset_${itm.id}`;
      if (this.textures.exists(key)) {
        const sprite = this.add.sprite(centerX, centerY, key);
        sprite.setOrigin(0.5, 0.5);
        sprite.play(`anim_${itm.id}`);
        // Scale small animal/vfx sprites for visibility, keep full characters at 1.0
        if (itm.w <= 20 && itm.h <= 20) {
          sprite.setScale(1.5);
        }
        card.add(sprite);
      }
    } else if (itm.type === 'image' || itm.type === 'sprite_gm') {
      const key = `asset_${itm.id}`;
      if (this.textures.exists(key)) {
        const img = this.add.image(centerX, centerY, key);
        img.setOrigin(0.5, 0.5);
        if (itm.w <= 16 && itm.h <= 16) {
          img.setScale(1.5);
        }
        card.add(img);
      }
    } else if (itm.type === 'iso_block') {
      const isoG = this.add.graphics();
      this.drawIsometricBlock(isoG, centerX, centerY, itm);
      card.add(isoG);
    } else if (itm.type === 'iso_overlay') {
      const isoG = this.add.graphics();
      this.drawIsometricOverlay(isoG, centerX, centerY, itm);
      card.add(isoG);
    }

    // Label Text at Bottom
    const maxChars = Math.floor(cardW / 7);
    let displayName = itm.name;
    if (displayName.length > maxChars) {
      displayName = displayName.substring(0, maxChars - 2) + '..';
    }

    const label = this.add.text(centerX, cardH - 16, displayName, {
      fontFamily: 'Outfit, sans-serif',
      fontSize: '11px',
      color: '#e2e8f0'
    }).setOrigin(0.5, 0.5);
    card.add(label);

    // Dimension watermark (top right)
    const dimText = this.add.text(cardW - 12, 12, `${itm.w}×${itm.h}`, {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '8px',
      color: '#64748b'
    }).setOrigin(1, 0);
    card.add(dimText);

    // Interactive Hitbox
    card.setSize(cardW, cardH);
    card.setInteractive({ useHandCursor: true });

    // Hover & Click Events
    card.on('pointerover', () => {
      if (this.hoveredCard && this.hoveredCard !== card) {
        this.resetCardStyle(this.hoveredCard);
      }
      this.hoveredCard = card;
      this.highlightCard(card, 0x38bdf8);

      window.dispatchEvent(new CustomEvent('asset-hover', {
        detail: {
          item: itm,
          category: cat
        }
      }));
    });

    card.on('pointerout', () => {
      if (this.hoveredCard === card) {
        if (this.selectedCard !== card) {
          this.resetCardStyle(card);
        }
        this.hoveredCard = null;
      }
      window.dispatchEvent(new CustomEvent('asset-leave'));
    });

    card.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.getDistance() < 6) {
        if (this.selectedCard && this.selectedCard !== card) {
          this.resetCardStyle(this.selectedCard);
        }
        this.selectedCard = card;
        this.highlightCard(card, 0xf59e0b);

        window.dispatchEvent(new CustomEvent('asset-select', {
          detail: {
            item: itm,
            category: cat
          }
        }));
      }
    });

    this.itemMap.set(itm.id, { item: itm, card, category: cat });
  }

  private drawIsometricBlock(g: Phaser.GameObjects.Graphics, cx: number, cy: number, itm: AssetItem) {
    const topC = itm.topColor || 0x5da845;
    const sideC = itm.sideColor || 0x8a5a36;
    const frontC = itm.frontColor || 0x6e4526;
    const hRatio = itm.heightRatio || 1.0;
    const alpha = itm.alpha || 1.0;

    const rX = 20;
    const rY = 10;
    const blockH = 18 * hRatio;

    // Top diamond face
    g.fillStyle(topC, alpha);
    g.beginPath();
    g.moveTo(cx, cy - rY - blockH / 2);
    g.lineTo(cx + rX, cy - blockH / 2);
    g.lineTo(cx, cy + rY - blockH / 2);
    g.lineTo(cx - rX, cy - blockH / 2);
    g.closePath();
    g.fillPath();

    // Top border highlight
    g.lineStyle(1, 0xffffff, 0.3);
    g.strokePath();

    // Left side face
    g.fillStyle(sideC, alpha);
    g.beginPath();
    g.moveTo(cx - rX, cy - blockH / 2);
    g.lineTo(cx, cy + rY - blockH / 2);
    g.lineTo(cx, cy + rY + blockH / 2);
    g.lineTo(cx - rX, cy + blockH / 2);
    g.closePath();
    g.fillPath();

    // Right side face (front shaded)
    g.fillStyle(frontC, alpha);
    g.beginPath();
    g.moveTo(cx + rX, cy - blockH / 2);
    g.lineTo(cx, cy + rY - blockH / 2);
    g.lineTo(cx, cy + rY + blockH / 2);
    g.lineTo(cx + rX, cy + blockH / 2);
    g.closePath();
    g.fillPath();

    // Outer outline
    g.lineStyle(1, 0x0f172a, 0.6);
    g.beginPath();
    g.moveTo(cx, cy - rY - blockH / 2);
    g.lineTo(cx + rX, cy - blockH / 2);
    g.lineTo(cx + rX, cy + blockH / 2);
    g.lineTo(cx, cy + rY + blockH / 2);
    g.lineTo(cx - rX, cy + blockH / 2);
    g.lineTo(cx - rX, cy - blockH / 2);
    g.closePath();
    g.strokePath();
  }

  private drawIsometricOverlay(g: Phaser.GameObjects.Graphics, cx: number, cy: number, itm: AssetItem) {
    const rX = 20;
    const rY = 10;
    const blockH = 18;

    if (itm.variant === 'preview') {
      g.lineStyle(2, 0x38bdf8, 0.9);
      g.fillStyle(0x38bdf8, 0.2);

      g.beginPath();
      g.moveTo(cx, cy - rY - blockH / 2);
      g.lineTo(cx + rX, cy - blockH / 2);
      g.lineTo(cx, cy + rY - blockH / 2);
      g.lineTo(cx - rX, cy - blockH / 2);
      g.closePath();
      g.fillPath();
      g.strokePath();

      g.beginPath();
      g.moveTo(cx - rX, cy - blockH / 2);
      g.lineTo(cx - rX, cy + blockH / 2);
      g.lineTo(cx, cy + rY + blockH / 2);
      g.lineTo(cx + rX, cy + blockH / 2);
      g.lineTo(cx + rX, cy - blockH / 2);
      g.strokePath();

      g.beginPath();
      g.moveTo(cx, cy + rY - blockH / 2);
      g.lineTo(cx, cy + rY + blockH / 2);
      g.strokePath();
    } else if (itm.variant === 'break') {
      this.drawIsometricBlock(g, cx, cy, { ...itm, topColor: 0x9ca3af, sideColor: 0x6b7280, frontColor: 0x4b5563 });
      g.lineStyle(2, 0x111827, 0.95);
      g.beginPath();
      g.moveTo(cx - 10, cy - 10);
      g.lineTo(cx + 2, cy - 2);
      g.lineTo(cx - 4, cy + 6);
      g.lineTo(cx + 8, cy + 14);
      g.strokePath();
    } else if (itm.variant === 'shadow') {
      g.fillStyle(0x000000, 0.45);
      g.fillEllipse(cx, cy + 12, rX * 2, rY * 2);
    } else {
      g.lineStyle(1.5, 0xf59e0b, 0.8);
      g.strokeRect(cx - 16, cy - 16, 32, 32);
    }
  }

  private highlightCard(card: Phaser.GameObjects.Container, color: number) {
    const bg = card.getAt(0) as Phaser.GameObjects.Graphics;
    if (bg) {
      bg.clear();
      bg.fillStyle(0x1e293b, 0.95);
      bg.fillRoundedRect(0, 0, card.width, card.height, 8);
      bg.lineStyle(2, color, 1.0);
      bg.strokeRoundedRect(0, 0, card.width, card.height, 8);
    }
  }

  private resetCardStyle(card: Phaser.GameObjects.Container) {
    const bg = card.getAt(0) as Phaser.GameObjects.Graphics;
    if (bg) {
      bg.clear();
      bg.fillStyle(0x1a2234, 0.9);
      bg.fillRoundedRect(0, 0, card.width, card.height, 8);
      bg.lineStyle(1, 0x334155, 0.8);
      bg.strokeRoundedRect(0, 0, card.width, card.height, 8);
    }
  }

  private setupInputControls() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasdKeys = this.input.keyboard!.addKeys('W,A,S,D') as any;

    const gameDom = this.game.canvas;

    // Laptop Trackpad Natural 2-Finger Scroll & Pinch-Zoom
    gameDom.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        // Pinch-to-zoom gesture on MacBook trackpad
        const zoomDelta = -e.deltaY * 0.01;
        const currentZoom = this.cameras.main.zoom;
        const newZoom = Phaser.Math.Clamp(currentZoom * Math.exp(zoomDelta), 0.2, 4.0);

        this.cameras.main.setZoom(newZoom);
        window.dispatchEvent(new CustomEvent('zoom-change', { detail: { zoom: newZoom } }));
      } else {
        // Natural 2-finger scroll panning (X and Y simultaneously)
        const zoom = this.cameras.main.zoom;
        this.cameras.main.scrollX += e.deltaX / zoom;
        this.cameras.main.scrollY += e.deltaY / zoom;
      }
    }, { passive: false });

    // Mouse Drag Panning
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isDragging = true;
      this.dragStartX = pointer.x;
      this.dragStartY = pointer.y;
      this.camStartX = this.cameras.main.scrollX;
      this.camStartY = this.cameras.main.scrollY;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      window.dispatchEvent(new CustomEvent('cursor-world-move', {
        detail: {
          x: Math.round(worldPoint.x),
          y: Math.round(worldPoint.y)
        }
      }));

      if (this.isDragging) {
        const dx = (pointer.x - this.dragStartX) / this.cameras.main.zoom;
        const dy = (pointer.y - this.dragStartY) / this.cameras.main.zoom;
        this.cameras.main.setScroll(this.camStartX - dx, this.camStartY - dy);
      }
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
    });
  }

  update(_time: number, delta: number) {
    const panSpeed = (550 * (delta / 1000)) / this.cameras.main.zoom;

    if (this.cursors.left.isDown || this.wasdKeys.A.isDown) {
      this.cameras.main.scrollX -= panSpeed;
    }
    if (this.cursors.right.isDown || this.wasdKeys.D.isDown) {
      this.cameras.main.scrollX += panSpeed;
    }
    if (this.cursors.up.isDown || this.wasdKeys.W.isDown) {
      this.cameras.main.scrollY -= panSpeed;
    }
    if (this.cursors.down.isDown || this.wasdKeys.S.isDown) {
      this.cameras.main.scrollY += panSpeed;
    }
  }

  public panToCategory(catId: string) {
    const cat = ASSET_ATLAS_DATA.categories.find(c => c.id === catId);
    if (cat) {
      this.cameras.main.pan(1200, cat.y + 120, 600, 'Cubic.easeOut');
    }
  }

  public panToItem(itemId: string) {
    const itmData = this.itemMap.get(itemId);
    if (itmData) {
      this.cameras.main.pan(itmData.item.x + itmData.item.cardW / 2, itmData.item.y + itmData.item.cardH / 2, 600, 'Cubic.easeOut');
      if (this.selectedCard && this.selectedCard !== itmData.card) {
        this.resetCardStyle(this.selectedCard);
      }
      this.selectedCard = itmData.card;
      this.highlightCard(itmData.card, 0xf59e0b);
    }
  }

  public adjustZoom(delta: number) {
    const newZoom = Phaser.Math.Clamp(this.cameras.main.zoom + delta, 0.2, 4.0);
    this.cameras.main.zoomTo(newZoom, 200, 'Linear');
    window.dispatchEvent(new CustomEvent('zoom-change', { detail: { zoom: newZoom } }));
  }

  public resetZoom() {
    this.cameras.main.zoomTo(1.0, 250, 'Cubic.easeOut');
    window.dispatchEvent(new CustomEvent('zoom-change', { detail: { zoom: 1.0 } }));
  }

  public zoomToFit() {
    this.cameras.main.zoomTo(0.35, 300, 'Cubic.easeOut');
    this.cameras.main.pan(1200, 3800, 300, 'Cubic.easeOut');
    window.dispatchEvent(new CustomEvent('zoom-change', { detail: { zoom: 0.35 } }));
  }
}
