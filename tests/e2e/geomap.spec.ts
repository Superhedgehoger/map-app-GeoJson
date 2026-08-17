import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const example = JSON.parse(await readFile(resolve('examples/decision-demo.geojson'), 'utf8'));

async function collectPageErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

test('Full opens in decision view and keeps legacy editing available', async ({ page }) => {
  const errors = await collectPageErrors(page);
  await page.addInitScript((data) => {
    window.__PRELOADED_DATA__ = data;
  }, example);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-geomap-core', 'v3');
  await expect(page.locator('#decisionShell')).toBeVisible();
  await expect(page.locator('.decision-kpis article').first().locator('strong')).toHaveText('12');
  await expect(page.locator('.layer-item').first()).toBeAttached({ timeout: 15_000 });
  await expect(page.locator('#controls')).toBeHidden();
  await page.locator('#decisionModeBtn').click();
  await expect(page.locator('#controls')).toBeVisible();
  await page.locator('#btn-show-layer-panel').click();
  await expect(page.locator('#layerPanel')).toHaveClass(/open/);
  await expect(page.locator('.layer-item').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('management filters and store-network navigation update the current view', async ({
  page
}) => {
  await page.addInitScript((data) => {
    window.__PRELOADED_DATA__ = data;
  }, example);
  await page.goto('/');
  await expect(page.locator('.decision-kpis article').first().locator('strong')).toHaveText('12');
  await page.locator('[data-section="network"]').click();
  await expect(page.locator('.decision-insights-header strong')).toHaveText('12 个位置');
  await page.locator('#decisionRegion').selectOption({ label: '崂山区' });
  await expect(page.locator('.decision-insights-header strong')).not.toHaveText('12 个位置');
  await page.locator('#decisionSearch').fill('候选');
  await expect(page.locator('#decisionSearch')).toHaveValue('候选');
});

test('Full records and compares business history on one shared time context', async ({ page }) => {
  const errors = await collectPageErrors(page);
  await page.addInitScript((data) => {
    window.__PRELOADED_DATA__ = data;
  }, example);
  await page.goto('/');
  await page.locator('[data-section="history"]').click();
  await expect(page.locator('#historyWorkspace')).toBeVisible();
  await expect(page.locator('.history-context-line')).toContainText('历史对象');

  await page.locator('#historyAt').fill('2023-06-01');
  await page.locator('#historyAt').dispatchEvent('change');
  await expect(page.locator('.history-context-line strong')).toContainText('2023');
  await expect(page.locator('.decision-kpis article').first().locator('strong')).not.toHaveText(
    '12'
  );

  await page.getByRole('button', { name: /为海岸中心店新增记录/ }).click();
  await expect(page.locator('#historyRecordForm [name="entityRef"]')).toHaveValue('QD-001');
  await page.locator('#historyRecordForm [data-close]').first().click();

  const before = await page.evaluate(() => window.GeomapCore.recordStore.list().length);
  await page.locator('#historyAddRecord').click();
  await expect(page.locator('#historyRecordDialog')).toBeVisible();
  await page.locator('#historyRecordForm [name="title"]').fill('区域经理完成现场复盘');
  await page.locator('#historyRecordForm [name="recordType"]').selectOption('event');
  await page.locator('#historyRecordForm [name="entityRef"]').selectOption('QD-001');
  await page.locator('#historyRecordForm [name="validFrom"]').fill('2023-06-01T10:30');
  await page.locator('#historyRecordForm [name="notes"]').fill('已确认的虚构验收记录');
  await page.locator('#historyRecordForm button[type="submit"]').click();
  await expect(page.locator('#historyRecordDialog')).not.toBeVisible();
  expect(await page.evaluate(() => window.GeomapCore.recordStore.list().length)).toBe(before + 1);

  await page.locator('#historyBatchMetric').click();
  await page.locator('#historyBatchMetricForm [name="period"]').fill('2023-06');
  await page.locator('#historyBatchMetricForm [name="metricKey"]').fill('revenue');
  await page.locator('#historyBatchMetricForm [name="rows"]').fill('QD-001,125000\nQD-002,118000');
  await page.locator('#historyBatchMetricForm button[type="submit"]').click();
  await expect(page.locator('#historyRecordDialog')).not.toBeVisible();
  expect(await page.evaluate(() => window.GeomapCore.recordStore.list().length)).toBe(before + 3);

  await page.locator('#historyBatchMetric').click();
  await page.locator('#historyBatchMetricForm [name="period"]').fill('2023-07');
  await page.locator('#historyCopyPrevious').click();
  await expect(page.locator('#historyBatchMetricForm [name="rows"]')).toHaveValue(/QD-001,125000/);
  await page.locator('#historyBatchMetricForm [data-close]').first().click();

  await page.locator('#historyBaseline').fill('2022-01-01');
  await page.locator('#historyCompareAt').fill('2026-08-01');
  await page.locator('#historyCompare').click();
  await expect(page.locator('.history-diff-summary')).toBeVisible();
  await expect(page.locator('.history-diff-list button').first()).toBeVisible();
  await page.locator('.history-diff-list button').first().click();
  await expect(page.locator('.history-diff-evidence')).toBeVisible();
  await page.locator('#historySeries').selectOption('store');
  await page.locator('#historySaveView').click();
  await expect(page.locator('#historySavedView')).toBeVisible();
  expect(await page.evaluate(() => window.GeomapCore.store.getState().savedViews.length)).toBe(1);
  expect(errors).toEqual([]);
});

test('Lite disables event tracking through the shared capability contract', async ({ page }) => {
  const errors = await collectPageErrors(page);
  await page.goto('/?variant=lite');
  await expect(page.locator('html')).toHaveAttribute('data-geomap-variant', 'lite');
  await expect(page.locator('#decisionShell')).toBeVisible();
  await expect(page.getByRole('button', { name: /经营时间/ })).toBeDisabled();
  await expect(page.locator('[data-feature="event-tracker"]').first()).toBeHidden();
  expect(await page.evaluate(() => window.GeomapCore.config.capabilities.eventTracker)).toBe(false);
  await expect(
    page.evaluate(() =>
      window.GeomapCore.recordStore.add({
        recordType: 'event',
        title: 'Lite event',
        validFrom: new Date().toISOString(),
        entityRefs: ['A']
      })
    )
  ).rejects.toThrow(/Lite/);
  expect(errors).toEqual([]);
});

test('tablet keeps decision view and opt-in editing available', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'tablet');
  await page.goto('/');
  await expect(page.locator('#map')).toBeVisible();
  await expect(page.locator('#decisionShell')).toBeVisible();
  await expect(page.locator('#controls')).toBeHidden();
  await page.locator('#decisionModeBtn').click();
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
