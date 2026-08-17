import { deriveLegacyRecords } from '../domain/history';
import type {
  BusinessRecord,
  BusinessRecordDraft,
  BusinessRecordType,
  LocationEntity
} from '../types';
import type { GeomapFeatureStore } from './feature-store';

function requiredIso(value: string, field: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${field} 必须是有效日期时间`);
  return date.toISOString();
}

function newRecordId(): string {
  const randomId = globalThis.crypto?.randomUUID?.();
  return `record-${randomId ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

export class GeomapRecordStore {
  readonly #workspace: GeomapFeatureStore;
  readonly #allowEventRecords: boolean;

  constructor(workspace: GeomapFeatureStore, allowEventRecords = true) {
    this.#workspace = workspace;
    this.#allowEventRecords = allowEventRecords;
  }

  list(): BusinessRecord[] {
    return [...this.#workspace.getState().records].sort(
      (left, right) => new Date(left.validFrom).getTime() - new Date(right.validFrom).getTime()
    );
  }

  add(draft: BusinessRecordDraft): BusinessRecord {
    const record = this.#buildRecord(draft);
    this.#workspace.upsertRecord(record);
    return record;
  }

  addMany(drafts: readonly BusinessRecordDraft[]): BusinessRecord[] {
    const records = drafts.map((draft) => this.#buildRecord(draft));
    if (!records.length) return [];
    this.#workspace.setRecords([...this.list(), ...records]);
    return records;
  }

  #buildRecord(draft: BusinessRecordDraft): BusinessRecord {
    this.#assertTypeAllowed(draft.recordType);
    const title = draft.title.trim();
    if (!title) throw new Error('记录标题不能为空');
    if (draft.entityRefs.length === 0 && !draft.areaRef) {
      throw new Error('记录必须关联位置或区域');
    }
    const validFrom = requiredIso(draft.validFrom, '发生时间');
    const validTo = draft.validTo ? requiredIso(draft.validTo, '结束时间') : undefined;
    if (validTo && new Date(validTo).getTime() < new Date(validFrom).getTime()) {
      throw new Error('结束时间不能早于发生时间');
    }
    const record: BusinessRecord = {
      recordId: newRecordId(),
      recordType: draft.recordType,
      title,
      validFrom,
      ...(validTo ? { validTo } : {}),
      recordedAt: new Date().toISOString(),
      entityRefs: [...new Set(draft.entityRefs.filter(Boolean))],
      ...(draft.areaRef ? { areaRef: draft.areaRef } : {}),
      ...(draft.geometry !== undefined ? { geometry: structuredClone(draft.geometry) } : {}),
      status: draft.status ?? 'confirmed',
      ...(draft.sourceId ? { sourceId: draft.sourceId } : {}),
      ...(draft.revisionOf ? { revisionOf: draft.revisionOf } : {}),
      confidence: draft.confidence ?? 'confirmed',
      payload: structuredClone(draft.payload ?? {}),
      tags: [...new Set(draft.tags ?? [])],
      ...(draft.attachments ? { attachments: structuredClone(draft.attachments) } : {}),
      ...(draft.createdBy ? { createdBy: draft.createdBy } : {})
    };
    return record;
  }

  revise(recordId: string, patch: Partial<BusinessRecordDraft>): BusinessRecord {
    const current = this.list().find((record) => record.recordId === recordId);
    if (!current) throw new Error('找不到要更正的记录');
    return this.add({
      recordType: patch.recordType ?? current.recordType,
      title: patch.title ?? current.title,
      validFrom: patch.validFrom ?? current.validFrom,
      validTo: patch.validTo ?? current.validTo,
      entityRefs: patch.entityRefs ?? current.entityRefs,
      areaRef: patch.areaRef ?? current.areaRef,
      geometry: patch.geometry ?? current.geometry,
      status: patch.status ?? 'confirmed',
      sourceId: patch.sourceId ?? current.sourceId,
      revisionOf: current.recordId,
      confidence: patch.confidence ?? current.confidence,
      payload: patch.payload ?? current.payload,
      tags: patch.tags ?? current.tags,
      attachments: patch.attachments ?? current.attachments,
      createdBy: patch.createdBy ?? current.createdBy
    });
  }

  void(recordId: string): BusinessRecord {
    return this.revise(recordId, { status: 'void' });
  }

  importLegacy(locations: readonly LocationEntity[]): number {
    const existing = new Set(this.list().map((record) => record.recordId));
    const derived = deriveLegacyRecords(locations).filter((record) => {
      if (!this.#allowEventRecords && record.recordType === 'event') return false;
      return !existing.has(record.recordId);
    });
    if (!derived.length) return 0;
    this.#workspace.setRecords([...this.list(), ...derived]);
    return derived.length;
  }

  #assertTypeAllowed(type: BusinessRecordType): void {
    if (type === 'event' && !this.#allowEventRecords) {
      throw new Error('Lite 版不支持事件记录');
    }
  }
}
