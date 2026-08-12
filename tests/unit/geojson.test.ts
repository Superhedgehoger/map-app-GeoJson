import { describe, expect, it } from 'vitest';
import { exportGeoJson, importGeoJson, toSafeSpreadsheetRows } from '../../src/io/geojson';

const collection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'one',
      geometry: { type: 'Point', coordinates: [120.38, 36.06] },
      properties: { name: '示例点', events: [{ title: 'Full only' }], note: '=1+1' }
    }
  ]
};

describe('GeoJSON boundary', () => {
  it('reports structured parsing errors', () => {
    expect(importGeoJson('{').errors[0]?.code).toBe('invalid-json');
  });

  it('removes event data throughout the Lite boundary', () => {
    const result = importGeoJson(collection, 'lite');
    expect(result.imported).toBe(1);
    expect(result.collection.features[0]?.properties.events).toBeUndefined();
    expect(
      exportGeoJson(result.collection.features, 'lite').features[0]?.properties.events
    ).toBeUndefined();
  });

  it('keeps Full data round-trippable and protects spreadsheets', () => {
    const result = importGeoJson(collection, 'full');
    expect(exportGeoJson(result.collection.features, 'full')).toEqual(result.collection);
    expect(toSafeSpreadsheetRows(result.collection.features)[0]?.note).toBe("'=1+1");
  });
});
