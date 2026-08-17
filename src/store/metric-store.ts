import { defaultMetricDefinitions } from '../domain/business-data';
import type {
  DataSourceState,
  MetricDefinition,
  MetricImportCommitResult,
  MetricImportMapping,
  MetricImportPreview
} from '../types';
import type { GeomapFeatureStore } from './feature-store';
import type { GeomapRecordStore } from './record-store';

export type DuplicatePolicy = 'update' | 'skip' | 'error';

export class GeomapMetricStore {
  readonly #workspace: GeomapFeatureStore;
  readonly #records: GeomapRecordStore;

  constructor(workspace: GeomapFeatureStore, records: GeomapRecordStore) {
    this.#workspace = workspace;
    this.#records = records;
    if (!workspace.getState().metricDefinitions.length) {
      workspace.setMetricDefinitions(defaultMetricDefinitions());
    }
  }

  definitions(): MetricDefinition[] {
    return structuredClone(this.#workspace.getState().metricDefinitions);
  }

  saveDefinition(definition: MetricDefinition): void {
    const definitions = this.definitions();
    const index = definitions.findIndex((item) => item.metricKey === definition.metricKey);
    if (!definition.metricKey.trim() || !definition.name.trim()) {
      throw new Error('指标编码和名称不能为空。');
    }
    if (index === -1) definitions.push(structuredClone(definition));
    else definitions[index] = structuredClone(definition);
    this.#workspace.setMetricDefinitions(definitions);
  }

  importPreview(
    preview: MetricImportPreview,
    duplicatePolicy: DuplicatePolicy,
    mapping: MetricImportMapping,
    columns: string[],
    kind: DataSourceState['kind'] = 'file'
  ): MetricImportCommitResult {
    const fatalIssues = preview.issues.filter((issue) => issue.severity === 'error');
    if (fatalIssues.length) {
      throw new Error(`质量预览仍有 ${fatalIssues.length} 个错误，不能入库。`);
    }
    const duplicates = preview.validRows.filter((row) => row.existingRecordId);
    if (duplicatePolicy === 'error' && duplicates.length) {
      throw new Error(`发现 ${duplicates.length} 个已有复合主键，请选择更新或跳过。`);
    }
    const sourceId = `source-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`;
    const accepted = preview.validRows.filter(
      (row) => !(duplicatePolicy === 'skip' && row.existingRecordId)
    );
    this.#records.addMany(
      accepted.map((row) => ({
        recordType: 'metric',
        title: `${row.metricKey} ${row.periodStart}`,
        validFrom: row.periodStart,
        validTo: row.periodEnd,
        entityRefs: [row.locationId],
        sourceId,
        ...(row.existingRecordId ? { revisionOf: row.existingRecordId } : {}),
        confidence: 'confirmed',
        payload: {
          metricKey: row.metricKey,
          value: row.value,
          periodStart: row.periodStart,
          periodEnd: row.periodEnd,
          ...(row.unit ? { unit: row.unit } : {}),
          ...(row.target !== undefined ? { target: row.target } : {}),
          observationKey: row.key
        },
        tags: ['经营数据', '批量导入']
      }))
    );
    const state = this.#workspace.getState();
    const previousVersions = state.dataSources
      .filter((source) => source.name === preview.sourceName)
      .map((source) => source.version ?? 1);
    const source: DataSourceState = {
      sourceId,
      name: preview.sourceName,
      kind,
      updatedAt: new Date().toISOString(),
      rowCount: preview.totalRows,
      qualityStatus: preview.issues.length ? 'warning' : 'ready',
      version: Math.max(0, ...previousVersions) + 1,
      columns: [...columns],
      mapping: structuredClone(mapping),
      issueCount: preview.issues.length
    };
    this.#workspace.setDataSources([...state.dataSources, source]);
    return {
      inserted: accepted.filter((row) => !row.existingRecordId).length,
      updated: accepted.filter((row) => row.existingRecordId).length,
      skipped: preview.validRows.length - accepted.length,
      source
    };
  }
}
