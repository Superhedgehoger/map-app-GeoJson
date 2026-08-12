import type { GeomapFeatureStore } from './store/feature-store';
import type { exportGeoJson, importGeoJson, toSafeSpreadsheetRows } from './io/geojson';
import type { neutralizeSpreadsheetFormula, sanitizeHtml, sanitizeUrl } from './security';
import type { AppConfig, GeomapVariant } from './types';

declare global {
  interface Window {
    GEOMAP_VARIANT?: GeomapVariant;
    GEOMAP_FEATURES?: Readonly<{ eventTracker: boolean }>;
    __PRELOADED_DATA__?: unknown;
    __PRELOADED_META__?: unknown;
    GeomapCore: Readonly<{
      config: AppConfig;
      store: GeomapFeatureStore;
      importGeoJson: typeof importGeoJson;
      exportGeoJson: typeof exportGeoJson;
      toSafeSpreadsheetRows: typeof toSafeSpreadsheetRows;
      sanitizeHtml: typeof sanitizeHtml;
      sanitizeUrl: typeof sanitizeUrl;
      neutralizeSpreadsheetFormula: typeof neutralizeSpreadsheetFormula;
      exportWorkspaceBackup: () => string;
      importWorkspaceBackup: (value: string) => void;
    }>;
  }
}

export {};
