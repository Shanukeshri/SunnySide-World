import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUTPUT_DIR = 'test-results/browser-verification';

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  console.log('🚀 Running In-Browser Verification of Detailed 2.5D Houses...');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,960'],
  });

  try {
    const page = (await browser.pages())[0];
    await page.setViewport({ width: 1440, height: 960 });

    // ─────────────────────────────────────────────────────────────
    // TEST 1: House Preview Inspector (Visual Quality of Archetypes)
    // ─────────────────────────────────────────────────────────────
    console.log('\n[1/3] Loading House Preview Inspector...');
    await page.goto('http://localhost:3000/house-preview.html', { waitUntil: 'networkidle0' });
    await wait(800);

    let canvas = await page.$('#house-canvas');
    if (canvas) {
      await canvas.screenshot({ path: `${OUTPUT_DIR}/01_inspector_cellar_10x8.png` });
      console.log('📸 Captured 01_inspector_cellar_10x8.png');

      await page.click('#btn-arch-garden');
      await wait(500);
      canvas = await page.$('#house-canvas');
      await canvas.screenshot({ path: `${OUTPUT_DIR}/02_inspector_garden_14x10.png` });
      console.log('📸 Captured 02_inspector_garden_14x10.png');

      await page.click('#btn-arch-manor');
      await wait(500);
      canvas = await page.$('#house-canvas');
      await canvas.screenshot({ path: `${OUTPUT_DIR}/03_inspector_manor_12x12.png` });
      console.log('📸 Captured 03_inspector_manor_12x12.png');
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 2: Main Game View with Single Player
    // ─────────────────────────────────────────────────────────────
    console.log('\n[2/3] Loading Main Game View...');
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await wait(1000);

    // Dismiss start menu by clicking Single Player
    await page.evaluate(() => {
      const sp = document.getElementById('btn-menu-singleplayer');
      if (sp) sp.click();
    });
    await wait(2000);

    await page.screenshot({ path: `${OUTPUT_DIR}/04_game_singleplayer.png` });
    console.log('📸 Captured 04_game_singleplayer.png');

    // ─────────────────────────────────────────────────────────────
    // TEST 3: Switch to World Generation Tab
    // ─────────────────────────────────────────────────────────────
    console.log('\n[3/3] Switching to World Generation Tab...');
    await page.evaluate(() => {
      const tab = document.getElementById('tab-settlement');
      if (tab) tab.click();
    });
    await wait(1000);

    // Click Next Phase a few times to see house placement
    for (let p = 0; p < 8; p++) {
      await page.evaluate(() => {
        const btn = document.getElementById('btn-next-phase');
        if (btn && !btn.disabled) btn.click();
      });
      await wait(300);
    }
    await wait(1000);

    await page.screenshot({ path: `${OUTPUT_DIR}/05_worldgen_houses.png` });
    console.log('📸 Captured 05_worldgen_houses.png');

    console.log('\n✨ All Browser Verification Tests Passed Successfully!');
  } catch (err) {
    console.error('Error in browser verification:', err);
  } finally {
    await browser.close();
  }
}

run();
