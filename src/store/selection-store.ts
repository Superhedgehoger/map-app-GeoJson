import {
  analyzeTradeAreas,
  createSelectionModelTemplate,
  rankCandidates,
  validateSelectionModel,
  type SelectionValidation
} from '../domain/selection';
import type {
  JsonValue,
  SelectionDecisionState,
  SelectionModelState,
  SelectionScenarioState
} from '../types';
import type { GeomapFeatureStore } from './feature-store';

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class GeomapSelectionStore {
  readonly #workspace: GeomapFeatureStore;

  constructor(workspace: GeomapFeatureStore) {
    this.#workspace = workspace;
  }

  listModels(): SelectionModelState[] {
    return clone(this.#workspace.getState().selectionModels);
  }

  create(template: SelectionModelState['template']): SelectionModelState {
    const model = createSelectionModelTemplate(template);
    this.#workspace.setSelectionModels([...this.listModels(), model]);
    return clone(model);
  }

  saveDraft(model: SelectionModelState): SelectionModelState {
    if (model.status !== 'draft') throw new Error('已发布或停用的模型不可覆盖，请复制后修改。');
    const models = this.listModels();
    const index = models.findIndex(
      (item) => item.modelId === model.modelId && item.version === model.version
    );
    if (index === -1) models.push(clone(model));
    else models[index] = clone(model);
    this.#workspace.setSelectionModels(models);
    return clone(model);
  }

  validate(model: SelectionModelState): SelectionValidation {
    return validateSelectionModel(model);
  }

  publish(modelId: string, version: number): SelectionModelState {
    const models = this.listModels();
    const index = models.findIndex((item) => item.modelId === modelId && item.version === version);
    const model = models[index];
    if (!model || model.status !== 'draft') throw new Error('只能发布草稿模型。');
    const validation = validateSelectionModel(model);
    if (!validation.valid) throw new Error(validation.errors.join(' '));
    models[index] = { ...model, status: 'published', publishedAt: new Date().toISOString() };
    this.#workspace.setSelectionModels(models);
    return clone(models[index]!);
  }

  copy(modelId: string, version: number): SelectionModelState {
    const source = this.listModels().find(
      (model) => model.modelId === modelId && model.version === version
    );
    if (!source) throw new Error('找不到要复制的模型版本。');
    const next = {
      ...clone(source),
      version:
        Math.max(
          ...this.listModels()
            .filter((model) => model.modelId === modelId)
            .map((model) => model.version),
          0
        ) + 1,
      status: 'draft' as const,
      createdAt: new Date().toISOString(),
      publishedAt: undefined
    };
    this.#workspace.setSelectionModels([...this.listModels(), next]);
    return clone(next);
  }

  retire(modelId: string, version: number): void {
    const models = this.listModels();
    const index = models.findIndex(
      (model) => model.modelId === modelId && model.version === version
    );
    if (!models[index] || models[index]!.status !== 'published') {
      throw new Error('只能停用已发布模型。');
    }
    models[index] = { ...models[index]!, status: 'retired' };
    this.#workspace.setSelectionModels(models);
  }

  run(
    modelId: string,
    version: number,
    candidateIds: string[],
    name: string,
    assumptions: Record<string, JsonValue> = {}
  ): SelectionScenarioState {
    const state = this.#workspace.getState();
    const model = state.selectionModels.find(
      (item) => item.modelId === modelId && item.version === version
    );
    if (!model || model.status !== 'published') throw new Error('情景必须使用已发布模型。');
    const candidates = state.locations.filter((location) =>
      candidateIds.includes(location.locationId)
    );
    if (!candidates.length) throw new Error('至少选择一个候选点。');
    const scenario: SelectionScenarioState = {
      scenarioId: `scenario-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`,
      name,
      modelId,
      modelVersion: version,
      candidateIds: candidates.map((candidate) => candidate.locationId),
      assumptions: clone(assumptions),
      results: rankCandidates(candidates, model),
      status: 'completed',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString()
    };
    scenario.assumptions.tradeAreaAnalysis = analyzeTradeAreas(
      candidates,
      state.locations.filter((location) => location.kind === 'store' && location.status === 'open'),
      1500
    ) as unknown as JsonValue;
    this.#workspace.setSelectionScenarios([...state.selectionScenarios, scenario]);
    return clone(scenario);
  }

  copyScenario(scenarioId: string): SelectionScenarioState {
    const state = this.#workspace.getState();
    const source = state.selectionScenarios.find((scenario) => scenario.scenarioId === scenarioId);
    if (!source) throw new Error('找不到要复制的情景。');
    const copy = {
      ...clone(source),
      scenarioId: `scenario-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`,
      name: `${source.name}（What-if）`,
      status: 'draft' as const,
      results: [],
      createdAt: new Date().toISOString(),
      completedAt: undefined
    };
    this.#workspace.setSelectionScenarios([...state.selectionScenarios, copy]);
    return clone(copy);
  }

  decide(
    scenarioId: string,
    recommendedLocationId: string,
    conclusion: string,
    reasons: string[]
  ): SelectionDecisionState {
    const state = this.#workspace.getState();
    const scenario = state.selectionScenarios.find((item) => item.scenarioId === scenarioId);
    if (!scenario?.candidateIds.includes(recommendedLocationId)) {
      throw new Error('推荐位置必须属于当前情景。');
    }
    const decision: SelectionDecisionState = {
      decisionId: `decision-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`,
      scenarioId,
      recommendedLocationId,
      conclusion: conclusion.trim(),
      reasons: reasons.filter(Boolean),
      decidedAt: new Date().toISOString()
    };
    this.#workspace.setDecisions([...state.decisions, decision]);
    return clone(decision);
  }
}
