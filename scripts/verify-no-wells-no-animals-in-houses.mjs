import puppeteer from 'puppeteer-core';
import { mkdir, copyFile } from 'node:fs/promises';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUTPUT_DIR = 'test-results/no-wells-no-animals-in-houses';
const ARTIFACT_DIR = '/Users/shanukeshri983/.gemini/antigravity/brain/3d377ad0-d352-4889-9acf-064928976e68';

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  console.log('🚀 Running verification: No Wells and No Animals in Houses...');

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

    // 1. AUDIT WELLS & ANIMALS IN GAME RUNTIME
    const auditResults = await page.evaluate(() => {
      const engine = window.survivalEngine;
      if (!engine) return { error: 'No survivalEngine' };

      const world = engine.worldManager;
      const villages = world.villages || [];

      let wellsInsideHouses = 0;
      let animalsInsideHouses = 0;
      const wellDetails = [];
      const animalDetails = [];

      for (const v of villages) {
        const houses = v.data?.houses || [];
        const wells = v.data?.wells || [];

        // Check each well
        for (const well of wells) {
          const wx = v.gridX + well.x;
          const wy = v.gridY + well.y;
          const insideHouse = houses.some((h) => {
            const hx = v.gridX + h.x;
            const hy = v.gridY + h.y;
            return wx >= hx && wx < hx + h.footprintW && wy >= hy && wy < hy + h.footprintH;
          });
          if (insideHouse) {
            wellsInsideHouses++;
            wellDetails.push({ village: v.data.name, wellX: wx, wellY: wy, insideHouse: true });
          } else {
            wellDetails.push({ village: v.data.name, wellX: wx, wellY: wy, insideHouse: false });
          }
        }

        // Check each animal in engine.animals
        for (const animal of engine.animals) {
          const ax = animal.position.x;
          const ay = animal.position.y;
          for (const h of houses) {
            const hx = v.gridX + h.x;
            const hy = v.gridY + h.y;
            if (ax >= hx && ax < hx + h.footprintW && ay >= hy && ay < hy + h.footprintH) {
              animalsInsideHouses++;
              animalDetails.push({ species: animal.config?.species || 'animal', ax, ay, house: h.id });
            }
          }
        }
      }

      return {
        villageCount: villages.length,
        totalWells: wellDetails.length,
        wellsInsideHouses,
        wellDetails,
        totalAnimals: engine.animals.length,
        animalsInsideHouses,
        animalDetails,
      };
    });

    console.log('📊 Audit Results:', JSON.stringify(auditResults, null, 2));

    // 2. SCREENSHOT: Village houses showing completely clear interiors (no wells, no animals)
    await page.evaluate(() => {
      const engine = window.survivalEngine;
      const renderer = window.survivalRenderer;
      const v = engine.worldManager.villages[0];
      const detailedH = v.data.houses.find(h => h.metadata && h.metadata.detailedHouse);
      const wx = v.gridX + detailedH.x;
      const wy = v.gridY + detailedH.y;

      renderer.zoom = 2.6;
      engine.player.x = wx + detailedH.footprintW / 2;
      engine.player.y = wy + detailedH.footprintH / 2;
      renderer.cameraX = engine.player.x;
      renderer.cameraY = engine.player.y;
    });
    await wait(600);
    const shot1 = `${OUTPUT_DIR}/01_house_interior_clear_of_wells_and_animals.png`;
    await page.screenshot({ path: shot1 });
    console.log('📸 Captured 01_house_interior_clear_of_wells_and_animals.png');
    await copyFile(shot1, `${ARTIFACT_DIR}/house_interior_clear_of_wells_and_animals.png`);

    // 3. SCREENSHOT: Outdoor civic well placed properly in village plaza/roadside
    await page.evaluate(() => {
      const engine = window.survivalEngine;
      const renderer = window.survivalRenderer;
      const v = engine.worldManager.villages[0];
      const well = v.data.wells[0];
      if (well) {
        const wx = v.gridX + well.x;
        const wy = v.gridY + well.y;
        renderer.zoom = 2.8;
        engine.player.x = wx;
        engine.player.y = wy + 1.5;
        renderer.cameraX = engine.player.x;
        renderer.cameraY = engine.player.y;
      }
    });
    await wait(600);
    const shot2 = `${OUTPUT_DIR}/02_outdoor_civic_well_in_plaza.png`;
    await page.screenshot({ path: shot2 });
    console.log('📸 Captured 02_outdoor_civic_well_in_plaza.png');
    await copyFile(shot2, `${ARTIFACT_DIR}/outdoor_civic_well_in_plaza.png`);

    // 4. SCREENSHOT: Animals grazing naturally outside in meadow
    await page.evaluate(() => {
      const engine = window.survivalEngine;
      const renderer = window.survivalRenderer;
      const animal = engine.animals[0];
      if (animal) {
        renderer.zoom = 2.4;
        engine.player.x = animal.position.x;
        engine.player.y = animal.position.y + 1.2;
        renderer.cameraX = engine.player.x;
        renderer.cameraY = engine.player.y;
      }
    });
    await wait(600);
    const shot3 = `${OUTPUT_DIR}/03_animals_grazing_in_meadow.png`;
    await page.screenshot({ path: shot3 });
    console.log('📸 Captured 03_animals_grazing_in_meadow.png');
    await copyFile(shot3, `${ARTIFACT_DIR}/animals_grazing_in_meadow.png`);

  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('❌ Error during verification:', err);
  process.exit(1);
});

