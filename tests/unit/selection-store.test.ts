import { describe, expect, it } from 'vitest';
import { createEmptyWorkspace } from '../../src/storage/workspace-storage';
import { GeomapFeatureStore } from '../../src/store/feature-store';
import { GeomapSelectionStore } from '../../src/store/selection-store';

describe('selection model version store', () => {
  it('keeps published versions and completed scenarios immutable by copy', () => {
    const workspace = createEmptyWorkspace('2026-08-01T00:00:00Z');
    workspace.locations = [
      {
        locationId: 'C1',
        name: '候选一',
        kind: 'candidate',
        status: 'planned',
        geometry: { type: 'Point', coordinates: [120, 36] },
        attributes: { footTraffic: 20000, rent: 30000, parking: 8, competitorDistance: 1200 }
      }
    ];
    const store = new GeomapFeatureStore(workspace);
    const selection = new GeomapSelectionStore(store);
    const draft = selection.create('street');
    const published = selection.publish(draft.modelId, draft.version);
    expect(() => selection.saveDraft({ ...published, name: '覆盖发布版' })).toThrow(/不可覆盖/);

    const scenario = selection.run(published.modelId, published.version, ['C1'], '首次分析');
    const whatIf = selection.copyScenario(scenario.scenarioId);
    const state = store.getState();
    expect(
      state.selectionScenarios.find((item) => item.scenarioId === scenario.scenarioId)?.results
    ).toHaveLength(1);
    expect(whatIf.results).toEqual([]);
    expect(whatIf.status).toBe('draft');

    const nextVersion = selection.copy(published.modelId, published.version);
    expect(nextVersion.version).toBe(2);
    expect(nextVersion.status).toBe('draft');
    expect(selection.listModels()).toHaveLength(2);
  });
});
