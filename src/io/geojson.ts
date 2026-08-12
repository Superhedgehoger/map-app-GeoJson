import { neutralizeSpreadsheetFormula } from '../security';
import type {
  FeatureProperties,
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  GeomapVariant,
  ImportError,
  ImportResult,
  JsonValue
} from '../types';

const SUPPORTED_GEOMETRIES = new Set([
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
  'GeometryCollection'
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeProperties(value: unknown, variant: GeomapVariant): FeatureProperties {
  const properties = (isRecord(value) ? structuredClone(value) : {}) as FeatureProperties;
  if (variant === 'lite') delete properties.events;
  return properties;
}

function normalizeFeature(
  value: unknown,
  index: number,
  variant: GeomapVariant
): GeoJsonFeature | ImportError {
  if (!isRecord(value) || value.type !== 'Feature' || !('geometry' in value)) {
    return { index, code: 'invalid-feature', message: `Feature ${index + 1} is invalid.` };
  }
  const geometry = value.geometry;
  if (geometry !== null && (!isRecord(geometry) || typeof geometry.type !== 'string')) {
    return {
      index,
      code: 'invalid-feature',
      message: `Feature ${index + 1} has invalid geometry.`
    };
  }
  if (geometry !== null && !SUPPORTED_GEOMETRIES.has(geometry.type as string)) {
    return {
      index,
      code: 'unsupported-geometry',
      message: `Feature ${index + 1} uses unsupported geometry ${String(geometry.type)}.`
    };
  }
  return {
    type: 'Feature',
    ...(typeof value.id === 'string' || typeof value.id === 'number' ? { id: value.id } : {}),
    geometry: structuredClone(geometry) as GeoJsonFeature['geometry'],
    properties: normalizeProperties(value.properties, variant)
  };
}

export function importGeoJson(
  input: string | unknown,
  variant: GeomapVariant = 'full'
): ImportResult {
  let value: unknown = input;
  const errors: ImportError[] = [];
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input);
    } catch {
      errors.push({ index: null, code: 'invalid-json', message: 'The file is not valid JSON.' });
    }
  }
  if (
    errors.length ||
    !isRecord(value) ||
    value.type !== 'FeatureCollection' ||
    !Array.isArray(value.features)
  ) {
    if (!errors.length) {
      errors.push({
        index: null,
        code: 'invalid-root',
        message: 'Expected a GeoJSON FeatureCollection.'
      });
    }
    return {
      collection: { type: 'FeatureCollection', features: [] },
      imported: 0,
      skipped: 0,
      errors
    };
  }

  const features: GeoJsonFeature[] = [];
  value.features.forEach((item, index) => {
    const normalized = normalizeFeature(item, index, variant);
    if ('code' in normalized) errors.push(normalized);
    else features.push(normalized);
  });
  return {
    collection: { type: 'FeatureCollection', features },
    imported: features.length,
    skipped: value.features.length - features.length,
    errors
  };
}

export function exportGeoJson(
  features: readonly GeoJsonFeature[],
  variant: GeomapVariant
): GeoJsonFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: features.map((feature) => ({
      ...structuredClone(feature),
      properties: normalizeProperties(feature.properties, variant)
    }))
  };
}

export function toSafeSpreadsheetRows(
  features: readonly GeoJsonFeature[]
): Record<string, JsonValue>[] {
  return features.map((feature) => {
    const row: Record<string, JsonValue> = {};
    for (const [key, value] of Object.entries(feature.properties)) {
      row[key] = neutralizeSpreadsheetFormula(value) as JsonValue;
    }
    return row;
  });
}
