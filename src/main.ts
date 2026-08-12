import { createAppConfig } from './config';
import { importGeoJson, exportGeoJson, toSafeSpreadsheetRows } from './io/geojson';
import { sanitizeHtml, sanitizeUrl, neutralizeSpreadsheetFormula } from './security';
import { GeomapFeatureStore } from './store/feature-store';
import {
  exportWorkspaceBackup,
  importWorkspaceBackup,
  loadWorkspace,
  saveWorkspace
} from './storage/workspace-storage';

const REQUIRED_CONTROLS = ['map', 'controls', 'layerPanel'] as const;
const OPTIONAL_CONTROLS = [
  'btn-show-layer-panel',
  'exportSinglePageBtn',
  'toggleTableBtn'
] as const;

function syncNetworkStatus(): void {
  document.body.classList.toggle('is-offline', !navigator.onLine);
  document.body.dataset.networkStatus = navigator.onLine ? 'online' : 'offline';
}

function queryControls(): Readonly<Record<string, HTMLElement | null>> {
  return Object.freeze(
    Object.fromEntries(
      [...REQUIRED_CONTROLS, ...OPTIONAL_CONTROLS].map((id) => [id, document.getElementById(id)])
    )
  );
}

export function bootstrapApp(): void {
  const controls = queryControls();
  const missingRequired = REQUIRED_CONTROLS.filter((id) => !controls[id]);
  if (missingRequired.length > 0) {
    console.error(
      `[Geomap bootstrap] Missing required controls: ${missingRequired.map((id) => `#${id}`).join(', ')}`
    );
    document.documentElement.dataset.geomapCore = 'error';
    return;
  }

  const config = createAppConfig({ explicitVariant: window.GEOMAP_VARIANT });
  const workspace = loadWorkspace(window.localStorage);
  const store = new GeomapFeatureStore(workspace);
  store.subscribe((nextState) => saveWorkspace(window.localStorage, nextState));

  window.addEventListener('online', syncNetworkStatus);
  window.addEventListener('offline', syncNetworkStatus);
  syncNetworkStatus();

  window.GEOMAP_VARIANT = config.variant;
  window.GEOMAP_FEATURES = Object.freeze({ eventTracker: config.capabilities.eventTracker });
  window.GeomapCore = Object.freeze({
    config,
    store,
    importGeoJson,
    exportGeoJson,
    toSafeSpreadsheetRows,
    sanitizeHtml,
    sanitizeUrl,
    neutralizeSpreadsheetFormula,
    exportWorkspaceBackup: () => exportWorkspaceBackup(store.getState()),
    importWorkspaceBackup: (value: string) => store.replace(importWorkspaceBackup(value))
  });

  document.documentElement.dataset.geomapCore = 'v3';
}

bootstrapApp();
