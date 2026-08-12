import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const baseURL = process.env.GEOMAP_SCREENSHOT_URL ?? 'http://127.0.0.1:4173';
const example = JSON.parse(await readFile(resolve('example.geojson'), 'utf8'));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1
});

await page.addInitScript((data) => {
  window.__PRELOADED_DATA__ = data;
  window.__PRELOADED_META__ = {
    source: 'example.geojson',
    featureCount: data.features?.length ?? 0
  };
}, example);
await page.goto(baseURL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.querySelectorAll('.layer-item').length > 0, undefined, {
  timeout: 15_000
});
await page.locator('#btn-show-layer-panel').click();
await page.waitForTimeout(500);

await mkdir(resolve('docs/images'), { recursive: true });
await page.screenshot({ path: resolve('docs/images/geomap-overview.png') });
await browser.close();
console.log('Captured docs/images/geomap-overview.png (1440x900).');
