import puppeteer from 'puppeteer-core';
import { copyFile } from 'node:fs/promises';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ARTIFACT_DIR = '/Users/shanukeshri983/.gemini/antigravity/brain/3d377ad0-d352-4889-9acf-064928976e68';

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
  });

  try {
    const page = (await browser.pages())[0];
    await page.setViewport({ width: 1920, height: 1080 });

    await page.goto('http://localhost:3000/?seed=42891', { waitUntil: 'domcontentloaded' });
    await wait(1200);

    // Dismiss start menu first
    await page.evaluate(() => {
      const sp = document.getElementById('btn-menu-singleplayer');
      if (sp) sp.click();
    });
    await wait(800);

    // Switch to World Generation tab
    await page.evaluate(() => {
      const tab = document.getElementById('tab-settlement');
      if (tab) tab.click();
    });
    await wait(800);

    // Advance to Phase 10
    for (let p = 0; p < 10; p++) {
      await page.evaluate(() => {
        const btn = document.getElementById('btn-next-phase');
        if (btn && !btn.disabled) btn.click();
      });
      await wait(60);
    }
    await wait(800);

    // Set zoom to 75% or 50% to see the whole village layout with all organic curved farms
    await page.evaluate(() => {
      // Find minus zoom button
      const zoomOut = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('-'));
      if (zoomOut) {
        zoomOut.click();
        zoomOut.click();
        zoomOut.click();
        zoomOut.click();
      }
    });
    await wait(800);

    const shotWide = 'test-results/organic-farms/05_wide_settlement_curved_farms.png';
    await page.screenshot({ path: shotWide });
    await copyFile(shotWide, `${ARTIFACT_DIR}/wide_settlement_curved_farms.png`);
    console.log('📸 Captured wide settlement overview');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

run();
