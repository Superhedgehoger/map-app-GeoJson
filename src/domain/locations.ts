import type {
  FeatureProperties,
  GeoJsonFeature,
  JsonValue,
  LocationEntity,
  LocationKind,
  LocationStatus
} from '../types';

function propertyValue(properties: FeatureProperties, aliases: string[]): JsonValue | undefined {
  for (const alias of aliases) {
    const value = properties[alias];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function textValue(properties: FeatureProperties, aliases: string[]): string | undefined {
  const value = propertyValue(properties, aliases);
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}

function hashText(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function normalizeKind(properties: FeatureProperties): LocationKind {
  const raw = textValue(properties, ['locationType', 'entityType', '位置类型', '对象类型'])
    ?.trim()
    .toLowerCase();
  if (raw === 'candidate' || raw === '候选点' || raw === '候选门店') return 'candidate';
  if (raw === 'competitor' || raw === '竞品' || raw === '竞争门店') return 'competitor';
  if (raw === 'warehouse' || raw === '仓库') return 'warehouse';
  if (raw === 'other' || raw === '其他') return 'other';
  return 'store';
}

function normalizeStatus(properties: FeatureProperties, kind: LocationKind): LocationStatus {
  const raw = textValue(properties, ['status', 'state', '状态', '门店状态'])?.trim().toLowerCase();
  const aliases: Record<string, LocationStatus> = {
    planned: 'planned',
    规划: 'planned',
    计划: 'planned',
    candidate: 'planned',
    preparing: 'preparing',
    筹备: 'preparing',
    装修: 'preparing',
    open: 'open',
    opened: 'open',
    营业: 'open',
    在营: 'open',
    paused: 'paused',
    暂停: 'paused',
    停业: 'paused',
    closed: 'closed',
    闭店: 'closed',
    已关闭: 'closed'
  };
  if (raw && aliases[raw]) return aliases[raw];
  return kind === 'candidate' ? 'planned' : 'open';
}

function locationId(feature: GeoJsonFeature, name: string): string {
  const explicit = textValue(feature.properties, [
    'locationId',
    'storeId',
    '门店编号',
    '门店ID',
    'id'
  ]);
  if (explicit) return explicit;
  if (feature.id !== undefined) return String(feature.id);
  return `loc-${hashText(`${name}|${JSON.stringify(feature.geometry)}`)}`;
}

export function deriveLocationsFromFeatures(features: readonly GeoJsonFeature[]): LocationEntity[] {
  const usedIds = new Map<string, number>();
  return features
    .filter((feature) => feature.geometry?.type === 'Point')
    .map((feature, index) => {
      const properties = structuredClone(feature.properties);
      const name =
        textValue(properties, ['name', '名称', '门店', '店名']) ?? `未命名位置 ${index + 1}`;
      const kind = normalizeKind(properties);
      const baseId = locationId(feature, name);
      const duplicateIndex = usedIds.get(baseId) ?? 0;
      usedIds.set(baseId, duplicateIndex + 1);
      const resolvedId = duplicateIndex === 0 ? baseId : `${baseId}-${duplicateIndex + 1}`;

      return {
        locationId: resolvedId,
        name,
        kind,
        status: normalizeStatus(properties, kind),
        ...(textValue(properties, ['brand', '品牌'])
          ? { brand: textValue(properties, ['brand', '品牌']) }
          : {}),
        ...(textValue(properties, ['region', '区域', '城市', 'city'])
          ? { region: textValue(properties, ['region', '区域', '城市', 'city']) }
          : {}),
        ...(textValue(properties, ['address', '地址', '详细地址'])
          ? { address: textValue(properties, ['address', '地址', '详细地址']) }
          : {}),
        ...(textValue(properties, ['openedAt', '开业日期'])
          ? { openedAt: textValue(properties, ['openedAt', '开业日期']) }
          : {}),
        ...(textValue(properties, ['closedAt', '闭店日期'])
          ? { closedAt: textValue(properties, ['closedAt', '闭店日期']) }
          : {}),
        geometry: structuredClone(feature.geometry),
        ...(feature.id !== undefined ? { sourceFeatureId: feature.id } : {}),
        attributes: properties
      } satisfies LocationEntity;
    });
}
