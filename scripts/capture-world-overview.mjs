import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUTPUT_DIR = 'test-results/world-overview';

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  console.log('🚀 Capturing Full World Overview (5x Water, 5x Farms, 2x Paths)...');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
  });

  try {
    const page = (await browser.pages())[0];
    await page.setViewport({ width: 1920, height: 1080 });

    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await wait(800);

    // Switch to World Generation tab
    await page.evaluate(() => {
      const tab = document.getElementById('tab-settlement');
      if (tab) tab.click();
    });
    await wait(600);

    // Advance to Phase 10 (all phases generated)
    for (let p = 0; p < 10; p++) {
      await page.evaluate(() => {
        const btn = document.getElementById('btn-next-phase');
        if (btn && !btn.disabled) btn.click();
      });
      await wait(150);
    }
    await wait(800);

    // Click 'Fit' button or zoom out to see wide world
    await page.evaluate(() => {
      const fitBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Fit'));
      if (fitBtn) fitBtn.click();
    });
    await wait(600);

    await page.screenshot({ path: `${OUTPUT_DIR}/01_village_wide_overview.png` });
    console.log('📸 Captured 01_village_wide_overview.png');

    // Pan camera down-left to capture the 5x water body and farms
    await page.evaluate(() => {
      // Access settlement engine/camera if available or drag canvas
      const canvas = document.getElementById('settlement-canvas');
      if (canvas) {
        const evt = new MouseEvent('mousedown', { clientX: 900, clientY: 500 });
        canvas.dispatchEvent(evt);
        const moveEvt = new MouseEvent('mousemove', { clientX: 500, clientY: 200 });
        window.dispatchEvent(moveEvt);
        const upEvt = new MouseEvent('mouseup');
        window.dispatchEvent(upEvt);
      }
    });
    await wait(600);

    await page.screenshot({ path: `${OUTPUT_DIR}/02_village_panned_view.png` });
    console.log('📸 Captured 02_village_panned_view.png');

    // Switch back to singleplayer game and take wide in-game view
    await page.evaluate(() => {
      const tab = document.getElementById('tab-game');
      if (tab) tab.click();
      const sp = document.getElementById('btn-menu-singleplayer');
      if (sp) sp.click();
    });
    await wait(1200);

    await page.screenshot({ path: `${OUTPUT_DIR}/03_ingame_wide_gameplay.png` });
    console.log('📸 Captured 03_ingame_wide_gameplay.png');

    console.log('✨ All overview captures completed successfully!');
  } catch (err) {
    console.error('Error capturing world overview:', err);
  } finally {
    await browser.close();
  }
}

run();

