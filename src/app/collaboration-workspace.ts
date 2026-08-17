import { CollaborationApiError } from '../collaboration/api-client';
import type { AuditEntry, CollaborationApiClient, SyncJob } from '../collaboration/api-client';
import type { GeomapFeatureStore } from '../store/feature-store';
import type {
  CollaborationOrganization,
  CollaborationUser,
  RemoteWorkspace,
  RemoteWorkspaceSummary,
  WorkspaceComment
} from '../types';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function dateTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

type Screen = 'disabled' | 'loading' | 'setup' | 'login' | 'ready' | 'share' | 'error';

export class CollaborationWorkspace {
  readonly #store: GeomapFeatureStore;
  readonly #api: CollaborationApiClient | null;
  #root: HTMLElement | null = null;
  #active = false;
  #screen: Screen = 'disabled';
  #message = '';
  #user: CollaborationUser | null = null;
  #organization: CollaborationOrganization | null = null;
  #workspaces: RemoteWorkspaceSummary[] = [];
  #workspace: RemoteWorkspace | null = null;
  #comments: WorkspaceComment[] = [];
  #audit: AuditEntry[] = [];
  #syncJobs: SyncJob[] = [];
  #conflictVersion: number | null = null;

  constructor(store: GeomapFeatureStore, api: CollaborationApiClient | null) {
    this.#store = store;
    this.#api = api;
  }

  mount(): void {
    if (document.getElementById('collaborationWorkspace')) return;
    this.#root = document.createElement('section');
    this.#root.id = 'collaborationWorkspace';
    this.#root.className = 'collaboration-workspace';
    this.#root.setAttribute('aria-label', '私有协作工作区');
    document.body.append(this.#root);
    window.addEventListener('geomap:section-changed', (event) => {
      this.#active =
        (event as CustomEvent<{ section?: string }>).detail?.section === 'collaboration';
      document.body.classList.toggle('collaboration-mode', this.#active);
      this.#render();
      if (this.#active && this.#screen === 'disabled') void this.#initialize();
    });
    const share = new URLSearchParams(location.search).get('share');
    if (share && this.#api) {
      this.#active = true;
      void this.#openShare(share);
    }
    this.#render();
  }

  async #initialize(): Promise<void> {
    if (!this.#api) {
      this.#screen = 'disabled';
      this.#render();
      return;
    }
    this.#screen = 'loading';
    this.#render();
    try {
      const health = await this.#api.health();
      if (!health.configured) this.#screen = 'setup';
      else if (!this.#api.authenticated) this.#screen = 'login';
      else await this.#loadSession();
    } catch (error) {
      this.#fail(error, '无法连接私有协作服务。');
    }
    this.#render();
  }

  async #loadSession(): Promise<void> {
    if (!this.#api) return;
    try {
      const identity = await this.#api.me();
      this.#user = identity.user;
      this.#organization = identity.organization;
      this.#workspaces = await this.#api.listWorkspaces();
      const selected = this.#workspace?.workspaceId ?? this.#workspaces[0]?.workspaceId;
      if (selected) await this.#selectWorkspace(selected);
      this.#screen = 'ready';
    } catch (error) {
      if (error instanceof CollaborationApiError && error.status === 401) {
        this.#screen = 'login';
        this.#message = '会话已过期，请重新登录。';
      } else this.#fail(error, '读取协作工作区失败。');
    }
  }

  async #selectWorkspace(workspaceId: string): Promise<void> {
    if (!this.#api) return;
    this.#workspace = await this.#api.getWorkspace(workspaceId);
    this.#comments = await this.#api.listComments(workspaceId);
    if (this.#user?.role === 'admin' || this.#user?.role === 'owner') {
      [this.#syncJobs, this.#audit] = await Promise.all([
        this.#api.listSyncJobs(workspaceId),
        this.#api.listAudit(workspaceId)
      ]);
    } else {
      this.#syncJobs = [];
      this.#audit = [];
    }
    this.#conflictVersion = null;
  }

  #render(): void {
    if (!this.#root) return;
    this.#root.hidden = !this.#active;
    if (!this.#active) return;
    if (this.#screen === 'disabled') return this.#renderDisabled();
    if (this.#screen === 'loading') {
      this.#root.innerHTML =
        '<div class="collab-state" role="status"><i class="fa-solid fa-circle-notch fa-spin"></i><h1>正在连接私有协作服务</h1></div>';
      return;
    }
    if (this.#screen === 'setup') return this.#renderAuth(true);
    if (this.#screen === 'login') return this.#renderAuth(false);
    if (this.#screen === 'share') return;
    if (this.#screen === 'error') {
      this.#root.innerHTML = `<div class="collab-state"><i class="fa-solid fa-triangle-exclamation"></i><h1>协作服务不可用</h1><p>${escapeHtml(this.#message)}</p><button id="collabRetry" type="button">重试</button></div>`;
      this.#root
        .querySelector('#collabRetry')
        ?.addEventListener('click', () => void this.#initialize());
      return;
    }
    this.#renderReady();
  }

  #renderDisabled(): void {
    if (!this.#root) return;
    this.#root.innerHTML = `
      <div class="collab-state collab-onboarding">
        <i class="fa-solid fa-building-shield"></i><span>v4 私有部署</span><h1>把真实经营数据留在企业边界内</h1>
        <p>当前是本地/公开版，数据只保存在这台设备。GitHub Pages 不提供账号、云同步或多人协作，也不应放置真实经营数据。</p>
        <div><article><strong>1</strong><span>在内网启动私有 API</span></article><article><strong>2</strong><span>配置 TLS、备份与允许来源</span></article><article><strong>3</strong><span>用 <code>?privateApi=https://…</code> 连接</span></article></div>
        <p class="collab-hint">试点可运行 <code>npm run private:server</code>；生产部署请参阅 v4 私有部署文档。</p>
      </div>`;
  }

  #renderAuth(setup: boolean): void {
    if (!this.#root) return;
    this.#root.innerHTML = `
      <div class="collab-auth">
        <aside><i class="fa-solid fa-lock"></i><span>PRIVATE WORKSPACE</span><h1>${setup ? '初始化企业空间' : '登录企业空间'}</h1><p>密码不会进入浏览器工作区文件；服务端使用 scrypt 保存密码摘要，会话只存于当前标签页。</p></aside>
        <form id="collabAuthForm">
          ${setup ? '<label>组织名称<input name="organizationName" required value="经营决策中心" /></label><label>显示名称<input name="displayName" required autocomplete="name" /></label>' : ''}
          <label>邮箱<input name="email" required type="email" autocomplete="username" /></label>
          <label>密码<input name="password" required type="password" minlength="12" autocomplete="current-password" /></label>
          ${this.#message ? `<p role="alert">${escapeHtml(this.#message)}</p>` : ''}
          <button class="is-primary" type="submit">${setup ? '创建组织与所有者' : '登录'}</button>
        </form>
      </div>`;
    this.#root
      .querySelector<HTMLFormElement>('#collabAuthForm')
      ?.addEventListener('submit', (event) => {
        event.preventDefault();
        void this.#authenticate(new FormData(event.currentTarget as HTMLFormElement), setup);
      });
  }

  #renderReady(): void {
    if (!this.#root || !this.#workspace || !this.#user || !this.#organization) return;
    const editable = this.#user.role !== 'viewer';
    const admin = this.#user.role === 'admin' || this.#user.role === 'owner';
    this.#root.innerHTML = `
      <header class="collab-header"><div><span>${escapeHtml(this.#organization.name)}</span><h1>企业协作与发布</h1><p>${escapeHtml(this.#user.displayName)} · ${escapeHtml(this.#user.role)} · 私有 API</p></div><div><select id="collabWorkspace">${this.#workspaces.map((item) => `<option value="${escapeHtml(item.workspaceId)}"${item.workspaceId === this.#workspace!.workspaceId ? ' selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select><button id="collabLogout" type="button">退出</button></div></header>
      ${this.#message ? `<div class="collab-message" role="status">${escapeHtml(this.#message)}</div>` : ''}
      ${this.#conflictVersion ? `<div class="collab-conflict" role="alert"><strong>检测到版本冲突</strong><span>服务器已是 v${this.#conflictVersion}。未覆盖他人的修改；请先拉取服务器版本，再重新核对本地改动。</span><button id="collabResolveConflict" type="button">拉取服务器版本</button></div>` : ''}
      <div class="collab-kpis"><article><span>远端版本</span><strong>v${this.#workspace.version}</strong><small>${dateTime(this.#workspace.updatedAt)}</small></article><article><span>本地位置</span><strong>${this.#store.getState().locations.length}</strong><small>同步前请核对范围</small></article><article><span>开放评论</span><strong>${this.#comments.filter((item) => item.status === 'open').length}</strong><small>${this.#comments.length} 条全部评论</small></article><article><span>同步任务</span><strong>${this.#syncJobs.filter((item) => item.enabled).length}</strong><small>最短间隔 5 分钟</small></article></div>
      <div class="collab-actions"><button id="collabPull" type="button"><i class="fa-solid fa-download"></i> 拉取服务器版本</button><button id="collabPush" class="is-primary" type="button"${editable ? '' : ' disabled'}><i class="fa-solid fa-cloud-arrow-up"></i> 保存本地工作区</button><button id="collabShare" type="button"${editable ? '' : ' disabled'}>创建只读分享</button><button id="collabBrief" type="button">生成决策简报</button></div>
      <div class="collab-grid">
        <section><header><div><span>讨论</span><h2>实体评论与 @提醒</h2></div></header><form id="collabCommentForm"><input name="entityRef" placeholder="实体 ID（可选）" /><textarea name="body" required placeholder="输入评论，可使用 @同组织成员邮箱"></textarea><button type="submit">发表评论</button></form><div class="collab-list">${
          this.#comments
            .slice()
            .reverse()
            .map(
              (item) =>
                `<article><div><strong>${escapeHtml(item.entityRef ?? '工作区')}</strong><em>${item.status === 'open' ? '开放' : '已解决'}</em></div><p>${escapeHtml(item.body)}</p><small>${dateTime(item.createdAt)}</small>${item.status === 'open' && editable ? `<button data-resolve="${escapeHtml(item.commentId)}" type="button">标记已解决</button>` : ''}</article>`
            )
            .join('') || '<p>还没有评论。</p>'
        }</div></section>
        <section><header><div><span>治理</span><h2>版本、权限与审计</h2></div></header><div class="collab-list">${
          this.#audit
            .slice(0, 8)
            .map(
              (item) =>
                `<article><div><strong>${escapeHtml(item.action)}</strong><em>${dateTime(item.createdAt)}</em></div><small>${escapeHtml(item.userId)}</small></article>`
            )
            .join('') || '<p>暂无审计记录。</p>'
        }</div>${admin ? '<button id="collabAddMember" type="button">添加组织成员</button><button id="collabAddSync" type="button">创建文件投递同步</button>' : '<p class="collab-hint">成员与同步配置仅管理员可见。</p>'}</section>
      </div>`;
    this.#bindReadyEvents();
  }

  #bindReadyEvents(): void {
    this.#root
      ?.querySelector<HTMLSelectElement>('#collabWorkspace')
      ?.addEventListener('change', async (event) => {
        try {
          await this.#selectWorkspace((event.currentTarget as HTMLSelectElement).value);
        } catch (error) {
          this.#message = error instanceof Error ? error.message : '切换工作区失败。';
        }
        this.#render();
      });
    this.#root?.querySelector('#collabLogout')?.addEventListener('click', async () => {
      await this.#api?.logout();
      this.#screen = 'login';
      this.#user = null;
      this.#render();
    });
    this.#root?.querySelector('#collabPull')?.addEventListener('click', () => this.#pull());
    this.#root
      ?.querySelector('#collabResolveConflict')
      ?.addEventListener('click', () => this.#pull());
    this.#root?.querySelector('#collabPush')?.addEventListener('click', () => void this.#push());
    this.#root?.querySelector('#collabShare')?.addEventListener('click', () => void this.#share());
    this.#root?.querySelector('#collabBrief')?.addEventListener('click', () => void this.#brief());
    this.#root
      ?.querySelector<HTMLFormElement>('#collabCommentForm')
      ?.addEventListener('submit', (event) => {
        event.preventDefault();
        void this.#comment(new FormData(event.currentTarget as HTMLFormElement));
      });
    this.#root
      ?.querySelectorAll<HTMLButtonElement>('[data-resolve]')
      .forEach((button) =>
        button.addEventListener('click', () => void this.#resolve(button.dataset.resolve!))
      );
    this.#root
      ?.querySelector('#collabAddMember')
      ?.addEventListener('click', () => void this.#addMember());
    this.#root
      ?.querySelector('#collabAddSync')
      ?.addEventListener('click', () => void this.#addSync());
  }

  async #authenticate(form: FormData, setup: boolean): Promise<void> {
    if (!this.#api) return;
    try {
      const email = String(form.get('email') ?? '');
      const password = String(form.get('password') ?? '');
      if (setup)
        await this.#api.setup({
          organizationName: String(form.get('organizationName') ?? ''),
          displayName: String(form.get('displayName') ?? ''),
          email,
          password
        });
      else await this.#api.login(email, password);
      this.#message = '';
      await this.#loadSession();
    } catch (error) {
      this.#message = error instanceof Error ? error.message : '认证失败。';
    }
    this.#render();
  }

  #pull(): void {
    if (!this.#workspace?.state) {
      this.#message = '远端工作区为空，尚无可拉取的数据。';
    } else {
      this.#store.replace(this.#workspace.state);
      this.#conflictVersion = null;
      this.#message = `已拉取服务器 v${this.#workspace.version}。`;
    }
    this.#render();
  }

  async #push(): Promise<void> {
    if (!this.#api || !this.#workspace) return;
    try {
      this.#workspace = await this.#api.saveWorkspace(
        this.#workspace.workspaceId,
        this.#workspace.version,
        this.#store.getState()
      );
      this.#conflictVersion = null;
      this.#message = `已保存为服务器 v${this.#workspace.version}。`;
      await this.#refreshAuxiliary();
    } catch (error) {
      if (error instanceof CollaborationApiError && error.status === 409) {
        this.#conflictVersion = Number(error.details?.currentVersion ?? 0) || null;
        this.#message = '保存被阻止：远端版本已变化。';
      } else this.#message = error instanceof Error ? error.message : '保存失败。';
    }
    this.#render();
  }

  async #comment(form: FormData): Promise<void> {
    if (!this.#api || !this.#workspace) return;
    try {
      await this.#api.addComment(
        this.#workspace.workspaceId,
        String(form.get('entityRef') ?? ''),
        String(form.get('body') ?? '')
      );
      await this.#refreshAuxiliary();
      this.#message = '评论已发布。';
    } catch (error) {
      this.#message = error instanceof Error ? error.message : '评论发布失败。';
    }
    this.#render();
  }

  async #resolve(commentId: string): Promise<void> {
    if (!this.#api || !this.#workspace) return;
    try {
      await this.#api.resolveComment(this.#workspace.workspaceId, commentId, true);
      await this.#refreshAuxiliary();
    } catch (error) {
      this.#message = error instanceof Error ? error.message : '评论状态更新失败。';
    }
    this.#render();
  }

  async #share(): Promise<void> {
    if (!this.#api || !this.#workspace) return;
    try {
      const share = await this.#api.createShare(
        this.#workspace.workspaceId,
        `管理层快照 v${this.#workspace.version}`
      );
      const url = `${location.origin}${location.pathname}?privateApi=${encodeURIComponent(this.#api.baseUrl)}&share=${encodeURIComponent(share.token)}`;
      await navigator.clipboard?.writeText(url).catch(() => undefined);
      this.#message = `只读分享已创建并复制链接，有效期至 ${dateTime(share.expiresAt)}。`;
    } catch (error) {
      this.#message = error instanceof Error ? error.message : '创建分享失败。';
    }
    this.#render();
  }

  async #brief(): Promise<void> {
    if (!this.#api || !this.#workspace) return;
    try {
      const value = await this.#api.createBrief(
        this.#workspace.workspaceId,
        `经营决策简报 v${this.#workspace.version}`,
        `${this.#store.getState().locations.length} 个位置；${this.#comments.filter((item) => item.status === 'open').length} 条开放评论。`
      );
      this.#message = `简报已固化：${value.briefId}`;
    } catch (error) {
      this.#message = error instanceof Error ? error.message : '生成简报失败。';
    }
    this.#render();
  }

  async #addMember(): Promise<void> {
    if (!this.#api) return;
    const email = window.prompt('成员邮箱');
    if (!email) return;
    const displayName = window.prompt('显示名称', email.split('@')[0]) ?? '';
    const password = window.prompt('临时密码（至少 12 位）') ?? '';
    try {
      await this.#api.addMember({ email, displayName, password, role: 'viewer' });
      this.#message = `已添加查看者 ${email}。`;
    } catch (error) {
      this.#message = error instanceof Error ? error.message : '添加成员失败。';
    }
    this.#render();
  }

  async #addSync(): Promise<void> {
    if (!this.#api || !this.#workspace) return;
    try {
      await this.#api.createSyncJob(this.#workspace.workspaceId, {
        name: '经营数据文件投递',
        adapter: 'file-drop',
        scheduleMinutes: 60
      });
      await this.#refreshAuxiliary();
      this.#message = '已创建每小时文件投递同步任务。';
    } catch (error) {
      this.#message = error instanceof Error ? error.message : '创建同步任务失败。';
    }
    this.#render();
  }

  async #refreshAuxiliary(): Promise<void> {
    if (!this.#api || !this.#workspace) return;
    this.#comments = await this.#api.listComments(this.#workspace.workspaceId);
    if (this.#user?.role === 'admin' || this.#user?.role === 'owner') {
      [this.#syncJobs, this.#audit] = await Promise.all([
        this.#api.listSyncJobs(this.#workspace.workspaceId),
        this.#api.listAudit(this.#workspace.workspaceId)
      ]);
    }
  }

  async #openShare(token: string): Promise<void> {
    if (!this.#api) return;
    this.#active = true;
    this.#screen = 'loading';
    this.#render();
    try {
      const share = await this.#api.readShare(token);
      this.#store.replace(share.snapshot);
      document.body.classList.add('decision-view-mode', 'collaboration-share-mode');
      document.documentElement.style.setProperty('--collab-brand', share.brand.primaryColor);
      this.#screen = 'share';
      if (this.#root)
        this.#root.innerHTML = `<div class="collab-share-banner"><strong>${escapeHtml(share.brand.productName)}</strong><span>${escapeHtml(share.name)} · 只读快照 v${share.workspaceVersion}</span><em>有效期至 ${dateTime(share.expiresAt)}</em></div>`;
    } catch (error) {
      this.#fail(error, '分享链接无效或已过期。');
      this.#render();
    }
  }

  #fail(error: unknown, fallback: string): void {
    this.#screen = 'error';
    this.#message = error instanceof Error ? `${fallback} ${error.message}` : fallback;
  }
}
