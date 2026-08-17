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
  privateApiUrl: string | null;
  capabilities: {
    eventTracker: boolean;
    siteSelection: boolean;
    businessData: boolean;
    privateCollaboration: boolean;
    offlineEditing: boolean;
    fullMobileEditing: boolean;
  };
}

export type CollaborationRole = 'viewer' | 'editor' | 'admin' | 'owner';

export interface CollaborationUser {
  userId: string;
  organizationId: string;
  displayName: string;
  email: string;
  role: CollaborationRole;
  active: boolean;
  createdAt: string;
}

export interface OrganizationBrand {
  productName: string;
  primaryColor: string;
  logoUrl: string | null;
}

export interface CollaborationOrganization {
  organizationId: string;
  name: string;
  brand: OrganizationBrand;
  createdAt: string;
}

export interface RemoteWorkspaceSummary {
  workspaceId: string;
  organizationId: string;
  name: string;
  version: number;
  updatedAt: string;
  updatedBy: string;
}

export interface RemoteWorkspace extends RemoteWorkspaceSummary {
  state: WorkspaceState | null;
}

export interface WorkspaceComment {
  commentId: string;
  workspaceId: string;
  entityRef: string | null;
  body: string;
  authorId: string;
  mentionUserIds: string[];
  status: 'open' | 'resolved';
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
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

export type MetricPeriodicity = 'day' | 'week' | 'month' | 'quarter' | 'year';
export type MetricAggregation = 'sum' | 'average' | 'latest' | 'minimum' | 'maximum';

export interface MetricDefinition {
  metricKey: string;
  name: string;
  unit: string;
  periodicity: MetricPeriodicity;
  aggregation: MetricAggregation;
  format: 'number' | 'currency' | 'percent';
  description: string;
  healthyMin?: number;
  healthyMax?: number;
}

export interface MetricImportMapping {
  locationId: string;
  periodStart: string;
  periodEnd?: string;
  metricKey: string;
  value: string;
  unit?: string;
  target?: string;
}

export type MetricQualityCode =
  | 'missing-required'
  | 'unmatched-location'
  | 'invalid-number'
  | 'invalid-period'
  | 'duplicate-file'
  | 'duplicate-existing'
  | 'outlier';

export interface MetricQualityIssue {
  row: number;
  code: MetricQualityCode;
  severity: 'error' | 'warning';
  message: string;
}

export interface NormalizedMetricRow {
  row: number;
  key: string;
  locationId: string;
  periodStart: string;
  periodEnd: string;
  metricKey: string;
  value: number;
  unit?: string;
  target?: number;
  existingRecordId?: string;
}

export interface MetricImportPreview {
  sourceName: string;
  totalRows: number;
  validRows: NormalizedMetricRow[];
  issues: MetricQualityIssue[];
}

export interface MetricImportCommitResult {
  inserted: number;
  updated: number;
  skipped: number;
  source: DataSourceState;
}

export interface DataSourceAdapter<TInput = unknown> {
  kind: DataSourceState['kind'];
  preview(
    input: TInput,
    mapping: MetricImportMapping,
    workspace: Pick<WorkspaceState, 'locations' | 'records' | 'metricDefinitions'>
  ): Promise<MetricImportPreview>;
}

export interface DataSourceState {
  sourceId: string;
  name: string;
  kind: 'file' | 'api' | 'manual' | 'legacy';
  updatedAt: string;
  rowCount?: number;
  qualityStatus: 'ready' | 'warning' | 'error' | 'unknown';
  version?: number;
  columns?: string[];
  mapping?: MetricImportMapping;
  issueCount?: number;
}

export interface WorkspaceState {
  schemaVersion: 2;
  updatedAt: string;
  view: MapViewState;
  features: GeoJsonFeature[];
  locations: LocationEntity[];
  areas: JsonValue[];
  records: BusinessRecord[];
  metricDefinitions: MetricDefinition[];
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
  setMetricDefinitions(definitions: readonly MetricDefinition[]): void;
  setDataSources(sources: readonly DataSourceState[]): void;
  setSelectionModels(models: readonly SelectionModelState[]): void;
  setSelectionScenarios(scenarios: readonly SelectionScenarioState[]): void;
  setDecisions(decisions: readonly SelectionDecisionState[]): void;
  subscribe(listener: StoreListener): () => void;
}
