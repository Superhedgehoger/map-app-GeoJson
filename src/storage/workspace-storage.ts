import type { JsonValue, WorkspaceState } from '../types';

export const WORKSPACE_STORAGE_KEY = 'geomap.workspace.v1';
const LEGACY_KEYS = [
  'geomap_custom_groups',
  'geomap_snapshots',
  'geomap_popup_config',
  'map_events_data',
  'archive_list',
  'code_archive_list'
] as const;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createEmptyWorkspace(now = new Date().toISOString()): WorkspaceState {
  return {
    schemaVersion: 1,
    updatedAt: now,
    view: { center: [36.0671, 120.3826], zoom: 12, baseLayer: 'osm' },
    features: [],
    groups: [],
    snapshots: [],
    popupConfig: null,
    legacy: {}
  };
}

function parseLegacy(value: string): JsonValue {
  try {
    return JSON.parse(value) as JsonValue;
  } catch {
    return value;
  }
}

export function migrateLegacyWorkspace(storage: StorageLike): WorkspaceState {
  const workspace = createEmptyWorkspace();
  for (const key of LEGACY_KEYS) {
    const value = storage.getItem(key);
    if (value !== null) workspace.legacy[key] = parseLegacy(value);
  }
  return workspace;
}

export function loadWorkspace(storage: StorageLike): WorkspaceState {
  const stored = storage.getItem(WORKSPACE_STORAGE_KEY);
  if (!stored) return migrateLegacyWorkspace(storage);
  try {
    const parsed = JSON.parse(stored) as Partial<WorkspaceState>;
    if (parsed.schemaVersion !== 1) return migrateLegacyWorkspace(storage);
    return { ...createEmptyWorkspace(), ...parsed, schemaVersion: 1 } as WorkspaceState;
  } catch {
    return migrateLegacyWorkspace(storage);
  }
}

export function saveWorkspace(storage: StorageLike, workspace: WorkspaceState): void {
  storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
}

export function exportWorkspaceBackup(workspace: WorkspaceState): string {
  return JSON.stringify(workspace, null, 2);
}

export function importWorkspaceBackup(value: string): WorkspaceState {
  const parsed = JSON.parse(value) as Partial<WorkspaceState>;
  if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.features)) {
    throw new Error('Unsupported or invalid Geomap workspace backup.');
  }
  return { ...createEmptyWorkspace(), ...parsed, schemaVersion: 1 } as WorkspaceState;
}
