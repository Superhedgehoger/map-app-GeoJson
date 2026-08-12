import type { GeoJsonFeature, MapAdapter, MapViewState } from '../types';

export abstract class BaseMapAdapter implements MapAdapter {
  abstract getView(): MapViewState;
  abstract setView(view: MapViewState): void;
  abstract render(features: readonly GeoJsonFeature[]): void;
  abstract setOffline(offline: boolean): void;
  abstract destroy(): void;
}
