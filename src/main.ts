import { ASSET_ATLAS_DATA, AssetItem, AssetCategory } from './data/assetRegistry';

// ═══════════════════════════════════════════════════════════════════
// LAZY PHASER GAME INIT
// ═══════════════════════════════════════════════════════════════════
let game: any = null;

function initPhaser() {
  if (game) return;
  import('phaser').then(({ default: Phaser }) => {
    return import('./scenes/AtlasScene').then(({ AtlasScene }) => {
      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: 'game-container',
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: '#0c0f17',
        render: { pixelArt: true, antialias: false, roundPixels: true },
        scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
        scene: [AtlasScene]
      };
      game = new Phaser.Game(config);
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// TAB SWITCHING
// ═══════════════════════════════════════════════════════════════════
const tabAssetsMap   = document.getElementById('tab-assets-map')!;
const tabHouses      = document.getElementById('tab-houses')!;
const viewAssetsMap  = document.getElementById('assets-map-view')!;
const viewHouses     = document.getElementById('houses-view')!;
const atlasControls  = document.getElementById('atlas-controls')!;

function switchTab(tab: 'assets-map' | 'houses') {
  if (tab === 'assets-map') {
    viewAssetsMap.classList.add('active');
    viewHouses.classList.remove('active');
    tabAssetsMap.classList.add('active');
    tabAssetsMap.setAttribute('aria-selected', 'true');
    tabHouses.classList.remove('active');
    tabHouses.setAttribute('aria-selected', 'false');
    atlasControls.classList.remove('hidden');
    initPhaser();
    if (game) game.scene.resume('AtlasScene');
  } else {
    viewHouses.classList.add('active');
    viewAssetsMap.classList.remove('active');
    tabHouses.classList.add('active');
    tabHouses.setAttribute('aria-selected', 'true');
    tabAssetsMap.classList.remove('active');
    tabAssetsMap.setAttribute('aria-selected', 'false');
    atlasControls.classList.add('hidden');
    if (game) game.scene.pause('AtlasScene');
    drawHouses();
  }
}

tabAssetsMap.addEventListener('click', () => switchTab('assets-map'));
tabHouses.addEventListener('click', () => switchTab('houses'));

// ═══════════════════════════════════════════════════════════════════
// ATLAS DOM
// ═══════════════════════════════════════════════════════════════════
const categoryJumpBar       = document.getElementById('category-jump-bar')!;
const sidebarCategoriesList = document.getElementById('sidebar-categories-list')!;
const searchInput           = document.getElementById('asset-search-input') as HTMLInputElement;
const searchClearBtn        = document.getElementById('search-clear-btn')!;
const searchDropdown        = document.getElementById('search-results-dropdown')!;
const hoveredAssetLabel     = document.getElementById('hovered-asset-label')!;
const coordBadge            = document.getElementById('coord-badge')!;
const zoomLevelLabel        = document.getElementById('zoom-level-label')!;
const zoomInBtn             = document.getElementById('zoom-in-btn')!;
const zoomOutBtn            = document.getElementById('zoom-out-btn')!;
const zoomResetBtn          = document.getElementById('zoom-reset-btn')!;
const toggleSidebarBtn      = document.getElementById('toggle-sidebar-btn')!;
const closeSidebarBtn       = document.getElementById('close-sidebar-btn')!;
const categorySidebar       = document.getElementById('category-sidebar')!;
const inspectorModal        = document.getElementById('asset-inspector-modal')!;
const closeInspectorBtn     = document.getElementById('close-inspector-btn')!;
const inspectCategory       = document.getElementById('inspect-category')!;
const inspectName           = document.getElementById('inspect-name')!;
const inspectId             = document.getElementById('inspect-id')!;
const inspectCoords         = document.getElementById('inspect-coords')!;
const inspectSize           = document.getElementById('inspect-size')!;
const inspectFrames         = document.getElementById('inspect-frames')!;
const inspectDesc           = document.getElementById('inspect-desc')!;
const inspectPath           = document.getElementById('inspect-path') as HTMLInputElement;
const copyPathBtn           = document.getElementById('copy-path-btn')!;
const jumpToItemBtn         = document.getElementById('jump-to-item-btn')!;
const inspectPreviewBox     = document.getElementById('inspect-preview-box')!;

let activeInspectedItem: { item: AssetItem; category: AssetCategory } | null = null;

// ═══════════════════════════════════════════════════════════════════
// CATEGORY NAV
// ═══════════════════════════════════════════════════════════════════
function populateCategoryNav() {
  categoryJumpBar.innerHTML = '';
  sidebarCategoriesList.innerHTML = '';
  ASSET_ATLAS_DATA.categories.forEach((cat, index) => {
    const pill = document.createElement('button');
    pill.className = 'category-pill';
    pill.innerHTML = `<span>${cat.title}</span><span class="pill-count">${cat.items.length}</span>`;
    pill.addEventListener('click', () => {
      document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      if (cat.id === 'houses') {
        switchTab('houses');
        return;
      }
      (window as any).AtlasViewer?.panToCategory(cat.id);
    });
    categoryJumpBar.appendChild(pill);
    const card = document.createElement('div');
    card.className = 'sidebar-cat-card';
    card.innerHTML = `
      <div class="sidebar-cat-title">
        <span>${index + 1}. ${cat.title}</span>
        <span style="color:#38bdf8;font-size:11px;">${cat.items.length} items</span>
      </div>
      <div class="sidebar-cat-desc">${cat.desc}</div>
    `;
    card.addEventListener('click', () => {
      categorySidebar.classList.remove('open');
      if (cat.id === 'houses') {
        switchTab('houses');
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
  if (!query) { searchDropdown.classList.add('hidden'); searchClearBtn.classList.add('hidden'); return; }
  searchClearBtn.classList.remove('hidden');
  const matches: { item: AssetItem; category: AssetCategory }[] = [];
  for (const cat of ASSET_ATLAS_DATA.categories) {
    for (const itm of cat.items) {
      if (itm.name.toLowerCase().includes(query) || itm.id.toLowerCase().includes(query) ||
          itm.desc.toLowerCase().includes(query) || (itm.sourcePath && itm.sourcePath.toLowerCase().includes(query))) {
        matches.push({ item: itm, category: cat });
      }
    }
  }
  if (matches.length === 0) {
    searchDropdown.innerHTML = `<div style="padding:12px;color:#94a3b8;font-size:12px;">No results for "${query}"</div>`;
    searchDropdown.classList.remove('hidden'); return;
  }
  searchDropdown.innerHTML = '';
  matches.slice(0, 15).forEach(({ item, category }) => {
    const row = document.createElement('div');
    row.className = 'search-item';
    row.innerHTML = `<div class="search-item-info"><span class="search-item-title">${item.name}</span><span class="search-item-cat">${category.title}</span></div><span class="search-item-coord">(${item.x}, ${item.y})</span>`;
    row.addEventListener('click', () => { searchDropdown.classList.add('hidden'); (window as any).AtlasViewer?.panToItem(item.id); });
    searchDropdown.appendChild(row);
  });
  searchDropdown.classList.remove('hidden');
}
searchInput.addEventListener('input', e => handleSearch((e.target as HTMLInputElement).value));
searchInput.addEventListener('keydown', e => { if (e.key === 'Escape') searchDropdown.classList.add('hidden'); });
searchClearBtn.addEventListener('click', () => { searchInput.value = ''; searchDropdown.classList.add('hidden'); searchClearBtn.classList.add('hidden'); });
document.addEventListener('click', e => { if (!searchInput.contains(e.target as Node) && !searchDropdown.contains(e.target as Node)) searchDropdown.classList.add('hidden'); });

zoomInBtn.addEventListener('click',    () => (window as any).AtlasViewer?.setZoom(0.2));
zoomOutBtn.addEventListener('click',   () => (window as any).AtlasViewer?.setZoom(-0.2));
zoomResetBtn.addEventListener('click', () => (window as any).AtlasViewer?.resetZoom());

toggleSidebarBtn.addEventListener('click', () => categorySidebar.classList.toggle('open'));
closeSidebarBtn.addEventListener('click',  () => categorySidebar.classList.remove('open'));

// ═══════════════════════════════════════════════════════════════════
// INSPECTOR
// ═══════════════════════════════════════════════════════════════════
let activeInspectorAnim: number | null = null;
function closeInspector() {
  if (activeInspectorAnim !== null) { cancelAnimationFrame(activeInspectorAnim); activeInspectorAnim = null; }
  inspectorModal.classList.add('hidden');
}
function openInspector(item: AssetItem, category: AssetCategory) {
  if (activeInspectorAnim !== null) { cancelAnimationFrame(activeInspectorAnim); activeInspectorAnim = null; }
  activeInspectedItem = { item, category };
  inspectCategory.textContent = category.title;
  inspectName.textContent = item.name;
  inspectId.textContent = item.id;
  inspectCoords.textContent = `X: ${item.x}, Y: ${item.y}`;
  inspectSize.textContent = `${item.w} × ${item.h} px`;
  inspectFrames.textContent = `${item.frames} frame${item.frames > 1 ? 's' : ''} (${item.fps} FPS)`;
  inspectDesc.textContent = item.desc;
  inspectPath.value = item.sourcePath || 'Generated Procedural';
  inspectPreviewBox.innerHTML = '';
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  function gs(w: number, h: number) { const m = Math.max(w,h); return m<=16?6:m<=32?4:m<=64?3:m<=96?2:1; }
  if (item.type === 'tileset_slice' && item.crop && item.sourcePath) {
    const [cx,cy,cw,ch] = item.crop; const sc = gs(cw,ch);
    canvas.width=cw*sc; canvas.height=ch*sc; inspectPreviewBox.appendChild(canvas);
    const img=new Image(); img.onload=()=>{ctx.imageSmoothingEnabled=false;ctx.drawImage(img,cx,cy,cw,ch,0,0,cw*sc,ch*sc);}; img.src='/'+item.sourcePath;
  } else if (item.type === 'animated_strip' && item.sourcePath) {
    const fw=item.w,fh=item.h,tf=item.frames||1,fps=item.fps||8,sc=gs(fw,fh);
    canvas.width=fw*sc; canvas.height=fh*sc; inspectPreviewBox.appendChild(canvas);
    const img=new Image(); img.onload=()=>{
      let cf=0,lt=performance.now(); const iv=1000/fps;
      ctx.imageSmoothingEnabled=false; ctx.drawImage(img,0,0,fw,fh,0,0,fw*sc,fh*sc);
      if(tf>1){function loop(n:number){if(inspectorModal.classList.contains('hidden'))return;if(n-lt>=iv){cf=(cf+1)%tf;lt=n;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,cf*fw,0,fw,fh,0,0,fw*sc,fh*sc);}activeInspectorAnim=requestAnimationFrame(loop);}activeInspectorAnim=requestAnimationFrame(loop);}
    }; img.src='/'+item.sourcePath;
  } else if ((item.type==='image'||item.type==='sprite_gm')&&item.sourcePath) {
    const sc=gs(item.w,item.h); canvas.width=item.w*sc; canvas.height=item.h*sc; inspectPreviewBox.appendChild(canvas);
    const img=new Image(); img.onload=()=>{ctx.imageSmoothingEnabled=false;ctx.drawImage(img,0,0,item.w*sc,item.h*sc);}; img.src='/'+item.sourcePath;
  } else {
    inspectPreviewBox.innerHTML=`<span style="color:#38bdf8;font-weight:600;">[ ${item.name} ]</span>`;
  }
  inspectorModal.classList.remove('hidden');
}
closeInspectorBtn.addEventListener('click', closeInspector);
inspectorModal.addEventListener('click', e => { if(e.target===inspectorModal) closeInspector(); });
copyPathBtn.addEventListener('click', () => { navigator.clipboard.writeText(inspectPath.value); copyPathBtn.textContent='Copied!'; setTimeout(()=>copyPathBtn.textContent='Copy Path',1500); });
jumpToItemBtn.addEventListener('click', () => { if(activeInspectedItem){(window as any).AtlasViewer?.panToItem(activeInspectedItem.item.id);inspectorModal.classList.add('hidden');} });

// ═══════════════════════════════════════════════════════════════════
// PHASER EVENTS
// ═══════════════════════════════════════════════════════════════════
window.addEventListener('cursor-world-move', ((e:CustomEvent)=>{coordBadge.innerHTML=`<span>X: ${e.detail.x}</span> &bull; <span>Y: ${e.detail.y}</span>`;}) as EventListener);
window.addEventListener('asset-hover', ((e:CustomEvent)=>{const i=e.detail.item as AssetItem,c=e.detail.category as AssetCategory;hoveredAssetLabel.innerHTML=`<strong>${i.name}</strong> <span style="color:#94a3b8;">(${c.title})</span> &bull; <span style="font-family:var(--font-mono);color:#38bdf8;">${i.w}×${i.h}px</span>`;}) as EventListener);
window.addEventListener('asset-leave', (()=>{hoveredAssetLabel.textContent='Hover any asset or scroll to explore';}) as EventListener);
window.addEventListener('asset-select', ((e:CustomEvent)=>{openInspector(e.detail.item,e.detail.category);}) as EventListener);
window.addEventListener('zoom-change', ((e:CustomEvent)=>{zoomLevelLabel.textContent=`${Math.round(e.detail.zoom*100)}%`;}) as EventListener);

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
  { id: 'house_cottage_01',  name: 'Cottage',        desc: 'Small starter cottage with thatched roof',       crop: [89, 50, 215, 204],    nativeW: 215, nativeH: 204 },
  { id: 'house_farmhouse_01', name: 'Farmhouse',      desc: 'Medium farmhouse with porch and chimney',       crop: [435, 72, 292, 181],   nativeW: 292, nativeH: 181 },
  { id: 'house_barn_01',     name: 'Barn',            desc: 'Tall barn with steep pitched roof',             crop: [873, 38, 179, 212],   nativeW: 179, nativeH: 212 },
  { id: 'house_workshop_01', name: 'Workshop',        desc: 'Wide workshop building with double doors',      crop: [1186, 60, 274, 197],  nativeW: 274, nativeH: 197 },
  { id: 'house_tavern_01',   name: 'Tavern',          desc: 'Two-story village tavern with signage',         crop: [74, 270, 228, 210],   nativeW: 228, nativeH: 210 },
  { id: 'house_shop_01',     name: 'Shop',            desc: 'Wide single-story village shop',                crop: [444, 307, 280, 174],  nativeW: 280, nativeH: 174 },
  { id: 'house_chapel_01',   name: 'Chapel',          desc: 'Small chapel with bell tower',                  crop: [854, 273, 227, 206],  nativeW: 227, nativeH: 206 },
  { id: 'house_stable_01',   name: 'Stable',          desc: 'Low stable building for livestock',             crop: [1198, 303, 254, 180], nativeW: 254, nativeH: 180 },
  { id: 'house_warehouse_01', name: 'Warehouse',       desc: 'Square warehouse with flat front',              crop: [80, 490, 208, 212],   nativeW: 208, nativeH: 212 },
  { id: 'house_merchant_01', name: 'Merchant House',   desc: 'Wide merchant residence with awning',           crop: [445, 524, 283, 181],  nativeW: 283, nativeH: 181 },
  { id: 'house_blacksmith_01', name: 'Blacksmith Forge', desc: 'Tall forge with chimney and anvil',           crop: [877, 486, 182, 218],  nativeW: 182, nativeH: 218 },
  { id: 'house_windmill_01', name: 'Windmill',         desc: 'Low windmill base with gear housing',           crop: [1198, 545, 258, 158], nativeW: 258, nativeH: 158 },
  { id: 'house_mansion_01',  name: 'Mansion',          desc: 'Large two-story mansion with balcony',          crop: [67, 734, 240, 227],   nativeW: 240, nativeH: 227 },
  { id: 'house_cabin_01',    name: 'Cabin',            desc: 'Wide rustic cabin with extended roof',          crop: [457, 769, 262, 198],  nativeW: 262, nativeH: 198 },
  { id: 'house_castle_01',   name: 'Castle Tower',     desc: 'Tall fortified castle tower with battlements',  crop: [841, 734, 231, 232],  nativeW: 231, nativeH: 232 },
  { id: 'house_lighthouse_01', name: 'Lighthouse',      desc: 'Wide lighthouse base with lantern room',        crop: [1212, 787, 261, 181], nativeW: 261, nativeH: 181 },
];

const DISPLAY_SIZE = 128;

function drawHouses() {
  // Draw full-sheet canvas
  const canvas = document.getElementById('house-canvas') as HTMLCanvasElement;
  if (canvas) {
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const img = new Image();
    img.onload = () => {
      const maxW = window.innerWidth - 320;
      const maxH = window.innerHeight - 400;
      const scale = Math.min(maxW / img.width, maxH / img.height, 2);
      canvas.width = Math.ceil(img.width * scale);
      canvas.height = Math.ceil(img.height * scale);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = '/houses.png';
  }

  // Build house card grid
  const grid = document.getElementById('house-card-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const img = new Image();
  img.onload = () => {
    HOUSES.forEach((h, idx) => {
      const [cx, cy, cw, ch] = h.crop;

      // Compute aspect-scaled display dimensions
      const scaleF = Math.min(DISPLAY_SIZE / cw, DISPLAY_SIZE / ch);
      const dispW = Math.round(cw * scaleF);
      const dispH = Math.round(ch * scaleF);

      // Card element
      const card = document.createElement('div');
      card.className = 'house-card';

      // Preview well — 128×128 dark box
      const well = document.createElement('div');
      well.className = 'house-card-well';

      // Canvas for the cropped house
      const cvs = document.createElement('canvas');
      cvs.width = DISPLAY_SIZE;
      cvs.height = DISPLAY_SIZE;
      cvs.className = 'house-card-canvas';
      const cctx = cvs.getContext('2d')!;
      cctx.imageSmoothingEnabled = false;

      // Clear to dark background
      cctx.fillStyle = '#0f172a';
      cctx.fillRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE);

      // Draw faint 128×128 grid border
      cctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
      cctx.lineWidth = 1;
      cctx.strokeRect(0.5, 0.5, DISPLAY_SIZE - 1, DISPLAY_SIZE - 1);

      // Center the scaled house in the 128×128 well
      const offsetX = Math.floor((DISPLAY_SIZE - dispW) / 2);
      const offsetY = Math.floor((DISPLAY_SIZE - dispH) / 2);
      cctx.drawImage(img, cx, cy, cw, ch, offsetX, offsetY, dispW, dispH);

      // Draw dimension crosshairs (showing exact rendered size)
      cctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
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
      const dimLabel = document.createElement('div');
      dimLabel.className = 'house-card-dim-label';
      dimLabel.textContent = `${dispW}×${dispH}`;
      well.appendChild(dimLabel);

      // Card info
      const info = document.createElement('div');
      info.className = 'house-card-info';

      const nameEl = document.createElement('div');
      nameEl.className = 'house-card-name';
      nameEl.textContent = h.name;

      const idEl = document.createElement('div');
      idEl.className = 'house-card-id';
      idEl.textContent = h.id;

      const nativeEl = document.createElement('div');
      nativeEl.className = 'house-card-native';
      nativeEl.textContent = `Native: ${h.nativeW}×${h.nativeH}px → Display: ${dispW}×${dispH}px`;

      const descEl = document.createElement('div');
      descEl.className = 'house-card-desc';
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
  img.src = '/houses.png';
}

// ═══════════════════════════════════════════════════════════════════
// INIT: Start on houses tab
// ═══════════════════════════════════════════════════════════════════
drawHouses();
