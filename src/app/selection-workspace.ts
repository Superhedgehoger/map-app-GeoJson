import { backtestSelectionModel, type TradeAreaCandidateAnalysis } from '../domain/selection';
import type { GeomapFeatureStore } from '../store/feature-store';
import type { GeomapSelectionStore } from '../store/selection-store';
import type {
  CandidateSelectionResult,
  SelectionCriterion,
  SelectionModelState,
  SelectionScenarioState
} from '../types';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

const TEMPLATE_LABELS: Record<SelectionModelState['template'], string> = {
  mall: '商场店',
  street: '临街店',
  community: '社区店',
  blank: '空白模型'
};

const STATUS_LABELS: Record<SelectionModelState['status'], string> = {
  draft: '草稿',
  published: '已发布',
  retired: '已停用'
};

export class SelectionWorkspace {
  readonly #workspace: GeomapFeatureStore;
  readonly #selection: GeomapSelectionStore;
  #root: HTMLElement | null = null;
  #active = false;
  #selectedModelKey = '';
  #selectedScenarioId = '';
  #message = '';

  constructor(workspace: GeomapFeatureStore, selection: GeomapSelectionStore) {
    this.#workspace = workspace;
    this.#selection = selection;
  }

  mount(): void {
    if (document.getElementById('selectionWorkspace')) return;
    this.#root = document.createElement('section');
    this.#root.id = 'selectionWorkspace';
    this.#root.className = 'selection-workspace';
    this.#root.setAttribute('aria-label', '自定义选址模型');
    document.body.append(this.#root);
    window.addEventListener('geomap:section-changed', (event) => {
      this.#active = (event as CustomEvent<{ section?: string }>).detail?.section === 'selection';
      document.body.classList.toggle('site-selection-mode', this.#active);
      this.#render();
      window.setTimeout(() => window.dispatchEvent(new Event('resize')), 0);
    });
    this.#workspace.subscribe(() => {
      if (this.#active) this.#render();
    });
    this.#render();
  }

  #modelKey(model: SelectionModelState): string {
    return `${model.modelId}@${model.version}`;
  }

  #selectedModel(): SelectionModelState | undefined {
    const models = this.#selection.listModels();
    return (
      models.find((model) => this.#modelKey(model) === this.#selectedModelKey) ?? models.at(-1)
    );
  }

  #render(): void {
    if (!this.#root) return;
    this.#root.hidden = !this.#active;
    if (!this.#active) return;
    const state = this.#workspace.getState();
    const models = this.#selection.listModels();
    const model = this.#selectedModel();
    if (model && !this.#selectedModelKey) this.#selectedModelKey = this.#modelKey(model);
    const candidates = state.locations.filter((location) => location.kind === 'candidate');
    const scenario =
      state.selectionScenarios.find((item) => item.scenarioId === this.#selectedScenarioId) ??
      state.selectionScenarios.at(-1);

    this.#root.innerHTML = `
      <header class="selection-header">
        <div><span>拓展决策</span><h1>自定义选址模型</h1><p>模型定义 → 发布版本 → 分析情景 → 决策复盘</p></div>
        <div class="selection-header-actions"><button id="selectionPrint" type="button"><i class="fa-solid fa-print"></i> 打印报告</button></div>
      </header>
      ${this.#message ? `<div class="selection-message" role="status">${escapeHtml(this.#message)}</div>` : ''}
      <div class="selection-layout">
        <aside class="selection-model-list">
          <div class="selection-side-title"><strong>模型中心</strong><span>${models.length} 个版本</span></div>
          <div class="selection-template-grid">${(['mall', 'street', 'community', 'blank'] as const).map((template) => `<button type="button" data-template="${template}">+ ${TEMPLATE_LABELS[template]}</button>`).join('')}</div>
          <div class="selection-model-items">${
            models
              .slice()
              .reverse()
              .map(
                (item) =>
                  `<button type="button" data-model="${escapeHtml(this.#modelKey(item))}" class="${this.#modelKey(item) === this.#modelKey(model ?? item) ? 'is-active' : ''}"><span><strong>${escapeHtml(item.name)}</strong><small>v${item.version} · ${TEMPLATE_LABELS[item.template]}</small></span><em data-status="${item.status}">${STATUS_LABELS[item.status]}</em></button>`
              )
              .join('') || '<p>从模板开始建立企业自己的选址方法。</p>'
          }</div>
          <div class="selection-contract"><strong>运行约束</strong><span>发布版本不可覆盖</span><span>缺失数据先提示</span><span>总分可追溯到原始指标</span></div>
        </aside>
        <main class="selection-main">
          ${
            model
              ? this.#renderModel(
                  model,
                  candidates.map((candidate) => candidate.locationId)
                )
              : this.#renderEmpty()
          }
          ${scenario ? this.#renderScenario(scenario) : ''}
        </main>
      </div>`;
    this.#bindEvents(model, scenario);
  }

  #renderEmpty(): string {
    return `<section class="selection-empty"><i class="fa-solid fa-compass-drafting"></i><h2>把企业选址经验变成可复用模型</h2><p>选择商场店、临街店、社区店模板，或从空白模型开始。无需修改代码即可配置字段、方向、权重和缺失值策略。</p></section>`;
  }

  #renderModel(model: SelectionModelState, candidateIds: string[]): string {
    const validation = this.#selection.validate(model);
    const editable = model.status === 'draft';
    const state = this.#workspace.getState();
    const backtest =
      model.status === 'published'
        ? backtestSelectionModel(model, state.locations, state.records, 'revenue')
        : null;
    return `<section class="selection-model-editor">
      <div class="selection-section-heading"><div><span>模型定义</span><h2>${escapeHtml(model.name)} <small>v${model.version}</small></h2></div><em data-status="${model.status}">${STATUS_LABELS[model.status]}</em></div>
      <div class="selection-model-meta">
        <label>模型名称<input id="selectionModelName" value="${escapeHtml(model.name)}" ${editable ? '' : 'disabled'} /></label>
        <label>适用区域<input id="selectionModelRegion" value="${escapeHtml(model.applicableRegion ?? '')}" placeholder="全部区域" ${editable ? '' : 'disabled'} /></label>
        <label>门店业态<input id="selectionModelFormat" value="${escapeHtml(model.businessFormat ?? '')}" placeholder="咖啡/零售等" ${editable ? '' : 'disabled'} /></label>
      </div>
      <div class="selection-validation ${validation.valid ? 'is-valid' : 'is-error'}"><strong>${validation.valid ? '模型结构有效' : '发布前需修正'}</strong><span>${escapeHtml([...validation.errors, ...validation.warnings].join(' ') || '可以发布并用于候选点分析。')}</span></div>
      <div class="selection-criteria-head"><strong>评分指标</strong><span>权重合计 ${model.criteria.reduce((sum, item) => sum + item.weight, 0)}</span></div>
      <div class="selection-criteria">${model.criteria.map((criterion, index) => this.#renderCriterion(criterion, index, editable)).join('') || '<p>空白模型还没有指标，点击“新增指标”。</p>'}</div>
      <div class="selection-editor-actions">
        ${editable ? '<button id="selectionAddCriterion" type="button">+ 新增指标</button><button id="selectionSaveDraft" type="button">保存草稿</button><button id="selectionPublish" class="is-primary" type="button">校验并发布</button>' : '<button id="selectionCopyModel" type="button">复制为新版本</button>'}
        ${model.status === 'published' ? '<button id="selectionRetireModel" type="button">停用版本</button>' : ''}
      </div>
      ${model.status === 'published' ? `<div class="selection-run-box"><div><strong>候选点分析</strong><span>半径商圈默认 1.5 km；已预留步行/驾车时圈适配器</span></div><div class="selection-candidates">${candidateIds.map((id) => `<label><input type="checkbox" name="candidate" value="${escapeHtml(id)}" checked />${escapeHtml(this.#workspace.getState().locations.find((item) => item.locationId === id)?.name ?? id)}</label>`).join('')}</div><label>情景名称<input id="selectionScenarioName" value="${new Date().toLocaleDateString('zh-CN')} 候选点比较" /></label><button id="selectionRun" class="is-primary" type="button">运行并解释</button></div>` : ''}
      ${backtest ? `<div class="selection-backtest"><div><strong>历史门店只读回测</strong><span>指标 revenue · 样本 ${backtest.sampleSize} · 排名一致性 ${backtest.rankAgreement === null ? '样本不足' : backtest.rankAgreement}</span></div>${backtest.items.map((item) => `<span>${escapeHtml(item.name)}：模型 ${item.modelScore.toFixed(1)} / 实际 ${item.actualValue.toLocaleString('zh-CN')}（${item.period}）</span>`).join('') || '<span>现有门店缺少同口径选址输入，回测不会补写或修改原始数据。</span>'}</div>` : ''}
    </section>`;
  }

  #renderCriterion(criterion: SelectionCriterion, index: number, editable: boolean): string {
    return `<article class="selection-criterion" data-criterion-index="${index}">
      <label>指标<input name="name" value="${escapeHtml(criterion.name)}" ${editable ? '' : 'disabled'} /></label>
      <label>数据字段<input name="sourceField" value="${escapeHtml(criterion.sourceField)}" ${editable ? '' : 'disabled'} /></label>
      <label>方向<select name="direction" ${editable ? '' : 'disabled'}>${[
        ['positive', '正向'],
        ['negative', '反向'],
        ['target', '目标值'],
        ['threshold', '硬阈值']
      ]
        .map(
          ([value, label]) =>
            `<option value="${value}"${criterion.direction === value ? ' selected' : ''}>${label}</option>`
        )
        .join('')}</select></label>
      <label>归一化<select name="normalization" ${editable ? '' : 'disabled'}>${[
        ['min-max', '最小最大'],
        ['target-range', '目标区间'],
        ['segmented', '分段'],
        ['formula', '受限公式']
      ]
        .map(
          ([value, label]) =>
            `<option value="${value}"${criterion.normalization === value ? ' selected' : ''}>${label}</option>`
        )
        .join('')}</select></label>
      <label>权重<input name="weight" type="number" min="0" value="${criterion.weight}" ${editable ? '' : 'disabled'} /></label>
      <label>缺失策略<select name="missingPolicy" ${editable ? '' : 'disabled'}>${[
        ['error', '阻止运行'],
        ['eliminate', '淘汰'],
        ['neutral', '中性值'],
        ['worst', '最差值'],
        ['manual', '人工补录']
      ]
        .map(
          ([value, label]) =>
            `<option value="${value}"${criterion.missingPolicy === value ? ' selected' : ''}>${label}</option>`
        )
        .join('')}</select></label>
      <label>最小值<input name="min" type="number" value="${criterion.min ?? 0}" ${editable ? '' : 'disabled'} /></label>
      <label>最大值<input name="max" type="number" value="${criterion.max ?? 100}" ${editable ? '' : 'disabled'} /></label>
      <label>目标/阈值/公式<input name="rule" value="${escapeHtml(criterion.normalization === 'formula' ? (criterion.expression ?? '') : String(criterion.direction === 'target' ? (criterion.target ?? '') : criterion.direction === 'threshold' ? (criterion.threshold ?? '') : ''))}" placeholder="如 80 或 traffic/rent" ${editable ? '' : 'disabled'} /></label>
      <label>指标组<input name="group" value="${escapeHtml(criterion.group ?? '')}" placeholder="可选" ${editable ? '' : 'disabled'} /></label>
      <label>组权重<input name="groupWeight" type="number" min="0" step="0.1" value="${criterion.groupWeight ?? 1}" ${editable ? '' : 'disabled'} /></label>
      <label class="selection-explanation">解释<input name="explanation" value="${escapeHtml(criterion.explanation)}" ${editable ? '' : 'disabled'} /></label>
      ${editable ? '<button type="button" data-remove-criterion aria-label="删除指标">×</button>' : ''}
    </article>`;
  }

  #renderScenario(scenario: SelectionScenarioState): string {
    const model = this.#selection
      .listModels()
      .find((item) => item.modelId === scenario.modelId && item.version === scenario.modelVersion);
    const selected = scenario.results.slice(0, 5);
    const tradeAreas = Array.isArray(scenario.assumptions.tradeAreaAnalysis)
      ? (scenario.assumptions.tradeAreaAnalysis as unknown as TradeAreaCandidateAnalysis[])
      : [];
    const maximumOverlap = Math.max(
      0,
      ...tradeAreas.flatMap((item) => item.overlaps.map((overlap) => overlap.overlapPercent))
    );
    const nearbyStores = new Set(tradeAreas.flatMap((item) => item.nearbyStoreIds)).size;
    return `<section class="selection-scenario-report">
      <div class="selection-section-heading"><div><span>分析报告</span><h2>${escapeHtml(scenario.name)}</h2></div><small>${escapeHtml(model?.name ?? scenario.modelId)} v${scenario.modelVersion} · 数据时间 ${new Date(scenario.completedAt ?? scenario.createdAt).toLocaleString('zh-CN')}</small></div>
      <div class="selection-trade-summary"><span>半径商圈 1.5 km</span><span>候选点最大重叠 ${maximumOverlap.toFixed(1)}%</span><span>圈内现有门店 ${nearbyStores} 家（简易蚕食提示）</span><span>时圈服务：可插拔</span></div>
      <div class="selection-ranking">${selected.map((result, index) => this.#renderResult(result, index)).join('')}</div>
      <div class="selection-scenario-actions"><button id="selectionCopyScenario" type="button">复制 What-if 情景</button><label>决策结论<input id="selectionConclusion" placeholder="为什么选择该点位" /></label><button id="selectionDecide" class="is-primary" type="button">保存推荐与理由</button></div>
    </section>`;
  }

  #renderResult(result: CandidateSelectionResult, index: number): string {
    return `<article class="selection-result ${result.eligible ? '' : 'is-eliminated'}">
      <header><span>#${index + 1}</span><div><strong>${escapeHtml(result.name)}</strong><small>数据完整度 ${result.completeness}%</small></div><em>${result.eligible ? result.score.toFixed(1) : '淘汰'}</em></header>
      ${result.eliminatedReasons.length ? `<p>${escapeHtml(result.eliminatedReasons.join('；'))}</p>` : ''}
      <div class="selection-contributions">${result.contributions.map((item) => `<div title="${escapeHtml(item.explanation)}"><span>${escapeHtml(item.name)}<small>原值 ${item.rawValue ?? '缺失'}</small></span><strong>+${item.weightedScore.toFixed(1)}</strong><i style="--score:${item.normalizedScore}%"></i></div>`).join('')}</div>
      <button type="button" data-focus-location="${escapeHtml(result.locationId)}">在地图定位</button>
    </article>`;
  }

  #readDraft(model: SelectionModelState): SelectionModelState {
    const criteria = [
      ...(this.#root?.querySelectorAll<HTMLElement>('.selection-criterion') ?? [])
    ].map((row, index): SelectionCriterion => {
      const value = (name: string): string =>
        row.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)?.value ?? '';
      const existing = model.criteria[index]!;
      const normalization = value('normalization') as SelectionCriterion['normalization'];
      const direction = value('direction') as SelectionCriterion['direction'];
      const rule = value('rule').trim();
      return {
        ...existing,
        name: value('name').trim(),
        sourceField: value('sourceField').trim(),
        direction,
        normalization,
        weight: Number(value('weight')),
        missingPolicy: value('missingPolicy') as SelectionCriterion['missingPolicy'],
        min: Number(value('min')),
        max: Number(value('max')),
        ...(direction === 'target' ? { target: Number(rule) } : { target: undefined }),
        ...(direction === 'threshold' ? { threshold: Number(rule) } : { threshold: undefined }),
        ...(normalization === 'formula' ? { expression: rule } : { expression: undefined }),
        group: value('group').trim() || undefined,
        groupWeight: Number(value('groupWeight')) || 1,
        explanation: value('explanation').trim()
      };
    });
    return {
      ...model,
      name:
        this.#root?.querySelector<HTMLInputElement>('#selectionModelName')?.value.trim() ??
        model.name,
      applicableRegion:
        this.#root?.querySelector<HTMLInputElement>('#selectionModelRegion')?.value.trim() ||
        undefined,
      businessFormat:
        this.#root?.querySelector<HTMLInputElement>('#selectionModelFormat')?.value.trim() ||
        undefined,
      criteria
    };
  }

  #bindEvents(model?: SelectionModelState, scenario?: SelectionScenarioState): void {
    this.#root?.querySelectorAll<HTMLButtonElement>('[data-template]').forEach((button) => {
      button.addEventListener('click', () => {
        const created = this.#selection.create(
          button.dataset.template as SelectionModelState['template']
        );
        this.#selectedModelKey = this.#modelKey(created);
        this.#message = '已创建草稿，可直接调整字段与权重。';
      });
    });
    this.#root?.querySelectorAll<HTMLButtonElement>('[data-model]').forEach((button) => {
      button.addEventListener('click', () => {
        this.#selectedModelKey = button.dataset.model ?? '';
        this.#message = '';
        this.#render();
      });
    });
    this.#root?.querySelector('#selectionPrint')?.addEventListener('click', () => window.print());
    this.#root?.querySelectorAll<HTMLButtonElement>('[data-focus-location]').forEach((button) => {
      button.addEventListener('click', () => {
        const location = this.#workspace
          .getState()
          .locations.find((item) => item.locationId === button.dataset.focusLocation);
        if (location) window.GeomapLegacyBridge?.focusLocation(location.name);
      });
    });
    if (!model) return;
    this.#root?.querySelector('#selectionSaveDraft')?.addEventListener('click', () => {
      const saved = this.#selection.saveDraft(this.#readDraft(model));
      this.#selectedModelKey = this.#modelKey(saved);
      this.#message = '草稿已保存。';
    });
    this.#root?.querySelector('#selectionPublish')?.addEventListener('click', () => {
      try {
        const saved = this.#selection.saveDraft(this.#readDraft(model));
        this.#selection.publish(saved.modelId, saved.version);
        this.#message = '模型已发布；该版本现在不可覆盖。';
      } catch (error) {
        this.#message = (error as Error).message;
        this.#render();
      }
    });
    this.#root?.querySelector('#selectionCopyModel')?.addEventListener('click', () => {
      const copy = this.#selection.copy(model.modelId, model.version);
      this.#selectedModelKey = this.#modelKey(copy);
      this.#message = `已创建 v${copy.version} 草稿，原版本保持不变。`;
    });
    this.#root?.querySelector('#selectionRetireModel')?.addEventListener('click', () => {
      this.#selection.retire(model.modelId, model.version);
      this.#message = '模型版本已停用，历史情景仍可查看。';
    });
    this.#root?.querySelector('#selectionAddCriterion')?.addEventListener('click', () => {
      const draft = this.#readDraft(model);
      draft.criteria.push({
        criterionId: `criterion-${draft.criteria.length + 1}`,
        name: '新指标',
        sourceField: 'fieldName',
        direction: 'positive',
        normalization: 'min-max',
        weight: 0,
        missingPolicy: 'error',
        min: 0,
        max: 100,
        explanation: '说明该指标为何影响选址。'
      });
      this.#selection.saveDraft(draft);
      this.#message = '已新增指标，请补充字段和权重。';
    });
    this.#root?.querySelectorAll<HTMLButtonElement>('[data-remove-criterion]').forEach((button) => {
      button.addEventListener('click', () => {
        const draft = this.#readDraft(model);
        const index = Number(
          button.closest<HTMLElement>('[data-criterion-index]')?.dataset.criterionIndex
        );
        draft.criteria.splice(index, 1);
        this.#selection.saveDraft(draft);
        this.#message = '指标已从草稿移除。';
      });
    });
    this.#root?.querySelector('#selectionRun')?.addEventListener('click', () => {
      try {
        const candidateIds = [
          ...this.#root!.querySelectorAll<HTMLInputElement>('[name="candidate"]:checked')
        ]
          .map((item) => item.value)
          .slice(0, 5);
        const name =
          this.#root?.querySelector<HTMLInputElement>('#selectionScenarioName')?.value.trim() ||
          '候选点比较';
        const created = this.#selection.run(model.modelId, model.version, candidateIds, name, {
          tradeArea: { kind: 'radius', radiusMeters: 1500 }
        });
        this.#selectedScenarioId = created.scenarioId;
        this.#message = '分析完成：排名、数据完整度和单项贡献已固化到情景。';
      } catch (error) {
        this.#message = (error as Error).message;
        this.#render();
      }
    });
    this.#root?.querySelector('#selectionCopyScenario')?.addEventListener('click', () => {
      if (!scenario) return;
      const copy = this.#selection.copyScenario(scenario.scenarioId);
      this.#selectedScenarioId = copy.scenarioId;
      this.#message = 'What-if 副本已创建，原分析结果未被覆盖。';
    });
    this.#root?.querySelector('#selectionDecide')?.addEventListener('click', () => {
      if (!scenario || !scenario.results[0]) return;
      const conclusion =
        this.#root?.querySelector<HTMLInputElement>('#selectionConclusion')?.value.trim() ||
        '采用综合评分第一名，提交进一步现场尽调。';
      this.#selection.decide(scenario.scenarioId, scenario.results[0].locationId, conclusion, [
        `模型评分 ${scenario.results[0].score}`,
        `数据完整度 ${scenario.results[0].completeness}%`
      ]);
      this.#message = '推荐、理由和模型证据已保存为决策记录。';
    });
  }
}
