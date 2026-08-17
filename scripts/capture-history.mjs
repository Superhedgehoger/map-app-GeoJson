import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const baseURL = process.env.GEOMAP_SCREENSHOT_URL ?? 'http://127.0.0.1:4173';
const example = JSON.parse(await readFile(resolve('examples/decision-demo.geojson'), 'utf8'));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1
});

await page.addInitScript((data) => {
  window.__PRELOADED_DATA__ = data;
  window.__PRELOADED_META__ = { source: 'examples/decision-demo.geojson' };
}, example);
await page.goto(baseURL, { waitUntil: 'networkidle' });
await page.waitForFunction(
  () => document.querySelectorAll('.decision-location-list button').length > 0
);
await page.locator('[data-section="history"]').click();
await page.locator('#historyAt').fill('2026-08-01');
await page.locator('#historyAt').dispatchEvent('change');
await page.locator('.decision-freshness').evaluate((element) => {
  element.textContent = '演示数据 · 2026-08-01';
});
await page.evaluate(() => {
  document
    .querySelectorAll('[class*="toast"], [class*="brief-message"], #briefMessage')
    .forEach((element) => element.remove());
});
await page.waitForTimeout(500);

await mkdir(resolve('docs/images'), { recursive: true });
await page.screenshot({ path: resolve('docs/images/geomap-history.png') });
await browser.close();
console.log('Captured docs/images/geomap-history.png (1440x900).');
