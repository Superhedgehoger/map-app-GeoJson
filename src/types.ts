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
    siteSelection: boolean;
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

export type LocationKind = 'store' | 'candidate' | 'competitor' | 'warehouse' | 'other';
export type LocationStatus = 'planned' | 'preparing' | 'open' | 'paused' | 'closed' | 'unknown';

export interface LocationEntity {
  locationId: string;
  name: string;
  kind: LocationKind;
  status: LocationStatus;
  brand?: string;
  region?: string;
  address?: string;
  openedAt?: string;
  closedAt?: string;
  geometry: GeoJsonGeometry | null;
  sourceFeatureId?: string | number;
  attributes: FeatureProperties;
}

export type BusinessRecordType = 'event' | 'metric' | 'state-change' | 'plan' | 'decision';

export interface BusinessRecord {
  recordId: string;
  recordType: BusinessRecordType;
  title: string;
  validFrom: string;
  validTo?: string;
  recordedAt: string;
  entityRefs: string[];
  areaRef?: string;
  geometry?: GeoJsonGeometry | null;
  status: 'draft' | 'confirmed' | 'void';
  sourceId?: string;
  revisionOf?: string;
  confidence: 'confirmed' | 'estimated' | 'forecast';
  payload: Record<string, JsonValue>;
  tags: string[];
  attachments?: JsonValue[];
  createdBy?: string;
}

export type HistoryGranularity = 'day' | 'month' | 'quarter' | 'year';

export interface TimeContext {
  mode: 'live' | 'historical';
  at: string;
  granularity: HistoryGranularity;
  playing: boolean;
  speed: 0.5 | 1 | 2 | 4;
}

export interface HistorySnapshot {
  at: string;
  locations: LocationEntity[];
  records: BusinessRecord[];
}

export interface HistoryFieldChange {
  field: 'status' | 'name' | 'region' | 'geometry' | 'kind';
  before: JsonValue;
  after: JsonValue;
}

export interface HistoryLocationChange {
  locationId: string;
  name: string;
  kind: 'added' | 'removed' | 'changed';
  changes: HistoryFieldChange[];
  recordIds: string[];
}

export interface HistoryComparison {
  from: string;
  to: string;
  added: number;
  removed: number;
  changed: number;
  changes: HistoryLocationChange[];
}

export interface MetricSummary {
  metricKey: string;
  value: number;
  unit?: string;
  observations: number;
  period: string;
}

export interface BusinessRecordDraft {
  recordType: BusinessRecordType;
  title: string;
  validFrom: string;
  validTo?: string;
  entityRefs: string[];
  areaRef?: string;
  geometry?: GeoJsonGeometry | null;
  status?: BusinessRecord['status'];
  sourceId?: string;
  revisionOf?: string;
  confidence?: BusinessRecord['confidence'];
  payload?: Record<string, JsonValue>;
  tags?: string[];
  attachments?: JsonValue[];
  createdBy?: string;
}

export type SelectionDirection = 'positive' | 'negative' | 'target' | 'threshold';
export type SelectionNormalization = 'min-max' | 'target-range' | 'segmented' | 'formula';
export type SelectionMissingPolicy = 'error' | 'eliminate' | 'neutral' | 'worst' | 'manual';

export interface SelectionCriterion {
  criterionId: string;
  name: string;
  sourceField: string;
  unit?: string;
  direction: SelectionDirection;
  normalization: SelectionNormalization;
  weight: number;
  group?: string;
  groupWeight?: number;
  missingPolicy: SelectionMissingPolicy;
  target?: number;
  threshold?: number;
  min?: number;
  max?: number;
  expression?: string;
  explanation: string;
}

export interface SelectionModelState {
  modelId: string;
  name: string;
  description: string;
  applicableRegion?: string;
  businessFormat?: string;
  template: 'mall' | 'street' | 'community' | 'blank';
  version: number;
  status: 'draft' | 'published' | 'retired';
  criteria: SelectionCriterion[];
  outputScale: 100;
  createdBy?: string;
  createdAt: string;
  publishedAt?: string;
}

export interface SelectionContribution {
  criterionId: string;
  name: string;
  rawValue: number | null;
  normalizedScore: number;
  weightedScore: number;
  explanation: string;
}

export interface CandidateSelectionResult {
  locationId: string;
  name: string;
  score: number;
  eligible: boolean;
  completeness: number;
  eliminatedReasons: string[];
  contributions: SelectionContribution[];
}

export interface SelectionScenarioState {
  scenarioId: string;
  name: string;
  modelId: string;
  modelVersion: number;
  candidateIds: string[];
  assumptions: Record<string, JsonValue>;
  results: CandidateSelectionResult[];
  status: 'draft' | 'completed';
  createdAt: string;
  completedAt?: string;
}

export interface SelectionDecisionState {
  decisionId: string;
  scenarioId: string;
  recommendedLocationId: string;
  conclusion: string;
  reasons: string[];
  decidedAt: string;
}

export interface DataSourceState {
  sourceId: string;
  name: string;
  kind: 'file' | 'api' | 'manual' | 'legacy';
  updatedAt: string;
  rowCount?: number;
  qualityStatus: 'ready' | 'warning' | 'error' | 'unknown';
}

export interface WorkspaceState {
  schemaVersion: 2;
  updatedAt: string;
  view: MapViewState;
  features: GeoJsonFeature[];
  locations: LocationEntity[];
  areas: JsonValue[];
  records: BusinessRecord[];
  eventSeries: JsonValue[];
  selectionModels: SelectionModelState[];
  selectionScenarios: SelectionScenarioState[];
  decisions: SelectionDecisionState[];
  savedViews: JsonValue[];
  dataSources: DataSourceState[];
  audit: JsonValue[];
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
  setRecords(records: readonly BusinessRecord[]): void;
  upsertRecord(record: BusinessRecord): void;
  setSavedViews(savedViews: readonly JsonValue[]): void;
  setSelectionModels(models: readonly SelectionModelState[]): void;
  setSelectionScenarios(scenarios: readonly SelectionScenarioState[]): void;
  setDecisions(decisions: readonly SelectionDecisionState[]): void;
  subscribe(listener: StoreListener): () => void;
}
