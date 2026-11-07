import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SCREENSHOTS_DIR = 'test-results/screenshots';

async function run() {
  await mkdir(SCREENSHOTS_DIR, { recursive: true });
  console.log('Launching Chrome...');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  // Pipe console messages
  page.on('console', msg => {
    const text = msg.text();
    if (!text.includes('Download the Vue Devtools') && !text.includes('[vite]')) {
      console.log(`[BROWSER] ${text}`);
    }
  });

  console.log('Navigating to http://localhost:3000/multiplayer-test.html...');
  await page.goto('http://localhost:3000/multiplayer-test.html', { waitUntil: 'networkidle0', timeout: 15000 });

  console.log('Clicking Start Test...');
  await page.click('#btn-start');

  // Wait for both players to be connected
  await page.waitForFunction(() => {
    const status = document.getElementById('test-status');
    return status && status.textContent.includes('Both players connected');
  }, { timeout: 15000 });

  console.log('Both players connected! Waiting 2s for visual rendering...');
  await new Promise(r => setTimeout(r, 2000));

  // Take screenshot 1: Initial joined state
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/01_both_players_joined.png` });
  console.log('📸 Screenshot 1 saved: Initial joined state');

  // Click Run Auto-Test Suite
  console.log('Starting Auto-Test Suite...');
  await page.click('#btn-auto');

  // Take screenshots during tests
  await new Promise(r => setTimeout(r, 4000));
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/02_during_movement_tests.png` });
  console.log('📸 Screenshot 2 saved: During movement tests');

  await new Promise(r => setTimeout(r, 6000));
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/03_sprint_and_sync_tests.png` });
  console.log('📸 Screenshot 3 saved: Sprint and sync tests');

  // Wait for all tests to finish
  console.log('Waiting for test suite completion...');
  await page.waitForFunction(() => {
    const status = document.getElementById('test-status');
    return status && (status.textContent.includes('PASSED') || status.textContent.includes('failed'));
  }, { timeout: 45000 });

  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/04_tests_completed.png` });
  console.log('📸 Screenshot 4 saved: Final test results');

  // Extract all test log messages
  const logs = await page.evaluate(() => {
    const logEl = document.getElementById('log-panel');
    return Array.from(logEl.children).map(c => ({
      class: c.className,
      text: c.textContent
    }));
  });

  // Extract final status
  const finalStatus = await page.evaluate(() => {
    return document.getElementById('test-status')?.textContent;
  });

  console.log('\n================ TEST SUMMARY ================');
  console.log(`Final Status: ${finalStatus}`);
  console.log('Log items:');
  logs.forEach(l => {
    const symbol = l.class === 'pass' ? '✓' : l.class === 'fail' ? '✗' : '•';
    console.log(`  ${symbol} ${l.text}`);
  });

  // Check if any test failed
  const failedLogs = logs.filter(l => l.class === 'fail');
  if (failedLogs.length > 0) {
    console.error(`\n❌ ${failedLogs.length} test(s) failed!`);
  } else {
    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
  }

  await browser.close();
  return { success: failedLogs.length === 0, finalStatus, logs };
}

run().then(res => {
  if (!res.success) process.exit(1);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

