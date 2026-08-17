import type { GeomapFeatureStore } from '../store/feature-store';
import type { LocationEntity, LocationStatus } from '../types';

type ShellMode = 'view' | 'edit';
type ShellSection = 'overview' | 'network' | 'history' | 'selection' | 'data' | 'collaboration';

const STATUS_LABELS: Record<LocationStatus, string> = {
  planned: '计划',
  preparing: '筹备',
  open: '在营',
  paused: '停业',
  closed: '闭店',
  unknown: '未知'
};

function button(
  label: string,
  options: { active?: boolean; disabled?: boolean; section?: ShellSection } = {}
): string {
  const { active = false, disabled = false, section } = options;
  return `<button class="decision-nav-item${active ? ' is-active' : ''}" type="button"${section ? ` data-section="${section}"` : ''}${disabled ? ' disabled' : ''}>${label}${disabled ? '<span>即将推出</span>' : ''}</button>`;
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '更新时间未知';
  return `更新于 ${date.toLocaleString('zh-CN', { hour12: false })}`;
}

export class DecisionShell {
  readonly #store: GeomapFeatureStore;
  readonly #historyEnabled: boolean;
  readonly #selectionEnabled: boolean;
  readonly #dataEnabled: boolean;
  readonly #collaborationEnabled: boolean;
  #mode: ShellMode = 'view';
  #section: ShellSection = 'overview';
  #query = '';
  #region = 'all';
  #status = 'all';
  #root: HTMLElement | null = null;
  #insights: HTMLElement | null = null;
  #historicalLocations: LocationEntity[] | null = null;

  constructor(
    store: GeomapFeatureStore,
    historyEnabled = true,
    selectionEnabled = true,
    dataEnabled = true,
    collaborationEnabled = true
  ) {
    this.#store = store;
    this.#historyEnabled = historyEnabled;
    this.#selectionEnabled = selectionEnabled;
    this.#dataEnabled = dataEnabled;
    this.#collaborationEnabled = collaborationEnabled;
  }

  mount(): void {
    if (document.getElementById('decisionShell')) return;
    this.#mode = sessionStorage.getItem('geomap.shell.mode') === 'edit' ? 'edit' : 'view';
    this.#root = document.createElement('header');
    this.#root.id = 'decisionShell';
    this.#root.className = 'decision-shell';
    this.#root.setAttribute('aria-label', '经营决策工作台');
    document.body.prepend(this.#root);

    this.#insights = document.createElement('aside');
    this.#insights.id = 'decisionInsights';
    this.#insights.className = 'decision-insights';
    this.#insights.setAttribute('aria-label', '门店网络洞察');
    document.body.append(this.#insights);

    document.body.classList.add('decision-shell-enabled');
    this.#applyMode();
    this.#render();
    this.#store.subscribe(() => this.#render());
    window.addEventListener('geomap:history-state-changed', (event) => {
      const detail = (event as CustomEvent<{ locations?: LocationEntity[] | null }>).detail;
      this.#historicalLocations = detail?.locations ? structuredClone(detail.locations) : null;
      this.#render();
    });
    window.addEventListener('resize', () => window.dispatchEvent(new Event('geomap:layout')));
    window.setTimeout(() => window.dispatchEvent(new Event('resize')), 0);
  }

  #filteredLocations(): LocationEntity[] {
    const query = this.#query.trim().toLowerCase();
    const source = this.#historicalLocations ?? this.#store.getState().locations;
    return source.filter((location) => {
      const matchesQuery =
        !query ||
        `${location.name} ${location.address ?? ''} ${location.region ?? ''}`
          .toLowerCase()
          .includes(query);
      return (
        matchesQuery &&
        (this.#region === 'all' || location.region === this.#region) &&
        (this.#status === 'all' || location.status === this.#status)
      );
    });
  }

  #render(): void {
    if (!this.#root || !this.#insights) return;
    const state = this.#store.getState();
    const locations = this.#filteredLocations();
    const sourceLocations = this.#historicalLocations ?? state.locations;
    const allRegions = [
      ...new Set(sourceLocations.map((item) => item.region).filter(Boolean))
    ].sort();
    const openCount = locations.filter((item) => item.status === 'open').length;
    const candidateCount = locations.filter(
      (item) =>
        item.kind === 'candidate' || item.status === 'planned' || item.status === 'preparing'
    ).length;
    const closedCount = locations.filter((item) => item.status === 'closed').length;
    const regionCount = new Set(locations.map((item) => item.region).filter(Boolean)).size;

    this.#root.innerHTML = `
      <div class="decision-shell-topline">
        <div class="decision-brand"><i class="fa-solid fa-map-location-dot"></i><span>Geomap</span><strong>经营决策地图</strong></div>
        <nav class="decision-nav" aria-label="主要功能">
          ${button('总览', { active: this.#section === 'overview', section: 'overview' })}
          ${button('门店网络', { active: this.#section === 'network', section: 'network' })}
          ${button('经营时间', {
            active: this.#section === 'history',
            disabled: !this.#historyEnabled,
            section: this.#historyEnabled ? 'history' : undefined
          })}
          ${button('选址模型', {
            active: this.#section === 'selection',
            disabled: !this.#selectionEnabled,
            section: this.#selectionEnabled ? 'selection' : undefined
          })}
          ${button('数据中心', {
            active: this.#section === 'data',
            disabled: !this.#dataEnabled,
            section: this.#dataEnabled ? 'data' : undefined
          })}
          ${button('协作', {
            active: this.#section === 'collaboration',
            disabled: !this.#collaborationEnabled,
            section: this.#collaborationEnabled ? 'collaboration' : undefined
          })}
        </nav>
        <div class="decision-shell-actions">
          <span class="decision-freshness">${formatUpdatedAt(state.updatedAt)}</span>
          <button id="decisionModeBtn" class="decision-mode-btn" type="button"><i class="fa-solid ${this.#mode === 'view' ? 'fa-pen-to-square' : 'fa-eye'}"></i>${this.#mode === 'view' ? '进入编辑' : '返回查看'}</button>
        </div>
      </div>
      <div class="decision-shell-dashboard">
        <div class="decision-filters">
          <label><span>搜索</span><input id="decisionSearch" value="${this.#escapeAttribute(this.#query)}" placeholder="门店、区域或地址" /></label>
          <label><span>区域</span><select id="decisionRegion"><option value="all">全部区域</option>${allRegions.map((region) => `<option value="${this.#escapeAttribute(region!)}"${region === this.#region ? ' selected' : ''}>${region}</option>`).join('')}</select></label>
          <label><span>状态</span><select id="decisionStatus"><option value="all">全部状态</option>${Object.entries(
            STATUS_LABELS
          )
            .map(
              ([value, label]) =>
                `<option value="${value}"${value === this.#status ? ' selected' : ''}>${label}</option>`
            )
            .join('')}</select></label>
        </div>
        <div class="decision-kpis" aria-label="门店网络概览">
          <article><span>位置总数</span><strong>${locations.length}</strong></article>
          <article><span>在营门店</span><strong>${openCount}</strong></article>
          <article><span>候选/筹备</span><strong>${candidateCount}</strong></article>
          <article><span>闭店</span><strong>${closedCount}</strong></article>
          <article><span>覆盖区域</span><strong>${regionCount}</strong></article>
        </div>
      </div>`;

    const regionSummary = [...new Set(locations.map((item) => item.region).filter(Boolean))]
      .map((region) => ({
        region: region!,
        count: locations.filter((item) => item.region === region).length
      }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 4);
    const missingRegion = locations.filter((item) => !item.region).length;
    this.#insights.innerHTML = `
      <div class="decision-insights-header"><div><span>${this.#section === 'overview' ? '经营总览' : this.#section === 'network' ? '门店网络' : this.#section === 'history' ? '历史状态' : this.#section === 'selection' ? '选址模型' : this.#section === 'collaboration' ? '企业协作' : '经营数据'}</span><strong>${locations.length} 个位置</strong></div><span class="decision-mode-tag">${this.#section === 'history' ? '时间上下文' : this.#section === 'selection' ? '模型情景' : this.#section === 'data' ? '指标口径' : this.#section === 'collaboration' ? '私有空间' : this.#mode === 'view' ? '查看模式' : '编辑模式'}</span></div>
      <section><h2>区域分布</h2>${regionSummary.length ? regionSummary.map((item) => `<button type="button" data-region="${this.#escapeAttribute(item.region)}"><span>${item.region}</span><strong>${item.count}</strong></button>`).join('') : '<p>暂无区域字段</p>'}</section>
      <section><h2>数据提示</h2><p>${missingRegion > 0 ? `${missingRegion} 个位置缺少区域，请在数据中心补充。` : '区域字段完整，可用于管理筛选。'}</p><p>${this.#section === 'history' ? '地图与指标已使用底部时间轴的同一历史状态。' : '进入经营时间可回放事件并比较两个时间点。'}</p></section>
      <section><h2>位置列表</h2><div class="decision-location-list">${
        locations
          .slice(0, 6)
          .map(
            (item) =>
              `<div class="decision-location-row"><button type="button" data-location="${this.#escapeAttribute(item.name)}"><span><strong>${this.#escapeAttribute(item.name)}</strong><small>${this.#escapeAttribute(item.region ?? '未分区')}</small></span><em data-status="${item.status}">${STATUS_LABELS[item.status]}</em></button>${this.#section === 'history' ? `<button type="button" class="decision-add-record" data-add-record="${this.#escapeAttribute(item.locationId)}" aria-label="为${this.#escapeAttribute(item.name)}新增记录">+记录</button>` : ''}</div>`
          )
          .join('') || '<p>当前筛选无结果</p>'
      }</div></section>`;

    this.#bindEvents();
  }

  #bindEvents(): void {
    this.#root?.querySelectorAll<HTMLButtonElement>('[data-section]').forEach((item) => {
      item.addEventListener('click', () => {
        this.#section =
          item.dataset.section === 'network'
            ? 'network'
            : item.dataset.section === 'history'
              ? 'history'
              : item.dataset.section === 'selection'
                ? 'selection'
                : item.dataset.section === 'data'
                  ? 'data'
                  : item.dataset.section === 'collaboration'
                    ? 'collaboration'
                    : 'overview';
        this.#render();
        window.dispatchEvent(
          new CustomEvent('geomap:section-changed', { detail: { section: this.#section } })
        );
      });
    });
    this.#root?.querySelector('#decisionModeBtn')?.addEventListener('click', () => {
      this.#mode = this.#mode === 'view' ? 'edit' : 'view';
      sessionStorage.setItem('geomap.shell.mode', this.#mode);
      this.#applyMode();
      this.#render();
      window.setTimeout(() => window.dispatchEvent(new Event('resize')), 0);
    });
    this.#root
      ?.querySelector<HTMLInputElement>('#decisionSearch')
      ?.addEventListener('input', (event) => {
        this.#query = (event.currentTarget as HTMLInputElement).value;
        this.#applyFilter();
        this.#render();
        const nextInput = this.#root?.querySelector<HTMLInputElement>('#decisionSearch');
        nextInput?.focus();
        nextInput?.setSelectionRange(this.#query.length, this.#query.length);
      });
    this.#root
      ?.querySelector<HTMLSelectElement>('#decisionRegion')
      ?.addEventListener('change', (event) => {
        this.#region = (event.currentTarget as HTMLSelectElement).value;
        this.#applyFilter();
        this.#render();
      });
    this.#root
      ?.querySelector<HTMLSelectElement>('#decisionStatus')
      ?.addEventListener('change', (event) => {
        this.#status = (event.currentTarget as HTMLSelectElement).value;
        this.#applyFilter();
        this.#render();
      });
    this.#insights?.querySelectorAll<HTMLButtonElement>('[data-region]').forEach((item) => {
      item.addEventListener('click', () => {
        this.#region = item.dataset.region ?? 'all';
        this.#applyFilter();
        this.#render();
      });
    });
    this.#insights?.querySelectorAll<HTMLButtonElement>('[data-location]').forEach((item) => {
      item.addEventListener('click', () => {
        window.GeomapLegacyBridge?.focusLocation(item.dataset.location ?? '');
      });
    });
    this.#insights?.querySelectorAll<HTMLButtonElement>('[data-add-record]').forEach((item) => {
      item.addEventListener('click', () => {
        window.dispatchEvent(
          new CustomEvent('geomap:add-record', {
            detail: { locationId: item.dataset.addRecord ?? '' }
          })
        );
      });
    });
  }

  #applyFilter(): void {
    const detail = {
      query: this.#query,
      region: this.#region,
      status: this.#status
    };
    window.GeomapLegacyBridge?.applyLocationFilter(detail);
    window.dispatchEvent(new CustomEvent('geomap:location-filter-changed', { detail }));
  }

  #applyMode(): void {
    document.body.classList.toggle('decision-view-mode', this.#mode === 'view');
    document.body.classList.toggle('decision-edit-mode', this.#mode === 'edit');
  }

  #escapeAttribute(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }
}
