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
import { ItemId, Recipe, PlacedStructure, InventorySlot } from "./game/GameTypes";

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
const allViews = [viewSettlement, viewGame, viewHouses, viewTerrain, viewAssetsMap];
const allTabs = [tabSettlement, tabGame, tabHouses, tabTerrain, tabAssetsMap];

export function switchTab(tab: "settlement" | "game" | "houses" | "terrain" | "assets-map") {
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

// ═══════════════════════════════════════════════════════════════════
// PHASER EVENTS
// ═══════════════════════════════════════════════════════════════════
window.addEventListener("cursor-world-move", ((e: CustomEvent) => {
  coordBadge.innerHTML = `<span>X: ${e.detail.x}</span> &bull; <span>Y: ${e.detail.y}</span>`;
}) as EventListener);

window.addEventListener("asset-hover", ((e: CustomEvent) => {
  const i = e.detail.item as AssetItem;
  const c = e.detail.category as AssetCategory;
  hoveredAssetLabel.innerHTML = `<strong>${i.name}</strong> <span style="color:#94a3b8;">(${c.title})</span> &bull; <span style="font-family:var(--font-mono);color:#38bdf8;">${i.w}×${i.h}px</span>`;

  // Position floating tooltip
  const px = e.detail.pointerX ?? 0;
  const py = e.detail.pointerY ?? 0;
  if (px > 0 && py > 0) {
    floatingTooltip.innerHTML = `
      <div class="tooltip-title">${i.name}</div>
      <div class="tooltip-meta">
        <span class="tooltip-cat">${c.title}</span>
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

const settlementCanvas = document.getElementById("settlement-canvas") as HTMLCanvasElement;
const settlementViewport = document.getElementById("settlement-viewport") as HTMLElement;

let currentSettlementData: SettlementData | null = null;
let currentSeed = Math.floor(Math.random() * 1000000);
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
      }
    );

    // Update live counts
    const wildBadge = document.getElementById("stat-wildlife-count");
    const npcBadge = document.getElementById("stat-villagers-count");
    if (wildBadge) {
      wildBadge.textContent = String(
        lifeformManager.getAnimals().filter((a) => a.isActive).length
      );
    }
    if (npcBadge) {
      npcBadge.textContent = String(
        lifeformManager.getNPCs().filter((n) => n.isActive).length
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
  const seedInput = document.getElementById("settlement-seed-input") as HTMLInputElement;

  if (seedBadge) seedBadge.innerHTML = `Seed: <strong>${data.seed}</strong>`;
  if (housesBadge) housesBadge.innerHTML = `Houses: <strong>${data.houses.length}</strong>`;
  if (farmsBadge) farmsBadge.innerHTML = `Farms: <strong>${data.farms.length}</strong>`;
  if (wellsBadge) wellsBadge.innerHTML = `Wells: <strong>${data.wells.length}</strong>`;
  if (treesBadge) treesBadge.innerHTML = `Trees: <strong>${data.trees.length}</strong>`;
  if (waterBadge) waterBadge.innerHTML = `Water: <strong>${data.waterBodies.length > 0 ? `${data.waterBodies.length} Ponds` : "None"}</strong>`;
  if (decorBadge) decorBadge.innerHTML = `Scatter: <strong>${data.decorations.length}</strong> (${data.bushes?.length || 0} Bushes)`;
  if (seedInput) seedInput.value = String(data.seed);

  if (validationText) {
    if (data.validation.valid) {
      validationText.textContent = "✓ Validated: All 10 Rules Passed (0 Road Overlaps)";
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
  const seedInput = document.getElementById("settlement-seed-input") as HTMLInputElement;

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
        settlementViewport.scrollLeft = (settlementViewport.scrollWidth - settlementViewport.clientWidth) / 2;
        settlementViewport.scrollTop = (settlementViewport.scrollHeight - settlementViewport.clientHeight) / 2;
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

    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "w", "a", "s", "d"].includes(key) || e.code === "Space") {
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
              lifeformManager.player.position.y - animal.position.y
            ) <= 2.2
          ) {
            if (animal.pet()) {
              lifeformManager.player.triggerHop();
            }
          } else if (lifeformManager.player) {
            lifeformManager.player.setTarget(animal.position.x, animal.position.y);
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
      { passive: false }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// FULL-SCREEN SURVIVAL GAME CONTROLLER & HUD
// ═══════════════════════════════════════════════════════════════════

const survivalCanvas = document.getElementById("survival-game-canvas") as HTMLCanvasElement;
const radarCanvas = document.getElementById("radar-canvas") as HTMLCanvasElement;

let survivalEngine: SurvivalEngine | null = null;
let survivalRenderer: SurvivalRenderer | null = null;
let survivalAnimFrameId: number | null = null;
let lastSurvivalTime = 0;
let isSurvivalTabActive = false;
let isSurvivalInitialized = false;

// HUD Elements
const hudHpVal = document.getElementById("hud-hp-val")!;
const hudHpBar = document.getElementById("hud-hp-bar")!;
const hudHungerVal = document.getElementById("hud-hunger-val")!;
const hudHungerBar = document.getElementById("hud-hunger-bar")!;
const hudStaminaVal = document.getElementById("hud-stamina-val")!;
const hudStaminaBar = document.getElementById("hud-stamina-bar")!;
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
const modalChestPlayerGrid = document.getElementById("modal-chest-player-grid")!;

let activeCraftCategory = "tools";

function ensureSurvivalGameLoaded() {
  if (!isSurvivalInitialized) {
    survivalEngine = new SurvivalEngine(currentSeed);
    (window as any).survivalEngine = survivalEngine;
    (window as any).gameEngine = survivalEngine;
    survivalRenderer = new SurvivalRenderer();
    initSurvivalInputs();
    initSurvivalUI();
    resizeSurvivalCanvas();
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
    // 1. Simulation Update
    survivalEngine.update(dt);

    // 2. Render World & Entities
    survivalRenderer.render(survivalCanvas, survivalEngine);

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
    if (survivalEngine.activeDialogueNPC && modalDialogue.classList.contains("hidden")) {
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

  // Meters
  hudHpVal.textContent = `${Math.ceil(p.health)}/${p.maxHealth}`;
  hudHpBar.style.width = `${Math.max(0, (p.health / p.maxHealth) * 100)}%`;

  hudHungerVal.textContent = `${Math.ceil(p.hunger)}/${p.maxHunger}`;
  hudHungerBar.style.width = `${Math.max(0, (p.hunger / p.maxHunger) * 100)}%`;

  hudStaminaVal.textContent = `${Math.ceil(p.stamina)}/${p.maxStamina}`;
  hudStaminaBar.style.width = `${Math.max(0, (p.stamina / p.maxStamina) * 100)}%`;

  // World Clock
  const hrPad = String(wt.hour).padStart(2, "0");
  const minPad = String(wt.minute).padStart(2, "0");
  const isPM = wt.hour >= 12;
  const displayHour = wt.hour % 12 === 0 ? 12 : wt.hour % 12;
  hudClockTime.textContent = `${String(displayHour).padStart(2, "0")}:${minPad} ${isPM ? "PM" : "AM"}`;
  hudClockIcon.textContent = wt.timeOfDay === "Night" ? "🌙" : wt.timeOfDay === "Sunset" ? "🌇" : wt.timeOfDay === "Morning" ? "🌅" : "☀️";
  hudClockPhase.textContent = `Day ${wt.dayNumber} • ${wt.timeOfDay}`;

  // Discovered Villages (out of max 4)
  const totalDiscovered = survivalEngine.worldManager.villages.filter((v) => v.discovered).length;
  hudVillagesCount.textContent = `${totalDiscovered}/4`;

  const nearest = survivalEngine.worldManager.getNearestVillage(p.x, p.y);
  if (nearest) {
    const distMeters = Math.round(nearest.dist);
    hudNearestVillage.textContent = distMeters < 25 ? `In: ${nearest.village.name}` : `Nearest: ${nearest.village.name} (~${distMeters}m)`;
  }

  // Hotbar render
  renderHotbar();

  // Action Prompt Detection
  updateActionPrompt();

  // Quest Tracker
  renderQuestTracker();
}

function renderHotbar() {
  if (!survivalEngine) return;
  hotbarSlotsContainer.innerHTML = "";

  survivalEngine.hotbar.forEach((slot, idx) => {
    const slotEl = document.createElement("div");
    slotEl.className = `hotbar-slot ${idx === survivalEngine?.activeHotbarIndex ? "active" : ""}`;
    slotEl.addEventListener("click", () => {
      if (survivalEngine) survivalEngine.activeHotbarIndex = idx;
    });

    const keyEl = document.createElement("span");
    keyEl.className = "slot-key-num";
    keyEl.textContent = String(idx + 1);
    slotEl.appendChild(keyEl);

    if (slot.item) {
      const def = ITEM_CATALOG[slot.item];
      const iconEl = document.createElement("span");
      iconEl.className = "slot-item-icon";
      iconEl.textContent = def?.icon || "📦";
      slotEl.appendChild(iconEl);

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
    const action = res.type === "tree" ? "Chop Tree" : res.type === "rock" || res.type === "iron_rock" ? "Mine Rock" : "Harvest";
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
    ctx.strokeStyle = isGenerated ? "rgba(34, 197, 94, 0.4)" : "rgba(255, 255, 255, 0.15)";
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.lineTo(iconX, iconY);
    ctx.stroke();
  });
}

function initSurvivalInputs() {
  const activeKeys = new Set<string>();

  window.addEventListener("keydown", (e) => {
    if (!isSurvivalTabActive) return;
    if (e.target instanceof HTMLInputElement) return;

    const key = e.key.toLowerCase();
    activeKeys.add(key);

    if (e.shiftKey) {
      if (survivalEngine) survivalEngine.player.isSprinting = true;
    }

    // Hotbar quick keys 1-8
    if (["1", "2", "3", "4", "5", "6", "7", "8"].includes(key)) {
      if (survivalEngine) {
        survivalEngine.activeHotbarIndex = parseInt(key, 10) - 1;
      }
    }

    // Interact [E]
    if (key === "e") {
      survivalEngine?.handleInteractKey();
    }

    // Feed / Eat [F]
    if (key === "f") {
      survivalEngine?.handleFeedKey();
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
        survivalEngine.buildPiece = active && ITEM_CATALOG[active]?.isPlaceable ? active : "wood_wall";
        survivalEngine.addFloatingText(survivalEngine.isBuildMode ? "Build Mode ON" : "Build Mode OFF", survivalEngine.player.x, survivalEngine.player.y - 1, "#38bdf8");
      }
    }

    // Pause [ESC]
    if (key === "escape") {
      togglePauseModal();
    }

    // Space Jump / Swing
    if (key === " " || e.code === "Space") {
      if (survivalEngine) {
        survivalEngine.player.hopTimer = 0.35;
        survivalEngine.player.swingTimer = 0.22;
        GameAudio.playSwing();
      }
    }

    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "w", "a", "s", "d"].includes(key) || e.code === "Space") {
      e.preventDefault();
    }

    updatePlayerMovement();
  });

  window.addEventListener("keyup", (e) => {
    if (!isSurvivalTabActive) return;
    if (e.target instanceof HTMLInputElement) return;

    const key = e.key.toLowerCase();
    activeKeys.delete(key);

    if (!e.shiftKey) {
      if (survivalEngine) survivalEngine.player.isSprinting = false;
    }

    updatePlayerMovement();
  });

  function updatePlayerMovement() {
    if (!survivalEngine) return;
    let dx = 0;
    let dy = 0;
    if (activeKeys.has("w") || activeKeys.has("arrowup")) dy -= 1;
    if (activeKeys.has("s") || activeKeys.has("arrowdown")) dy += 1;
    if (activeKeys.has("a") || activeKeys.has("arrowleft")) dx -= 1;
    if (activeKeys.has("d") || activeKeys.has("arrowright")) dx += 1;

    survivalEngine.player.vx = dx;
    survivalEngine.player.vy = dy;
  }

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
        survivalEngine.placeStructure(survivalEngine.buildPiece, worldX, worldY);
      } else {
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
        survivalEngine.buildPreviewX = Math.round(survivalRenderer.cameraX + (screenX - halfW) / cellSize);
        survivalEngine.buildPreviewY = Math.round(survivalRenderer.cameraY + (screenY - halfH) / cellSize);
        const tile = survivalEngine.worldManager.getTile(survivalEngine.buildPreviewX, survivalEngine.buildPreviewY);
        survivalEngine.isBuildPreviewValid = !tile.isWater && !tile.isBlocked;
      }
    });

    survivalCanvas.addEventListener("wheel", (e) => {
      if (!isSurvivalTabActive || !survivalEngine) return;
      e.preventDefault();
      // Cycle hotbar slots with mouse wheel
      if (e.deltaY > 0) {
        survivalEngine.activeHotbarIndex = (survivalEngine.activeHotbarIndex + 1) % 8;
      } else {
        survivalEngine.activeHotbarIndex = (survivalEngine.activeHotbarIndex + 7) % 8;
      }
    }, { passive: false });
  }
}

function initSurvivalUI() {
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
    if (icon) icon.textContent = isMuted ? "🔊" : "🔇";
  });

  // Modals open/close
  btnOpenInventory.addEventListener("click", toggleInventoryModal);
  btnOpenPause.addEventListener("click", togglePauseModal);

  btnCloseInventory.addEventListener("click", () => modalInventory.classList.add("hidden"));
  btnCloseDialogue.addEventListener("click", () => {
    modalDialogue.classList.add("hidden");
    if (survivalEngine) survivalEngine.activeDialogueNPC = null;
  });
  btnCloseChest.addEventListener("click", () => {
    modalChest.classList.add("hidden");
    if (survivalEngine) survivalEngine.activeChest = null;
  });
  btnClosePause.addEventListener("click", () => modalPause.classList.add("hidden"));
  btnResumeGame.addEventListener("click", () => modalPause.classList.add("hidden"));

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
        survivalEngine.addFloatingText("Game Loaded!", survivalEngine.player.x, survivalEngine.player.y - 1, "#38bdf8");
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
      const def = ITEM_CATALOG[slot.item];
      slotEl.innerHTML = `
        <span class="slot-item-icon">${def.icon}</span>
        ${slot.count > 1 ? `<span class="slot-item-count">${slot.count}</span>` : ""}
      `;
    }

    slotEl.addEventListener("click", () => {
      // Swap or transfer item with active hotbar slot
      if (survivalEngine) {
        const activeHot = survivalEngine.hotbar[survivalEngine.activeHotbarIndex];
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
      const def = ITEM_CATALOG[slot.item];
      slotEl.innerHTML = `
        <span class="slot-item-icon">${def.icon}</span>
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

  const recipes = CRAFTING_RECIPES.filter((r) => r.category === activeCraftCategory);

  recipes.forEach((rec) => {
    const def = ITEM_CATALOG[rec.result];
    const canCraft = rec.ingredients.every((ing) => survivalEngine?.hasItem(ing.item, ing.count));
    const card = document.createElement("div");
    card.className = "recipe-card";

    const reqsStr = rec.ingredients
      .map((ing) => `${ing.count} ${ITEM_CATALOG[ing.item]?.name || ing.item}`)
      .join(", ");

    card.innerHTML = `
      <div class="recipe-info">
        <span class="recipe-icon">${def?.icon || "🛠️"}</span>
        <div>
          <div class="recipe-name">${rec.name}</div>
          <div class="recipe-reqs">Requires: ${reqsStr} ${rec.requiresStation ? `• (${rec.requiresStation})` : ""}</div>
        </div>
      </div>
      <button class="btn-craft" ${canCraft ? "" : "disabled"}>Craft</button>
    `;

    const craftBtn = card.querySelector(".btn-craft")!;
    craftBtn.addEventListener("click", () => {
      if (survivalEngine && survivalEngine.craftRecipe(rec)) {
        renderInventoryGrids();
        renderCraftingList();
      }
    });

    craftRecipesList.appendChild(card);
  });
}

function openDialogueModal(npc: NPC) {
  dialogueNpcName.textContent = `Village Elder & Merchant`;
  dialogueNpcText.textContent = `"Welcome, traveler! Between Oakvale and the next villages (Riverwood, Sunhaven, Pinecrest) lies dangerous open wilderness. Take provisions or barter with us!"`;

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
    const canTrade = survivalEngine ? survivalEngine.hasItem(trade.give as ItemId, trade.giveCount) : false;

    row.innerHTML = `
      <div class="barter-details">
        <span>Give ${trade.giveCount} ${ITEM_CATALOG[trade.give as ItemId]?.icon} ${ITEM_CATALOG[trade.give as ItemId]?.name}</span>
        <span>➔</span>
        <span>Receive ${trade.getCount} ${ITEM_CATALOG[trade.get as ItemId]?.icon} ${ITEM_CATALOG[trade.get as ItemId]?.name}</span>
      </div>
      <button class="btn-craft" ${canTrade ? "" : "disabled"}>Trade</button>
    `;

    const tradeBtn = row.querySelector("button")!;
    tradeBtn.addEventListener("click", () => {
      if (survivalEngine && survivalEngine.hasItem(trade.give as ItemId, trade.giveCount)) {
        survivalEngine.removeItem(trade.give as ItemId, trade.giveCount);
        survivalEngine.addItemToInventory(trade.get as ItemId, trade.getCount);
        GameAudio.playCraft();
        survivalEngine.addFloatingText("Trade Complete!", survivalEngine.player.x, survivalEngine.player.y - 1, "#34d399");
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
    chest.chestStorage = Array.from({ length: 16 }, () => ({ item: null, count: 0 }));
  }

  // Render 16 chest slots
  chest.chestStorage.forEach((slot: InventorySlot, idx: number) => {
    const slotEl = document.createElement("div");
    slotEl.className = "inv-slot";
    if (slot.item) {
      const def = ITEM_CATALOG[slot.item];
      slotEl.innerHTML = `<span class="slot-item-icon">${def.icon}</span><span class="slot-item-count">${slot.count}</span>`;
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
      const def = ITEM_CATALOG[slot.item];
      slotEl.innerHTML = `<span class="slot-item-icon">${def.icon}</span><span class="slot-item-count">${slot.count}</span>`;
    }

    slotEl.addEventListener("click", () => {
      // Transfer into first empty chest slot
      if (slot.item && chest.chestStorage) {
        const emptySlot = chest.chestStorage.find((s: InventorySlot) => !s.item);
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
const initialTab = urlParams.get("tab") || (window.location.hash ? window.location.hash.replace("#", "") : null);
if (initialTab && ["game", "settlement", "houses", "terrain", "assets-map"].includes(initialTab)) {
  switchTab(initialTab as any);
} else {
  switchTab("game");
}


