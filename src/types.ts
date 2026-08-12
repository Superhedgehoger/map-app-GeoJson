export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface FeatureProperties {
  [key: string]: JsonValue | undefined;
  name?: string;
  type?: string;
  address?: string;
  events?: JsonValue[];
  'marker-color'?: string;
  'marker-symbol'?: string;
}

export interface GeoJsonGeometry {
  type: string;
  coordinates?: JsonValue;
  geometries?: GeoJsonGeometry[];
}

export interface GeoJsonFeature {
  type: 'Feature';
  id?: string | number;
  geometry: GeoJsonGeometry | null;
  properties: FeatureProperties;
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

export type GeomapVariant = 'full' | 'lite';

export interface AppConfig {
  variant: GeomapVariant;
  basePath: string;
  capabilities: {
    eventTracker: boolean;
    offlineEditing: boolean;
    fullMobileEditing: boolean;
  };
}

export interface MapViewState {
  center: [number, number];
  zoom: number;
  baseLayer: string;
}

export interface SnapshotState {
  id: string;
  name: string;
  createdAt: string;
  view: MapViewState;
  features: GeoJsonFeature[];
}

export interface WorkspaceState {
  schemaVersion: 1;
  updatedAt: string;
  view: MapViewState;
  features: GeoJsonFeature[];
  groups: JsonValue[];
  snapshots: SnapshotState[];
  popupConfig: JsonValue | null;
  legacy: Record<string, JsonValue>;
}

export interface ImportError {
  index: number | null;
  code: 'invalid-json' | 'invalid-root' | 'invalid-feature' | 'unsupported-geometry';
  message: string;
}

export interface ImportResult {
  collection: GeoJsonFeatureCollection;
  imported: number;
  skipped: number;
  errors: ImportError[];
}

export interface MapAdapter {
  getView(): MapViewState;
  setView(view: MapViewState): void;
  render(features: readonly GeoJsonFeature[]): void;
  setOffline(offline: boolean): void;
  destroy(): void;
}

export type StoreListener = (state: Readonly<WorkspaceState>) => void;

export interface FeatureStore {
  getState(): Readonly<WorkspaceState>;
  replace(state: WorkspaceState): void;
  setFeatures(features: readonly GeoJsonFeature[]): void;
  upsertFeature(feature: GeoJsonFeature): void;
  removeFeature(id: string | number): boolean;
  subscribe(listener: StoreListener): () => void;
}
