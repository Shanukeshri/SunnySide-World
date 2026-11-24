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
import { MainMenuUI } from "./client/MainMenuUI";
import { SurvivalRenderer } from "./game/SurvivalRenderer";
import { GameAudio } from "./game/GameAudio";
import {
  ItemId,
  Recipe,
  PlacedStructure,
  InventorySlot,
  BlockMaterial,
} from "./game/GameTypes";
import { SPECIES_CONFIGS } from "./lifeforms/speciesConfig";
import { isAssetCollidable } from "./data/assetCollision";
import { WorldManager } from "./game/WorldManager";
import { NetworkClient } from "./client/NetworkClient";
import "playroomkit/style.css";

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
  const inspectCollisionType = document.getElementById(
    "inspect-collision-type",
  );
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
  "#atlas-collision-filters .filter-pill",
);
collisionFilterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    collisionFilterButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const filter = btn.getAttribute("data-filter") as
      | "all"
      | "flat"
      | "collidable";
    (window as any).AtlasViewer?.setCollisionFilter(filter);
  });
});

// ═══════════════════════════════════════════════════════════════════
// MAIN MENU BOOTSTRAP
// ═══════════════════════════════════════════════════════════════════
window.addEventListener("DOMContentLoaded", () => {
  // Hide all tabs for the actual game experience
  const topTabBar = document.querySelector(".top-tab-bar") as HTMLElement;
  if (topTabBar) {
    topTabBar.style.display = "none";
  }

  // Init Menu UI
  const mainMenu = new MainMenuUI();
  mainMenu.showMenu();

  mainMenu.setOnStartGame((mode, inviteCode) => {
    // Hide atlas/settlement stuff, switch to game tab
    switchTab("game");

    // In multiplayer, we use the network client
    if (mode === "stream") {
      console.log("Hosting game in Phone Controller (Stream) Mode");
      ensureSurvivalGameLoaded();
      setTimeout(() => {
        networkClient?.hostWorld("Host", "mophair", { streamMode: true });
      }, 300);
    } else if (mode === "multi") {
      ensureSurvivalGameLoaded();
      if (inviteCode) {
        console.log("Joining game with invite code:", inviteCode);
        setTimeout(() => {
          networkClient?.joinWorld(inviteCode, "Player", "mophair");
        }, 300);
      } else {
        console.log("Hosting a new multiplayer game with Playroom Lobby");
        setTimeout(() => {
          networkClient?.hostWorld("Host", "mophair");
        }, 300);
      }
    } else {
      // Single player
      currentSeed = Math.floor(Math.random() * 1000000);
      ensureSurvivalGameLoaded();
    }
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
  const isCollidable =
    e.detail.isCollidable !== undefined
      ? e.detail.isCollidable
      : isAssetCollidable(i, c.id);
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
        <span class="tooltip-badge ${isCollidable ? "collidable" : "flat"}">${isCollidable ? "🧱 Solid" : "🌿 Flat"}</span>
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

let worldGenEngine: SurvivalEngine | null = null;
let worldGenRenderer: SurvivalRenderer | null = null;
let isWorldGenDragging = false;
let worldGenLastX = 0;
let worldGenLastY = 0;

function settlementLoop(now: number) {
  if (!isSettlementTabActive) {
    animFrameId = null;
    return;
  }

  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (
    worldGenEngine &&
    worldGenRenderer &&
    settlementCanvas &&
    viewSettlement
  ) {
    const rect = viewSettlement.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      if (
        settlementCanvas.width !== rect.width ||
        settlementCanvas.height !== rect.height
      ) {
        settlementCanvas.width = rect.width;
        settlementCanvas.height = rect.height;
      }
    }

    worldGenEngine.update(dt);
    worldGenRenderer.render(settlementCanvas, worldGenEngine, dt);
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

    if (settlementCanvas) {
      const rect = viewSettlement.getBoundingClientRect();
      settlementCanvas.width = rect.width;
      settlementCanvas.height = rect.height;

      // Mouse drag logic
      settlementCanvas.addEventListener("mousedown", (e) => {
        isWorldGenDragging = true;
        worldGenLastX = e.clientX;
        worldGenLastY = e.clientY;
      });
      window.addEventListener("mousemove", (e) => {
        if (!isWorldGenDragging || !worldGenEngine || !worldGenRenderer) return;
        const dx = e.clientX - worldGenLastX;
        const dy = e.clientY - worldGenLastY;
        const tilesX =
          dx / (worldGenRenderer.baseTileSize * worldGenRenderer.zoom);
        const tilesY =
          dy / (worldGenRenderer.baseTileSize * worldGenRenderer.zoom);
        worldGenEngine.player.x -= tilesX;
        worldGenEngine.player.y -= tilesY;
        worldGenRenderer.cameraX -= tilesX;
        worldGenRenderer.cameraY -= tilesY;
        worldGenLastX = e.clientX;
        worldGenLastY = e.clientY;
      });
      window.addEventListener("mouseup", () => {
        isWorldGenDragging = false;
      });

      // Touch drag logic
      settlementCanvas.addEventListener("touchstart", (e) => {
        if (e.touches.length > 0) {
          isWorldGenDragging = true;
          worldGenLastX = e.touches[0].clientX;
          worldGenLastY = e.touches[0].clientY;
        }
      });
      window.addEventListener("touchmove", (e) => {
        if (
          !isWorldGenDragging ||
          !worldGenEngine ||
          !worldGenRenderer ||
          e.touches.length === 0
        )
          return;
        const dx = e.touches[0].clientX - worldGenLastX;
        const dy = e.touches[0].clientY - worldGenLastY;
        const tilesX =
          dx / (worldGenRenderer.baseTileSize * worldGenRenderer.zoom);
        const tilesY =
          dy / (worldGenRenderer.baseTileSize * worldGenRenderer.zoom);
        worldGenEngine.player.x -= tilesX;
        worldGenEngine.player.y -= tilesY;
        worldGenRenderer.cameraX -= tilesX;
        worldGenRenderer.cameraY -= tilesY;
        worldGenLastX = e.touches[0].clientX;
        worldGenLastY = e.touches[0].clientY;
      });
      window.addEventListener("touchend", () => {
        isWorldGenDragging = false;
      });
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
  if (!worldGenRenderer) return;
  worldGenRenderer.zoom = currentZoomLevel * 2.2;
}

// Current phase for step-by-step generation (0 = not started, 1-11 = phases)
let currentGenPhase = 0;
const TOTAL_GEN_PHASES = 10;

const PHASE_LABELS: Record<number, string> = {
  0: "Phase 0 — Not Started",
  1: "Phase 1 — Base Terrain (Grass, Roads, Water)",
  2: "Phase 2 — House Placement",
  3: "Phase 3 — Village Infrastructure (Paths, Wells)",
  4: "Phase 4 — Farmland Layout (Tilled Soil, Fences)",
  5: "Phase 5 — Crop Cultivation (Plants on Farmland)",
  6: "Phase 6 — Nature & Scatter (Trees, Bushes)",
  7: "Phase 7 — Validation",
  8: "Phase 8 — Villager Spawning (Roles)",
  9: "Phase 9 — Wildlife Spawning",
  10: "Phase 10 — World Complete & Playable!",
};

function updatePhaseIndicator() {
  const indicator = document.getElementById("phase-indicator-label");
  const nextBtn = document.getElementById(
    "btn-next-phase",
  ) as HTMLButtonElement | null;
  if (indicator) {
    indicator.textContent =
      PHASE_LABELS[currentGenPhase] ?? `Phase ${currentGenPhase}`;
    indicator.style.color =
      currentGenPhase === TOTAL_GEN_PHASES ? "#34d399" : "#fde68a";
  }
  if (nextBtn) {
    nextBtn.disabled = currentGenPhase >= TOTAL_GEN_PHASES;
    nextBtn.style.opacity = currentGenPhase >= TOTAL_GEN_PHASES ? "0.4" : "1";
    nextBtn.querySelector("span:last-child")!.textContent =
      currentGenPhase >= TOTAL_GEN_PHASES
        ? "Complete!"
        : `Next Phase (${currentGenPhase + 1}/${TOTAL_GEN_PHASES})`;
  }
}

async function generateAndRenderSettlement(seed?: number) {
  currentSeed = seed !== undefined ? seed : Math.floor(Math.random() * 1000000);
  currentGenPhase = 0;

  const seedInput = document.getElementById(
    "settlement-seed-input",
  ) as HTMLInputElement;
  if (seedInput) seedInput.value = String(currentSeed);

  updatePhaseIndicator();
  await renderCurrentSettlement();
  startSettlementLoop();
}

async function advanceToNextPhase() {
  if (currentGenPhase >= TOTAL_GEN_PHASES) return;
  currentGenPhase++;

  if (settlementCanvas) {
    worldGenEngine = new SurvivalEngine(currentSeed, true, currentGenPhase);
    worldGenRenderer = new SurvivalRenderer();
    worldGenRenderer.isWorldGenMode = true;
  }

  updatePhaseIndicator();
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

  const btnNextPhase = document.getElementById("btn-next-phase");

  if (btnGenerate) {
    btnGenerate.addEventListener("click", () => {
      generateAndRenderSettlement();
    });
  }

  if (btnNextPhase) {
    btnNextPhase.addEventListener("click", () => {
      advanceToNextPhase();
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

  // Player movement removed from Generator tab

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

      // Detect click if mouse didn't drag (removed player target logic)
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
let networkClient: any = null;
let survivalRenderer: SurvivalRenderer | null = null;
let survivalAnimFrameId: number | null = null;
let lastSurvivalTime = 0;
let lastEntitiesSyncTime = 0;
let isSurvivalTabActive = false;
let isSurvivalInitialized = false;

// HUD Elements
const hudHpVal = document.getElementById("hud-hp-val")!;
const hudHpImg = document.getElementById(
  "hud-hp-img",
) as HTMLImageElement | null;
const hudHungerVal = document.getElementById("hud-hunger-val")!;
const hudHungerImg = document.getElementById(
  "hud-hunger-img",
) as HTMLImageElement | null;
const hudStaminaVal = document.getElementById("hud-stamina-val")!;
const hudStaminaImg = document.getElementById(
  "hud-stamina-img",
) as HTMLImageElement | null;
const hudClockIcon = document.getElementById("hud-clock-icon");
const hudClockTime = document.getElementById("hud-clock-time");
const hudRoomCodeTag = document.getElementById("hud-room-code-tag");
const hudRoomCodeVal = document.getElementById("hud-room-code-val");
const hudClockPhase = document.getElementById("hud-clock-phase");
const hudVillagesCount = document.getElementById("hud-villages-count");
const hudNearestVillage = document.getElementById("hud-nearest-village");
const hotbarSlotsContainer = document.getElementById("hotbar-slots-container")!;
const gameActionPrompt = document.getElementById("game-action-prompt")!;
const questListItems = document.getElementById("quest-list-items")!;
const radarVillageList = document.getElementById("radar-village-list");
const btnToggleObjectives = document.getElementById("btn-toggle-objectives");
const btnCloseObjectives = document.getElementById("btn-close-objectives");
const compactObjectivesPanel = document.getElementById("compact-objectives-panel");
const btnToggleBuild = document.getElementById("btn-toggle-build");
const btnCloseBuild = document.getElementById("btn-close-build");
const compactBuildPanel = document.getElementById("compact-build-panel");
const buildCategoryTabs = document.getElementById("build-category-tabs");
const buildItemsGrid = document.getElementById("build-items-grid");

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

const hudServerStatus = document.getElementById("hud-server-status");
const hudServerDot = document.getElementById("hud-server-dot");
const hudPlayerCount = document.getElementById("hud-player-count");

function setMultiplayerStatus(text: string, players: number) {
  if (hudServerStatus) hudServerStatus.textContent = `Multiplayer: ${text}`;
  if (hudPlayerCount) hudPlayerCount.textContent = ` ${players} Online`;
  if (hudServerDot) hudServerDot.classList.toggle("online", text.startsWith("Connected") || text.startsWith("Online"));
}

function selectHotbarIndex(idx: number) {
  if (!survivalEngine) return;
  survivalEngine.activeHotbarIndex = Math.max(0, Math.min(7, idx));
  const activeItem = survivalEngine.getActiveItemSlot()?.item || null;
  (survivalEngine.player as any).activeHeldItem = activeItem;
  networkClient?.sendAction({
    type: "hotbar",
    index: survivalEngine.activeHotbarIndex,
    item: activeItem,
  });
  renderHotbar();
}

const handledActionIds = new Set<string>();

function handleRemotePlayerAction(action: { sessionId: string; type: string; [key: string]: any }) {
  if (action.actionId) {
    if (handledActionIds.has(action.actionId)) return;
    handledActionIds.add(action.actionId);
    if (handledActionIds.size > 200) {
      const first = handledActionIds.values().next().value;
      if (first) handledActionIds.delete(first);
    }
  }
  if (!survivalEngine) return;
  const rp = survivalEngine.remotePlayers.find((p: any) => p.id === action.sessionId);
  if (rp) {
    if (action.type === "jump") {
      rp.hopTimer = 0.55;
      rp.hopOffset = 0;
    } else if (action.type === "swing") {
      rp.swingDuration = action.duration || 0.25;
      rp.swingTimer = action.duration || 0.25;
      if (action.actionName) rp.activeAction = action.actionName;
      if (action.tool !== undefined) rp.activeHeldItem = action.tool;
      if (action.facing) {
        rp.facing = action.facing;
        rp.direction = action.facing;
      }
      if (action.fishingState) {
        rp.fishingState = action.fishingState;
        rp.fishingTimer = 2.0;
      }
    } else if (action.type === "hotbar") {
      rp.activeHotbarIndex = action.index;
      if (action.item !== undefined) rp.activeHeldItem = action.item;
    } else if (action.type === "roll") {
      rp.rollTimer = 0.4;
    } else if (action.type === "interact") {
      rp.doingTimer = 0.3;
    } else if (action.type === "block") {
      rp.isBlocking = Boolean(action.isBlocking);
    }
  }

  // Universal Synchronized World Actions on Remote Machine
  if (action.type === "hit-player") {
    const localId = networkClient?.clientId;
    if (action.targetId === localId || (survivalEngine.sessionId && action.targetId === survivalEngine.sessionId)) {
      survivalEngine.hitPlayer("local", action.damage, action.attackerX, action.attackerY, true);
      networkClient?.sendAction({
        type: "player-health",
        health: survivalEngine.player.health,
        isDead: survivalEngine.player.isDead,
      });
    } else {
      survivalEngine.hitPlayer(action.targetId, action.damage, action.attackerX, action.attackerY, true);
    }
  } else if (action.type === "hit-animal") {
    survivalEngine.hitAnimal(action.animalId, action.damage, action.attackerX, action.attackerY, true);
  } else if (action.type === "hit-npc") {
    survivalEngine.hitNPC(action.npcId, action.damage, action.attackerX, action.attackerY, true);
  } else if (action.type === "hit-resource") {
    survivalEngine.hitResource(action.x, action.y, action.damage, action.tool, true, action.id);
  } else if (action.type === "hit-enemy") {
    survivalEngine.hitEnemy(action.enemyId, action.damage, action.attackerX, action.attackerY, true);
  } else if (action.type === "hit-structure") {
    survivalEngine.hitStructure(action.x, action.y, action.damage, true);
  } else if (action.type === "place-structure" || action.type === "place") {
    survivalEngine.addPlacedStructure(action.piece, action.x, action.y, true);
  } else if (action.type === "place-3d-block") {
    survivalEngine.place3DBlock(action.material, action.x, action.y, action.z, true);
  } else if (action.type === "hit-3d-block") {
    survivalEngine.hit3DBlock(action.x, action.y, action.z, action.damage, true);
  } else if (action.type === "toggle-door") {
    survivalEngine.toggleDoor(action.x, action.y, true);
  } else if (action.type === "spawn-item") {
    survivalEngine.spawnDroppedItem(action.item, action.count, action.x, action.y, action.id, true);
  } else if (action.type === "pickup-item") {
    survivalEngine.removeDroppedItem(action.id, true);
  }
}

function handleSyncEntities(entities: any) {
  if (!survivalEngine || !entities) return;

  // 0. World Time Sync (Day/Night, Clock & Lighting)
  if (entities.worldTime) {
    Object.assign(survivalEngine.worldTime, entities.worldTime);
  }

  // Fast O(1) animal map indexing
  if (!(survivalEngine as any)._animalMap || (survivalEngine as any)._animalMapVersion !== survivalEngine.animals.length) {
    (survivalEngine as any)._animalMap = new Map(survivalEngine.animals.map((a: any) => [a.id, a]));
    (survivalEngine as any)._animalMapVersion = survivalEngine.animals.length;
  }
  const animalMap: Map<number, any> = (survivalEngine as any)._animalMap;

  if (entities.animals && Array.isArray(entities.animals)) {
    const initAnimals = (survivalEngine as any)._syncedAnimalIds || ((survivalEngine as any)._syncedAnimalIds = new Set<number>());
    for (const sa of entities.animals) {
      if (networkClient) {
        networkClient.interpolator.push(sa.id, sa.x, sa.y, sa.vx || 0, sa.vy || 0);
      }
      const local = animalMap.get(sa.id);
      if (local) {
        const dx = sa.x - local.position.x;
        const dy = sa.y - local.position.y;
        const isFirst = !initAnimals.has(sa.id);
        if (isFirst || Math.hypot(dx, dy) > 2.5) {
          local.position.x = sa.x;
          local.position.y = sa.y;
          initAnimals.add(sa.id);
        }
        (local as any).vx = sa.vx || 0;
        (local as any).vy = sa.vy || 0;
        if (sa.state) local.behaviorState = sa.state;
        if (sa.facing !== undefined) local.anim.flipX = Boolean(sa.facing);
        if (sa.direction) local.direction = sa.direction;
        if (sa.health !== undefined) {
          local.health = sa.health;
          if (local.health <= 0 && local.behaviorState !== "DEAD") {
            local.behaviorState = "DEAD";
          }
        }
      }
    }
  }

  // Fast O(1) NPC map indexing
  if (!(survivalEngine as any)._npcMap || (survivalEngine as any)._npcMapVersion !== survivalEngine.npcs.length) {
    (survivalEngine as any)._npcMap = new Map(survivalEngine.npcs.map((n: any) => [n.id, n]));
    (survivalEngine as any)._npcMapVersion = survivalEngine.npcs.length;
  }
  const npcMap: Map<number, any> = (survivalEngine as any)._npcMap;

  if (entities.npcs && Array.isArray(entities.npcs)) {
    const initNpcs = (survivalEngine as any)._syncedNpcIds || ((survivalEngine as any)._syncedNpcIds = new Set<number>());
    for (const sn of entities.npcs) {
      if (networkClient) {
        networkClient.interpolator.push(sn.id, sn.x, sn.y, sn.vx || 0, sn.vy || 0);
      }
      const local = npcMap.get(sn.id);
      if (local) {
        const dx = sn.x - local.position.x;
        const dy = sn.y - local.position.y;
        const isFirst = !initNpcs.has(sn.id);
        if (isFirst || Math.hypot(dx, dy) > 2.5) {
          local.position.x = sn.x;
          local.position.y = sn.y;
          initNpcs.add(sn.id);
        }
        (local as any).vx = sn.vx || 0;
        (local as any).vy = sn.vy || 0;
        if (sn.state) local.behaviorState = sn.state;
        if (sn.facing !== undefined) local.anim.flipX = Boolean(sn.facing);
        if (sn.direction) local.direction = sn.direction;
      }
    }
  }

  // Hostile Enemies Reconciliation
  if (entities.enemies && Array.isArray(entities.enemies)) {
    for (const se of entities.enemies) {
      if (networkClient) {
        networkClient.interpolator.push(se.id, se.x, se.y, se.vx || 0, se.vy || 0);
      }
      const existing = survivalEngine.enemies.find((e: any) => e.id === se.id);
      if (!existing) {
        survivalEngine.enemies.push({
          id: se.id,
          type: se.type,
          x: se.x,
          y: se.y,
          vx: se.vx || 0,
          vy: se.vy || 0,
          health: se.health,
          maxHealth: se.maxHealth,
          direction: se.direction,
          isDead: se.isDead,
        } as any);
      } else {
        existing.health = se.health;
        existing.isDead = se.isDead;
        existing.direction = se.direction;
      }
    }
  }

  // Depleted resources reconciliation
  if (entities.depletedResources && Array.isArray(entities.depletedResources)) {
    for (const resId of entities.depletedResources) {
      if (!survivalEngine.worldManager.depletedResourceIds.has(resId)) {
        survivalEngine.worldManager.markResourceDepleted(resId);
      }
    }
  }
  // Placed structures reconciliation
  if (entities.placedStructures && Array.isArray(entities.placedStructures)) {
    for (const ps of entities.placedStructures) {
      const existing = survivalEngine.placedStructures.find((s: any) => s.x === ps.x && s.y === ps.y);
      if (!existing) {
        survivalEngine.addPlacedStructure(ps.type, ps.x, ps.y, true);
      } else {
        if (ps.isOpen !== undefined) existing.isOpen = ps.isOpen;
        if (ps.health !== undefined) existing.health = ps.health;
      }
    }
    for (let i = survivalEngine.placedStructures.length - 1; i >= 0; i--) {
      const s = survivalEngine.placedStructures[i];
      if (!entities.placedStructures.some((ps: any) => ps.x === s.x && ps.y === s.y)) {
        survivalEngine.placedStructures.splice(i, 1);
        const tile = survivalEngine.worldManager.getTile(s.x, s.y);
        tile.isBlocked = false;
      }
    }
  }
  // Placed 3D blocks reconciliation
  if (entities.placedBlocks && Array.isArray(entities.placedBlocks)) {
    for (const pb of entities.placedBlocks) {
      const existing = survivalEngine.getBlockAt(pb.x, pb.y, pb.z);
      if (!existing) {
        survivalEngine.place3DBlock(pb.material, pb.x, pb.y, pb.z, true);
      } else if (pb.health !== undefined) {
        existing.health = pb.health;
      }
    }
  }
  // Dropped items reconciliation
  if (entities.droppedItems && Array.isArray(entities.droppedItems)) {
    for (const di of entities.droppedItems) {
      const existing = survivalEngine.droppedItems.find((i: any) => i.id === di.id);
      if (!existing) {
        survivalEngine.droppedItems.push({
          id: di.id,
          item: di.item,
          count: di.count,
          x: di.x,
          y: di.y,
          bobTimer: 0,
        });
      }
    }
    for (let i = survivalEngine.droppedItems.length - 1; i >= 0; i--) {
      const cur = survivalEngine.droppedItems[i];
      if (!entities.droppedItems.some((di: any) => di.id === cur.id)) {
        survivalEngine.droppedItems.splice(i, 1);
      }
    }
  }
}

function applyMultiplayerSnapshot(snapshot: any) {
  if (!survivalEngine || !networkClient) return;
  const localId = networkClient.clientId;
  survivalEngine.sessionId = localId || "";
  const local = snapshot.players.find((player: any) => player.sessionId === localId);
  if (local) {
    networkClient.prediction.reconcile(
      local,
      (x: number, y: number) => (survivalEngine as any).canMoveTo(x, y)
    );
    Object.assign(survivalEngine.player, {
      health: local.health, hunger: local.hunger, stamina: local.stamina,
      isSprinting: local.isSprinting, direction: local.direction, facing: local.facing,
    });
  }
  survivalEngine.remotePlayers = snapshot.players.filter((player: any) => player.sessionId !== localId).map((player: any) => {
    const old = survivalEngine!.remotePlayers.find((item: any) => item.id === player.sessionId);
    const merged = { ...old, ...player, id: player.sessionId };
    if (old && Number.isFinite(old.x) && Number.isFinite(old.y)) {
      if (Math.hypot(player.x - old.x, player.y - old.y) > 4.0) {
        merged.x = player.x;
        merged.y = player.y;
      } else {
        merged.x = old.x;
        merged.y = old.y;
      }
    } else {
      merged.x = player.x;
      merged.y = player.y;
    }
    if (old && old.hopTimer > 0 && (!player.hopTimer || player.hopTimer <= 0)) {
      merged.hopTimer = old.hopTimer;
      merged.hopOffset = old.hopOffset;
    }
    if (old && old.swingTimer > 0 && (!player.swingTimer || player.swingTimer <= 0)) {
      merged.swingTimer = old.swingTimer;
    }
    if (old && old.hurtTimer > 0 && (!player.hurtTimer || player.hurtTimer <= 0)) {
      merged.hurtTimer = old.hurtTimer;
    }
    if (old && old.isBlocking !== undefined && player.isBlocking === undefined) {
      merged.isBlocking = old.isBlocking;
    }
    if (old && old.activeHeldItem && !player.activeHeldItem) {
      merged.activeHeldItem = old.activeHeldItem;
    }
    return merged;
  });
  if (snapshot.entities && !networkClient.isHost) {
    handleSyncEntities(snapshot.entities);
  }
}

function joinMultiplayerWorld(snapshot: any) {
  document.getElementById("main-menu")?.classList.add("hidden");
  ensureSurvivalGameLoaded();
  // Each client creates the same deterministic map from the server's shared seed.
  survivalEngine = new SurvivalEngine(snapshot.seed);
  (survivalEngine as any).renderer = survivalRenderer;
  (window as any).survivalRenderer = survivalRenderer;
  survivalEngine.sessionId = networkClient?.clientId || "";
  (survivalEngine as any).roomCode = snapshot.roomCode;
  (window as any).survivalEngine = survivalEngine;
  (window as any).gameEngine = survivalEngine;
  survivalEngine.onWorldAction = (action: any) => {
    networkClient?.sendAction(action);
  };
  const slot0 = survivalEngine.getActiveItemSlot();
  (survivalEngine.player as any).activeHeldItem = slot0?.item || "wooden_axe";
  applyMultiplayerSnapshot(snapshot);
  survivalRenderer?.snapCameraTo(survivalEngine.player.x, survivalEngine.player.y);
  setMultiplayerStatus(`Online · invite code ${snapshot.roomCode}`, snapshot.players.length);
  if (hudRoomCodeVal && hudRoomCodeTag) {
    hudRoomCodeVal.textContent = snapshot.roomCode;
    hudRoomCodeTag.classList.remove("hidden");
  }
}

function ensureSurvivalGameLoaded() {
  if (!isSurvivalInitialized) {
    survivalEngine = new SurvivalEngine(currentSeed);
    (window as any).survivalEngine = survivalEngine;
    (window as any).gameEngine = survivalEngine;
    survivalEngine.onWorldAction = (action: any) => {
      networkClient?.sendAction(action);
    };
    survivalRenderer = new SurvivalRenderer();
    (survivalEngine as any).renderer = survivalRenderer;
    (window as any).survivalRenderer = survivalRenderer;
    initSurvivalInputs();
    initSurvivalUI();
    resizeSurvivalCanvas();

    const slot0 = survivalEngine.getActiveItemSlot();
    (survivalEngine.player as any).activeHeldItem = slot0?.item || "wooden_axe";

    isSurvivalInitialized = true;
  }
  if (!networkClient) {
    networkClient = new NetworkClient({
      onSnapshot: applyMultiplayerSnapshot,
      onJoined: joinMultiplayerWorld,
      onStatus: setMultiplayerStatus,
      onAction: handleRemotePlayerAction,
      onSyncEntities: handleSyncEntities,
    });
    (window as any).networkClient = networkClient;
    setMultiplayerStatus("Single player", 1);
  }
}

export function startSurvivalGameLoop() {
  isSurvivalTabActive = true;
  resizeSurvivalCanvas();
  if (!survivalAnimFrameId) {
    lastSurvivalTime = performance.now();
    if (document.hidden) {
    survivalAnimFrameId = setTimeout(() => survivalGameLoop(performance.now()), 50) as any;
  } else {
    survivalAnimFrameId = requestAnimationFrame(survivalGameLoop);
  }
  }
}

export function stopSurvivalGameLoop() {
  isSurvivalTabActive = false;
  if (survivalAnimFrameId) {
    cancelAnimationFrame(survivalAnimFrameId as number);
    clearTimeout(survivalAnimFrameId as any);
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

      // 1b. World Time Advancement (Clock & Day/Night Cycle)
      survivalEngine.updateWorldTime(dt);

      // 1c. Dropped Items Magnet & Pickup
      survivalEngine.updateDroppedItems(dt);

      // 2. Client updates local cosmetic timers, particles, and smooth prediction
      (survivalEngine as any).updateParticles(dt);
      (survivalEngine as any).updateFloraReactions?.(dt);
      (survivalEngine as any).updateAmbientBirds?.(dt);
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

      // Smoothly update remote players cosmetic action/hop/swing timers locally at 60 FPS
      for (const rp of survivalEngine.remotePlayers) {
        if (rp.swingTimer > 0) rp.swingTimer -= dt;
        if (rp.hopTimer > 0) {
          rp.hopTimer -= dt;
          const progress = Math.max(0, Math.min(1, 1 - rp.hopTimer / 0.55));
          rp.hopOffset = Math.sin(progress * Math.PI) * 0.55;
        } else {
          rp.hopOffset = 0;
        }
        if (rp.hurtTimer > 0) rp.hurtTimer -= dt;
        if (rp.rollTimer > 0) rp.rollTimer -= dt;
        if (rp.doingTimer > 0) rp.doingTimer -= dt;
      }

      // If this client is the HOST, run lifeform simulation and broadcast to peers
      if (networkClient?.isHost) {
        survivalEngine.updateLifeforms(dt);
        survivalEngine.updateEnemies(dt);
        (survivalEngine as any).updateStructureEconomy?.(dt);

        const getVelocity = (entity: any) => {
          let vx = 0;
          let vy = 0;
          if (entity.movement?.isMoving && entity.movement.targetX !== null && entity.movement.targetY !== null) {
            const dx = entity.movement.targetX - entity.position.x;
            const dy = entity.movement.targetY - entity.position.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 0.05) {
              vx = (dx / dist) * entity.movement.speed;
              vy = (dy / dist) * entity.movement.speed;
            }
          }
          return { vx, vy };
        };

        const activePlayerPositions = [
          { x: survivalEngine.player.x, y: survivalEngine.player.y },
          ...survivalEngine.remotePlayers.map((rp: any) => ({ x: rp.x, y: rp.y })),
        ];
        const isNearAnyPlayer = (x: number, y: number, radius = 96) => {
          return activePlayerPositions.some((p) => Math.hypot(p.x - x, p.y - y) <= radius);
        };

        if (now - lastEntitiesSyncTime >= 50) {
          lastEntitiesSyncTime = now;
          networkClient.sendEntitiesSync({
            worldTime: {
              totalSeconds: survivalEngine.worldTime.totalSeconds,
              hour: survivalEngine.worldTime.hour,
              minute: survivalEngine.worldTime.minute,
              dayNumber: survivalEngine.worldTime.dayNumber,
              timeOfDay: survivalEngine.worldTime.timeOfDay,
              lightLevel: survivalEngine.worldTime.lightLevel,
            },
            animals: survivalEngine.animals
              .filter((a: any) => isNearAnyPlayer(a.position.x, a.position.y))
              .map((a: any) => {
                const v = getVelocity(a);
                return {
                  id: a.id,
                  x: a.position.x,
                  y: a.position.y,
                  vx: v.vx,
                  vy: v.vy,
                  state: a.behaviorState,
                  direction: a.direction,
                  facing: a.anim.flipX,
                  health: a.health,
                };
              }),
            npcs: survivalEngine.npcs
              .filter((n: any) => isNearAnyPlayer(n.position.x, n.position.y))
              .map((n: any) => {
                const v = getVelocity(n);
                return {
                  id: n.id,
                  x: n.position.x,
                  y: n.position.y,
                  vx: v.vx,
                  vy: v.vy,
                  state: n.behaviorState,
                  facing: n.anim.flipX,
                  direction: n.direction,
                };
              }),
            enemies: survivalEngine.enemies.map((e: any) => ({
              id: e.id,
              type: e.type,
              x: e.x,
              y: e.y,
              vx: e.vx || 0,
              vy: e.vy || 0,
              health: e.health,
              maxHealth: e.maxHealth,
              direction: e.direction,
              isDead: e.isDead,
            })),
            depletedResources: [...survivalEngine.worldManager.depletedResourceIds],
            placedStructures: survivalEngine.placedStructures.map((s: any) => ({
              id: s.id,
              type: s.type,
              x: s.x,
              y: s.y,
              isOpen: s.isOpen,
              health: s.health,
              maxHealth: s.maxHealth,
            })),
            droppedItems: survivalEngine.droppedItems.map((d: any) => ({
              id: d.id,
              item: d.item,
              count: d.count,
              x: d.x,
              y: d.y,
            })),
          });
        }
      }

      // 3. Smooth Entity Interpolation at 60 FPS (Phase 6 of authoritative_server.txt)
      if (networkClient) {
        if (!networkClient.isHost) {
          const gx = survivalEngine.player.x;
          const gy = survivalEngine.player.y;
          // Wildlife animals (Guest glides smoothly at 60 FPS based on host authoritative positions & velocities)
          for (const a of survivalEngine.animals) {
            if (Math.hypot(a.position.x - gx, a.position.y - gy) > 96) continue;
            const res = networkClient.interpolator.getInterpolatedEntity(
              a.id,
              a.position.x,
              a.position.y,
              dt,
            );
            a.position.x = res.x;
            a.position.y = res.y;
            (a as any).movement.isMoving = res.isMoving;
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
          // Village NPCs (Guest glides smoothly at 60 FPS based on host authoritative positions & velocities)
          for (const n of survivalEngine.npcs) {
            if (Math.hypot(n.position.x - gx, n.position.y - gy) > 96) continue;
            const res = networkClient.interpolator.getInterpolatedEntity(
              n.id,
              n.position.x,
              n.position.y,
              dt,
            );
            n.position.x = res.x;
            n.position.y = res.y;
            (n as any).movement.isMoving = res.isMoving;
            if (res.isMoving) {
              n.anim.action = "WALK";
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
              n.anim.action = "IDLE";
              n.anim.currentFrame = 0;
              n.anim.frameTimer = 0;
            }
          }
        }
        // Hostile enemies
        for (const e of survivalEngine.enemies) {
          const res = networkClient.interpolator.getInterpolatedEntity(
            e.id,
            e.x,
            e.y,
            dt,
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
        // Remote multiplayer players (Smooth 60 FPS movement and continuous walk animation)
        for (const rp of survivalEngine.remotePlayers) {
          const res = networkClient.interpolator.getInterpolatedEntity(
            rp.id,
            rp.x,
            rp.y,
            dt,
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

  if (document.hidden) {
    survivalAnimFrameId = setTimeout(() => survivalGameLoop(performance.now()), 50) as any;
  } else {
    survivalAnimFrameId = requestAnimationFrame(survivalGameLoop);
  }
}

function updateSurvivalHUD() {
  if (!survivalEngine) return;

  const p = survivalEngine.player;
  const wt = survivalEngine.worldTime;

  // Meters (Pixel Art Sprite Bars) - Compact & Correctly Filled
  hudHpVal.textContent = `${Math.ceil(p.health)}`;
  const hpRatio = Math.max(0, Math.min(1, p.health / p.maxHealth));
  let hpFrame = Math.round(hpRatio * 6);
  if (p.health > 0 && hpFrame === 0) hpFrame = 1;
  if (p.health < p.maxHealth && hpFrame === 6) hpFrame = 5;
  if (hudHpImg) hudHpImg.src = `/assets/ui/redbar_0${hpFrame}.png`;
  const hpFill = document.getElementById("hud-hp-fill");
  if (hpFill) hpFill.style.width = `${Math.round(hpRatio * 100)}%`;

  hudHungerVal.textContent = `${Math.ceil(p.hunger)}`;
  const hungerRatio = Math.max(0, Math.min(1, p.hunger / p.maxHunger));
  let hungerFrame = Math.round(hungerRatio * 6);
  if (p.hunger > 0 && hungerFrame === 0) hungerFrame = 1;
  if (p.hunger < p.maxHunger && hungerFrame === 6) hungerFrame = 5;
  if (hudHungerImg) hudHungerImg.src = `/assets/ui/greenbar_0${hungerFrame}.png`;
  const hungerFill = document.getElementById("hud-hunger-fill");
  if (hungerFill) hungerFill.style.width = `${Math.round(hungerRatio * 100)}%`;

  hudStaminaVal.textContent = `${Math.ceil(p.stamina)}`;
  const staminaRatio = Math.max(0, Math.min(1, p.stamina / p.maxStamina));
  let staminaFrame = Math.round(staminaRatio * 5);
  if (p.stamina > 0 && staminaFrame === 0) staminaFrame = 1;
  if (p.stamina < p.maxStamina && staminaFrame === 5) staminaFrame = 4;
  if (hudStaminaImg) hudStaminaImg.src = `/assets/ui/bluebar_0${staminaFrame}.png`;
  const staminaFill = document.getElementById("hud-stamina-fill");
  if (staminaFill) staminaFill.style.width = `${Math.round(staminaRatio * 100)}%`;

  // World Clock (Translucent Time with AM/PM)
  const minPad = String(wt.minute).padStart(2, "0");
  const isPM = wt.hour >= 12;
  const displayHour = wt.hour % 12 === 0 ? 12 : wt.hour % 12;
  if (hudClockTime) {
    hudClockTime.textContent = `${String(displayHour).padStart(2, "0")}:${minPad} ${isPM ? "PM" : "AM"}`;
  }
  const currentRoomCode = (survivalEngine as any)?.roomCode || (networkClient as any)?.roomCode;
  if (hudRoomCodeVal && hudRoomCodeTag) {
    if (currentRoomCode) {
      hudRoomCodeVal.textContent = currentRoomCode;
      hudRoomCodeTag.classList.remove("hidden");
    } else {
      hudRoomCodeTag.classList.add("hidden");
    }
  }
  if (hudClockPhase) {
    hudClockPhase.textContent = `Day ${wt.dayNumber} • ${wt.timeOfDay}`;
  }

  // Discovered Villages
  if (hudVillagesCount) {
    const totalDiscovered = survivalEngine.worldManager.villages.filter(
      (v) => v.discovered,
    ).length;
    hudVillagesCount.textContent = `${totalDiscovered}/4`;
  }

  if (hudNearestVillage) {
    const nearest = survivalEngine.worldManager.getNearestVillage(p.x, p.y);
    if (nearest) {
      const distMeters = Math.round(nearest.dist);
      hudNearestVillage.textContent =
        distMeters < 25
          ? `In: ${nearest.village.name}`
          : `Nearest: ${nearest.village.name} (~${distMeters}m)`;
    }
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
  if (!def)
    return `<img src="/assets/ui/basket.png" class="slot-pixel-icon" alt="Item" />`;
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
      selectHotbarIndex(idx);
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
 * Renders the Rectangular Minimap showing surrounding terrain, water bodies,
 * marked houses, local player, and colored dots for any other players clamped to boundary.
 */
/**
 * Renders the Rectangular Realm Minimap as a downgraded pixel-perfect version of the same world.
 * Everything in the physical world (terrain, water bodies, elevation cliffs, shores, roads,
 * bridges, farmland soil, village houses/structures, fences, and player-built structures) is visible.
 * Flora (trees/bushes/flowers), fauna (wildlife/animals), and people (NPCs/villagers/enemies) are
 * excluded to maintain a crisp, clean architectural and geographic cartographic view.
 * Other players are marked with colored dots clamped to the boundary when off-screen.
 */
function renderRadarMiniMap() {
  if (!survivalEngine || !radarCanvas) return;
  const ctx = radarCanvas.getContext("2d");
  if (!ctx) return;

  const w = radarCanvas.width;
  const h = radarCanvas.height;
  const p = survivalEngine.player;

  ctx.clearRect(0, 0, w, h);

  // Minimap pixel scale: 2.0 px per tile
  const scale = 2.0;
  const rangeTilesX = Math.ceil(w / (2 * scale)) + 2;
  const rangeTilesY = Math.ceil(h / (2 * scale)) + 2;

  const startTileX = Math.floor(p.x - rangeTilesX);
  const endTileX = Math.ceil(p.x + rangeTilesX);
  const startTileY = Math.floor(p.y - rangeTilesY);
  const endTileY = Math.ceil(p.y + rangeTilesY);

  const wm = survivalEngine.worldManager;

  // 1. Draw Ground Terrain & Elevation (Exact match to world palette and autotiling contours)
  for (let ty = startTileY; ty <= endTileY; ty++) {
    for (let tx = startTileX; tx <= endTileX; tx++) {
      const tile = wm.getTile(tx, ty);
      const screenX = Math.round((tx - p.x) * scale + w / 2);
      const screenY = Math.round((ty - p.y) * scale + h / 2);
      const nextScreenX = Math.round(((tx + 1) - p.x) * scale + w / 2);
      const nextScreenY = Math.round(((ty + 1) - p.y) * scale + h / 2);
      const tileW = Math.max(1, nextScreenX - screenX);
      const tileH = Math.max(1, nextScreenY - screenY);

      if (tile.isWater || tile.terrain === "water_tile_01") {
        // Check if shoreline water tile (borders land)
        const nTile = wm.getTile(tx, ty - 1);
        const sTile = wm.getTile(tx, ty + 1);
        const wTile = wm.getTile(tx - 1, ty);
        const eTile = wm.getTile(tx + 1, ty);
        const isShore = (!nTile.isWater && !nTile.isBridge) ||
                        (!sTile.isWater && !sTile.isBridge) ||
                        (!wTile.isWater && !wTile.isBridge) ||
                        (!eTile.isWater && !eTile.isBridge);

        if (tile.isDeepOcean) {
          ctx.fillStyle = "#0284c7";
          ctx.fillRect(screenX, screenY, tileW, tileH);
        } else if (isShore) {
          // Shoreline shallow water with foam edge
          ctx.fillStyle = "#38bdf8";
          ctx.fillRect(screenX, screenY, tileW, tileH);
          ctx.fillStyle = "#bae6fd";
          if (!nTile.isWater) ctx.fillRect(screenX, screenY, tileW, 1);
          if (!sTile.isWater) ctx.fillRect(screenX, screenY + tileH - 1, tileW, 1);
          if (!wTile.isWater) ctx.fillRect(screenX, screenY, 1, tileH);
          if (!eTile.isWater) ctx.fillRect(screenX + tileW - 1, screenY, 1, tileH);
        } else {
          ctx.fillStyle = "#0ea5e9";
          ctx.fillRect(screenX, screenY, tileW, tileH);
        }
      } else if (tile.isBridge || tile.terrain?.startsWith("bridge_")) {
        // Wooden Bridge spanning water
        ctx.fillStyle = "#a16207";
        ctx.fillRect(screenX, screenY, tileW, tileH);
        ctx.fillStyle = "#713f12";
        ctx.fillRect(screenX, screenY, 1, tileH);
        ctx.fillRect(screenX + tileW - 1, screenY, 1, tileH);
      } else if (tile.isRoad) {
        // Cobblestone & Dirt Village Roads
        ctx.fillStyle = "#d97706";
        ctx.fillRect(screenX, screenY, tileW, tileH);
        const hash = Math.abs((tx * 19 + ty * 37) % 3);
        if (hash === 0) {
          ctx.fillStyle = "#b45309";
          ctx.fillRect(screenX, screenY, 1, 1);
        }
      } else if (tile.isFarm) {
        // Farmland Tilled Soil
        ctx.fillStyle = "#78350f";
        ctx.fillRect(screenX, screenY, tileW, tileH);
        ctx.fillStyle = "#59270b";
        ctx.fillRect(screenX, screenY + Math.floor(tileH / 2), tileW, 1);
      } else if (tile.terrain?.includes("sand") || tile.isIslandShore) {
        // Beach Sand
        ctx.fillStyle = "#fde047";
        ctx.fillRect(screenX, screenY, tileW, tileH);
        const sHash = Math.abs((tx * 23 + ty * 41) % 4);
        if (sHash === 0) {
          ctx.fillStyle = "#eab308";
          ctx.fillRect(screenX, screenY, 1, 1);
        }
      } else if (tile.isBlocked && !tile.isWater && !tile.isRoad) {
        // Stone Elevation / Cliff face
        ctx.fillStyle = "#57534e";
        ctx.fillRect(screenX, screenY, tileW, tileH);
        ctx.fillStyle = "#78716c";
        ctx.fillRect(screenX, screenY, tileW, 1);
      } else {
        // Natural Grass with authentic organic scatter matching the world
        const gHash = Math.abs((tx * 31 + ty * 17) % 6);
        if (tile.terrain === "grass_jungle_01") {
          ctx.fillStyle = gHash === 0 ? "#4d7c0f" : "#3f6212";
        } else if (tile.terrain === "grass_forest_01") {
          ctx.fillStyle = gHash === 0 ? "#365314" : "#486e2d";
        } else {
          ctx.fillStyle = gHash === 0 ? "#5e943a" : gHash === 1 ? "#4d7c2f" : "#568735";
        }
        ctx.fillRect(screenX, screenY, tileW, tileH);
      }
    }
  }

  // 2. Village Houses & Buildings (Downgraded authentic architectural roofs, walls, chimneys, doorways)
  if (wm.villages) {
    for (const v of wm.villages) {
      if (!v.data?.houses) continue;
      for (const house of v.data.houses) {
        const hWorldX = v.gridX + house.x;
        const hWorldY = v.gridY + house.y;
        const hW = house.footprintW || 8;
        const hH = house.footprintH || 8;

        const hsx = Math.round((hWorldX - p.x) * scale + w / 2);
        const hsy = Math.round((hWorldY - p.y) * scale + h / 2);
        const hsw = Math.round(hW * scale);
        const hsh = Math.round(hH * scale);

        // Skip if outside minimap viewport
        if (hsx + hsw < -5 || hsx > w + 5 || hsy + hsh < -5 || hsy > h + 5) continue;

        // Ground wall shadow
        ctx.fillStyle = "rgba(15, 23, 42, 0.4)";
        ctx.fillRect(hsx + 1, hsy + hsh - 1, hsw, 2);

        // Plaster & stone foundation wall
        ctx.fillStyle = "#fef3c7";
        ctx.fillRect(hsx, hsy + Math.floor(hsh * 0.35), hsw, Math.ceil(hsh * 0.65));

        // Stone corner accents
        ctx.fillStyle = "#94a3b8";
        ctx.fillRect(hsx, hsy + Math.floor(hsh * 0.35), 1, Math.ceil(hsh * 0.65));
        ctx.fillRect(hsx + hsw - 1, hsy + Math.floor(hsh * 0.35), 1, Math.ceil(hsh * 0.65));

        // Terracotta / Wood Roof Body
        ctx.fillStyle = "#dc2626";
        ctx.fillRect(hsx, hsy, hsw, Math.floor(hsh * 0.68));

        // Roof ridge apex highlight
        ctx.fillStyle = "#f87171";
        ctx.fillRect(hsx + 1, hsy, Math.max(1, hsw - 2), 1);

        // Roof eaves shadow line
        ctx.fillStyle = "#991b1b";
        ctx.fillRect(hsx, hsy + Math.floor(hsh * 0.68) - 1, hsw, 1);

        // Stone chimney on roof
        ctx.fillStyle = "#334155";
        ctx.fillRect(hsx + Math.max(2, hsw - 3), hsy - 1, 2, 2);

        // Front Door notch at bottom
        ctx.fillStyle = "#451a03";
        const doorW = Math.max(1, Math.floor(scale));
        ctx.fillRect(hsx + Math.floor(hsw / 2) - Math.floor(doorW / 2), hsy + hsh - 2, doorW, 2);
      }
    }
  }

  // 3. Player Placed Structures (Walls, Doors, Chests, Campfires)
  if (survivalEngine.placedStructures) {
    for (const struct of survivalEngine.placedStructures) {
      const ssx = Math.round((struct.x - p.x) * scale + w / 2);
      const ssy = Math.round((struct.y - p.y) * scale + h / 2);
      const ssw = Math.max(2, Math.round(scale));
      const ssh = Math.max(2, Math.round(scale));

      if (ssx + ssw < 0 || ssx > w || ssy + ssh < 0 || ssy > h) continue;

      if (struct.type === "wood_wall") {
        ctx.fillStyle = "#a16207";
        ctx.fillRect(ssx, ssy, ssw, ssh);
        ctx.fillStyle = "#713f12";
        ctx.strokeRect(ssx + 0.5, ssy + 0.5, ssw - 1, ssh - 1);
      } else if (struct.type === "stone_wall") {
        ctx.fillStyle = "#64748b";
        ctx.fillRect(ssx, ssy, ssw, ssh);
        ctx.fillStyle = "#334155";
        ctx.strokeRect(ssx + 0.5, ssy + 0.5, ssw - 1, ssh - 1);
      } else if (struct.type === "wall_window") {
        ctx.fillStyle = "#38bdf8";
        ctx.fillRect(ssx, ssy, ssw, ssh);
        ctx.fillStyle = "#0284c7";
        ctx.strokeRect(ssx + 0.5, ssy + 0.5, ssw - 1, ssh - 1);
      } else if (struct.type === "roof_wood") {
        ctx.fillStyle = "#92400e";
        ctx.fillRect(ssx, ssy, ssw, ssh);
      } else if (struct.type === "roof_terracotta") {
        ctx.fillStyle = "#dc2626";
        ctx.fillRect(ssx, ssy, ssw, ssh);
      } else if (struct.type === "wood_floor") {
        ctx.fillStyle = "#b45309";
        ctx.fillRect(ssx, ssy, ssw, ssh);
      } else if (struct.type === "stone_floor") {
        ctx.fillStyle = "#94a3b8";
        ctx.fillRect(ssx, ssy, ssw, ssh);
      } else if (struct.type === "farm_soil") {
        ctx.fillStyle = "#78350f";
        ctx.fillRect(ssx, ssy, ssw, ssh);
      } else if (struct.type === "farm_fence") {
        ctx.fillStyle = "#a16207";
        ctx.fillRect(ssx, ssy, ssw, ssh);
      } else if (struct.type === "wood_door" || struct.type === "farm_gate") {
        ctx.fillStyle = struct.isOpen ? "#22c55e" : "#b45309";
        ctx.fillRect(ssx, ssy, ssw, ssh);
      } else if (struct.type === "wood_bridge") {
        ctx.fillStyle = "#d97706";
        ctx.fillRect(ssx, ssy, ssw, ssh);
      } else if (struct.type === "water_well") {
        ctx.fillStyle = "#0284c7";
        ctx.fillRect(ssx, ssy, ssw, ssh);
      } else if (struct.type === "bed") {
        ctx.fillStyle = "#ef4444";
        ctx.fillRect(ssx, ssy, ssw, ssh);
      } else if (struct.type === "chest") {
        ctx.fillStyle = "#f59e0b";
        ctx.fillRect(ssx, ssy, ssw, ssh);
        ctx.fillStyle = "#78350f";
        ctx.fillRect(ssx, ssy + Math.floor(ssh / 2), ssw, 1);
      } else if (struct.type === "campfire" || struct.type === "stone_oven") {
        ctx.fillStyle = "#ea580c";
        ctx.fillRect(ssx, ssy, ssw, ssh);
        ctx.fillStyle = "#fde047";
        ctx.fillRect(ssx + 1, ssy + 1, Math.max(1, ssw - 2), Math.max(1, ssh - 2));
      } else {
        ctx.fillStyle = "#d97706";
        ctx.fillRect(ssx, ssy, ssw, ssh);
      }
    }
  }

  // 3.5 Player Placed 3D Volumetric Blocks (with elevation brightness shading)
  if (survivalEngine.placedBlocks) {
    for (const block of survivalEngine.placedBlocks) {
      const bsx = Math.round((block.x - p.x) * scale + w / 2);
      const bsy = Math.round((block.y - p.y) * scale + h / 2);
      const bsw = Math.max(2, Math.round(scale));
      const bsh = Math.max(2, Math.round(scale));

      if (bsx + bsw < 0 || bsx > w || bsy + bsh < 0 || bsy > h) continue;

      let baseColor = "#78716c"; // stone
      if (block.material === "block_wood") baseColor = "#a16207";
      else if (block.material === "block_dirt") baseColor = "#568735";
      else if (block.material === "block_brick") baseColor = "#b91c1c";
      else if (block.material === "block_sandstone") baseColor = "#ca8a04";
      else if (block.material === "block_glass") baseColor = "#38bdf8";

      // Elevation brightness tint (+18% brightness per tier)
      if (block.z === 1) {
        if (block.material === "block_stone") baseColor = "#94a3b8";
        else if (block.material === "block_wood") baseColor = "#b45309";
        else if (block.material === "block_dirt") baseColor = "#65a30d";
        else if (block.material === "block_brick") baseColor = "#dc2626";
        else if (block.material === "block_sandstone") baseColor = "#eab308";
        else if (block.material === "block_glass") baseColor = "#7dd3fc";
      } else if (block.z >= 2) {
        if (block.material === "block_stone") baseColor = "#cbd5e1";
        else if (block.material === "block_wood") baseColor = "#d97706";
        else if (block.material === "block_dirt") baseColor = "#84cc16";
        else if (block.material === "block_brick") baseColor = "#ef4444";
        else if (block.material === "block_sandstone") baseColor = "#fde047";
        else if (block.material === "block_glass") baseColor = "#bae6fd";
      }

      ctx.fillStyle = baseColor;
      ctx.fillRect(bsx, bsy, bsw, bsh);

      // 3D South edge relief shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.fillRect(bsx, bsy + bsh - 1, bsw, 1);
    }
  }

  // NOTE: Flora (trees, bushes, flowers), fauna (wildlife), and people (NPCs, enemies)
  // are deliberately EXCLUDED from the minimap per requirements.

  // 4. Remote Players (Colored Dots) - Clamped to Boundary when out of view
  const pad = 6;
  if (survivalEngine.remotePlayers && Array.isArray(survivalEngine.remotePlayers)) {
    survivalEngine.remotePlayers.forEach((rp: any) => {
      const rawX = (rp.x - p.x) * scale + w / 2;
      const rawY = (rp.y - p.y) * scale + h / 2;

      const isOutside =
        rawX < pad || rawX > w - pad || rawY < pad || rawY > h - pad;

      // When the player gets out of the minimap section, they remain stuck to the boundary!
      const dotX = Math.max(pad, Math.min(w - pad, rawX));
      const dotY = Math.max(pad, Math.min(h - pad, rawY));

      const dotColor = rp.color || "#a855f7"; // Vibrant purple / magenta player marker

      // Draw colored dot
      ctx.beginPath();
      ctx.arc(dotX, dotY, isOutside ? 4.5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = dotColor;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // If stuck to the boundary, draw a directional indicator pointing outward
      if (isOutside) {
        const angle = Math.atan2(rawY - h / 2, rawX - w / 2);
        ctx.beginPath();
        ctx.arc(
          dotX + Math.cos(angle) * 3,
          dotY + Math.sin(angle) * 3,
          1.8,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      }
    });
  }

  // 5. Local Player Marker at Center
  const localX = w / 2;
  const localY = h / 2;

  // Local player pulsing halo
  ctx.beginPath();
  ctx.arc(localX, localY, 4, 0, Math.PI * 2);
  ctx.fillStyle = "#facc15"; // Bright yellow dot
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Subtle player heading line
  const facing = survivalEngine.player.facing;
  let hx = facing === "LEFT" ? -6 : 6;
  let hy = 0;
  if (p.vy < -0.1) hy = -6;
  else if (p.vy > 0.1) hy = 6;

  ctx.beginPath();
  ctx.moveTo(localX, localY);
  ctx.lineTo(localX + hx, localY + hy);
  ctx.strokeStyle = "#facc15";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Subtle inner vignette border
  ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
}

const activeSurvivalKeys = new Set<string>();
(window as any).activeSurvivalKeys = activeSurvivalKeys;

export function triggerPlayerRoll() {
  if (!survivalEngine || survivalEngine.player.isDead) return;
  survivalEngine.player.rollTimer = 0.4;
  survivalEngine.jump();
  networkClient?.sendAction({ type: "roll", facing: survivalEngine.player.facing });
}

export function triggerPlayerInteract() {
  if (!survivalEngine || survivalEngine.player.isDead) return;
  survivalEngine.handleInteractKey();
  networkClient?.sendAction({ type: "interact", action: "interact" });
}

export function triggerPlayerAction(targetX?: number, targetY?: number) {
  if (!survivalEngine || !survivalRenderer || survivalEngine.player.isDead) return;
  const p = survivalEngine.player;
  const wx = targetX !== undefined ? targetX : (p.facing === "LEFT" ? p.x - 1 : p.x + 1);
  const wy = targetY !== undefined ? targetY : p.y;
  executePlayerWorldAction(wx, wy);
}

export function executePlayerWorldAction(worldX: number, worldY: number) {
  if (!survivalEngine || !survivalRenderer || survivalEngine.player.isDead) return;
  const activeItem = survivalEngine.getActiveItemSlot()?.item || null;
  const is3DBlockPiece =
    (survivalEngine.isBuildMode &&
      survivalEngine.buildPiece?.startsWith("block_")) ||
    (activeItem && activeItem.startsWith("block_"));

  if (is3DBlockPiece) {
    const material = (survivalEngine.buildPiece &&
    survivalEngine.buildPiece.startsWith("block_")
      ? survivalEngine.buildPiece
      : activeItem) as BlockMaterial;
    const targetX = Math.round(worldX);
    const targetY = Math.round(worldY);
    const topBlock = survivalEngine.getTopBlock(targetX, targetY);
    const targetZ = topBlock ? topBlock.z + 1 : 0;

    const placed = survivalEngine.place3DBlock(
      material,
      targetX,
      targetY,
      targetZ,
      false,
    );
    if (placed) {
      renderHotbar();
      const duration = 0.25;
      (survivalEngine.player as any).swingDuration = duration;
      survivalEngine.player.swingTimer = duration;
      networkClient?.sendAction({
        type: "swing",
        tool: material,
        actionName: "HAMMERING",
        facing: survivalEngine.player.facing,
        targetX,
        targetY,
        duration,
      });
    }
  } else if (survivalEngine.isBuildMode && survivalEngine.buildPiece) {
    survivalEngine.placeStructure(
      survivalEngine.buildPiece,
      worldX,
      worldY,
    );
    networkClient?.sendAction({
      type: "place",
      piece: survivalEngine.buildPiece,
      x: worldX,
      y: worldY,
    });
  } else {
    survivalEngine.handleWorldClick(worldX, worldY);
    let actionName = "ATTACK";
    let duration = 0.25;
    if (activeItem) {
      if (activeItem.includes("pickaxe")) {
        actionName = "MINING";
      } else if (activeItem.includes("axe")) {
        actionName = "AXE";
      } else if (activeItem.includes("shovel") || activeItem.includes("hoe")) {
        actionName = "DIG";
        duration = 0.35;
      } else if (activeItem.includes("water")) {
        actionName = "WATERING";
        duration = 0.35;
      } else if (activeItem.includes("hammer")) {
        actionName = "HAMMERING";
        duration = 0.35;
      } else if (activeItem.includes("rod")) {
        actionName = "CASTING";
        duration = 0.35;
      }
    }
    (survivalEngine.player as any).swingDuration = duration;
    survivalEngine.player.swingTimer = duration;
    networkClient?.sendAction({
      type: "swing",
      tool: activeItem,
      actionName,
      facing: survivalEngine.player.facing,
      targetX: worldX,
      targetY: worldY,
      duration,
      fishingState:
        survivalEngine.player.fishingState !== "NONE"
          ? survivalEngine.player.fishingState
          : undefined,
    });
  }
}

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

  if (networkClient?.getMobileMovement) {
    const mob = networkClient.getMobileMovement();
    dx += mob.dx;
    dy += mob.dy;
    if (mob.isSprinting) {
      survivalEngine.player.isSprinting = true;
    }
  }

  // Handle edge-triggered mobile buttons
  if (networkClient?.mobileJoystick) {
    const isAction = Boolean(networkClient.mobileJoystick.isPressed?.("action"));
    if (isAction && !(survivalEngine.player as any)._lastMobileAction) {
      triggerPlayerAction();
    }
    (survivalEngine.player as any)._lastMobileAction = isAction;

    const isRoll = Boolean(networkClient.mobileJoystick.isPressed?.("roll"));
    if (isRoll && !(survivalEngine.player as any)._lastMobileRoll) {
      triggerPlayerRoll();
    }
    (survivalEngine.player as any)._lastMobileRoll = isRoll;

    const isInteract = Boolean(networkClient.mobileJoystick.isPressed?.("interact"));
    if (isInteract && !(survivalEngine.player as any)._lastMobileInteract) {
      triggerPlayerInteract();
    }
    (survivalEngine.player as any)._lastMobileInteract = isInteract;
  }

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
      const canSprint =
        survivalEngine.player.isSprinting && survivalEngine.player.stamina > 10;
      const input = networkClient.prediction.predictMovement(
        dx,
        dy,
        canSprint,
        survivalEngine.player.isSwimming,
        dt,
        (x: number, y: number) => (survivalEngine as any).canMoveTo(x, y),
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
        {
          activeHeldItem: (survivalEngine.player as any).activeHeldItem,
          activeHotbarIndex: survivalEngine.activeHotbarIndex,
        },
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
          (x: number, y: number) => (survivalEngine as any).canMoveTo(x, y),
        );
        networkClient.sendInput(0, 0, false, input.seq, dt, {
          activeHeldItem: (survivalEngine.player as any).activeHeldItem,
          activeHotbarIndex: survivalEngine.activeHotbarIndex,
        });
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
      selectHotbarIndex(parseInt(key, 10) - 1);
    }

    // Interact [E]
    if (key === "e") {
      survivalEngine?.handleInteractKey();
      networkClient?.sendAction({ type: "interact", action: "interact" });
    }

    // Feed / Eat [F]
    if (key === "f") {
      survivalEngine?.handleFeedKey();
      survivalEngine?.eatActiveFood();
      networkClient?.sendAction({ type: "interact", action: "eat" });
    }

    // Inventory / Crafting [I / C]
    if (key === "i" || key === "c") {
      toggleInventoryModal();
    }

    // Objectives [O]
    if (key === "o") {
      toggleObjectivesModal();
    }

    // Build Palette [B]
    if (key === "b") {
      toggleBuildPalette();
    }

    // Sound / Audio [M]
    if (key === "m") {
      const isMuted = GameAudio.toggleMute();
      const icon = document.getElementById("audio-icon");
      if (icon) {
        if (isMuted) icon.classList.add("audio-muted");
        else icon.classList.remove("audio-muted");
      }
    }

    // Journal & Quests [J]
    if (key === "j") {
      survivalEngine?.toggleJournalModal();
    }

    // Toggle Mobile Touch Controls [C]
    if (key === "c") {
      const isVisible = networkClient?.toggleMobileControls();
      const btn = document.getElementById("btn-toggle-mobile-controls");
      if (isVisible) btn?.classList.add("active");
      else btn?.classList.remove("active");
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

    // Pause / Close Modal [ESC]
    if (key === "escape") {
      if (
        compactObjectivesPanel &&
        !compactObjectivesPanel.classList.contains("hidden")
      ) {
        compactObjectivesPanel.classList.add("hidden");
        btnToggleObjectives?.classList.remove("active");
      } else if (!modalInventory.classList.contains("hidden")) {
        toggleInventoryModal();
      } else if (!modalDialogue.classList.contains("hidden")) {
        modalDialogue.classList.add("hidden");
        if (survivalEngine) survivalEngine.activeDialogueNPC = null;
      } else if (!modalChest.classList.contains("hidden")) {
        modalChest.classList.add("hidden");
        if (survivalEngine) survivalEngine.activeChest = null;
      } else if (survivalEngine && survivalEngine.showJournal) {
        survivalEngine.showJournal = false;
      } else {
        togglePauseModal();
      }
    }

    // Block / Guard Stance [Q] or [G]
    if (key === "q" || key === "g") {
      if (survivalEngine && !survivalEngine.player.isDead && !survivalEngine.player.isBlocking) {
        survivalEngine.player.isBlocking = true;
        networkClient?.sendAction({ type: "block", isBlocking: true });
      }
    }

    // Space: Jump
    if (key === " " || e.code === "Space") {
      if (survivalEngine) {
        survivalEngine.jump();
        networkClient?.sendAction({ type: "jump" });
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

    if (key === "q" || key === "g") {
      if (survivalEngine && survivalEngine.player.isBlocking) {
        survivalEngine.player.isBlocking = false;
        networkClient?.sendAction({ type: "block", isBlocking: false });
      }
    }

    if (!e.shiftKey) {
      if (survivalEngine) survivalEngine.player.isSprinting = false;
    }

    updatePlayerContinuousMovement(0.025);
  });

  window.addEventListener("mouseup", (e) => {
    if (e.button === 2) {
      if (survivalEngine && survivalEngine.player.isBlocking) {
        survivalEngine.player.isBlocking = false;
        networkClient?.sendAction({ type: "block", isBlocking: false });
      }
    }
  });

  // Mouse clicks on canvas
  if (survivalCanvas) {
    survivalCanvas.addEventListener("contextmenu", (e) => e.preventDefault());
    survivalCanvas.addEventListener("mousedown", (e) => {
      if (!isSurvivalTabActive || !survivalEngine || !survivalRenderer) return;

      // Right-Click: Block / Guard Stance
      if (e.button === 2) {
        e.preventDefault();
        if (!survivalEngine.player.isDead) {
          survivalEngine.player.isBlocking = true;
          networkClient?.sendAction({ type: "block", isBlocking: true });
        }
        return;
      }

      const rect = survivalCanvas.getBoundingClientRect();
      const cellSize = survivalRenderer.baseTileSize * survivalRenderer.zoom;
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      const halfW = survivalCanvas.width / 2;
      const halfH = survivalCanvas.height / 2;
      const worldX = survivalRenderer.cameraX + (screenX - halfW) / cellSize;
      const worldY = survivalRenderer.cameraY + (screenY - halfH) / cellSize;

      executePlayerWorldAction(worldX, worldY);
    });

    survivalCanvas.addEventListener("touchstart", (e) => {
      if (!isSurvivalTabActive || !survivalEngine || !survivalRenderer) return;
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        if (touch.clientX < 200 && touch.clientY > window.innerHeight - 200) return;
        const rect = survivalCanvas.getBoundingClientRect();
        const cellSize = survivalRenderer.baseTileSize * survivalRenderer.zoom;
        const screenX = touch.clientX - rect.left;
        const screenY = touch.clientY - rect.top;
        const halfW = survivalCanvas.width / 2;
        const halfH = survivalCanvas.height / 2;
        const worldX = survivalRenderer.cameraX + (screenX - halfW) / cellSize;
        const worldY = survivalRenderer.cameraY + (screenY - halfH) / cellSize;
        executePlayerWorldAction(worldX, worldY);
      }
    }, { passive: true });

    survivalCanvas.addEventListener("mousemove", (e) => {
      if (!isSurvivalTabActive || !survivalEngine || !survivalRenderer) return;
      const activeItem = survivalEngine.getActiveItemSlot()?.item || null;
      const is3DBlockPiece =
        (survivalEngine.isBuildMode &&
          survivalEngine.buildPiece?.startsWith("block_")) ||
        (activeItem && activeItem.startsWith("block_"));

      if (is3DBlockPiece || survivalEngine.isBuildMode) {
        const rect = survivalCanvas.getBoundingClientRect();
        const cellSize = survivalRenderer.baseTileSize * survivalRenderer.zoom;
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const halfW = survivalCanvas.width / 2;
        const halfH = survivalCanvas.height / 2;
        const targetX = Math.round(
          survivalRenderer.cameraX + (screenX - halfW) / cellSize,
        );
        const targetY = Math.round(
          survivalRenderer.cameraY + (screenY - halfH) / cellSize,
        );

        survivalEngine.buildPreviewX = targetX;
        survivalEngine.buildPreviewY = targetY;

        if (is3DBlockPiece) {
          const topBlock = survivalEngine.getTopBlock(targetX, targetY);
          const targetZ = topBlock ? topBlock.z + 1 : 0;
          survivalEngine.buildPreviewZ = targetZ;
          survivalEngine.isBuildPreviewValid = survivalEngine.canPlaceBlockAt(
            targetX,
            targetY,
            targetZ,
          );
        } else {
          survivalEngine.buildPreviewZ = 0;
          const tile = survivalEngine.worldManager.getTile(targetX, targetY);
          const previewPiece = survivalEngine.buildPiece;
          if (previewPiece === "wood_bridge") {
            const hasExisting = survivalEngine.placedStructures.some(
              (s) => s.x === targetX && s.y === targetY,
            );
            survivalEngine.isBuildPreviewValid = tile.isWater && !hasExisting;
          } else {
            const hasFloor = survivalEngine.placedStructures.some(
              (s) =>
                s.x === targetX &&
                s.y === targetY &&
                (s.type === "wood_floor" || s.type === "stone_floor" || s.type === "farm_soil"),
            );
            survivalEngine.isBuildPreviewValid = !tile.isWater && (!tile.isBlocked || hasFloor);
          }
        }
      }
    });

    survivalCanvas.addEventListener(
      "wheel",
      (e) => {
        if (!isSurvivalTabActive || !survivalEngine) return;
        e.preventDefault();
        // Cycle hotbar slots with mouse wheel
        if (e.deltaY > 0) {
          selectHotbarIndex((survivalEngine.activeHotbarIndex + 1) % 8);
        } else {
          selectHotbarIndex((survivalEngine.activeHotbarIndex + 7) % 8);
        }
      },
      { passive: false },
    );
  }
}

function initSurvivalUI() {
  // Initialize multiplayer Host/Join/Invite UI panel

  // Fullscreen button
  btnToggleFullscreen.addEventListener("click", () => {
    const container = document.getElementById("survival-game-container");
    if (!document.fullscreenElement) {
      container?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });

  // Room Code click-to-copy
  hudRoomCodeTag?.addEventListener("click", () => {
    const code = hudRoomCodeVal?.textContent;
    if (code) {
      navigator.clipboard?.writeText(code).then(() => {
        const prevText = hudRoomCodeVal.textContent;
        hudRoomCodeVal.textContent = "COPIED!";
        setTimeout(() => {
          hudRoomCodeVal.textContent = prevText;
        }, 1200);
      }).catch(() => {});
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

  // Mobile Controls toggle
  const btnToggleMobileControls = document.getElementById("btn-toggle-mobile-controls");
  btnToggleMobileControls?.addEventListener("click", () => {
    const isVisible = networkClient?.toggleMobileControls();
    if (isVisible) {
      btnToggleMobileControls.classList.add("active");
    } else {
      btnToggleMobileControls.classList.remove("active");
    }
  });

  // Modals open/close
  btnOpenInventory.addEventListener("click", toggleInventoryModal);
  btnOpenPause.addEventListener("click", togglePauseModal);

  // Objectives panel toggle
  btnToggleObjectives?.addEventListener("click", toggleObjectivesModal);
  btnCloseObjectives?.addEventListener("click", () => {
    compactObjectivesPanel?.classList.add("hidden");
    btnToggleObjectives?.classList.remove("active");
  });

  // Build palette toggle
  btnToggleBuild?.addEventListener("click", toggleBuildPalette);
  btnCloseBuild?.addEventListener("click", () => {
    compactBuildPanel?.classList.add("hidden");
    btnToggleBuild?.classList.remove("active");
  });

  // Build category tabs
  const bTabs = document.querySelectorAll(".build-tab-btn");
  bTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      bTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      activeBuildCategory = (tab as HTMLElement).dataset.cat || "houses";
      renderBuildPalette();
    });
  });

  btnCloseInventory.addEventListener("click", () => {
    modalInventory.classList.add("hidden");
    btnOpenInventory.classList.remove("active");
  });
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

function toggleObjectivesModal() {
  if (!compactObjectivesPanel) return;
  const isHidden = compactObjectivesPanel.classList.toggle("hidden");
  if (!isHidden) {
    renderQuestTracker();
    btnToggleObjectives?.classList.add("active");
    if (compactBuildPanel && !compactBuildPanel.classList.contains("hidden")) {
      compactBuildPanel.classList.add("hidden");
      btnToggleBuild?.classList.remove("active");
    }
  } else {
    btnToggleObjectives?.classList.remove("active");
  }
}

let activeBuildCategory = "houses";

const BUILD_CATEGORIES: Record<string, { id: string; name: string; icon: string }[]> = {
  houses: [
    { id: "wood_wall", name: "Timber Wall", icon: "🪵" },
    { id: "stone_wall", name: "Stone Wall", icon: "🧱" },
    { id: "wall_window", name: "Windowed Wall", icon: "🪟" },
    { id: "wood_door", name: "Wooden Door", icon: "🚪" },
    { id: "wood_floor", name: "Hardwood Floor", icon: "🪵" },
    { id: "stone_floor", name: "Flagstone Floor", icon: "🪨" },
    { id: "roof_wood", name: "Timber Roof", icon: "🏠" },
    { id: "roof_terracotta", name: "Terracotta Roof", icon: "🏡" },
    { id: "bed", name: "Cozy Bed", icon: "🛏️" },
    { id: "chest", name: "Storage Chest", icon: "📦" },
    { id: "chimney", name: "Stone Chimney", icon: "🧱" },
  ],
  farms: [
    { id: "farm_soil", name: "Farmland Soil", icon: "🌾" },
    { id: "farm_fence", name: "Wooden Fence", icon: "🪵" },
    { id: "farm_gate", name: "Fence Gate", icon: "🚪" },
    { id: "water_well", name: "Stone Well", icon: "💧" },
    { id: "seeds", name: "Wheat Seeds", icon: "🌱" },
    { id: "beet_seeds", name: "Beet Seeds", icon: "🌱" },
  ],
  stations: [
    { id: "wood_bridge", name: "Wooden Bridge", icon: "🌉" },
    { id: "campfire", name: "Campfire", icon: "🔥" },
    { id: "stone_oven", name: "Stone Oven", icon: "♨️" },
    { id: "workbench", name: "Workbench", icon: "🔨" },
  ],
  blocks: [
    { id: "block_wood", name: "Wood 3D Block", icon: "🪵" },
    { id: "block_stone", name: "Stone 3D Block", icon: "🪨" },
    { id: "block_dirt", name: "Dirt 3D Block", icon: "🌱" },
    { id: "block_brick", name: "Brick 3D Block", icon: "🧱" },
    { id: "block_sandstone", name: "Sandstone 3D", icon: "🏜️" },
    { id: "block_glass", name: "Glass 3D Block", icon: "🪟" },
    { id: "block_gold", name: "Gold 3D Block", icon: "🪙" },
  ],
};

function renderBuildPalette() {
  if (!buildItemsGrid || !survivalEngine) return;
  buildItemsGrid.innerHTML = "";

  const items = BUILD_CATEGORIES[activeBuildCategory] || [];
  for (const item of items) {
    const card = document.createElement("div");
    card.className = "build-item-card";

    let count = 0;
    for (const slot of survivalEngine.hotbar) {
      if (slot?.item === item.id) count += slot.count;
    }
    for (const slot of survivalEngine.inventory) {
      if (slot?.item === item.id) count += slot.count;
    }

    card.innerHTML = `
      <span class="build-item-icon" style="font-size: 16px; display: inline-flex; align-items: center; justify-content: center;">${item.icon}</span>
      <div class="build-item-info">
        <span class="build-item-name">${item.name}</span>
        <span class="build-item-qty">${count > 0 ? `Owned: ${count}` : "Pick 10x"}</span>
      </div>
    `;

    card.addEventListener("click", () => {
      if (!survivalEngine) return;
      if (count === 0) {
        survivalEngine.addItemToInventory(item.id as any, 10);
      }
      const curIdx = survivalEngine.activeHotbarIndex;
      survivalEngine.hotbar[curIdx] = { item: item.id as any, count: Math.max(10, count) };
      renderHotbar();
      renderBuildPalette();
      survivalEngine.addFloatingText(`Equipped: ${item.name}`, survivalEngine.player.x, survivalEngine.player.y - 1, "#fbbf24");
    });

    buildItemsGrid.appendChild(card);
  }
}

function toggleBuildPalette() {
  if (!compactBuildPanel) return;
  const isHidden = compactBuildPanel.classList.toggle("hidden");
  if (!isHidden) {
    renderBuildPalette();
    btnToggleBuild?.classList.add("active");
    if (compactObjectivesPanel && !compactObjectivesPanel.classList.contains("hidden")) {
      compactObjectivesPanel.classList.add("hidden");
      btnToggleObjectives?.classList.remove("active");
    }
  } else {
    btnToggleBuild?.classList.remove("active");
  }
}

function toggleInventoryModal() {
  const isHidden = modalInventory.classList.contains("hidden");
  if (isHidden) {
    renderInventoryGrids();
    renderCraftingList();
    modalInventory.classList.remove("hidden");
    btnOpenInventory.classList.add("active");
  } else {
    modalInventory.classList.add("hidden");
    btnOpenInventory.classList.remove("active");
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
        selectHotbarIndex(survivalEngine.activeHotbarIndex);
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
      selectHotbarIndex(idx);
      renderInventoryGrids();
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
