import type { GeomapFeatureStore } from './store/feature-store';
import type { GeomapRecordStore } from './store/record-store';
import type { exportGeoJson, importGeoJson, toSafeSpreadsheetRows } from './io/geojson';
import type { neutralizeSpreadsheetFormula, sanitizeHtml, sanitizeUrl } from './security';
import type { AppConfig, GeoJsonFeatureCollection, GeomapVariant } from './types';

declare global {
  interface Window {
    GEOMAP_VARIANT?: GeomapVariant;
    GEOMAP_FEATURES?: Readonly<{ eventTracker: boolean }>;
    __PRELOADED_DATA__?: unknown;
    __PRELOADED_META__?: unknown;
    GeomapLegacyBridge?: Readonly<{
      getFeatureCollection: () => GeoJsonFeatureCollection;
      applyLocationFilter: (filter: { query?: string; region?: string; status?: string }) => void;
      applyHistoricalState: (
        state: { locationIds: string[]; statusById?: Record<string, string> } | null
      ) => void;
      focusLocation: (name: string) => boolean;
    }>;
    GeomapCore: Readonly<{
      config: AppConfig;
      store: GeomapFeatureStore;
      recordStore: GeomapRecordStore;
      importGeoJson: typeof importGeoJson;
      exportGeoJson: typeof exportGeoJson;
      toSafeSpreadsheetRows: typeof toSafeSpreadsheetRows;
      sanitizeHtml: typeof sanitizeHtml;
      sanitizeUrl: typeof sanitizeUrl;
      neutralizeSpreadsheetFormula: typeof neutralizeSpreadsheetFormula;
      exportWorkspaceBackup: () => string;
      importWorkspaceBackup: (value: string) => void;
      syncFeatures: (value: unknown) => void;
    }>;
  }
}

export {};
