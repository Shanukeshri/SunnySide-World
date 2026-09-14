import {
  ASSET_ATLAS_DATA,
  AssetItem,
  AssetCategory,
} from "./data/assetRegistry";
import {
  generateSettlement,
  SettlementData,
} from "./generation/SettlementGenerator";
import {
  renderSettlement,
  prepareSettlementScene,
  PreparedSettlementScene,
  RenderOptions,
} from "./generation/SettlementRenderer";
import { LifeformManager } from "./lifeforms/LifeformManager";
import { LifeformRenderer } from "./lifeforms/LifeformRenderer";
import { Animal } from "./lifeforms/Animal";
import { NPC } from "./lifeforms/NPC";
import {
  SurvivalEngine,
  ITEM_CATALOG,
  CRAFTING_RECIPES,
} from "./game/SurvivalEngine";
import { SurvivalRenderer } from "./game/SurvivalRenderer";
import { GameAudio } from "./game/GameAudio";
import {
  ItemId,
  Recipe,
  PlacedStructure,
  InventorySlot,
} from "./game/GameTypes";
import { NetworkClient } from "./client/NetworkClient";
import { SPECIES_CONFIGS } from "./lifeforms/speciesConfig";
import { isAssetCollidable } from "./data/assetCollision";
import { WorldManager } from "./game/WorldManager";

// ═══════════════════════════════════════════════════════════════════
// LAZY PHASER GAME INIT
// ═══════════════════════════════════════════════════════════════════
let game: any = null;

function initPhaser() {
  if (game) return;
  import("phaser").then(({ default: Phaser }) => {
    return import("./scenes/AtlasScene").then(({ AtlasScene }) => {
      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: "game-container",
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: "#0c0f17",
        render: { pixelArt: true, antialias: false, roundPixels: true },
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        scene: [AtlasScene],
      };
      game = new Phaser.Game(config);
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// TAB SWITCHING
// ═══════════════════════════════════════════════════════════════════
const tabSettlement = document.getElementById("tab-settlement")!;
const tabGame = document.getElementById("tab-game")!;
const tabHouses = document.getElementById("tab-houses")!;
const tabTerrain = document.getElementById("tab-terrain")!;
const tabAssetsMap = document.getElementById("tab-assets-map")!;

const viewSettlement = document.getElementById("settlement-view")!;
const viewGame = document.getElementById("game-view")!;
const viewHouses = document.getElementById("houses-view")!;
const viewTerrain = document.getElementById("terrain-view")!;
const viewAssetsMap = document.getElementById("assets-map-view")!;

const atlasControls = document.getElementById("atlas-controls")!;
const allViews = [
  viewSettlement,
  viewGame,
  viewHouses,
  viewTerrain,
  viewAssetsMap,
];
const allTabs = [tabSettlement, tabGame, tabHouses, tabTerrain, tabAssetsMap];

export function switchTab(
  tab: "settlement" | "game" | "houses" | "terrain" | "assets-map",
) {
  allViews.forEach((v) => v.classList.remove("active"));
  allTabs.forEach((t) => {
    t.classList.remove("active");
    t.setAttribute("aria-selected", "false");
  });

  if (tab === "game") {
    stopSettlementLoop();
    viewGame.classList.add("active");
    tabGame.classList.add("active");
    tabGame.setAttribute("aria-selected", "true");
    atlasControls.classList.add("hidden");
    if (game) game.scene.pause("AtlasScene");
    ensureSurvivalGameLoaded();
    startSurvivalGameLoop();
  } else if (tab === "settlement") {
    stopSurvivalGameLoop();
    viewSettlement.classList.add("active");
    tabSettlement.classList.add("active");
    tabSettlement.setAttribute("aria-selected", "true");
    atlasControls.classList.add("hidden");
    if (game) game.scene.pause("AtlasScene");
    ensureSettlementLoaded();
    startSettlementLoop();
  } else {
    stopSettlementLoop();
    stopSurvivalGameLoop();
    if (tab === "houses") {
      viewHouses.classList.add("active");
      tabHouses.classList.add("active");
      tabHouses.setAttribute("aria-selected", "true");
      atlasControls.classList.add("hidden");
      if (game) game.scene.pause("AtlasScene");
      drawHouses();
    } else if (tab === "terrain") {
      viewTerrain.classList.add("active");
      tabTerrain.classList.add("active");
      tabTerrain.setAttribute("aria-selected", "true");
      atlasControls.classList.add("hidden");
      if (game) game.scene.pause("AtlasScene");
      drawTerrainChunks();
    } else if (tab === "assets-map") {
      viewAssetsMap.classList.add("active");
      tabAssetsMap.classList.add("active");
      tabAssetsMap.setAttribute("aria-selected", "true");
      atlasControls.classList.remove("hidden");
      initPhaser();
      if (game) game.scene.resume("AtlasScene");
    }
  }
}

tabSettlement.addEventListener("click", () => switchTab("settlement"));
tabGame.addEventListener("click", () => switchTab("game"));
tabHouses.addEventListener("click", () => switchTab("houses"));
tabTerrain.addEventListener("click", () => switchTab("terrain"));
tabAssetsMap.addEventListener("click", () => switchTab("assets-map"));

// ═══════════════════════════════════════════════════════════════════
// ATLAS DOM
// ═══════════════════════════════════════════════════════════════════
const categoryJumpBar = document.getElementById("category-jump-bar")!;
const sidebarCategoriesList = document.getElementById(
  "sidebar-categories-list",
)!;
const searchInput = document.getElementById(
  "asset-search-input",
) as HTMLInputElement;
const searchClearBtn = document.getElementById("search-clear-btn")!;
const searchDropdown = document.getElementById("search-results-dropdown")!;
const hoveredAssetLabel = document.getElementById("hovered-asset-label")!;
const coordBadge = document.getElementById("coord-badge")!;
const zoomLevelLabel = document.getElementById("zoom-level-label")!;
const zoomInBtn = document.getElementById("zoom-in-btn")!;
const zoomOutBtn = document.getElementById("zoom-out-btn")!;
const zoomResetBtn = document.getElementById("zoom-reset-btn")!;
const toggleSidebarBtn = document.getElementById("toggle-sidebar-btn")!;
const closeSidebarBtn = document.getElementById("close-sidebar-btn")!;
const categorySidebar = document.getElementById("category-sidebar")!;
const inspectorModal = document.getElementById("asset-inspector-modal")!;
const closeInspectorBtn = document.getElementById("close-inspector-btn")!;
const inspectCategory = document.getElementById("inspect-category")!;
const inspectName = document.getElementById("inspect-name")!;
const inspectId = document.getElementById("inspect-id")!;
const inspectCoords = document.getElementById("inspect-coords")!;
const inspectSize = document.getElementById("inspect-size")!;
const inspectFrames = document.getElementById("inspect-frames")!;
const inspectDesc = document.getElementById("inspect-desc")!;
const inspectPath = document.getElementById("inspect-path") as HTMLInputElement;
const copyPathBtn = document.getElementById("copy-path-btn")!;
const jumpToItemBtn = document.getElementById("jump-to-item-btn")!;
const inspectPreviewBox = document.getElementById("inspect-preview-box")!;

let activeInspectedItem: { item: AssetItem; category: AssetCategory } | null =
  null;

// ═══════════════════════════════════════════════════════════════════
// CATEGORY NAV
// ═══════════════════════════════════════════════════════════════════
function populateCategoryNav() {
  categoryJumpBar.innerHTML = "";
  sidebarCategoriesList.innerHTML = "";
  ASSET_ATLAS_DATA.categories.forEach((cat, index) => {
    const pill = document.createElement("button");
    pill.className = "category-pill";
    pill.innerHTML = `<span>${cat.title}</span><span class="pill-count">${cat.items.length}</span>`;
    pill.addEventListener("click", () => {
      document
        .querySelectorAll(".category-pill")
        .forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      if (cat.id === "houses") {
        switchTab("houses");
        return;
      }
      (window as any).AtlasViewer?.panToCategory(cat.id);
    });
    categoryJumpBar.appendChild(pill);
    const card = document.createElement("div");
    card.className = "sidebar-cat-card";
    card.innerHTML = `
      <div class="sidebar-cat-title">
        <span>${index + 1}. ${cat.title}</span>
        <span style="color:#38bdf8;font-size:11px;">${cat.items.length} items</span>
      </div>
      <div class="sidebar-cat-desc">${cat.desc}</div>
    `;
    card.addEventListener("click", () => {
      categorySidebar.classList.remove("open");
      if (cat.id === "houses") {
        switchTab("houses");
        return;
      }
      (window as any).AtlasViewer?.panToCategory(cat.id);
    });
    sidebarCategoriesList.appendChild(card);
  });
}
populateCategoryNav();

// ═══════════════════════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════════════════════
function handleSearch(query: string) {
  query = query.trim().toLowerCase();
  if (!query) {
    searchDropdown.classList.add("hidden");
    searchClearBtn.classList.add("hidden");
    return;
  }
  searchClearBtn.classList.remove("hidden");
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
    searchDropdown.innerHTML = `<div style="padding:12px;color:#94a3b8;font-size:12px;">No results for "${query}"</div>`;
    searchDropdown.classList.remove("hidden");
    return;
  }
  searchDropdown.innerHTML = "";
  matches.slice(0, 15).forEach(({ item, category }) => {
    const row = document.createElement("div");
    row.className = "search-item";
    row.innerHTML = `<div class="search-item-info"><span class="search-item-title">${item.name}</span><span class="search-item-cat">${category.title}</span></div><span class="search-item-coord">(${item.x}, ${item.y})</span>`;
    row.addEventListener("click", () => {
      searchDropdown.classList.add("hidden");
      (window as any).AtlasViewer?.panToItem(item.id);
    });
    searchDropdown.appendChild(row);
  });
  searchDropdown.classList.remove("hidden");
}
searchInput.addEventListener("input", (e) =>
  handleSearch((e.target as HTMLInputElement).value),
);
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Escape") searchDropdown.classList.add("hidden");
});
searchClearBtn.addEventListener("click", () => {
  searchInput.value = "";
  searchDropdown.classList.add("hidden");
  searchClearBtn.classList.add("hidden");
});
document.addEventListener("click", (e) => {
  if (
    !searchInput.contains(e.target as Node) &&
    !searchDropdown.contains(e.target as Node)
  )
    searchDropdown.classList.add("hidden");
});

zoomInBtn.addEventListener("click", () =>
  (window as any).AtlasViewer?.setZoom(0.2),
);
zoomOutBtn.addEventListener("click", () =>
  (window as any).AtlasViewer?.setZoom(-0.2),
);
zoomResetBtn.addEventListener("click", () =>
  (window as any).AtlasViewer?.resetZoom(),
);

toggleSidebarBtn.addEventListener("click", () =>
  categorySidebar.classList.toggle("open"),
);
closeSidebarBtn.addEventListener("click", () =>
  categorySidebar.classList.remove("open"),
);

// ═══════════════════════════════════════════════════════════════════
// INSPECTOR
// ═══════════════════════════════════════════════════════════════════
let activeInspectorAnim: number | null = null;
function closeInspector() {
  if (activeInspectorAnim !== null) {
    cancelAnimationFrame(activeInspectorAnim);
    activeInspectorAnim = null;
  }
  inspectorModal.classList.add("hidden");
}
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
  const isCollidable = isAssetCollidable(item, category.id);
  const inspectCollisionType = document.getElementById("inspect-collision-type");
  if (inspectCollisionType) {
    if (isCollidable) {
      inspectCollisionType.innerHTML = `<span class="badge-collidable">🧱 Collidable / Solid (Blocks movement)</span>`;
    } else {
      inspectCollisionType.innerHTML = `<span class="badge-flat">🌿 Flat / Walkable (Open ground)</span>`;
    }
  }
  inspectFrames.textContent = `${item.frames} frame${item.frames > 1 ? "s" : ""} (${item.fps} FPS)`;
  inspectDesc.textContent = item.desc;
  inspectPath.value = item.sourcePath || "Generated Procedural";
  inspectPreviewBox.innerHTML = "";
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  function gs(w: number, h: number) {
    const m = Math.max(w, h);
    return m <= 16 ? 6 : m <= 32 ? 4 : m <= 64 ? 3 : m <= 96 ? 2 : 1;
  }
  if (item.type === "tileset_slice" && item.crop && item.sourcePath) {
    const [cx, cy, cw, ch] = item.crop;
    const sc = gs(cw, ch);
    canvas.width = cw * sc;
    canvas.height = ch * sc;
    inspectPreviewBox.appendChild(canvas);
    const img = new Image();
    img.onload = () => {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, cx, cy, cw, ch, 0, 0, cw * sc, ch * sc);
    };
    img.src = "/" + item.sourcePath;
  } else if (item.type === "animated_strip" && item.sourcePath) {
    const fw = item.w,
      fh = item.h,
      tf = item.frames || 1,
      fps = item.fps || 8,
      sc = gs(fw, fh);
    canvas.width = fw * sc;
    canvas.height = fh * sc;
    inspectPreviewBox.appendChild(canvas);
    const img = new Image();
    img.onload = () => {
      let cf = 0,
        lt = performance.now();
      const iv = 1000 / fps;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, fw, fh, 0, 0, fw * sc, fh * sc);
      if (tf > 1) {
        function loop(n: number) {
          if (inspectorModal.classList.contains("hidden")) return;
          if (n - lt >= iv) {
            cf = (cf + 1) % tf;
            lt = n;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, cf * fw, 0, fw, fh, 0, 0, fw * sc, fh * sc);
          }
          activeInspectorAnim = requestAnimationFrame(loop);
        }
        activeInspectorAnim = requestAnimationFrame(loop);
      }
    };
    img.src = "/" + item.sourcePath;
  } else if (
    (item.type === "image" || item.type === "sprite_gm") &&
    item.sourcePath
  ) {
    const sc = gs(item.w, item.h);
    canvas.width = item.w * sc;
    canvas.height = item.h * sc;
    inspectPreviewBox.appendChild(canvas);
    const img = new Image();
    img.onload = () => {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, item.w * sc, item.h * sc);
    };
    img.src = "/" + item.sourcePath;
  } else {
    inspectPreviewBox.innerHTML = `<span style="color:#38bdf8;font-weight:600;">[ ${item.name} ]</span>`;
  }
  inspectorModal.classList.remove("hidden");
}
closeInspectorBtn.addEventListener("click", closeInspector);
inspectorModal.addEventListener("click", (e) => {
  if (e.target === inspectorModal) closeInspector();
});
copyPathBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(inspectPath.value);
  copyPathBtn.textContent = "Copied!";
  setTimeout(() => (copyPathBtn.textContent = "Copy Path"), 1500);
});
jumpToItemBtn.addEventListener("click", () => {
  if (activeInspectedItem) {
    (window as any).AtlasViewer?.panToItem(activeInspectedItem.item.id);
    inspectorModal.classList.add("hidden");
  }
});

// ═══════════════════════════════════════════════════════════════════
// FLOATING HOVER TOOLTIP
// ═══════════════════════════════════════════════════════════════════
const floatingTooltip = document.createElement("div");
floatingTooltip.className = "atlas-floating-tooltip hidden";
document.body.appendChild(floatingTooltip);

// Update asset count badge
const assetCountBadge = document.getElementById("asset-count-badge");
if (assetCountBadge) {
  assetCountBadge.innerHTML = `<span>${ASSET_ATLAS_DATA.totalItems} Assets</span>`;
}

// Wire up collision filter buttons
const collisionFilterButtons = document.querySelectorAll<HTMLButtonElement>(
  "#atlas-collision-filters .filter-pill"
);
collisionFilterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    collisionFilterButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const filter = btn.getAttribute("data-filter") as "all" | "flat" | "collidable";
    (window as any).AtlasViewer?.setCollisionFilter(filter);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PHASER EVENTS
// ═══════════════════════════════════════════════════════════════════
window.addEventListener("cursor-world-move", ((e: CustomEvent) => {
  coordBadge.innerHTML = `<span>X: ${e.detail.x}</span> &bull; <span>Y: ${e.detail.y}</span>`;
}) as EventListener);

window.addEventListener("asset-hover", ((e: CustomEvent) => {
  const i = e.detail.item as AssetItem;
  const c = e.detail.category as AssetCategory;
  const isCollidable = e.detail.isCollidable !== undefined ? e.detail.isCollidable : isAssetCollidable(i, c.id);
  const collBadge = isCollidable
    ? `<span style="color:#f87171;font-weight:600;background:rgba(239,68,68,0.15);padding:1px 6px;border-radius:4px;border:1px solid rgba(239,68,68,0.4);">🧱 Solid</span>`
    : `<span style="color:#34d399;font-weight:600;background:rgba(16,185,129,0.15);padding:1px 6px;border-radius:4px;border:1px solid rgba(16,185,129,0.4);">🌿 Flat</span>`;
  hoveredAssetLabel.innerHTML = `<strong>${i.name}</strong> <span style="color:#94a3b8;">(${c.title})</span> &bull; ${collBadge} &bull; <span style="font-family:var(--font-mono);color:#38bdf8;">${i.w}×${i.h}px</span>`;

  // Position floating tooltip
  const px = e.detail.pointerX ?? 0;
  const py = e.detail.pointerY ?? 0;
  if (px > 0 && py > 0) {
    floatingTooltip.innerHTML = `
      <div class="tooltip-title">${i.name}</div>
      <div class="tooltip-meta">
        <span class="tooltip-cat">${c.title}</span>
        <span class="tooltip-badge ${isCollidable ? 'collidable' : 'flat'}">${isCollidable ? '🧱 Solid' : '🌿 Flat'}</span>
        <span class="tooltip-dim">${i.w}×${i.h}px</span>
      </div>
      <div class="tooltip-desc">${i.desc}</div>
    `;
    const tooltipX = Math.min(window.innerWidth - 240, px + 15);
    const tooltipY = Math.min(window.innerHeight - 100, py + 15);
    floatingTooltip.style.left = `${tooltipX}px`;
    floatingTooltip.style.top = `${tooltipY}px`;
    floatingTooltip.classList.remove("hidden");
  }
}) as EventListener);

window.addEventListener("asset-leave", (() => {
  hoveredAssetLabel.textContent = "Hover any asset or scroll to explore";
  floatingTooltip.classList.add("hidden");
}) as EventListener);

window.addEventListener("asset-select", ((e: CustomEvent) => {
  openInspector(e.detail.item, e.detail.category);
  floatingTooltip.classList.add("hidden");
}) as EventListener);

window.addEventListener("zoom-change", ((e: CustomEvent) => {
  zoomLevelLabel.textContent = `${Math.round(e.detail.zoom * 100)}%`;
}) as EventListener);

// ═══════════════════════════════════════════════════════════════════
// HOUSES TAB — display houses.png as individual 128×128 cards
// ═══════════════════════════════════════════════════════════════════

interface HouseDef {
  id: string;
  name: string;
  desc: string;
  crop: [number, number, number, number]; // x, y, w, h in houses.png
  nativeW: number;
  nativeH: number;
}

const HOUSES: HouseDef[] = [
  {
    id: "house_cottage_01",
    name: "Cottage",
    desc: "Small starter cottage with thatched roof",
    crop: [89, 50, 215, 204],
    nativeW: 215,
    nativeH: 204,
  },
  {
    id: "house_farmhouse_01",
    name: "Farmhouse",
    desc: "Medium farmhouse with porch and chimney",
    crop: [435, 72, 292, 181],
    nativeW: 292,
    nativeH: 181,
  },
  {
    id: "house_barn_01",
    name: "Barn",
    desc: "Tall barn with steep pitched roof",
    crop: [873, 38, 179, 212],
    nativeW: 179,
    nativeH: 212,
  },
  {
    id: "house_workshop_01",
    name: "Workshop",
    desc: "Wide workshop building with double doors",
    crop: [1186, 60, 274, 197],
    nativeW: 274,
    nativeH: 197,
  },
  {
    id: "house_tavern_01",
    name: "Tavern",
    desc: "Two-story village tavern with signage",
    crop: [74, 270, 228, 210],
    nativeW: 228,
    nativeH: 210,
  },
  {
    id: "house_shop_01",
    name: "Shop",
    desc: "Wide single-story village shop",
    crop: [444, 307, 280, 174],
    nativeW: 280,
    nativeH: 174,
  },
  {
    id: "house_chapel_01",
    name: "Chapel",
    desc: "Small chapel with bell tower",
    crop: [854, 273, 227, 206],
    nativeW: 227,
    nativeH: 206,
  },
  {
    id: "house_stable_01",
    name: "Stable",
    desc: "Low stable building for livestock",
    crop: [1198, 303, 254, 180],
    nativeW: 254,
    nativeH: 180,
  },
  {
    id: "house_warehouse_01",
    name: "Warehouse",
    desc: "Square warehouse with flat front",
    crop: [80, 490, 208, 212],
    nativeW: 208,
    nativeH: 212,
  },
  {
    id: "house_merchant_01",
    name: "Merchant House",
    desc: "Wide merchant residence with awning",
    crop: [445, 524, 283, 181],
    nativeW: 283,
    nativeH: 181,
  },
  {
    id: "house_blacksmith_01",
    name: "Blacksmith Forge",
    desc: "Tall forge with chimney and anvil",
    crop: [877, 486, 182, 218],
    nativeW: 182,
    nativeH: 218,
  },
  {
    id: "house_windmill_01",
    name: "Windmill",
    desc: "Low windmill base with gear housing",
    crop: [1198, 545, 258, 158],
    nativeW: 258,
    nativeH: 158,
  },
  {
    id: "house_mansion_01",
    name: "Mansion",
    desc: "Large two-story mansion with balcony",
    crop: [67, 734, 240, 227],
    nativeW: 240,
    nativeH: 227,
  },
  {
    id: "house_cabin_01",
    name: "Cabin",
    desc: "Wide rustic cabin with extended roof",
    crop: [457, 769, 262, 198],
    nativeW: 262,
    nativeH: 198,
  },
  {
    id: "house_castle_01",
    name: "Castle Tower",
    desc: "Tall fortified castle tower with battlements",
    crop: [841, 734, 231, 232],
    nativeW: 231,
    nativeH: 232,
  },
  {
    id: "house_lighthouse_01",
    name: "Lighthouse",
    desc: "Wide lighthouse base with lantern room",
    crop: [1212, 787, 261, 181],
    nativeW: 261,
    nativeH: 181,
  },
];

const DISPLAY_SIZE = 128;

function drawHouses() {
  // Draw full-sheet canvas
  const canvas = document.getElementById("house-canvas") as HTMLCanvasElement;
  if (canvas) {
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    const img = new Image();
    img.onload = () => {
      const maxW = window.innerWidth - 320;
      const maxH = window.innerHeight - 400;
      const scale = Math.min(maxW / img.width, maxH / img.height, 2);
      canvas.width = Math.ceil(img.width * scale);
      canvas.height = Math.ceil(img.height * scale);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = "/houses.png";
  }

  // Build house card grid
  const grid = document.getElementById("house-card-grid");
  if (!grid) return;
  grid.innerHTML = "";

  const img = new Image();
  img.onload = () => {
    HOUSES.forEach((h, idx) => {
      const [cx, cy, cw, ch] = h.crop;

      // Compute aspect-scaled display dimensions
      const scaleF = Math.min(DISPLAY_SIZE / cw, DISPLAY_SIZE / ch);
      const dispW = Math.round(cw * scaleF);
      const dispH = Math.round(ch * scaleF);

      // Card element
      const card = document.createElement("div");
      card.className = "house-card";

      // Preview well — 128×128 dark box
      const well = document.createElement("div");
      well.className = "house-card-well";

      // Canvas for the cropped house
      const cvs = document.createElement("canvas");
      cvs.width = DISPLAY_SIZE;
      cvs.height = DISPLAY_SIZE;
      cvs.className = "house-card-canvas";
      const cctx = cvs.getContext("2d")!;
      cctx.imageSmoothingEnabled = false;

      // Clear to dark background
      cctx.fillStyle = "#0f172a";
      cctx.fillRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE);

      // Draw faint 128×128 grid border
      cctx.strokeStyle = "rgba(56, 189, 248, 0.15)";
      cctx.lineWidth = 1;
      cctx.strokeRect(0.5, 0.5, DISPLAY_SIZE - 1, DISPLAY_SIZE - 1);

      // Center the scaled house in the 128×128 well
      const offsetX = Math.floor((DISPLAY_SIZE - dispW) / 2);
      const offsetY = Math.floor((DISPLAY_SIZE - dispH) / 2);
      cctx.drawImage(img, cx, cy, cw, ch, offsetX, offsetY, dispW, dispH);

      // Draw dimension crosshairs (showing exact rendered size)
      cctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
      cctx.lineWidth = 1;
      // Width indicator line at bottom
      const wLineY = offsetY + dispH + 4;
      if (wLineY < DISPLAY_SIZE - 2) {
        cctx.beginPath();
        cctx.moveTo(offsetX, wLineY);
        cctx.lineTo(offsetX + dispW, wLineY);
        cctx.stroke();
      }
      // Height indicator line at right
      const hLineX = offsetX + dispW + 4;
      if (hLineX < DISPLAY_SIZE - 2) {
        cctx.beginPath();
        cctx.moveTo(hLineX, offsetY);
        cctx.lineTo(hLineX, offsetY + dispH);
        cctx.stroke();
      }

      well.appendChild(cvs);

      // Dimension label inside well
      const dimLabel = document.createElement("div");
      dimLabel.className = "house-card-dim-label";
      dimLabel.textContent = `${dispW}×${dispH}`;
      well.appendChild(dimLabel);

      // Card info
      const info = document.createElement("div");
      info.className = "house-card-info";

      const nameEl = document.createElement("div");
      nameEl.className = "house-card-name";
      nameEl.textContent = h.name;

      const idEl = document.createElement("div");
      idEl.className = "house-card-id";
      idEl.textContent = h.id;

      const nativeEl = document.createElement("div");
      nativeEl.className = "house-card-native";
      nativeEl.textContent = `Native: ${h.nativeW}×${h.nativeH}px → Display: ${dispW}×${dispH}px`;

      const descEl = document.createElement("div");
      descEl.className = "house-card-desc";
      descEl.textContent = h.desc;

      info.appendChild(nameEl);
      info.appendChild(idEl);
      info.appendChild(nativeEl);
      info.appendChild(descEl);

      card.appendChild(well);
      card.appendChild(info);
      grid.appendChild(card);
    });
  };
  img.src = "/houses.png";
}

// ═══════════════════════════════════════════════════════════════════
// TERRAIN & BIOME TAB — real map-based elevation example using only tiles from map.txt
// ═══════════════════════════════════════════════════════════════════

const TILESET_PATH =
  "/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Tileset/spr_tileset_sunnysideworld_16px.png";

const TERRAIN_TILE_COORDS: Record<
  string,
  { x: number; y: number; w: number; h: number }
> = {
  grass: { x: 16, y: 48, w: 16, h: 16 },
  grassAlt: { x: 32, y: 48, w: 16, h: 16 },
  dirt: { x: 16, y: 112, w: 16, h: 16 },
  sand: { x: 208, y: 48, w: 16, h: 16 },
  water: { x: 352, y: 112, w: 16, h: 16 },
  shore: { x: 368, y: 112, w: 16, h: 16 },
  elevation: { x: 16, y: 64, w: 16, h: 32 },
};

const TERRAIN_SAMPLE = [
  "GGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGW",
  "GGGGGGGSSSSWWW",
  "GGGGGGGSSSSWWW",
  "GGGGGGGGGGGWWW",
  "GGGGGGGGGGGWWW",
];

function drawTerrainChunks() {
  const grid = document.getElementById("terrain-card-grid");
  if (!grid) return;
  grid.innerHTML = "";

  const card = document.createElement("div");
  card.className = "house-card";

  const well = document.createElement("div");
  well.className = "house-card-well";

  const canvas = document.createElement("canvas");
  canvas.width = 240;
  canvas.height = 160;
  canvas.className = "house-card-canvas";
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  const img = new Image();
  img.onload = () => {
    const tileSize = 16;
    const offsetX = 0;
    const offsetY = 0;

    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let row = 0; row < TERRAIN_SAMPLE.length; row++) {
      for (let col = 0; col < TERRAIN_SAMPLE[row].length; col++) {
        const tile = TERRAIN_SAMPLE[row][col];
        let source = TERRAIN_TILE_COORDS.grass;

        if (tile === "S") source = TERRAIN_TILE_COORDS.sand;
        if (tile === "W") source = TERRAIN_TILE_COORDS.water;
        if (tile === "G")
          source =
            (row + col) % 2 === 0
              ? TERRAIN_TILE_COORDS.grass
              : TERRAIN_TILE_COORDS.grassAlt;

        ctx.drawImage(
          img,
          source.x,
          source.y,
          source.w,
          source.h,
          offsetX + col * tileSize,
          offsetY + row * tileSize,
          tileSize,
          tileSize,
        );
      }
    }

    for (let i = 0; i < 4; i++) {
      ctx.drawImage(
        img,
        TERRAIN_TILE_COORDS.shore.x,
        TERRAIN_TILE_COORDS.shore.y,
        TERRAIN_TILE_COORDS.shore.w,
        TERRAIN_TILE_COORDS.shore.h,
        8 * 16 + i * 16,
        5 * 16 + 2,
        16,
        16,
      );
    }

    ctx.drawImage(
      img,
      TERRAIN_TILE_COORDS.elevation.x,
      TERRAIN_TILE_COORDS.elevation.y,
      TERRAIN_TILE_COORDS.elevation.w,
      TERRAIN_TILE_COORDS.elevation.h,
      9 * 16,
      4 * 16,
      16,
      32,
    );

    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, canvas.width, 12);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "8px JetBrains Mono, monospace";
    ctx.fillText("ONE-LAYER ELEVATION", 4, 9);

    well.appendChild(canvas);

    const dimLabel = document.createElement("div");
    dimLabel.className = "house-card-dim-label";
    dimLabel.textContent = "12×10 terrain block";
    well.appendChild(dimLabel);

    const info = document.createElement("div");
    info.className = "house-card-info";

    const nameEl = document.createElement("div");
    nameEl.className = "house-card-name";
    nameEl.textContent = "Single-layer terrain";

    const idEl = document.createElement("div");
    idEl.className = "house-card-id";
    idEl.textContent = "one_layer_elevation";

    const descEl = document.createElement("div");
    descEl.className = "house-card-desc";
    descEl.textContent =
      "A single raised terrain edge using the grass, sand, shore, water, and cliff tiles directly from map.txt.";

    const legendEl = document.createElement("div");
    legendEl.className = "terrain-layer-legend";
    legendEl.innerHTML = `
      <span class="tl-item tl-surface">Ground</span>
      <span class="tl-item tl-subsoil">Water</span>
      <span class="tl-item tl-bedrock">Elevation</span>
    `;

    info.appendChild(nameEl);
    info.appendChild(idEl);
    info.appendChild(descEl);
    info.appendChild(legendEl);

    card.appendChild(well);
    card.appendChild(info);
    grid.appendChild(card);
  };

  img.src = TILESET_PATH;
}

// ═══════════════════════════════════════════════════════════════════
// PROCEDURAL SETTLEMENT MODULE
// ═══════════════════════════════════════════════════════════════════

const settlementCanvas = document.getElementById(
  "settlement-canvas",
) as HTMLCanvasElement;
const settlementViewport = document.getElementById(
  "settlement-viewport",
) as HTMLElement;

let currentSettlementData: SettlementData | null = null;
let currentSeed = 42891;
let currentZoomLevel = 1.5;
let optShowGrid = false;
let optShowClearance = false;
let optShowFootprints = false;
let isSettlementInitialized = false;

// Pan state
let isPanning = false;
let startPanX = 0;
let startPanY = 0;
let scrollStartX = 0;
let scrollStartY = 0;

// ═══════════════════════════════════════════════════════════════════
// SETTLEMENT SIMULATION & RENDERING LOOP
// ═══════════════════════════════════════════════════════════════════

let lifeformManager: LifeformManager | null = null;
const lifeformRenderer: LifeformRenderer = new LifeformRenderer();
let currentSettlementScene: PreparedSettlementScene | null = null;
let animFrameId: number | null = null;
let lastTime: number = 0;
let isSettlementTabActive: boolean = false;

export function startSettlementLoop() {
  isSettlementTabActive = true;
  if (!animFrameId) {
    lastTime = performance.now();
    animFrameId = requestAnimationFrame(settlementLoop);
  }
}

export function stopSettlementLoop() {
  isSettlementTabActive = false;
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}

function settlementLoop(now: number) {
  if (!isSettlementTabActive) {
    animFrameId = null;
    return;
  }

  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  // 1. High-frequency simulation update (60 FPS)
  if (lifeformManager) {
    lifeformManager.update(dt);
  }

  // 2. High-frequency visual render (60 FPS)
  if (currentSettlementScene && settlementCanvas && lifeformManager) {
    currentSettlementScene.renderFrame(
      settlementCanvas,
      {
        animals: lifeformManager.getAnimals(),
        npcs: lifeformManager.getNPCs(),
        player: lifeformManager.player,
        particles: lifeformManager.getParticles(),
      },
      lifeformRenderer,
      {
        cellSize: Math.round(16 * currentZoomLevel),
        showGrid: optShowGrid,
        showClearance: optShowClearance,
        showFootprints: optShowFootprints,
      },
    );

    // Update live counts
    const wildBadge = document.getElementById("stat-wildlife-count");
    const npcBadge = document.getElementById("stat-villagers-count");
    if (wildBadge) {
      wildBadge.textContent = String(
        lifeformManager.getAnimals().filter((a) => a.isActive).length,
      );
    }
    if (npcBadge) {
      npcBadge.textContent = String(
        lifeformManager.getNPCs().filter((n) => n.isActive).length,
      );
    }
  }

  animFrameId = requestAnimationFrame(settlementLoop);
}

function ensureSettlementLoaded() {
  if (!isSettlementInitialized) {
    initSettlementUI();
    isSettlementInitialized = true;
    const urlParams = new URLSearchParams(window.location.search);
    const paramSeed = urlParams.get("seed");
    if (paramSeed && !isNaN(parseInt(paramSeed, 10))) {
      currentSeed = parseInt(paramSeed, 10);
    }
    generateAndRenderSettlement(currentSeed);
  }
}

function updateSettlementBadges(data: SettlementData) {
  const seedBadge = document.getElementById("stat-seed-badge");
  const housesBadge = document.getElementById("stat-houses-badge");
  const farmsBadge = document.getElementById("stat-farms-badge");
  const wellsBadge = document.getElementById("stat-wells-badge");
  const treesBadge = document.getElementById("stat-trees-badge");
  const waterBadge = document.getElementById("stat-water-badge");
  const decorBadge = document.getElementById("stat-decor-badge");
  const validationText = document.getElementById("validation-text");
  const seedInput = document.getElementById(
    "settlement-seed-input",
  ) as HTMLInputElement;

  if (seedBadge) seedBadge.innerHTML = `Seed: <strong>${data.seed}</strong>`;
  if (housesBadge)
    housesBadge.innerHTML = `Houses: <strong>${data.houses.length}</strong>`;
  if (farmsBadge)
    farmsBadge.innerHTML = `Farms: <strong>${data.farms.length}</strong>`;
  if (wellsBadge)
    wellsBadge.innerHTML = `Wells: <strong>${data.wells.length}</strong>`;
  if (treesBadge)
    treesBadge.innerHTML = `Trees: <strong>${data.trees.length}</strong>`;
  if (waterBadge)
    waterBadge.innerHTML = `Water: <strong>${data.waterBodies.length > 0 ? `${data.waterBodies.length} Ponds` : "None"}</strong>`;
  if (decorBadge)
    decorBadge.innerHTML = `Scatter: <strong>${data.decorations.length}</strong> (${data.bushes?.length || 0} Bushes)`;
  if (seedInput) seedInput.value = String(data.seed);

  if (validationText) {
    if (data.validation.valid) {
      validationText.textContent =
        "✓ Validated: All 10 Rules Passed (0 Road Overlaps)";
    } else {
      validationText.textContent = `⚠ ${data.validation.violations.length} Violations`;
    }
  }
}

async function renderCurrentSettlement() {
  if (!currentSettlementData || !settlementCanvas) return;
  const cellSize = Math.round(16 * currentZoomLevel);
  currentSettlementScene = await prepareSettlementScene(currentSettlementData, {
    cellSize,
    showGrid: optShowGrid,
    showClearance: optShowClearance,
    showFootprints: optShowFootprints,
  });
}

async function generateAndRenderSettlement(seed?: number) {
  currentSeed = seed !== undefined ? seed : Math.floor(Math.random() * 1000000);
  currentSettlementData = generateSettlement(currentSeed, 48, 36);
  updateSettlementBadges(currentSettlementData);

  // Initialize lifeforms with the new world
  lifeformManager = new LifeformManager(currentSettlementData);

  await renderCurrentSettlement();
  startSettlementLoop();
}

async function updateZoomDisplay() {
  const label = document.getElementById("settlement-zoom-label");
  if (label) label.textContent = `${Math.round(currentZoomLevel * 100)}%`;
  await renderCurrentSettlement();
}

function initSettlementUI() {
  const btnGenerate = document.getElementById("btn-generate-settlement");
  const btnApplySeed = document.getElementById("btn-apply-seed");
  const btnRandomSeed = document.getElementById("btn-random-seed");
  const seedInput = document.getElementById(
    "settlement-seed-input",
  ) as HTMLInputElement;

  const btnZoomIn = document.getElementById("settlement-zoom-in");
  const btnZoomOut = document.getElementById("settlement-zoom-out");
  const btnZoomReset = document.getElementById("settlement-zoom-reset");

  const toggleGrid = document.getElementById("toggle-grid-btn");
  const toggleClearance = document.getElementById("toggle-clearance-btn");
  const toggleFootprints = document.getElementById("toggle-footprints-btn");

  if (btnGenerate) {
    btnGenerate.addEventListener("click", () => {
      generateAndRenderSettlement();
    });
  }

  if (btnApplySeed) {
    btnApplySeed.addEventListener("click", () => {
      const val = parseInt(seedInput.value, 10);
      if (!isNaN(val)) {
        generateAndRenderSettlement(val);
      }
    });
  }

  if (seedInput) {
    seedInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const val = parseInt(seedInput.value, 10);
        if (!isNaN(val)) generateAndRenderSettlement(val);
      }
    });
  }

  if (btnRandomSeed) {
    btnRandomSeed.addEventListener("click", () => {
      generateAndRenderSettlement();
    });
  }

  if (btnZoomIn) {
    btnZoomIn.addEventListener("click", () => {
      currentZoomLevel = Math.min(3.0, currentZoomLevel + 0.25);
      updateZoomDisplay();
    });
  }

  if (btnZoomOut) {
    btnZoomOut.addEventListener("click", () => {
      currentZoomLevel = Math.max(0.75, currentZoomLevel - 0.25);
      updateZoomDisplay();
    });
  }

  if (btnZoomReset) {
    btnZoomReset.addEventListener("click", () => {
      currentZoomLevel = 1.5;
      updateZoomDisplay();
      if (settlementViewport) {
        settlementViewport.scrollLeft =
          (settlementViewport.scrollWidth - settlementViewport.clientWidth) / 2;
        settlementViewport.scrollTop =
          (settlementViewport.scrollHeight - settlementViewport.clientHeight) /
          2;
      }
    });
  }

  if (toggleGrid) {
    toggleGrid.addEventListener("click", () => {
      optShowGrid = !optShowGrid;
      toggleGrid.classList.toggle("active", optShowGrid);
    });
  }

  if (toggleClearance) {
    toggleClearance.addEventListener("click", () => {
      optShowClearance = !optShowClearance;
      toggleClearance.classList.toggle("active", optShowClearance);
    });
  }

  if (toggleFootprints) {
    toggleFootprints.addEventListener("click", () => {
      optShowFootprints = !optShowFootprints;
      toggleFootprints.classList.toggle("active", optShowFootprints);
    });
  }

  // ── KEYBOARD CONTROLS (WASD/Arrows for Movement, [E] Pet, [F] Feed) ──
  const activeKeys = new Set<string>();

  window.addEventListener("keydown", (e) => {
    if (!isSettlementTabActive) return;
    if (e.target instanceof HTMLInputElement) return;

    const key = e.key.toLowerCase();
    activeKeys.add(key);

    if (key === " " || e.code === "Space") {
      lifeformManager?.player?.jump();
    } else if (key === "e") {
      lifeformManager?.petClosestAnimal();
    } else if (key === "f") {
      lifeformManager?.feedClosestAnimal();
    }

    if (
      [
        "arrowup",
        "arrowdown",
        "arrowleft",
        "arrowright",
        " ",
        "w",
        "a",
        "s",
        "d",
      ].includes(key) ||
      e.code === "Space"
    ) {
      e.preventDefault();
    }

    updatePlayerMovementInput();
  });

  window.addEventListener("keyup", (e) => {
    if (!isSettlementTabActive) return;
    if (e.target instanceof HTMLInputElement) return;

    const key = e.key.toLowerCase();
    activeKeys.delete(key);
    updatePlayerMovementInput();
  });

  function updatePlayerMovementInput() {
    if (!lifeformManager || !lifeformManager.player) return;

    let dx = 0;
    let dy = 0;
    if (activeKeys.has("w") || activeKeys.has("arrowup")) dy -= 1;
    if (activeKeys.has("s") || activeKeys.has("arrowdown")) dy += 1;
    if (activeKeys.has("a") || activeKeys.has("arrowleft")) dx -= 1;
    if (activeKeys.has("d") || activeKeys.has("arrowright")) dx += 1;

    lifeformManager.player.moveInputX = dx;
    lifeformManager.player.moveInputY = dy;
  }

  // ── MOUSE PAN, CLICK TO MOVE & PET ──────────────────────────
  if (settlementViewport) {
    settlementViewport.addEventListener("mousedown", (e) => {
      isPanning = true;
      startPanX = e.clientX;
      startPanY = e.clientY;
      scrollStartX = settlementViewport.scrollLeft;
      scrollStartY = settlementViewport.scrollTop;
    });

    window.addEventListener("mousemove", (e) => {
      if (!isPanning) return;
      const dx = e.clientX - startPanX;
      const dy = e.clientY - startPanY;
      settlementViewport.scrollLeft = scrollStartX - dx;
      settlementViewport.scrollTop = scrollStartY - dy;
    });

    window.addEventListener("mouseup", (e) => {
      if (!isPanning) return;
      isPanning = false;

      // Detect click if mouse didn't drag
      const dragDist = Math.hypot(e.clientX - startPanX, e.clientY - startPanY);
      if (dragDist < 5 && settlementCanvas && lifeformManager) {
        const rect = settlementCanvas.getBoundingClientRect();
        const cellSize = Math.round(16 * currentZoomLevel);
        const clickX = (e.clientX - rect.left) / cellSize;
        const clickY = (e.clientY - rect.top) / cellSize;

        const clicked = lifeformManager.findEntityAt(clickX, clickY, 1.4);
        if (clicked && clicked.type === "ANIMAL") {
          const animal = clicked as Animal;
          if (
            lifeformManager.player &&
            Math.hypot(
              lifeformManager.player.position.x - animal.position.x,
              lifeformManager.player.position.y - animal.position.y,
            ) <= 2.2
          ) {
            if (animal.pet()) {
              lifeformManager.player.triggerHop();
            }
          } else if (lifeformManager.player) {
            lifeformManager.player.setTarget(
              animal.position.x,
              animal.position.y,
            );
          }
        } else if (lifeformManager.player) {
          lifeformManager.player.setTarget(clickX, clickY);
        }
      }
    });

    settlementViewport.addEventListener(
      "wheel",
      (e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (e.deltaY < 0) {
            currentZoomLevel = Math.min(3.0, currentZoomLevel + 0.15);
          } else {
            currentZoomLevel = Math.max(0.75, currentZoomLevel - 0.15);
          }
          updateZoomDisplay();
        }
      },
      { passive: false },
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// FULL-SCREEN SURVIVAL GAME CONTROLLER & HUD
// ═══════════════════════════════════════════════════════════════════

const survivalCanvas = document.getElementById(
  "survival-game-canvas",
) as HTMLCanvasElement;
const radarCanvas = document.getElementById(
  "radar-canvas",
) as HTMLCanvasElement;

let survivalEngine: SurvivalEngine | null = null;
let survivalRenderer: SurvivalRenderer | null = null;
let survivalAnimFrameId: number | null = null;
let lastSurvivalTime = 0;
let isSurvivalTabActive = false;
let isSurvivalInitialized = false;

// HUD Elements
const hudHpVal = document.getElementById("hud-hp-val")!;
const hudHpImg = document.getElementById("hud-hp-img") as HTMLImageElement | null;
const hudHungerVal = document.getElementById("hud-hunger-val")!;
const hudHungerImg = document.getElementById("hud-hunger-img") as HTMLImageElement | null;
const hudStaminaVal = document.getElementById("hud-stamina-val")!;
const hudStaminaImg = document.getElementById("hud-stamina-img") as HTMLImageElement | null;
const hudClockIcon = document.getElementById("hud-clock-icon")!;
const hudClockTime = document.getElementById("hud-clock-time")!;
const hudClockPhase = document.getElementById("hud-clock-phase")!;
const hudVillagesCount = document.getElementById("hud-villages-count")!;
const hudNearestVillage = document.getElementById("hud-nearest-village")!;
const hotbarSlotsContainer = document.getElementById("hotbar-slots-container")!;
const gameActionPrompt = document.getElementById("game-action-prompt")!;
const questListItems = document.getElementById("quest-list-items")!;
const radarVillageList = document.getElementById("radar-village-list")!;

// Modals
const modalInventory = document.getElementById("modal-inventory")!;
const modalDialogue = document.getElementById("modal-dialogue")!;
const modalChest = document.getElementById("modal-chest")!;
const modalPause = document.getElementById("modal-pause")!;
const modalGameOver = document.getElementById("modal-gameover")!;

// Modal Controls
const btnCloseInventory = document.getElementById("btn-close-inventory")!;
const btnCloseDialogue = document.getElementById("btn-close-dialogue")!;
const btnCloseChest = document.getElementById("btn-close-chest")!;
const btnClosePause = document.getElementById("btn-close-pause")!;
const btnResumeGame = document.getElementById("btn-resume-game")!;
const btnSaveGame = document.getElementById("btn-save-game")!;
const btnLoadGame = document.getElementById("btn-load-game")!;
const btnResetGame = document.getElementById("btn-reset-game")!;
const btnRespawn = document.getElementById("btn-respawn")!;

const btnToggleFullscreen = document.getElementById("btn-toggle-fullscreen")!;
const btnToggleAudio = document.getElementById("btn-toggle-audio")!;
const btnOpenInventory = document.getElementById("btn-open-inventory")!;
const btnOpenPause = document.getElementById("btn-open-pause")!;

const modalInventoryGrid = document.getElementById("modal-inventory-grid")!;
const modalHotbarGrid = document.getElementById("modal-hotbar-grid")!;
const craftRecipesList = document.getElementById("craft-recipes-list")!;
const dialogueNpcName = document.getElementById("dialogue-npc-name")!;
const dialogueNpcText = document.getElementById("dialogue-npc-text")!;
const barterTradeList = document.getElementById("barter-trade-list")!;
const modalChestGrid = document.getElementById("modal-chest-grid")!;
const modalChestPlayerGrid = document.getElementById(
  "modal-chest-player-grid",
)!;

let activeCraftCategory = "tools";
let networkClient: NetworkClient | null = null;

const hudServerStatus = document.getElementById("hud-server-status");
const hudServerDot = document.getElementById("hud-server-dot");
const hudPlayerCount = document.getElementById("hud-player-count");

function setupNetworkClientHandlers() {
  if (!networkClient) return;

  networkClient.onStateChange((state) => {
    if (hudServerDot && hudServerStatus) {
      if (state === "CONNECTED") {
        hudServerDot.style.background = "#22c55e";
        hudServerDot.style.boxShadow = "0 0 8px #22c55e";
        const displayHost = networkClient?.serverUrl
          ? networkClient.serverUrl.replace(/^https?:\/\//, "")
          : "Online";
        hudServerStatus.textContent = `Authoritative Server: Multiplayer (${displayHost} • 20Hz)`;
        hudServerStatus.style.color = "#4ade80";
      } else if (state === "LOCAL_SERVER") {
        hudServerDot.style.background = "#38bdf8";
        hudServerDot.style.boxShadow = "0 0 8px #38bdf8";
        hudServerStatus.textContent = "Authoritative Server: Single Player (Local • 20Hz)";
        hudServerStatus.style.color = "#38bdf8";
      } else if (state === "CONNECTING") {
        hudServerDot.style.background = "#eab308";
        hudServerDot.style.boxShadow = "0 0 6px #eab308";
        hudServerStatus.textContent = "Authoritative Server: Connecting...";
        hudServerStatus.style.color = "#facc15";
      } else {
        hudServerDot.style.background = "#f97316";
        hudServerDot.style.boxShadow = "0 0 6px #f97316";
        hudServerStatus.textContent = "Authoritative Server: Offline";
        hudServerStatus.style.color = "#fb923c";
      }
    }
  });

  networkClient.onInit((init) => {
    if (!survivalEngine) return;

    // CRITICAL FIX: Rebuild client WorldManager with the server's authoritative seed
    // so that client-side collision checks (canMoveTo) match the actual rendered world.
    // Without this, the client checks collisions against a world generated with a
    // different seed, causing the player to walk through houses, fences, trees, etc.
    if (init.seed !== undefined && init.seed !== (survivalEngine as any)._lastSyncedSeed) {
      survivalEngine.worldManager = new WorldManager(init.seed);
      (survivalEngine as any)._lastSyncedSeed = init.seed;
      console.log(`[Collision] Rebuilt client WorldManager with server seed: ${init.seed}`);
    }

    if (init.player) {
      survivalEngine.player.x = init.player.x;
      survivalEngine.player.y = init.player.y;
      survivalEngine.worldManager.updatePlayerLocation(init.player.x, init.player.y);
    }
    if (init.placedStructures) {
      survivalEngine.placedStructures = (init.placedStructures as any[]).map((s) => ({
        ...s,
        type: s.type || s.structureType,
      }));
      for (const s of survivalEngine.placedStructures) {
        if (s.type === "wood_wall") {
          const tile = survivalEngine.worldManager.getTile(s.x, s.y);
          tile.isBlocked = true;
        } else if (s.type === "wood_door") {
          const tile = survivalEngine.worldManager.getTile(s.x, s.y);
          tile.isBlocked = !s.isOpen;
        }
      }
    }
    if (init.droppedItems) {
      survivalEngine.droppedItems = init.droppedItems as any;
    }
    if (init.depletedResourceIds) {
      for (const rid of init.depletedResourceIds) {
        survivalEngine.worldManager.markResourceDepleted(rid);
      }
    }
    if (init.worldTime) {
      survivalEngine.worldTime = init.worldTime;
    }
  });

  networkClient.onSync((sync) => {
    if (!survivalEngine) return;

    if (hudPlayerCount) {
      const total = 1 + (sync.otherPlayers?.length || 0);
      hudPlayerCount.textContent = ` ${total} Online`;
    }

    // Synchronize local player authoritative stats
    if (sync.player) {
      survivalEngine.player.health = sync.player.health;
      survivalEngine.player.maxHealth = sync.player.maxHealth;
      survivalEngine.player.hunger = sync.player.hunger;
      survivalEngine.player.maxHunger = sync.player.maxHunger;
      survivalEngine.player.stamina = sync.player.stamina;
      survivalEngine.player.maxStamina = sync.player.maxStamina;
      survivalEngine.player.isDead = sync.player.isDead;
      survivalEngine.player.isSwimming = sync.player.isSwimming;
      survivalEngine.player.direction = sync.player.direction;
      survivalEngine.player.facing = sync.player.facing;
      survivalEngine.inventory = sync.player.inventory;
      survivalEngine.hotbar = sync.player.hotbar;
    }

    if (sync.worldTime) {
      survivalEngine.worldTime = sync.worldTime;
    }
    if (sync.placedStructures) {
      survivalEngine.placedStructures = (sync.placedStructures as any[]).map((s) => ({
        ...s,
        type: s.type || s.structureType,
      }));
      for (const s of survivalEngine.placedStructures) {
        if (s.type === "wood_wall") {
          const tile = survivalEngine.worldManager.getTile(s.x, s.y);
          tile.isBlocked = true;
        } else if (s.type === "wood_door") {
          const tile = survivalEngine.worldManager.getTile(s.x, s.y);
          tile.isBlocked = !s.isOpen;
        }
      }
    }
    if (sync.depletedResourceIds) {
      for (const rid of sync.depletedResourceIds) {
        survivalEngine.worldManager.markResourceDepleted(rid);
      }
    }

    // Synchronize remote players with interpolated positions
    if (sync.otherPlayers) {
      survivalEngine.remotePlayers = sync.otherPlayers.map((op) => {
        const res = networkClient!.interpolator.getInterpolatedEntity(
          op.id,
          op.x,
          op.y,
        );
        return {
          ...op,
          x: res.x,
          y: res.y,
          vx: res.vx,
          vy: res.vy,
        };
      });
    }

    // Synchronize wildlife animals from authoritative server
    if (sync.animals) {
      const activeIds = new Set(sync.animals.map((a) => a.id));
      survivalEngine.animals = survivalEngine.animals.filter((a: any) =>
        activeIds.has(a.id),
      );
      for (const sa of sync.animals) {
        let existing = survivalEngine.animals.find((a: any) => a.id === sa.id);
        if (!existing) {
          const cfg =
            (SPECIES_CONFIGS as any)[sa.species] || SPECIES_CONFIGS["cow"];
          existing = new Animal(sa.id, cfg, sa.x, sa.y);
          survivalEngine.animals.push(existing);
        }
        existing.health = sa.health;
        existing.direction = sa.direction;
        existing.behaviorState = sa.behaviorState as any;
      }
    }

    // Synchronize village NPCs from authoritative server
    if (sync.npcs) {
      const activeIds = new Set(sync.npcs.map((n) => n.id));
      survivalEngine.npcs = survivalEngine.npcs.filter((n: any) =>
        activeIds.has(n.id),
      );
      for (const sn of sync.npcs) {
        let existing = survivalEngine.npcs.find((n: any) => n.id === sn.id);
        if (!existing) {
          const cfg =
            (SPECIES_CONFIGS as any)["villager"] || SPECIES_CONFIGS["cow"];
          existing = new NPC(
            sn.id,
            cfg,
            sn.x,
            sn.y,
            sn.x,
            sn.y,
            sn.role as any,
          );
          survivalEngine.npcs.push(existing);
        }
        existing.direction = sn.direction;
        existing.behaviorState = sn.behaviorState as any;
      }
    }

    // Synchronize hostile enemies from authoritative server
    if (sync.enemies) {
      const activeIds = new Set(sync.enemies.map((e) => e.id));
      survivalEngine.enemies = survivalEngine.enemies.filter((e: any) =>
        activeIds.has(e.id),
      );
      for (const se of sync.enemies) {
        let existing = survivalEngine.enemies.find((e: any) => e.id === se.id);
        if (!existing) {
          existing = {
            id: se.id,
            type: se.enemyType,
            name: se.name,
            x: se.x,
            y: se.y,
            vx: se.vx,
            vy: se.vy,
            direction: se.direction,
            health: se.health,
            maxHealth: se.maxHealth,
            damage: se.damage,
            speed: se.speed,
            state: se.state,
            attackCooldown: se.attackCooldown,
            patrolTimer: se.patrolTimer,
            hurtTimer: se.hurtTimer,
            deathTimer: se.deathTimer,
            isAlive: se.isAlive,
          };
          survivalEngine.enemies.push(existing);
        } else {
          existing.health = se.health;
          existing.isAlive = se.isAlive;
          existing.direction = se.direction;
          existing.state = se.state;
        }
      }
    }

    // Synchronize dropped items
    if (sync.droppedItems) {
      survivalEngine.droppedItems = sync.droppedItems as any;
    }
  });

  networkClient.onEvent((ev) => {
    if (!survivalEngine) return;

    if (ev.type === "TREE_HIT") {
      GameAudio.playChop();
      (survivalEngine as any).emitWoodChips(
        ev.payload.x,
        ev.payload.y,
        "#a16207",
      );
    } else if (ev.type === "ROCK_HIT") {
      GameAudio.playMine();
      (survivalEngine as any).emitWoodChips(
        ev.payload.x,
        ev.payload.y,
        "#94a3b8",
      );
    } else if (ev.type === "TREE_DESTROYED" || ev.type === "ROCK_DESTROYED") {
      const rid = (ev.payload as any)?.resourceId;
      if (rid !== undefined) {
        survivalEngine.worldManager.markResourceDepleted(rid);
      }
      if (ev.type === "TREE_DESTROYED") {
        GameAudio.playChop();
        (survivalEngine as any).emitWoodChips(ev.payload.x, ev.payload.y, "#a16207");
      } else {
        GameAudio.playMine();
        (survivalEngine as any).emitWoodChips(ev.payload.x, ev.payload.y, "#94a3b8");
      }
    } else if (ev.type === "ANIMAL_PETTED" || ev.type === "ANIMAL_FED") {
      GameAudio.playHeartChime();
      (survivalEngine as any).emitHeart(ev.payload.x, ev.payload.y);
    } else if (ev.type === "PLAYER_DAMAGED") {
      GameAudio.playHurt();
    } else if (ev.type === "ITEM_PICKED_UP") {
      GameAudio.playPickup();
    } else if (ev.type === "ITEM_CRAFTED") {
      GameAudio.playCraft();
    } else if (ev.type === "BUILDING_PLACED") {
      GameAudio.playBuild();
    } else if (ev.type === "FLOATING_TEXT") {
      survivalEngine.addFloatingText(
        ev.payload.text,
        ev.payload.x,
        ev.payload.y,
        ev.payload.color,
      );
    } else if (ev.type === "AUDIO_TRIGGER") {
      const s = ev.payload.sound;
      if (s === "chop") GameAudio.playChop();
      else if (s === "mine") GameAudio.playMine();
      else if (s === "hurt") GameAudio.playHurt();
      else if (s === "jump") GameAudio.playJump();
      else if (s === "craft") GameAudio.playCraft();
      else if (s === "build") GameAudio.playBuild();
      else if (s === "pickup") GameAudio.playPickup();
      else if (s === "eat") GameAudio.playEat();
      else if (s === "heart") GameAudio.playHeartChime();
    }
  });

  // ── Multiplayer invite events ──────────────────────────────────────────────
  networkClient.onInviteReceived((invite) => {
    showInviteModal(invite.inviteId, invite.fromName);
  });

  networkClient.onInviteResponse((resp) => {
    const toast = document.getElementById("mp-toast");
    if (toast) {
      toast.textContent = resp.accepted
        ? `✅ ${resp.byName} joined your world!`
        : `❌ ${resp.byName} declined your invite.`;
      toast.classList.remove("hidden");
      setTimeout(() => toast.classList.add("hidden"), 4000);
    }
  });

  networkClient.onServerError((err) => {
    const toast = document.getElementById("mp-toast");
    if (toast) {
      toast.textContent = `⚠️ ${err.message}`;
      toast.classList.remove("hidden");
      setTimeout(() => toast.classList.add("hidden"), 5000);
    }
  });

  // Show invite code in UI when we become a room host
  networkClient.onInit((init) => {
    if (init.inviteCode) {
      const codeEl = document.getElementById("mp-invite-code-display");
      if (codeEl) {
        codeEl.textContent = init.inviteCode;
        const banner = document.getElementById("mp-host-banner");
        if (banner) banner.classList.remove("hidden");
      }
    }
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// Multiplayer UI — Host / Join / Invite (spec items 20-23)
// ─────────────────────────────────────────────────────────────────────────────

/** Shows a popup when someone invites you to their world */
function showInviteModal(inviteId: string, fromName: string): void {
  let modal = document.getElementById("mp-invite-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "mp-invite-modal";
    modal.style.cssText = `
      position:fixed; bottom:24px; right:24px; z-index:9999;
      border: 14px solid transparent;
      border-image: url('/assets/DEMO_MegaCozyUIPack_doboui - copia/BoxesContainers/WoodenContainers/WoodenContainer2.png') 16 fill / 16px stretch;
      image-rendering: pixelated;
      padding:16px 20px; min-width:280px;
      box-shadow:0 8px 32px rgba(0,0,0,0.6);
      color:#fef08a;
      animation: slideInRight 0.3s ease;
    `;
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div style="font-size:12px;color:#cbd5e1;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
      <img src="/assets/ui/playercount.png" style="width:14px;height:14px;image-rendering:pixelated;" alt="Players" />
      Multiplayer Invite
    </div>
    <div style="font-size:14px;font-weight:600;margin-bottom:14px;color:#fff;">
      <span style="color:#fef08a">${fromName}</span> invited you to join their world!
    </div>
    <div style="display:flex;gap:10px;">
      <button id="mp-accept-btn" style="
        flex:1;padding:6px 12px;border:8px solid transparent;
        border-image: url('/assets/DEMO_MegaCozyUIPack_doboui - copia/Buttons/SquareButtons/SquareButton1_wood.png') 10 fill / 10px stretch;
        image-rendering:pixelated;cursor:pointer;
        color:#86efac;font-weight:700;font-size:12px;
        display:flex;align-items:center;justify-content:center;gap:6px;
      "><img src="/assets/ui/confirm.png" style="width:14px;height:14px;image-rendering:pixelated;" alt="Accept" /> Accept</button>
      <button id="mp-decline-btn" style="
        flex:1;padding:6px 12px;border:8px solid transparent;
        border-image: url('/assets/DEMO_MegaCozyUIPack_doboui - copia/Buttons/SquareButtons/SquareButton1_wood.png') 10 fill / 10px stretch;
        image-rendering:pixelated;cursor:pointer;
        color:#fca5a5;font-weight:700;font-size:12px;
        display:flex;align-items:center;justify-content:center;gap:6px;
      "><img src="/assets/ui/cancel.png" style="width:14px;height:14px;image-rendering:pixelated;" alt="Decline" /> Decline</button>
    </div>
  `;
  modal.classList.remove("hidden");

  document.getElementById("mp-accept-btn")?.addEventListener("click", () => {
    networkClient?.acceptInvite(inviteId);
    modal!.remove();
  });
  document.getElementById("mp-decline-btn")?.addEventListener("click", () => {
    networkClient?.declineInvite(inviteId);
    modal!.remove();
  });

  // Auto-dismiss after 30s
  setTimeout(() => modal?.remove(), 30000);
}

/** Injects multiplayer Host/Join panel into the survival HUD */
function initMultiplayerUI(): void {
  // Inject CSS for mp-panel animations if not already present
  if (!document.getElementById("mp-ui-styles")) {
    const style = document.createElement("style");
    style.id = "mp-ui-styles";
    style.textContent = `
      @keyframes slideInRight { from { transform:translateX(120%); opacity:0; } to { transform:translateX(0); opacity:1; } }
      #mp-toast {
        position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
        border: 12px solid transparent;
        border-image: url('/assets/DEMO_MegaCozyUIPack_doboui - copia/BoxesContainers/WoodenContainers/WoodenContainer1.png') 16 fill / 16px stretch;
        image-rendering: pixelated;
        color:#fef08a; padding:6px 16px; font-size:13px; font-weight:700;
        box-shadow:0 6px 20px rgba(0,0,0,0.6); z-index:10000;
        transition:opacity 0.3s;
      }
      #mp-toast.hidden { display:none; }
      #mp-panel {
        position:fixed; top:70px; right:16px; z-index:5000;
        border: 14px solid transparent;
        border-image: url('/assets/DEMO_MegaCozyUIPack_doboui - copia/BoxesContainers/WoodenContainers/WoodenContainer2.png') 16 fill / 16px stretch;
        image-rendering: pixelated;
        padding:8px 12px; min-width:250px;
        box-shadow:0 8px 32px rgba(0,0,0,0.6);
        color:#fef08a;
        display:none;
      }
      #mp-panel.open { display:block; animation:slideInRight 0.25s ease; }
      #mp-host-banner {
        border: 10px solid transparent;
        border-image: url('/assets/DEMO_MegaCozyUIPack_doboui - copia/BoxesContainers/WoodenContainers/WoodenContainer4.png') 12 fill / 12px stretch;
        image-rendering: pixelated;
        padding:6px 10px; margin-top:10px;
      }
      #mp-host-banner.hidden { display:none; }
      .mp-btn {
        width:100%; padding:6px 10px; border: 8px solid transparent;
        border-image: url('/assets/DEMO_MegaCozyUIPack_doboui - copia/Buttons/SquareButtons/SquareButton1_wood.png') 10 fill / 10px stretch;
        image-rendering: pixelated;
        cursor:pointer; font-weight:700; font-size:12px; color:#fef08a;
        margin-top:8px; transition:transform 0.1s;
        display:flex; align-items:center; justify-content:center; gap:6px;
      }
      .mp-btn:hover { transform:scale(1.02); }
      .mp-input {
        width:100%; padding:6px 8px; border:1.5px solid #78350f; background:#1e1b18;
        color:#fef08a; font-size:13px; box-sizing:border-box; margin-top:6px;
      }
      .mp-input:focus { outline:none; border-color:#eab308; }
      .mp-label { font-size:11px; color:#cbd5e1; text-transform:uppercase; letter-spacing:0.5px; margin-top:10px; display:block; }
      #mp-toggle-btn {
        position:fixed; top:14px; right:80px; z-index:5001;
        border: 8px solid transparent;
        border-image: url('/assets/DEMO_MegaCozyUIPack_doboui - copia/Buttons/SquareButtons/SquareButton1_wood.png') 10 fill / 10px stretch;
        image-rendering: pixelated;
        color:#fef08a;
        padding:4px 10px; font-size:12px; font-weight:700;
        cursor:pointer;
        box-shadow:0 4px 12px rgba(0,0,0,0.5);
        transition:transform 0.1s;
        display:flex; align-items:center; gap:6px;
      }
      #mp-toggle-btn:hover { transform:scale(1.04); }
    `;
    document.head.appendChild(style);
  }

  // Toast notification element
  if (!document.getElementById("mp-toast")) {
    const toast = document.createElement("div");
    toast.id = "mp-toast";
    toast.className = "hidden";
    document.body.appendChild(toast);
  }

  // Multiplayer toggle button
  if (!document.getElementById("mp-toggle-btn")) {
    const btn = document.createElement("button");
    btn.id = "mp-toggle-btn";
    btn.innerHTML = `<img src="/assets/ui/playercount.png" style="width:14px;height:14px;image-rendering:pixelated;" alt="" /> Multiplayer`;
    btn.addEventListener("click", () => {
      const panel = document.getElementById("mp-panel");
      if (panel) panel.classList.toggle("open");
    });
    document.body.appendChild(btn);
  }

  // Multiplayer panel
  if (!document.getElementById("mp-panel")) {
    const panel = document.createElement("div");
    panel.id = "mp-panel";
    panel.innerHTML = `
      <div style="font-size:14px;font-weight:700;margin-bottom:4px;display:flex;align-items:center;gap:6px;">
        <img src="/assets/ui/playercount.png" style="width:16px;height:16px;image-rendering:pixelated;" alt="" /> Multiplayer
      </div>
      <div style="font-size:11px;color:#cbd5e1;margin-bottom:6px;">Play with friends in a shared world.</div>

      <button id="mp-host-btn" class="mp-btn mp-btn-host">
        <img src="/assets/ui/plan alt.png" style="width:14px;height:14px;image-rendering:pixelated;" alt="" /> Host World
      </button>

      <span class="mp-label">Join via Invite Code</span>
      <input id="mp-join-code-input" class="mp-input" type="text" placeholder="SUNNY-4821" maxlength="10" style="text-transform:uppercase;" />
      <button id="mp-join-btn" class="mp-btn mp-btn-join">
        <img src="/assets/ui/confirm.png" style="width:14px;height:14px;image-rendering:pixelated;" alt="" /> Join World
      </button>

      <div id="mp-host-banner" class="hidden">
        <div style="font-size:11px;color:#fef08a;margin-bottom:4px;display:flex;align-items:center;gap:4px;">
          <img src="/assets/ui/indicator.png" style="width:12px;height:12px;image-rendering:pixelated;" alt="" /> Your Invite Code
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span id="mp-invite-code-display" style="
            font-size:18px;font-weight:800;letter-spacing:2px;color:#fef08a;
            font-family:'Courier New',monospace;
          ">——</span>
          <button id="mp-copy-code-btn" style="
            background:#26201b;border:1px solid #78350f;border-radius:4px;
            color:#fef08a;font-size:11px;padding:3px 8px;cursor:pointer;
          ">Copy</button>
        </div>
        <div style="font-size:11px;color:#94a3b8;margin-top:4px;">Share this code with a friend to invite them.</div>
      </div>
    `;
    document.body.appendChild(panel);

    // Host button
    document.getElementById("mp-host-btn")?.addEventListener("click", () => {
      if (!networkClient) return;
      const name = (survivalEngine?.player as any)?.name || "Explorer";
      const hairstyle = (survivalEngine?.player as any)?.hairstyle || "style_01";
      networkClient.hostWorld(name, hairstyle);
      const toast = document.getElementById("mp-toast");
      if (toast) {
        toast.textContent = "Hosting world... waiting for invite code...";
        toast.classList.remove("hidden");
        setTimeout(() => toast.classList.add("hidden"), 3000);
      }
    });

    // Join button
    document.getElementById("mp-join-btn")?.addEventListener("click", () => {
      if (!networkClient) return;
      const input = document.getElementById("mp-join-code-input") as HTMLInputElement;
      const code = (input?.value || "").trim().toUpperCase();
      if (!code || code.length < 6) {
        const toast = document.getElementById("mp-toast");
        if (toast) {
          toast.textContent = "Please enter a valid invite code (e.g. SUNNY-4821)";
          toast.classList.remove("hidden");
          setTimeout(() => toast.classList.add("hidden"), 3000);
        }
        return;
      }
      const name = (survivalEngine?.player as any)?.name || "Explorer";
      const hairstyle = (survivalEngine?.player as any)?.hairstyle || "style_01";
      networkClient.joinWorld(code, name, hairstyle);
      const toast = document.getElementById("mp-toast");
      if (toast) {
        toast.textContent = `Joining world ${code}...`;
        toast.classList.remove("hidden");
        setTimeout(() => toast.classList.add("hidden"), 3000);
      }
    });

    // Copy invite code button
    document.getElementById("mp-copy-code-btn")?.addEventListener("click", () => {
      const codeEl = document.getElementById("mp-invite-code-display");
      const code = codeEl?.textContent?.trim();
      if (code && code !== "——") {
        navigator.clipboard.writeText(code).then(() => {
          const btn = document.getElementById("mp-copy-code-btn");
          if (btn) {
            btn.textContent = "Copied!";
            setTimeout(() => { btn.textContent = "Copy"; }, 2000);
          }
        }).catch(() => {});
      }
    });
  }
}

function ensureSurvivalGameLoaded() {
  if (!isSurvivalInitialized) {
    survivalEngine = new SurvivalEngine(currentSeed);
    (window as any).survivalEngine = survivalEngine;
    (window as any).gameEngine = survivalEngine;
    survivalRenderer = new SurvivalRenderer();
    initSurvivalInputs();
    initSurvivalUI();
    resizeSurvivalCanvas();

    // Initialize Network Client for authoritative server (auto-detects Render or localhost)
    networkClient = new NetworkClient();
    (window as any).networkClient = networkClient;
    networkClient.collisionChecker = (x, y) =>
      (survivalEngine as any).canMoveTo(x, y);
    setupNetworkClientHandlers();
    networkClient.connect("Explorer", "mophair");

    isSurvivalInitialized = true;
  }
}

export function startSurvivalGameLoop() {
  isSurvivalTabActive = true;
  resizeSurvivalCanvas();
  if (!survivalAnimFrameId) {
    lastSurvivalTime = performance.now();
    survivalAnimFrameId = requestAnimationFrame(survivalGameLoop);
  }
}

export function stopSurvivalGameLoop() {
  isSurvivalTabActive = false;
  if (survivalAnimFrameId) {
    cancelAnimationFrame(survivalAnimFrameId);
    survivalAnimFrameId = null;
  }
}

function resizeSurvivalCanvas() {
  if (survivalCanvas && viewGame) {
    const rect = viewGame.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      survivalCanvas.width = rect.width;
      survivalCanvas.height = rect.height;
    }
  }
}

window.addEventListener("resize", () => {
  if (isSurvivalTabActive) {
    resizeSurvivalCanvas();
  }
});

function survivalGameLoop(now: number) {
  if (!isSurvivalTabActive) {
    survivalAnimFrameId = null;
    return;
  }

  const dt = Math.min(0.08, (now - lastSurvivalTime) / 1000);
  lastSurvivalTime = now;

  if (survivalEngine && survivalRenderer && survivalCanvas) {
    const isAuthoritative =
      networkClient &&
      (networkClient.connectionState === "CONNECTED" ||
        networkClient.connectionState === "LOCAL_SERVER");

    if (isAuthoritative) {
      // 1. Authoritative Continuous Movement with Local Prediction (Phase 1 & 3)
      updatePlayerContinuousMovement(dt);

      // 2. Client updates local cosmetic timers, particles, and smooth prediction
      (survivalEngine as any).updateParticles(dt);
      if (survivalEngine.player.swingTimer > 0)
        survivalEngine.player.swingTimer -= dt;
      if (survivalEngine.player.hopTimer > 0) {
        survivalEngine.player.hopTimer -= dt;
        const progress = Math.max(
          0,
          Math.min(1, 1 - survivalEngine.player.hopTimer / 0.55),
        );
        survivalEngine.player.hopOffset = Math.sin(progress * Math.PI) * 0.55;
      } else {
        survivalEngine.player.hopOffset = 0;
      }
      if (survivalEngine.player.hurtTimer > 0)
        survivalEngine.player.hurtTimer -= dt;
      if (survivalEngine.player.rollTimer > 0)
        survivalEngine.player.rollTimer -= dt;
      if (survivalEngine.player.doingTimer > 0)
        survivalEngine.player.doingTimer -= dt;

      // 3. Smooth Entity Interpolation at 60 FPS (Phase 6 of authoritative_server.txt)
      if (networkClient) {
        // Wildlife animals
        for (const a of survivalEngine.animals) {
          const res = networkClient.interpolator.getInterpolatedEntity(
            a.id,
            a.position.x,
            a.position.y,
          );
          a.position.x = res.x;
          a.position.y = res.y;
          if (res.isMoving) {
            if (Math.abs(res.vx) > Math.abs(res.vy)) {
              a.direction = res.vx > 0 ? "RIGHT" : "LEFT";
              a.anim.flipX = res.vx > 0;
            } else {
              a.direction = res.vy > 0 ? "DOWN" : "UP";
            }
            a.anim.frameTimer += dt;
            if (a.anim.frameTimer >= (a.anim.frameSpeed || 0.12)) {
              a.anim.frameTimer = 0;
              a.anim.currentFrame =
                (a.anim.currentFrame + 1) % (a.anim.totalFrames || 4);
            }
          } else {
            a.anim.currentFrame = 0;
            a.anim.frameTimer = 0;
          }
        }
        // Village NPCs
        for (const n of survivalEngine.npcs) {
          const res = networkClient.interpolator.getInterpolatedEntity(
            n.id,
            n.position.x,
            n.position.y,
          );
          n.position.x = res.x;
          n.position.y = res.y;
          if (res.isMoving) {
            if (Math.abs(res.vx) > Math.abs(res.vy)) {
              n.direction = res.vx > 0 ? "RIGHT" : "LEFT";
              n.anim.flipX = res.vx < 0; // humans face right by default
            } else {
              n.direction = res.vy > 0 ? "DOWN" : "UP";
            }
            n.anim.frameTimer += dt;
            if (n.anim.frameTimer >= (n.anim.frameSpeed || 0.12)) {
              n.anim.frameTimer = 0;
              n.anim.currentFrame =
                (n.anim.currentFrame + 1) % (n.anim.totalFrames || 4);
            }
          } else {
            n.anim.currentFrame = 0;
            n.anim.frameTimer = 0;
          }
        }
        // Hostile enemies
        for (const e of survivalEngine.enemies) {
          const res = networkClient.interpolator.getInterpolatedEntity(
            e.id,
            e.x,
            e.y,
          );
          e.x = res.x;
          e.y = res.y;
          if (res.isMoving) {
            e.vx = res.vx;
            e.vy = res.vy;
            if (Math.abs(res.vx) > Math.abs(res.vy)) {
              e.direction = res.vx > 0 ? "RIGHT" : "LEFT";
            } else {
              e.direction = res.vy > 0 ? "DOWN" : "UP";
            }
          }
        }
        // Remote multiplayer players
        for (const rp of survivalEngine.remotePlayers) {
          const res = networkClient.interpolator.getInterpolatedEntity(
            rp.id,
            rp.x,
            rp.y,
          );
          rp.x = res.x;
          rp.y = res.y;
          if (res.isMoving) {
            rp.vx = res.vx;
            rp.vy = res.vy;
            if (Math.abs(res.vx) > Math.abs(res.vy)) {
              rp.facing = res.vx > 0 ? "RIGHT" : "LEFT";
              rp.direction = rp.facing;
            } else {
              rp.direction = res.vy > 0 ? "DOWN" : "UP";
            }
          } else {
            rp.vx = 0;
            rp.vy = 0;
          }
        }
      }

      // 4. Update terrain chunk loading around player's predicted position
      survivalEngine.worldManager.updatePlayerLocation(
        survivalEngine.player.x,
        survivalEngine.player.y,
      );
    } else {
      // Standalone / Offline Fallback Mode: run complete local simulation
      survivalEngine.update(dt);
    }

    // 2. Render World & Entities (Local + Remote Multiplayer Players)
    // Fix 1: Pass dt so SurvivalRenderer uses Math.exp-based camera smoothing.
    survivalRenderer.render(survivalCanvas, survivalEngine, dt);

    // 3. Update HUD & Radar
    updateSurvivalHUD();
    renderRadarMiniMap();

    // 4. Game Over Modal Check
    if (survivalEngine.player.isDead) {
      modalGameOver.classList.remove("hidden");
    } else {
      modalGameOver.classList.add("hidden");
    }

    // 5. NPC Dialogue Modal Check
    if (
      survivalEngine.activeDialogueNPC &&
      modalDialogue.classList.contains("hidden")
    ) {
      openDialogueModal(survivalEngine.activeDialogueNPC);
    }

    // 6. Chest Modal Check
    if (survivalEngine.activeChest && modalChest.classList.contains("hidden")) {
      openChestModal(survivalEngine.activeChest);
    }
  }

  survivalAnimFrameId = requestAnimationFrame(survivalGameLoop);
}

function updateSurvivalHUD() {
  if (!survivalEngine) return;

  const p = survivalEngine.player;
  const wt = survivalEngine.worldTime;

  // Meters (Pixel Art Sprite Bars)
  hudHpVal.textContent = `${Math.ceil(p.health)}/${p.maxHealth}`;
  const hpRatio = Math.max(0, Math.min(1, p.health / p.maxHealth));
  const hpFrame = Math.max(0, Math.min(6, Math.floor(hpRatio * 6)));
  if (hudHpImg) hudHpImg.src = `/assets/ui/redbar_0${hpFrame}.png`;

  hudHungerVal.textContent = `${Math.ceil(p.hunger)}/${p.maxHunger}`;
  const hungerRatio = Math.max(0, Math.min(1, p.hunger / p.maxHunger));
  const hungerFrame = Math.max(0, Math.min(6, Math.floor(hungerRatio * 6)));
  if (hudHungerImg) hudHungerImg.src = `/assets/ui/greenbar_0${hungerFrame}.png`;

  hudStaminaVal.textContent = `${Math.ceil(p.stamina)}/${p.maxStamina}`;
  const staminaRatio = Math.max(0, Math.min(1, p.stamina / p.maxStamina));
  const staminaFrame = Math.max(0, Math.min(5, Math.floor(staminaRatio * 5)));
  if (hudStaminaImg) hudStaminaImg.src = `/assets/ui/bluebar_0${staminaFrame}.png`;

  // World Clock
  const hrPad = String(wt.hour).padStart(2, "0");
  const minPad = String(wt.minute).padStart(2, "0");
  const isPM = wt.hour >= 12;
  const displayHour = wt.hour % 12 === 0 ? 12 : wt.hour % 12;
  hudClockTime.textContent = `${String(displayHour).padStart(2, "0")}:${minPad} ${isPM ? "PM" : "AM"}`;
  hudClockPhase.textContent = `Day ${wt.dayNumber} • ${wt.timeOfDay}`;

  // Discovered Villages (out of max 4)
  const totalDiscovered = survivalEngine.worldManager.villages.filter(
    (v) => v.discovered,
  ).length;
  hudVillagesCount.textContent = `${totalDiscovered}/4`;

  const nearest = survivalEngine.worldManager.getNearestVillage(p.x, p.y);
  if (nearest) {
    const distMeters = Math.round(nearest.dist);
    hudNearestVillage.textContent =
      distMeters < 25
        ? `In: ${nearest.village.name}`
        : `Nearest: ${nearest.village.name} (~${distMeters}m)`;
  }

  // Hotbar render
  renderHotbar();

  // Action Prompt Detection
  updateActionPrompt();

  // Quest Tracker
  renderQuestTracker();
}

function getItemIconHtml(itemKey: ItemId | null): string {
  if (!itemKey) return "";
  const def = ITEM_CATALOG[itemKey];
  if (!def) return `<img src="/assets/ui/basket.png" class="slot-pixel-icon" alt="Item" />`;
  if (def.spritePath) {
    return `<img src="${def.spritePath}" class="slot-pixel-icon" alt="${def.name}" draggable="false" />`;
  }
  return `<img src="/assets/ui/basket.png" class="slot-pixel-icon" alt="${def.name}" draggable="false" />`;
}

function renderHotbar() {
  if (!survivalEngine) return;
  hotbarSlotsContainer.innerHTML = "";

  survivalEngine.hotbar.forEach((slot, idx) => {
    const isActive = idx === survivalEngine?.activeHotbarIndex;
    const slotEl = document.createElement("div");
    slotEl.className = `hotbar-slot ${isActive ? "active" : ""}`;
    slotEl.addEventListener("click", () => {
      if (survivalEngine) survivalEngine.activeHotbarIndex = idx;
    });

    // 4 Corner Selection Brackets from Sunnyside UI for the active slot
    if (isActive) {
      const cornerTL = document.createElement("span");
      cornerTL.className = "selectbox-corner corner-tl";
      const cornerTR = document.createElement("span");
      cornerTR.className = "selectbox-corner corner-tr";
      const cornerBL = document.createElement("span");
      cornerBL.className = "selectbox-corner corner-bl";
      const cornerBR = document.createElement("span");
      cornerBR.className = "selectbox-corner corner-br";
      slotEl.appendChild(cornerTL);
      slotEl.appendChild(cornerTR);
      slotEl.appendChild(cornerBL);
      slotEl.appendChild(cornerBR);
    }

    const keyEl = document.createElement("span");
    keyEl.className = "slot-key-num";
    keyEl.textContent = String(idx + 1);
    slotEl.appendChild(keyEl);

    if (slot.item) {
      const iconWrapper = document.createElement("div");
      iconWrapper.className = "slot-icon-inner";
      iconWrapper.innerHTML = getItemIconHtml(slot.item);
      slotEl.appendChild(iconWrapper);

      if (slot.count > 1) {
        const countEl = document.createElement("span");
        countEl.className = "slot-item-count";
        countEl.textContent = String(slot.count);
        slotEl.appendChild(countEl);
      }

      if (slot.durability !== undefined && slot.maxDurability) {
        const duraEl = document.createElement("div");
        duraEl.className = "slot-durability-bar";
        duraEl.style.width = `${(slot.durability / slot.maxDurability) * 100}%`;
        slotEl.appendChild(duraEl);
      }
    }

    hotbarSlotsContainer.appendChild(slotEl);
  });
}

function updateActionPrompt() {
  if (!survivalEngine) return;
  const p = survivalEngine.player;

  // 1. Nearby NPC
  for (const npc of survivalEngine.npcs) {
    if (Math.hypot(p.x - npc.position.x, p.y - npc.position.y) <= 2.2) {
      showPrompt("[E]", "Talk to Villager");
      return;
    }
  }

  // 2. Nearby Animal
  for (const animal of survivalEngine.animals) {
    if (Math.hypot(p.x - animal.position.x, p.y - animal.position.y) <= 2.0) {
      showPrompt("[E]", `Pet ${animal.species.toUpperCase()}`);
      return;
    }
  }

  // 3. Nearby Resource Node (Tree, Rock, Bush)
  const res = survivalEngine.worldManager.getResourceAt(p.x, p.y, 2.2);
  if (res && !res.isDepleted) {
    const action =
      res.type === "tree"
        ? "Chop Tree"
        : res.type === "rock" || res.type === "iron_rock"
          ? "Mine Rock"
          : "Harvest";
    showPrompt("[Left Click]", action);
    return;
  }

  // 4. Nearby Chest or Door
  for (const struct of survivalEngine.placedStructures) {
    if (Math.hypot(p.x - struct.x, p.y - struct.y) <= 2.0) {
      if (struct.type === "chest") {
        showPrompt("[E]", "Open Storage Chest");
        return;
      }
      if (struct.type === "wood_door") {
        showPrompt("[E]", struct.isOpen ? "Close Door" : "Open Door");
        return;
      }
    }
  }

  // Hide prompt if no interactable nearby
  gameActionPrompt.classList.add("hidden");
}

function showPrompt(key: string, desc: string) {
  const keyEl = gameActionPrompt.querySelector(".prompt-key")!;
  const descEl = gameActionPrompt.querySelector(".prompt-desc")!;
  keyEl.textContent = key;
  descEl.textContent = desc;
  gameActionPrompt.classList.remove("hidden");
}

function renderQuestTracker() {
  if (!survivalEngine) return;
  questListItems.innerHTML = "";

  survivalEngine.quests.forEach((q) => {
    const item = document.createElement("div");
    item.className = `quest-item ${q.completed ? "completed" : ""}`;

    item.innerHTML = `
      <div class="quest-item-title">
        <span>${q.completed ? "✓" : "○"} ${q.title}</span>
        <span class="mono">${q.progress}/${q.goal}</span>
      </div>
      <div class="quest-item-desc">${q.desc}</div>
    `;

    questListItems.appendChild(item);
  });
}

/**
 * Renders the Compass / Radar widget showing player orientation and 2-4x gap villages.
 */
function renderRadarMiniMap() {
  if (!survivalEngine || !radarCanvas) return;
  const ctx = radarCanvas.getContext("2d");
  if (!ctx) return;

  const w = radarCanvas.width;
  const h = radarCanvas.height;
  const center = w / 2;

  ctx.clearRect(0, 0, w, h);

  // Radar circle background
  ctx.fillStyle = "#022c22";
  ctx.beginPath();
  ctx.arc(center, center, center - 2, 0, Math.PI * 2);
  ctx.fill();

  // Draw concentric range rings (2 village widths and 4 village widths)
  ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(center, center, center * 0.5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(center, center, center * 0.85, 0, Math.PI * 2);
  ctx.stroke();

  // Player position in center
  ctx.fillStyle = "#facc15";
  ctx.beginPath();
  ctx.arc(center, center, 4, 0, Math.PI * 2);
  ctx.fill();

  // Draw compass needles towards villages (enforcing 2 to 4 gap rule)
  const p = survivalEngine.player;
  const planned = survivalEngine.worldManager.villagePlannedSites;

  planned.forEach((site, i) => {
    const isGenerated = site.generated;
    const dx = site.targetX - p.x;
    const dy = site.targetY - p.y;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    // Radar scale: radius corresponds to ~160 tiles (4 village equivalents)
    const radarDist = Math.min(center - 8, (dist / 160) * (center - 8));
    const iconX = center + Math.cos(angle) * radarDist;
    const iconY = center + Math.sin(angle) * radarDist;

    ctx.fillStyle = isGenerated ? "#22c55e" : "rgba(255, 255, 255, 0.4)";
    ctx.beginPath();
    ctx.arc(iconX, iconY, isGenerated ? 4 : 3, 0, Math.PI * 2);
    ctx.fill();

    // Pointer line from center to village marker
    ctx.strokeStyle = isGenerated
      ? "rgba(34, 197, 94, 0.4)"
      : "rgba(255, 255, 255, 0.15)";
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.lineTo(iconX, iconY);
    ctx.stroke();
  });
}

const activeSurvivalKeys = new Set<string>();

export function updatePlayerContinuousMovement(dt: number = 0.025) {
  if (!survivalEngine) return;
  let dx = 0;
  let dy = 0;
  if (activeSurvivalKeys.has("w") || activeSurvivalKeys.has("arrowup")) dy -= 1;
  if (activeSurvivalKeys.has("s") || activeSurvivalKeys.has("arrowdown"))
    dy += 1;
  if (activeSurvivalKeys.has("a") || activeSurvivalKeys.has("arrowleft"))
    dx -= 1;
  if (activeSurvivalKeys.has("d") || activeSurvivalKeys.has("arrowright"))
    dx += 1;

  survivalEngine.player.vx = dx;
  survivalEngine.player.vy = dy;

  if (
    networkClient &&
    (networkClient.connectionState === "CONNECTED" ||
      networkClient.connectionState === "LOCAL_SERVER")
  ) {
    // Fix 2: Expose the prediction object so SurvivalRenderer camera can follow predictedX
    // (stable authoritative position) rather than the visual error-offset position.
    (survivalEngine as any).networkPrediction = networkClient.prediction;

    // Smooth visual error decay over time (zero jerking / zero snapping)
    networkClient.prediction.updateSmoothing(dt);

    if (dx !== 0 || dy !== 0) {
      const canSprint = survivalEngine.player.isSprinting && survivalEngine.player.stamina > 10;
      const input = networkClient.prediction.predictMovement(
        dx,
        dy,
        canSprint,
        survivalEngine.player.isSwimming,
        dt,
        (x, y) => (survivalEngine as any).canMoveTo(x, y),
      );

      // Render at smoothly interpolated visual coordinates (predicted + decaying error offset)
      const vis = networkClient.prediction.getVisualPosition();
      survivalEngine.player.x = vis.x;
      survivalEngine.player.y = vis.y;

      if (dx > 0) {
        survivalEngine.player.facing = "RIGHT";
        survivalEngine.player.direction = "RIGHT";
      } else if (dx < 0) {
        survivalEngine.player.facing = "LEFT";
        survivalEngine.player.direction = "LEFT";
      } else if (dy > 0) {
        survivalEngine.player.direction = "DOWN";
      } else if (dy < 0) {
        survivalEngine.player.direction = "UP";
      }

      networkClient.sendInput(
        input.vx,
        input.vy,
        input.isSprinting,
        input.seq,
        dt,
      );
      (survivalEngine.player as any)._wasMoving = true;
    } else {
      if ((survivalEngine.player as any)._wasMoving) {
        (survivalEngine.player as any)._wasMoving = false;
        const input = networkClient.prediction.predictMovement(
          0,
          0,
          false,
          survivalEngine.player.isSwimming,
          dt,
          (x, y) => (survivalEngine as any).canMoveTo(x, y),
        );
        networkClient.sendInput(0, 0, false, input.seq, dt);
      }
      // Keep visual coordinates smoothly updated even when standing still
      const vis = networkClient.prediction.getVisualPosition();
      survivalEngine.player.x = vis.x;
      survivalEngine.player.y = vis.y;
    }
  }
}

function initSurvivalInputs() {
  window.addEventListener("keydown", (e) => {
    if (!isSurvivalTabActive) return;
    if (e.target instanceof HTMLInputElement) return;

    const key = e.key.toLowerCase();
    activeSurvivalKeys.add(key);

    if (e.shiftKey) {
      if (survivalEngine) survivalEngine.player.isSprinting = true;
    }

    // Hotbar quick keys 1-8
    if (["1", "2", "3", "4", "5", "6", "7", "8"].includes(key)) {
      if (survivalEngine) {
        const idx = parseInt(key, 10) - 1;
        survivalEngine.activeHotbarIndex = idx;
        networkClient?.sendAction({ type: "SELECT_HOTBAR", index: idx });
      }
    }

    // Interact [E]
    if (key === "e") {
      networkClient?.sendAction({ type: "INTERACT" });
      survivalEngine?.handleInteractKey();
    }

    // Feed / Eat [F]
    if (key === "f") {
      networkClient?.sendAction({ type: "FEED" });
      networkClient?.sendAction({ type: "EAT" });
      survivalEngine?.handleFeedKey();
      survivalEngine?.eatActiveFood();
    }

    // Inventory / Crafting [I / C]
    if (key === "i" || key === "c") {
      toggleInventoryModal();
    }

    // Build mode [B]
    if (key === "b") {
      if (survivalEngine) {
        survivalEngine.isBuildMode = !survivalEngine.isBuildMode;
        const active = survivalEngine.getActiveItemSlot()?.item;
        survivalEngine.buildPiece =
          active && ITEM_CATALOG[active]?.isPlaceable ? active : "wood_wall";
        survivalEngine.addFloatingText(
          survivalEngine.isBuildMode ? "Build Mode ON" : "Build Mode OFF",
          survivalEngine.player.x,
          survivalEngine.player.y - 1,
          "#38bdf8",
        );
      }
    }

    // Pause [ESC]
    if (key === "escape") {
      togglePauseModal();
    }

    // Space: Jump
    if (key === " " || e.code === "Space") {
      if (survivalEngine) {
        survivalEngine.jump();
        networkClient?.sendAction({ type: "JUMP" });
      }
    }

    if (
      [
        "arrowup",
        "arrowdown",
        "arrowleft",
        "arrowright",
        " ",
        "w",
        "a",
        "s",
        "d",
      ].includes(key) ||
      e.code === "Space"
    ) {
      e.preventDefault();
    }

    updatePlayerContinuousMovement(0.025);
  });

  window.addEventListener("keyup", (e) => {
    if (!isSurvivalTabActive) return;
    if (e.target instanceof HTMLInputElement) return;

    const key = e.key.toLowerCase();
    activeSurvivalKeys.delete(key);

    if (!e.shiftKey) {
      if (survivalEngine) survivalEngine.player.isSprinting = false;
    }

    updatePlayerContinuousMovement(0.025);
  });

  // Mouse clicks on canvas
  if (survivalCanvas) {
    survivalCanvas.addEventListener("mousedown", (e) => {
      if (!isSurvivalTabActive || !survivalEngine || !survivalRenderer) return;

      const rect = survivalCanvas.getBoundingClientRect();
      const cellSize = survivalRenderer.baseTileSize * survivalRenderer.zoom;
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      const halfW = survivalCanvas.width / 2;
      const halfH = survivalCanvas.height / 2;
      const worldX = survivalRenderer.cameraX + (screenX - halfW) / cellSize;
      const worldY = survivalRenderer.cameraY + (screenY - halfH) / cellSize;

      if (survivalEngine.isBuildMode && survivalEngine.buildPiece) {
        networkClient?.sendAction({
          type: "BUILD",
          pieceId: survivalEngine.buildPiece,
          wx: worldX,
          wy: worldY,
        });
        survivalEngine.placeStructure(
          survivalEngine.buildPiece,
          worldX,
          worldY,
        );
      } else {
        networkClient?.sendAction({
          type: "CLICK",
          wx: worldX,
          wy: worldY,
        });
        survivalEngine.handleWorldClick(worldX, worldY);
      }
    });

    survivalCanvas.addEventListener("mousemove", (e) => {
      if (!isSurvivalTabActive || !survivalEngine || !survivalRenderer) return;
      if (survivalEngine.isBuildMode) {
        const rect = survivalCanvas.getBoundingClientRect();
        const cellSize = survivalRenderer.baseTileSize * survivalRenderer.zoom;
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const halfW = survivalCanvas.width / 2;
        const halfH = survivalCanvas.height / 2;
        survivalEngine.buildPreviewX = Math.round(
          survivalRenderer.cameraX + (screenX - halfW) / cellSize,
        );
        survivalEngine.buildPreviewY = Math.round(
          survivalRenderer.cameraY + (screenY - halfH) / cellSize,
        );
        const tile = survivalEngine.worldManager.getTile(
          survivalEngine.buildPreviewX,
          survivalEngine.buildPreviewY,
        );
        survivalEngine.isBuildPreviewValid = !tile.isWater && !tile.isBlocked;
      }
    });

    survivalCanvas.addEventListener(
      "wheel",
      (e) => {
        if (!isSurvivalTabActive || !survivalEngine) return;
        e.preventDefault();
        // Cycle hotbar slots with mouse wheel
        if (e.deltaY > 0) {
          survivalEngine.activeHotbarIndex =
            (survivalEngine.activeHotbarIndex + 1) % 8;
        } else {
          survivalEngine.activeHotbarIndex =
            (survivalEngine.activeHotbarIndex + 7) % 8;
        }
        networkClient?.sendAction({
          type: "SELECT_HOTBAR",
          index: survivalEngine.activeHotbarIndex,
        });
      },
      { passive: false },
    );
  }
}

function initSurvivalUI() {
  // Initialize multiplayer Host/Join/Invite UI panel
  initMultiplayerUI();

  // Fullscreen button
  btnToggleFullscreen.addEventListener("click", () => {
    const container = document.getElementById("survival-game-container");
    if (!document.fullscreenElement) {
      container?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });

  // Sound toggle
  btnToggleAudio.addEventListener("click", () => {
    const isMuted = GameAudio.toggleMute();
    const icon = document.getElementById("audio-icon");
    if (icon) {
      if (isMuted) {
        icon.classList.add("audio-muted");
      } else {
        icon.classList.remove("audio-muted");
      }
    }
  });

  // Modals open/close
  btnOpenInventory.addEventListener("click", toggleInventoryModal);
  btnOpenPause.addEventListener("click", togglePauseModal);

  btnCloseInventory.addEventListener("click", () =>
    modalInventory.classList.add("hidden"),
  );
  btnCloseDialogue.addEventListener("click", () => {
    modalDialogue.classList.add("hidden");
    if (survivalEngine) survivalEngine.activeDialogueNPC = null;
  });
  btnCloseChest.addEventListener("click", () => {
    modalChest.classList.add("hidden");
    if (survivalEngine) survivalEngine.activeChest = null;
  });
  btnClosePause.addEventListener("click", () =>
    modalPause.classList.add("hidden"),
  );
  btnResumeGame.addEventListener("click", () =>
    modalPause.classList.add("hidden"),
  );

  // Save / Load / Reset
  btnSaveGame.addEventListener("click", () => {
    if (survivalEngine) {
      const saveData = {
        seed: survivalEngine.worldManager.seed,
        player: survivalEngine.player,
        inventory: survivalEngine.inventory,
        hotbar: survivalEngine.hotbar,
        placedStructures: survivalEngine.placedStructures,
        time: survivalEngine.worldTime,
      };
      localStorage.setItem("rts_survival_save_v1", JSON.stringify(saveData));
      alert("World & Player Progress Saved successfully!");
    }
  });

  btnLoadGame.addEventListener("click", () => {
    const raw = localStorage.getItem("rts_survival_save_v1");
    if (raw && survivalEngine) {
      try {
        const data = JSON.parse(raw);
        survivalEngine.player = { ...survivalEngine.player, ...data.player };
        survivalEngine.inventory = data.inventory || survivalEngine.inventory;
        survivalEngine.hotbar = data.hotbar || survivalEngine.hotbar;
        survivalEngine.placedStructures = data.placedStructures || [];
        modalPause.classList.add("hidden");
        survivalEngine.addFloatingText(
          "Game Loaded!",
          survivalEngine.player.x,
          survivalEngine.player.y - 1,
          "#38bdf8",
        );
      } catch (err) {
        alert("Failed to load save data.");
      }
    } else {
      alert("No saved world found in storage.");
    }
  });

  btnResetGame.addEventListener("click", () => {
    if (confirm("Start a brand new procedurally generated survival world?")) {
      const newSeed = Math.floor(Math.random() * 1000000);
      survivalEngine = new SurvivalEngine(newSeed);
      modalPause.classList.add("hidden");
    }
  });

  btnRespawn.addEventListener("click", () => {
    networkClient?.sendAction({ type: "RESPAWN" });
    survivalEngine?.respawnPlayer();
    modalGameOver.classList.add("hidden");
  });

  // Crafting category tabs
  const craftTabs = document.querySelectorAll(".craft-tab-btn");
  craftTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      craftTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      activeCraftCategory = (tab as HTMLElement).dataset.category || "tools";
      renderCraftingList();
    });
  });
}

function toggleInventoryModal() {
  const isHidden = modalInventory.classList.contains("hidden");
  if (isHidden) {
    renderInventoryGrids();
    renderCraftingList();
    modalInventory.classList.remove("hidden");
  } else {
    modalInventory.classList.add("hidden");
  }
}

function togglePauseModal() {
  modalPause.classList.toggle("hidden");
}

function renderInventoryGrids() {
  if (!survivalEngine) return;
  modalInventoryGrid.innerHTML = "";
  modalHotbarGrid.innerHTML = "";

  // 20 Backpack slots
  survivalEngine.inventory.forEach((slot, idx) => {
    const slotEl = document.createElement("div");
    slotEl.className = "inv-slot";

    if (slot.item) {
      slotEl.innerHTML = `
        <div class="slot-icon-inner">${getItemIconHtml(slot.item)}</div>
        ${slot.count > 1 ? `<span class="slot-item-count">${slot.count}</span>` : ""}
      `;
    }

    slotEl.addEventListener("click", () => {
      // Swap or transfer item with active hotbar slot
      if (survivalEngine) {
        const activeHot =
          survivalEngine.hotbar[survivalEngine.activeHotbarIndex];
        const temp = { ...slot };
        survivalEngine.inventory[idx] = { ...activeHot };
        survivalEngine.hotbar[survivalEngine.activeHotbarIndex] = temp;
        renderInventoryGrids();
      }
    });

    modalInventoryGrid.appendChild(slotEl);
  });

  // 8 Hotbar slots
  survivalEngine.hotbar.forEach((slot, idx) => {
    const slotEl = document.createElement("div");
    slotEl.className = `inv-slot ${idx === survivalEngine?.activeHotbarIndex ? "active" : ""}`;

    if (slot.item) {
      slotEl.innerHTML = `
        <div class="slot-icon-inner">${getItemIconHtml(slot.item)}</div>
        ${slot.count > 1 ? `<span class="slot-item-count">${slot.count}</span>` : ""}
      `;
    }

    slotEl.addEventListener("click", () => {
      if (survivalEngine) {
        survivalEngine.activeHotbarIndex = idx;
        renderInventoryGrids();
      }
    });

    modalHotbarGrid.appendChild(slotEl);
  });
}

function renderCraftingList() {
  if (!survivalEngine) return;
  craftRecipesList.innerHTML = "";

  const recipes = CRAFTING_RECIPES.filter(
    (r) => r.category === activeCraftCategory,
  );

  recipes.forEach((rec) => {
    const canCraft = rec.ingredients.every((ing) =>
      survivalEngine?.hasItem(ing.item, ing.count),
    );
    const card = document.createElement("div");
    card.className = "recipe-card";

    const reqsStr = rec.ingredients
      .map((ing) => `${ing.count} ${ITEM_CATALOG[ing.item]?.name || ing.item}`)
      .join(", ");

    card.innerHTML = `
      <div class="recipe-info">
        <div class="recipe-icon-wrapper">${getItemIconHtml(rec.result)}</div>
        <div>
          <div class="recipe-name">${rec.name}</div>
          <div class="recipe-reqs">Requires: ${reqsStr} ${rec.requiresStation ? `• (${rec.requiresStation})` : ""}</div>
        </div>
      </div>
      <button class="btn-craft" ${canCraft ? "" : "disabled"}>Craft</button>
    `;

    const craftBtn = card.querySelector(".btn-craft")!;
    craftBtn.addEventListener("click", () => {
      networkClient?.sendAction({ type: "CRAFT", recipeId: rec.id });
      if (survivalEngine && survivalEngine.craftRecipe(rec)) {
        renderInventoryGrids();
        renderCraftingList();
      }
    });

    craftRecipesList.appendChild(card);
  });
}

function openDialogueModal(npc: NPC) {
  dialogueNpcName.textContent = npc.customTitle || `Village Elder & Merchant`;
  dialogueNpcText.textContent = npc.customDialogue
    ? `"${npc.customDialogue}"`
    : `"Welcome, traveler! Between Oakvale and the next villages (Riverwood, Sunhaven, Pinecrest) lies dangerous open wilderness. Take provisions or barter with us!"`;

  barterTradeList.innerHTML = "";

  const trades = [
    { give: "wood", giveCount: 5, get: "bread", getCount: 2 },
    { give: "stone", giveCount: 4, get: "seeds", getCount: 6 },
    { give: "iron_ore", giveCount: 2, get: "iron_axe", getCount: 1 },
    { give: "berries", giveCount: 8, get: "cooked_meat", getCount: 2 },
  ];

  trades.forEach((trade) => {
    const row = document.createElement("div");
    row.className = "barter-row";
    const canTrade = survivalEngine
      ? survivalEngine.hasItem(trade.give as ItemId, trade.giveCount)
      : false;

    row.innerHTML = `
      <div class="barter-details">
        <span class="barter-item">${getItemIconHtml(trade.give as ItemId)} Give ${trade.giveCount} ${ITEM_CATALOG[trade.give as ItemId]?.name}</span>
        <span>➔</span>
        <span class="barter-item">${getItemIconHtml(trade.get as ItemId)} Get ${trade.getCount} ${ITEM_CATALOG[trade.get as ItemId]?.name}</span>
      </div>
      <button class="btn-craft" ${canTrade ? "" : "disabled"}>Trade</button>
    `;

    const tradeBtn = row.querySelector("button")!;
    tradeBtn.addEventListener("click", () => {
      if (
        survivalEngine &&
        survivalEngine.hasItem(trade.give as ItemId, trade.giveCount)
      ) {
        survivalEngine.removeItem(trade.give as ItemId, trade.giveCount);
        survivalEngine.addItemToInventory(trade.get as ItemId, trade.getCount);
        GameAudio.playCraft();
        survivalEngine.addFloatingText(
          "Trade Complete!",
          survivalEngine.player.x,
          survivalEngine.player.y - 1,
          "#34d399",
        );
        openDialogueModal(npc);
      }
    });

    barterTradeList.appendChild(row);
  });

  modalDialogue.classList.remove("hidden");
}

function openChestModal(chest: PlacedStructure) {
  if (!survivalEngine) return;
  modalChestGrid.innerHTML = "";
  modalChestPlayerGrid.innerHTML = "";

  if (!chest.chestStorage) {
    chest.chestStorage = Array.from({ length: 16 }, () => ({
      item: null,
      count: 0,
    }));
  }

  // Render 16 chest slots
  chest.chestStorage.forEach((slot: InventorySlot, idx: number) => {
    const slotEl = document.createElement("div");
    slotEl.className = "inv-slot";
    if (slot.item) {
      slotEl.innerHTML = `<div class="slot-icon-inner">${getItemIconHtml(slot.item)}</div><span class="slot-item-count">${slot.count}</span>`;
    }

    slotEl.addEventListener("click", () => {
      // Transfer to player inventory
      if (slot.item && survivalEngine) {
        if (survivalEngine.addItemToInventory(slot.item, slot.count)) {
          slot.item = null;
          slot.count = 0;
          openChestModal(chest);
        }
      }
    });
    modalChestGrid.appendChild(slotEl);
  });

  // Render player backpack slots
  survivalEngine.inventory.forEach((slot: InventorySlot, idx: number) => {
    const slotEl = document.createElement("div");
    slotEl.className = "inv-slot";
    if (slot.item) {
      slotEl.innerHTML = `<div class="slot-icon-inner">${getItemIconHtml(slot.item)}</div><span class="slot-item-count">${slot.count}</span>`;
    }

    slotEl.addEventListener("click", () => {
      // Transfer into first empty chest slot
      if (slot.item && chest.chestStorage) {
        const emptySlot = chest.chestStorage.find(
          (s: InventorySlot) => !s.item,
        );
        if (emptySlot) {
          emptySlot.item = slot.item;
          emptySlot.count = slot.count;
          slot.item = null;
          slot.count = 0;
          openChestModal(chest);
        }
      }
    });
    modalChestPlayerGrid.appendChild(slotEl);
  });

  modalChest.classList.remove("hidden");
}

// Initial auto-start on page load (support ?tab=game or hash #game)
const urlParams = new URLSearchParams(window.location.search);
const initialTab =
  urlParams.get("tab") ||
  (window.location.hash ? window.location.hash.replace("#", "") : null);
if (
  initialTab &&
  ["game", "settlement", "houses", "terrain", "assets-map"].includes(initialTab)
) {
  switchTab(initialTab as any);
} else {
  switchTab("game");
}
