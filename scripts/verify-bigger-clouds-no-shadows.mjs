import puppeteer from 'puppeteer-core';
import { mkdir, copyFile } from 'node:fs/promises';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUTPUT_DIR = 'test-results/clouds-no-shadows-bigger';
const ARTIFACT_DIR = '/Users/shanukeshri983/.gemini/antigravity/brain/3d377ad0-d352-4889-9acf-064928976e68';

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  console.log('🚀 Running visual verification of Bigger Clouds, No Shadows, and Balanced Spacing...');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
  });

  try {
    const page = (await browser.pages())[0];
    await page.setViewport({ width: 1920, height: 1080 });

    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await wait(1200);

    // Dismiss start menu
    await page.evaluate(() => {
      const sp = document.getElementById('btn-menu-singleplayer');
      if (sp) sp.click();
    });
    await wait(1500);

    // Shot 1: Daytime settlement view - big clouds drifting overhead with ZERO ground shadows
    await page.evaluate(() => {
      const engine = window.survivalEngine;
      const renderer = window.survivalRenderer;
      if (!engine || !renderer) return;

      const v = engine.worldManager.villages[0];
      if (v) {
        engine.player.x = v.gridX + 10;
        engine.player.y = v.gridY + 12;
        if (engine.networkPrediction) {
          engine.networkPrediction.predictedX = engine.player.x;
          engine.networkPrediction.predictedY = engine.player.y;
        }
        renderer.cameraX = engine.player.x;
        renderer.cameraY = engine.player.y;
        renderer.zoom = 2.0;
      }
    });
    await wait(800);
    const shot1 = `${OUTPUT_DIR}/01_daytime_bigger_clouds_no_shadows.png`;
    await page.screenshot({ path: shot1 });
    console.log('📸 Captured 01_daytime_bigger_clouds_no_shadows.png');
    await copyFile(shot1, `${ARTIFACT_DIR}/daytime_bigger_clouds_no_shadows.png`);

    // Shot 2: Wide landscape over water and farmlands showing balanced cloud dispersion
    await page.evaluate(() => {
      const engine = window.survivalEngine;
      const renderer = window.survivalRenderer;
      if (!engine || !renderer) return;

      const v = engine.worldManager.villages[0];
      if (v) {
        engine.player.x = v.gridX + 22;
        engine.player.y = v.gridY + 6;
        if (engine.networkPrediction) {
          engine.networkPrediction.predictedX = engine.player.x;
          engine.networkPrediction.predictedY = engine.player.y;
        }
        renderer.cameraX = engine.player.x;
        renderer.cameraY = engine.player.y;
        renderer.zoom = 1.6;
      }
    });
    await wait(800);
    const shot2 = `${OUTPUT_DIR}/02_wide_landscape_balanced_clouds.png`;
    await page.screenshot({ path: shot2 });
    console.log('📸 Captured 02_wide_landscape_balanced_clouds.png');
    await copyFile(shot2, `${ARTIFACT_DIR}/wide_landscape_balanced_clouds.png`);

    // Shot 3: Sunset/Evening showing pure white translucent soft clouds
    await page.evaluate(() => {
      const engine = window.survivalEngine;
      const renderer = window.survivalRenderer;
      if (!engine || !renderer) return;

      // Advance game time to sunset (~18:30 = 1110 mins)
      engine.gameTime = 1110;
      const v = engine.worldManager.villages[0];
      if (v) {
        engine.player.x = v.gridX + 10;
        engine.player.y = v.gridY + 12;
        if (engine.networkPrediction) {
          engine.networkPrediction.predictedX = engine.player.x;
          engine.networkPrediction.predictedY = engine.player.y;
        }
        renderer.cameraX = engine.player.x;
        renderer.cameraY = engine.player.y;
        renderer.zoom = 2.0;
      }
    });
    await wait(800);
    const shot3 = `${OUTPUT_DIR}/03_sunset_pure_white_translucent_clouds.png`;
    await page.screenshot({ path: shot3 });
    console.log('📸 Captured 03_sunset_pure_white_translucent_clouds.png');
    await copyFile(shot3, `${ARTIFACT_DIR}/sunset_pure_white_translucent_clouds.png`);

  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('❌ Error during verification:', err);
  process.exit(1);
});

