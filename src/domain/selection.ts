import type {
  BusinessRecord,
  CandidateSelectionResult,
  LocationEntity,
  SelectionCriterion,
  SelectionModelState
} from '../types';

export interface TradeAreaCandidateAnalysis {
  locationId: string;
  radiusMeters: number;
  nearbyStoreIds: string[];
  nearestStoreMeters: number | null;
  overlaps: { otherLocationId: string; overlapPercent: number; distanceMeters: number }[];
}

export interface SelectionBacktestItem {
  locationId: string;
  name: string;
  modelScore: number;
  actualValue: number;
  period: string;
}

export interface SelectionBacktestResult {
  metricKey: string;
  sampleSize: number;
  rankAgreement: number | null;
  items: SelectionBacktestItem[];
}

export interface SelectionValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const NUMBER = /^\d+(?:\.\d+)?$/;
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function expressionTokens(expression: string): string[] {
  const tokens = expression.match(/\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_.-]*|[()+\-*/]/g) ?? [];
  if (tokens.join('') !== expression.replaceAll(/\s/g, '')) {
    throw new Error('公式仅允许数字、指标名、括号和 + - * /。');
  }
  return tokens;
}

function expressionReferences(expression = ''): string[] {
  return [...new Set(expressionTokens(expression).filter((token) => IDENTIFIER.test(token)))];
}

function evaluateExpression(expression: string, values: Record<string, number>): number {
  const output: string[] = [];
  const operators: string[] = [];
  const precedence: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };
  for (const token of expressionTokens(expression)) {
    if (NUMBER.test(token) || IDENTIFIER.test(token)) output.push(token);
    else if (token === '(') operators.push(token);
    else if (token === ')') {
      while (operators.length && operators.at(-1) !== '(') output.push(operators.pop()!);
      if (operators.pop() !== '(') throw new Error('公式括号不匹配。');
    } else {
      while (
        operators.length &&
        operators.at(-1) !== '(' &&
        precedence[operators.at(-1)!]! >= precedence[token]!
      ) {
        output.push(operators.pop()!);
      }
      operators.push(token);
    }
  }
  while (operators.length) {
    const operator = operators.pop()!;
    if (operator === '(') throw new Error('公式括号不匹配。');
    output.push(operator);
  }

  const stack: number[] = [];
  for (const token of output) {
    if (NUMBER.test(token)) stack.push(Number(token));
    else if (IDENTIFIER.test(token)) {
      if (!Number.isFinite(values[token])) throw new Error(`公式缺少 ${token}。`);
      stack.push(values[token]!);
    } else {
      const right = stack.pop();
      const left = stack.pop();
      if (left === undefined || right === undefined) throw new Error('公式结构无效。');
      if (token === '+') stack.push(left + right);
      if (token === '-') stack.push(left - right);
      if (token === '*') stack.push(left * right);
      if (token === '/') stack.push(right === 0 ? Number.NaN : left / right);
    }
  }
  if (stack.length !== 1 || !Number.isFinite(stack[0])) throw new Error('公式计算结果无效。');
  return stack[0]!;
}

function detectCycles(criteria: readonly SelectionCriterion[]): string[] {
  const ids = new Set(criteria.map((criterion) => criterion.criterionId));
  const graph = new Map(
    criteria.map((criterion) => [
      criterion.criterionId,
      criterion.normalization === 'formula'
        ? expressionReferences(criterion.expression).filter((reference) => ids.has(reference))
        : []
    ])
  );
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycles = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) {
      cycles.add(id);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    graph.get(id)?.forEach(visit);
    visiting.delete(id);
    visited.add(id);
  };
  graph.forEach((_, id) => visit(id));
  return [...cycles];
}

export function validateSelectionModel(model: SelectionModelState): SelectionValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!model.name.trim()) errors.push('模型名称不能为空。');
  if (!model.criteria.length) errors.push('模型至少需要一个指标。');
  const ids = new Set<string>();
  for (const criterion of model.criteria) {
    if (!criterion.criterionId.trim() || ids.has(criterion.criterionId)) {
      errors.push(`指标 ID 重复或为空：${criterion.criterionId || '空值'}。`);
    }
    ids.add(criterion.criterionId);
    if (!criterion.sourceField.trim()) errors.push(`${criterion.name} 缺少数据字段。`);
    if (!Number.isFinite(criterion.weight) || criterion.weight < 0) {
      errors.push(`${criterion.name} 的权重无效。`);
    }
    if (criterion.direction === 'target' && !Number.isFinite(criterion.target)) {
      errors.push(`${criterion.name} 缺少目标值。`);
    }
    if (criterion.direction === 'threshold' && !Number.isFinite(criterion.threshold)) {
      errors.push(`${criterion.name} 缺少硬阈值。`);
    }
    if (criterion.normalization === 'formula') {
      if (!criterion.expression?.trim()) errors.push(`${criterion.name} 缺少公式。`);
      else {
        try {
          expressionTokens(criterion.expression);
        } catch (error) {
          errors.push(`${criterion.name}：${(error as Error).message}`);
        }
      }
    }
  }
  if (model.criteria.reduce((sum, criterion) => sum + criterion.weight, 0) <= 0) {
    errors.push('指标总权重必须大于 0。');
  }
  const cycles = detectCycles(model.criteria);
  if (cycles.length) errors.push(`公式存在循环依赖：${cycles.join('、')}。`);
  const weight = model.criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
  if (Math.abs(weight - 100) > 0.01)
    warnings.push(`当前指标权重合计 ${weight}，运行时会自动归一化。`);
  return { valid: errors.length === 0, errors, warnings };
}

function numericAttributes(location: LocationEntity): Record<string, number> {
  return Object.fromEntries(
    Object.entries(location.attributes)
      .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
      .map(([key, value]) => [key, value])
  );
}

function rawValue(
  criterion: SelectionCriterion,
  attributes: Record<string, number>,
  criterionValues: Record<string, number>
): number | null {
  if (criterion.normalization === 'formula' && criterion.expression) {
    try {
      return evaluateExpression(criterion.expression, { ...attributes, ...criterionValues });
    } catch {
      return null;
    }
  }
  const value = attributes[criterion.sourceField];
  return Number.isFinite(value) ? value! : null;
}

function normalizeValue(value: number, criterion: SelectionCriterion): number {
  if (criterion.direction === 'threshold') return value >= criterion.threshold! ? 1 : 0;
  const min = criterion.min ?? 0;
  const max = criterion.max ?? Math.max(min + 1, value);
  if (criterion.direction === 'target') {
    const spread = Math.max(1, max - min);
    return clamp(1 - Math.abs(value - criterion.target!) / spread);
  }
  const normalized = clamp((value - min) / Math.max(1e-9, max - min));
  return criterion.direction === 'negative' ? 1 - normalized : normalized;
}

export function scoreCandidate(
  location: LocationEntity,
  model: SelectionModelState
): CandidateSelectionResult {
  const validation = validateSelectionModel(model);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  const attributes = numericAttributes(location);
  const criterionValues: Record<string, number> = {};
  const contributions: CandidateSelectionResult['contributions'] = [];
  const eliminatedReasons: string[] = [];
  const effectiveWeights = model.criteria.map(
    (criterion) => criterion.weight * (criterion.groupWeight ?? 1)
  );
  const totalWeight = effectiveWeights.reduce((sum, weight) => sum + weight, 0);
  let present = 0;

  model.criteria.forEach((criterion, index) => {
    const raw = rawValue(criterion, attributes, criterionValues);
    if (raw !== null) {
      present += 1;
      criterionValues[criterion.criterionId] = raw;
    }
    let normalizedScore = raw === null ? 0 : normalizeValue(raw, criterion);
    if (raw === null && criterion.missingPolicy === 'neutral') normalizedScore = 0.5;
    if (raw === null && ['error', 'manual'].includes(criterion.missingPolicy)) {
      eliminatedReasons.push(`${criterion.name} 缺少数据`);
    }
    if (raw === null && criterion.missingPolicy === 'eliminate') {
      eliminatedReasons.push(`${criterion.name} 缺失，按规则淘汰`);
    }
    if (raw !== null && criterion.direction === 'threshold' && normalizedScore === 0) {
      eliminatedReasons.push(
        `${criterion.name} 未达到 ${criterion.threshold}${criterion.unit ?? ''}`
      );
    }
    const weightedScore = totalWeight
      ? normalizedScore * (effectiveWeights[index]! / totalWeight) * 100
      : 0;
    contributions.push({
      criterionId: criterion.criterionId,
      name: criterion.name,
      rawValue: raw,
      normalizedScore: Number((normalizedScore * 100).toFixed(2)),
      weightedScore: Number(weightedScore.toFixed(2)),
      explanation: criterion.explanation
    });
  });
  const eligible = eliminatedReasons.length === 0;
  return {
    locationId: location.locationId,
    name: location.name,
    score: eligible
      ? Number(contributions.reduce((sum, item) => sum + item.weightedScore, 0).toFixed(2))
      : 0,
    eligible,
    completeness: model.criteria.length ? Math.round((present / model.criteria.length) * 100) : 0,
    eliminatedReasons,
    contributions
  };
}

export function rankCandidates(
  candidates: readonly LocationEntity[],
  model: SelectionModelState
): CandidateSelectionResult[] {
  return candidates
    .map((candidate) => scoreCandidate(candidate, model))
    .sort(
      (left, right) => Number(right.eligible) - Number(left.eligible) || right.score - left.score
    );
}

function pointCoordinates(location: LocationEntity): [number, number] | null {
  const coordinates = location.geometry?.coordinates;
  if (
    !Array.isArray(coordinates) ||
    typeof coordinates[0] !== 'number' ||
    typeof coordinates[1] !== 'number'
  ) {
    return null;
  }
  return [coordinates[0], coordinates[1]];
}

function distanceMeters(left: [number, number], right: [number, number]): number {
  const radians = (value: number): number => (value * Math.PI) / 180;
  const latitude = radians(right[1] - left[1]);
  const longitude = radians(right[0] - left[0]);
  const value =
    Math.sin(latitude / 2) ** 2 +
    Math.cos(radians(left[1])) * Math.cos(radians(right[1])) * Math.sin(longitude / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function equalCircleOverlap(distance: number, radius: number): number {
  if (distance >= radius * 2) return 0;
  if (distance <= 0) return 100;
  const area =
    2 * radius ** 2 * Math.acos(distance / (2 * radius)) -
    0.5 * distance * Math.sqrt(4 * radius ** 2 - distance ** 2);
  return Number(((area / (Math.PI * radius ** 2)) * 100).toFixed(1));
}

export function analyzeTradeAreas(
  candidates: readonly LocationEntity[],
  existingStores: readonly LocationEntity[],
  radiusMeters = 1500
): TradeAreaCandidateAnalysis[] {
  return candidates.map((candidate) => {
    const point = pointCoordinates(candidate);
    const storeDistances = point
      ? existingStores
          .map((store) => ({ store, point: pointCoordinates(store) }))
          .filter(
            (item): item is { store: LocationEntity; point: [number, number] } => !!item.point
          )
          .map((item) => ({
            id: item.store.locationId,
            distance: distanceMeters(point, item.point)
          }))
          .sort((left, right) => left.distance - right.distance)
      : [];
    const overlaps = point
      ? candidates
          .filter((other) => other.locationId !== candidate.locationId)
          .map((other) => ({ other, point: pointCoordinates(other) }))
          .filter(
            (item): item is { other: LocationEntity; point: [number, number] } => !!item.point
          )
          .map((item) => {
            const distance = distanceMeters(point, item.point);
            return {
              otherLocationId: item.other.locationId,
              overlapPercent: equalCircleOverlap(distance, radiusMeters),
              distanceMeters: Math.round(distance)
            };
          })
          .filter((item) => item.overlapPercent > 0)
      : [];
    return {
      locationId: candidate.locationId,
      radiusMeters,
      nearbyStoreIds: storeDistances
        .filter((item) => item.distance <= radiusMeters)
        .map((item) => item.id),
      nearestStoreMeters: storeDistances[0] ? Math.round(storeDistances[0].distance) : null,
      overlaps
    };
  });
}

function correlation(left: number[], right: number[]): number | null {
  if (left.length < 2 || left.length !== right.length) return null;
  const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length;
  const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length;
  const numerator = left.reduce(
    (sum, value, index) => sum + (value - leftMean) * (right[index]! - rightMean),
    0
  );
  const denominator = Math.sqrt(
    left.reduce((sum, value) => sum + (value - leftMean) ** 2, 0) *
      right.reduce((sum, value) => sum + (value - rightMean) ** 2, 0)
  );
  return denominator ? Number((numerator / denominator).toFixed(3)) : null;
}

export function backtestSelectionModel(
  model: SelectionModelState,
  locations: readonly LocationEntity[],
  records: readonly BusinessRecord[],
  metricKey: string
): SelectionBacktestResult {
  const latest = new Map<string, BusinessRecord>();
  records
    .filter(
      (record) =>
        record.recordType === 'metric' &&
        record.status !== 'void' &&
        record.payload.metricKey === metricKey &&
        typeof record.payload.value === 'number'
    )
    .forEach((record) => {
      for (const locationId of record.entityRefs) {
        const previous = latest.get(locationId);
        if (!previous || previous.validFrom < record.validFrom) latest.set(locationId, record);
      }
    });
  const items = locations
    .filter((location) => location.kind === 'store' && latest.has(location.locationId))
    .map((location) => {
      const result = scoreCandidate(location, model);
      const record = latest.get(location.locationId)!;
      return {
        locationId: location.locationId,
        name: location.name,
        modelScore: result.score,
        actualValue: Number(record.payload.value),
        period: record.validFrom.slice(0, 10)
      };
    })
    .filter((item) => item.modelScore > 0)
    .sort((left, right) => right.modelScore - left.modelScore);
  return {
    metricKey,
    sampleSize: items.length,
    rankAgreement: correlation(
      items.map((item) => item.modelScore),
      items.map((item) => item.actualValue)
    ),
    items
  };
}

const templateCriteria: Record<SelectionModelState['template'], SelectionCriterion[]> = {
  mall: [
    {
      criterionId: 'footTraffic',
      name: '日均客流',
      sourceField: 'footTraffic',
      unit: '人',
      direction: 'positive',
      normalization: 'min-max',
      weight: 45,
      missingPolicy: 'error',
      min: 0,
      max: 50000,
      explanation: '候选商场日均客流，越高越好。'
    },
    {
      criterionId: 'rent',
      name: '月租金',
      sourceField: 'rent',
      unit: '元',
      direction: 'negative',
      normalization: 'min-max',
      weight: 30,
      missingPolicy: 'error',
      min: 10000,
      max: 100000,
      explanation: '月租金成本，越低越好。'
    },
    {
      criterionId: 'visibility',
      name: '可见性',
      sourceField: 'visibility',
      direction: 'positive',
      normalization: 'min-max',
      weight: 25,
      missingPolicy: 'neutral',
      min: 0,
      max: 10,
      explanation: '主通道与招牌可见性评分。'
    }
  ],
  street: [
    {
      criterionId: 'footTraffic',
      name: '日均客流',
      sourceField: 'footTraffic',
      unit: '人',
      direction: 'positive',
      normalization: 'min-max',
      weight: 40,
      missingPolicy: 'error',
      min: 0,
      max: 30000,
      explanation: '街区日均有效客流。'
    },
    {
      criterionId: 'rent',
      name: '月租金',
      sourceField: 'rent',
      unit: '元',
      direction: 'negative',
      normalization: 'min-max',
      weight: 30,
      missingPolicy: 'error',
      min: 5000,
      max: 80000,
      explanation: '月租金成本。'
    },
    {
      criterionId: 'parking',
      name: '停车便利度',
      sourceField: 'parking',
      direction: 'positive',
      normalization: 'min-max',
      weight: 15,
      missingPolicy: 'neutral',
      min: 0,
      max: 10,
      explanation: '停车位与到店便利度。'
    },
    {
      criterionId: 'competitorDistance',
      name: '竞品距离',
      sourceField: 'competitorDistance',
      unit: '米',
      direction: 'positive',
      normalization: 'min-max',
      weight: 15,
      missingPolicy: 'worst',
      min: 0,
      max: 3000,
      explanation: '与最近直接竞品的距离。'
    }
  ],
  community: [
    {
      criterionId: 'households',
      name: '覆盖户数',
      sourceField: 'households',
      unit: '户',
      direction: 'positive',
      normalization: 'min-max',
      weight: 45,
      missingPolicy: 'error',
      min: 0,
      max: 30000,
      explanation: '半径商圈覆盖常住户数。'
    },
    {
      criterionId: 'rent',
      name: '月租金',
      sourceField: 'rent',
      unit: '元',
      direction: 'negative',
      normalization: 'min-max',
      weight: 30,
      missingPolicy: 'error',
      min: 3000,
      max: 50000,
      explanation: '社区铺位月租金。'
    },
    {
      criterionId: 'parking',
      name: '停车便利度',
      sourceField: 'parking',
      direction: 'positive',
      normalization: 'min-max',
      weight: 25,
      missingPolicy: 'neutral',
      min: 0,
      max: 10,
      explanation: '居民短停与骑行到店便利度。'
    }
  ],
  blank: []
};

export function createSelectionModelTemplate(
  template: SelectionModelState['template'],
  now = new Date().toISOString()
): SelectionModelState {
  const names = {
    mall: '商场店模型',
    street: '临街店模型',
    community: '社区店模型',
    blank: '空白选址模型'
  };
  return {
    modelId: `model-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`,
    name: names[template],
    description: '透明、可版本化的候选点评分模型',
    template,
    version: 1,
    status: 'draft',
    criteria: structuredClone(templateCriteria[template]),
    outputScale: 100,
    createdAt: now
  };
}
