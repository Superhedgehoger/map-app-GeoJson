import type { FeatureStore, GeoJsonFeature, StoreListener, WorkspaceState } from '../types';

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
    this.#touch();
  }

  upsertFeature(feature: GeoJsonFeature): void {
    const id = feature.id;
    const index = id === undefined ? -1 : this.#state.features.findIndex((item) => item.id === id);
    if (index === -1) this.#state.features.push(clone(feature));
    else this.#state.features[index] = clone(feature);
    this.#touch();
  }

  removeFeature(id: string | number): boolean {
    const before = this.#state.features.length;
    this.#state.features = this.#state.features.filter((feature) => feature.id !== id);
    if (this.#state.features.length === before) return false;
    this.#touch();
    return true;
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
