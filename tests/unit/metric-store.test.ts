import { describe, expect, it } from 'vitest';
import { defaultMetricDefinitions, previewMetricImport } from '../../src/domain/business-data';
import { createEmptyWorkspace } from '../../src/storage/workspace-storage';
import { GeomapFeatureStore } from '../../src/store/feature-store';
import { GeomapMetricStore } from '../../src/store/metric-store';
import { GeomapRecordStore } from '../../src/store/record-store';
import type { MetricImportMapping } from '../../src/types';

const mapping: MetricImportMapping = {
  locationId: 'store',
  periodStart: 'month',
  metricKey: 'metric',
  value: 'actual'
};

describe('metric import store', () => {
  it('uses revisions for controlled duplicate updates and versions sources', () => {
    const workspace = createEmptyWorkspace('2026-08-01T00:00:00Z');
    workspace.locations = [
      {
        locationId: 'S1',
        name: '一店',
        kind: 'store',
        status: 'open',
        geometry: { type: 'Point', coordinates: [120, 36] },
        attributes: {}
      }
    ];
    const featureStore = new GeomapFeatureStore(workspace);
    const recordStore = new GeomapRecordStore(featureStore);
    const metricStore = new GeomapMetricStore(featureStore, recordStore);
    const rows = [{ store: 'S1', month: '2026-07', metric: 'revenue', actual: '100' }];
    const first = previewMetricImport(
      'monthly.csv',
      rows,
      mapping,
      featureStore.getState().locations,
      defaultMetricDefinitions(),
      featureStore.getState().records
    );
    expect(
      metricStore.importPreview(first, 'update', mapping, Object.keys(rows[0]!))
    ).toMatchObject({
      inserted: 1,
      updated: 0,
      skipped: 0
    });
    const second = previewMetricImport(
      'monthly.csv',
      [{ ...rows[0], actual: '120' }],
      mapping,
      featureStore.getState().locations,
      metricStore.definitions(),
      featureStore.getState().records
    );
    const result = metricStore.importPreview(second, 'update', mapping, Object.keys(rows[0]!));
    expect(result).toMatchObject({ updated: 1, inserted: 0 });
    expect(result.source.version).toBe(2);
    expect(recordStore.list()).toHaveLength(2);
    expect(recordStore.list()[1]?.revisionOf).toBe(recordStore.list()[0]?.recordId);
  });
});
