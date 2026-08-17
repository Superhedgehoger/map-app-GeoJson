import { describe, expect, it } from 'vitest';
import {
  buildMetricDashboard,
  defaultMetricDefinitions,
  parseCsvTable,
  previewMetricImport
} from '../../src/domain/business-data';
import type { BusinessRecord, LocationEntity, MetricImportMapping } from '../../src/types';

const locations: LocationEntity[] = [
  {
    locationId: 'S1',
    name: '一店',
    kind: 'store',
    status: 'open',
    region: '东区',
    geometry: { type: 'Point', coordinates: [120, 36] },
    attributes: {}
  },
  {
    locationId: 'S2',
    name: '二店',
    kind: 'store',
    status: 'open',
    region: '西区',
    geometry: { type: 'Point', coordinates: [121, 36] },
    attributes: {}
  }
];

const mapping: MetricImportMapping = {
  locationId: 'locationId',
  periodStart: 'periodStart',
  metricKey: 'metricKey',
  value: 'value',
  target: 'target'
};

function metric(
  recordId: string,
  locationId: string,
  period: string,
  value: number,
  target = 100
): BusinessRecord {
  const [year, month] = period.split('-').map(Number);
  const end = new Date(Date.UTC(year!, month!, 0)).toISOString().slice(0, 10);
  return {
    recordId,
    recordType: 'metric',
    title: '收入',
    validFrom: `${period}-01`,
    validTo: end,
    recordedAt: end,
    entityRefs: [locationId],
    status: 'confirmed',
    confidence: 'confirmed',
    payload: {
      metricKey: 'revenue',
      value,
      target,
      periodStart: `${period}-01`,
      periodEnd: end
    },
    tags: []
  };
}

describe('business data import and analytics', () => {
  it('parses quoted CSV and previews mapping, matching and duplicate quality', () => {
    const rows = parseCsvTable(
      'locationId,periodStart,metricKey,value,target\nS1,2026-07,revenue,"120,000",130000\nBAD,2026-07,revenue,nope,0'
    );
    expect(rows[0]?.value).toBe('120,000');
    const preview = previewMetricImport(
      '经营.csv',
      rows,
      mapping,
      locations,
      defaultMetricDefinitions(),
      [metric('existing', 'S1', '2026-07', 100000)]
    );
    expect(preview.validRows).toHaveLength(1);
    expect(preview.validRows[0]).toMatchObject({
      locationId: 'S1',
      metricKey: 'revenue',
      value: 120000,
      existingRecordId: 'existing'
    });
    expect(preview.issues.map((issue) => issue.code)).toEqual([
      'duplicate-existing',
      'unmatched-location'
    ]);
  });

  it('rejects duplicates inside a file before commit', () => {
    const row = {
      locationId: 'S1',
      periodStart: '2026-08',
      metricKey: 'revenue',
      value: '100'
    };
    const preview = previewMetricImport(
      'duplicate.csv',
      [row, row],
      mapping,
      locations,
      defaultMetricDefinitions(),
      []
    );
    expect(preview.validRows).toHaveLength(1);
    expect(preview.issues[0]?.code).toBe('duplicate-file');
    expect(preview.issues[0]?.severity).toBe('error');
  });

  it('keeps KPI, region ranking, target and trend on one metric period', () => {
    const records = [
      metric('j1', 'S1', '2026-06', 80),
      metric('j2', 'S2', '2026-06', 100),
      metric('c1', 'S1', '2026-07', 120),
      metric('c2', 'S2', '2026-07', 90)
    ];
    const dashboard = buildMetricDashboard(
      records,
      locations,
      defaultMetricDefinitions()[0]!,
      '2026-07'
    );
    expect(dashboard).toMatchObject({
      total: 210,
      average: 105,
      observations: 2,
      targetAttainment: 105,
      previousChange: 16.7
    });
    expect(dashboard.byRegion.map((item) => item.region)).toEqual(['东区', '西区']);
    expect(dashboard.trend).toHaveLength(2);
  });
});
