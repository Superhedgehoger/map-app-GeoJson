import { describe, expect, it } from 'vitest';
import { createEmptyWorkspace } from '../../src/storage/workspace-storage';
import { GeomapFeatureStore } from '../../src/store/feature-store';
import { GeomapRecordStore } from '../../src/store/record-store';

describe('RecordStore', () => {
  it('adds validated records and preserves revisions', () => {
    const workspace = new GeomapFeatureStore(createEmptyWorkspace());
    const records = new GeomapRecordStore(workspace);
    const original = records.add({
      recordType: 'event',
      title: '  新店试营业  ',
      validFrom: '2026-01-01',
      entityRefs: ['QD-001']
    });
    const revision = records.revise(original.recordId, { title: '新店正式营业' });
    expect(original.title).toBe('新店试营业');
    expect(revision.revisionOf).toBe(original.recordId);
    expect(records.list()).toHaveLength(2);
  });

  it('rejects invalid ranges and Lite event records', () => {
    const workspace = new GeomapFeatureStore(createEmptyWorkspace());
    const full = new GeomapRecordStore(workspace);
    expect(() =>
      full.add({
        recordType: 'plan',
        title: '装修',
        validFrom: '2026-02-01',
        validTo: '2026-01-01',
        entityRefs: ['QD-001']
      })
    ).toThrow(/结束时间/);
    const lite = new GeomapRecordStore(workspace, false);
    expect(() =>
      lite.add({
        recordType: 'event',
        title: '事件',
        validFrom: '2026-01-01',
        entityRefs: ['QD-001']
      })
    ).toThrow(/Lite/);
  });

  it('imports derived records only once', () => {
    const workspace = new GeomapFeatureStore(createEmptyWorkspace());
    const records = new GeomapRecordStore(workspace);
    const locations = [
      {
        locationId: 'QD-001',
        name: '一店',
        kind: 'store' as const,
        status: 'open' as const,
        openedAt: '2025-01-01',
        geometry: { type: 'Point', coordinates: [120, 36] },
        attributes: {}
      }
    ];
    expect(records.importLegacy(locations)).toBe(1);
    expect(records.importLegacy(locations)).toBe(0);
  });

  it('validates a batch before writing it atomically', () => {
    const workspace = new GeomapFeatureStore(createEmptyWorkspace());
    const records = new GeomapRecordStore(workspace);
    expect(() =>
      records.addMany([
        {
          recordType: 'metric',
          title: '营收',
          validFrom: '2026-01-01',
          entityRefs: ['A'],
          payload: { metricKey: 'revenue', value: 1 }
        },
        {
          recordType: 'metric',
          title: '',
          validFrom: '2026-01-01',
          entityRefs: ['B']
        }
      ])
    ).toThrow(/标题/);
    expect(records.list()).toHaveLength(0);
  });
});
