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

test('Full publishes an explainable selection model and saves a candidate decision', async ({
  page
}) => {
  const errors = await collectPageErrors(page);
  await page.addInitScript((data) => {
    window.__PRELOADED_DATA__ = data;
  }, example);
  await page.goto('/');
  await page.locator('[data-section="selection"]').click();
  await expect(page.locator('#selectionWorkspace')).toBeVisible();
  await expect(page.locator('body')).toHaveClass(/site-selection-mode/);
  await expect(page.locator('body')).not.toHaveClass(/(^|\s)selection-mode(\s|$)/);
  await page.locator('[data-template="street"]').click();
  await expect(page.locator('.selection-model-editor')).toBeVisible();
  await expect(page.locator('.selection-validation')).toContainText('模型结构有效');
  await page.locator('#selectionPublish').click();
  await expect(page.locator('.selection-section-heading [data-status="published"]')).toBeVisible();
  await page.locator('#selectionRun').click();
  await expect(page.locator('.selection-scenario-report')).toBeVisible();
  await expect(page.locator('.selection-result')).toHaveCount(3);
  await expect(page.locator('.selection-contributions').first()).toContainText('原值');
  await page.locator('#selectionConclusion').fill('优先金家岭候选点，进入现场复核');
  await page.locator('#selectionDecide').click();
  expect(await page.evaluate(() => window.GeomapCore.store.getState().decisions.length)).toBe(1);
  expect(errors).toEqual([]);
});

test('data center previews quality and revises duplicate business observations', async ({
  page
}) => {
  const errors = await collectPageErrors(page);
  await page.addInitScript((data) => {
    window.__PRELOADED_DATA__ = data;
  }, example);
  await page.goto('/');
  await page.locator('[data-section="data"]').click();
  await expect(page.locator('#dataWorkspace')).toBeVisible();
  await expect(page.locator('.data-kpis article').first()).toContainText('623,000');
  await expect(page.locator('.data-location-table > button')).toHaveCount(6);
  await page.locator('#dataRegion').selectOption({ label: '崂山区' });
  await expect(page.locator('.data-kpis article').first()).toContainText('146,000');
  await expect(page.locator('.data-location-table > button')).toHaveCount(1);
  await page.locator('#dataRegion').selectOption('all');
  await expect(page.locator('.data-kpis article').first()).toContainText('623,000');
  await page.locator('#dataMapToggle').click();
  expect(
    await page
      .locator('#dataWorkspace')
      .evaluate((element) => element.getBoundingClientRect().width)
  ).toBeLessThan(600);
  await expect(page.locator('#map .leaflet-overlay-pane path')).not.toHaveCount(0);
  await page.locator('#dataMapToggle').click();

  await page.locator('#dataImport').click();
  await page.locator('#metricFile').setInputFiles({
    name: 'monthly.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'locationId,periodStart,metricKey,value,target\nQD-001,2026-07,revenue,130000,128000\nQD-002,2026-08,revenue,121000,120000'
    )
  });
  await expect(page.locator('.metric-mapping')).toBeVisible();
  await page.locator('#metricPreview').click();
  await expect(page.locator('.metric-quality-kpis')).toContainText('可入库 2');
  await expect(page.locator('.metric-quality-kpis')).toContainText('错误 0');
  await expect(page.locator('.metric-quality-kpis')).toContainText('提示 1');
  await page.locator('#metricCommit').click();
  await expect(page.locator('#metricImportDialog')).not.toBeVisible();
  await expect(page.locator('.data-message')).toContainText('修订 1 条');
  expect(
    await page.evaluate(() => ({
      sources: window.GeomapCore.store.getState().dataSources.length,
      revisions: window.GeomapCore.store.getState().records.filter((record) => record.revisionOf)
        .length
    }))
  ).toMatchObject({ sources: 1, revisions: 1 });
  await page.locator('#dataPeriod').fill('2026-08');
  await page.locator('#dataPeriod').dispatchEvent('change');
  await expect(page.locator('.data-kpis article').first()).toContainText('121,000');
  expect(errors).toEqual([]);
});

test('private collaboration authenticates, saves with versioning and exposes conflicts', async ({
  page
}) => {
  const errors = await collectPageErrors(page);
  let saveAttempts = 0;
  const workspace: Record<string, unknown> = {
    workspaceId: 'workspace-1',
    organizationId: 'organization-1',
    name: '经营决策工作区',
    version: 1,
    updatedAt: '2026-08-17T00:00:00.000Z',
    updatedBy: 'owner-1',
    state: null
  };
  await page.route('http://private.test/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const fulfill = (value: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    if (path === '/api/health') return fulfill({ ok: true, configured: true, schemaVersion: 1 });
    if (path === '/api/sessions' && request.method() === 'POST')
      return fulfill({
        token: 'test-token',
        expiresAt: '2026-08-18T00:00:00.000Z',
        user: {
          userId: 'owner-1',
          organizationId: 'organization-1',
          displayName: '管理员',
          email: 'owner@example.com',
          role: 'owner',
          active: true,
          createdAt: '2026-08-17T00:00:00.000Z'
        }
      });
    if (path === '/api/me')
      return fulfill({
        user: {
          userId: 'owner-1',
          organizationId: 'organization-1',
          displayName: '管理员',
          email: 'owner@example.com',
          role: 'owner',
          active: true,
          createdAt: '2026-08-17T00:00:00.000Z'
        },
        organization: {
          organizationId: 'organization-1',
          name: '测试经营公司',
          brand: { productName: 'Geomap', primaryColor: '#2563eb', logoUrl: null },
          createdAt: '2026-08-17T00:00:00.000Z'
        }
      });
    if (path === '/api/workspaces' && request.method() === 'GET')
      return fulfill({ workspaces: [{ ...workspace, state: undefined }] });
    if (path === '/api/workspaces/workspace-1' && request.method() === 'GET')
      return fulfill(workspace);
    if (path.endsWith('/comments')) return fulfill({ comments: [] });
    if (path.endsWith('/sync-jobs')) return fulfill({ syncJobs: [] });
    if (path.endsWith('/audit')) return fulfill({ audit: [] });
    if (path === '/api/workspaces/workspace-1' && request.method() === 'PUT') {
      saveAttempts += 1;
      if (saveAttempts === 1) {
        Object.assign(workspace, {
          version: 2,
          updatedAt: '2026-08-17T01:00:00.000Z',
          state: request.postDataJSON().state
        });
        return fulfill(workspace);
      }
      return fulfill(
        {
          error: 'version-conflict',
          message: '工作区已被其他成员更新。',
          details: { currentVersion: 3 }
        },
        409
      );
    }
    return fulfill({ error: 'not-mocked' }, 404);
  });
  await page.addInitScript((data) => {
    window.__PRELOADED_DATA__ = data;
  }, example);
  await page.goto('/?privateApi=http%3A%2F%2Fprivate.test');
  await page.locator('[data-section="collaboration"]').click();
  await expect(page.locator('#collabAuthForm')).toBeVisible();
  await page.locator('#collabAuthForm [name="email"]').fill('owner@example.com');
  await page.locator('#collabAuthForm [name="password"]').fill('owner-password-123');
  await page.locator('#collabAuthForm button[type="submit"]').click();
  await expect(page.locator('.collab-header')).toContainText('测试经营公司');
  await page.locator('#collabPush').click();
  await expect(page.locator('.collab-message')).toContainText('服务器 v2');
  await page.locator('#collabPush').click();
  await expect(page.locator('.collab-conflict')).toContainText('服务器已是 v3');
  expect(errors).toEqual([expect.stringContaining('409 (Conflict)')]);
});

test('public build states that collaboration is local-only unless a private API is configured', async ({
  page
}) => {
  await page.goto('/');
  await page.locator('[data-section="collaboration"]').click();
  await expect(page.locator('.collab-onboarding')).toContainText('GitHub Pages 不提供账号');
  await expect(page.locator('.collab-onboarding')).toContainText('npm run private:server');
});

test('Lite disables event tracking through the shared capability contract', async ({ page }) => {
  const errors = await collectPageErrors(page);
  await page.goto('/?variant=lite');
  await expect(page.locator('html')).toHaveAttribute('data-geomap-variant', 'lite');
  await expect(page.locator('#decisionShell')).toBeVisible();
  await expect(page.getByRole('button', { name: /经营时间/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /选址模型/ })).toBeDisabled();
  await expect(page.locator('[data-feature="event-tracker"]').first()).toBeHidden();
  expect(await page.evaluate(() => window.GeomapCore.config.capabilities.eventTracker)).toBe(false);
  expect(await page.evaluate(() => window.GeomapCore.config.capabilities.siteSelection)).toBe(
    false
  );
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
