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
  RenderOptions,
} from "./generation/SettlementRenderer";

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
const tabHouses = document.getElementById("tab-houses")!;
const tabTerrain = document.getElementById("tab-terrain")!;
const tabAssetsMap = document.getElementById("tab-assets-map")!;

const viewSettlement = document.getElementById("settlement-view")!;
const viewHouses = document.getElementById("houses-view")!;
const viewTerrain = document.getElementById("terrain-view")!;
const viewAssetsMap = document.getElementById("assets-map-view")!;

const atlasControls = document.getElementById("atlas-controls")!;
const allViews = [viewSettlement, viewHouses, viewTerrain, viewAssetsMap];
const allTabs = [tabSettlement, tabHouses, tabTerrain, tabAssetsMap];

function switchTab(tab: "settlement" | "houses" | "terrain" | "assets-map") {
  allViews.forEach((v) => v.classList.remove("active"));
  allTabs.forEach((t) => {
    t.classList.remove("active");
    t.setAttribute("aria-selected", "false");
  });

  if (tab === "settlement") {
    viewSettlement.classList.add("active");
    tabSettlement.classList.add("active");
    tabSettlement.setAttribute("aria-selected", "true");
    atlasControls.classList.add("hidden");
    if (game) game.scene.pause("AtlasScene");
    ensureSettlementLoaded();
  } else if (tab === "houses") {
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

tabSettlement.addEventListener("click", () => switchTab("settlement"));
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
  await renderSettlement(settlementCanvas, currentSettlementData, {
    cellSize,
    showGrid: optShowGrid,
    showClearance: optShowClearance,
    showFootprints: optShowFootprints,
  });
}

function generateAndRenderSettlement(seed?: number) {
  currentSeed = seed !== undefined ? seed : Math.floor(Math.random() * 1000000);
  currentSettlementData = generateSettlement(currentSeed, 48, 36);
  updateSettlementBadges(currentSettlementData);
  renderCurrentSettlement();
}

function updateZoomDisplay() {
  const label = document.getElementById("settlement-zoom-label");
  if (label) label.textContent = `${Math.round(currentZoomLevel * 100)}%`;
  renderCurrentSettlement();
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
      renderCurrentSettlement();
    });
  }

  if (toggleClearance) {
    toggleClearance.addEventListener("click", () => {
      optShowClearance = !optShowClearance;
      toggleClearance.classList.toggle("active", optShowClearance);
      renderCurrentSettlement();
    });
  }

  if (toggleFootprints) {
    toggleFootprints.addEventListener("click", () => {
      optShowFootprints = !optShowFootprints;
      toggleFootprints.classList.toggle("active", optShowFootprints);
      renderCurrentSettlement();
    });
  }

  // Pan & Drag on viewport
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

    window.addEventListener("mouseup", () => {
      isPanning = false;
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

// Initial auto-start on page load
switchTab("settlement");

