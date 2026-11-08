import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUTPUT_DIR = 'test-results/gameplay-tour';

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  console.log('🚀 Running In-Game Gameplay Tour (Walking, Farm, House, Lake)...');

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

    // Dismiss start menu
    await page.evaluate(() => {
      const sp = document.getElementById('btn-menu-singleplayer');
      if (sp) sp.click();
    });
    await wait(1200);

    // 1. Overview of starter area
    await page.screenshot({ path: `${OUTPUT_DIR}/01_starter_oakvale_lake_farm.png` });
    console.log('📸 Captured 01_starter_oakvale_lake_farm.png');

    // 2. Move player towards the massive 5x Farm (Walk Up and Left)
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('KeyW');
      await wait(30);
    }
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('KeyA');
      await wait(30);
    }
    await wait(500);
    await page.screenshot({ path: `${OUTPUT_DIR}/02_player_at_giant_farm.png` });
    console.log('📸 Captured 02_player_at_giant_farm.png');

    // 3. Move player right towards the detailed house (Walk Right)
    for (let i = 0; i < 45; i++) {
      await page.keyboard.press('KeyD');
      await wait(30);
    }
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('KeyS');
      await wait(30);
    }
    await wait(500);
    await page.screenshot({ path: `${OUTPUT_DIR}/03_player_at_detailed_house.png` });
    console.log('📸 Captured 03_player_at_detailed_house.png');

    // 4. Move player down along the 2x thick road to the 5x Lake Shore
    for (let i = 0; i < 35; i++) {
      await page.keyboard.press('KeyS');
      await wait(30);
    }
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('KeyA');
      await wait(30);
    }
    await wait(500);
    await page.screenshot({ path: `${OUTPUT_DIR}/04_player_at_giant_lake.png` });
    console.log('📸 Captured 04_player_at_giant_lake.png');

    console.log('✨ Gameplay Tour finished successfully!');
  } catch (err) {
    console.error('Error during gameplay tour:', err);
  } finally {
    await browser.close();
  }
}

run();

