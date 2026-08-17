import type {
  BusinessRecord,
  LocationEntity,
  MetricDefinition,
  MetricImportMapping,
  MetricImportPreview,
  MetricQualityIssue,
  NormalizedMetricRow
} from '../types';
import { resolveRecordRevisions } from './history';

export type TabularRow = Record<string, unknown>;

export interface MetricDashboard {
  metricKey: string;
  period: string;
  total: number;
  average: number;
  observations: number;
  targetAttainment: number | null;
  previousChange: number | null;
  yearChange: number | null;
  byLocation: { locationId: string; value: number; target: number | null }[];
  byRegion: { region: string; value: number; observations: number }[];
  trend: { period: string; value: number }[];
  anomalies: { locationId: string; value: number; reason: string }[];
}

const DEFAULT_DEFINITIONS: MetricDefinition[] = [
  {
    metricKey: 'revenue',
    name: '营业收入',
    unit: '元',
    periodicity: 'month',
    aggregation: 'sum',
    format: 'currency',
    description: '门店当期含税营业收入',
    healthyMin: 0
  },
  {
    metricKey: 'orders',
    name: '订单量',
    unit: '单',
    periodicity: 'month',
    aggregation: 'sum',
    format: 'number',
    description: '门店当期有效订单数',
    healthyMin: 0
  },
  {
    metricKey: 'footTraffic',
    name: '到店客流',
    unit: '人',
    periodicity: 'month',
    aggregation: 'sum',
    format: 'number',
    description: '门店当期到店人数',
    healthyMin: 0
  },
  {
    metricKey: 'conversionRate',
    name: '转化率',
    unit: '%',
    periodicity: 'month',
    aggregation: 'average',
    format: 'percent',
    description: '订单量除以有效客流',
    healthyMin: 0,
    healthyMax: 100
  },
  {
    metricKey: 'operatingProfit',
    name: '经营利润',
    unit: '元',
    periodicity: 'month',
    aggregation: 'sum',
    format: 'currency',
    description: '门店当期经营利润'
  }
];

export function defaultMetricDefinitions(): MetricDefinition[] {
  return structuredClone(DEFAULT_DEFINITIONS);
}

export function parseCsvTable(text: string): TabularRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (quoted && character === '"' && text[index + 1] === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') quoted = !quoted;
    else if (!quoted && character === ',') {
      row.push(field.trim());
      field = '';
    } else if (!quoted && (character === '\n' || character === '\r')) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field.trim());
      field = '';
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else field += character;
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  const headers = rows.shift()?.map((header) => header.replace(/^\uFEFF/, '')) ?? [];
  return rows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
  );
}

function text(row: TabularRow, column?: string): string {
  if (!column) return '';
  const value = row[column];
  return value === undefined || value === null ? '' : String(value).trim();
}

function isoDate(value: string): string | null {
  const expanded = /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value;
  const date = new Date(`${expanded}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function periodEnd(start: string, definition?: MetricDefinition): string {
  const date = new Date(`${start}T00:00:00Z`);
  const periodicity = definition?.periodicity ?? 'month';
  if (periodicity === 'day') return start;
  if (periodicity === 'week') date.setUTCDate(date.getUTCDate() + 6);
  if (periodicity === 'month') {
    date.setUTCMonth(date.getUTCMonth() + 1);
    date.setUTCDate(0);
  }
  if (periodicity === 'quarter') {
    date.setUTCMonth(date.getUTCMonth() + 3);
    date.setUTCDate(0);
  }
  if (periodicity === 'year') {
    date.setUTCFullYear(date.getUTCFullYear() + 1);
    date.setUTCDate(0);
  }
  return date.toISOString().slice(0, 10);
}

export function metricObservationKey(
  locationId: string,
  periodStart: string,
  periodEndValue: string,
  metricKey: string
): string {
  return `${locationId}|${periodStart}|${periodEndValue}|${metricKey}`;
}

function existingObservationKey(
  record: BusinessRecord,
  definitionByKey: ReadonlyMap<string, MetricDefinition>
): string | null {
  if (record.recordType !== 'metric' || record.status === 'void') return null;
  const metricKey =
    typeof record.payload.metricKey === 'string' ? record.payload.metricKey.trim() : '';
  const locationId = record.entityRefs[0] ?? '';
  const startValue =
    typeof record.payload.periodStart === 'string'
      ? record.payload.periodStart
      : record.validFrom.slice(0, 10);
  const start = isoDate(startValue);
  if (!locationId || !metricKey || !start) return null;
  const endValue =
    typeof record.payload.periodEnd === 'string'
      ? record.payload.periodEnd
      : (record.validTo?.slice(0, 10) ?? periodEnd(start, definitionByKey.get(metricKey)));
  const end = isoDate(endValue) ?? start;
  return metricObservationKey(locationId, start, end, metricKey);
}

export function previewMetricImport(
  sourceName: string,
  rows: readonly TabularRow[],
  mapping: MetricImportMapping,
  locations: readonly LocationEntity[],
  definitions: readonly MetricDefinition[],
  existingRecords: readonly BusinessRecord[]
): MetricImportPreview {
  const locationIds = new Set(locations.map((location) => location.locationId));
  const definitionByKey = new Map(
    definitions.map((definition) => [definition.metricKey, definition])
  );
  const existingByKey = new Map<string, BusinessRecord>();
  existingRecords.forEach((record) => {
    const key = existingObservationKey(record, definitionByKey);
    if (key) existingByKey.set(key, record);
  });
  const seen = new Set<string>();
  const issues: MetricQualityIssue[] = [];
  const validRows: NormalizedMetricRow[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const locationId = text(row, mapping.locationId);
    const metricKey = text(row, mapping.metricKey);
    const start = isoDate(text(row, mapping.periodStart));
    const definition = definitionByKey.get(metricKey);
    const explicitEnd = isoDate(text(row, mapping.periodEnd));
    const end = start ? (explicitEnd ?? periodEnd(start, definition)) : null;
    const rawValue = text(row, mapping.value).replaceAll(',', '');
    const value = Number(rawValue);
    const required = [locationId, metricKey, text(row, mapping.periodStart), rawValue];
    if (required.some((item) => !item)) {
      issues.push({
        row: rowNumber,
        code: 'missing-required',
        severity: 'error',
        message: '缺少门店、周期、指标或数值。'
      });
      return;
    }
    if (!locationIds.has(locationId)) {
      issues.push({
        row: rowNumber,
        code: 'unmatched-location',
        severity: 'error',
        message: `无法匹配位置 ${locationId}。`
      });
      return;
    }
    if (!start || !end || end < start) {
      issues.push({
        row: rowNumber,
        code: 'invalid-period',
        severity: 'error',
        message: '周期日期无效或结束早于开始。'
      });
      return;
    }
    if (!Number.isFinite(value)) {
      issues.push({
        row: rowNumber,
        code: 'invalid-number',
        severity: 'error',
        message: `数值 ${rawValue} 无法解析。`
      });
      return;
    }
    const key = metricObservationKey(locationId, start, end, metricKey);
    if (seen.has(key)) {
      issues.push({
        row: rowNumber,
        code: 'duplicate-file',
        severity: 'error',
        message: '文件内存在相同门店、周期和指标。'
      });
      return;
    }
    seen.add(key);
    const existing = existingByKey.get(key);
    if (existing) {
      issues.push({
        row: rowNumber,
        code: 'duplicate-existing',
        severity: 'warning',
        message: '工作区已有同一复合主键，提交时必须选择处理策略。'
      });
    }
    if (
      (definition?.healthyMin !== undefined && value < definition.healthyMin) ||
      (definition?.healthyMax !== undefined && value > definition.healthyMax)
    ) {
      issues.push({
        row: rowNumber,
        code: 'outlier',
        severity: 'warning',
        message: `${definition.name} 超出健康范围。`
      });
    }
    const targetText = text(row, mapping.target).replaceAll(',', '');
    validRows.push({
      row: rowNumber,
      key,
      locationId,
      periodStart: start,
      periodEnd: end,
      metricKey,
      value,
      ...(text(row, mapping.unit) || definition?.unit
        ? { unit: text(row, mapping.unit) || definition?.unit }
        : {}),
      ...(targetText && Number.isFinite(Number(targetText)) ? { target: Number(targetText) } : {}),
      ...(existing ? { existingRecordId: existing.recordId } : {})
    });
  });
  return { sourceName, totalRows: rows.length, validRows, issues };
}

function observation(record: BusinessRecord): {
  locationId: string;
  period: string;
  metricKey: string;
  value: number;
  target: number | null;
} | null {
  if (
    record.recordType !== 'metric' ||
    record.status === 'void' ||
    typeof record.payload.metricKey !== 'string' ||
    typeof record.payload.value !== 'number' ||
    !record.entityRefs[0]
  ) {
    return null;
  }
  return {
    locationId: record.entityRefs[0],
    period:
      typeof record.payload.periodStart === 'string'
        ? record.payload.periodStart.slice(0, 7)
        : record.validFrom.slice(0, 7),
    metricKey: record.payload.metricKey,
    value: record.payload.value,
    target: typeof record.payload.target === 'number' ? record.payload.target : null
  };
}

export function buildMetricDashboard(
  records: readonly BusinessRecord[],
  locations: readonly LocationEntity[],
  definition: MetricDefinition,
  requestedPeriod?: string
): MetricDashboard {
  const observations = resolveRecordRevisions(records)
    .map(observation)
    .filter((item): item is NonNullable<ReturnType<typeof observation>> => !!item)
    .filter((item) => item.metricKey === definition.metricKey);
  const periods = [...new Set(observations.map((item) => item.period))].sort();
  const period =
    requestedPeriod && periods.includes(requestedPeriod) ? requestedPeriod : (periods.at(-1) ?? '');
  const current = observations.filter((item) => item.period === period);
  const total = current.reduce((sum, item) => sum + item.value, 0);
  const target = current.reduce((sum, item) => sum + (item.target ?? 0), 0);
  const totalForPeriod = (value: string | undefined): number | null => {
    if (!value) return null;
    const items = observations.filter((item) => item.period === value);
    return items.length ? items.reduce((sum, item) => sum + item.value, 0) : null;
  };
  const periodIndex = periods.indexOf(period);
  const previous = totalForPeriod(periods[periodIndex - 1]);
  const yearPeriod = period ? `${Number(period.slice(0, 4)) - 1}${period.slice(4)}` : undefined;
  const year = totalForPeriod(yearPeriod);
  const change = (baseline: number | null): number | null =>
    baseline && baseline !== 0
      ? Number((((total - baseline) / Math.abs(baseline)) * 100).toFixed(1))
      : null;
  const regionById = new Map(
    locations.map((location) => [location.locationId, location.region ?? '未分区'])
  );
  const regionValues = new Map<string, { value: number; observations: number }>();
  current.forEach((item) => {
    const region = regionById.get(item.locationId) ?? '未分区';
    const existing = regionValues.get(region) ?? { value: 0, observations: 0 };
    existing.value += item.value;
    existing.observations += 1;
    regionValues.set(region, existing);
  });
  const healthyValues = current.map((item) => item.value).sort((left, right) => left - right);
  const median = healthyValues[Math.floor(healthyValues.length / 2)] ?? 0;
  return {
    metricKey: definition.metricKey,
    period,
    total,
    average: current.length ? total / current.length : 0,
    observations: current.length,
    targetAttainment: target ? Number(((total / target) * 100).toFixed(1)) : null,
    previousChange: change(previous),
    yearChange: change(year),
    byLocation: current.map((item) => ({
      locationId: item.locationId,
      value: item.value,
      target: item.target
    })),
    byRegion: [...regionValues.entries()]
      .map(([region, value]) => ({ region, ...value }))
      .sort((left, right) => right.value - left.value),
    trend: periods.slice(-12).map((item) => ({
      period: item,
      value: observations
        .filter((observationItem) => observationItem.period === item)
        .reduce((sum, observationItem) => sum + observationItem.value, 0)
    })),
    anomalies: current
      .filter(
        (item) =>
          (definition.healthyMin !== undefined && item.value < definition.healthyMin) ||
          (definition.healthyMax !== undefined && item.value > definition.healthyMax) ||
          (median > 0 && (item.value > median * 2 || item.value < median * 0.5))
      )
      .map((item) => ({
        locationId: item.locationId,
        value: item.value,
        reason: '超出指标健康范围或同店中位数区间'
      }))
  };
}
