import { describe, expect, it } from 'vitest';
import {
  WORKSPACE_STORAGE_KEY,
  exportWorkspaceBackup,
  importWorkspaceBackup,
  loadWorkspace,
  saveWorkspace,
  type StorageLike
} from '../../src/storage/workspace-storage';

function memoryStorage(seed: Record<string, string> = {}): StorageLike {
  const values = new Map(Object.entries(seed));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

describe('workspace migration', () => {
  it('imports legacy values without deleting them', () => {
    const storage = memoryStorage({ geomap_custom_groups: '[{"id":"g"}]' });
    const state = loadWorkspace(storage);
    expect(state.legacy.geomap_custom_groups).toEqual([{ id: 'g' }]);
    expect(storage.getItem('geomap_custom_groups')).not.toBeNull();
  });

  it('round-trips a versioned backup', () => {
    const storage = memoryStorage();
    const state = loadWorkspace(storage);
    saveWorkspace(storage, state);
    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).not.toBeNull();
    expect(importWorkspaceBackup(exportWorkspaceBackup(state))).toEqual(state);
  });
});
