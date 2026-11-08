import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUTPUT_DIR = 'test-results/house-preview';

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  console.log('🚀 Inspecting house preview canvas directly in Chrome...');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900'],
  });

  try {
    const page = (await browser.pages())[0];
    await page.setViewport({ width: 1400, height: 900 });

    await page.goto('http://localhost:3000/house-preview.html', {
      waitUntil: 'networkidle0',
    });
    await wait(800);

    // 1. Capture 10x8 Cellar Homestead (Canvas only)
    let canvas = await page.$('#house-canvas');
    await canvas.screenshot({ path: `${OUTPUT_DIR}/clean_cellar_10x8.png` });
    console.log('📸 Captured clean_cellar_10x8.png');

    // 2. Click 7x7 Studio
    await page.click('#btn-arch-studio');
    await wait(500);
    canvas = await page.$('#house-canvas');
    await canvas.screenshot({ path: `${OUTPUT_DIR}/clean_studio_7x7.png` });
    console.log('📸 Captured clean_studio_7x7.png');

    // 3. Click 14x10 Garden
    await page.click('#btn-arch-garden');
    await wait(500);
    canvas = await page.$('#house-canvas');
    await canvas.screenshot({ path: `${OUTPUT_DIR}/clean_garden_14x10.png` });
    console.log('📸 Captured clean_garden_14x10.png');

    // 4. Click 12x12 Stone Manor
    await page.click('#btn-arch-manor');
    await wait(500);
    canvas = await page.$('#house-canvas');
    await canvas.screenshot({ path: `${OUTPUT_DIR}/clean_stone_manor_12x12.png` });
    console.log('📸 Captured clean_stone_manor_12x12.png');

    console.log('✨ All clean canvas screenshots saved!');
  } catch (err) {
    console.error('Error in capture-house-preview:', err);
  } finally {
    await browser.close();
  }
}

run();
