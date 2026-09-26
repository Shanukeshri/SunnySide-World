const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  await page.goto('http://localhost:3000');
  
  // Wait for the game to initialize
  await page.waitForTimeout(2000);

  // Click the reset button
  await page.click('#btn-generate-settlement');
  await page.waitForTimeout(1000);

  // Click next phase 8 times to get to phase 8 (Villagers)
  for(let i=0; i<8; i++) {
      await page.click('#btn-next-phase');
      await page.waitForTimeout(1000);
  }

  // Get the state of npcs from window.worldGenEngine
  const npcs = await page.evaluate(() => {
    return window.worldGenEngine ? window.worldGenEngine.npcs : null;
  });
  
  console.log('NPC count:', npcs ? npcs.length : 0);
  if (npcs && npcs.length > 0) {
      console.log('NPC 0:', npcs[0]);
  }

  await browser.close();
})();
