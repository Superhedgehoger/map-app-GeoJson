import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const example = JSON.parse(await readFile(resolve('example.geojson'), 'utf8'));

async function collectPageErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

test('Full loads example data without runtime errors', async ({ page }) => {
  const errors = await collectPageErrors(page);
  await page.addInitScript((data) => {
    window.__PRELOADED_DATA__ = data;
  }, example);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-geomap-core', 'v3');
  await expect(page.locator('.layer-item').first()).toBeAttached({ timeout: 15_000 });
  await page.locator('#btn-show-layer-panel').click();
  await expect(page.locator('#layerPanel')).toHaveClass(/open/);
  await expect(page.locator('.layer-item').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('Lite disables event tracking through the shared capability contract', async ({ page }) => {
  const errors = await collectPageErrors(page);
  await page.goto('/?variant=lite');
  await expect(page.locator('html')).toHaveAttribute('data-geomap-variant', 'lite');
  await expect(page.locator('[data-feature="event-tracker"]').first()).toBeHidden();
  expect(await page.evaluate(() => window.GeomapCore.config.capabilities.eventTracker)).toBe(false);
  expect(errors).toEqual([]);
});

test('tablet keeps the core map and controls available', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'tablet');
  await page.goto('/');
  await expect(page.locator('#map')).toBeVisible();
  await expect(page.locator('#controls')).toBeVisible();
  await expect(page.locator('#controls')).toHaveCSS('max-height', /.+/);
});

test('standalone build stays usable offline without external application assets', async ({
  context,
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium');
  const externalAssets: string[] = [];
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith('file:') || url.includes('tile.openstreetmap.org')) await route.continue();
    else {
      externalAssets.push(url);
      await route.abort();
    }
  });
  await page.goto(`file://${resolve('release/geomap-full.html')}`);
  await expect(page.locator('#map')).toBeVisible();
  expect(await page.evaluate(() => window.GeomapCore.config.variant)).toBe('full');
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.locator('body')).toHaveClass(/is-offline/);
  await expect(page.locator('#map')).toBeVisible();
  await context.setOffline(false);
  await page.goto(`file://${resolve('release/geomap-lite.html')}`);
  await expect(page.locator('#map')).toBeVisible();
  expect(await page.evaluate(() => window.GeomapCore.config.variant)).toBe('lite');
  expect(externalAssets.filter((url) => !url.includes('tile.openstreetmap.org'))).toEqual([]);
});
