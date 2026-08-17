import { describe, expect, it } from 'vitest';
import { deriveLocationsFromFeatures } from '../../src/domain/locations';

describe('location normalization', () => {
  it('uses business identifiers and Chinese aliases', () => {
    const locations = deriveLocationsFromFeatures([
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [120.38, 36.06] },
        properties: {
          门店编号: 'QD-001',
          名称: '青岛中心店',
          区域: '市南区',
          状态: '营业',
          品牌: '海岚咖啡'
        }
      }
    ]);
    expect(locations[0]).toMatchObject({
      locationId: 'QD-001',
      name: '青岛中心店',
      region: '市南区',
      status: 'open',
      brand: '海岚咖啡'
    });
  });

  it('creates deterministic unique fallback identifiers', () => {
    const feature = {
      type: 'Feature' as const,
      geometry: { type: 'Point', coordinates: [120.38, 36.06] },
      properties: { name: '无编号门店' }
    };
    const first = deriveLocationsFromFeatures([feature, feature]);
    const second = deriveLocationsFromFeatures([feature, feature]);
    expect(first.map((item) => item.locationId)).toEqual(second.map((item) => item.locationId));
    expect(new Set(first.map((item) => item.locationId))).toHaveLength(2);
  });

  it('does not treat non-point analysis geometry as a location', () => {
    expect(
      deriveLocationsFromFeatures([
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 0]
              ]
            ]
          },
          properties: { name: '研究区域' }
        }
      ])
    ).toEqual([]);
  });
});
