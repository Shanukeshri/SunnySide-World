import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUTPUT_DIR = 'test-results/minimal-hud-verification';

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  console.log('🚀 Running Remote Player Clamping Verification...');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
  });

  try {
    const page = (await browser.pages())[0];
    await page.setViewport({ width: 1440, height: 900 });

    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
    await wait(1500);

    // Click Single Player
    await page.click('#btn-menu-singleplayer');
    await wait(1500);

    // Inject two remote players via page evaluation:
    // One nearby (visible inside rect)
    // One far away to the top-right outside the minimap section
    await page.evaluate(() => {
      const engine = window.survivalEngine || window.gameEngine;
      if (engine) {
        engine.remotePlayers = [
          { id: 'peer-1', x: engine.player.x + 15, y: engine.player.y - 10, color: '#a855f7' },
          { id: 'peer-2', x: engine.player.x + 180, y: engine.player.y - 120, color: '#ec4899' },
          { id: 'peer-3', x: engine.player.x - 200, y: engine.player.y + 150, color: '#06b6d4' },
        ];
      }
    });

    await wait(500);
    await page.screenshot({ path: `${OUTPUT_DIR}/06_remote_players_clamped_boundary.png` });
    console.log('📸 Captured 06_remote_players_clamped_boundary.png');

  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    await browser.close();
  }
}

run();
