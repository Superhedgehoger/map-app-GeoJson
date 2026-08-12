import { describe, expect, it, vi } from 'vitest';
import { GeomapFeatureStore } from '../../src/store/feature-store';
import { createEmptyWorkspace } from '../../src/storage/workspace-storage';

describe('FeatureStore', () => {
  it('publishes immutable feature changes', () => {
    const store = new GeomapFeatureStore(createEmptyWorkspace('2026-08-12T00:00:00.000Z'));
    const listener = vi.fn();
    store.subscribe(listener);
    store.upsertFeature({
      type: 'Feature',
      id: 'a',
      geometry: { type: 'Point', coordinates: [1, 2] },
      properties: { name: 'A' }
    });
    const state = store.getState();
    expect(state.features).toHaveLength(1);
    expect(listener).toHaveBeenCalledOnce();
    expect(store.removeFeature('a')).toBe(true);
    expect(store.removeFeature('missing')).toBe(false);
  });
});
