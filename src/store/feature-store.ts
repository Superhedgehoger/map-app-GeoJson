import type {
  BusinessRecord,
  FeatureStore,
  GeoJsonFeature,
  JsonValue,
  StoreListener,
  WorkspaceState
} from '../types';
import { deriveLocationsFromFeatures } from '../domain/locations';

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class GeomapFeatureStore implements FeatureStore {
  #state: WorkspaceState;
  #listeners = new Set<StoreListener>();

  constructor(initialState: WorkspaceState) {
    this.#state = clone(initialState);
  }

  getState(): Readonly<WorkspaceState> {
    return clone(this.#state);
  }

  replace(state: WorkspaceState): void {
    this.#state = clone(state);
    this.#emit();
  }

  setFeatures(features: readonly GeoJsonFeature[]): void {
    this.#state.features = clone([...features]);
    this.#state.locations = deriveLocationsFromFeatures(this.#state.features);
    this.#touch();
  }

  upsertFeature(feature: GeoJsonFeature): void {
    const id = feature.id;
    const index = id === undefined ? -1 : this.#state.features.findIndex((item) => item.id === id);
    if (index === -1) this.#state.features.push(clone(feature));
    else this.#state.features[index] = clone(feature);
    this.#state.locations = deriveLocationsFromFeatures(this.#state.features);
    this.#touch();
  }

  removeFeature(id: string | number): boolean {
    const before = this.#state.features.length;
    this.#state.features = this.#state.features.filter((feature) => feature.id !== id);
    if (this.#state.features.length === before) return false;
    this.#state.locations = deriveLocationsFromFeatures(this.#state.features);
    this.#touch();
    return true;
  }

  setRecords(records: readonly BusinessRecord[]): void {
    this.#state.records = clone([...records]);
    this.#touch();
  }

  upsertRecord(record: BusinessRecord): void {
    const index = this.#state.records.findIndex((item) => item.recordId === record.recordId);
    if (index === -1) this.#state.records.push(clone(record));
    else this.#state.records[index] = clone(record);
    this.#touch();
  }

  setSavedViews(savedViews: readonly JsonValue[]): void {
    this.#state.savedViews = clone([...savedViews]);
    this.#touch();
  }

  subscribe(listener: StoreListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #touch(): void {
    this.#state.updatedAt = new Date().toISOString();
    this.#emit();
  }

  #emit(): void {
    const snapshot = this.getState();
    this.#listeners.forEach((listener) => listener(snapshot));
  }
}
