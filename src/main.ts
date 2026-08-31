import Phaser from 'phaser';
import { AtlasScene } from './scenes/AtlasScene';
import { ASSET_ATLAS_DATA, AssetItem, AssetCategory } from './data/assetRegistry';

// Initialize Phaser Game
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#0c0f17',
  render: {
    pixelArt: true,
    antialias: false,
    roundPixels: true
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [AtlasScene]
};

const game = new Phaser.Game(config);

// DOM Elements
const categoryJumpBar = document.getElementById('category-jump-bar')!;
const sidebarCategoriesList = document.getElementById('sidebar-categories-list')!;
const searchInput = document.getElementById('asset-search-input') as HTMLInputElement;
const searchClearBtn = document.getElementById('search-clear-btn')!;
const searchDropdown = document.getElementById('search-results-dropdown')!;
const hoveredAssetLabel = document.getElementById('hovered-asset-label')!;
const coordBadge = document.getElementById('coord-badge')!;
const zoomLevelLabel = document.getElementById('zoom-level-label')!;
const zoomInBtn = document.getElementById('zoom-in-btn')!;
const zoomOutBtn = document.getElementById('zoom-out-btn')!;
const zoomResetBtn = document.getElementById('zoom-reset-btn')!;
const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn')!;
const closeSidebarBtn = document.getElementById('close-sidebar-btn')!;
const categorySidebar = document.getElementById('category-sidebar')!;

// Inspector Modal Elements
const inspectorModal = document.getElementById('asset-inspector-modal')!;
const closeInspectorBtn = document.getElementById('close-inspector-btn')!;
const inspectCategory = document.getElementById('inspect-category')!;
const inspectName = document.getElementById('inspect-name')!;
const inspectId = document.getElementById('inspect-id')!;
const inspectCoords = document.getElementById('inspect-coords')!;
const inspectSize = document.getElementById('inspect-size')!;
const inspectFrames = document.getElementById('inspect-frames')!;
const inspectDesc = document.getElementById('inspect-desc')!;
const inspectPath = document.getElementById('inspect-path') as HTMLInputElement;
const copyPathBtn = document.getElementById('copy-path-btn')!;
const jumpToItemBtn = document.getElementById('jump-to-item-btn')!;
const inspectPreviewBox = document.getElementById('inspect-preview-box')!;

let activeInspectedItem: { item: AssetItem; category: AssetCategory } | null = null;

// Populate Top Jump Bar and Sidebar
function populateCategoryNav() {
  categoryJumpBar.innerHTML = '';
  sidebarCategoriesList.innerHTML = '';

  ASSET_ATLAS_DATA.categories.forEach((cat, index) => {
    // 1. Top Pill Button
    const pill = document.createElement('button');
    pill.className = 'category-pill';
    pill.innerHTML = `<span>${cat.title}</span><span class="pill-count">${cat.items.length}</span>`;
    pill.addEventListener('click', () => {
      document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      (window as any).AtlasViewer?.panToCategory(cat.id);
    });
    categoryJumpBar.appendChild(pill);

    // 2. Sidebar Card
    const card = document.createElement('div');
    card.className = 'sidebar-cat-card';
    card.innerHTML = `
      <div class="sidebar-cat-title">
        <span>${index + 1}. ${cat.title}</span>
        <span style="color: #38bdf8; font-size: 11px;">${cat.items.length} items</span>
      </div>
      <div class="sidebar-cat-desc">${cat.desc}</div>
    `;
    card.addEventListener('click', () => {
      categorySidebar.classList.remove('open');
      (window as any).AtlasViewer?.panToCategory(cat.id);
    });
    sidebarCategoriesList.appendChild(card);
  });
}

populateCategoryNav();

// Search Functionality
function handleSearch(query: string) {
  query = query.trim().toLowerCase();
  if (!query) {
    searchDropdown.classList.add('hidden');
    searchClearBtn.classList.add('hidden');
    return;
  }

  searchClearBtn.classList.remove('hidden');
  const matches: { item: AssetItem; category: AssetCategory }[] = [];

  for (const cat of ASSET_ATLAS_DATA.categories) {
    for (const itm of cat.items) {
      if (
        itm.name.toLowerCase().includes(query) ||
        itm.id.toLowerCase().includes(query) ||
        itm.desc.toLowerCase().includes(query) ||
        (itm.sourcePath && itm.sourcePath.toLowerCase().includes(query))
      ) {
        matches.push({ item: itm, category: cat });
      }
    }
  }

  if (matches.length === 0) {
    searchDropdown.innerHTML = `<div style="padding: 12px; color: #94a3b8; font-size: 12px;">No matching assets found for "${query}"</div>`;
    searchDropdown.classList.remove('hidden');
    return;
  }

  searchDropdown.innerHTML = '';
  matches.slice(0, 15).forEach(({ item, category }) => {
    const itemRow = document.createElement('div');
    itemRow.className = 'search-item';
    itemRow.innerHTML = `
      <div class="search-item-info">
        <span class="search-item-title">${item.name}</span>
        <span class="search-item-cat">${category.title}</span>
      </div>
      <span class="search-item-coord">(${item.x}, ${item.y})</span>
    `;
    itemRow.addEventListener('click', () => {
      searchDropdown.classList.add('hidden');
      (window as any).AtlasViewer?.panToItem(item.id);
    });
    searchDropdown.appendChild(itemRow);
  });

  searchDropdown.classList.remove('hidden');
}

searchInput.addEventListener('input', (e) => {
  handleSearch((e.target as HTMLInputElement).value);
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    searchDropdown.classList.add('hidden');
  }
});

searchClearBtn.addEventListener('click', () => {
  searchInput.value = '';
  searchDropdown.classList.add('hidden');
  searchClearBtn.classList.add('hidden');
});

document.addEventListener('click', (e) => {
  if (!searchInput.contains(e.target as Node) && !searchDropdown.contains(e.target as Node)) {
    searchDropdown.classList.add('hidden');
  }
});

// Zoom Controls
zoomInBtn.addEventListener('click', () => {
  (window as any).AtlasViewer?.setZoom(0.2);
});

zoomOutBtn.addEventListener('click', () => {
  (window as any).AtlasViewer?.setZoom(-0.2);
});

zoomResetBtn.addEventListener('click', () => {
  (window as any).AtlasViewer?.resetZoom();
});

// Sidebar Toggle
toggleSidebarBtn.addEventListener('click', () => {
  categorySidebar.classList.toggle('open');
});

closeSidebarBtn.addEventListener('click', () => {
  categorySidebar.classList.remove('open');
});

let activeInspectorAnim: number | null = null;

function closeInspector() {
  if (activeInspectorAnim !== null) {
    cancelAnimationFrame(activeInspectorAnim);
    activeInspectorAnim = null;
  }
  inspectorModal.classList.add('hidden');
}

// Inspector Drawer with Pixel-Perfect Canvas Preview
function openInspector(item: AssetItem, category: AssetCategory) {
  if (activeInspectorAnim !== null) {
    cancelAnimationFrame(activeInspectorAnim);
    activeInspectorAnim = null;
  }

  activeInspectedItem = { item, category };
  inspectCategory.textContent = category.title;
  inspectName.textContent = item.name;
  inspectId.textContent = item.id;
  inspectCoords.textContent = `X: ${item.x}, Y: ${item.y}`;
  inspectSize.textContent = `${item.w} × ${item.h} px`;
  inspectFrames.textContent = `${item.frames} frame${item.frames > 1 ? 's' : ''} (${item.fps} FPS)`;
  inspectDesc.textContent = item.desc;
  inspectPath.value = item.sourcePath || 'Generated Procedural Isometric Block';

  // Clear preview box
  inspectPreviewBox.innerHTML = '';

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // Determine display scale based on source size
  function getScale(w: number, h: number): number {
    const max = Math.max(w, h);
    if (max <= 16) return 6;
    if (max <= 32) return 4;
    if (max <= 64) return 3;
    if (max <= 96) return 2;
    return 1;
  }

  if (item.type === 'tileset_slice' && item.crop && item.sourcePath) {
    const [cx, cy, cw, ch] = item.crop;
    const scale = getScale(cw, ch);
    canvas.width = cw * scale;
    canvas.height = ch * scale;
    inspectPreviewBox.appendChild(canvas);

    const img = new Image();
    img.onload = () => {
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, cx, cy, cw, ch, 0, 0, cw * scale, ch * scale);
    };
    img.src = '/' + item.sourcePath;
  } else if (item.type === 'animated_strip' && item.sourcePath) {
    const frameW = item.w;
    const frameH = item.h;
    const totalFrames = item.frames || 1;
    const fps = item.fps || 8;
    const scale = getScale(frameW, frameH);

    canvas.width = frameW * scale;
    canvas.height = frameH * scale;
    inspectPreviewBox.appendChild(canvas);

    const img = new Image();
    img.onload = () => {
      let currentFrame = 0;
      let lastTime = performance.now();
      const interval = 1000 / fps;

      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, frameW, frameH, 0, 0, frameW * scale, frameH * scale);

      if (totalFrames > 1) {
        function loop(now: number) {
          if (inspectorModal.classList.contains('hidden')) return;
          if (now - lastTime >= interval) {
            currentFrame = (currentFrame + 1) % totalFrames;
            lastTime = now;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, currentFrame * frameW, 0, frameW, frameH, 0, 0, frameW * scale, frameH * scale);
          }
          activeInspectorAnim = requestAnimationFrame(loop);
        }
        activeInspectorAnim = requestAnimationFrame(loop);
      }
    };
    img.src = '/' + item.sourcePath;
  } else if ((item.type === 'image' || item.type === 'sprite_gm') && item.sourcePath) {
    const scale = getScale(item.w, item.h);
    canvas.width = item.w * scale;
    canvas.height = item.h * scale;
    inspectPreviewBox.appendChild(canvas);

    const img = new Image();
    img.onload = () => {
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, item.w * scale, item.h * scale);
    };
    img.src = '/' + item.sourcePath;
  } else if (item.type === 'iso_block') {
    canvas.width = 60;
    canvas.height = 60;
    inspectPreviewBox.appendChild(canvas);

    const cx = 30;
    const cy = 30;
    const rX = 18;
    const rY = 9;
    const hRatio = item.heightRatio || 1.0;
    const blockH = 16 * hRatio;

    // Top face
    const topHex = (item.topColor !== undefined ? item.topColor.toString(16).padStart(6, '0') : '5da845');
    ctx.fillStyle = `#${topHex}`;
    ctx.beginPath();
    ctx.moveTo(cx, cy - rY - blockH / 2);
    ctx.lineTo(cx + rX, cy - blockH / 2);
    ctx.lineTo(cx, cy + rY - blockH / 2);
    ctx.lineTo(cx - rX, cy - blockH / 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Left face
    const sideHex = (item.sideColor !== undefined ? item.sideColor.toString(16).padStart(6, '0') : '8a5a36');
    ctx.fillStyle = `#${sideHex}`;
    ctx.beginPath();
    ctx.moveTo(cx - rX, cy - blockH / 2);
    ctx.lineTo(cx, cy + rY - blockH / 2);
    ctx.lineTo(cx, cy + rY + blockH / 2);
    ctx.lineTo(cx - rX, cy + blockH / 2);
    ctx.closePath();
    ctx.fill();

    // Right face
    const frontHex = (item.frontColor !== undefined ? item.frontColor.toString(16).padStart(6, '0') : '6e4526');
    ctx.fillStyle = `#${frontHex}`;
    ctx.beginPath();
    ctx.moveTo(cx + rX, cy - blockH / 2);
    ctx.lineTo(cx, cy + rY - blockH / 2);
    ctx.lineTo(cx, cy + rY + blockH / 2);
    ctx.lineTo(cx + rX, cy + blockH / 2);
    ctx.closePath();
    ctx.fill();

    // Outline
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.beginPath();
    ctx.moveTo(cx, cy - rY - blockH / 2);
    ctx.lineTo(cx + rX, cy - blockH / 2);
    ctx.lineTo(cx + rX, cy + blockH / 2);
    ctx.lineTo(cx, cy + rY + blockH / 2);
    ctx.lineTo(cx - rX, cy + blockH / 2);
    ctx.lineTo(cx - rX, cy - blockH / 2);
    ctx.closePath();
    ctx.stroke();
  } else {
    inspectPreviewBox.innerHTML = `<span style="color: #38bdf8; font-weight: 600;">[ ${item.name} ]</span>`;
  }

  inspectorModal.classList.remove('hidden');
}

closeInspectorBtn.addEventListener('click', () => {
  closeInspector();
});

inspectorModal.addEventListener('click', (e) => {
  if (e.target === inspectorModal) {
    closeInspector();
  }
});

copyPathBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(inspectPath.value);
  copyPathBtn.textContent = 'Copied!';
  setTimeout(() => {
    copyPathBtn.textContent = 'Copy Path';
  }, 1500);
});

jumpToItemBtn.addEventListener('click', () => {
  if (activeInspectedItem) {
    (window as any).AtlasViewer?.panToItem(activeInspectedItem.item.id);
    inspectorModal.classList.add('hidden');
  }
});

// Custom Events from Phaser Scene
window.addEventListener('cursor-world-move', ((e: CustomEvent) => {
  coordBadge.innerHTML = `<span>X: ${e.detail.x}</span> &bull; <span>Y: ${e.detail.y}</span>`;
}) as EventListener);

window.addEventListener('asset-hover', ((e: CustomEvent) => {
  const item = e.detail.item as AssetItem;
  const category = e.detail.category as AssetCategory;
  hoveredAssetLabel.innerHTML = `<strong>${item.name}</strong> <span style="color: #94a3b8;">(${category.title})</span> &bull; <span style="font-family: var(--font-mono); color: #38bdf8;">${item.w}×${item.h}px</span> &bull; <span style="font-family: var(--font-mono); color: #a5b4fc;">${item.sourcePath}</span>`;
}) as EventListener);

window.addEventListener('asset-leave', (() => {
  hoveredAssetLabel.textContent = 'Hover any asset or drag canvas to explore';
}) as EventListener);

window.addEventListener('asset-select', ((e: CustomEvent) => {
  openInspector(e.detail.item, e.detail.category);
}) as EventListener);

window.addEventListener('zoom-change', ((e: CustomEvent) => {
  zoomLevelLabel.textContent = `${Math.round(e.detail.zoom * 100)}%`;
}) as EventListener);
