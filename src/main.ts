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

// Inspector Drawer
function openInspector(item: AssetItem, category: AssetCategory) {
  activeInspectedItem = { item, category };
  inspectCategory.textContent = category.title;
  inspectName.textContent = item.name;
  inspectId.textContent = item.id;
  inspectCoords.textContent = `X: ${item.x}, Y: ${item.y}`;
  inspectSize.textContent = `${item.w} × ${item.h} px`;
  inspectFrames.textContent = `${item.frames} frame${item.frames > 1 ? 's' : ''} (${item.fps} FPS)`;
  inspectDesc.textContent = item.desc;
  inspectPath.value = item.sourcePath || 'Generated Procedural Isometric Block';

  // Preview Box Rendering
  inspectPreviewBox.innerHTML = '';
  if (item.sourcePath && item.sourcePath.startsWith('Sunnyside') || item.sourcePath && item.sourcePath.startsWith('Assets')) {
    const img = document.createElement('img');
    img.src = '/' + item.sourcePath;
    img.alt = item.name;
    img.style.maxHeight = '80px';
    img.style.objectFit = 'contain';
    inspectPreviewBox.appendChild(img);
  } else {
    inspectPreviewBox.innerHTML = `<span style="color: #38bdf8; font-weight: 600;">[ ${item.name} ]</span>`;
  }

  inspectorModal.classList.remove('hidden');
}

closeInspectorBtn.addEventListener('click', () => {
  inspectorModal.classList.add('hidden');
});

inspectorModal.addEventListener('click', (e) => {
  if (e.target === inspectorModal) {
    inspectorModal.classList.add('hidden');
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
