import type {
  BusinessRecord,
  FeatureProperties,
  HistoryComparison,
  HistoryFieldChange,
  HistoryLocationChange,
  HistorySnapshot,
  JsonValue,
  LocationEntity,
  LocationStatus,
  MetricSummary
} from '../types';

const STATUS_ALIASES: Record<string, LocationStatus> = {
  planned: 'planned',
  计划: 'planned',
  规划: 'planned',
  preparing: 'preparing',
  筹备: 'preparing',
  在建: 'preparing',
  open: 'open',
  在营: 'open',
  营业: 'open',
  paused: 'paused',
  暂停: 'paused',
  停业: 'paused',
  closed: 'closed',
  闭店: 'closed',
  关闭: 'closed',
  unknown: 'unknown'
};

function time(value: string | undefined): number {
  if (!value) return Number.NaN;
  return new Date(value).getTime();
}

function isAtOrBefore(value: string | undefined, at: number): boolean {
  const parsed = time(value);
  return Number.isFinite(parsed) && parsed <= at;
}

function hash(value: string): string {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function text(value: JsonValue | undefined): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeStatus(value: JsonValue | undefined): LocationStatus | undefined {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return STATUS_ALIASES[normalized];
}

function rootRecordId(record: BusinessRecord, records: readonly BusinessRecord[]): string {
  let current = record;
  const visited = new Set<string>();
  while (current.revisionOf && !visited.has(current.recordId)) {
    visited.add(current.recordId);
    const parent = records.find((item) => item.recordId === current.revisionOf);
    if (!parent) break;
    current = parent;
  }
  return current.recordId;
}

export function resolveRecordRevisions(records: readonly BusinessRecord[]): BusinessRecord[] {
  const latest = new Map<string, BusinessRecord>();
  records.forEach((record) => {
    const root = rootRecordId(record, records);
    const existing = latest.get(root);
    if (!existing || time(record.recordedAt) >= time(existing.recordedAt)) latest.set(root, record);
  });
  return [...latest.values()].filter((record) => record.status !== 'void');
}

export function recordsThroughTime(
  records: readonly BusinessRecord[],
  atIso: string
): BusinessRecord[] {
  const at = time(atIso);
  if (!Number.isFinite(at)) return [];
  return resolveRecordRevisions(records)
    .filter((record) => isAtOrBefore(record.validFrom, at))
    .sort((left, right) => time(left.validFrom) - time(right.validFrom));
}

export function aggregateMetricsAtTime(
  records: readonly BusinessRecord[],
  atIso: string
): MetricSummary[] {
  const at = time(atIso);
  if (!Number.isFinite(at)) return [];
  const latest = new Map<string, BusinessRecord>();
  resolveRecordRevisions(records)
    .filter(
      (record) =>
        record.recordType === 'metric' &&
        isAtOrBefore(record.validFrom, at) &&
        typeof record.payload.metricKey === 'string' &&
        typeof record.payload.value === 'number'
    )
    .forEach((record) => {
      const key = `${record.entityRefs[0] ?? ''}:${String(record.payload.metricKey)}`;
      const existing = latest.get(key);
      if (!existing || time(record.validFrom) >= time(existing.validFrom)) latest.set(key, record);
    });
  const summaries = new Map<string, MetricSummary>();
  latest.forEach((record) => {
    const metricKey = String(record.payload.metricKey);
    const existing = summaries.get(metricKey) ?? {
      metricKey,
      value: 0,
      observations: 0,
      period: record.validFrom.slice(0, 7)
    };
    existing.value += Number(record.payload.value);
    existing.observations += 1;
    if (typeof record.payload.unit === 'string') existing.unit = record.payload.unit;
    if (record.validFrom.slice(0, 7) > existing.period) {
      existing.period = record.validFrom.slice(0, 7);
    }
    summaries.set(metricKey, existing);
  });
  return [...summaries.values()].sort((left, right) =>
    left.metricKey.localeCompare(right.metricKey)
  );
}

function lifecycleIncludes(location: LocationEntity, at: number): boolean {
  const plannedAt = text(location.attributes.plannedAt) ?? text(location.attributes.createdAt);
  const existedFrom = location.openedAt ?? plannedAt;
  if (existedFrom && !isAtOrBefore(existedFrom, at)) return false;
  return true;
}

function applyStateRecord(location: LocationEntity, record: BusinessRecord): LocationEntity {
  const payload = record.payload;
  const status = normalizeStatus(payload.status);
  const kind = text(payload.kind);
  const next: LocationEntity = {
    ...location,
    attributes: { ...location.attributes },
    ...(status ? { status } : {}),
    ...(text(payload.name) ? { name: text(payload.name)! } : {}),
    ...(text(payload.region) ? { region: text(payload.region)! } : {}),
    ...(text(payload.address) ? { address: text(payload.address)! } : {})
  };
  if (
    kind === 'store' ||
    kind === 'candidate' ||
    kind === 'competitor' ||
    kind === 'warehouse' ||
    kind === 'other'
  ) {
    next.kind = kind;
  }
  const longitude = typeof payload.longitude === 'number' ? payload.longitude : undefined;
  const latitude = typeof payload.latitude === 'number' ? payload.latitude : undefined;
  if (longitude !== undefined && latitude !== undefined) {
    next.geometry = { type: 'Point', coordinates: [longitude, latitude] };
  }
  return next;
}

export function reconstructHistorySnapshot(
  locations: readonly LocationEntity[],
  records: readonly BusinessRecord[],
  atIso: string
): HistorySnapshot {
  const at = time(atIso);
  if (!Number.isFinite(at)) return { at: atIso, locations: [], records: [] };
  const resolved = resolveRecordRevisions(records);
  const through = recordsThroughTime(resolved, atIso);
  const locationState = locations
    .filter((location) => lifecycleIncludes(location, at))
    .map((location) => {
      const stateChanges = through.filter(
        (record) =>
          record.recordType === 'state-change' && record.entityRefs.includes(location.locationId)
      );
      const initial = structuredClone(location);
      const firstFutureState = resolved
        .filter(
          (record) =>
            record.recordType === 'state-change' &&
            record.entityRefs.includes(location.locationId) &&
            time(record.validFrom) > at
        )
        .sort((left, right) => time(left.validFrom) - time(right.validFrom))[0];
      const futureStatus = normalizeStatus(firstFutureState?.payload.status);
      if (firstFutureState && futureStatus === initial.status) {
        initial.status = normalizeStatus(firstFutureState.payload.previousStatus) ?? 'open';
      }
      if (initial.status === 'closed' && initial.closedAt && !isAtOrBefore(initial.closedAt, at)) {
        initial.status = 'open';
      }
      return stateChanges.reduce(applyStateRecord, initial);
    });
  return { at: atIso, locations: locationState, records: through };
}

function equalJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function fieldChanges(before: LocationEntity, after: LocationEntity): HistoryFieldChange[] {
  const values: Array<[HistoryFieldChange['field'], JsonValue, JsonValue]> = [
    ['status', before.status, after.status],
    ['name', before.name, after.name],
    ['region', before.region ?? null, after.region ?? null],
    ['kind', before.kind, after.kind],
    [
      'geometry',
      (before.geometry as JsonValue | null) ?? null,
      (after.geometry as JsonValue | null) ?? null
    ]
  ];
  return values
    .filter(([, left, right]) => !equalJson(left, right))
    .map(([field, beforeValue, afterValue]) => ({ field, before: beforeValue, after: afterValue }));
}

export function compareHistorySnapshots(
  from: HistorySnapshot,
  to: HistorySnapshot
): HistoryComparison {
  const before = new Map(from.locations.map((location) => [location.locationId, location]));
  const after = new Map(to.locations.map((location) => [location.locationId, location]));
  const changes: HistoryLocationChange[] = [];
  before.forEach((location, locationId) => {
    const next = after.get(locationId);
    if (!next) {
      changes.push({
        locationId,
        name: location.name,
        kind: 'removed',
        changes: [],
        recordIds: []
      });
      return;
    }
    const changedFields = fieldChanges(location, next);
    if (changedFields.length) {
      changes.push({
        locationId,
        name: next.name,
        kind: 'changed',
        changes: changedFields,
        recordIds: to.records
          .filter((record) => record.entityRefs.includes(locationId))
          .map((record) => record.recordId)
      });
    }
  });
  after.forEach((location, locationId) => {
    if (!before.has(locationId)) {
      changes.push({
        locationId,
        name: location.name,
        kind: 'added',
        changes: [],
        recordIds: to.records
          .filter((record) => record.entityRefs.includes(locationId))
          .map((record) => record.recordId)
      });
    }
  });
  return {
    from: from.at,
    to: to.at,
    added: changes.filter((item) => item.kind === 'added').length,
    removed: changes.filter((item) => item.kind === 'removed').length,
    changed: changes.filter((item) => item.kind === 'changed').length,
    changes
  };
}

export function deriveLegacyRecords(locations: readonly LocationEntity[]): BusinessRecord[] {
  const records: BusinessRecord[] = [];
  locations.forEach((location) => {
    if (location.openedAt) {
      records.push({
        recordId: `lifecycle-open-${hash(location.locationId)}`,
        recordType: 'state-change',
        title: `${location.name}开业`,
        validFrom: location.openedAt,
        recordedAt: location.openedAt,
        entityRefs: [location.locationId],
        status: 'confirmed',
        sourceId: 'geojson-lifecycle',
        confidence: 'confirmed',
        payload: { status: 'open' },
        tags: ['生命周期', '开业']
      });
    }
    if (location.closedAt) {
      records.push({
        recordId: `lifecycle-close-${hash(location.locationId)}`,
        recordType: 'state-change',
        title: `${location.name}闭店`,
        validFrom: location.closedAt,
        recordedAt: location.closedAt,
        entityRefs: [location.locationId],
        status: 'confirmed',
        sourceId: 'geojson-lifecycle',
        confidence: 'confirmed',
        payload: { status: 'closed' },
        tags: ['生命周期', '闭店']
      });
    }
    const legacyEvents = [
      ...(Array.isArray(location.attributes.events) ? location.attributes.events : []),
      ...(Array.isArray(location.attributes.businessRecords)
        ? location.attributes.businessRecords
        : [])
    ];
    legacyEvents.forEach((raw, index) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
      const event = raw as FeatureProperties;
      const validFrom =
        text(event.validFrom) ?? text(event.createdAt) ?? text(event.created) ?? text(event.date);
      if (!validFrom || !Number.isFinite(time(validFrom))) return;
      const title = text(event.title) ?? text(event.name) ?? `历史事件 ${index + 1}`;
      const requestedType = text(event.recordType) ?? text(event.type);
      const recordType =
        requestedType === 'metric' ||
        requestedType === 'state-change' ||
        requestedType === 'plan' ||
        requestedType === 'decision'
          ? requestedType
          : 'event';
      const status = normalizeStatus(event.status);
      records.push({
        recordId: `legacy-event-${hash(`${location.locationId}:${String(event.id ?? index)}:${validFrom}`)}`,
        recordType,
        title,
        validFrom,
        recordedAt: text(event.recordedAt) ?? validFrom,
        entityRefs: [location.locationId],
        status: 'confirmed',
        sourceId: 'geojson-events',
        confidence: 'confirmed',
        payload: {
          ...(raw as Record<string, JsonValue>),
          legacy: raw,
          ...(status ? { status } : {})
        },
        tags: ['历史事件']
      });
    });
    const plannedAt = text(location.attributes.plannedAt);
    if (plannedAt && Number.isFinite(time(plannedAt))) {
      records.push({
        recordId: `lifecycle-plan-${hash(location.locationId)}`,
        recordType: 'plan',
        title: `${location.name}进入候选`,
        validFrom: plannedAt,
        recordedAt: plannedAt,
        entityRefs: [location.locationId],
        status: 'confirmed',
        sourceId: 'geojson-lifecycle',
        confidence: 'confirmed',
        payload: { status: location.status },
        tags: ['生命周期', '候选']
      });
    }
  });
  return records;
}

export function historyBounds(
  locations: readonly LocationEntity[],
  records: readonly BusinessRecord[],
  now = new Date().toISOString()
): { min: string; max: string } {
  const values = [
    ...locations.flatMap((location) => [location.openedAt, location.closedAt]),
    ...records.flatMap((record) => [record.validFrom, record.validTo]),
    now
  ]
    .filter((value): value is string => Boolean(value) && Number.isFinite(time(value)))
    .map((value) => new Date(value).toISOString());
  values.sort((left, right) => time(left) - time(right));
  return { min: values[0] ?? now, max: values.at(-1) ?? now };
}
