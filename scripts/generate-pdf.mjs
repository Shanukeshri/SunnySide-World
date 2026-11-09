import puppeteer from 'puppeteer-core';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MANIFEST_PATH = '/Users/shanukeshri983/Desktop/RTSGame/screenshots/collection/collection-manifest.json';
const OUTPUT_PDF_LOCAL = '/Users/shanukeshri983/Desktop/RTSGame/screenshots/Sunnyside_Game_Screenshots_Collection.pdf';
const OUTPUT_PDF_ARTIFACT = '/Users/shanukeshri983/.gemini/antigravity/brain/81e1705d-2f19-444c-8cab-428b8abc028c/Sunnyside_Game_Screenshots_Collection.pdf';
const TEMP_HTML_PATH = '/Users/shanukeshri983/Desktop/RTSGame/screenshots/collection/pdf-template.html';

async function run() {
  console.log('📄 Loading screenshot manifest...');
  const manifestRaw = await readFile(MANIFEST_PATH, 'utf-8');
  const items = JSON.parse(manifestRaw);

  console.log(`🖼️  Encoding ${items.length} screenshots to base64 Data URLs...`);
  const encodedItems = [];
  for (const item of items) {
    const fileBytes = await readFile(item.localPath);
    const base64 = fileBytes.toString('base64');
    encodedItems.push({
      ...item,
      dataUrl: `data:image/png;base64,${base64}`,
    });
  }

  const categoryIcons = {
    'Farms': '🌾',
    'Houses': '🏡',
    'Water': '🌊',
    'Blocks': '🧱',
    'Nature & Life': '🌲'
  };

  const categories = [...new Set(items.map((i) => i.category))];
  const totalPages = encodedItems.length + 2; // +1 Cover, +1 Index

  console.log('🎨 Generating HTML document layout for PDF...');
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sunnyside Survival RTS - Visual Collection</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: 297mm 210mm; /* A4 Landscape */
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      background: #070a12;
      color: #f3f4f6;
      font-family: 'Outfit', -apple-system, sans-serif;
    }
    .page {
      width: 297mm;
      height: 210mm;
      page-break-after: always;
      position: relative;
      background: radial-gradient(circle at 50% 15%, #182238 0%, #080c16 85%);
      padding: 12mm 18mm 10mm 18mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
    }

    /* ════════════ COVER PAGE ════════════ */
    .cover-page {
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 25mm 25mm;
      background: radial-gradient(circle at 50% 25%, #1e2e4e 0%, #060911 90%);
    }
    .cover-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(59, 130, 246, 0.16);
      border: 1px solid rgba(96, 165, 250, 0.4);
      color: #93c5fd;
      padding: 6px 18px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-bottom: 24px;
    }
    .cover-title {
      font-size: 46px;
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: -1.2px;
      background: linear-gradient(135deg, #ffffff 40%, #94a3b8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 14px;
    }
    .cover-sub {
      font-size: 19px;
      color: #94a3b8;
      max-width: 680px;
      margin: 0 auto 36px;
      line-height: 1.5;
    }
    .cover-stats {
      display: flex;
      justify-content: center;
      gap: 16px;
      margin-bottom: 40px;
    }
    .stat-chip {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 12px 24px;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .stat-chip .val {
      font-size: 24px;
      font-weight: 800;
      color: #60a5fa;
      font-family: 'JetBrains Mono', monospace;
    }
    .stat-chip .lbl {
      font-size: 11px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      font-weight: 600;
    }
    .cover-footer {
      font-size: 13px;
      color: #64748b;
      font-family: 'JetBrains Mono', monospace;
    }

    /* ════════════ INDEX PAGE ════════════ */
    .index-header {
      margin-bottom: 14px;
    }
    .index-title {
      font-size: 26px;
      font-weight: 800;
      color: #fff;
      margin-bottom: 4px;
    }
    .index-sub {
      font-size: 13px;
      color: #94a3b8;
    }
    .index-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 14px;
      flex: 1;
      margin-bottom: 10px;
    }
    .index-cat-col {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
    }
    .index-cat-header {
      font-size: 14px;
      font-weight: 700;
      color: #60a5fa;
      display: flex;
      align-items: center;
      gap: 6px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      margin-bottom: 10px;
    }
    .index-item-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 5px 0;
      font-size: 11.5px;
      color: #cbd5e1;
      border-bottom: 1px dashed rgba(255, 255, 255, 0.05);
    }
    .index-item-name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 130px;
    }
    .index-item-page {
      font-family: 'JetBrains Mono', monospace;
      color: #64748b;
      font-size: 10.5px;
    }

    /* ════════════ CONTENT PHOTO PAGES ════════════ */
    .top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 9mm;
    }
    .cat-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(59, 130, 246, 0.16);
      color: #93c5fd;
      border: 1px solid rgba(96, 165, 250, 0.3);
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.6px;
      text-transform: uppercase;
    }
    .meta-id {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: #64748b;
    }
    .title-strip {
      height: 15mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .photo-title {
      font-size: 22px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.4px;
      margin-bottom: 3px;
    }
    .photo-desc {
      font-size: 12.5px;
      color: #94a3b8;
      line-height: 1.35;
    }

    .image-stage {
      height: 136mm;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .photo-frame {
      max-width: 100%;
      max-height: 100%;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.65);
      object-fit: contain;
      display: block;
    }

    .footer-bar {
      height: 10mm;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 11px;
      color: #64748b;
      padding-top: 2mm;
    }
    .footer-specs {
      display: flex;
      gap: 16px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10.5px;
    }
    .footer-specs span {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .footer-specs .spec-label {
      color: #475569;
    }
    .footer-specs .spec-val {
      color: #94a3b8;
    }
    .footer-page-num {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      color: #60a5fa;
    }
  </style>
</head>
<body>

  <!-- ════════════ PAGE 1: COVER ════════════ -->
  <div class="page cover-page">
    <div>
      <div class="cover-badge">✨ Visual Asset Atlas • Full HD Showcase</div>
      <h1 class="cover-title">Sunnyside Survival RTS<br>Visual Collection</h1>
      <p class="cover-sub">
        An executive compilation of 26 curated screenshots capturing procedural farms, medieval architecture, aquatic features, 3D block construction, and atmospheric lighting.
      </p>

      <div class="cover-stats">
        <div class="stat-chip">
          <span class="val">26</span>
          <span class="lbl">Screenshots</span>
        </div>
        <div class="stat-chip">
          <span class="val">5</span>
          <span class="lbl">Core Categories</span>
        </div>
        <div class="stat-chip">
          <span class="val">1080p</span>
          <span class="lbl">Native Resolution</span>
        </div>
        <div class="stat-chip">
          <span class="val">3D</span>
          <span class="lbl">Block Placement</span>
        </div>
      </div>

      <div class="cover-footer">
        Procedural World Generation & Survival Engine • Captured November 2026
      </div>
    </div>
  </div>

  <!-- ════════════ PAGE 2: TABLE OF CONTENTS ════════════ -->
  <div class="page">
    <div class="index-header">
      <div class="cat-pill">📑 Table of Contents</div>
      <h2 class="index-title" style="margin-top: 6px;">Visual Collection Index</h2>
      <p class="index-sub">Overview of all 26 feature screenshots organized across 5 core gameplay categories.</p>
    </div>

    <div class="index-grid">
      ${categories
        .map((cat) => {
          const catItems = encodedItems.filter((i) => i.category === cat);
          return `
        <div class="index-cat-col">
          <div class="index-cat-header">
            <span>${categoryIcons[cat] || '📷'}</span>
            <span>${cat} (${catItems.length})</span>
          </div>
          <div style="flex: 1;">
            ${catItems
              .map((item) => {
                const pageIdx = encodedItems.indexOf(item) + 3;
                return `
              <div class="index-item-row">
                <span class="index-item-name" title="${item.title}">${item.title}</span>
                <span class="index-item-page">p. ${pageIdx}</span>
              </div>
            `;
              })
              .join('')}
          </div>
        </div>
      `;
        })
        .join('')}
    </div>

    <div class="footer-bar">
      <span>Sunnyside Survival RTS — Visual Screenshot Collection</span>
      <span class="footer-page-num">Page 2 of ${totalPages}</span>
    </div>
  </div>

  <!-- ════════════ PAGES 3+: INDIVIDUAL SCREENSHOTS ════════════ -->
  ${encodedItems
    .map((item, index) => {
      const pageNum = index + 3;
      const icon = categoryIcons[item.category] || '📷';
      return `
    <div class="page">
      <div class="top-bar">
        <span class="cat-pill">${icon} ${item.category}</span>
        <span class="meta-id">FILE: ${item.filename}</span>
      </div>

      <div class="title-strip">
        <h2 class="photo-title">${item.title}</h2>
        <p class="photo-desc">${item.description}</p>
      </div>

      <div class="image-stage">
        <img class="photo-frame" src="${item.dataUrl}" alt="${item.title}">
      </div>

      <div class="footer-bar">
        <div class="footer-specs">
          <span><span class="spec-label">DIMENSIONS:</span> <span class="spec-val">1920 × 1080</span></span>
          <span><span class="spec-label">CATEGORY:</span> <span class="spec-val">${item.category}</span></span>
          <span><span class="spec-label">INDEX:</span> <span class="spec-val">#${String(index + 1).padStart(2, '0')} / ${encodedItems.length}</span></span>
        </div>
        <span class="footer-page-num">Page ${pageNum} of ${totalPages}</span>
      </div>
    </div>
  `;
    })
    .join('')}

</body>
</html>`;

  await writeFile(TEMP_HTML_PATH, html, 'utf-8');
  console.log(`📝 Wrote PDF HTML template to ${TEMP_HTML_PATH}`);

  console.log('🚀 Launching Chrome to render PDF...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = (await browser.pages())[0];
  await page.setViewport({ width: 1920, height: 1080 });

  console.log('⏳ Loading template into browser...');
  await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1500)); // Ensure all base64 images and web fonts are fully rendered

  console.log('🖨️  Printing PDF document (A4 Landscape, 300dpi background)...');
  await page.pdf({
    path: OUTPUT_PDF_LOCAL,
    format: 'A4',
    landscape: true,
    printBackground: true,
    preferCSSPageSize: true,
  });

  await browser.close();

  // Copy to Artifact Directory
  await copyFile(OUTPUT_PDF_LOCAL, OUTPUT_PDF_ARTIFACT);

  console.log(`\n🎉 PDF Successfully Created!`);
  console.log(`   📁 Local PDF: ${OUTPUT_PDF_LOCAL}`);
  console.log(`   📁 Artifact PDF: ${OUTPUT_PDF_ARTIFACT}`);
}

run().catch((err) => {
  console.error('Fatal error generating PDF:', err);
  process.exit(1);
});

