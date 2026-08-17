import { describe, expect, it } from 'vitest';
import {
  compareHistorySnapshots,
  aggregateMetricsAtTime,
  deriveLegacyRecords,
  reconstructHistorySnapshot,
  resolveRecordRevisions
} from '../../src/domain/history';
import type { BusinessRecord, LocationEntity } from '../../src/types';

const locations: LocationEntity[] = [
  {
    locationId: 'A',
    name: '一店',
    kind: 'store',
    status: 'open',
    region: '市南区',
    openedAt: '2024-01-01T00:00:00.000Z',
    geometry: { type: 'Point', coordinates: [120, 36] },
    attributes: {}
  },
  {
    locationId: 'B',
    name: '二店',
    kind: 'store',
    status: 'open',
    openedAt: '2025-01-01T00:00:00.000Z',
    geometry: { type: 'Point', coordinates: [121, 36] },
    attributes: {}
  }
];

function stateRecord(overrides: Partial<BusinessRecord> = {}): BusinessRecord {
  return {
    recordId: 'state-a',
    recordType: 'state-change',
    title: '状态变化',
    validFrom: '2024-06-01T00:00:00.000Z',
    recordedAt: '2024-06-02T00:00:00.000Z',
    entityRefs: ['A'],
    status: 'confirmed',
    confidence: 'confirmed',
    payload: { status: 'paused' },
    tags: [],
    ...overrides
  };
}

describe('business history reconstruction', () => {
  it('uses lifecycle dates and valid-time state changes', () => {
    const early = reconstructHistorySnapshot(locations, [stateRecord()], '2024-03-01T00:00:00Z');
    expect(early.locations).toHaveLength(1);
    expect(early.locations[0]?.status).toBe('open');

    const later = reconstructHistorySnapshot(locations, [stateRecord()], '2024-08-01T00:00:00Z');
    expect(later.locations).toHaveLength(1);
    expect(later.locations[0]?.status).toBe('paused');
  });

  it('keeps closed locations in history and reconstructs their earlier open state', () => {
    const closed: LocationEntity = {
      ...locations[0]!,
      status: 'closed',
      closedAt: '2025-01-01T00:00:00.000Z'
    };
    const closeRecord = stateRecord({
      recordId: 'close-a',
      validFrom: closed.closedAt,
      payload: { status: 'closed', previousStatus: 'open' }
    });
    expect(
      reconstructHistorySnapshot([closed], [closeRecord], '2024-06-01T00:00:00Z').locations[0]
        ?.status
    ).toBe('open');
    expect(
      reconstructHistorySnapshot([closed], [closeRecord], '2025-06-01T00:00:00Z').locations[0]
        ?.status
    ).toBe('closed');
  });

  it('keeps the latest non-void revision without overwriting history', () => {
    const original = stateRecord();
    const revision = stateRecord({
      recordId: 'state-a-r2',
      revisionOf: original.recordId,
      recordedAt: '2024-06-03T00:00:00.000Z',
      payload: { status: 'open' }
    });
    expect(resolveRecordRevisions([original, revision])).toEqual([revision]);
    const voidRevision = {
      ...revision,
      recordId: 'state-a-r3',
      revisionOf: revision.recordId,
      status: 'void' as const
    };
    expect(resolveRecordRevisions([original, revision, voidRevision])).toEqual([]);
  });

  it('computes additions and state changes consistently', () => {
    const from = reconstructHistorySnapshot(locations, [stateRecord()], '2024-03-01T00:00:00Z');
    const to = reconstructHistorySnapshot(locations, [stateRecord()], '2025-03-01T00:00:00Z');
    const comparison = compareHistorySnapshots(from, to);
    expect(comparison).toMatchObject({ added: 1, removed: 0, changed: 1 });
    expect(comparison.changes.map((item) => item.locationId).sort()).toEqual(['A', 'B']);
  });

  it('derives stable lifecycle and legacy event records', () => {
    const withLegacy: LocationEntity = {
      ...locations[0]!,
      attributes: {
        events: [{ id: 'e1', name: '装修完成', createdAt: '2024-02-01T00:00:00Z' }]
      }
    };
    expect(deriveLegacyRecords([withLegacy])).toHaveLength(2);
    expect(deriveLegacyRecords([withLegacy])).toEqual(deriveLegacyRecords([withLegacy]));
  });

  it('aggregates the latest metric per location as of the selected time', () => {
    const metric = (
      id: string,
      locationId: string,
      date: string,
      value: number
    ): BusinessRecord => ({
      ...stateRecord(),
      recordId: id,
      recordType: 'metric',
      validFrom: date,
      entityRefs: [locationId],
      payload: { metricKey: 'revenue', value, unit: '元' }
    });
    const summary = aggregateMetricsAtTime(
      [
        metric('a-jan', 'A', '2026-01-01', 10),
        metric('a-feb', 'A', '2026-02-01', 12),
        metric('b-feb', 'B', '2026-02-01', 8)
      ],
      '2026-03-01'
    );
    expect(summary).toEqual([
      { metricKey: 'revenue', value: 20, unit: '元', observations: 2, period: '2026-02' }
    ]);
  });
});
