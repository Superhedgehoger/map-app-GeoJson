import { describe, expect, it } from 'vitest';
import {
  analyzeTradeAreas,
  backtestSelectionModel,
  createSelectionModelTemplate,
  rankCandidates,
  scoreCandidate,
  validateSelectionModel
} from '../../src/domain/selection';
import type { BusinessRecord, LocationEntity, SelectionModelState } from '../../src/types';

const candidate = (id: string, values: Record<string, number>): LocationEntity => ({
  locationId: id,
  name: id,
  kind: 'candidate',
  status: 'planned',
  geometry: { type: 'Point', coordinates: [120, 36] },
  attributes: values
});

describe('selection model engine', () => {
  it('validates templates and explains every weighted score', () => {
    const model = createSelectionModelTemplate('street', '2026-08-01T00:00:00Z');
    expect(validateSelectionModel(model).valid).toBe(true);
    const result = scoreCandidate(
      candidate('A', { footTraffic: 20000, rent: 20000, parking: 8, competitorDistance: 1500 }),
      model
    );
    expect(result.eligible).toBe(true);
    expect(result.completeness).toBe(100);
    expect(result.contributions).toHaveLength(model.criteria.length);
    expect(result.contributions.reduce((sum, item) => sum + item.weightedScore, 0)).toBeCloseTo(
      result.score,
      1
    );
  });

  it('applies missing policies and hard thresholds before ranking', () => {
    const model = createSelectionModelTemplate('blank') as SelectionModelState;
    model.criteria = [
      {
        criterionId: 'traffic',
        name: '客流门槛',
        sourceField: 'traffic',
        direction: 'threshold',
        normalization: 'min-max',
        weight: 100,
        missingPolicy: 'eliminate',
        threshold: 100,
        explanation: '不足则淘汰'
      }
    ];
    const results = rankCandidates(
      [candidate('low', { traffic: 50 }), candidate('high', { traffic: 150 })],
      model
    );
    expect(results.map((item) => item.locationId)).toEqual(['high', 'low']);
    expect(results[1]?.eliminatedReasons[0]).toMatch(/未达到/);
  });

  it('rejects unsafe formulas and circular criterion dependencies', () => {
    const model = createSelectionModelTemplate('blank');
    model.criteria = [
      {
        criterionId: 'a',
        name: 'A',
        sourceField: 'a',
        direction: 'positive',
        normalization: 'formula',
        weight: 50,
        missingPolicy: 'error',
        expression: 'b + 1',
        explanation: 'A'
      },
      {
        criterionId: 'b',
        name: 'B',
        sourceField: 'b',
        direction: 'positive',
        normalization: 'formula',
        weight: 50,
        missingPolicy: 'error',
        expression: 'a + window.alert(1)',
        explanation: 'B'
      }
    ];
    const validation = validateSelectionModel(model);
    expect(validation.valid).toBe(false);
    expect(validation.errors.join(' ')).toMatch(/仅允许|循环依赖/);
  });

  it('keeps trade-area overlap and historical backtest read-only', () => {
    const first = candidate('C1', {});
    const second = {
      ...candidate('C2', {}),
      geometry: { type: 'Point', coordinates: [120.01, 36] }
    };
    const store = {
      ...candidate('S1', {
        footTraffic: 20000,
        rent: 30000,
        parking: 8,
        competitorDistance: 1200
      }),
      kind: 'store' as const,
      geometry: { type: 'Point', coordinates: [120.005, 36] }
    };
    const tradeAreas = analyzeTradeAreas([first, second], [store], 1500);
    expect(tradeAreas[0]?.overlaps[0]?.overlapPercent).toBeGreaterThan(0);
    expect(tradeAreas[0]?.nearbyStoreIds).toEqual(['S1']);

    const metric: BusinessRecord = {
      recordId: 'm1',
      recordType: 'metric',
      title: '收入',
      validFrom: '2026-07-01',
      recordedAt: '2026-08-01',
      entityRefs: ['S1'],
      status: 'confirmed',
      confidence: 'confirmed',
      payload: { metricKey: 'revenue', value: 100000 },
      tags: []
    };
    const records = [metric];
    const result = backtestSelectionModel(
      createSelectionModelTemplate('street'),
      [store],
      records,
      'revenue'
    );
    expect(result.sampleSize).toBe(1);
    expect(records).toEqual([metric]);
  });
});
