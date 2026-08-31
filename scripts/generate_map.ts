/**
 * generate_map.ts
 * Reads the live assetRegistry.ts and writes a complete, verbose map.txt
 * that fully documents every asset, its source path, crop coords,
 * canvas position, animation data, and description.
 *
 * Run with:  npx tsx scripts/generate_map.ts
 */

import { ASSET_ATLAS_DATA } from '../src/data/assetRegistry';
import type { AssetCategory, AssetItem } from '../src/data/assetRegistry';
import * as fs from 'fs';
import * as path from 'path';

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  world_terrain:   'Core terrain tiles (grass, dirt, sand, stone, water), shorelines, paths, cliffs, and scatter details',
  iso_blocks:      'Procedurally rendered isometric diamond blocks: ground types, elevation layers, and overlay effects',
  player_actions:  'Player character hairstyle variants (idle/walk/run/attack/harvest) — horizontal animated strip PNGs at 96px per frame',
  friendly_npcs:   'Friendly NPC characters: Blacksmith, Builder, Child, Farmer, Fisher, Guide, Merchant, Villager — composite strips (body+hair+tool)',
  animals:         'Wildlife and farm animals: Cow, Chicken, Pig, Sheep, Dog, Cat, Duck, Bunny — animated walk/idle strips',
  trees:           'Tree species and growth stages: Oak sapling, Oak adult, Palm, Pine, Chopped stump — tileset slices from TS16/TS32',
  plants:          'Foliage and ground plants: Blue mushrooms, Red mushroom, Decorative trees — animated strip PNGs',
  farming_crops:   '6-stage crop growth animations (Stage 00–05) for every crop type: Wheat, Carrot, Pumpkin, Beet, Cauliflower, etc.',
  farm_objects:    'Farmyard storage and equipment: Hay bale, Chest, Water barrel, Beehive, Scarecrow, Fence, Gate, Crate',
  buildings:       'Buildings and modular construction: House, Barn, Market, Blacksmith, Windmill, Tower, Well, Bridge pieces',
  water_aquatic:   'Water transport and fishing assets: Rowboat, Fishing rod in use, Dock tile, Buoy, Fish splash VFX',
  resources:       'Collectible resources: Stone ore, Bluestone ore, Coin, Gems, Wood log, Feather, Egg, Honey, Seashell, Wool, Bone',
  enemies:         'Enemy character animations: Skeleton idle/walk/attack/death, Goblin idle/walk/run/attack/death/mining',
  dungeon_visuals: 'Dungeon interior props: Ornate Chest, Dungeon floor tile, Dungeon wall tile — tileset slices from TS16',
  weather_vfx:     'Atmospheric and visual effects: Rain drop, Snow flake, Dust particles, Hit spark, Fire, Smoke, Lightning, Splash',
  furniture_deco:  'Player-placeable furniture and decor: Bed, Table, Chair, Bookshelf, Fireplace, Rug, Lantern, Shelf, Painting',
  tools:           'Tool and implement sprites: Axe, Pickaxe, Shovel, Watering can, Fishing rod, Scythe, Hammer, Sword, Shield',
  ui_visuals:      'UI sprites from three packs — MegaCozy (inventory icons), PixelDiary (journal UI), Sunnyside (HUD & buttons)',
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function pad(s: string | number, len: number, right = false): string {
  const str = String(s);
  if (right) return str.padEnd(len);
  return str.padStart(len);
}

function hr(char = '─', len = 90): string {
  return char.repeat(len);
}

function box(text: string, char = '═', len = 90): string {
  const border = char.repeat(len);
  const inner  = `║  ${text.padEnd(len - 4)}║`;
  return `╔${border}╗\n${inner}\n╚${border}╝`;
}

function sectionHeader(cat: AssetCategory): string {
  const lines: string[] = [];
  lines.push('');
  lines.push(hr('═'));
  lines.push(`CATEGORY: ${cat.title}`);
  lines.push(`  ID            : ${cat.id}`);
  lines.push(`  Description   : ${CATEGORY_DESCRIPTIONS[cat.id] ?? cat.title}`);
  lines.push(`  Total items   : ${cat.items.length}`);

  // Compute Y range from items
  const ys = cat.items.map(i => i.y);
  const hs = cat.items.map(i => i.h);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys.map((y, i) => y + hs[i]));
  lines.push(`  Canvas Y span : ${yMin}px → ${yMax}px`);

  const xs = cat.items.map(i => i.x);
  const ws = cat.items.map(i => i.w);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs.map((x, i) => x + ws[i]));
  lines.push(`  Canvas X span : ${xMin}px → ${xMax}px`);
  lines.push(hr('─'));
  return lines.join('\n');
}

function typeLabel(type: string): string {
  const MAP: Record<string, string> = {
    tileset_slice: 'TILESET SLICE  (crop from mega-tileset PNG)',
    animated_strip: 'ANIMATED STRIP (horizontal frame strip PNG)',
    sprite_gm:     'GM SPRITE      (GameMaker single-frame PNG)',
    image:         'IMAGE          (standalone PNG)',
    iso_block:     'ISO BLOCK      (procedural isometric block)',
    iso_overlay:   'ISO OVERLAY    (procedural isometric overlay)',
  };
  return MAP[type] ?? type.toUpperCase();
}

function itemBlock(item: AssetItem, idx: number): string {
  const lines: string[] = [];

  lines.push(`  [${String(idx + 1).padStart(3, '0')}] ${item.id}`);
  lines.push(`       Name        : ${item.name}`);
  lines.push(`       Type        : ${typeLabel(item.type)}`);
  lines.push(`       Description : ${item.desc}`);
  lines.push(`       Canvas Pos  : X=${item.x}px, Y=${item.y}px`);
  lines.push(`       Frame Size  : ${item.w}px wide × ${item.h}px tall`);
  lines.push(`       Card Size   : ${item.cardW ?? item.w}px wide × ${item.cardH ?? item.h}px tall`);
  lines.push(`       Animation   : ${item.frames} frame${item.frames !== 1 ? 's' : ''} @ ${item.fps} FPS${item.frames > 1 ? ` — total anim duration: ${(item.frames / item.fps).toFixed(2)}s` : ''}`);

  if (item.type === 'tileset_slice' && item.crop && item.sourcePath) {
    const [cx, cy, cw, ch] = item.crop;
    lines.push(`       Source      : ${item.sourcePath}`);
    lines.push(`       Crop Rect   : x=${cx}, y=${cy}, w=${cw}, h=${ch}  (pixels in the source PNG)`);
    lines.push(`       Crop Region : (${cx},${cy}) → (${cx + cw},${cy + ch})`);

  } else if (item.type === 'animated_strip' && item.sourcePath) {
    lines.push(`       Source      : ${item.sourcePath}`);
    lines.push(`       Strip Info  : ${item.frames} horizontal frames, each ${item.w}×${item.h}px`);
    lines.push(`                     Full strip is ${item.frames * item.w}px wide × ${item.h}px tall`);
    lines.push(`       Frame N pos : frame 0 starts at x=0, frame N at x=N×${item.w}`);

  } else if ((item.type === 'sprite_gm' || item.type === 'image') && item.sourcePath) {
    lines.push(`       Source      : ${item.sourcePath}`);
    lines.push(`       Dimensions  : ${item.w}px × ${item.h}px (single frame)`);

  } else if (item.type === 'iso_block') {
    lines.push(`       Source      : (procedurally rendered — no PNG file)`);
    if (item.topColor !== undefined)  lines.push(`       Top Face    : #${item.topColor.toString(16).padStart(6,'0').toUpperCase()}`);
    if (item.leftColor !== undefined) lines.push(`       Left Face   : #${item.leftColor.toString(16).padStart(6,'0').toUpperCase()}`);
    if (item.rightColor !== undefined) lines.push(`       Right Face  : #${item.rightColor.toString(16).padStart(6,'0').toUpperCase()}`);
    if (item.heightRatio !== undefined) lines.push(`       Height Ratio: ${item.heightRatio} (1.0 = standard block)`);

  } else if (item.type === 'iso_overlay') {
    lines.push(`       Source      : (procedurally rendered overlay — no PNG file)`);

  } else if (item.sourcePath) {
    lines.push(`       Source      : ${item.sourcePath}`);
  }

  lines.push('');
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────
// Table of Contents
// ─────────────────────────────────────────────────────────────

function toc(cats: AssetCategory[]): string {
  const lines: string[] = [];
  lines.push(hr('─'));
  lines.push('TABLE OF CONTENTS');
  lines.push(hr('─'));

  // Compute Y spans per category
  for (let i = 0; i < cats.length; i++) {
    const cat = cats[i];
    const ys  = cat.items.map(it => it.y);
    const hs  = cat.items.map(it => it.h);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys.map((y, k) => y + hs[k]));

    const num  = String(i + 1).padStart(2, '0');
    const title = cat.title.padEnd(44);
    const cnt   = String(cat.items.length).padStart(3);
    const span  = `Y: ${yMin}px – ${yMax}px`;
    lines.push(`  §${num}  ${title}  ${cnt} items    ${span}`);
  }

  lines.push(hr('─'));
  lines.push('');
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────
// Quick-Reference Summary Table
// ─────────────────────────────────────────────────────────────

function quickRefTable(cats: AssetCategory[]): string {
  const lines: string[] = [];
  lines.push('');
  lines.push(hr('═'));
  lines.push('QUICK-REFERENCE: ALL ASSET IDs WITH CANVAS POSITIONS & SOURCES');
  lines.push(hr('─'));
  lines.push(
    'ID'.padEnd(35) +
    'X'.padStart(6) + ' ' +
    'Y'.padStart(6) + '  ' +
    'W'.padStart(4) + 'x' +
    'H'.padStart(4) + '  ' +
    'FRM'.padStart(4) + '  ' +
    'TYPE'.padEnd(16) +
    'SOURCE (truncated)'
  );
  lines.push(hr('─'));

  for (const cat of cats) {
    lines.push(`── ${cat.title} ──`);
    for (const item of cat.items) {
      const src = item.sourcePath
        ? path.basename(item.sourcePath)
        : (item.type.startsWith('iso') ? '[procedural]' : '[no src]');

      let crop = '';
      if (item.type === 'tileset_slice' && item.crop) {
        const [cx, cy, cw, ch] = item.crop;
        crop = ` crop(${cx},${cy},${cw},${ch})`;
      }

      lines.push(
        item.id.padEnd(35) +
        String(item.x).padStart(6) + ' ' +
        String(item.y).padStart(6) + '  ' +
        String(item.w).padStart(4) + 'x' +
        String(item.h).padStart(4) + '  ' +
        String(item.frames).padStart(4) + '  ' +
        item.type.padEnd(16) +
        src + crop
      );
    }
    lines.push('');
  }
  lines.push(hr('─'));
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

function generate(): string {
  const cats = ASSET_ATLAS_DATA.categories;

  // Global stats
  const totalItems = cats.reduce((s, c) => s + c.items.length, 0);
  const allYs = cats.flatMap(c => c.items.map(i => i.y + i.h));
  const canvasH = Math.max(...allYs) + 140;
  const canvasW = ASSET_ATLAS_DATA.canvasWidth ?? 2400;

  const out: string[] = [];

  // ── Title ──────────────────────────────────────────────────
  out.push(hr('═'));
  out.push('');
  out.push('         SUNNYSIDE 2D RTS/SURVIVAL GAME — VISUAL ASSET ATLAS MAP');
  out.push('');
  out.push('  This is the MASTER COORDINATE & SOURCE DIRECTORY for every asset');
  out.push('  displayed on the running asset atlas page (http://localhost:3001).');
  out.push('  It is auto-generated from src/data/assetRegistry.ts.');
  out.push('');
  out.push(`  Total categories : ${cats.length}`);
  out.push(`  Total assets     : ${totalItems}`);
  out.push(`  Canvas size      : ${canvasW}px wide × ${canvasH}px tall`);
  out.push(`  Generated at     : ${new Date().toISOString()}`);
  out.push('');
  out.push(hr('═'));
  out.push('');

  // ── How to read this file ──────────────────────────────────
  out.push(hr('─'));
  out.push('HOW TO READ THIS FILE');
  out.push(hr('─'));
  out.push('');
  out.push('  Each asset entry contains:');
  out.push('    • ID          — Unique string key (matches assetRegistry.ts and inspector)');
  out.push('    • Type        — One of: TILESET SLICE | ANIMATED STRIP | GM SPRITE | IMAGE |');
  out.push('                   ISO BLOCK | ISO OVERLAY');
  out.push('    • Description — Human label and what the sprite represents');
  out.push('    • Canvas Pos  — Where the asset\'s card appears on the 2400px-wide atlas canvas');
  out.push('    • Frame Size  — Width × Height of ONE animation frame (or the tile)');
  out.push('    • Animation   — Number of horizontal frames and playback speed in FPS');
  out.push('    • Source      — Relative path from the project root to the PNG file');
  out.push('    • Crop Rect   — (TILESET SLICE only) pixel rectangle [x, y, w, h] inside the');
  out.push('                   mega-tileset PNG to extract; crop region = (x,y)→(x+w,y+h)');
  out.push('    • Strip Info  — (ANIMATED STRIP only) total strip width, frame layout formula');
  out.push('    • Faces       — (ISO BLOCK only) hex colours for the three visible faces');
  out.push('');
  out.push(hr('─'));
  out.push('');

  // ── Asset Type Legend ──────────────────────────────────────
  out.push(hr('─'));
  out.push('ASSET TYPE LEGEND');
  out.push(hr('─'));
  out.push('');
  out.push('  TILESET SLICE  — A single tile cut from the 16px or 32px mega-tileset PNG.');
  out.push('                   Rendered by cropping [x,y,w,h] from the source sheet.');
  out.push('                   Main tilesets:');
  out.push('                     spr_tileset_sunnysideworld_16px.png  — 16×16 base tiles');
  out.push('                     spr_tileset_sunnysideworld_32px.png  — 32×32 hi-res tiles');
  out.push('');
  out.push('  ANIMATED STRIP — A horizontal strip PNG where frames are packed left-to-right.');
  out.push('                   Frame N occupies x = N × frameWidth, y = 0.');
  out.push('                   Rendered by stepping through frames at the given FPS.');
  out.push('');
  out.push('  GM SPRITE      — A standalone single-frame PNG exported from GameMaker Studio.');
  out.push('                   Path is inside Sunnyside_World_Gamemaker/sprites/<name>/<uuid>.png');
  out.push('');
  out.push('  IMAGE          — A plain standalone PNG, no animation, no cropping needed.');
  out.push('');
  out.push('  ISO BLOCK      — A procedurally drawn isometric diamond block (no PNG file).');
  out.push('                   Rendered at runtime with canvas 2D API using the face hex colours.');
  out.push('');
  out.push('  ISO OVERLAY    — Same as ISO BLOCK but drawn as a transparent overlay layer.');
  out.push('');
  out.push(hr('─'));
  out.push('');

  // ── TOC ───────────────────────────────────────────────────
  out.push(toc(cats));

  // ── Per-category sections ─────────────────────────────────
  for (let ci = 0; ci < cats.length; ci++) {
    const cat = cats[ci];
    out.push(sectionHeader(cat));
    out.push('');
    for (let ii = 0; ii < cat.items.length; ii++) {
      out.push(itemBlock(cat.items[ii], ii));
    }
  }

  // ── Quick-reference table ─────────────────────────────────
  out.push(quickRefTable(cats));

  // ── Source file reference ─────────────────────────────────
  out.push('');
  out.push(hr('═'));
  out.push('SOURCE FILES REFERENCE');
  out.push(hr('─'));
  out.push('');
  out.push('  PRIMARY TILESET PNGs (mega-sheets sliced per tile):');
  out.push('    Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Tileset/');
  out.push('      spr_tileset_sunnysideworld_16px.png   — Main 16px world tileset');
  out.push('      spr_tileset_sunnysideworld_32px.png   — Main 32px hi-res tileset');
  out.push('');
  out.push('  CHARACTER COMPOSITE STRIPS (body + hair + tool merged):');
  out.push('    Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Composites/');
  out.push('      blacksmith_spikeyhair_hammering_strip23.png  (2208×64, 23 frames @ 96px)');
  out.push('      builder_mophair_axe_strip10.png              (960×64, 10 frames @ 96px)');
  out.push('      child_bowlhair_jump_strip9.png               (864×64, 9 frames @ 96px)');
  out.push('      farmer_curlyhair_watering_strip5.png         (480×64, 5 frames @ 96px)');
  out.push('      fisher_bowlhair_reeling_strip13.png          (1248×64, 13 frames @ 96px)');
  out.push('      guide_longhair_attack_strip10.png            (960×64, 10 frames @ 96px)');
  out.push('      merchant_longhair_waiting_strip9.png         (864×64, 9 frames @ 96px)');
  out.push('      player_bowlhair_idle_strip9.png              (864×64, 9 frames @ 96px)');
  out.push('      player_curlyhair_idle_strip9.png             (864×64, 9 frames @ 96px)');
  out.push('      player_longhair_idle_strip9.png              (864×64, 9 frames @ 96px)');
  out.push('      player_mophair_idle_strip9.png               (864×64, 9 frames @ 96px)');
  out.push('      player_shorthair_idle_strip9.png             (864×64, 9 frames @ 96px)');
  out.push('      player_spikeyhair_idle_strip9.png            (864×64, 9 frames @ 96px)');
  out.push('      villager_shorthair_walk_strip8.png           (768×64, 8 frames @ 96px)');
  out.push('');
  out.push('  GOBLIN STRIPS:');
  out.push('    Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Characters/Goblin/PNG/');
  out.push('      spr_idle_strip9.png    (768×64, 8 frames)');
  out.push('      spr_walk_strip8.png    (768×64, 8 frames)');
  out.push('      spr_run_strip8.png     (768×64, 8 frames)');
  out.push('      spr_attack_strip10.png (864×64, 9 frames)');
  out.push('      spr_death_strip13.png  (864×64, 9 frames)');
  out.push('      spr_mining_strip10.png (960×64, 10 frames)');
  out.push('');
  out.push('  PLANT / MUSHROOM STRIPS:');
  out.push('    Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/Elements/Plants/');
  out.push('      spr_deco_mushroom_blue_01_strip4.png  (64×16, 4 frames)');
  out.push('      spr_deco_mushroom_blue_02_strip4.png  (64×16, 4 frames)');
  out.push('      spr_deco_mushroom_blue_03_strip4.png  (64×16, 4 frames)');
  out.push('      spr_deco_mushroom_red_01_strip4.png   (64×16, 4 frames)');
  out.push('      spr_deco_tree_01_strip4.png           (128×34, 4 frames @ 32px wide)');
  out.push('      spr_deco_tree_02_strip4.png           (112×43, 4 frames @ 28px wide)');
  out.push('');
  out.push('  CANVAS RENDERING (Inspector Preview):');
  out.push('    All previews in the inspector modal are rendered via HTML5 Canvas (no CSS scaling).');
  out.push('    Scale factor applied per frame size:');
  out.push('      ≤16px  → 6× scale (96px display)');
  out.push('      ≤32px  → 4× scale (128px display)');
  out.push('      ≤64px  → 3× scale (192px display)');
  out.push('      ≤96px  → 2× scale (192px display)');
  out.push('      >96px  → 1× scale (native size)');
  out.push('    ctx.imageSmoothingEnabled = false is always set for pixel-perfect rendering.');
  out.push('');
  out.push(hr('═'));
  out.push('END OF MAP');
  out.push(hr('═'));

  return out.join('\n');
}

// ─────────────────────────────────────────────────────────────
// Write output
// ─────────────────────────────────────────────────────────────

const output = generate();
const outPath = path.resolve(process.cwd(), 'map.txt');
fs.writeFileSync(outPath, output, 'utf-8');

const lines  = output.split('\n').length;
const bytes  = Buffer.byteLength(output, 'utf-8');
console.log(`✓ Wrote map.txt`);
console.log(`  Path  : ${outPath}`);
console.log(`  Lines : ${lines}`);
console.log(`  Size  : ${(bytes / 1024).toFixed(1)} KB`);
